@echo off
title MSB Phone Link
rem Opens the tunnel that lets TradingView webhooks and your phone reach the
rem grader running on this computer. Keep this window open while trading.

where ngrok >nul 2>nul
if errorlevel 1 (
  echo.
  echo   ngrok not found on this machine's PATH.
  echo   Open ngrok the way you did during setup, then run:
  echo     ngrok http --url=explicit-sprung-produce.ngrok-free.dev 4410
  echo.
  pause
  exit /b 1
)

ngrok http --url=explicit-sprung-produce.ngrok-free.dev 4410
