@echo off
rem =====================================================================
rem  Sign-Play-App.bat  -  signs the cloud-built Play bundle (1.0.2, code 3)
rem
rem  Built for zero folder work: save this anywhere (Downloads is fine)
rem  and double-click it. It finds your keystore on its own, downloads
rem  the cloud-built app, asks for the keystore password (USB "play key"
rem  note), puts the finished file on your Desktop, opens the folder with
rem  it selected, and opens Play Console in the browser. You drag one
rem  file into the browser and you are done. Nothing here is uploaded
rem  anywhere by this script, and the key never leaves your PC.
rem =====================================================================

set "KEYSTORE=C:\dayone\app-claude-vibe-code-uwxxlk\TurnSomeDayIntoOneday\twa\android-upload.keystore"
if exist "%KEYSTORE%" goto foundkey
for /f "delims=" %%K in ('dir /s /b "C:\dayone\android-upload.keystore" 2^>nul') do set "KEYSTORE=%%K"
if exist "%KEYSTORE%" goto foundkey
echo ERROR: could not find android-upload.keystore under C:\dayone
echo Tell Claude this exact message.
pause
exit /b 1

:foundkey
echo Using key: %KEYSTORE%
for %%D in ("%KEYSTORE%") do set "WORKDIR=%%~dpD"
cd /d "%WORKDIR%"

echo Downloading the app built in the cloud...
curl -L -f -o day-one-1.0.2-unsigned.aab https://raw.githubusercontent.com/Jacqueslm/app/twa-build/app-release.aab
if errorlevel 1 (
  echo ERROR: download failed. Check the internet and double-click this again.
  pause
  exit /b 1
)

set "JARSIGNER=jarsigner"
where jarsigner >nul 2>nul
if not errorlevel 1 goto sign
for /d %%J in ("%USERPROFILE%\.bubblewrap\jdk*") do (
  if exist "%%J\bin\jarsigner.exe" set "JARSIGNER=%%J\bin\jarsigner.exe"
)
"%JARSIGNER%" -version >nul 2>nul
if errorlevel 1 (
  echo ERROR: could not find jarsigner - part of Java. Tell Claude this exact message.
  pause
  exit /b 1
)

:sign
echo.
echo Type the keystore password when asked - the USB "play key" note.
"%JARSIGNER%" -sigalg SHA256withRSA -digestalg SHA-256 -keystore "%KEYSTORE%" day-one-1.0.2-unsigned.aab upload
if errorlevel 1 (
  echo ERROR: signing failed - usually a mistyped password. Nothing broke.
  echo Double-click this file again to retry.
  pause
  exit /b 1
)

set "OUT=%USERPROFILE%\Desktop\day-one-1.0.2-signed.aab"
if exist "%OUT%" del "%OUT%"
move /y day-one-1.0.2-unsigned.aab "%OUT%" >nul

echo.
echo DONE. The signed app is on your Desktop: day-one-1.0.2-signed.aab
echo Opening the Desktop folder and Play Console for you now.
echo In Play Console: Test and release - Production - Create new release -
echo drag the Desktop file in. Notes: "Fixes in-app purchases." Save, roll out.
explorer /select,"%OUT%"
start "" "https://play.google.com/console"
pause
