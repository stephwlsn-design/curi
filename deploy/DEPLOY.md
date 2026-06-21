# Deploy Curi to https://curi.corpcrunch.io

## Git-based deploy (recommended)

Push to `main` → GitHub Actions SSHs to your server → `git pull` → Docker rebuild.

### One-time setup

**1. Create GitHub repo** and push this project:

```bash
cd curi
git init
git add .
git commit -m "Initial Curi platform"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/curi.git
git push -u origin main
```

**2. On your server** (Ubuntu + Docker):

```bash
export GIT_REPO=https://github.com/YOUR_ORG/curi.git
export DEPLOY_PATH=/opt/curi
git clone "$GIT_REPO" "$DEPLOY_PATH"
cd "$DEPLOY_PATH"
cp server/.env.production.example server/.env.production
nano server/.env.production   # JWT_SECRET, GEMINI_API_KEY
chmod +x deploy/git-deploy.sh
./deploy/git-deploy.sh
```

**3. DNS** — `curi.corpcrunch.io` A record → server IP

**4. GitHub repo secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH user (e.g. `ubuntu`) |
| `DEPLOY_SSH_KEY` | Private SSH key (full PEM) |
| `DEPLOY_PATH` | `/opt/curi` |

Optional: `DEPLOY_PORT` (default `22`)

**5. Push to deploy:**

```bash
git push origin main
```

Monitor: GitHub → Actions → "Deploy to curi.corpcrunch.io"

### Manual git pull on server

```bash
cd /opt/curi
git pull origin main
./deploy/git-deploy.sh
```

---

## Manual deploy (no CI)


- A Linux server (Ubuntu 22.04+ recommended) with Docker and Docker Compose v2
- DNS **A record**: `curi.corpcrunch.io` → your server public IP
- Ports **80** and **443** open on the firewall
- API keys (minimum: `GEMINI_API_KEY` or `OPENAI_API_KEY`)

## 1. Server setup

```bash
# Install Docker (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, then:
docker compose version
```

## 2. Clone and configure

```bash
git clone <your-repo-url> curi
cd curi

# Create production env from template
cp server/.env.production.example server/.env.production

# Edit secrets — REQUIRED before go-live:
nano server/.env.production
```

**Must change before deploy:**

| Variable | Action |
|----------|--------|
| `JWT_SECRET` | Run `openssl rand -base64 48` and paste result |
| `GEMINI_API_KEY` | Your Google AI Studio key (or set OpenAI/Anthropic) |
| `SEED_DEMO_USER` | Keep `false` in production |

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy will automatically obtain a Let's Encrypt certificate for `curi.corpcrunch.io`.

## 4. Verify

```bash
# Container health
docker compose -f docker-compose.prod.yml ps

# API health (via HTTPS)
curl https://curi.corpcrunch.io/health

# App
open https://curi.corpcrunch.io
```

Expected health response:

```json
{"status":"ok","version":"1.0.0","timestamp":"..."}
```

## 5. Post-deploy checklist

- [ ] DNS propagated (`dig curi.corpcrunch.io`)
- [ ] HTTPS loads without certificate warnings
- [ ] Sign up at `/auth/register` works
- [ ] Sign in works
- [ ] Discover / Create modules return AI content (API keys valid)
- [ ] Uploads persist after container restart (volume `uploads_data`)

## Architecture (production)

```
Internet
   │
   ▼
Caddy (:443 TLS)  ──►  client (nginx :80)  ──►  static React app
                              │
                              └── /api/* ──►  server (:5000)
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                                 MongoDB          Redis         uploads volume
```

## Useful commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f caddy

# Restart after env change
docker compose -f docker-compose.prod.yml up -d --build server

# Full redeploy
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# Backup MongoDB
docker compose -f docker-compose.prod.yml exec mongo \
  mongodump --archive=/data/db/backup-$(date +%F).archive --db curi
```

## OAuth callbacks (when enabling social login)

Set redirect URLs in each provider console to:

- `https://curi.corpcrunch.io/api/publish/callback/linkedin`
- `https://curi.corpcrunch.io/api/publish/callback/twitter`
- `https://curi.corpcrunch.io/api/publish/callback/facebook` (Instagram + Facebook)
- `http://localhost:5001/api/publish/callback/facebook` (local Meta OAuth)
- (etc. per platform)

## Staging with demo user

To enable the demo account (`demo@curi.app` / `Test1234!`) on a staging server:

```bash
SEED_DEMO_USER=true docker compose -f docker-compose.prod.yml up -d --build server
```

**Do not enable on production.**

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Certificate not issued | Confirm DNS points to server; ports 80/443 reachable |
| 502 Bad Gateway | `docker compose -f docker-compose.prod.yml logs server` — check Mongo/Redis |
| CORS errors | Ensure `CLIENT_URL=https://curi.corpcrunch.io` in `.env.production` |
| AI 429 / errors | Verify API keys; prefer `GEMINI_API_KEY` |
| Uploads missing after restart | Confirm `uploads_data` volume is mounted |

## Local production test (optional)

```bash
# Add to /etc/hosts:  127.0.0.1 curi.corpcrunch.io
# Temporarily point Caddyfile at :80 only for local testing
docker compose -f docker-compose.prod.yml up --build
```
