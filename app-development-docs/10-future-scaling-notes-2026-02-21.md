# 10 — Future Scaling Notes
**Date:** 2026-02-21
**Author:** Engineering Team
**Project:** QuChat — Long-term Architecture Roadmap
**Status:** Planning document

---

## 1. Adding iOS Support

iOS support via Capacitor is straightforward once Android is working. The React code doesn't change — only the native shell differs.

### 1.1 Prerequisites

- A Mac with macOS 13+ (Xcode only runs on Mac)
- Xcode 15+ installed from App Store
- Apple Developer Program membership ($99/year)
- The same `capacitor.config.ts` you have for Android works for iOS

### 1.2 Add iOS Platform

```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios   # Opens Xcode
```

### 1.3 iOS-Specific Differences

| Area | Android | iOS | Action needed |
|------|---------|-----|--------------|
| App ID format | `com.quchat.app` | `com.quchat.app` | Same |
| Signing | Keystore | Apple Developer cert + provisioning profile | New in Xcode |
| Back navigation | Hardware back button | Swipe-from-left gesture | No code change (Capacitor handles) |
| Keyboard handling | `@capacitor/keyboard` | Same | No change |
| Status bar | `@capacitor/status-bar` | Same | No change |
| Safe areas | Same CSS env() | Same | No change |
| Store | Play Store | App Store Connect | Different process |
| Minimum OS | Android 6.0 (API 23) | iOS 14+ | Set in Xcode |

### 1.4 iOS-Specific Code Paths (Minimal)

The only iOS-specific code you might add:

```typescript
// capacitor.config.ts — iOS splash screen path
SplashScreen: {
  launchShowDuration: 2000,
  iosSplashResourceName: 'Splash',  // Add this
}
```

```typescript
// src/index.css — iOS momentum scrolling
-webkit-overflow-scrolling: touch;  // Add to scrollable containers
```

### 1.5 iOS Timeline

If Android is working, iOS takes approximately:
- 1 day to get running in Xcode simulator
- 1 day for UI polish (iOS design conventions)
- 1 day for TestFlight submission and testing
- 1–7 days for App Store review

---

## 2. Adding Native Features (Priority Order)

### 2.1 Push Notifications (High Priority — V2)

Push notifications let QuChat deliver messages when the app is backgrounded. Without this, users miss messages unless they open the app.

**Required services:**
- Firebase Cloud Messaging (FCM) — Android
- Apple Push Notification Service (APNs) — iOS
- A backend endpoint to store device tokens and send pushes

**Implementation steps:**
1. `npm install @capacitor/push-notifications`
2. Create Firebase project → download `google-services.json` → add to `android/app/`
3. Add FCM backend: `POST /api/v1/notifications/register-token`, `POST /api/v1/notifications/send`
4. In `AuthContext.tsx`, register FCM token after login
5. In `relay_service.py`, trigger push notification when message is stored for offline user

**Architecture impact:**
- Backend gets a new `device_tokens` table: `user_id`, `token`, `platform`, `last_seen`
- `relay_service.py` calls FCM API when storing offline messages
- Frontend registers token and handles notification tap (deep link into conversation)

### 2.2 Background Sync (Medium Priority — V2)

When the app is backgrounded, new messages should arrive silently and be available when the user returns.

**On Android:** Use FCM data messages (silent push) to wake the app and sync.
**On iOS:** Same via APNs background app refresh.

This requires the push notification infrastructure from 2.1 to be in place first.

### 2.3 Native Camera (Medium Priority — V2)

The current media upload uses HTML file input which works but provides a worse UX than a native camera sheet.

**Already designed** in `src/lib/platform/media.native.ts` (see document 07).

```bash
npm install @capacitor/camera
npx cap sync
```

The `mediaFactory.ts` pattern means no other files change.

### 2.4 Biometric Authentication (Optional — V3)

Allow users to unlock the app with fingerprint/Face ID instead of re-entering password.

```bash
npm install capacitor-biometric-authentication
```

Implementation: after successful biometric auth, retrieve JWT from secure storage and restore session — instead of the login form.

```bash
npm install @capacitor/preferences  # Secure key-value storage
```

### 2.5 File Download / Save to Device (Medium Priority — V2)

Currently users can view media in the app but cannot save it to their photo gallery.

```bash
npm install @capacitor/filesystem @capacitor/gallery
```

