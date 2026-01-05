// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://secure-messaging-app-production.up.railway.app';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'wss://secure-messaging-app-production.up.railway.app';

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

// Default export for api client
const api = {
  get: async (endpoint: string, options?: RequestInit) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
      ...options,
    });
    return response.json();
  },
  
  post: async (endpoint: string, data?: unknown, options?: RequestInit) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return response.json();
  },
  
  put: async (endpoint: string, data?: unknown, options?: RequestInit) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return response.json();
  },
  
  delete: async (endpoint: string, options?: RequestInit) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
      ...options,
    });
    return response.json();
  },
};

export default api;
