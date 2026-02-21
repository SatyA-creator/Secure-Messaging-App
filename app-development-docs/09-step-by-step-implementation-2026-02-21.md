# 09 — Step-by-Step Implementation Checklist
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat — Mobile Conversion
**Status:** Implementation guide (beginner-friendly)

---

## How to Use This Document

Work through each phase in order. Each step has:
- A clear command or action
- Expected output so you know it worked
- Common failure and how to fix it

Do not skip steps. Each builds on the last.

---

## Prerequisites Checklist

Before starting Phase 1, verify all of these:

- [ ] Node.js 18+ installed: `node --version`
- [ ] npm 9+ installed: `npm --version`
- [ ] Android Studio installed (download from developer.android.com/studio)
- [ ] Android SDK API 34 installed (via Android Studio → SDK Manager)
- [ ] Java 17 installed: `java --version`
- [ ] `ANDROID_HOME` environment variable set
- [ ] At least one AVD (Android Virtual Device) created in Android Studio
- [ ] Git working copy is clean: `git status` shows nothing to commit

---

## Phase 1 — Project Setup (Day 1, Morning)

### Step 1.1 — Backup Current State

```bash
git add -A && git commit -m "chore: pre-mobile-conversion checkpoint"
git checkout -b feature/mobile-capacitor
```

**Expected output:** New branch created. This protects you — you can always return to `main`.

---

### Step 1.2 — Install Capacitor

```bash
cd "F:/Intersnhip project/messsaging-app"

npm install @capacitor/core @capacitor/app @capacitor/keyboard @capacitor/status-bar
npm install --save-dev @capacitor/cli @capacitor/android
```

**Expected output:** Dependencies added to `package.json`. No errors.

**Common failure:** `EACCES permission denied` → run as administrator or fix npm permissions.

---

### Step 1.3 — Initialise Capacitor

```bash
npx cap init
```

Answer the prompts:
- **App Name:** `QuChat`
- **App ID:** `com.quchat.app`
- **Web Dir:** `dist`

**Expected output:** `capacitor.config.ts` created in project root.

---

### Step 1.4 — Configure `capacitor.config.ts`

Open `capacitor.config.ts` and replace its contents with the configuration from **document 04, Step 4**. Key settings:
- `appId: 'com.quchat.app'`
- `webDir: 'dist'`
- `androidScheme: 'https'`
- `StatusBar` and `Keyboard` plugin configs

---

### Step 1.5 — Add Android Platform

```bash
npx cap add android
```

**Expected output:** `android/` folder created. Message: `✔ Adding native android project in android/`

**Expected directory created:**
```
android/
  app/
  build.gradle
  gradle.properties
  capacitor.settings.gradle
```

**Common failure:** `Could not find ANDROID_HOME` → set the environment variable and restart terminal.

---

### Step 1.6 — First Build and Sync Test

```bash
npm run build
npx cap sync android
```

**Expected output:**
```
✔ Copying web assets from dist to android/app/src/main/assets/public
✔ Updating Android plugins
✔ update android  in 1.23s
```

If `dist/` doesn't exist yet (build failed), fix TypeScript errors first.

---

## Phase 2 — React Code Updates (Day 1, Afternoon)

### Step 2.1 — Update `index.html` Viewport

Open `index.html` and change the viewport meta tag:

**Before:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

**After:**
```html
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0" />
<meta name="theme-color" content="#ffffff" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="QuChat" />
```

---

### Step 2.2 — Add Safe Area CSS

Open `src/index.css` and add at the top:

```css
:root {
  --safe-area-inset-top:    env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left:   env(safe-area-inset-left, 0px);
  --safe-area-inset-right:  env(safe-area-inset-right, 0px);
}
```

---

### Step 2.3 — Install Ionic React

```bash
npm install @ionic/react ionicons
```

Open `src/main.tsx` and add at the very top of the imports:

```typescript
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import { setupIonicReact } from '@ionic/react';

setupIonicReact({ mode: 'md' });
```

---

### Step 2.4 — Update `src/App.tsx` Router

Open `src/App.tsx`.

Find the existing `<BrowserRouter>` import and usage.

**Add these imports:**
```typescript
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
```

**Add this constant before the App component:**
```typescript
const AppRouter = Capacitor.isNativePlatform() ? MemoryRouter : BrowserRouter;
```

**Inside the App component, add this `useEffect`:**
```typescript
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  const back = CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else CapApp.exitApp();
  });

  const resume = CapApp.addListener('resume', () => {
    console.log('[App] resumed');
    // wsService.reconnect() — add when you import wsService
  });

  return () => {
    back.then(h => h.remove());
    resume.then(h => h.remove());
  };
}, []);
```

**Replace `<BrowserRouter>` with `<AppRouter>` in the JSX.**

**Verify:** The web app still works perfectly: `npm run dev` → open browser → log in → send messages.

---

### Step 2.5 — Create Platform Abstraction Layer

Create the directory and files:

