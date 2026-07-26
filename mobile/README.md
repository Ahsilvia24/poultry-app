# PoultryTech Mobile (Offline-first)

Native iOS/Android app. **All farm data lives in SQLite on the phone** — no Mac server or internet required after install.

## What’s included (v1)

- Local login (demo account)
- Dashboard, Farms, house cards (Mort. / PHC / weekly / min vent)
- Mortality age grid + by-date entry
- LFO create / inventory
- Tools (temp curve, cool cells, lights, ventilation math)
- Reports (house × date matrix)
- Routine visit logging on farm detail

## Demo login

- Email: `tech@poultry.local`
- Password: `password123`

Demo farms (including **Bay View × 12 houses**) seed automatically on first launch.

## Develop on a simulator / device (Expo Go)

This project targets **Expo SDK 54**, which matches the current App Store **Expo Go**.

```bash
cd poultry-app/mobile
npm install --legacy-peer-deps
npx expo start
```

Scan the QR code with Expo Go on your phone (same Wi‑Fi), or press `i` for the iOS simulator.

> For a real offline installable app (own icon, no Expo Go), use an EAS build below after Apple Developer approval.

## Installable build (download to your phone)

### 1. Expo account

```bash
npm install -g eas-cli
cd poultry-app/mobile
eas login
eas init   # links this app to your Expo account and writes projectId into app.json
```

### 2. Android APK (easiest sideload)

```bash
eas build --platform android --profile preview
```

When the build finishes, open the link on your phone and install the APK.

### 3. iPhone (TestFlight)

Requires an [Apple Developer](https://developer.apple.com) account (~$99/yr).

**From Expo dashboard (phone-friendly):** open the project → **Workflows** → run **iOS TestFlight**  
(`.eas/workflows/ios-testflight.yml`). If you see “no workflows found”, make sure GitHub is connected and the project directory is set to `mobile`.

> Free Expo plan: the workflow uses `submit` (not the paid `testflight` job). After it finishes, the build still appears in TestFlight once App Store Connect finishes processing.

**Or build only, then submit from the build page:**

1. Run **Build iOS only**
2. Open the finished build on expo.dev → **Submit** / distribute to App Store Connect

**From a computer / SSH:**

```bash
cd poultry-app/mobile
eas workflow:run .eas/workflows/ios-testflight.yml
# or classic CLI:
eas build --platform ios --profile production --auto-submit
```

First time only, configure Apple credentials:

```bash
eas credentials --platform ios
```

### 4. Development client (for active coding)

```bash
eas build --platform android --profile development
# or
eas build --platform ios --profile development
```

Then `npx expo start --dev-client` and open the installed PoultryTech app.

## Offline behavior

- First launch creates the local DB and seeds demo data.
- Saves (mortality, LFO, visits) write only to the phone.
- UI shows **“Saved on this phone”** / **Offline**.
- Cloud sync with the Next.js web app is **not** in v1 (planned later).

## Project layout

| Path | Role |
|------|------|
| `src/db/` | SQLite open + schema + seed |
| `src/repos/data.ts` | Offline repositories |
| `src/lib/` | Mortality math + tools charts |
| `app/(tabs)/` | Screens |

## Troubleshooting

- **Blank / crash on launch:** Rebuild with EAS so `expo-sqlite` is in the native binary.
- **Want a clean demo again:** uninstall the app (wipes SQLite) and reinstall.
- **Peer dependency warnings:** use `npm install --legacy-peer-deps`.
