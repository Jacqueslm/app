@echo off
rem =====================================================================
rem  Find-Signed-App.bat  -  locates the signed bundle and delivers it
rem
rem  29 Aug 2026. Sign-Play-App-v2 signed the app correctly ("jar signed")
rem  and then failed to move it, with "The system cannot find the path
rem  specified" - because on Windows 11 the Desktop often lives inside
rem  OneDrive and %USERPROFILE%\Desktop does not exist. The file is fine;
rem  it is just still sitting where it was signed, under its old name.
rem
rem  This finds it, VERIFIES it is genuinely signed rather than assuming,
rem  and puts a correctly named copy on the real Desktop.
rem =====================================================================
setlocal

echo Looking for the bundle...
set "AAB="
for /f "delims=" %%F in ('dir /s /b "C:\dayone\day-one-1.0.2-*.aab" 2^>nul') do set "AAB=%%F"
if not defined AAB for /f "delims=" %%F in ('dir /s /b "%USERPROFILE%\day-one-1.0.2-*.aab" 2^>nul') do set "AAB=%%F"
if not defined AAB (
  echo.
  echo ERROR: no bundle found. Tell Claude: "no aab found".
  echo.
  pause
  exit /b 1
)
echo Found: %AAB%

rem ---- find Java again so we can PROVE it is signed --------------------
set "JARSIGNER="
for /f "delims=" %%J in ('where jarsigner 2^>nul') do set "JARSIGNER=%%J"
if not defined JARSIGNER for /f "delims=" %%J in ('dir /s /b "C:\Program Files\Eclipse Adoptium\jarsigner.exe" 2^>nul') do set "JARSIGNER=%%J"
if not defined JARSIGNER for /f "delims=" %%J in ('dir /s /b "C:\Program Files\Java\jarsigner.exe" 2^>nul') do set "JARSIGNER=%%J"

if defined JARSIGNER (
  echo.
  echo Checking it is properly signed...
  "%JARSIGNER%" -verify "%AAB%" | findstr /i "verified"
  if errorlevel 1 (
    echo.
    echo WARNING: could not confirm the signature. Tell Claude: "verify failed".
    echo.
    pause
    exit /b 1
  )
)

rem ---- work out where the Desktop actually is --------------------------
set "DESK=%USERPROFILE%\Desktop"
if not exist "%DESK%" set "DESK=%USERPROFILE%\OneDrive\Desktop"
if not exist "%DESK%" for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v Desktop 2^>nul') do set "DESK=%%B"
if not exist "%DESK%" (
  echo.
  echo Could not find your Desktop, so leaving the file where it is:
  echo   %AAB%
  echo Upload that file. Opening the folder now.
  explorer /select,"%AAB%"
  echo.
  pause
  exit /b 0
)

set "OUT=%DESK%\day-one-1.0.2-signed.aab"
copy /y "%AAB%" "%OUT%" >nul
if errorlevel 1 (
  echo.
  echo Could not copy to the Desktop. Upload it straight from here instead:
  echo   %AAB%
  explorer /select,"%AAB%"
  echo.
  pause
  exit /b 0
)

echo.
echo ===================================================================
echo  READY. Signed and verified, on your Desktop:
echo    %OUT%
echo.
echo  Play Console: Test and release - Production -
echo  Create new release - drag this file in.
echo ===================================================================
echo.
explorer /select,"%OUT%"
pause
