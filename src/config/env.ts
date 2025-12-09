// Environment variables configuration
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8001',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
