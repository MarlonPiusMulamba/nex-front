@echo off
echo 🤖 Updating NexFi Android Project...

:: 1. Build the web project
echo 📦 Building web assets...
call npm run build

:: 2. Sync to Android
echo 🔄 Syncing latest code to Android...
call npx cap sync android

echo.
echo ✅ Done! Your Android project is now up to date.
echo 🤖 To build the APK, run: npx cap open android
echo 🛠️  Then in Android Studio, go to Build > Build APK(s).
pause
