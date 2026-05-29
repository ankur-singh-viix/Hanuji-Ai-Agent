import { Router, Request } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../lib/logger';
import { messageQueue } from '../lib/queue';

export const whatsappRouter = Router();

const WA_API = `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_ID}`;
const AGENT_URL = `http://localhost:${process.env.AGENT_SERVICE_PORT || 3001}`;

// ── Webhook Verification (GET) ───────────────────────────
whatsappRouter.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// ── Incoming Messages (POST) ─────────────────────────────
whatsappRouter.post('/', async (req: any, res) => {
  // 1. Verify signature FIRST
  try {
    verifySignature(req);
  } catch (err: any) {
    logger.warn('Invalid WA signature', { ip: req.ip });
    return res.sendStatus(401);
  }

  // 2. Return 200 IMMEDIATELY (must be within 5 seconds)
  res.status(200).json({ status: 'ok' });

  // 3. Process asynchronously
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const messages = change?.value?.messages;

    if (!messages || messages.length === 0) return; // status update, not message

    for (const msg of messages) {
      if (msg.type !== 'text') continue; // skip media for now

      const phone   = msg.from;
      const text    = msg.text.body;
      const userId  = `wa_${phone}`;
      const contact = change.value.contacts?.[0];
      const name    = contact?.profile?.name || phone;

      logger.info('WhatsApp message received', { userId, textLength: text.length });

      // Enqueue for processing
      await messageQueue.add('process-whatsapp', {
        userId,
        phone,
        name,
        text,
        channel: 'whatsapp',
        timestamp: msg.timestamp,
      }, {
        attempts:    3,
        backoff:     { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail:     50,
      });
    }
  } catch (err: any) {
    logger.error('WA message processing error', { err: err.message });
  }
});

// ── Signature Verification ───────────────────────────────
function verifySignature(req: any) {
  if (!process.env.WA_APP_SECRET) return; // skip if not configured

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) throw new Error('Missing signature header');

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WA_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  const valid = signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!valid) throw new Error('Signature mismatch');
}

// ── Send WhatsApp Message ────────────────────────────────
export async function sendWhatsAppMessage(to: string, text: string) {
  try {
    await axios.post(`${WA_API}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }, {
      headers: {
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err: any) {
    logger.error('WhatsApp send failed', { err: err.message, to });
  }
}

export async function sendWhatsAppButtons(to: string, bodyText: string, buttons: { id: string; title: string }[]) {
  try {
    await axios.post(`${WA_API}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body:   { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) }, // max 20 chars
          })),
        },
      },
    }, {
      headers: {
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err: any) {
    logger.error('WhatsApp button send failed', { err: err.message });
  }
}
