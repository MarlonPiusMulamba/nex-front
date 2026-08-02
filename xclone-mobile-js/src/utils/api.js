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

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function shouldRetry(error) {
  // Retry on network errors (no response at all — server asleep / IP unreachable)
  if (!error.response) return true;
  // Retry on Render cold-start / server error codes
  const retryableCodes = [500, 502, 503, 504];
  return retryableCodes.includes(error.response.status);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Request interceptor
api.interceptors.request.use(
  (reqConfig) => {
    if (import.meta.env.DEV) {
      console.log('🌐 API Request:', reqConfig.method?.toUpperCase(), reqConfig.url);
    }
    const token = localStorage.getItem('token');
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with candidate backend failover
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('✅ API Response:', response.config.url, response.status);
    }
    return response;
  },
  async (error) => {
    const requestConfig = error.config;
    if (!requestConfig) return Promise.reject(error);

    requestConfig._retryCount = requestConfig._retryCount || 0;

    if (shouldRetry(error) && requestConfig._retryCount < MAX_RETRIES) {
      requestConfig._retryCount += 1;

      // Failover to next candidate backend URL if request failed
      const candidates = config.api.candidateURLs || [];
      if (candidates.length > 1) {
        const currentIdx = candidates.indexOf(api.defaults.baseURL);
        const nextIdx = (currentIdx + 1) % candidates.length;
        const nextUrl = candidates[nextIdx];

        console.warn(`🚨 Switching API backend from ${api.defaults.baseURL} to ${nextUrl}...`);
        config.api.baseURL = nextUrl;
        api.defaults.baseURL = nextUrl;
        requestConfig.baseURL = nextUrl;

        window.dispatchEvent(new CustomEvent('backend:failover', {
          detail: { baseURL: nextUrl }
        }));
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, requestConfig._retryCount - 1);
      console.warn(
        `⚠️ API Request failed (${error.response?.status || 'network error'}). ` +
        `Retrying (${requestConfig._retryCount}/${MAX_RETRIES}) in ${delay}ms using ${requestConfig.baseURL || api.defaults.baseURL}...`
      );

      await wait(delay);
      return api(requestConfig);
    }

    console.error('❌ API Error (all retries failed):', {
      url: requestConfig?.url,
      status: error.response?.status,
      message: error.message,
    });

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;