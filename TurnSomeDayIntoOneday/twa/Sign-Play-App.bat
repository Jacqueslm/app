@echo off
rem =====================================================================
rem  Sign-Play-App.bat - signs the cloud-built Play bundle (1.0.2, code 3)
rem
rem  The cloud builds the app now (GitHub Actions "Build the Play app").
rem  The only thing that must happen on this PC is the signature, because
rem  the upload key never leaves this folder.
rem
rem  Put this file next to android-upload.keystore:
rem    C:\dayone\app-claude-vibe-code-uwxxlk\TurnSomeDayIntoOneday\twa
rem  Double-click it. It downloads the newest unsigned bundle, signs it
rem  with your key (it asks for the keystore password - the one on the
rem  USB "play key" note), and leaves day-one-1.0.2-signed.aab ready to
rem  upload. Nothing is sent anywhere by this script.
rem =====================================================================
cd /d "%~dp0"

if not exist android-upload.keystore (
  echo ERROR: android-upload.keystore is not in this folder.
  echo Move this file into C:\dayone\app-claude-vibe-code-uwxxlk\TurnSomeDayIntoOneday\twa and run it there.
  pause
  exit /b 1
)

echo Downloading the unsigned bundle built in the cloud...
curl -L -f -o day-one-1.0.2-unsigned.aab https://raw.githubusercontent.com/Jacqueslm/app/twa-build/app-release.aab
if errorlevel 1 (
  echo ERROR: download failed. Check the internet connection and run this again.
  pause
  exit /b 1
)

rem Find jarsigner - it ships with the Java that bubblewrap installed.
set "JARSIGNER=jarsigner"
where jarsigner >nul 2>nul
if errorlevel 1 (
  for /d %%J in ("%USERPROFILE%\.bubblewrap\jdk*") do (
    if exist "%%J\bin\jarsigner.exe" set "JARSIGNER=%%J\bin\jarsigner.exe"
  )
)
"%JARSIGNER%" -version >nul 2>nul
if errorlevel 1 (
  echo ERROR: could not find jarsigner (part of Java).
  echo Tell Claude this exact message and nothing else needs to be done.
  pause
  exit /b 1
)

echo.
echo Signing - you will be asked for the keystore password now.
"%JARSIGNER%" -sigalg SHA256withRSA -digestalg SHA-256 -keystore android-upload.keystore day-one-1.0.2-unsigned.aab upload
if errorlevel 1 (
  echo ERROR: signing failed - usually a mistyped password. Nothing is broken; run this again.
  pause
  exit /b 1
)

if exist day-one-1.0.2-signed.aab del day-one-1.0.2-signed.aab
ren day-one-1.0.2-unsigned.aab day-one-1.0.2-signed.aab
echo.
echo DONE. The signed file is here:
echo   %~dp0day-one-1.0.2-signed.aab
echo.
echo Now upload it:
echo   1. play.google.com/console  -  Turn Someday Into Day One
echo   2. Test and release  -  Production  -  Create new release
echo   3. Upload day-one-1.0.2-signed.aab  (it should show 1.0.2, code 3)
echo   4. Release notes: "Fixes in-app purchases."  Save, review, roll out.
pause
