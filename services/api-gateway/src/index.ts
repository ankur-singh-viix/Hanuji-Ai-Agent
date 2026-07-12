import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';

dotenv.config({ path: '../../.env' });

import { db } from './lib/db';
import { redis } from './lib/redis';
import { logger } from './lib/logger';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import memoryRoutes from './routes/memory';
import analyticsRoutes from './routes/analytics';
import { authenticate } from './middleware/auth';
import taskRoutes from './routes/tasks';
import { startReminderEngine } from './reminders/reminderEngine';
import briefingRoutes from './routes/briefing';

const app = express();
const server = createServer(app);

// ── WebSocket Server (for real-time dashboard) ──────────
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  const userId = new URL(req.url!, `http://localhost`).searchParams.get('userId') || 'anon';
  clients.set(userId, ws);
  logger.info(`WS client connected: ${userId}`);

  ws.on('close', () => {
    clients.delete(userId);
    logger.info(`WS client disconnected: ${userId}`);
  });
});

// Export broadcast function for other parts to use
export const broadcast = (userId: string, event: object) => {
  const client = clients.get(userId);
  if (client?.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(event));
  }
};

// ── Middleware ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true });
app.use('/api', limiter);

// ── Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/memory', authenticate, memoryRoutes);
app.use('/api/analytics', authenticate, analyticsRoutes);
app.use('/api/tasks', authenticate, taskRoutes);
app.use('/api/briefing', authenticate, briefingRoutes);


app.post('/api/chat', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }


    const agentResponse = await axios.post(
      'http://127.0.0.1:3001/process',
      {
        userId,
        channel: 'web',
        message,

      },
       { timeout: 600000 }
    );

    
  // Save conversation
await db.query(
  `INSERT INTO conversation_logs
(user_id, channel, role, content, intent, tool_used, latency_ms)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`,
[
  userId,
  'web',
  'user',
  message,
  agentResponse.data.intent,
  agentResponse.data.toolUsed || null,
  agentResponse.data.latency || 0
]
);


await db.query(
  `INSERT INTO conversation_logs
(user_id, channel, role, content, intent, tool_used, latency_ms)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`,
[
  userId,
  'web',
  'assistant',
  agentResponse.data.reply,
  agentResponse.data.intent,
  agentResponse.data.toolUsed || null,
  agentResponse.data.latency || 0
]
);



    return res.json(agentResponse.data);

  } catch (err: any) {
    logger.error('Chat route failed', { err: err.message });

    return res.status(500).json({
      reply: "⚠️ Agent service error.",
      intent: "error"
    });
  }
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded' });
  }
});

// ── Start ────────────────────────────────────────────────
const PORT = process.env.API_GATEWAY_PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🐒 API Gateway running on http://localhost:${PORT}`);
  startReminderEngine(broadcast);
});

export default app;
