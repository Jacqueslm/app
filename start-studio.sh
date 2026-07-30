#!/usr/bin/env bash
# Studio - Linux launcher.
set -e
cd "$(dirname "$0")/Studio/server"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js isn't installed yet. Grab it from https://nodejs.org (LTS version),"
  echo "install it, then run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if ! node -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)" >/dev/null 2>&1; then
  echo ""
  echo "Your Node.js ($(node -v)) is too old - this app needs Node 22.5 or newer."
  echo "Update it at https://nodejs.org (LTS version), then run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -f .env ]; then
  echo "PORT=4400" > .env
  echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
  echo "Created Studio/server/.env with a fresh session secret."
fi

PORT=$(grep -E '^PORT=' .env | cut -d= -f2)
PORT=${PORT:-4400}
URL="http://localhost:${PORT}/"

if curl -s -o /dev/null --max-time 2 "$URL"; then
  echo "Studio is already running - opening $URL"
  (xdg-open "$URL" >/dev/null 2>&1 || true) &
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing (this happens once, give it a minute)..."
  npm install --no-audit --no-fund
fi

echo "Starting Studio..."
(sleep 2 && (xdg-open "$URL" >/dev/null 2>&1 || echo "Open this in your browser: $URL")) &
exec node server.js