Add a "Save to gallery" button in `MediaPreview.tsx` that uses the native filesystem plugin when on Android.

### 2.6 Share Sheet Integration (Low Priority — V3)

Allow sharing messages or media via Android/iOS share sheet.

```bash
npm install @capacitor/share
```

```typescript
import { Share } from '@capacitor/share';

await Share.share({
  title: 'Shared from QuChat',
  text: message.content,
  dialogTitle: 'Share via',
});
```

---

## 3. How to Scale the Architecture

### 3.1 Moving to Feature-Based Folder Structure

As the app grows beyond messaging (groups, channels, voice, etc.), the current `components/chat/` monolith will become unwieldy. When you have > 3 major feature areas, migrate to feature-based structure:

```
src/
  features/
    messaging/
      components/
        ChatWindow.tsx
        MessageInput.tsx
        MessageBubble.tsx
      hooks/
        useMessages.ts
        useMessageSend.ts
      services/
        messageService.ts   (moved from lib/)
      types.ts
    contacts/
      components/
        ContactList.tsx
        AddContactDialog.tsx
      hooks/
        useContacts.ts
      types.ts
    groups/
      ...
    auth/
      ...
  shared/
    components/ui/  (shadcn — unchanged)
    lib/            (crypto, websocket, platform — unchanged)
    context/        (global state — unchanged)
    types/          (global types — unchanged)
```

**Trigger for this migration:** When any single feature folder exceeds 10 files.

### 3.2 State Management Evolution

The current React Context approach works well for a single-screen app. As complexity grows:

**Stay on Context until you hit these pain points:**
- Prop drilling > 3 levels deep
- Context re-renders causing visible performance issues
- Multiple developers working on the same context file simultaneously

**When to migrate:**
- Add Zustand (not Redux — simpler, more React-like) for client state.
- Keep TanStack Query for server state — it's already excellent.
- Keep `AuthContext` as-is (small, focused).
- Migrate `ChatContext` internals to Zustand stores if it grows > 300 lines.

```bash
npm install zustand
```

Migration is gradual — Zustand stores work alongside Context.

### 3.3 API Layer Evolution

Current approach: raw `fetch()` calls scattered through Context and services.

**When the API surface grows to > 20 endpoints**, centralise with a typed API client:

```typescript
// src/lib/api/client.ts
import ky from 'ky';  // npm install ky

export const api = ky.create({
  prefixUrl: ENV.API_URL,
  hooks: {
    beforeRequest: [
      request => {
        const token = localStorage.getItem('authToken');
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      }
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          // Handle token expiry
        }
      }
    ],
  },
});
```

This centralises auth headers, error handling, and base URL — currently spread across multiple files.

### 3.4 Testing Infrastructure

Current: no tests. Add tests in this order as the team grows:

**Phase 1 (add now):**
```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom
```

Prioritise testing:
1. `cryptoService.ts` — encryption logic is high-risk if broken
2. `relayClient.ts` — message delivery logic
3. `AuthContext` — login flow
4. Platform factory functions

**Phase 2 (add at V2):**
- Playwright for E2E tests (runs against web app)
- Mock Service Worker (`msw`) for API mocking in tests

**Phase 3 (when team > 3 engineers):**
- Maestro for native mobile E2E tests (works with Capacitor)

### 3.5 WebSocket Scaling (Backend)

Current: single FastAPI server, WebSocket connections in memory.

**Scaling problem:** If you run multiple backend instances (horizontal scaling), WebSocket connections are not shared between instances. User A connects to instance 1, User B to instance 2 — they can't message each other.

**Solution when you need to scale:**
- Add Redis Pub/Sub as the WebSocket message broker
- Each backend instance subscribes to Redis channels for its connected users
- `relay_service.py` publishes to Redis instead of looking up in-memory connections

```python
# backend/app/services/ws_broker.py (future)
import aioredis

redis = aioredis.from_url("redis://localhost")

async def publish_message(user_id: str, message: dict):
    await redis.publish(f"user:{user_id}", json.dumps(message))

async def subscribe_to_user(user_id: str, websocket: WebSocket):
    async with redis.subscribe(f"user:{user_id}") as channel:
        async for message in channel.iter():
            await websocket.send_json(json.loads(message))
```

**Trigger for this migration:** When you need > 1 backend server instance (> ~5,000 concurrent WebSocket users on a single server).

