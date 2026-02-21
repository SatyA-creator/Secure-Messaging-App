# 01 — Project Analysis
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat Messaging App — React → Mobile Conversion
**Status:** Pre-conversion assessment

---

## 1. Overview

This document analyses the existing React web codebase and establishes what can be carried forward unchanged, what must be adapted, and what is entirely new work for the Android (and later iOS) conversion.

The goal is a **single codebase** that builds to:
- A modern web app (existing)
- An Android APK / AAB (new)
- A PWA (new — offline-first web distribution channel)

---

## 2. Current Stack Snapshot

| Layer | Technology | Notes |
|-------|-----------|-------|
| UI framework | React 18 + TypeScript | Entry: `src/main.tsx` |
| Bundler | Vite | Config: `vite.config.ts`, port 8080 |
| Routing | React Router v6 (`BrowserRouter`) | 4 routes |
| State | React Context (`AuthContext`, `ChatContext`) | No Redux |
| Server state | TanStack Query v5 | API caching |
| UI components | shadcn/ui + Radix UI + Tailwind CSS | ~50 ui/ components |
| Real-time | WebSocket singleton (`src/lib/websocket.ts`) | Auto-reconnect, 5 attempts |
| Crypto | ECDH P-256 + AES-256-GCM | Keys in IndexedDB via `idb` |
| Local cache | Dexie (IndexedDB) | `QuChatDB` → messages, conversations |
| Media | HTTP upload `POST /api/v1/media/upload` | `src/lib/mediaService.ts` |
| API | FastAPI backend, port 8000 | REST + WebSocket |
| PWA support | **None** | No manifest.json, no service worker |

---

## 3. What Can Remain Completely Unchanged

These modules require **zero modifications** for mobile:

### 3.1 Business Logic & Services
| File | What it does | Mobile-safe? |
|------|-------------|-------------|
| `src/lib/cryptoService.ts` | ECDH + AES-256-GCM encryption | ✅ Web Crypto API works in Capacitor WebView |
| `src/lib/websocket.ts` | WebSocket singleton | ✅ WebSocket works natively in WebView |
| `src/lib/localStore.ts` | Dexie IndexedDB cache | ✅ IndexedDB available in Capacitor WebView |
| `src/lib/relayClient.ts` | Poll relay for offline msgs | ✅ HTTP fetch unchanged |
| `src/lib/offlineQueue.ts` | Offline message queuing | ✅ Pure JS logic |
| `src/lib/markdownSerializer.ts` | Export/import conversations | ✅ Pure JS |
| `src/lib/mediaService.ts` | File upload via HTTP | ✅ Works; native camera pickup adds later |
| `src/config/env.ts` | API URL config | ✅ With Capacitor env variable handling |

### 3.2 State Management
| File | Notes |
|------|-------|
| `src/context/AuthContext.tsx` | No DOM-specific APIs |
| `src/context/ChatContext.tsx` | Pure React state + WebSocket events |
| `src/types/messaging.ts` | TypeScript types — untouched |

### 3.3 API Integration
- All TanStack Query hooks remain unchanged.
- `GET/POST` calls against `VITE_API_URL` work identically inside Capacitor's WebView.
- WebSocket URL (`VITE_WS_URL`) works the same way.

### 3.4 UI Components (shadcn/ui)
- All `src/components/ui/` components are plain React + Tailwind — they work in mobile WebView.
- No native DOM APIs are used in these components.

---

## 4. What Must Be Adapted for Mobile

### 4.1 Routing — BrowserRouter → MemoryRouter (or HashRouter)

**Current:** `BrowserRouter` in `src/App.tsx`

**Problem:** On Android, Capacitor serves the app from `file://` origin. `BrowserRouter` pushes paths to the browser history which doesn't work on `file://`. Deep links and back-button navigation break.

**Fix:** Replace `BrowserRouter` with `MemoryRouter` (preferred) or `HashRouter`.

