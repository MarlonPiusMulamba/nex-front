@echo off
echo 🚀 Starting NexFi Desktop Build (Windows)...

:: 1. Build the web project
echo 📦 Building web assets...
call npm run build

:: 2. Install Electron platform dependencies
if not exist "electron" (
    echo ➕ Installing @capacitor-community/electron...
    :: Using --save-dev and --legacy-peer-deps to force installation
    call npm install @capacitor-community/electron --save-dev --legacy-peer-deps
    
    echo ➕ Adding Electron platform...
    call npx -y cap add @capacitor-community/electron
)

:: 3. Sync assets
if exist "electron" (
    echo 🔄 Syncing assets to Electron...
    call npx cap sync electron
) else (
    echo ❌ ERROR: Electron folder was not created. Check the errors above.
    pause
    exit /b
)

:: 4. Build the executable
echo 🛠️ Packaging .exe installer...
cd electron
if not exist "node_modules" (
    call npm install --legacy-peer-deps
)
call npm run electron:make

echo ✅ Done! Your Windows installer is in the electron/out directory.
pause
