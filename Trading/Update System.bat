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

curl -s -o "DAILY-USE.md"             "%BASE%/DAILY-USE.md"               && echo   [ok] daily-use guide
curl -s -o "README.md"                "%BASE%/README.md"                  && echo   [ok] readme
curl -s -o "BOT-SETUP.md"             "%BASE%/BOT-SETUP.md"               && echo   [ok] bot setup guide
curl -s -o "relay\server.js"          "%BASE%/relay/server.js"            && echo   [ok] alert relay + autotrade bot
curl -s -o "pine\MSB-Price.pine"        "%BASE%/pine/MSB-Price.pine"        && echo   [ok] MSB-PRICE backtester  (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Price-Alerts.pine" "%BASE%/pine/MSB-Price-Alerts.pine" && echo   [ok] MSB-PRICE alerts      (re-paste into TradingView if it changed)
curl -s -o "pine\MSB-Companion.pine"    "%BASE%/pine/MSB-Companion.pine"    && echo   [ok] MSB-EYES companion    (re-paste into TradingView if it changed)
curl -s -o "TURN ON AUTO.bat"     "%BASE%/TURN%%20ON%%20AUTO.bat"      && echo   [ok] TURN ON AUTO button
curl -s -o "YOUR-RULES.md"            "%BASE%/YOUR-RULES.md"              && echo   [ok] your rules

REM The old filtered scripts are gone - the system is pure structure now.
del /q "pine\MSB-Indicator.pine" "pine\MSB-Scout.pine" "pine\MSB-Strategy.pine" "pine\MSB-Diagnostic.pine" >nul 2>&1
REM The grader and the file journal are retired: one ledger, one link. The
REM two launchers they needed go with them - TURN ON AUTO does all of it.
del /q "trade-grader.html" "journal.html" "Start Trade Grader.bat" "Start Phone Link.bat" >nul 2>&1
REM The previous-generation scripts and the prop-firm guide are not part of the
REM live system and were only ever clutter in this folder.
del /q "PLAYBOOK.md" "PROP-FIRMS.md" "GETTING-STARTED.md" >nul 2>&1
del /q "pine\MSB-Pure.pine" "pine\MSB-Pure-Alerts.pine" >nul 2>&1
rmdir /s /q "ninjatrader" >nul 2>&1

REM Last of all, this updater refreshes itself so next run knows about any
REM newly added files. The swap happens after this window is done reading
REM the file, which is why it is the final step.
curl -s -o "Update System.new.bat" "%BASE%/Update%%20System.bat"
findstr /c:"MSB - Update System" "Update System.new.bat" >nul 2>&1 && (
  start "" /min cmd /c "timeout /t 2 >nul & move /y "Update System.new.bat" "Update System.bat" >nul"
) || del /q "Update System.new.bat" >nul 2>&1

echo.
echo   Done. If a Pine script changed, re-paste it into TradingView.
echo.
pause
