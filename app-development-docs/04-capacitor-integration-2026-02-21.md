# 04 — Capacitor + React Integration
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat — Capacitor Setup
**Status:** Implementation guide

---

## Prerequisites

Before starting:
- Node.js 18+ installed
- Android Studio installed with SDK (API 33+)
- `ANDROID_HOME` environment variable set
- Java 17+ installed (required by Gradle)
- An Android device or emulator configured

Verify:
```bash
node --version          # 18+
npx cap --version       # should work after install
echo $ANDROID_HOME      # should print SDK path
java --version          # 17+
```

---

## Step 1 — Install Ionic React (Selective)

We are NOT doing a full Ionic conversion. We install Ionic React only to access its mobile-optimised components when needed.

```bash
# From project root: F:\Intersnhip project\messsaging-app
npm install @ionic/react @ionic/react-router ionicons
```

Then add the required CSS to `src/main.tsx` or `index.html`:

```typescript
// src/main.tsx — add at the top
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
// Optional (only if you use Ionic layout utilities):
// import '@ionic/react/css/padding.css';
// import '@ionic/react/css/flex-utils.css';
```

Initialize Ionic in `src/main.tsx`:

```typescript
import { setupIonicReact } from '@ionic/react';

setupIonicReact({
  mode: 'md',  // Always use Material Design (Android style) even on iOS
});
```

**Important:** You do NOT need to wrap your app in `<IonApp>` or use `<IonPage>`. Your existing layout structure remains.

---

## Step 2 — Install Capacitor Core

```bash
# Install Capacitor core and CLI
npm install @capacitor/core
npm install --save-dev @capacitor/cli

# Install essential plugins immediately (you will use all of these)
npm install @capacitor/app @capacitor/keyboard @capacitor/status-bar
```

---

## Step 3 — Initialise Capacitor

```bash
npx cap init
```

This will prompt for:
- **App name:** `QuChat`
- **App ID:** `com.quchat.app` (reverse-domain format — use your own domain)
- **Web dir:** `dist` (this is where Vite outputs the build)

This creates `capacitor.config.ts` in the project root.

---

## Step 4 — Configure `capacitor.config.ts`

Replace the generated file with this production-ready configuration:

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quchat.app',
  appName: 'QuChat',
  webDir: 'dist',

  server: {
    // For LOCAL DEVELOPMENT ONLY: point to your Vite dev server
    // Remove for production builds
    // url: 'http://192.168.1.x:8080',  // your machine's LAN IP
    // cleartext: true,
    androidScheme: 'https',  // keeps content:// URLs working
  },

  plugins: {
    // Status bar configuration
    StatusBar: {
      style: 'dark',       // 'dark' = dark icons on light background
      backgroundColor: '#ffffff',
    },

    // Keyboard configuration
    Keyboard: {
      resize: 'body',      // Resize body element when keyboard shows
      style: 'dark',
      resizeOnFullScreen: true,
    },

    // Splash screen (configure after adding @capacitor/splash-screen)
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
```

**Development live-reload config (comment out for production):**

When you want to develop with live reload on a real device, uncomment the `server.url` and point it to your machine's LAN IP address running `npm run dev`. The device must be on the same WiFi network.

---

## Step 5 — Add Android Platform

```bash
npm install @capacitor/android
npx cap add android
```

This creates the `android/` folder (a full Gradle project). **Do not manually edit files inside `android/` unless instructed** — Capacitor manages most of it.

---

## Step 6 — Modify `src/App.tsx` for Mobile Routing

Open `src/App.tsx` and change `BrowserRouter` to be platform-aware:

```typescript
// src/App.tsx
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';

// ...existing imports...

const AppRouter = Capacitor.isNativePlatform() ? MemoryRouter : BrowserRouter;

const App = () => {
  // Handle Android hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    // Reconnect WebSocket when app resumes from background
    const resumeHandler = CapApp.addListener('resume', () => {
      // wsService.reconnect() — import and call your WebSocket service here
      console.log('[App] Resumed from background');
    });

    return () => {
      backHandler.then(h => h.remove());
      resumeHandler.then(h => h.remove());
    };
  }, []);

  return (
    <AppRouter>
      {/* All existing content unchanged */}
    </AppRouter>
  );
};
```

---

## Step 7 — Update `vite.config.ts` for Mobile Builds

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
    allowedHosts: [
      'kenny-nonnescient-superarrogantly.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok.io',
    ],
  },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Capacitor works best with ES modules
    target: 'esnext',
    // Increase chunk size warning limit (mobile bundles are larger)
    chunkSizeWarningLimit: 2000,
  },
}));
```

---

## Step 8 — Add Safe Area CSS