---

## 4. Avoiding Technical Debt

### 4.1 Keep `platform/` Clean

The `src/lib/platform/` folder is your debt firewall. As long as all native code lives here, the rest of the codebase stays clean. The rule is absolute: **zero `Capacitor.*` imports outside of `platform/`, `hooks/useAppLifecycle.ts`, and `App.tsx`.**

Enforce this with an ESLint rule:
```json
// .eslintrc
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [{
        "name": "@capacitor/core",
        "message": "Import from @/lib/platform instead of using Capacitor directly"
      }]
    }]
  },
  "overrides": [{
    "files": ["src/lib/platform/**", "src/hooks/useAppLifecycle.ts", "src/App.tsx"],
    "rules": { "no-restricted-imports": "off" }
  }]
}
```

### 4.2 Keep `android/` in Git but Review Carefully

The `android/` folder should be committed to Git because:
- `AndroidManifest.xml` contains your permissions configuration
- `build.gradle` contains your version code
- Custom Java/Kotlin code (if added) must be versioned

But never manually edit files under `android/app/src/main/assets/public/` — those are generated.

### 4.3 Version Code Management

Never forget to increment `versionCode` before a Play Store release. Automate it:

```bash
# scripts/bump-version.sh
VERSION_CODE=$(grep versionCode android/app/build.gradle | awk '{print $3}')
NEW_VERSION=$((VERSION_CODE + 1))
sed -i "s/versionCode $VERSION_CODE/versionCode $NEW_VERSION/" android/app/build.gradle
echo "Bumped versionCode from $VERSION_CODE to $NEW_VERSION"
```

### 4.4 Keep Web and Mobile in Sync

The single biggest source of technical debt in cross-platform apps is **divergence** — where a bug is fixed on web but not mobile, or a feature ships on mobile but breaks web.

Prevention:
1. Always run `npm run dev` (web) after every change before doing an Android build.
2. CI/CD should build both web and Android on every PR.
3. Never test only on one platform.

### 4.5 Capacitor Version Pinning

Pin your Capacitor version in `package.json` and don't upgrade opportunistically:

```json
"@capacitor/core": "6.1.2",    // pinned, not "^6.x.x"
"@capacitor/android": "6.1.2", // must match @capacitor/core exactly
"@capacitor/cli": "6.1.2",     // must match @capacitor/core exactly
```

Capacitor minor versions sometimes change plugin APIs. Only upgrade when you have time to test thoroughly.

---

## 5. Roadmap Summary

```
V1 (Current sprint)
  ✅ Capacitor integration
  ✅ Android debug build
  ✅ MemoryRouter for mobile
  ✅ Safe areas + keyboard handling
  ✅ PWA manifest + service worker
  ✅ Play Store release build

V2 (Next quarter)
  ⬜ Push notifications (FCM + APNs)
  ⬜ Native camera integration
  ⬜ File download to device gallery
  ⬜ iOS Xcode project
  ⬜ TestFlight submission
  ⬜ App Store submission
  ⬜ E2E tests (Playwright)

V3 (Future)
  ⬜ Biometric unlock
  ⬜ Share sheet integration
  ⬜ Feature-based folder structure migration
  ⬜ Zustand for complex state (if needed)
  ⬜ Redis WebSocket broker (if scaling to multiple servers)
  ⬜ Desktop app via Electron or Tauri (same React codebase)
  ⬜ Maestro mobile E2E tests
```

---

## 6. Decision Log (For Future Reference)

| Decision | Chosen | Rejected | Reason |
|----------|--------|---------|--------|
| Mobile wrapper | Capacitor | React Native | No rewrite; same web tech |
| UI framework | shadcn/ui + selective Ionic | Full Ionic UI rewrite | 95% code reuse |
| Routing (mobile) | MemoryRouter | HashRouter | Cleaner URL-less navigation |
| Local storage | IndexedDB (Dexie) | SQLite plugin | Already implemented; works in WebView |
| State management | React Context + TanStack Query | Redux / Zustand | Sufficient for current size |
| E2E crypto | Web Crypto API | Native crypto plugin | Works in WebView; no change needed |
| Build tool | Vite | Create React App / Webpack | Already in use; fastest HMR |
| PWA generator | vite-plugin-pwa + Workbox | Manual SW | Best-in-class Vite integration |
