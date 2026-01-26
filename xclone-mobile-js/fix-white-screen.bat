@echo off
echo ========================================
echo   White Screen Quick Fix Script
echo ========================================
echo.

echo [1/5] Checking if dev server is running...
netstat -ano | findstr :5173
if %ERRORLEVEL% EQU 0 (
    echo ✓ Dev server is running on port 5173
) else (
    echo ✗ Dev server is NOT running
    echo Starting dev server...
    start cmd /k "cd /d %~dp0 && call npm run dev"
    timeout /t 5
)

echo.
echo [2/5] Opening diagnostic test page...
start test-page.html

echo.
echo [3/5] Opening main application...
timeout /t 2
start http://localhost:5173

echo.
echo [4/5] Instructions:
echo - The diagnostic page should open first
echo - Then the main app will open
echo - Press F12 in the main app to see console errors
echo - Check for any RED error messages
echo.

echo [5/5] Common fixes:
echo - If you see a white screen, press Ctrl+Shift+R to hard reload
echo - If that doesn't work, open Console (F12) and run: localStorage.clear()
echo - Then reload the page
echo.

echo ========================================
echo   Troubleshooting Complete!
echo ========================================
echo.
echo If you still see a white screen:
echo 1. Check the browser console (F12) for errors
echo 2. Try the diagnostic page results
echo 3. Read WHITE_SCREEN_FIX.md for more solutions
echo.

pause
