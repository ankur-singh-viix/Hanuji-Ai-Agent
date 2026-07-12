import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import { logger } from './lib/logger';
import { telegramRouter } from './handlers/telegram';
import { whatsappRouter } from './handlers/whatsapp';
import { startWorker } from './lib/queue';
import { startPersonalTelegram, getContactMessages, sendMessageToContact } from './personalTelegram';

const app = express();

// Raw body needed for WhatsApp signature verification
app.use((req, res, next) => {
  express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  })(req, res, next);
});

// ── Routes ──────────────────────────────────────────────
app.use('/webhooks/telegram',   telegramRouter);
app.use('/webhooks/whatsapp',   whatsappRouter);

// ── Internal API (called by agent-service tools only) ────
// Protected by INTERNAL_API_SECRET so nothing external can reach these.
function requireInternalSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/internal/telegram/messages', requireInternalSecret, async (req, res) => {
  try {
    const query = String(req.query.query || '');
    const limit = Number(req.query.limit) || 20;
    const result = await getContactMessages(query, limit);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/internal/telegram/send', requireInternalSecret, async (req, res) => {
  try {
    const { query, message } = req.body;
    const result = await sendMessageToContact(query, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start queue worker ───────────────────────────────────
startWorker().then(() => {
  logger.info('BullMQ worker started');
}).catch(err => {
  logger.error('Worker failed to start', { err: err.message });
});

// ── Start personal Telegram automation (optional) ────────
startPersonalTelegram().catch(err => {
  logger.error('Personal Telegram automation failed to start', { err: err.message });
});

const PORT = process.env.WEBHOOK_SERVICE_PORT || 3002;
app.listen(PORT, () => {
  logger.info(`📡 Webhook Service running on http://localhost:${PORT}`);
  logger.info(`  Telegram: POST /webhooks/telegram`);
  logger.info(`  WhatsApp: POST/GET /webhooks/whatsapp`);
});