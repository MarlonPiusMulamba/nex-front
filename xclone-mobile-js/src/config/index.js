import { Capacitor } from '@capacitor/core';

// ── Production backend (Bugema University) ────────────────────────────────────
const PRODUCTION_BACKEND = 'https://ssp.bugemauniv.ac.ug';

// ── Local LAN backend (development only) ─────────────────────────────────────
const LOCAL_BACKEND = 'http://10.129.128.215:5000';

const config = {
  api: {
    localBaseURL: LOCAL_BACKEND,
    primaryBaseURL: PRODUCTION_BACKEND,
    secondaryBaseURL: PRODUCTION_BACKEND, // single source of truth — no Render fallback
    candidateURLs: [
      import.meta.env.VITE_API_URL,
      PRODUCTION_BACKEND,
    ].filter(Boolean),
    baseURL: (() => {
      const envUrl = import.meta.env.VITE_API_URL;
      const pageHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
      const isNative = Capacitor.isNativePlatform();

      // Only treat the page as "local dev" if explicitly running a Vite dev server
      // (never treat Vercel / SSG as local)
      const isPageLocal =
        !isNative &&
        !isElectron &&
        (pageHost === 'localhost' ||
          pageHost === '127.0.0.1' ||
          pageHost.startsWith('10.') ||
          pageHost.startsWith('192.168.') ||
          pageHost.startsWith('172.'));

      let apiUrl;

      if (envUrl) {
        // Always respect the build-time env var first
        // .env.production sets this to https://ssp.bugemauniv.ac.ug for all prod builds
        apiUrl = envUrl;
        console.log('🔧 Using VITE_API_URL from environment:', envUrl);
      } else if (isPageLocal) {
        apiUrl = ''; // Vite proxy handles it in local dev
        console.log('💻 Local development detected, using Vite Proxy');
      } else {
        // All production clients: Android APK, iOS, Windows exe, Vercel web
        apiUrl = PRODUCTION_BACKEND;
        console.log('🌐 Using production backend:', PRODUCTION_BACKEND);
      }

      console.log('📡 Final API baseURL:', apiUrl);
      return apiUrl;
    })(),
    timeout: 30000, // 30 seconds for standard calls
  },
  app: {
    name: import.meta.env.VITE_APP_TITLE || 'NexFi',
  },
};

export default config;
