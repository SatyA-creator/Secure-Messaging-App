# 07 — Code Reuse Strategy
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat — One Codebase, Three Platforms
**Status:** Architecture decision record

---

## 1. The Goal

90%+ of the QuChat codebase runs identically on:
- Web (browser via Vite dev server / hosting)
- Android (Capacitor WebView + native bridge)
- PWA (installed browser app with service worker)

This is achievable because Capacitor uses a WebView — the React app doesn't know (or care) whether it's inside Chrome or an Android WebView. The differences are:
1. Routing strategy (`MemoryRouter` vs `BrowserRouter`)
2. ~5 platform event listeners (back button, resume, deep links)
3. Optional native plugin calls for enhanced UX (camera, keyboard, statusbar)

---

## 2. Code Categorisation

Every file in `src/` falls into one of these categories:

### Category A — Completely Shared (No Changes)
These files run byte-for-byte identically on all platforms:

```
src/lib/cryptoService.ts       ← Web Crypto API (works in all WebViews)
src/lib/websocket.ts           ← WebSocket (works everywhere)
src/lib/localStore.ts          ← IndexedDB/Dexie (works in all WebViews)
src/lib/relayClient.ts         ← fetch() (works everywhere)
src/lib/offlineQueue.ts        ← Pure JS
src/lib/markdownSerializer.ts  ← Pure JS
src/lib/utils.ts               ← Pure JS utility functions
src/config/env.ts              ← import.meta.env (set at build time)
src/config/api.ts              ← API URL config
src/types/messaging.ts         ← TypeScript types
src/context/AuthContext.tsx    ← React Context + fetch()
src/context/ChatContext.tsx    ← React Context + WebSocket events
All src/components/ui/         ← shadcn/ui — pure React + Tailwind
All src/components/auth/       ← LoginForm, RegisterForm — pure React
src/components/chat/*          ← All chat components — pure React + Tailwind
All src/pages/                 ← All pages — pure React
```

**Total: ~95% of all files**

### Category B — Thin Wrappers (Modified Minimally)
These files get small additions but are not rewritten:

```
src/App.tsx
  Change: BrowserRouter → platform-aware Router
  Change: Add 3 Capacitor event listeners in useEffect
  Lines changed: ~20

index.html
  Change: Update viewport meta tag
  Change: Add PWA meta tags
  Lines changed: ~8

src/main.tsx
  Change: Import Ionic CSS (3 lines)
  Change: setupIonicReact() call (1 line)
  Change: registerSW() for PWA (5 lines)
  Lines changed: ~10

src/index.css (or global CSS)
  Change: Add safe-area CSS variables
  Lines changed: ~10

vite.config.ts
  Change: Add VitePWA plugin
  Lines changed: ~60 (mostly manifest config)
```

### Category C — New Files (Platform Abstraction Layer)
Small new files that isolate all platform-specific code:

```
src/lib/platform/
  index.ts           ← Platform detection utilities
  media.web.ts       ← Web file picker (existing logic extracted)
  media.native.ts    ← Capacitor camera/gallery
  mediaFactory.ts    ← Returns correct implementation

src/hooks/
  useAppLifecycle.ts ← Capacitor App events (resume, back button)
  usePWAInstall.ts   ← beforeinstallprompt handling

src/components/chat/
  InstallPWAButton.tsx  ← PWA install prompt UI

capacitor.config.ts    ← New: Capacitor configuration
public/icons/          ← New: PWA icons (static assets)
```

---

## 3. The Platform Abstraction Pattern

The key pattern that keeps shared code clean is the **platform abstraction factory**.

### 3.1 Media Service (Example)

**Current implementation (web only):**
```typescript
// src/lib/mediaService.ts — UNCHANGED
export const uploadMedia = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${ENV.API_URL}/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  return response.json();
};
```

**New: Platform factory (wraps file selection, not upload):**
```typescript
// src/lib/platform/mediaFactory.ts
import { Capacitor } from '@capacitor/core';

export interface MediaPickResult {
  file: File;
  previewUrl: string;
}

export const pickMedia = async (): Promise<MediaPickResult | null> => {
  if (Capacitor.isNativePlatform()) {
    const { pickMediaNative } = await import('./media.native');
    return pickMediaNative();
  } else {
    const { pickMediaWeb } = await import('./media.web');
    return pickMediaWeb();
  }
};
```

```typescript
// src/lib/platform/media.web.ts — extracted from existing MediaUpload.tsx
export const pickMediaWeb = (): Promise<MediaPickResult | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(null); return; }
      resolve({ file, previewUrl: URL.createObjectURL(file) });
    };
    input.click();
  });
};
```

```typescript
// src/lib/platform/media.native.ts — new (only imported on Android)
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const pickMediaNative = async (): Promise<MediaPickResult | null> => {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.Blob,
      source: CameraSource.Prompt,  // Shows "Camera" or "Gallery" choice
    });
    if (!photo.blob) return null;
    const file = new File([photo.blob], `photo.${photo.format}`, {
      type: `image/${photo.format}`,
    });
    return { file, previewUrl: URL.createObjectURL(file) };
  } catch {
    return null;  // User cancelled
  }
};
```

**Usage in `MediaUpload.tsx` — one line changes:**
```typescript
// Before:
const input = document.createElement('input');
// ... existing web logic ...

// After:
import { pickMedia } from '@/lib/platform/mediaFactory';
const result = await pickMedia();
if (result) { handleFileSelected(result.file); }
```

The upload logic (HTTP POST) remains completely unchanged.

### 3.2 Platform Utilities

