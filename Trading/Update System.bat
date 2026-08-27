@echo off
title MSB - Update System
cd /d "%~dp0"
set BASE=https://raw.githubusercontent.com/Jacqueslm/app/main/Trading

echo.
echo   Updating the MSB trading system in this folder...
echo.

if not exist "pine" mkdir "pine"
if not exist "relay" mkdir "relay"
if not exist "ninjatrader" mkdir "ninjatrader"

curl -s -o "trade-grader.html"        "%BASE%/trade-grader.html"          && echo   [ok] trade grader
curl -s -o "journal.html"             "%BASE%/journal.html"               && echo   [ok] journal      (your saved trades are kept - they live in the browser, not this file)
curl -s -o "DAILY-USE.md"             "%BASE%/DAILY-USE.md"               && echo   [ok] daily-use guide
curl -s -o "PLAYBOOK.md"              "%BASE%/PLAYBOOK.md"                && echo   [ok] playbook
curl -s -o "BOT-SETUP.md"             "%BASE%/BOT-SETUP.md"               && echo   [ok] bot setup guide
curl -s -o "relay\server.js"          "%BASE%/relay/server.js"            && echo   [ok] alert relay + autotrade bot
curl -s -o "ninjatrader\MSBPure.cs"   "%BASE%/ninjatrader/MSBPure.cs"      && echo   [ok] ninjatrader strategy
curl -s -o "pine\MSB-Price.pine"        "%BASE%/pine/MSB-Price.pine"        && echo   [ok] MSB-PRICE backtester  (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Price-Alerts.pine" "%BASE%/pine/MSB-Price-Alerts.pine" && echo   [ok] MSB-PRICE alerts      (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Companion.pine"    "%BASE%/pine/MSB-Companion.pine"    && echo   [ok] MSB-EYES companion    (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Pure.pine"       "%BASE%/pine/MSB-Pure.pine"         && echo   [ok] old Pure backtester
curl -s -o "pine\MSB-Pure-Alerts.pine" "%BASE%/pine/MSB-Pure-Alerts.pine" && echo   [ok] old Pure watcher
curl -s -o "YOUR-RULES.md"            "%BASE%/YOUR-RULES.md"              && echo   [ok] your rules

REM The old filtered scripts are gone - the system is pure structure now.
del /q "pine\MSB-Indicator.pine" "pine\MSB-Scout.pine" "pine\MSB-Strategy.pine" "pine\MSB-Diagnostic.pine" >nul 2>&1

REM Last of all, this updater refreshes itself so next run knows about any
REM newly added files. The swap happens after this window is done reading
REM the file, which is why it is the final step.
curl -s -o "Update System.new.bat" "%BASE%/Update System.bat"
findstr /c:"MSB - Update System" "Update System.new.bat" >nul 2>&1 && (
  start "" /min cmd /c "timeout /t 2 >nul & move /y "Update System.new.bat" "Update System.bat" >nul"
) || del /q "Update System.new.bat" >nul 2>&1

echo.
echo   Done. Refresh the grader/journal tabs with Ctrl+F5.
echo.
pause