```tsx
// src/App.tsx — change this
import { BrowserRouter } from 'react-router-dom';

// To this (MemoryRouter for mobile, BrowserRouter for web)
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
const Router = Capacitor.isNativePlatform() ? MemoryRouter : BrowserRouter;
```

**Impact:** Only `src/App.tsx` changes — all `<Route>` definitions stay identical.

### 4.2 Environment Variable Handling

**Current:** `import.meta.env.VITE_API_URL` from `.env.development`

**Problem:** Capacitor bundles the compiled JS — there is no runtime `.env` file on the device. The API URL must be baked in at build time OR read from `capacitor.config.ts`.

**Fix:** Keep using Vite's `import.meta.env`. At build time supply the production API URL. For local testing supply `--mode development`. No code changes required — just build pipeline configuration.

### 4.3 Viewport & Safe Areas

**Problem:** Mobile devices have notches, status bars, and bottom gesture bars that overlap content.

**Files affected:**
- `src/pages/Chat.tsx` — chat layout
- `src/components/chat/Sidebar.tsx`
- `src/components/chat/MessageInput.tsx`
- `index.html` — viewport meta tag

**Fix:**
```html
<!-- index.html -->
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0" />
```

Add CSS safe-area insets:
```css
/* In tailwind or global CSS */
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-area-top    { padding-top:    env(safe-area-inset-top);    }
```

### 4.4 Keyboard Handling on Mobile

**Problem:** On mobile, the software keyboard resizes the viewport and can cover the `MessageInput` component.

**Files affected:** `src/components/chat/MessageInput.tsx`

**Fix:** Use Capacitor's `@capacitor/keyboard` plugin to listen for keyboard show/hide events and adjust the layout programmatically.

### 4.5 File / Media Access

**Current:** `src/lib/mediaService.ts` uses HTML `<input type="file">` for file selection.

**Problem:** On Android, direct `<input type="file">` works in Capacitor WebView but access to the camera or gallery requires native permissions and the `@capacitor/camera` plugin for a better UX.

**Fix:** Wrap media access behind a service abstraction:
```
src/lib/mediaService.ts     ← existing web impl (unchanged)
src/lib/mediaServiceNative.ts ← new Capacitor camera/gallery impl
src/lib/mediaServiceFactory.ts ← returns correct impl based on platform
```

### 4.6 WebSocket URL on Device

**Current:** `VITE_WS_URL` defaults to `wss://secure-messaging-app-backend.onrender.com`

**No code change needed** — the production WebSocket URL works from the device the same as from a browser. For local development, use ngrok (already configured in `vite.config.ts`).

### 4.7 Back Button (Android Hardware Back)

Android devices have a hardware/gesture back button. React Router doesn't handle this automatically on `MemoryRouter`.

**Fix:** Add a listener using Capacitor's `App` plugin:
```typescript
import { App } from '@capacitor/app';
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) { window.history.back(); }
  else { App.exitApp(); }
});
```

Location: `src/App.tsx` inside a `useEffect`.

---

## 5. Routing Considerations

**Current routes:**
```
/                        → Index (Auth or Chat)
/accept-invitation/:token → AcceptInvitation
/settings                → Settings
*                        → NotFound
```

**Mobile routing strategy:**
1. Switch to `MemoryRouter` on native platforms.
2. Deep links (e.g., invitation links from email) use Capacitor's App URL open listener → programmatically navigate inside MemoryRouter.
3. All route definitions in `App.tsx` remain identical.

**Deep link handling for invitation tokens:**
```typescript
App.addListener('appUrlOpen', (event) => {
  const url = new URL(event.url);
  const token = url.pathname.match(/accept-invitation\/(.+)/)?.[1];
  if (token) navigate(`/accept-invitation/${token}`);
});
```

---

## 6. State Management Compatibility

React Context (`AuthContext`, `ChatContext`) is 100% compatible with Capacitor. No changes needed.

