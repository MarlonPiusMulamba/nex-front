const config = {
  api: {
    baseURL: (() => {
      const envUrl = import.meta.env.VITE_API_URL;
      const pageHost = window.location.hostname;
      const pageProtocol = window.location?.protocol;

      // Detect if running in Capacitor/Ionic native app
      const isNative =
        pageProtocol === 'capacitor:' ||
        pageProtocol === 'ionic:' ||
        typeof window.Capacitor !== 'undefined';

      // Detect if running on local development server
      const isPageLocal =
        !isNative &&
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
      // Priority 2: For Capacitor apps, always use production backend
      else if (isNative) {
        apiUrl = 'https://nexback.pythonanywhere.com';
        console.log('📱 Capacitor app detected, using production backend');
      }
      // Priority 3: For local development, use local backend if available
      else if (isPageLocal) {
        apiUrl = `http://${pageHost}:5000`;
        console.log('💻 Local development detected, using local backend');
      }
      // Priority 4: Default to production backend
      else {
        apiUrl = 'https://nexback.pythonanywhere.com';
        console.log('🌐 Using production backend');
      }

      console.log('📡 Final API baseURL:', apiUrl);
      console.log('🖥️  Page hostname:', pageHost);
      console.log('🔌 Protocol:', pageProtocol);
      console.log('📱 Is Native App:', isNative);
      console.log('💻 Is Local Dev:', isPageLocal);

      return apiUrl;
    })(),
    timeout: 300000, // 5 minutes (to support 50MB media uploads)
  },
  app: {
    name: import.meta.env.VITE_APP_TITLE || 'NexFi',
  },
};

export default config;