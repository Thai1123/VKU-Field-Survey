# VKU Field Survey — Offline Facility Inspection PWA

Offline-first tool for campus facility inspectors and student auditors to
audit classroom equipment, projectors, AC units, and electrical fixtures in
basements and remote buildings with no Wi-Fi/4G/5G coverage.

Stack: **Vite + React + TypeScript**, **IndexedDB** (`idb`), a hand-written
**Service Worker** (Cache-First app shell + Background Sync), and
**Capacitor** for the native Android build.

## 1. Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

To exercise the full offline → online sync flow locally, also run the mock
backend in a second terminal (dev server already proxies `/api` to it):

```bash
npm run mock-server   # http://localhost:4000, 10% simulated failures
```

Try it: open the app, turn off Wi-Fi (or use DevTools → Network → Offline),
fill in a few inspections, go back online, and watch the **Hàng đợi** (Queue)
tab flip records from "Chờ đồng bộ" → "Đã đồng bộ" automatically.

## 2. How each requirement is implemented

| Spec | Where |
|---|---|
| `manifest.json`, standalone, theme `#0284c7`, 192/512 icons | `vite.config.ts` (`VitePWA({ manifest: ... })`), icons in `public/icons/` |
| Cache-First app shell, sub-second offline boot | `src/sw.ts` via `precacheAndRoute(self.__WB_MANIFEST)` (Workbox precaching = cache-first for build assets) |
| Multi-step form (Building/Floor/Room/Category/Rating/Notes/Photo) | `src/components/InspectionForm.tsx` |
| Real-time IndexedDB draft persistence | `src/lib/db.ts` + debounced `saveRecord()` call in `InspectionForm.tsx` |
| UUID + timestamp + `PENDING_SYNC` tagging | `src/lib/uuid.ts`, `src/lib/types.ts` |
| `online` event + Background Sync, sequential dispatch | `src/hooks/useNetworkStatus.ts` (`online` listener, `requestSync`), `src/sw.ts` (`sync` event), `src/lib/sync.ts` (sequential loop, stops on first failure) |
| `@capacitor/camera` native capture | `src/components/PhotoCapture.tsx` (native path), falls back to `<input capture>` in browser |
| `@capacitor/network` status monitoring | `src/hooks/useNetworkStatus.ts` (native branch) |
| Android APK packaging | `capacitor.config.ts` + steps below |

## 3. Build the Android APK

This sandbox has no Android SDK, so the APK step must run on your machine
with Android Studio installed.

```bash
npm run build              # produces dist/
npx cap add android        # scaffolds the android/ project (first time only)
npx cap sync                # copies dist/ + plugins into android/
npx cap open android        # opens Android Studio
```

In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**, or from
the CLI:

```bash
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

Camera permissions are auto-merged into `android/app/src/main/AndroidManifest.xml`
by the `@capacitor/camera` plugin during `cap sync`.

## 4. Known trade-offs / follow-ups

- **Background Sync API** isn't supported on iOS Safari or some WebViews —
  `useNetworkStatus.ts`'s `online` listener is the guaranteed fallback path,
  so sync still fires even without it.
- Photos are kept as `Blob`s in IndexedDB (not base64) to avoid bloating
  storage; they're base64-encoded only at the moment of the sync POST.
- The mock server (`server/index.js`) randomly fails 10% of requests so you
  can see `SYNC_ERROR`/retry behavior — remove that check for a real backend.
- Swap `API_ENDPOINT` in `src/lib/sync.ts` for your real inspection API.
