import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker (no-op in dev mode)
registerSW({
  onNeedRefresh() {
    console.log('[SW] New version available — will update on next reload');
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
});

createRoot(document.getElementById("root")!).render(<App />);
