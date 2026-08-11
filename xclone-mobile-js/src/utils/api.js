import axios from 'axios';
import config from '../config/index.js';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// Create axios instance
const api = axios.create({
  baseURL: config.api.baseURL,
  // 15s is enough on mobile — 45s caused very slow "Server Connection Issue" UX
  timeout: isNative ? 15000 : config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('📡 API baseURL:', api.defaults.baseURL, '| Platform:', isNative ? 'native' : 'web', '| VITE_API_URL:', import.meta.env.VITE_API_URL || 'not set');

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function shouldRetry(error) {
  const candidates = config.api?.candidateURLs || [];
  const maxAllowed = Math.max(MAX_RETRIES, candidates.length);
  // Allow retrying network errors across all candidate backends
  if (!error.response) return (error.config?._retryCount || 0) < maxAllowed;
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
    const resData = response.data;
    if (resData && typeof resData === 'object' && !('data' in resData)) {
      try {
        Object.defineProperty(resData, 'data', {
          get() { return this; },
          enumerable: false,
          configurable: true
        });
      } catch (e) {
        // ignore if frozen object
      }
    }
    return resData;
  },
  async (error) => {
    const requestConfig = error.config;
    if (!requestConfig) return Promise.reject(error);

    requestConfig._retryCount = requestConfig._retryCount || 0;
    const candidates = config.api?.candidateURLs || [];
    const maxRetries = Math.max(MAX_RETRIES, candidates.length);

    if (shouldRetry(error) && requestConfig._retryCount < maxRetries) {
      requestConfig._retryCount += 1;

      // Failover to next candidate backend URL if request failed
      if (candidates.length > 1) {
        const curBase = (api.defaults.baseURL || '').replace(/\/$/, '');
        const currentIdx = candidates.findIndex(c => (c || '').replace(/\/$/, '') === curBase);
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % candidates.length;
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
