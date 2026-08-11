@echo off
setlocal enabledelayedexpansion

echo.
echo =======================================================
echo   Bugema Notice Board APK Builder
echo   Builds the standalone Bugema Notice Board app
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/5] Setting app name and ID to "Bugema Notices" (org.bugema.noticeboard)...
powershell -Command "(Get-Content 'android\app\src\main\res\values\strings.xml') -replace '<string name=\"app_name\">.*?</string>', '<string name=\"app_name\">Bugema Notices</string>' -replace '<string name=\"title_activity_main\">.*?</string>', '<string name=\"title_activity_main\">Bugema Notices</string>' | Set-Content 'android\app\src\main\res\values\strings.xml'"
powershell -Command "(Get-Content 'capacitor.config.json') -replace '\"appId\": \".*?\"', '\"appId\": \"org.bugema.noticeboard\"' -replace '\"appName\": \".*?\"', '\"appName\": \"Bugema Notices\"' | Set-Content 'capacitor.config.json'"
powershell -Command "(Get-Content 'android\app\build.gradle') -replace 'applicationId \".*?\"', 'applicationId \"org.bugema.noticeboard\"' | Set-Content 'android\app\build.gradle'"
echo   Done.

echo [2/5] Building Web Assets (Bugema Standalone mode)...
set VITE_STANDALONE_ORG=bugema
set VITE_API_URL=https://ssp.bugemauniv.ac.ug
set VITE_APP_TITLE=Bugema Notice Board
set VITE_APP_NAME=Bugema Notices
set VITE_ENABLE_SOCKETIO=true
set NODE_ENV=production
call npx vite build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Vite build failed!
    pause
    exit /b 1
)
echo   Build done.

echo [3/5] Syncing to Android project...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Capacitor sync failed!
    pause
    exit /b 1
)
echo   Sync done.

echo [4/5] Compiling APK...
cd android
call gradlew assembleDebug --stacktrace
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Gradle build failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo   Compile done.

echo [5/5] Copying APK to project root...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "Bugema_Notice_Board.apk"

echo.
echo =======================================================
echo  SUCCESS! Bugema APK is ready:
echo  Bugema_Notice_Board.apk
echo =======================================================
echo.
pause
