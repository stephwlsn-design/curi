#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Curi pre-deploy checks"

if [[ ! -f server/.env.production ]]; then
  echo "ERROR: server/.env.production missing. Run:"
  echo "  cp server/.env.production.example server/.env.production"
  exit 1
fi

if grep -q 'CHANGE_ME_USE_openssl_rand_base64_48' server/.env.production; then
  echo "ERROR: Set JWT_SECRET in server/.env.production"
  echo "  openssl rand -base64 48"
  exit 1
fi

if ! grep -qE '^GEMINI_API_KEY=.+' server/.env.production && \
   ! grep -qE '^OPENAI_API_KEY=.+' server/.env.production && \
   ! grep -qE '^ANTHROPIC_API_KEY=.+' server/.env.production; then
  echo "WARNING: No AI provider key set (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY)"
fi

echo "==> Validating docker-compose.prod.yml"
docker compose -f docker-compose.prod.yml config >/dev/null

echo "==> Building client"
(cd client && npm run build)

echo "OK — ready to deploy:"
echo "  npm run deploy:prod"
