import { Router } from 'express';
import { db } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  const status = (req.query.status as string) || 'pending';
  try {
    const result = await db.query(
      `SELECT * FROM tasks
       WHERE user_id=$1 AND status=$2
       ORDER BY due_at NULLS LAST, created_at DESC`,
      [req.user?.userId, status]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `UPDATE tasks SET status='completed', updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user?.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;