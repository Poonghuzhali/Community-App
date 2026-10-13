# Building the Android APK

Two paths. **A (EAS cloud)** is the fastest — no Android SDK on your machine. **B (local Gradle)** works fully offline.

Before either path: the app must point at a reachable API. Pick one:

| Where | How |
| --- | --- |
| `mobile/app.json` → `expo.extra.apiUrl` | Edit the value (current placeholder: `http://192.168.1.5:4000`) |
| `mobile/.env` → `EXPO_PUBLIC_API_URL=...` | Read at **bundle time** — must exist when you build, not after |
| Test device on the same Wi-Fi | Use your machine's LAN IP, not `localhost` (the phone resolves `localhost` to itself) |

> The server must be reachable from the phone for the login screen to work. For a demo outside the LAN, deploy the API (Render/Railway/Fly) and set that HTTPS URL.

---

## Option A — EAS Build (recommended)

```bash
cd mobile
npm install
npm install -g eas-cli

eas login                 # free Expo account
eas build:configure       # creates/validates eas.json (already committed)

# One-off APK you can install directly:
eas build -p android --profile preview

# Equivalent npm script:
npm run build:apk
```

- `preview` profile is configured with `buildType: "apk"` → the download is an **installable .apk**.
- `production` builds an `.aab` for the Play Store.
- First build takes ~10–15 min; later builds are cached and faster.
- When the URL changes, change `app.json`/`.env` and rebuild — `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time.

Install: copy the `.apk` to the phone → allow “Install from unknown sources” → open.

---

## Option B — Local Gradle (offline)

Prerequisites: **JDK 17**, Android Studio (SDK 34/35 + build-tools), `ANDROID_HOME` set.

```bash
cd mobile

# 1. Generate the android/ project from app.json (config plugins run here)
npx expo prebuild -p android

# 2. Optional: confirm the API URL made it into the bundle config
#    (or add it to android/app/src/main/res/values/strings.xml / .env)

# 3. Build
cd android
./gradlew assembleRelease          # macOS/Linux
gradlew.bat assembleRelease        # Windows
```

APK output:
`android/app/build/outputs/apk/release/app-release.apk`

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

Debug build instead: `./gradlew assembleDebug` → `app-debug.apk` (installs alongside Expo Go, points at the same JS).

Re-run `npx expo prebuild -p android --clean` whenever `app.json` changes (permissions, icons, package name).

---

## Option C — Dev client without a build

For day-to-day development you do not need an APK at all:

```bash
cd mobile
npm start        # scan the QR with Expo Go (SDK 53)
```

Expo Go is limited to the APIs Expo ships; the production APK is needed for release testing of camera/notifications behaviour with custom builds.

---

## Build checklist

- [ ] `expo.extra.apiUrl` (or `EXPO_PUBLIC_API_URL`) points at a **reachable** host for the demo device.
- [ ] Server is running: `curl http://<host>:4000/health` returns `{"success":true,...}`.
- [ ] `npx expo install --check` → *Dependencies are up to date*.
- [ ] `npm run lint` → 0 syntax errors.
- [ ] `npx expo export -p android` bundles cleanly (proves all imports resolve).
- [ ] Icons/splash present in `mobile/assets/` (regenerate: `node scripts/generate-assets.js`).
- [ ] Login tested with the seeded numbers (`9000000001` admin / `9000000002` security / `9000000003` resident, OTP `123456`).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Login hangs / network error | Phone cannot reach the API — use the machine's LAN IP, allow Node through the firewall (port 4000), same Wi-Fi. |
| `expo-asset could not be found` | `npx expo install expo-asset` (transitive dependency of `@expo/vector-icons`). |
| `gradlew.bat` not found | `android/` doesn't exist → run `npx expo prebuild -p android`. |
| Icon/splash missing at build | Re-run `node scripts/generate-assets.js`; paths must stay `./assets/*.png`. |
| Camera permission prompt missing | Config plugin is declared in `app.json`; rebuild (not hot-reload) after changing plugins. |
| Push notifications never arrive | Expected without Firebase creds — the in-app feed still works (`server/.env` → `FCM_*`). |
