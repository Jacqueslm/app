@echo off
rem =====================================================================
rem  Install-Java.bat  -  installs Java so the signing script can work
rem
rem  29 Aug 2026. Signing an Android bundle needs jarsigner, which is part
rem  of Java, and this PC has none. This installs it properly and once -
rem  after this, Sign-Play-App-v2.bat finds it on its own, this time and
rem  every time.
rem
rem  Nothing here touches the signing key. It only installs Java.
rem =====================================================================
setlocal

echo.
echo Installing Java. This takes a few minutes. Leave the window open.
echo.

rem ---- the normal Windows way first -----------------------------------
where winget >nul 2>nul
if errorlevel 1 goto trymsi
echo Using the Windows installer service...
winget install --id EclipseAdoptium.Temurin.17.JDK -e --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto trymsi
goto verify

rem ---- fall back to downloading the installer directly -----------------
:trymsi
echo.
echo Falling back to a direct download...
set "MSI=%TEMP%\temurin17.msi"
curl -L -f -o "%MSI%" "https://api.adoptium.net/v3/installer/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
if errorlevel 1 (
  echo.
  echo ERROR: could not download Java.
  echo Tell Claude: "java download failed" and we will do this another way.
  echo.
  pause
  exit /b 1
)
echo Running the installer - approve it if Windows asks...
msiexec /i "%MSI%" /passive INSTALLLEVEL=3
if errorlevel 1 (
  echo.
  echo ERROR: the Java installer did not finish.
  echo Tell Claude: "java installer failed".
  echo.
  pause
  exit /b 1
)

rem ---- check it actually landed ---------------------------------------
:verify
echo.
echo Checking...
set "FOUND="
for /f "delims=" %%J in ('dir /s /b "C:\Program Files\Eclipse Adoptium\jarsigner.exe" 2^>nul') do set "FOUND=%%J"
if not defined FOUND for /f "delims=" %%J in ('dir /s /b "C:\Program Files\Java\jarsigner.exe" 2^>nul') do set "FOUND=%%J"
if not defined FOUND (
  echo.
  echo Java installed but jarsigner was not found where expected.
  echo Tell Claude: "installed but not found".
  echo.
  pause
  exit /b 1
)

echo.
echo ===================================================================
echo  DONE. Java is installed:
echo    %FOUND%
echo.
echo  Now double-click Sign-Play-App-v2.bat again.
echo  It will find Java straight away this time.
echo ===================================================================
echo.
pause
