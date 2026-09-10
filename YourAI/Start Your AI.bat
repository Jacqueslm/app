@echo off
rem Your AI - Windows launcher. Double-click to start.
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing what it needs...
  call npm install
)
if not exist .env (
  copy env.example.txt .env >nul
  echo First run: created YourAI\.env - open it and paste an AI key (see the notes inside).
)
echo Your AI is starting... open http://localhost:4410
node server.js
pause