```bash
mkdir -p src/lib/platform
```

Create `src/lib/platform/index.ts`:
```typescript
import { Capacitor } from '@capacitor/core';

export const platform = {
  isNative: () => Capacitor.isNativePlatform(),
  isAndroid: () => Capacitor.getPlatform() === 'android',
  isIOS: () => Capacitor.getPlatform() === 'ios',
  isWeb: () => Capacitor.getPlatform() === 'web',
  isPWA: () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches,
} as const;
```

Create `src/lib/platform/media.web.ts` and `src/lib/platform/media.native.ts` and `src/lib/platform/mediaFactory.ts` as shown in **document 07, Section 3.1**.

---

### Step 2.6 — Create Hooks Folder

```bash
mkdir -p src/hooks
```

Create `src/hooks/useAppLifecycle.ts` as shown in **document 07, Section 7**.

Add to `src/App.tsx`:
```typescript
import { useAppLifecycle } from '@/hooks/useAppLifecycle';

// Inside App component:
useAppLifecycle();
```

---

### Step 2.7 — Build and Verify

```bash
npm run build
```

**Expected:** No TypeScript errors. `dist/` folder created.

If there are TypeScript errors, fix them before continuing — they will crash the Android app.

---

## Phase 3 — First Android Run (Day 1, Evening)

### Step 3.1 — Sync to Android

```bash
npx cap sync android
```

### Step 3.2 — Open Android Studio

```bash
npx cap open android
```

Android Studio opens. Wait for Gradle sync to complete (bottom bar shows "Gradle sync finished").

**First sync takes 3–10 minutes** — it downloads Gradle dependencies. Subsequent syncs take ~30 seconds.

### Step 3.3 — Start Emulator or Connect Device

Option A (Emulator):
- In Android Studio: Device Manager (right toolbar) → select an AVD → click Play button

Option B (Physical device):
- Enable Developer Options and USB Debugging on your Android phone
- Connect via USB
- Android Studio detects the device automatically

### Step 3.4 — Run the App

In Android Studio, select your device from the device dropdown and click the green ▶ Run button.

**Expected result:** QuChat launches on your device/emulator. You should see the login screen.

### Step 3.5 — Test Basic Functionality

- [ ] App launches without crashing
- [ ] Login screen appears
- [ ] Enter credentials → logs in
- [ ] Contacts list loads
- [ ] Select a contact → chat opens
- [ ] Type a message → sends successfully
- [ ] Receive a message (send from another browser tab)
- [ ] Hardware back button works (returns to contacts list)

### Step 3.6 — Check for Errors

On desktop: open Chrome → `chrome://inspect` → find your app's WebView → click Inspect → check Console for errors.

**Common errors at this stage:**

| Error | Fix |
|-------|-----|
| `ERR_CLEARTEXT_NOT_PERMITTED` | Your API URL is HTTP not HTTPS. Add `android:usesCleartextTraffic="true"` to AndroidManifest.xml for dev only, or use HTTPS |
| CORS error | Add `capacitor://localhost` to backend `CORS_ORIGINS` |
| White screen | JS crash — check Chrome DevTools console |
| "authToken" not found | localStorage is fresh — log in again (different origin from web) |

---

## Phase 4 — PWA Setup (Day 2, Morning)

### Step 4.1 — Install vite-plugin-pwa

```bash
npm install --save-dev vite-plugin-pwa
```

### Step 4.2 — Update `vite.config.ts`

Add the VitePWA plugin as shown in **document 06, Section 4**. The key section to add:

```typescript
import { VitePWA } from 'vite-plugin-pwa';

// In plugins array, add:
VitePWA({
  registerType: 'autoUpdate',
  manifest: { /* ... as shown in doc 06 ... */ },
  workbox: { /* ... as shown in doc 06 ... */ },
})
```

### Step 4.3 — Create PWA Icons

Create `public/icons/` directory. Add icon PNG files at sizes: 72, 96, 128, 144, 192, 512px.

If you don't have a logo yet, use a placeholder temporarily — the PWA will still work, just with a default icon.

Quick placeholder (requires ImageMagick):
```bash
magick convert -size 512x512 xc:#4F46E5 -fill white -font Arial -pointsize 80 -gravity center -annotate 0 "QC" public/icons/icon-512x512.png
# Resize to other sizes as needed
```

### Step 4.4 — Update `main.tsx` for SW Registration

Add at the end of `src/main.tsx`:
```typescript
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onNeedRefresh() {
    // Optional: show a "Update available" toast
    console.log('[SW] New version available');
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
});
```

You may need to add to `tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "types": ["vite-plugin-pwa/client"]
  }
}
```

### Step 4.5 — Build and Test PWA

```bash
npm run build
npm run preview
```

Open `http://localhost:4173` in Chrome. Open DevTools → Lighthouse → run PWA audit.

Install the app: Chrome will show an install icon in the address bar, or you can use the DevTools → Application → Service Workers to verify.

