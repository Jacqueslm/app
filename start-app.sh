#!/usr/bin/env bash
# Turn Someday Into Day One - double-click launcher (Linux / anything with bash)
# Starts the app and opens Studio in your browser. No terminal knowledge needed.
set -e
cd "$(dirname "$0")/TurnSomeDayIntoOneday/server"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js isn't installed yet. Grab it from https://nodejs.org (LTS version),"
  echo "install it, then double-click this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi

# First run: create .env with a stable session secret so you stay signed in.
if [ ! -f .env ]; then
  echo "PORT=4300" > .env
  echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
  echo "Created server/.env with a fresh session secret."
fi

PORT=$(grep -E '^PORT=' .env | cut -d= -f2)
PORT=${PORT:-4300}
URL="http://localhost:${PORT}/studio/"

# Already running? Just open the browser.
if curl -s -o /dev/null --max-time 2 "$URL"; then
  echo "App is already running - opening $URL"
  (xdg-open "$URL" >/dev/null 2>&1 || true) &
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing (this happens once, give it a minute)..."
  npm install --no-audit --no-fund
fi

echo "Starting Turn Someday Into Day One..."
(sleep 2 && (xdg-open "$URL" >/dev/null 2>&1 || echo "Open this in your browser: $URL")) &
exec node server.js
