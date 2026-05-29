# 🐒 Hanu Ji — Personal AI Agent

A full-stack personal AI assistant with Telegram, WhatsApp, Google Calendar, memory, and a React dashboard.

## Stack
- **Backend**: Node.js + Express + TypeScript
- **AI**: Anthropic Claude (via API)
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL + Redis
- **Queue**: BullMQ
- **Orchestration**: n8n (self-hosted)
- **Interfaces**: Telegram Bot + WhatsApp Cloud API

## Quick Start (VS Code)

### Prerequisites
- Node.js 20+
- Docker Desktop
- VS Code with REST Client extension (optional)

### 1. Clone & Configure
```bash
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Start Infrastructure (Postgres + Redis)
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Install Dependencies
```bash
# Install all services at once
npm run install:all
```

### 4. Run Database Migrations
```bash
npm run db:migrate
```

### 5. Start All Services
```bash
npm run dev
```

This starts:
- API Gateway → http://localhost:3000
- Agent Service → http://localhost:3001
- Webhook Service → http://localhost:3002
- Frontend Dashboard → http://localhost:5173
- n8n Workflows → http://localhost:5678

### 6. Set Up Telegram Bot
```bash
# Replace BOT_TOKEN with your token from @BotFather
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://your-ngrok-url.ngrok.io/webhooks/telegram"
```

Use [ngrok](https://ngrok.com) for local development:
```bash
ngrok http 3002
```

## Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| api-gateway | 3000 | Auth, routing, REST API |
| agent-service | 3001 | AI brain, tool dispatch |
| webhook-service | 3002 | Telegram + WhatsApp listeners |
| frontend | 5173 | React dashboard |
| n8n | 5678 | Workflow automation |
| postgres | 5432 | Primary database |
| redis | 6379 | Cache + queue |

## Project Structure
```
hanu-ji/
├── frontend/           # React dashboard
├── services/
│   ├── api-gateway/    # Express auth + routing
│   ├── agent-service/  # Claude AI core
│   └── webhook-service/# Telegram + WhatsApp
├── database/           # Migrations + seeds
├── n8n-workflows/      # Importable workflow JSON
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```
