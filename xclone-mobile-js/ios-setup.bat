@echo off
echo 🍎 Starting NexFi iOS Setup (Preparing for iPhone)...

:: 1. Build the web project
echo 📦 Building web assets...
call npm run build

:: 2. Install iOS platform dependencies
echo ➕ Installing @capacitor/ios...
call npm install @capacitor/ios --legacy-peer-deps

:: 3. Add and Sync iOS platform
echo 🔄 Adding iOS platform...
call npx -y cap add ios
echo 🔄 Syncing assets to iOS...
call npx cap sync ios

echo.
echo ✅ Done! Your 'ios' folder is ready.
echo ⚠️  CRITICAL: You must now copy this entire project folder to a Mac.
echo 🍎 On the Mac, run: npx cap open ios
pause