TanStack Query works identically — it caches against the same API URLs.

**One consideration:** On mobile, the app can be backgrounded. When the app resumes:
- The WebSocket may have been disconnected (OS kills idle connections).
- TanStack Query's `refetchOnWindowFocus` triggers a refetch — this is the correct behavior.
- `WebSocketService` auto-reconnect (5 attempts) handles WebSocket restoration.

No changes needed in state management code.

---

## 7. API Layer Reuse

**100% reuse.** The FastAPI backend is deployed on Render (`https://secure-messaging-app-backend.onrender.com`). The Capacitor WebView makes HTTPS requests to this URL identically to a browser.

**CORS:** The backend already has CORS configured. Capacitor on Android uses a special origin (`capacitor://localhost` or `http://localhost`). Add these to `CORS_ORIGINS` in the backend `.env`:
```
CORS_ORIGINS=http://localhost,capacitor://localhost,https://your-web-domain.com
```

---

## 8. UI Issues When Moving to Mobile

| Issue | Severity | Affected Files | Fix |
|-------|----------|---------------|-----|
| Small tap targets | Medium | Buttons in `MessageBubble.tsx`, `ContactList.tsx` | Ensure min 44×44px touch targets |
| Hover-only interactions | Low | Some Radix tooltips | Make accessible on tap |
| Sidebar layout on phones | High | `Sidebar.tsx`, `Chat.tsx` | Convert to slide-over panel or bottom tab |
| Text too small | Medium | Message text, timestamps | Increase base font size to 16px minimum |
| Scrolling performance | Medium | `MessageList` long lists | Virtualize with `react-window` or `@tanstack/virtual` |
| Input type=file | Low | `MediaUpload.tsx` | Works; enhance with native camera plugin |
| No loading splash | Low | App startup | Add Capacitor splash screen |
| No status bar theming | Low | global | Configure via Capacitor `StatusBar` plugin |

---

## 9. Performance Considerations

### 9.1 WebView Performance
Capacitor renders inside a native WebView (Chromium on Android). Performance is generally good for a chat app. Known concerns:

- **Long message lists:** If a conversation exceeds ~500 messages, DOM node count becomes a performance issue. Plan to add virtual scrolling in `ChatWindow.tsx`.
- **Crypto operations:** `cryptoService.ts` uses the Web Crypto API which is hardware-accelerated on modern Android. No performance issues expected.
- **IndexedDB:** Dexie operations are async and non-blocking. No issues expected.

### 9.2 Bundle Size
Current build has ~50 Radix UI components and Recharts. For mobile:
- Tree-shaking via Vite handles unused components well.
- Target bundle size: < 2MB for initial JS (check with `npm run build && npx vite-bundle-visualizer`).

### 9.3 Network
On mobile, network conditions vary. The existing `offlineQueue.ts` handles message queuing when disconnected. TanStack Query's caching reduces redundant API calls.

### 9.4 Background Behaviour
- Android may kill the WebSocket connection when the app is backgrounded for > 5 minutes.
- On resume, `WebSocketService.reconnect()` should be triggered via the Capacitor `App` resume event.

```typescript
App.addListener('resume', () => {
  wsService.reconnect();
});
```

---

## 10. Summary Assessment

| Category | Effort | Risk |
|----------|--------|------|
| Core business logic reuse | None | None |
| Routing change | 1 day | Low |
| Capacitor installation & config | 0.5 day | Low |
| Android build setup | 1 day | Medium |
| Safe area / viewport CSS | 0.5 day | Low |
| Keyboard handling | 0.5 day | Medium |
| Back button handling | 0.5 day | Low |
| CORS update on backend | 0.5 day | Low |
| UI polish for mobile | 3–5 days | Medium |
| PWA manifest + service worker | 2 days | Low |

**Total estimated effort for a functional Android build: ~3–4 engineering days**
**Total for production-quality Android release: ~10–14 days**
