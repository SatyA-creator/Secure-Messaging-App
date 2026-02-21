// Environment variables configuration
// In development:  set by .env.development  → points to http://localhost:8000
// In production:   set by .env.production   → points to Render backend
// NEVER fall back to production URL in dev — it causes credential mismatches.

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;

if (!API_URL) {
  console.error(
    '[env] VITE_API_URL is not set.\n' +
    'Create .env.development with:\n' +
    '  VITE_API_URL=http://localhost:8000/api/v1\n' +
    '  VITE_WS_URL=ws://localhost:8000'
  );
}

export const ENV = {
  API_URL: API_URL ?? 'http://localhost:8000/api/v1',
  WS_URL: WS_URL ?? 'ws://localhost:8000',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
