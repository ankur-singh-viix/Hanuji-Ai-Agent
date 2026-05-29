import { Router } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { db } from '../lib/db';

const router = Router();

// Register / Login via Telegram user_id or create account
router.post('/login', async (req, res) => {
  const { userId, channel = 'web', name } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    // Upsert user
    const result = await db.query(
      `INSERT INTO user_profiles (user_id, channel, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET name = COALESCE($3, user_profiles.name)
       RETURNING *`,
      [userId, channel, name]
    );

    const user = result.rows[0];
    const secret: Secret = process.env.JWT_SECRET || 'default-secret';
    const token = jwt.sign(
      { id: user.id, userId: user.user_id },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user });
  }catch (error: any) {
  console.error("LOGIN ERROR:", error);

  res.status(500).json({
    message: error.message,
    stack: error.stack
  });
}
});

export default router;
