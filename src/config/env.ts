// Environment variables configuration
// In development:  reads .env.development  → http://localhost:8000
// In production:   reads .env.production   → Render backend
// Fallbacks are mode-aware so a missing env file never silently hits the wrong backend.

const isDev = import.meta.env.DEV;

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL  = import.meta.env.VITE_WS_URL;

if (!API_URL && isDev) {
  console.error(
    '[env] VITE_API_URL not set. Create .env.development:\n' +
    '  VITE_API_URL=http://localhost:8000/api/v1\n' +
    '  VITE_WS_URL=ws://localhost:8000'
  );
}

export const ENV = {
  // Dev fallback → localhost. Production fallback → Render (safe if .env.production is missing on CI).
  API_URL: API_URL ?? (isDev
    ? 'http://localhost:8000/api/v1'
    : 'https://secure-messaging-app-backend.onrender.com/api/v1'),
  WS_URL: WS_URL ?? (isDev
    ? 'ws://localhost:8000'
    : 'wss://secure-messaging-app-backend.onrender.com'),
  isDevelopment: isDev,
  isProduction: import.meta.env.PROD,
};
