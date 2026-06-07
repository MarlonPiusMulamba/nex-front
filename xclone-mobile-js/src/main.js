import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';
import { IonicVue } from '@ionic/vue';
import { io } from 'socket.io-client';

// Ionic CSS
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

// Desktop layout styles
import './theme/desktop.css';

console.log('🚀 Step 1: Imports successful');

import config from './config/index.js';

console.log('🚀 Step 3: Creating Vue app...');

// Create app with error handling
let app;
try {
  app = createApp(App);
  console.log('✅ Step 3: Vue app created');
} catch (error) {
  console.error('❌ Step 3: Failed to create app:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1>⚠️ App Initialization Failed</h1>
      <p>Error: ${error.message}</p>
      <pre>${error.stack}</pre>
    </div>
  `;
  throw error;
}

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('❌ Global Error:', err);
  console.error('Component:', instance?.$options?.name || 'Unknown');
  console.error('Info:', info);

  // Show error overlay
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 20px;
    overflow: auto;
    z-index: 99999;
    font-family: monospace;
  `;
  errorDiv.innerHTML = `
    <h2>❌ Error in ${instance?.$options?.name || 'Unknown Component'}</h2>
    <p><strong>Message:</strong> ${err.message}</p>
    <p><strong>Info:</strong> ${info}</p>
    <pre>${err.stack}</pre>
    <button onclick="this.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px;">Close</button>
  `;
  document.body.appendChild(errorDiv);
};

// Catch Vue warnings
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('⚠️ Vue Warning:', msg);
  console.warn('Component:', instance?.$options?.name);
  console.warn('Trace:', trace);
};

// Make config available globally
app.config.globalProperties.$config = config;

// Global Socket.IO client (DM + feed realtime + presence tracking)
import socketService from './utils/socketService.js';

try {
  const socketBaseUrl = config?.api?.baseURL || import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
  const isPythonAnywhere = /pythonanywhere\.com/i.test(socketBaseUrl);
  const enableSocketIo = String(import.meta.env.VITE_ENABLE_SOCKETIO || '').toLowerCase() === 'true';

  if (isPythonAnywhere && !enableSocketIo) {
    console.log('ℹ️ Socket.IO disabled for PythonAnywhere. Set VITE_ENABLE_SOCKETIO=true to force-enable.');
    throw new Error('Socket.IO disabled for PythonAnywhere');
  }

  // Make socket service available globally
  app.config.globalProperties.$socketService = socketService;
  window.socketService = socketService;

  // Auto-connect if user is logged in
  const userId = localStorage.getItem('userId');
  if (userId) {
    socketService.connect(userId);
  }

  // Listen for login events to connect socket
  window.addEventListener('user:login', (event) => {
    if (event.detail && event.detail.userId) {
      socketService.connect(event.detail.userId);
    }
  });

  // Listen for logout events to disconnect socket
  window.addEventListener('user:logout', () => {
    socketService.disconnect();
  });

  // Listen for backend failover to reconnect socket to the new URL
  window.addEventListener('backend:failover', (event) => {
    const newUrl = event.detail.baseURL;
    console.warn('🔄 Backend failover detected! Reconnecting socket to:', newUrl);
    const userId = localStorage.getItem('userId');
    if (userId) {
      socketService.connectToUrl(newUrl, userId);
    }
  });

} catch (e) {
  console.error('❌ Socket init failed:', e);
}

console.log('🚀 Step 4: Using IonicVue...');
app.use(IonicVue);
console.log('✅ Step 4: IonicVue loaded');

console.log('🚀 Step 5: Using router...');
try {
  app.use(router);
  console.log('✅ Step 5: Router loaded');
} catch (error) {
  console.error('❌ Step 5: Router failed:', error);
  throw error;
}

console.log('🚀 Step 6: Waiting for router...');
router.isReady()
  .then(() => {
    console.log('✅ Step 6: Router ready');
    console.log('Current route:', router.currentRoute.value);

    console.log('🚀 Step 7: Mounting app...');
    const mountTarget = document.querySelector('#app');
    if (!mountTarget) {
      throw new Error('Mount target #app not found in DOM');
    }

    app.mount('#app');
    console.log('✅ Step 7: App mounted successfully! 🎉');

    // Register Service Worker for full offline PWA caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Registered, scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[SW] Registration failed:', error);
        });
    }
  })
  .catch((error) => {
    console.error('❌ Router/Mount failed:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; background: #fee; border: 2px solid red; margin: 20px; border-radius: 8px;">
        <h1>❌ Failed to Start App</h1>
        <p><strong>Error:</strong> ${error.message}</p>
        <h3>Debug Info:</h3>
        <ul>
          <li>Config loaded: ${config ? '✅' : '❌'}</li>
          <li>API URL: ${config?.api?.baseURL || 'N/A'}</li>
          <li>Router exists: ${router ? '✅' : '❌'}</li>
          <li>Mount target exists: ${document.querySelector('#app') ? '✅' : '❌'}</li>
        </ul>
        <pre style="background: #fff; padding: 10px; overflow: auto;">${error.stack}</pre>
      </div>
    `;
  });