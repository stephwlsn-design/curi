# 🐶 Curi — AI Marketing Platform

> Turn any website URL into a complete AI marketing engine.

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB 7+
- Redis 7+
- API keys (OpenAI, Anthropic, see `.env.example`)

### Development

```bash
# Install all dependencies
npm run install:all

# Copy env file and fill in your keys
cp server/.env.example server/.env

# Start dev servers (client + server)
npm run dev
```

- **Client** → http://localhost:5173
- **Server** → http://localhost:5000
- **API Health** → http://localhost:5000/health
- **Roast Tool** → http://localhost:5173/roast

### Production (https://curi.corpcrunch.io)

```bash
# 1. Point DNS: curi.corpcrunch.io → your server IP
# 2. Configure production secrets
cp server/.env.production.example server/.env.production
# Edit JWT_SECRET, GEMINI_API_KEY, etc.

# 3. Deploy with Docker + automatic HTTPS (Caddy)
npm run deploy:prod
```

Full guide: [deploy/DEPLOY.md](deploy/DEPLOY.md)

### Development Docker

```bash
docker-compose up -d
```

## Architecture

```
curi/
├── client/         # React + Vite + Tailwind frontend
│   └── src/
│       ├── pages/          # Route-level components
│       ├── components/     # Shared UI
│       ├── context/        # Auth + state
│       └── styles/         # Global CSS
│
└── server/         # Express + MongoDB API
    └── src/
        ├── routes/         # API endpoints
        ├── controllers/    # Business logic handlers
        ├── services/       # AI + third-party integrations
        ├── models/         # Mongoose schemas
        ├── middleware/     # Auth, rate limiting, errors
        └── config/         # DB, Redis, env
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Sign in |
| GET  | /api/auth/me | Get current user |
| POST | /api/discover | Analyze website URL |
| POST | /api/discover/roast | Public website roast (no auth) |
| POST | /api/create/post | Generate social post |
| POST | /api/create/blog | Generate blog article |
| POST | /api/launch/campaign | Generate full campaign |
| GET  | /api/launch/campaign/:id | Poll campaign status |
| POST | /api/publish/now | Publish to social platform |
| POST | /api/publish/schedule | Schedule content |
| POST | /api/publish/connect/:platform | Connect social account |

## Curi Modules

| Module | Status | Credits |
|--------|--------|---------|
| 🔍 Discover | ✅ MVP | 5 |
| ✍️ Create | ✅ MVP | 1 |
| 🎨 Design | 🚧 Sprint 3 | 5 |
| 🎬 Video | 🚧 Sprint 4 | 20 |
| 📧 Mail | 🚧 Sprint 5 | 5 |
| 🚀 Launch | ✅ MVP | 50 |
| 📅 Calendar | 🔮 V2 | 10 |
| ♻️ Repurpose | 🔮 V2 | 5 |
| 📈 Trends | 🔮 V2 | 3 |
| 👁️ Competitor | 🔮 V2 | 10 |
| 🔥 Roast | ✅ Free/Public | 0 |

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Framer Motion, React Query, Zustand

**Backend:** Node.js, Express, MongoDB + Mongoose, Redis + BullMQ

**AI:** OpenAI GPT-4o, Anthropic Claude 3.5, Stability AI, Runway ML, ElevenLabs

**Infra:** Docker, AWS ECS, S3, CloudFront, Auth0
