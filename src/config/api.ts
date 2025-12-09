// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8001';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/v1/auth/login`,
    REGISTER: `${API_BASE_URL}/api/v1/auth/register`,
    ME: `${API_BASE_URL}/api/v1/auth/me`,
  },
  INVITATIONS: {
    SEND: `${API_BASE_URL}/api/v1/invitations/send`,
    VERIFY: (token: string) => `${API_BASE_URL}/api/v1/invitations/verify/${token}`,
    ACCEPT: `${API_BASE_URL}/api/v1/invitations/accept`,
  },
  WEBSOCKET: (userId: string) => `${WS_BASE_URL}/ws/${userId}`,
};

export const config = {
  apiUrl: API_BASE_URL,
  wsUrl: WS_BASE_URL,
  environment: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
