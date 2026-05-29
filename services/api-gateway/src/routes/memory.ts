import { Router } from 'express';
import { db } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM memory_facts WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user?.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await db.query(
      `DELETE FROM memory_facts WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user?.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
