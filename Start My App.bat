@echo off
rem Turn Someday Into Day One - Windows launcher. Double-click me.
setlocal enabledelayedexpansion
cd /d "%~dp0TurnSomeDayIntoOneday\server"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js isn't installed yet. Grab it from https://nodejs.org ^(LTS version^),
  echo install it, then double-click this file again.
  pause
  exit /b 1
)

rem First run: create .env with a stable session secret so you stay signed in.
if not exist .env (
  echo PORT=4300> .env
  for /f %%s in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do echo SESSION_SECRET=%%s>> .env
  echo Created server\.env with a fresh session secret.
)

set PORT=4300
for /f "tokens=2 delims==" %%p in ('findstr /b "PORT=" .env') do set PORT=%%p
set URL=http://localhost:%PORT%/

rem Already running? Just open the browser.
curl -s -o nul --max-time 2 %URL% >nul 2>nul
if not errorlevel 1 (
  echo App is already running - opening %URL%
  start "" %URL%
  exit /b 0
)

if not exist node_modules (
  echo First-time setup: installing ^(this happens once, give it a minute^)...
  call npm install --no-audit --no-fund
)

echo Starting Turn Someday Into Day One...
echo Keep this window open while you use the app. Close it to stop.
start "" /b cmd /c "timeout /t 3 >nul & start "" %URL%"
node server.js