Add to your global stylesheet (likely `src/index.css`):

```css
/* Safe areas for mobile notches and gesture bars */
:root {
  --safe-area-inset-top:    env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left:   env(safe-area-inset-left, 0px);
  --safe-area-inset-right:  env(safe-area-inset-right, 0px);
}

.safe-top    { padding-top:    var(--safe-area-inset-top);    }
.safe-bottom { padding-bottom: var(--safe-area-inset-bottom); }
.safe-left   { padding-left:   var(--safe-area-inset-left);   }
.safe-right  { padding-right:  var(--safe-area-inset-right);  }
```

Update `index.html` viewport meta:
```html
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0" />
```

---

## Step 9 — First Build and Sync

```bash
# Build the React app
npm run build

# Sync build to Android project (copies dist/ to android/app/src/main/assets/public/)
npx cap sync android

# Open Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete (first time: 3–10 minutes, downloads dependencies).
2. Select your target device (physical device or AVD emulator).
3. Click the green ▶ Run button.

You should see your React app running inside Android.

---

## Step 10 — Handling Environment Variables for Mobile

### Problem
`import.meta.env.VITE_API_URL` is replaced at build time by Vite. There is no `.env` file on the Android device.

### Solution
Create environment-specific `.env` files:

```bash
# .env.production (used by npm run build)
VITE_API_URL=https://secure-messaging-app-backend.onrender.com/api/v1
VITE_WS_URL=wss://secure-messaging-app-backend.onrender.com

# .env.development (used by npm run dev)
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

For Android production builds: always run `npm run build` (not `build:dev`) before `npx cap sync`. This bakes in the production URL.

For Android development with live device: use the `server.url` option in `capacitor.config.ts` to point to your LAN dev server. No build needed — the device loads the live Vite server.

---

## Step 11 — Handling API URLs (CORS)

Your FastAPI backend needs to accept requests from the Capacitor app. Add to backend `.env`:

```bash
# backend/.env
CORS_ORIGINS=http://localhost,https://localhost,capacitor://localhost,http://localhost:8080,https://your-web-domain.com
```

In `backend/app/main.py`, ensure the CORS middleware reads from config:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # list from env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

The Android WebView uses `capacitor://localhost` as the page origin by default.

---

## Step 12 — Using Native Plugins

Pattern for every plugin: install → sync → use.

### Example: Handle keyboard resize (prevents chat input being hidden)

```bash
npm install @capacitor/keyboard
npx cap sync android
```

```typescript
// src/components/chat/MessageInput.tsx — add keyboard handling
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export const MessageInput = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showHandler = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
    });

    const hideHandler = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showHandler.then(h => h.remove());
      hideHandler.then(h => h.remove());
    };
  }, []);

  return (
    <div style={{ paddingBottom: keyboardHeight }}>
      {/* existing MessageInput JSX unchanged */}
    </div>
  );
};
```

### Example: StatusBar theming

```typescript
// src/App.tsx — add on mount
import { StatusBar, Style } from '@capacitor/status-bar';

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#ffffff' });
}, []);
```

---

## Step 13 — Run on Physical Device

1. Enable Developer Options on your Android device (tap Build Number 7 times in Settings → About).
2. Enable USB Debugging.
3. Connect via USB.
4. In Android Studio, select the device from the device dropdown.
5. Click Run.

Or from CLI:
```bash
npx cap run android --target <device-id>
# List connected devices:
adb devices
```

---

## Quick Reference — Capacitor Commands

| Command | What it does |
|---------|-------------|
| `npx cap init` | Initialise Capacitor in project |
| `npx cap add android` | Add Android platform (creates `android/` folder) |
| `npx cap sync` | Build must run first; copies dist/ + updates plugins |
| `npx cap sync android` | Same but only for Android |
| `npx cap copy android` | Copy dist/ without updating plugins |
| `npx cap open android` | Open Android Studio |
| `npx cap run android` | Build + sync + run on connected device |
| `npx cap update` | Update Capacitor plugins to match package.json |

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `SDK location not found` | `ANDROID_HOME` not set | Set env var to Android SDK path |
| White screen on device | API URL wrong (HTTP instead of HTTPS) | Use HTTPS or enable cleartext in manifest |
| `Not allowed to load local resource` | CORS issue | Add `capacitor://localhost` to CORS_ORIGINS |
| App crashes on launch | JS error in React app | Open Chrome DevTools → `chrome://inspect` → inspect WebView |
| Back button exits app immediately | MemoryRouter not set up | Ensure `canGoBack` check in backButton handler |
| `Gradle sync failed` | Old Gradle version | Update Gradle wrapper in Android Studio |
