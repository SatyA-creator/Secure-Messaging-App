# 02 — Architecture Plan
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat — Multi-Platform Architecture
**Status:** Design approved

---

## 1. Goals

1. One codebase → three targets: Web, Android APK/AAB, PWA.
2. Zero rewrite of business logic, crypto, WebSocket, or API services.
3. Platform-specific code isolated in dedicated abstraction layers.
4. Capacitor acts as the native bridge — it does NOT change React code.
5. Ionic React used selectively for mobile-optimised navigation components only (not a full Ionic UI rewrite).

---

## 2. Layered Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUILD TARGETS                            │
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│   │   Web App    │   │  Android APK │   │     PWA          │   │
│   │  (Vite dev)  │   │ (Capacitor)  │   │ (Vite + SW)      │   │
│   └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘   │
└──────────┼─────────────────┼────────────────────┼─────────────┘
           │                 │                    │
           └────────────────►▼◄───────────────────┘
                    ┌─────────────────┐
                    │  React App Core  │
                    │  (src/ — shared) │
                    └────────┬────────┘
                             │
           ┌─────────────────┼──────────────────┐
           ▼                 ▼                  ▼
  ┌────────────────┐ ┌──────────────┐ ┌─────────────────┐
  │  UI Layer      │ │ State Layer  │ │  Service Layer  │
  │                │ │              │ │                 │
  │ shadcn/ui      │ │ AuthContext  │ │ cryptoService   │
  │ Tailwind CSS   │ │ ChatContext  │ │ websocket       │
  │ Ionic Nav*     │ │ TanStack Q   │ │ localStore      │
  │ (mobile only)  │ │              │ │ relayClient     │
  └────────────────┘ └──────────────┘ │ mediaFactory    │
                                      │ offlineQueue    │
                                      └────────┬────────┘
                                               │
                             ┌─────────────────┼──────────────┐
                             ▼                 ▼              ▼
                    ┌─────────────┐  ┌──────────────┐ ┌──────────────┐
                    │  Platform   │  │  Native APIs │ │  Backend API │
                    │  Adapter    │  │  (Capacitor) │ │  FastAPI     │
                    │  Layer      │  │              │ │  port 8000   │
                    │             │  │ Camera       │ │              │
                    │ isNative()  │  │ Keyboard     │ │ REST HTTPS   │
                    │ isWeb()     │  │ StatusBar    │ │ WebSocket    │
                    │ isPWA()     │  │ App events   │ └──────────────┘
                    └─────────────┘  └──────────────┘

* Ionic Nav used only for IonTabBar / IonBackButton — not a full Ionic rewrite
```

---

## 3. Data Flow Diagram

### 3.1 Message Send Flow (unchanged across platforms)

```
User types message in MessageInput.tsx
         │
         ▼
ChatContext.sendMessage()
         │
         ▼
cryptoService.encryptMessage(content, recipientPublicKey)
  → AES-256-GCM encrypted payload
         │
         ▼
relayClient.POST /api/v1/relay/send
  { encrypted_content, encrypted_session_key,
    sender_encrypted_content, recipient_id }
         │
         ▼
FastAPI relay.py
  → persist to Message table
  → if recipient online: push via WebSocket
  → if offline: store in relay_messages (TTL)
         │
         ▼
Recipient's WebSocket receives message event
  → ChatContext handleIncomingMessage()
  → cryptoService.decryptMessage()
  → localStore.saveMessage() [IndexedDB]
  → UI re-render
```

### 3.2 Auth Flow (unchanged)

```
LoginForm.tsx
     │
     ▼
AuthContext.login(email, password)
     │
     ├─► POST /api/v1/auth/login → JWT token
     │
     ├─► cryptoService: fetch key backup → decrypt → restore keys
     │
     ├─► POST /api/v1/users/me/key-backup (re-upload)
     │
     ├─► localStorage.setItem('authToken', token)
     │
     └─► WebSocketService.connect(userId, token)
              │
              └─► WS /ws/{userId}?token={jwt}
```

### 3.3 Platform Detection Flow (new — mobile-specific)

```
App startup
     │
     ▼
import { Capacitor } from '@capacitor/core'
     │
     ├─ Capacitor.isNativePlatform() === true
     │       │
     │       └─► Use MemoryRouter
     │           Register back button listener
     │           Register resume listener (WS reconnect)
     │           Register appUrlOpen listener (deep links)
     │
     └─ Capacitor.isNativePlatform() === false
             │
             └─► Use BrowserRouter (web / PWA)
