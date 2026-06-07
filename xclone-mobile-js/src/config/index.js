const PRIMARY_BACKEND = 'https://nexfiapi.ddns.net';
const SECONDARY_BACKEND = 'https://nex-back-3-stoz.onrender.com';

const config = {
  api: {
    primaryBaseURL: PRIMARY_BACKEND,
    secondaryBaseURL: SECONDARY_BACKEND,
    baseURL: (() => {
      const envUrl = import.meta.env.VITE_API_URL;
      const pageHost = window.location.hostname;
      const pageProtocol = window.location?.protocol;

      // Detect if running in Electron desktop app
      const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
      
      // Detect if running in Capacitor/Ionic native app
      const isNative =
        pageProtocol === 'capacitor:' ||
        pageProtocol === 'ionic:' ||
        typeof window.Capacitor !== 'undefined';

      // Detect if running on local development server
      const isPageLocal =
        !isNative &&
        !isElectron &&
        (pageHost === 'localhost' ||
          pageHost === '127.0.0.1' ||
          pageHost.startsWith('10.') ||
          pageHost.startsWith('192.168.') ||
          pageHost.startsWith('172.'));

      let apiUrl;

      // Priority 1: Use VITE_API_URL if set
      if (envUrl) {
        apiUrl = envUrl;
        console.log('🔧 Using VITE_API_URL from environment:', envUrl);
      }
      // Priority 2: For local development, use local backend if available (localhost:5000)
      else if (isPageLocal) {
        apiUrl = ''; // Use relative path so Vite proxy handles it
        console.log('💻 Local development detected, using Vite Proxy');
      }
      // Priority 3: Default to production primary backend
      else {
        apiUrl = PRIMARY_BACKEND;
        console.log('🌐 Using production primary backend:', PRIMARY_BACKEND);
      }

      console.log('📡 Final API baseURL:', apiUrl);
      return apiUrl;
    })(),
    timeout: 300000, // 5 minutes (to support 50MB media uploads)
  },
  app: {
    name: import.meta.env.VITE_APP_TITLE || 'NexFi',
  },
};

export default config;
