const config = {
  api: {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 30000, // 30 seconds
  },
  app: {
    name: import.meta.env.VITE_APP_TITLE || 'NexFi',
  },
};

export default config;