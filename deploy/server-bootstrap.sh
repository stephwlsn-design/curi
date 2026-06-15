#!/usr/bin/env bash
# First-time server setup for git-based deploy to curi.corpcrunch.io
# Run ON THE SERVER as a user with docker access.
#
# Usage:
#   export GIT_REPO=https://github.com/YOUR_ORG/curi.git
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/curi/main/deploy/server-bootstrap.sh)"
#
# Or after cloning:
#   GIT_REPO=... bash deploy/server-bootstrap.sh

set -euo pipefail

GIT_REPO="${GIT_REPO:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/curi}"
DOMAIN="${DOMAIN:-curi.corpcrunch.io}"

if [[ -z "$GIT_REPO" ]]; then
  echo "Set GIT_REPO to your repository URL, e.g.:"
  echo "  export GIT_REPO=https://github.com/stephwlsn-design/curi.git"
  exit 1
fi

echo "==> Installing Docker (if needed)"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
  echo "Log out and back in so docker group applies, then re-run this script."
  exit 0
fi

echo "==> Cloning repository to $DEPLOY_PATH"
sudo mkdir -p "$(dirname "$DEPLOY_PATH")"
if [[ -d "$DEPLOY_PATH/.git" ]]; then
  echo "Repo already exists at $DEPLOY_PATH — pulling latest"
  cd "$DEPLOY_PATH" && git pull origin main
else
  sudo git clone "$GIT_REPO" "$DEPLOY_PATH"
  sudo chown -R "$USER":"$USER" "$DEPLOY_PATH"
  cd "$DEPLOY_PATH"
fi

if [[ ! -f server/.env.production ]]; then
  cp server/.env.production.example server/.env.production
  echo ""
  echo "IMPORTANT: Edit secrets before going live:"
  echo "  nano $DEPLOY_PATH/server/.env.production"
  echo ""
  echo "Required:"
  echo "  JWT_SECRET=\$(openssl rand -base64 48)"
  echo "  GEMINI_API_KEY=your-key"
  echo ""
  read -r -p "Press Enter after editing .env.production (or Ctrl+C to exit)..."
fi

chmod +x deploy/git-deploy.sh deploy/check.sh
bash deploy/git-deploy.sh

echo ""
echo "Deployed! Verify: curl -s https://$DOMAIN/health"
echo ""
echo "GitHub Actions: add these repository secrets:"
echo "  DEPLOY_HOST     = server IP or hostname"
echo "  DEPLOY_USER     = SSH username"
echo "  DEPLOY_SSH_KEY  = private key (PEM)"
echo "  DEPLOY_PATH     = $DEPLOY_PATH"
