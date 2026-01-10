// Environment variables configuration
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || 'https://secure-messaging-app-backend.onrender.com/api/v1',
  WS_URL: import.meta.env.VITE_WS_URL || 'wss://secure-messaging-app-backend.onrender.com',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
