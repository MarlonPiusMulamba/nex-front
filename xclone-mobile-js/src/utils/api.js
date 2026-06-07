import axios from 'axios';

import config from '../config/index.js';

// Create axios instance
const api = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('📡 API baseURL:', api.defaults.baseURL, '(VITE_API_URL:', import.meta.env.VITE_API_URL || 'not set', ')');

// ─── Retry Configuration ────────────────────────────────────────────────────
// Silently retries failed requests caused by Render cold-starts (502/503/504)
// or transient network blips, so the user never sees a failed request.
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500; // doubles each attempt: 1.5s, 3s, 6s

function shouldRetry(error) {
  // Retry on network errors (no response at all — server asleep)
  if (!error.response) return true;
  // Retry on Render cold-start / overload HTTP codes
  const retryableCodes = [502, 503, 504];
  return retryableCodes.includes(error.response.status);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  async (error) => {
    const requestConfig = error.config;

    // ── Auto-retry & Failover logic ───────────────────────────────────────────
    requestConfig._retryCount = requestConfig._retryCount || 0;

    if (shouldRetry(error) && requestConfig._retryCount < MAX_RETRIES) {
      requestConfig._retryCount += 1;
      
      const isPrimary = api.defaults.baseURL === config.api.primaryBaseURL;
      const shouldFailover = isPrimary && requestConfig._retryCount >= 2; // Failover on 2nd retry if primary is down

      if (shouldFailover && config.api.secondaryBaseURL) {
        console.error('🚨 Primary backend appears down. Switching to Secondary (Render) failover...');
        config.api.baseURL = config.api.secondaryBaseURL;
        api.defaults.baseURL = config.api.secondaryBaseURL;
        requestConfig.baseURL = config.api.secondaryBaseURL; // Update current request too
        
        // Notify other services (like Socket.IO) that we've switched backends
        window.dispatchEvent(new CustomEvent('backend:failover', { 
          detail: { baseURL: config.api.secondaryBaseURL } 
        }));
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, requestConfig._retryCount - 1);
      console.warn(
        `⚠️ Request failed (${error.response?.status || 'network error'}). ` +
        `Retrying ${requestConfig._retryCount}/${MAX_RETRIES} in ${delay}ms using ${requestConfig.baseURL || api.defaults.baseURL}...`,
        requestConfig.url
      );
      
      await wait(delay);
      return api(requestConfig); // Re-issue the exact same request
    }
    // ── End failover logic ────────────────────────────────────────────────────

    // All retries exhausted — log and handle normally
    console.error('❌ API Error (all retries failed):', {
      url: requestConfig?.url,
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