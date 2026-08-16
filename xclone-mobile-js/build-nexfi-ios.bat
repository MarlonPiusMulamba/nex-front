@echo off
setlocal enabledelayedexpansion

echo.
echo =======================================================
echo   NexFi Campus App iOS Setup ^& Sync
echo   Prepares iOS project ^& web assets for iPhone .IPA build
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/4] Preparing NexFi branding...

echo [2/4] Setting app name and ID to "NexFi" (org.xclone.app)...
powershell -Command "(Get-Content 'capacitor.config.json') -replace '\"appId\": \".*?\"', '\"appId\": \"org.xclone.app\"' -replace '\"appName\": \".*?\"', '\"appName\": \"NexFi\"' | Set-Content 'capacitor.config.json'"

echo [3/4] Cleaning old binaries and building Web Assets (NexFi mode)...
if exist "public\*.apk" del /F /Q "public\*.apk"
if exist "public\*.ipa" del /F /Q "public\*.ipa"
if exist "public\downloads\*.apk" del /F /Q "public\downloads\*.apk"
if exist "public\downloads\*.ipa" del /F /Q "public\downloads\*.ipa"
if exist "dist" rmdir /S /Q "dist"
set VITE_STANDALONE_ORG=
set VITE_API_URL=https://ssp.bugemauniv.ac.ug
set VITE_APP_TITLE=NexFi - Campus Platform
set VITE_APP_NAME=NexFi
set VITE_ENABLE_SOCKETIO=true
set NODE_ENV=production
call npx vite build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Vite build failed!
    pause
    exit /b 1
)

echo [4/4] Syncing to iOS platform...
if not exist "ios" (
    echo Adding iOS platform...
    call npx cap add ios
)
call npx cap sync ios
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Capacitor iOS sync failed!
    pause
    exit /b 1
)

if exist "ios\App\build\NexFi_Campus.ipa" (
    echo Copying NexFi_Campus.ipa to project root...
    copy /Y "ios\App\build\NexFi_Campus.ipa" "NexFi_Campus.ipa"
)

echo.
echo =======================================================
echo  SUCCESS! NexFi iOS project is synced and ready!
echo =======================================================
echo.
echo TO GENERATE AND INSTALL THE .IPA FILE ON IPHONE:
echo.
echo  METHOD 1: Cloud Build via GitHub Actions (Recommended)
echo    1. Push code changes to GitHub.
echo    2. Open your GitHub Repository in browser.
echo    3. Go to "Actions" tab - select "Build iOS IPA".
echo    4. Click "Run workflow" (choose "nexfi" or "both").
echo    5. When finished, download "NexFi_Campus_IPA".
echo.
echo  METHOD 2: Install .IPA on iPhone (Windows User)
echo    1. Download Sideloadly (https://sideloadly.io) or AltStore on PC.
echo    2. Plug iPhone into PC via USB cable.
echo    3. Drag NexFi_Campus.ipa into Sideloadly.
echo    4. Enter your Apple ID and click START to install on iPhone!
echo.
pause
