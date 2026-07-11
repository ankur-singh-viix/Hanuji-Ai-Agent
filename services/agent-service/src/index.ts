import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import { logger } from './lib/logger';
import { AgentCore } from './agentCore';
import { MemoryManager } from './memory/memoryManager';

const app = express();
app.use(express.json({ limit: '10mb' }));

const agent = new AgentCore();
const memory = new MemoryManager();

// Internal endpoint called by webhook-service
app.post('/process', async (req, res) => {
  const { userId, channel, message, sessionId } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message required' });
  }

  const start = Date.now();

  try {
    logger.info(`Processing message`, { userId, channel, messageLength: message.length });

    // 1. Get context from memory
    const context = await memory.retrieveContext(userId, message, channel);

    // 2. Run agent
    const result = await agent.process({ userId, channel, message, context });

    // 3. Save to memory asynchronously
    memory.saveToMemory(userId, message, result.reply, result.intent).catch((err) =>
      logger.error('Memory save failed', { err: err.message })
    );

    const latency = Date.now() - start;
    logger.info(`Message processed`, { userId, intent: result.intent, latency });

    res.json({ ...result, latency });
  } catch (err: any) {
    logger.error('Agent processing failed', { err: err.message, stack: err.stack });
    res.status(500).json({
      reply: "I ran into an issue. Could you try again? 🙏",
      intent: 'error',
      error: err.message,
    });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.AGENT_SERVICE_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🧠 Agent Service running on http://localhost:${PORT}`);
});
