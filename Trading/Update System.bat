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
curl -s -o "pine\MSB-Indicator.pine"  "%BASE%/pine/MSB-Indicator.pine"    && echo   [ok] indicator  (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Scout.pine"      "%BASE%/pine/MSB-Scout.pine"        && echo   [ok] scout
curl -s -o "pine\MSB-Strategy.pine"   "%BASE%/pine/MSB-Strategy.pine"     && echo   [ok] backtester
curl -s -o "pine\MSB-Pure.pine"       "%BASE%/pine/MSB-Pure.pine"         && echo   [ok] pure indicator
curl -s -o "pine\MSB-Pure-Alerts.pine" "%BASE%/pine/MSB-Pure-Alerts.pine" && echo   [ok] pure watcher

echo.
echo   Done. Refresh the grader tab with Ctrl+F5.
echo.
pause
