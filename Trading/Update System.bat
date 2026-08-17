@echo off
title MSB - Update System
cd /d "%~dp0"
set BASE=https://raw.githubusercontent.com/Jacqueslm/app/claude/day-trading-market-structure-8kzz7w/Trading

echo.
echo   Updating the MSB trading system in this folder...
echo.

if not exist "pine" mkdir "pine"
if not exist "relay" mkdir "relay"

curl -s -o "trade-grader.html"        "%BASE%/trade-grader.html"        && echo   [ok] trade grader
curl -s -o "DAILY-USE.md"             "%BASE%/DAILY-USE.md"             && echo   [ok] daily-use guide
curl -s -o "PLAYBOOK.md"              "%BASE%/PLAYBOOK.md"              && echo   [ok] playbook
curl -s -o "relay\server.js"          "%BASE%/relay/server.js"          && echo   [ok] alert relay
curl -s -o "pine\MSB-Indicator.pine"  "%BASE%/pine/MSB-Indicator.pine"  && echo   [ok] indicator  (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Scout.pine"      "%BASE%/pine/MSB-Scout.pine"      && echo   [ok] scout
curl -s -o "pine\MSB-Strategy.pine"   "%BASE%/pine/MSB-Strategy.pine"   && echo   [ok] backtester

echo.
echo   Done. Refresh the grader tab with Ctrl+F5.
echo.
pause
