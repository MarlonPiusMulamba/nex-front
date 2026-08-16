@echo off
setlocal enabledelayedexpansion

echo.
echo =======================================================
echo   Bugema Notice Board APK Builder
echo   Builds the standalone Bugema Notice Board app
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/6] Generating Android App Icons for Bugema Notice Board...
python generate_app_icons.py bugema-logo.png
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Icon generation failed, using existing icons.
)

echo [2/6] Setting app name and ID to "Bugema Notice Board" (org.bugema.noticeboard)...
powershell -Command "(Get-Content 'android\app\src\main\res\values\strings.xml') -replace '<string name=\"app_name\">.*?</string>', '<string name=\"app_name\">Bugema Notice Board</string>' -replace '<string name=\"title_activity_main\">.*?</string>', '<string name=\"title_activity_main\">Bugema Notice Board</string>' | Set-Content 'android\app\src\main\res\values\strings.xml'"
powershell -Command "(Get-Content 'capacitor.config.json') -replace '\"appId\": \".*?\"', '\"appId\": \"org.bugema.noticeboard\"' -replace '\"appName\": \".*?\"', '\"appName\": \"Bugema Notice Board\"' | Set-Content 'capacitor.config.json'"
powershell -Command "(Get-Content 'android\app\build.gradle') -replace 'applicationId \".*?\"', 'applicationId \"org.bugema.noticeboard\"' | Set-Content 'android\app\build.gradle'"
echo   Done.

echo [3/6] Cleaning up old binaries and building Web Assets (Bugema Standalone mode)...
if exist "public\*.apk" del /F /Q "public\*.apk"
if exist "public\*.ipa" del /F /Q "public\*.ipa"
if exist "public\downloads\*.apk" del /F /Q "public\downloads\*.apk"
if exist "public\downloads\*.ipa" del /F /Q "public\downloads\*.ipa"
if exist "dist" rmdir /S /Q "dist"
set VITE_STANDALONE_ORG=bugema
set VITE_API_URL=https://ssp.bugemauniv.ac.ug
set VITE_APP_TITLE=Bugema Notice Board
set VITE_APP_NAME=Bugema Notice Board
set VITE_ENABLE_SOCKETIO=true
set NODE_ENV=production
call npx vite build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Vite build failed!
    pause
    exit /b 1
)
echo   Build done.

echo [4/6] Syncing to Android project...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Capacitor sync failed!
    pause
    exit /b 1
)
echo   Sync done.

echo [5/6] Compiling APK...
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

echo [6/6] Copying APK to project root, public, and downloads folders...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "Bugema_Notice_Board.apk"
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "public\Bugema_Notice_Board.apk"
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\Bugema_Notice_Board.apk"

echo.
echo =======================================================
echo  SUCCESS! Bugema APK is ready:
echo  1. Bugema_Notice_Board.apk
echo  2. public\Bugema_Notice_Board.apk
echo  3. public\downloads\Bugema_Notice_Board.apk
echo =======================================================
echo.

