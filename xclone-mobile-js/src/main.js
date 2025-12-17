import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
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

console.log('🚀 Step 1: Imports successful');

// Try importing config with error handling
let config;
try {
  config = await import('@/config/index.js');
  config = config.default || config;
  console.log('✅ Step 2: Config loaded:', config);
} catch (error) {
  console.error('❌ Step 2: Config load failed:', error);
  // Fallback config
  config = {
    api: {
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 30000,
    },
    app: {
      name: 'NexFi',
    },
  };
  console.log('⚠️ Using fallback config');
}

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

// Global Socket.IO client (DM + feed realtime)
try {
  const socketBaseUrl = config?.api?.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const socket = io(socketBaseUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true
  });

  app.config.globalProperties.$socket = socket;

  const tryJoin = () => {
    const userId = localStorage.getItem('userId');
    if (userId) socket.emit('join', { user_id: userId });
  };

  socket.on('connect', () => {
    tryJoin();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'userId') {
      tryJoin();
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