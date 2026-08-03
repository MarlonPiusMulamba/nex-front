@echo off
echo ===================================================
echo   Building Bugema Notice Board Android APK
echo ===================================================

cd /d "%~dp0"

echo [1/4] Cleaning previous build...
if exist dist rmdir /s /q dist
echo Clean done.

echo [2/4] Building Web Assets (Standalone Bugema Mode)...
set VITE_STANDALONE_ORG=bugema
set VITE_API_URL=https://ssp.bugemauniv.ac.ug
set VITE_ENABLE_SOCKETIO=true
set VITE_APP_TITLE=Bugema Notice Board
set NODE_ENV=production
call npx vite build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Vite build failed! Check errors above.
    pause
    exit /b 1
)
echo Build done.

echo [3/4] Syncing Web Assets to Android Project...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Capacitor sync failed!
    pause
    exit /b 1
)
echo Sync done.

echo [4/4] Compiling Android APK...
cd android
call gradlew assembleDebug
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Gradle build failed! Check errors above.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ===================================================
echo SUCCESS! APK is ready at:
echo android\app\build\outputs\apk\debug\app-debug.apk
echo ===================================================
pause
