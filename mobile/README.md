# PoultryTech Mobile (Expo)

Native iOS/Android app for farm visits. Uses Expo Go for on-device testing.

## Prerequisites

1. Backend running on your Mac (port 3000, reachable on LAN)
2. [Expo Go](https://expo.dev/go) installed on your phone
3. Phone and Mac on the **same Wi‑Fi**

## Configure API URL

Edit [`src/config.ts`](src/config.ts) and set your Mac’s LAN IP:

```ts
export const API_BASE_URL = "http://192.168.0.79:3000";
```

Find your IP: System Settings → Network, or `ipconfig getifaddr en0`.

## Run

Terminal 1 — API (from `poultry-app/`):

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Terminal 2 — Expo (from `poultry-app/mobile/`):

```bash
npm start
```

Scan the QR code with:
- **iPhone:** Camera app → opens Expo Go
- **Android:** Expo Go → Scan QR code

## Demo login

- Email: `tech@poultry.local`
- Password: `password123`

## App Store / Play Store builds (later)

True store installs need an Expo EAS build and developer accounts:

```bash
npx eas-cli login
npx eas build --platform ios
npx eas build --platform android
```

Until then, **Expo Go** is the download-and-run path for testing.
