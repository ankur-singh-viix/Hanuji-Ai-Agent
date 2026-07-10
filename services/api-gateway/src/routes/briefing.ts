import { Router } from 'express';
import { db } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;

  try {
    const [todayTasks, overdueTasks, memoriesCount] = await Promise.all([
      db.query(
        `SELECT id, title, due_at
         FROM tasks
         WHERE user_id=$1
           AND status='pending'
           AND due_at >= date_trunc('day', NOW())
           AND due_at <  date_trunc('day', NOW()) + INTERVAL '1 day'
         ORDER BY due_at ASC`,
        [userId]
      ),
      db.query(
        `SELECT id, title, due_at
         FROM tasks
         WHERE user_id=$1
           AND status='pending'
           AND due_at < NOW()
         ORDER BY due_at ASC`,
        [userId]
      ),
      db.query(
        `SELECT COUNT(*) as total FROM memory_facts WHERE user_id=$1`,
        [userId]
      ),
    ]);

    res.json({
      todayTasks: todayTasks.rows,
      pendingReminders: overdueTasks.rows,
      memoriesTotal: Number(memoriesCount.rows[0]?.total || 0),
      // Recent Memories and Yesterday Summary depend on features not built
      // yet (Automatic Memory Importance / conversation summaries).
      // Returning explicit nulls so the frontend can show an honest
      // "coming soon" state instead of fake or silently empty data.
      recentMemories: null,
      yesterdaySummary: null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;