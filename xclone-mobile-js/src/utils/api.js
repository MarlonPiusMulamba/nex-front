import axios from 'axios';

// Try multiple import strategies with fallback
let config;

try {
  // Try path alias first (recommended)
  const configModule = await import('@/config/index.js');
  config = configModule.default || configModule;
} catch (error) {
  console.warn('Could not load config from @/config, using fallback');
  const pageHost = window.location.hostname;
  const isPageLocal =
    pageHost === 'localhost' ||
    pageHost === '127.0.0.1' ||
    pageHost.startsWith('10.') ||
    pageHost.startsWith('192.168.') ||
    pageHost.startsWith('172.');

  // Fallback configuration
  config = {
    api: {
      baseURL:
        import.meta.env.VITE_API_URL ||
        (isPageLocal ? `http://${pageHost}:5000` : 'https://nexback.pythonanywhere.com'),
      timeout: 30000,
    },
  };
}

// Create axios instance
const api = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('📡 API baseURL:', api.defaults.baseURL, '(VITE_API_URL:', import.meta.env.VITE_API_URL || 'not set', ')');

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log('🌐 API Request:', config.method?.toUpperCase(), config.url);
    }
    
    // Add auth tokens here if needed
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log('✅ API Response:', response.config.url, response.status);
    }
    return response.data;
  },
  (error) => {
    // Handle errors globally
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });
    
    // Handle specific error codes
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;