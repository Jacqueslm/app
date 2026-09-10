#!/bin/sh
# Your AI — Linux launcher. Double-click or run from a terminal.
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "First run: installing what it needs..."
  npm install
fi
if [ ! -f .env ]; then
  cp env.example.txt .env
  echo "First run: created YourAI/.env — open it and paste an AI key (see the notes inside)."
fi
echo "Your AI is starting... open http://localhost:4410"
node server.js