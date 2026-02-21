# 05 — Android App Build Process
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat — Android Build Pipeline
**Status:** Reference guide

---

## 1. How Capacitor Builds an Android App

Capacitor does **not** compile your React code to native Java/Kotlin. Instead:

```
React Code (TypeScript)
       │
       ▼
  npm run build
       │
       ▼
  dist/          ← compiled JS + CSS + HTML
       │
       ▼
  npx cap sync
       │
       ▼
  android/app/src/main/assets/public/  ← copied here
       │
       ▼
  Android Studio → Gradle build
       │
       ▼
  app-debug.apk  OR  app-release.aab
       │
       ▼
  WebView loads index.html from assets
  React app runs inside WebView
  Capacitor bridge provides native APIs
```

Your React code runs in **Chromium WebView** — the same engine as Chrome. No transpilation to Java occurs.

---

## 2. Understanding the Android Project Structure

After `npx cap add android`, this folder is created:

```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── AndroidManifest.xml      ← permissions, intent filters, app metadata
│   │       ├── assets/
│   │       │   └── public/             ← YOUR COMPILED REACT APP (auto-copied by cap sync)
│   │       │       ├── index.html
│   │       │       └── assets/         ← JS, CSS
│   │       ├── java/
│   │       │   └── com/quchat/app/
│   │       │       └── MainActivity.java ← auto-generated, rarely touched
│   │       └── res/
│   │           ├── drawable/           ← app icons
│   │           ├── mipmap-*/           ← adaptive icons
│   │           ├── values/             ← colors, strings, styles
│   │           └── xml/               ← Capacitor config
│   └── build.gradle                   ← app-level Gradle config (versionCode etc.)
├── build.gradle                       ← project-level Gradle config
├── gradle.properties                  ← Gradle flags (jetifier, AndroidX)
└── capacitor.settings.gradle          ← Capacitor plugin references (auto-managed)
```

**Files you will edit:**
- `android/app/build.gradle` — version code, version name, min SDK
- `android/app/src/main/AndroidManifest.xml` — permissions, deep links
- `android/app/src/main/res/` — icons, splash screen images

---

## 3. Debug Build

A debug build is unsigned and for development only. It runs on any device in developer mode.

```bash
# Step 1: Build React app
npm run build

# Step 2: Sync to Android
npx cap sync android

# Step 3: Build debug APK (from project root)
npx cap run android
# OR open Android Studio and press the green Run button

# The APK is at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

**Install debug APK manually:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Live reload during development (no rebuild needed):**

1. Start Vite dev server: `npm run dev`
2. In `capacitor.config.ts`, temporarily set:
   ```typescript
   server: {
     url: 'http://YOUR_LAN_IP:8080',  // e.g. 192.168.1.5:8080
     cleartext: true,
   }
   ```
3. Run: `npx cap run android`
4. App loads from your live Vite server — changes reflect without rebuilding.
5. Remove `server.url` before making a release build.

---

## 4. Release Build

Release builds are signed and required for Play Store distribution.

### 4.1 Generate a Keystore (one-time, keep it safe!)

```bash
keytool -genkey -v \
  -keystore quchat-release.keystore \
  -alias quchat \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Answer the prompts. Save the keystore file in a **secure location outside the repo**. Never commit to Git.

### 4.2 Configure Signing in `android/app/build.gradle`

```gradle
// android/app/build.gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "../quchat-release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: "your_store_password"
            keyAlias System.getenv("KEY_ALIAS") ?: "quchat"
            keyPassword System.getenv("KEY_PASSWORD") ?: "your_key_password"
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false   // Set to true once you test ProGuard rules
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

Using environment variables for credentials is best practice — do not hardcode passwords.

### 4.3 Version Code and Version Name

Every Play Store release must increment `versionCode`. Update in `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        applicationId "com.quchat.app"
        minSdk 23              // Android 6.0 — covers 98%+ of devices
        targetSdk 34           // Android 14 (latest)
        versionCode 1          // Integer — must increment for each release
        versionName "1.0.0"    // Human-readable semver
    }
}
```

### 4.4 Build Signed AAB (Android App Bundle)

AAB is the format required by the Play Store (smaller than APK, Play Store optimises per device).

**In Android Studio:**
1. Build → Generate Signed Bundle / APK
2. Select Android App Bundle
3. Select your keystore
4. Select Release build type
5. Output: `android/app/release/app-release.aab`

**From command line:**
```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 5. Play Store Preparation

### 5.1 App Listing Requirements

| Asset | Size | Format |
|-------|------|--------|
| App icon | 512×512px | PNG (no alpha) |
| Feature graphic | 1024×500px | PNG or JPG |
| Screenshots (phone) | Min 2, max 8 | JPEG or PNG, 320–3840px |
| Short description | Max 80 chars | Text |
| Full description | Max 4000 chars | Text |