---

## Phase 5 — UI Polish for Mobile (Days 3–4)

### Step 5.1 — Test Chat Layout on Mobile Screen

In Chrome DevTools, enable mobile device simulation (iPhone 14 / Pixel 7). Check:
- [ ] Sidebar is accessible on small screens
- [ ] Chat input is not covered by keyboard
- [ ] Messages are readable (font size ≥ 16px)
- [ ] Touch targets are ≥ 44×44px
- [ ] Status bar doesn't overlap content

### Step 5.2 — Fix Sidebar Layout for Mobile

Open `src/pages/Chat.tsx` and `src/components/chat/Sidebar.tsx`.

The existing `use-mobile.tsx` hook detects if viewport is < 768px. Use it to toggle between:
- Desktop: sidebar always visible (current behaviour)
- Mobile: sidebar as slide-over / modal drawer

Add a hamburger button to `ChatWindow.tsx` header (mobile only) that toggles sidebar visibility. Use Tailwind classes for the responsive behaviour.

### Step 5.3 — Keyboard Overlap Fix

Install keyboard plugin:
```bash
npm install @capacitor/keyboard
npx cap sync android
```

Create `src/hooks/useKeyboard.ts`:
```typescript
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export const useKeyboard = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const show = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.then(h => h.remove());
      hide.then(h => h.remove());
    };
  }, []);

  return keyboardHeight;
};
```

Use in `MessageInput.tsx`:
```typescript
const keyboardHeight = useKeyboard();

return (
  <div style={{ paddingBottom: keyboardHeight }}>
    {/* existing content */}
  </div>
);
```

### Step 5.4 — Status Bar Setup

```bash
npm install @capacitor/status-bar
npx cap sync android
```

In `src/App.tsx` inside the lifecycle `useEffect`:
```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#ffffff' });
}
```

### Step 5.5 — Add Splash Screen

```bash
npm install @capacitor/splash-screen @capacitor/assets
npx cap sync android
```

Create source icons (see **document 05, Section 6**) and run:
```bash
npx capacitor-assets generate --android
```

Update `capacitor.config.ts` SplashScreen config (see **document 04, Step 4**).

---

## Phase 6 — Release Build Preparation (Day 5)

### Step 6.1 — Generate Release Keystore

```bash
keytool -genkey -v \
  -keystore quchat-release.keystore \
  -alias quchat \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**SAVE THE KEYSTORE AND PASSWORDS IN A PASSWORD MANAGER.** If you lose them, you cannot update your app on the Play Store.

### Step 6.2 — Configure Signing

Edit `android/app/build.gradle` as shown in **document 05, Section 4.2**.

### Step 6.3 — Set Version Code and Name

In `android/app/build.gradle`:
```gradle
versionCode 1
versionName "1.0.0"
```

### Step 6.4 — Generate Icons

Create icon source files in `assets/` and run:
```bash
npx capacitor-assets generate --android
```

### Step 6.5 — Production Build

```bash
# Ensure no dev server URL in capacitor.config.ts
npm run build
npx cap sync android
```

In Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle → follow wizard.

**Output:** `android/app/release/app-release.aab`

### Step 6.6 — Final Testing Checklist

- [ ] Install via `adb install` on physical device (release build)
- [ ] Test cold start (first launch)
- [ ] Test login with real credentials
- [ ] Send and receive messages (real-time)
- [ ] Test with airplane mode → enable → messages deliver
- [ ] Test media upload (photo)
- [ ] Test back button navigation
- [ ] Test app resume after 5 minutes background
- [ ] Check `chrome://inspect` — no console errors
- [ ] Check Logcat — no crashes

---

## Phase 7 — Deploy

### Step 7.1 — Web Deploy (unchanged)

```bash
npm run build
# Deploy dist/ to Vercel / Netlify / your existing hosting
```

### Step 7.2 — PWA (same dist/)

Same `dist/` from web deploy includes manifest and service worker. Users on your domain can install as PWA automatically.

### Step 7.3 — Android Play Store

1. Create Google Play Developer account ($25 one-time fee)
2. Create a new app in Play Console
3. Upload `app-release.aab` to internal testing track
4. Complete content rating questionnaire
5. Add store listing (screenshots, description)
6. Publish to internal testing → test with 10 users
7. Promote to production when ready

---

## Quick Command Reference

```bash
# Development
npm run dev                          # Web dev server
npx cap run android                  # Build + sync + run on Android device

# Build
npm run build                        # Production build (web + PWA + Android source)
npx cap sync android                 # Sync web build to Android

# Android
npx cap open android                 # Open Android Studio
adb devices                          # List connected devices
adb install app-debug.apk            # Install debug APK
adb logcat | grep -E "Capacitor|chromium" # View relevant logs

# PWA
npm run preview                      # Preview production build locally
# Run Lighthouse in Chrome DevTools for PWA score

# Release
cd android && ./gradlew bundleRelease  # Build release AAB from CLI
```
