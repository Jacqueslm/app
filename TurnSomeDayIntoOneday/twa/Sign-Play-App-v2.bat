@echo off
rem =====================================================================
rem  Sign-Play-App-v2.bat  -  signs the cloud-built Play bundle (1.0.2, code 3)
rem
rem  v2, 29 Aug 2026. v1 died with "could not find jarsigner" because it
rem  looked for Java in exactly one guessed folder. jarsigner ships inside
rem  Java, and on this machine Java is almost certainly already present -
rem  Bubblewrap installs its own copy, and Android Studio ships one too.
rem  This version searches everywhere it could reasonably be, and only if
rem  it genuinely is not there does it fetch a portable copy itself.
rem
rem  Still zero folder work: save anywhere, double-click, type the
rem  keystore password once. The key never leaves this PC and this script
rem  uploads nothing.
rem =====================================================================
setlocal

rem ---------- 1. find the signing key ----------------------------------
set "KEYSTORE=C:\dayone\app-claude-vibe-code-uwxxlk\TurnSomeDayIntoOneday\twa\android-upload.keystore"
if exist "%KEYSTORE%" goto foundkey
for /f "delims=" %%K in ('dir /s /b "C:\dayone\android-upload.keystore" 2^>nul') do set "KEYSTORE=%%K"
if exist "%KEYSTORE%" goto foundkey
echo.
echo ERROR: could not find android-upload.keystore under C:\dayone
echo Tell Claude this exact message.
echo.
pause
exit /b 1

:foundkey
echo Using key: %KEYSTORE%
for %%D in ("%KEYSTORE%") do set "WORKDIR=%%~dpD"
cd /d "%WORKDIR%"

rem ---------- 2. find Java (jarsigner) ---------------------------------
echo Looking for Java...
set "JARSIGNER="

rem Already on the PATH?
for /f "delims=" %%J in ('where jarsigner 2^>nul') do set "JARSIGNER=%%J"
if defined JARSIGNER if exist "%JARSIGNER%" goto foundjava

rem Bubblewrap's own JDK - the most likely one on this machine.
for /f "delims=" %%J in ('dir /s /b "%USERPROFILE%\.bubblewrap\jarsigner.exe" 2^>nul') do set "JARSIGNER=%%J"
if defined JARSIGNER if exist "%JARSIGNER%" goto foundjava

rem A portable copy this script fetched on an earlier run.
for /f "delims=" %%J in ('dir /s /b "%USERPROFILE%\.dayone-jdk\jarsigner.exe" 2^>nul') do set "JARSIGNER=%%J"
if defined JARSIGNER if exist "%JARSIGNER%" goto foundjava

rem Android Studio ships a Java runtime with jarsigner in it.
for %%P in (
  "C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe"
  "C:\Program Files\Android\Android Studio\jre\bin\jarsigner.exe"
  "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\jarsigner.exe"
  "%LOCALAPPDATA%\Programs\Android Studio\jre\bin\jarsigner.exe"
) do if exist %%P set "JARSIGNER=%%~P"
if defined JARSIGNER if exist "%JARSIGNER%" goto foundjava

rem Any normally-installed JDK.
for %%R in (
  "C:\Program Files\Java"
  "C:\Program Files\Eclipse Adoptium"
  "C:\Program Files\Microsoft"
  "C:\Program Files\Amazon Corretto"
  "C:\Program Files\Zulu"
  "C:\Program Files (x86)\Java"
) do (
  if exist %%R for /f "delims=" %%J in ('dir /s /b "%%~R\jarsigner.exe" 2^>nul') do set "JARSIGNER=%%J"
)
if defined JARSIGNER if exist "%JARSIGNER%" goto foundjava

rem ---------- 3. no Java anywhere - fetch a portable copy --------------
echo.
echo No Java on this PC. Downloading a portable copy - about 190 MB, one time only.
echo This can take a few minutes. Leave the window open.
echo.
set "JDKDIR=%USERPROFILE%\.dayone-jdk"
if not exist "%JDKDIR%" mkdir "%JDKDIR%"
curl -L -f -o "%JDKDIR%\jdk.zip" "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
if errorlevel 1 (
  echo.
  echo ERROR: could not download Java.
  echo Tell Claude: "the java download failed" - there is another way to do this
  echo that does not need Java on your PC at all.
  echo.
  pause
  exit /b 1
)
echo Unpacking...
tar -xf "%JDKDIR%\jdk.zip" -C "%JDKDIR%"
if errorlevel 1 (
  echo.
  echo ERROR: could not unpack Java. Tell Claude: "the java unpack failed".
  echo.
  pause
  exit /b 1
)
del "%JDKDIR%\jdk.zip" >nul 2>nul
for /f "delims=" %%J in ('dir /s /b "%JDKDIR%\jarsigner.exe" 2^>nul') do set "JARSIGNER=%%J"
if defined JARSIGNER if exist "%JARSIGNER%" goto foundjava
echo.
echo ERROR: Java downloaded but jarsigner is still missing.
echo Tell Claude this exact message.
echo.
pause
exit /b 1

:foundjava
echo Using Java: %JARSIGNER%

rem ---------- 4. get the cloud-built app -------------------------------
echo.
echo Downloading the app built in the cloud...
curl -L -f -o day-one-1.0.2-unsigned.aab https://raw.githubusercontent.com/Jacqueslm/app/twa-build/app-release.aab
if errorlevel 1 (
  echo.
  echo ERROR: download failed. Check the internet and double-click this again.
  echo.
  pause
  exit /b 1
)

rem ---------- 5. sign it -----------------------------------------------
echo.
echo ===================================================================
echo  Type the keystore password when asked - the USB "play key" note.
echo.
echo  NOTHING APPEARS ON SCREEN AS YOU TYPE. No dots, no stars.
echo  That is normal. Type it straight through and press Enter.
echo ===================================================================
echo.
"%JARSIGNER%" -sigalg SHA256withRSA -digestalg SHA-256 -keystore "%KEYSTORE%" day-one-1.0.2-unsigned.aab upload
if errorlevel 1 (
  echo.
  echo ERROR: signing failed - usually a mistyped password. Nothing broke.
  echo Double-click this file again to retry.
  echo.
  pause
  exit /b 1
)

rem ---------- 6. put it on the Desktop ---------------------------------
set "OUT=%USERPROFILE%\Desktop\day-one-1.0.2-signed.aab"
if exist "%OUT%" del "%OUT%"
move /y day-one-1.0.2-unsigned.aab "%OUT%" >nul

echo.
echo ===================================================================
echo  DONE. The signed app is on your Desktop:
echo    day-one-1.0.2-signed.aab
echo.
echo  In Play Console: Test and release - Production -
echo  Create new release - drag the Desktop file in.
echo  Release notes: "Fixes in-app purchases."
echo  Then Save, Review, and Start rollout.
echo ===================================================================
echo.
explorer /select,"%OUT%"
start "" "https://play.google.com/console"
pause
