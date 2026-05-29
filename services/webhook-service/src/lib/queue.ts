import { Queue, Worker } from 'bullmq';
import Redis from 'bullmq/node_modules/ioredis';
import axios from 'axios';
import { logger } from './logger';
import { sendWhatsAppMessage, sendWhatsAppButtons } from '../handlers/whatsapp';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required for BullMQ
});

const AGENT_URL = `http://localhost:${process.env.AGENT_SERVICE_PORT || 3001}`;

// ── Queue ─────────────────────────────────────────────────
export const messageQueue = new Queue('hanuji-messages', { connection });

// ── Worker ────────────────────────────────────────────────
export async function startWorker() {
  const worker = new Worker('hanuji-messages', async (job) => {
    const { userId, phone, text, name, channel, timestamp } = job.data;

    logger.info(`Processing job ${job.id}`, { userId, channel });

    // Rate limit check
    const rateLimitKey = `ratelimit:${userId}`;
    const count = await connection.incr(rateLimitKey);
    if (count === 1) await connection.expire(rateLimitKey, 60);

    if (count > 20) {
      logger.warn('Rate limit exceeded', { userId });
      if (channel === 'whatsapp') {
        await sendWhatsAppMessage(phone, '⚠️ You\'re sending messages too quickly. Please wait a minute.');
      }
      return;
    }

    // Call agent service
    const response = await axios.post(`${AGENT_URL}/process`, {
      userId,
      channel,
      message: text,
      userMeta: { name, phone },
    }, { timeout: 30000 });

    const { reply, needsConfirmation, confirmationData } = response.data;

    // Send response back to user
    if (channel === 'whatsapp') {
      if (needsConfirmation && confirmationData) {
        await sendWhatsAppButtons(phone, reply, [
          { id: `confirm:${JSON.stringify(confirmationData)}`, title: '✅ Yes, do it' },
          { id: 'cancel', title: '❌ Cancel' },
        ]);
        // Store pending action in Redis for button callback
        await connection.setex(`pending:${userId}`, 300, JSON.stringify(confirmationData));
      } else {
        await sendWhatsAppMessage(phone, reply);
      }
    }

  }, {
    connection,
    concurrency: 10,
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed`, { err: err.message });
  });

  return worker;
}