```

---

## 4. Capacitor Native Bridge Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Android App                         │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │              MainActivity.java                │  │
│  │         (Capacitor auto-generated)            │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                              │
│  ┌────────────────────▼──────────────────────────┐  │
│  │              WebView                           │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │          React App (compiled JS)         │ │  │
│  │  │                                          │ │  │
│  │  │  All existing src/ code runs here        │ │  │
│  │  │  Vite-compiled bundle served from        │ │  │
│  │  │  android/app/src/main/assets/public/     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Capacitor Plugin Bridge              │   │
│  │                                              │   │
│  │  JS call → Bridge → Java plugin → OS API    │   │
│  │                                              │   │
│  │  @capacitor/camera  → Android Camera API    │   │
│  │  @capacitor/keyboard → InputMethodManager   │   │
│  │  @capacitor/status-bar → Window flags        │   │
│  │  @capacitor/app      → ActivityLifecycle    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 5. PWA Architecture

```
Browser / PWA Install
         │
         ▼
┌─────────────────────────────┐
│  Vite Build Output (dist/)  │
│                             │
│  index.html                 │
│  assets/ (JS, CSS)          │
│  manifest.webmanifest ← new │
│  sw.js ← new (Workbox)      │
└──────────┬──────────────────┘
           │
           ▼
    Service Worker
    ┌──────────────────────────────────┐
    │  Cache Strategy (Workbox)        │
    │                                  │
    │  App Shell → CacheFirst          │
    │  API calls → NetworkFirst        │
    │  Media     → StaleWhileRevalidate│
    │  WebSocket → (bypass SW)         │
    └──────────────────────────────────┘
```

---

## 6. Folder Architecture Decision

The key architectural decision is: **do we merge Capacitor into the existing `src/` or keep it separate?**

**Decision: Integrate Capacitor at the project root, keep `src/` unchanged.**

```
messsaging-app/
├── src/                    ← UNCHANGED (web + mobile shared)
│   └── lib/
│       └── platform/       ← NEW: thin platform abstraction
│           ├── index.ts    ← re-exports based on Capacitor.isNativePlatform()
│           ├── camera.ts   ← web impl (input type=file)
│           └── cameraNative.ts ← Capacitor impl
├── android/                ← GENERATED by Capacitor
├── capacitor.config.ts     ← NEW
├── vite.config.ts          ← MODIFIED (add PWA plugin)
└── public/
    └── manifest.webmanifest ← NEW
```

---

## 7. Component Architecture for Mobile Navigation

**Current (web-only):**
```
Chat.tsx
  ├── Sidebar.tsx (always visible, left panel)
  └── ChatWindow.tsx (right panel)
```

**Mobile (responsive adaptation — no Ionic rewrite needed):**
```
Chat.tsx
  ├── (mobile) Sidebar.tsx shown as slide-over panel
  │            triggered by hamburger button
  └── ChatWindow.tsx (full screen on mobile)
```

This uses the existing `use-mobile.tsx` hook (`src/components/hooks/use-mobile.tsx`) which already detects mobile viewport. The layout switches via Tailwind responsive classes — **no Ionic components required** for basic mobile layout.

Use Ionic components only when you need:
- `IonTabBar` (bottom navigation tabs)
- `IonBackButton` (native-feel back navigation)
- `IonRefresher` (pull-to-refresh)
- `IonInfiniteScroll` (virtualised infinite scroll for messages)

---

## 8. Security Architecture (unchanged on mobile)

The E2E encryption architecture is fully preserved on mobile:

```
Device A (Android)                    Device B (Android/Web)
     │                                        │
     │  ECDH P-256 keypair                    │  ECDH P-256 keypair
     │  Private key: IndexedDB                │  Private key: IndexedDB
     │  Public key:  server DB                │  Public key:  server DB
     │                                        │
     └──── Encrypted with B's public key ────►│
           + sender_encrypted_content          │
           (encrypted with A's own key)        │
                                              │
                                    Decrypt with B's private key
```

IndexedDB is available inside Capacitor WebView on Android — no changes needed to `cryptoService.ts`.

---

## 9. Build Pipeline Overview

```
Development (web):
  npm run dev → Vite dev server :8080 → browser

Development (Android):
  npm run build → dist/ → npx cap sync → Android Studio → device/emulator

Production (Android):
  npm run build → dist/ → npx cap sync → Android Studio → signed AAB → Play Store

Production (PWA):
  npm run build → dist/ (includes sw.js + manifest) → deploy to hosting
```

---

## 10. Architecture Invariants (Non-negotiable)

1. `src/lib/cryptoService.ts` is never modified for mobile — Web Crypto API works in Capacitor WebView.
2. `src/context/AuthContext.tsx` and `src/context/ChatContext.tsx` are not modified for mobile.
3. All API calls go to the same FastAPI backend — no mobile-specific backend endpoints.
4. WebSocket communication is unchanged — `ws://` or `wss://` works identically in WebView.
5. Dexie/IndexedDB is the single source of truth for local message cache — no SQLite plugin needed.
6. Platform detection (`Capacitor.isNativePlatform()`) is the only conditional ever added to shared code.
