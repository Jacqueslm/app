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
curl -s -o "DAILY-USE.md"             "%BASE%/DAILY-USE.md"               && echo   [ok] daily-use guide
curl -s -o "PLAYBOOK.md"              "%BASE%/PLAYBOOK.md"                && echo   [ok] playbook
curl -s -o "BOT-SETUP.md"             "%BASE%/BOT-SETUP.md"               && echo   [ok] bot setup guide
curl -s -o "relay\server.js"          "%BASE%/relay/server.js"            && echo   [ok] alert relay + autotrade bot
curl -s -o "ninjatrader\MSBPure.cs"   "%BASE%/ninjatrader/MSBPure.cs"      && echo   [ok] ninjatrader strategy
curl -s -o "pine\MSB-Pure.pine"       "%BASE%/pine/MSB-Pure.pine"         && echo   [ok] backtester   (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Pure-Alerts.pine" "%BASE%/pine/MSB-Pure-Alerts.pine" && echo   [ok] watcher      (re-paste into TradingView if it changed)
curl -s -o "YOUR-RULES.md"            "%BASE%/YOUR-RULES.md"              && echo   [ok] your rules

REM The old filtered scripts are gone - the system is pure structure now.
REM If pine\MSB-Indicator.pine, MSB-Scout.pine, MSB-Strategy.pine or
REM MSB-Diagnostic.pine are still sitting in that folder, they are dead
REM files: delete them, and delete their alerts in TradingView.
del /q "pine\MSB-Indicator.pine" "pine\MSB-Scout.pine" "pine\MSB-Strategy.pine" "pine\MSB-Diagnostic.pine" >nul 2>&1

echo.
echo   Done. Refresh the grader tab with Ctrl+F5.
echo.
pause
