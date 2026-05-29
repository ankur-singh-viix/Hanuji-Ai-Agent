import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import { logger } from './lib/logger';
import { telegramRouter } from './handlers/telegram';
import { whatsappRouter } from './handlers/whatsapp';
import { startWorker } from './lib/queue';

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
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start queue worker ───────────────────────────────────
startWorker().then(() => {
  logger.info('BullMQ worker started');
}).catch(err => {
  logger.error('Worker failed to start', { err: err.message });
});

const PORT = process.env.WEBHOOK_SERVICE_PORT || 3002;
app.listen(PORT, () => {
  logger.info(`📡 Webhook Service running on http://localhost:${PORT}`);
  logger.info(`  Telegram: POST /webhooks/telegram`);
  logger.info(`  WhatsApp: POST/GET /webhooks/whatsapp`);
});
