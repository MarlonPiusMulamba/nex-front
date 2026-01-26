@echo off
echo ========================================
echo   Service Worker Fix Script
echo ========================================
echo.

echo The white screen is caused by a service worker error.
echo This script will help you fix it.
echo.

echo Step 1: Opening the unregister page...
start unregister-sw.html

echo.
echo ========================================
echo   INSTRUCTIONS:
echo ========================================
echo.
echo 1. Click "Clear Everything & Reload" button
echo 2. The page will automatically redirect to the app
echo 3. The app should now load correctly!
echo.
echo If you still see a white screen:
echo - Press Ctrl+Shift+R to hard reload
echo - Check the console (F12) for new errors
echo.

pause
