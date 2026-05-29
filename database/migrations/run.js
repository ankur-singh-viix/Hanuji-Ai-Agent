// database/migrations/run.js
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/${process.env.POSTGRES_DB}`;

const migrations = `
-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  channel TEXT DEFAULT 'telegram',
  name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  language TEXT DEFAULT 'en',
  work_start TIME DEFAULT '09:00',
  work_end TIME DEFAULT '18:00',
  preferences JSONB DEFAULT '{}',
  google_tokens JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Long-term memory facts
CREATE TABLE IF NOT EXISTS memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  category TEXT,
  content TEXT NOT NULL,
  vector_id TEXT,
  confidence FLOAT DEFAULT 1.0,
  source TEXT DEFAULT 'user_stated',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  tool_context JSONB DEFAULT '{}',
  recurrence TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation logs
CREATE TABLE IF NOT EXISTS conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  channel TEXT,
  role TEXT,
  content TEXT,
  intent TEXT,
  tool_used TEXT,
  tool_result JSONB,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memory_user
ON memory_facts(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status
ON tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_logs_user_created
ON conversation_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_created
ON conversation_logs(created_at DESC);
`;

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to Database');

    await client.query(migrations);

    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();