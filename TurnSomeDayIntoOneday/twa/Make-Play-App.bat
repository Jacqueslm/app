@echo off
cd /d "%~dp0"
title Make Play App
echo ============================================
echo   MAKING YOUR PLAY STORE APP FILE
echo   Keep this window open. Takes a few minutes.
echo ============================================
echo.
if not exist android-upload.keystore (
  echo ERROR: android-upload.keystore is not in this folder.
  echo This file must sit next to your key, in:
  echo C:\dayone\app-claude-vibe-code-uwxxlk\TurnSomeDayIntoOneday\twa
  pause
  exit /b 1
)
if exist twa-manifest.json copy /y twa-manifest.json twa-manifest-old.json >nul
echo Getting the new settings...
curl -f -s -o twa-manifest.json https://raw.githubusercontent.com/Jacqueslm/app/main/TurnSomeDayIntoOneday/twa/twa-manifest.json
if errorlevel 1 (
  echo ERROR: could not download settings. Check the internet, then double-click again.
  pause
  exit /b 1
)
echo Step 1 of 3: updating the builder - takes a minute or two...
call npm install -g @bubblewrap/cli
if errorlevel 1 (
  echo ERROR at step 1. Screenshot this window and send it to Claude.
  pause
  exit /b 1
)
echo Step 2 of 3: rebuilding the app project...
call bubblewrap update --skipVersionUpgrade
if errorlevel 1 (
  echo ERROR at step 2. Screenshot this window and send it to Claude.
  pause
  exit /b 1
)
echo.
echo Step 3 of 3: building the app.
echo *** IT WILL ASK FOR YOUR KEY PASSWORD ***
echo Type it and press Enter. NOTHING SHOWS WHILE YOU TYPE - that is normal.
echo If it asks a second time, type the same password again.
echo.
call bubblewrap build
if errorlevel 1 (
  echo.
  echo Build did not finish - most likely the password was wrong.
  echo Double-click this file to try again with a different password.
  pause
  exit /b 1
)
echo.
echo ============================================
echo   DONE! Your new app file is ready:
echo   app-release-bundle.aab  - in this folder
echo   Upload it: Play Console - Production - Create new release
echo ============================================
pause
