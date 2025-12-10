// Environment variables configuration
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || 'https://secure-messaging-app-production.up.railway.app/api/v1',
  WS_URL: import.meta.env.VITE_WS_URL || 'wss://secure-messaging-app-production.up.railway.app',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
