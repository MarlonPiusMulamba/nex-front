@echo off
REM Install Capacitor Push Notification Packages (Compatible with Capacitor 5.x)
echo Installing Capacitor push notification packages...
npm install @capacitor/push-notifications@^5.0.0 @capacitor/local-notifications@^5.0.0 --legacy-peer-deps
echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Run: npx cap sync android
echo 2. Add google-services.json to android/app/ folder
echo.
pause
