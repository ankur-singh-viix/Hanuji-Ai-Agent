import { Router } from 'express';
import { db } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const [messages, tools, memories] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN created_at > NOW() - INTERVAL '24h' THEN 1 ELSE 0 END) as today
         FROM conversation_logs WHERE user_id=$1`,
        [req.user?.userId]
      ),
      db.query(
        `SELECT tool_used,
                COUNT(*) AS total
         FROM conversation_logs
         WHERE user_id=$1
           AND tool_used IS NOT NULL
         GROUP BY tool_used
         ORDER BY total DESC
         LIMIT 5;`,
        [req.user?.userId]
      ),

      db.query(
        `SELECT COUNT(*) as total FROM memory_facts WHERE user_id=$1`,
        [req.user?.userId]
      ),
    ]);

    res.json({
      messages: messages.rows[0],
      topTools: tools.rows,
      memories: memories.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/daily', async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as messages
       FROM conversation_logs
       WHERE user_id=$1 AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [req.user?.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