```typescript
// src/lib/platform/index.ts
import { Capacitor } from '@capacitor/core';

export const platform = {
  isNative: () => Capacitor.isNativePlatform(),
  isAndroid: () => Capacitor.getPlatform() === 'android',
  isIOS: () => Capacitor.getPlatform() === 'ios',
  isWeb: () => Capacitor.getPlatform() === 'web',
  isPWA: () => window.matchMedia('(display-mode: standalone)').matches,
} as const;
```

---

## 4. One Codebase, Three Build Commands

```
Target    Command                          Output
─────────────────────────────────────────────────────────────────
Web       npm run dev                      Vite dev server :8080
Web       npm run build                    dist/ → deploy to hosting
Android   npm run build && npx cap sync    dist/ → android/ → APK/AAB
PWA       npm run build                    dist/ (includes SW + manifest)
```

The same `npm run build` output serves **both web hosting and PWA** — no separate build step. For Android, `npx cap sync` is added after.

**Environment at build time:**
```bash
# Production web + PWA build
npm run build
# Uses .env.production: VITE_API_URL=https://...render.com/api/v1

# Development web build
npm run dev
# Uses .env.development: VITE_API_URL=http://localhost:8000/api/v1

# Android production build (same as web production)
npm run build && npx cap sync android
```

---

## 5. Shared State Management (Why It Just Works)

React Context (`AuthContext`, `ChatContext`) is 100% browser-agnostic:
- No `window.location` usage (routing is via React Router hooks)
- No `document.*` manipulation
- No `localStorage` corruption risk (Capacitor WebView shares the same origin)
- `localStorage.getItem('authToken')` works identically in Capacitor

**One subtlety:** Capacitor WebView on Android uses `capacitor://localhost` as its origin. `localStorage` is scoped to this origin — separate from the web app's localStorage on `your-domain.com`. This is **correct behaviour** — separate installs should have separate sessions.

---

## 6. Crypto on Mobile (Why It Works Unchanged)

`cryptoService.ts` uses the **Web Crypto API** (`window.crypto.subtle`). This API:
- Is available in all modern browsers
- Is available in Capacitor WebView (Chromium-based on Android)
- Is NOT a Node.js API — it's a browser standard

IndexedDB is used to store keys:
- Available in all browsers
- Available in Capacitor WebView
- Keys persist between app launches (same as browser)

**No changes required to `cryptoService.ts`.**

---

## 7. WebSocket Reconnection on Mobile

The existing `WebSocketService` auto-reconnects with 5 attempts. For mobile, we add one enhancement: reconnect immediately when the app resumes from background.

```typescript
// src/hooks/useAppLifecycle.ts — NEW file
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { wsService } from '@/lib/websocket';

export const useAppLifecycle = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const resumeHandler = App.addListener('resume', () => {
      console.log('[Lifecycle] App resumed — reconnecting WebSocket');
      wsService.reconnect();
    });

    return () => {
      resumeHandler.then(h => h.remove());
    };
  }, []);
};
```

Use in `App.tsx`:
```typescript
// src/App.tsx
import { useAppLifecycle } from '@/hooks/useAppLifecycle';

const App = () => {
  useAppLifecycle();
  // ... rest of App unchanged
};
```

---

## 8. Reuse Percentage Analysis

| Layer | Files | Reuse % | Notes |
|-------|-------|---------|-------|
| Business logic (`lib/`) | 8 files | 100% | No changes |
| State (`context/`) | 2 files | 100% | No changes |
| Types | 1 file | 100% | No changes |
| Config | 2 files | 100% | No changes |
| UI components (`ui/`) | 50+ files | 100% | No changes |
| Chat components | 13 files | 98% | MediaUpload: 3 lines change |
| Auth components | 2 files | 100% | No changes |
| Pages | 5 files | 100% | No changes |
| `App.tsx` | 1 file | 85% | Router + lifecycle hooks |
| `main.tsx` | 1 file | 90% | Ionic setup + SW registration |
| `index.html` | 1 file | 80% | Viewport + PWA meta tags |
| `vite.config.ts` | 1 file | 60% | PWA plugin added |
| **Overall** | | **~96%** | |

---

## 9. What to Avoid (Anti-Patterns)

### ❌ Don't do: Duplicate components for web and mobile

```
src/components/chat/MessageInput.tsx      ← web version
src/components/chat/MessageInputMobile.tsx ← mobile version
```

This creates divergence and doubles maintenance burden.

### ✅ Do: Single component with responsive CSS

```typescript
// MessageInput.tsx
const isMobile = useMediaQuery('(max-width: 768px)');
// Adjust layout via Tailwind responsive classes, not duplicate components
```

### ❌ Don't do: Scattered platform checks

```typescript
// In every component
if (Capacitor.isNativePlatform()) { ... }
```

### ✅ Do: Platform checks only in `platform/` layer and `App.tsx`

All `Capacitor.*` calls live in:
- `src/lib/platform/` (service abstraction)
- `src/hooks/useAppLifecycle.ts` (lifecycle events)
- `src/App.tsx` (router + startup)

Zero `Capacitor.*` calls in business logic or UI components.

### ❌ Don't do: Separate builds for web and mobile

One `npm run build` produces output that works for both web hosting and Capacitor sync.

### ✅ Do: Same build, different delivery mechanism

- Web: deploy `dist/` to Vercel/Netlify/Render
- Android: `npx cap sync` copies `dist/` to Android assets
- PWA: same `dist/` with manifest and SW auto-included by `vite-plugin-pwa`
