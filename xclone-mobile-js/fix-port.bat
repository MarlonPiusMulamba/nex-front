@echo off
echo 🔍 Searching for NexFi processes on port 5173...

:: Find the PID using netstat and kill it
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    echo 🔪 Killing process PID: %%a
    taskkill /F /PID %%a
)

echo.
echo ✅ Port 5173 is now free!
echo 🚀 You can now run 'npm run dev' again.
pause
