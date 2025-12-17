// Detect environment
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('192.168') ||
                      window.location.hostname.includes('10.');

// API URL based on environment
export const API_URL = isDevelopment 
  ? 'http://localhost:5000'  // Local Flask server
  : 'https://nexfi2.pythonanywhere.com/';  // Production

console.log('🌍 Environment:', isDevelopment ? 'Development' : 'Production');
console.log('📡 API_URL:', API_URL);
console.log('🖥️ Hostname:', window.location.hostname);