@echo off
title MSB Trade Grader
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is needed to run the alert relay.
  echo   You already have it if the Studio app runs - otherwise get it at nodejs.org
  echo.
  pause
  exit /b 1
)

start "MSB Alert Relay" cmd /k node relay\server.js
timeout /t 2 >nul
start "" http://localhost:4410
