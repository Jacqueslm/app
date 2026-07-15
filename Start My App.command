#!/usr/bin/env bash
# Turn Someday Into Day One - Mac launcher. Double-click me in Finder.
# (If macOS complains the first time: right-click -> Open -> Open.)
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
  open "$URL"
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing (this happens once, give it a minute)..."
  npm install --no-audit --no-fund
fi

echo "Starting Turn Someday Into Day One..."
echo "Keep this window open while you use the app. Close it to stop."
(sleep 2 && open "$URL") &
exec node server.js
