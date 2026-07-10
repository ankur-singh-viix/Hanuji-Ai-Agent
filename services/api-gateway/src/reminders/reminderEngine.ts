import { db } from '../lib/db';
import { logger } from '../lib/logger';

const CHECK_INTERVAL_MS = 60 * 1000; // every 1 minute

export function startReminderEngine(
  broadcast: (userId: string, event: object) => void
) {
  logger.info('⏰ Reminder engine started (checking every 60s)');

  const checkDueReminders = async () => {
    try {
      const due = await db.query(
        `SELECT id, user_id, title
         FROM tasks
         WHERE status = 'pending'
           AND due_at IS NOT NULL
           AND due_at <= NOW()
           AND reminded_at IS NULL`
      );

      for (const task of due.rows) {
        const content = `⏰ Reminder: "${task.title}" was due now. Let me know if you've finished it or need to reschedule.`;

        const inserted = await db.query(
          `INSERT INTO conversation_logs (user_id, channel, role, content, intent)
           VALUES ($1, 'reminder', 'assistant', $2, 'reminder')
           RETURNING id`,
          [task.user_id, content]
        );

        await db.query(
          `UPDATE tasks SET reminded_at = NOW() WHERE id = $1`,
          [task.id]
        );

        broadcast(task.user_id, {
          type: 'reminder',
          id: inserted.rows[0].id,
          content,
        });

        logger.info('Reminder fired', { taskId: task.id, userId: task.user_id });
      }
    } catch (err: any) {
      logger.error('Reminder engine check failed', { err: err.message });
    }
  };

  // Run once on startup, then every minute
  checkDueReminders();
  setInterval(checkDueReminders, CHECK_INTERVAL_MS);
}