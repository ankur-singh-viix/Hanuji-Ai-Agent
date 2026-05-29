import { Router } from 'express';
import { db } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.user?.userId]
    );
    res.json(result.rows[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', async (req: AuthRequest, res) => {
  const { name, timezone, language, work_start, work_end, preferences } = req.body;
  try {
    const result = await db.query(
      `UPDATE user_profiles
       SET name=$2, timezone=$3, language=$4, work_start=$5, work_end=$6, preferences=$7
       WHERE user_id=$1 RETURNING *`,
      [req.user?.userId, name, timezone, language, work_start, work_end, JSON.stringify(preferences || {})]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversations', async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  try {
    const result = await db.query(
      `SELECT * FROM conversation_logs
       WHERE user_id=$1
       ORDER BY created_at DESC LIMIT $2`,
      [req.user?.userId, limit]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
