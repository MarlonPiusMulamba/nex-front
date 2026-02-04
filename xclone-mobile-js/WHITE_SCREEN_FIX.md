# White Screen Troubleshooting Guide

## Quick Fixes to Try

### 1. Clear Browser Cache and Hard Reload
- Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- Or open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

### 2. Check Browser Console
1. Open the app at http://localhost:5173
2. Press F12 to open Developer Tools
3. Go to the "Console" tab
4. Look for any RED error messages
5. Take a screenshot and share the errors

### 3. Check Network Tab
1. In Developer Tools, go to "Network" tab
2. Reload the page
3. Look for any failed requests (shown in RED)
4. Check if main.js, App.vue, or other files failed to load

### 4. Common Issues and Solutions

#### Issue: "Failed to fetch dynamically imported module"
**Solution:**
```bash
# Stop the dev server (Ctrl+C)
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

#### Issue: "Unexpected token" or "SyntaxError"
**Solution:** Check if you're using an outdated browser. Update to latest Chrome/Firefox/Edge.

#### Issue: Blank white screen with no console errors
**Solution:**
1. Check if you're logged in - try going to http://localhost:5173/login
2. Clear localStorage: Open Console (F12) and run:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

### 5. Test the Diagnostic Page
Open the test page I created:
```
file:///f:/GitHub/NEXFI/nex-front/xclone-mobile-js/test-page.html
```

This will check:
- If dev server is running
- If backend API is accessible
- Browser compatibility
- localStorage status

### 6. Manual Debugging Steps

1. **Check if app is mounting:**
   - Open Console (F12)
   - Look for these messages:
     - "🚀 Step 1: Imports successful"
     - "✅ Step 3: Vue app created"
     - "✅ Step 7: App mounted successfully! 🎉"
   
2. **If you see "Step 1" but not "Step 3":**
   - There's an import error
   - Check Console for module loading errors
   
3. **If you see "Step 3" but not "Step 7":**
   - Router or component error
   - Check Console for component registration errors

### 7. Force Rebuild
```bash
# Stop the server
# Delete dist folder
rm -rf dist

# Rebuild
npm run build

# Start dev server
npm run dev
```

### 8. Check Environment Variables
Make sure `.env` file exists with:
```
VITE_API_URL=https://nexxback.pythonanywhere.com
VITE_APP_TITLE=NexFi
VITE_DEV_MODE=true
```

## Most Likely Causes

Based on the codebase analysis:

1. **Component Import Error** - One of the components (EmojiPicker, VideoPlayer, CallOverlay, TrendingWidget, SuggestedUsersWidget) failed to load
2. **Router Configuration** - Issue with vue-router setup
3. **API Connection** - Backend not responding (less likely to cause white screen)
4. **Browser Cache** - Old cached files conflicting with new code

## Next Steps

1. Open http://localhost:5173 in your browser
2. Press F12 to open DevTools
3. Check the Console tab for errors
4. Share the error messages you see

If you see specific errors, I can provide targeted fixes!
