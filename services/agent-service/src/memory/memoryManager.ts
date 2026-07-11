import Redis from 'ioredis';
import axios from 'axios';
import { db } from '../lib/db';
import { logger } from '../lib/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const SESSION_TTL = 60 * 60 * 2; // 2 hours
const MAX_HISTORY = 5;

// 🔥 Local LLM Call (Ollama)
async function callLocalModel(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const fullPrompt = `
${systemPrompt}

User:
${userPrompt}

Assistant:
Respond ONLY with valid JSON.
`;

    const response = await axios.post(
      'http://127.0.0.1:11434/api/generate',
      {
        model: 'phi3:latest', // You can change to 'mistral'
        prompt: fullPrompt,
        stream: false,
      },
      { timeout: 15000 }
    );

    return response.data.response;
  } catch (error: any) {
    logger.error('Ollama fact extraction error', { error: error.message });
    return '[]';
  }
}

export class MemoryManager {
 async retrieveContext(userId: string, message: string, channel: string = 'web') {
    const [recentHistory, longTermFacts, userProfile] = await Promise.all([
      this.getRecentHistory(userId),
      this.getLongTermFacts(userId),
      this.getUserProfile(userId, channel),
    ]);

    return { recentHistory, longTermFacts, userProfile };
  }

  async getRecentHistory(userId: string): Promise<any[]> {
    try {
      const key = `hanuji:session:${userId}`;
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async getLongTermFacts(userId: string): Promise<string[]> {
    try {
      const result = await db.query(
        `SELECT content, category FROM memory_facts
         WHERE user_id=$1 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );
      return result.rows.map(r => `[${r.category}] ${r.content}`);
    } catch {
      return [];
    }
  }

  async getUserProfile(userId: string, channel: string = 'web') {
    try {
      const result = await db.query(
        'SELECT * FROM user_profiles WHERE user_id=$1',
        [userId]
      );

      if (result.rows[0]) return result.rows[0];

      // No profile yet — this is a first-time contact from a channel that
      // doesn't go through the web signup flow (e.g. Telegram, WhatsApp).
      // Auto-create a minimal profile so tools like create_task work
      // immediately instead of failing with "No user profile found".
      const created = await db.query(
        `INSERT INTO user_profiles (user_id, channel)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId, channel]
      );

      if (created.rows[0]) {
        logger.info('Auto-created user profile', { userId, channel });
        return created.rows[0];
      }

      // Extremely rare race: another request created it between our SELECT
      // and INSERT. Just fetch it.
      const retry = await db.query(
        'SELECT * FROM user_profiles WHERE user_id=$1',
        [userId]
      );
      return retry.rows[0] || null;
    } catch (err: any) {
      logger.error('getUserProfile failed', { userId, channel, err: err.message });
      return null;
    }
  }

  async saveToMemory(userId: string, userMsg: string, assistantMsg: string, intent: string) {
    // 🔹 Short-term memory (Redis)
    const key = `hanuji:session:${userId}`;
    try {
      const history = await this.getRecentHistory(userId);
      history.push(
        { role: 'user', content: userMsg },
        { role: 'assistant', content: assistantMsg }
      );

      const trimmed = history.slice(-MAX_HISTORY);
      await redis.setex(key, SESSION_TTL, JSON.stringify(trimmed));
    } catch (err: any) {
      logger.error('Redis session save failed', { err: err.message });
    }

    // 🔹 Long-term fact extraction (non-blocking)
    if (userMsg.length < 25) return;


// Skip fact extraction for general queries
    const lower = userMsg.toLowerCase();
    if (
      lower.includes("what") ||
      lower.includes("why") ||
      lower.includes("how") ||
      lower.includes("meaning") ||
      lower.includes("importance")
    ) {
      return;
    }

    try {
      await this.extractAndStoreFacts(userId, userMsg);
    } catch (err: any) {
      logger.warn('Fact extraction failed', {
        err: err.message
      });
    }
  }



  private async extractAndStoreFacts(userId: string, message: string) {
    if (message.length < 20) return;

    try {
      const systemPrompt = `
Extract important long-term facts from user messages.

Return STRICT JSON ARRAY only:
[
  {
    "category": "preference|contact|constraint|goal|fact",
    "content": "short concise fact",
    "confidence": 0.9
  }
]

Return [] if nothing worth storing.
Only include clear, specific, useful facts.
`;

      const raw = await callLocalModel(systemPrompt, message);

      let facts: Array<{ category: string; content: string; confidence: number }> = [];

      try {
        const cleaned = raw.replace(/```json|```/g, '').trim();
        facts = JSON.parse(cleaned);
      } catch {
        logger.warn('Fact JSON parse failed');
        return;
      }

      for (const fact of facts) {
        if (fact.confidence >= 0.7) {
          await db.query(
            `INSERT INTO memory_facts (user_id, category, content, confidence, source)
             VALUES ($1, $2, $3, $4, 'user_stated')
             ON CONFLICT DO NOTHING`,
            [userId, fact.category, fact.content, fact.confidence]
          );

          logger.info('Stored memory fact', {
            userId,
            category: fact.category,
          });
        }
      }
    } catch (err: any) {
      logger.warn('Could not extract facts', { err: err.message });
    }
  }
}