import { db } from '../lib/db';
import { logger } from '../lib/logger';

export const taskTools = [
  {
    name: 'create_task',
    description: 'Creates a personal task/todo for the user, optionally with a due date',
    schema: {
      type: 'object',
      required: ['title'],
      properties: {
        title:       { type: 'string', description: 'Short task title' },
        description: { type: 'string', description: 'Optional extra detail' },
        due_at:      { type: 'string', description: 'ISO 8601 datetime the task is due (optional)' },
        recurrence:  { type: 'string', description: 'Optional recurrence rule, e.g. daily, weekly' },
      },
    },
    handler: async (params: any, profile: any) => {
      const userId = profile?.user_id;
      if (!userId) throw new Error('No user profile found for task creation');

      const result = await db.query(
        `INSERT INTO tasks (user_id, title, description, due_at, recurrence)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, status, due_at, recurrence, created_at`,
        [
          userId,
          params.title,
          params.description || null,
          params.due_at || null,
          params.recurrence || null,
        ]
      );

      const task = result.rows[0];
      logger.info('Task created', { id: task.id, userId });
      return task;
    },
  },

  {
    name: 'list_tasks',
    description: "Lists the user's tasks, optionally filtered by status",
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, completed (default: pending)' },
        limit:  { type: 'integer', default: 10 },
      },
    },
    handler: async (params: any, profile: any) => {
      const userId = profile?.user_id;
      if (!userId) throw new Error('No user profile found for task lookup');

      const status = params.status || 'pending';
      const limit = params.limit || 10;

      const result = await db.query(
        `SELECT id, title, description, status, due_at, recurrence, created_at
         FROM tasks
         WHERE user_id=$1 AND status=$2
         ORDER BY due_at NULLS LAST, created_at DESC
         LIMIT $3`,
        [userId, status, limit]
      );

      logger.info('Tasks listed', { userId, count: result.rows.length });
      return { tasks: result.rows, count: result.rows.length };
    },
  },

  {
    name: 'complete_task',
    description: 'Marks a task as completed by its ID',
    schema: {
      type: 'object',
      required: ['task_id'],
      properties: {
        task_id: { type: 'string', description: 'The task ID to mark completed' },
      },
    },
    handler: async (params: any, profile: any) => {
      const userId = profile?.user_id;
      if (!userId) throw new Error('No user profile found for task update');

      const result = await db.query(
        `UPDATE tasks SET status='completed', updated_at=NOW()
         WHERE id=$1 AND user_id=$2
         RETURNING id, title, status`,
        [params.task_id, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Task not found');
      }

      logger.info('Task completed', { id: params.task_id, userId });
      return result.rows[0];
    },
  },
];