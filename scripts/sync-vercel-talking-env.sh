#!/usr/bin/env bash
# Sync talking-character env to Vercel production: ElevenLabs on, Fal off.
#
# Usage:
#   VERCEL_TOKEN=xxx npm run sync:vercel-talking
#
# Reads ELEVENLABS_API_KEY from server/.env. Removes FAL_KEY / FAL_API_KEY from Vercel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/server/.env"
PROJECT_ID="prj_sLehLRi7VCWvlCyhEvnB0SuTKKjF"
TEAM_ID="team_vpvBd5zaZWuDiwVRAlUlHJpo"
API="https://api.vercel.com"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: Set VERCEL_TOKEN (create at https://vercel.com/account/tokens)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

get_env_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
}

ELEVENLABS_API_KEY="$(get_env_val ELEVENLABS_API_KEY)"
if [[ -z "$ELEVENLABS_API_KEY" || "$ELEVENLABS_API_KEY" == "..." ]]; then
  echo "ERROR: ELEVENLABS_API_KEY is not set in server/.env"
  exit 1
fi

auth_header="Authorization: Bearer ${VERCEL_TOKEN}"
team_qs="teamId=${TEAM_ID}"

echo "==> Fetching current Vercel env vars…"
existing="$(curl -sf "${API}/v10/projects/${PROJECT_ID}/env?${team_qs}" -H "$auth_header")"

upsert_env() {
  local key="$1"
  local value="$2"
  local id
  id="$(echo "$existing" | node -e "
    const key = process.argv[1];
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const hit = (data.envs || []).find((e) => e.key === key);
    process.stdout.write(hit ? hit.id : '');
  " "$key")"

  if [[ -n "$id" ]]; then
    echo "    Updating ${key}…"
    curl -sf -X PATCH "${API}/v10/projects/${PROJECT_ID}/env/${id}?${team_qs}" \
      -H "$auth_header" -H "Content-Type: application/json" \
      -d "$(node -e "
        console.log(JSON.stringify({
          value: process.argv[1],
          target: ['production', 'preview', 'development'],
          type: 'encrypted',
        }));
      " "$value")" >/dev/null
  else
    echo "    Adding ${key}…"
    curl -sf -X POST "${API}/v10/projects/${PROJECT_ID}/env?${team_qs}" \
      -H "$auth_header" -H "Content-Type: application/json" \
      -d "$(node -e "
        console.log(JSON.stringify({
          key: process.argv[1],
          value: process.argv[2],
          target: ['production', 'preview', 'development'],
          type: 'encrypted',
        }));
      " "$key" "$value")" >/dev/null
  fi
}

remove_env() {
  local key="$1"
  local id
  id="$(echo "$existing" | node -e "
    const key = process.argv[1];
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const hit = (data.envs || []).find((e) => e.key === key);
    process.stdout.write(hit ? hit.id : '');
  " "$key")"
  if [[ -n "$id" ]]; then
    echo "    Removing ${key}…"
    curl -sf -X DELETE "${API}/v10/projects/${PROJECT_ID}/env/${id}?${team_qs}" \
      -H "$auth_header" >/dev/null
  else
    echo "    ${key} not set on Vercel (ok)"
  fi
}

echo "==> Setting ELEVENLABS_API_KEY on Vercel (production + preview)…"
upsert_env ELEVENLABS_API_KEY "$ELEVENLABS_API_KEY"

echo "==> Removing Fal lip-sync keys (voice-only production)…"
remove_env FAL_KEY
remove_env FAL_API_KEY

echo ""
echo "OK — redeploy for changes to take effect:"
echo "  Vercel dashboard → Deployments → Redeploy"
echo "  or: git commit --allow-empty -m 'redeploy' && git push"
