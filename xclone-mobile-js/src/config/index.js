import { Capacitor } from '@capacitor/core';

// ── Production backend (Bugema University) ────────────────────────────────────
const PRODUCTION_BACKEND = 'https://ssp.bugemauniv.ac.ug';

// ── Local LAN backend (development only — never used in APK builds) ──────────
const LOCAL_BACKEND = 'http://localhost:5000';

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
      const isNative = Capacitor.isNativePlatform();

      // 📱 Native Android/iOS APK builds MUST ALWAYS target hosted production backend (https://ssp.bugemauniv.ac.ug)
      if (isNative) {
        console.log('📱 Native App (Android/iOS APK) detected! Enforcing hosted backend:', PRODUCTION_BACKEND);
        return PRODUCTION_BACKEND;
      }

      const envUrl = import.meta.env.VITE_API_URL;
      const pageHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const isElectron =
        typeof window !== 'undefined' && window.process && window.process.type;

      const isPageLocal =
        !isElectron &&
        (pageHost === 'localhost' ||
          pageHost === '127.0.0.1' ||
          pageHost.startsWith('10.') ||
          pageHost.startsWith('192.168.') ||
          pageHost.startsWith('172.') ||
          pageHost.startsWith('100.')); // Tailscale IP range

      let apiUrl;

      if (isPageLocal && envUrl && envUrl.includes('localhost') && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
        // If VITE_API_URL is set to localhost and browser is on a LAN IP (e.g. 10.129.128.121),
        // rewrite API target to the host IP for live web testing
        const port = envUrl.split(':')[2] || '5000';
        apiUrl = `http://${pageHost}:${port.replace(/[^0-9]/g, '')}`;
        console.log(`🌐 LAN web client detected! Dynamically binding API baseURL to ${apiUrl}`);
      } else if (envUrl && !envUrl.includes('localhost')) {
        // Production or explicit external URL
        apiUrl = envUrl;
        console.log('🔧 Using VITE_API_URL from environment:', envUrl);
      } else if (isPageLocal) {
        if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
          apiUrl = `http://${pageHost}:5000`;
          console.log('💻 LAN web client detected, using direct LAN backend:', apiUrl);
        } else {
          apiUrl = '';
          console.log('💻 Local development detected, using Vite Proxy');
        }
      } else {
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
