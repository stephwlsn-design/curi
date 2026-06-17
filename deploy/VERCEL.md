# Deploy Curi on Vercel

Host the full app (React + Express API) on [Vercel](https://vercel.com) with auto-deploy from [GitHub](https://github.com/stephwlsn-design/curi).

**Production URL:** https://curi.corpcrunch.io

---

## 1. Connect GitHub to Vercel (recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **stephwlsn-design/curi**
3. Vercel auto-detects `vercel.json` — click **Deploy**
4. Every `git push` to `main` triggers a new deployment

## 2. Environment variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Required | Example |
|----------|----------|---------|
| `MONGODB_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/curi` |
| `JWT_SECRET` | Yes | `openssl rand -base64 48` |
| `GEMINI_API_KEY` | Yes* | Your Google AI key |
| `CLIENT_URL` | Yes | `https://curi.corpcrunch.io` |
| `REDIS_URL` | Optional | Upstash Redis URL (for queues) |
| `PEXELS_API_KEY` | Optional | [Pexels API key](https://www.pexels.com/api/) for stock photos & videos in Design |
| `ELEVENLABS_API_KEY` | Optional | Talking Character voices in Design Studio (Starter plan + API permissions) |
| `OPENAI_API_KEY` | Optional | Fallback TTS if ElevenLabs unavailable |
| `GEMINI_MODEL` | Optional | `gemini-2.5-flash` |
| `SEED_DEMO_USER` | Optional | `false` |

\* Or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`

Use **MongoDB Atlas** (free tier): [mongodb.com/atlas](https://www.mongodb.com/atlas)

## 3. Custom domain

1. Vercel → Project → **Settings → Domains**
2. Add `curi.corpcrunch.io`
3. At your DNS provider, add the record Vercel shows (usually **CNAME** `curi` → `cname.vercel-dns.com`)

No A record needed when using Vercel DNS/CNAME.

## 4. GitHub Actions (optional CI)

If you prefer Actions over Vercel's native Git integration, add these **GitHub Secrets**:

| Secret | Where to find |
|--------|----------------|
| `VERCEL_TOKEN` | Vercel → Account → Tokens |
| `VERCEL_ORG_ID` | Project Settings → General |
| `VERCEL_PROJECT_ID` | Project Settings → General |

Workflow: `.github/workflows/vercel.yml`

## 5. Verify

```bash
curl https://curi.corpcrunch.io/health
curl https://curi.corpcrunch.io/api/auth/login
```

Open https://curi.corpcrunch.io

---

## Architecture on Vercel

```
curi.corpcrunch.io
├── Static files     → client/dist (Vite build)
├── /api/*           → serverless Express (api/index.js)
└── /*               → index.html (SPA)
```

## Limitations on Vercel

| Feature | Status |
|---------|--------|
| Auth, Create, Design, Launch | Works |
| File uploads | `/tmp` only (not persistent across deploys) |
| Autonomous background jobs | Needs Redis + worker (use Docker deploy for full pipeline) |
| Long campaigns (>60s) | May timeout on Hobby plan |

For full autonomous engine + persistent uploads, use [deploy/DEPLOY.md](./DEPLOY.md) (Docker/VPS).

## Local Vercel preview

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```
