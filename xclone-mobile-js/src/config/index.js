import { Capacitor } from '@capacitor/core';

// ── Production backend (Bugema University) ────────────────────────────────────
const PRODUCTION_BACKEND = 'https://ssp.bugemauniv.ac.ug';

// ── Local LAN backend (development only — never used in APK builds) ──────────
const LOCAL_BACKEND = 'http://10.129.128.215:5000';

const config = {
  api: {
    localBaseURL: LOCAL_BACKEND,
    primaryBaseURL: PRODUCTION_BACKEND,
    secondaryBaseURL: PRODUCTION_BACKEND, // single source of truth — no Render fallback
    // candidateURLs drives the failover logic in api.js.
    // In production builds VITE_API_URL = https://ssp.bugemauniv.ac.ug, so only
    // that URL is in the list — no confusing fallback to old Render/DDNS hosts.
    candidateURLs: [
      import.meta.env.VITE_API_URL || PRODUCTION_BACKEND,
    ].filter(Boolean),
    baseURL: (() => {
      const envUrl = import.meta.env.VITE_API_URL;
      const isNative = Capacitor.isNativePlatform();
      const pageHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const isElectron =
        typeof window !== 'undefined' && window.process && window.process.type;

      // Only treat the page as "local dev" if explicitly running a Vite dev server.
      // Native (Android/iOS/Electron) and Vercel builds always use PRODUCTION_BACKEND.
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
        // Production builds: VITE_API_URL is baked in at build time from .env.production
        // → https://ssp.bugemauniv.ac.ug
        apiUrl = envUrl;
        console.log('🔧 Using VITE_API_URL from environment:', envUrl);
      } else if (isPageLocal) {
        // Vite dev server: use proxy (empty string → relative path)
        apiUrl = '';
        console.log('💻 Local development detected, using Vite Proxy');
      } else {
        // All other cases (native without .env.production, Vercel SSR, etc.)
        apiUrl = PRODUCTION_BACKEND;
        console.log('🌐 Defaulting to production backend:', PRODUCTION_BACKEND);
      }

      console.log('📡 Final API baseURL:', apiUrl || '(Vite proxy)');
      return apiUrl;
    })(),
    timeout: 30000, // 30 seconds — api.js overrides to 45s for native
  },
  app: {
    name: import.meta.env.VITE_APP_TITLE || 'NexFi',
  },
};

export default config;
