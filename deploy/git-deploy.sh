#!/usr/bin/env bash
# Run on the server after git pull — builds and restarts production stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f server/.env.production ]]; then
  echo "ERROR: server/.env.production not found on server."
  echo "  cp server/.env.production.example server/.env.production"
  echo "  nano server/.env.production"
  exit 1
fi

echo "==> Deploying Curi at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "==> Commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

docker compose -f docker-compose.prod.yml pull mongo redis caddy 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "==> Waiting for health..."
for i in {1..30}; do
  if docker compose -f docker-compose.prod.yml exec -T server node -e \
    "require('http').get('http://127.0.0.1:5000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
    2>/dev/null; then
    echo "OK — server healthy"
    docker compose -f docker-compose.prod.yml ps
    exit 0
  fi
  sleep 2
done

echo "ERROR: Server did not become healthy in time"
docker compose -f docker-compose.prod.yml logs --tail=80 server
exit 1
