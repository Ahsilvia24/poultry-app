# iPhone 6.5" App Store assets

Pixel size: **1284 × 2778** (portrait) — accepted for App Store Connect iPhone 6.5"/6.7" slots  
(also valid alternatives: 1242×2688, 2688×1242, 2778×1284).

## Screenshots (10)

| # | File | Screen |
|---|------|--------|
| 1 | `screenshots/01-dashboard.png` | Today's schedule dashboard |
| 2 | `screenshots/02-farms.png` | Farms list |
| 3 | `screenshots/03-farm-detail.png` | Farm detail (River Bend) |
| 4 | `screenshots/04-mortality.png` | Mortality entry |
| 5 | `screenshots/05-lfo.png` | Last Feed Order |
| 6 | `screenshots/06-tools.png` | Tools / Temp Curve |
| 7 | `screenshots/07-reports.png` | Reports filters |
| 8 | `screenshots/08-settlement.png` | Settlement |
| 9 | `screenshots/09-history.png` | Farm history |
| 10 | `screenshots/10-settings.png` | Settings |

## App Previews (3)

| # | File | Length | Flow |
|---|------|--------|------|
| 1 | `previews/preview-01-today-schedule.mp4` | ~18s | Dashboard schedule → farm |
| 2 | `previews/preview-02-mortality-logging.mp4` | ~16s | Farms → mortality entry |
| 3 | `previews/preview-03-tools-reports.mp4` | ~16s | Tools → reports → LFO |

Format: H.264 MP4, 30 fps, no audio, 1284×2778.

## Regenerate

With Postgres + `npm run dev` running and seed data loaded:

```bash
node scripts/capture-app-store-assets.mjs
```

Requires Playwright Chromium (`npx playwright install chromium`) and `ffmpeg`.