### 5.2 Content Rating

Complete the content rating questionnaire in the Play Console. For a messaging app, you will likely receive an "Everyone" or "Teen" rating.

### 5.3 Privacy Policy

Required for any app that handles user data. Your app handles:
- User accounts (email, password hash)
- Messages (encrypted)
- Media files

Create a privacy policy page and link it in the Play Console.

### 5.4 Target API Level

Google Play requires apps to target API level 33+ (as of 2023) and 34+ (as of 2024). Set:
```gradle
targetSdk 34
```

---

## 6. Icons and Splash Screens

### 6.1 Icons

Capacitor uses adaptive icons for Android 8.0+.

Install the asset generation tool:
```bash
npm install --save-dev @capacitor/assets
```

Prepare source images:
```
assets/
  icon-only.png     ← 1024×1024px (foreground of adaptive icon)
  icon-background.png ← 1024×1024px (background color/image)
  splash.png        ← 2732×2732px
  splash-dark.png   ← 2732×2732px (dark mode variant)
```

Generate all sizes automatically:
```bash
npx capacitor-assets generate --android
```

This writes to `android/app/src/main/res/mipmap-*/` and `android/app/src/main/res/drawable-*/`.

### 6.2 Splash Screen

```bash
npm install @capacitor/splash-screen
npx cap sync android
```

Configure in `capacitor.config.ts`:
```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,        // ms to show splash
    launchAutoHide: true,
    backgroundColor: '#ffffff',
    androidSplashResourceName: 'splash',
    showSpinner: false,
  },
}
```

To hide the splash screen programmatically (after app is ready):
```typescript
import { SplashScreen } from '@capacitor/splash-screen';

// In AuthContext or App.tsx after initial auth check completes
SplashScreen.hide();
```

---

## 7. Permissions

### 7.1 Current Permissions Required

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <!-- Required: network access for API + WebSocket -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

  <!-- For media upload (camera + gallery) -->
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
  <!-- Android 13+ uses granular media permissions -->
  <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
  <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

  <!-- For downloading media to device -->
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />

  <!-- Push notifications (add when implementing FCM) -->
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

  <application ...>
```

### 7.2 Runtime Permission Request

For Camera and Storage, request at runtime using Capacitor Camera plugin:
```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const requestPermissions = async () => {
  const permissions = await Camera.requestPermissions();
  if (permissions.camera === 'granted') {
    // proceed
  }
};
```

---

## 8. Debugging on Android

### 8.1 Chrome Remote DevTools

Since the app runs in a WebView, you can use Chrome DevTools to debug it:

1. Connect device via USB with USB Debugging enabled.
2. Open Chrome on desktop and go to `chrome://inspect`.
3. Under "Remote Targets", find your app's WebView.
4. Click Inspect — opens a full DevTools panel for your React app.
5. You get: Console, Network, Sources, Elements, Performance — full DevTools.

### 8.2 Logcat

For native Android logs:
```bash
adb logcat | grep Capacitor   # Capacitor bridge messages
adb logcat | grep chromium    # WebView errors
```

### 8.3 Common Debug Scenarios

| Symptom | Investigation |
|---------|--------------|
| White screen | `chrome://inspect` → Console tab for JS errors |
| API calls failing | Network tab → check request headers, CORS errors |
| WebSocket not connecting | Console tab → WS connection errors |
| Crypto errors | Console → look for `cryptoService` error messages |
| App crashes on launch | Logcat → look for `FATAL EXCEPTION` |

---

## 9. Build Automation (CI/CD)

For automated builds using GitHub Actions:

```yaml
# .github/workflows/android-build.yml
name: Android Build

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with: { node-version: 18 }

      - uses: actions/setup-java@v3
        with: { java-version: 17, distribution: temurin }

      - name: Install deps
        run: npm ci

      - name: Build React app
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL }}

      - name: Cap sync
        run: npx cap sync android

      - name: Build AAB
        run: cd android && ./gradlew bundleRelease
        env:
          KEYSTORE_PATH: ${{ secrets.KEYSTORE_PATH }}
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}

      - name: Upload AAB
        uses: actions/upload-artifact@v3
        with:
          name: app-release.aab
          path: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 10. Build Checklist

Before each release:

- [ ] `server.url` removed from `capacitor.config.ts` (no dev server pointing)
- [ ] `npm run build` uses production env variables
- [ ] `versionCode` incremented in `android/app/build.gradle`
- [ ] `versionName` updated to match semver
- [ ] Signed with release keystore (not debug)
- [ ] Tested on at least one physical device
- [ ] Tested on Android 9 (API 28) for minimum support baseline
- [ ] `chrome://inspect` checked — no console errors
- [ ] App permissions reviewed in AndroidManifest.xml
- [ ] AAB file uploaded to Play Console internal testing track first
