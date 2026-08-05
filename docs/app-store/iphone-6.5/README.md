# iPhone 6.5" App Store assets

## Screenshots (10) — **1284 × 2778** PNG

Upload under App Store Connect → App Preview and Screenshots → **iPhone 6.5" Display**.

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

Also valid screenshot sizes for this slot: 1242×2688, 2688×1242, 2778×1284.

## App Previews (3) — **886 × 1920** MP4

Apple’s accepted **preview** size for 6.5"/6.9" is **886×1920**, not the screenshot size.

| Spec | Value |
|------|--------|
| Resolution | 886 × 1920 (portrait), SAR 1:1 |
| Codec | H.264 High Profile Level 4.0 |
| Bitrate | ~10 Mbps (Apple target 10–12) |
| Audio | Stereo AAC 44.1 kHz |
| Length | 15–30 seconds |
| Container | `.mp4` |

| # | File | Length | Flow |
|---|------|--------|------|
| 1 | `previews/preview-01-today-schedule.mp4` | ~18s | Dashboard schedule → farm |
| 2 | `previews/preview-02-mortality-logging.mp4` | ~16s | Farms → mortality entry |
| 3 | `previews/preview-03-tools-reports.mp4` | ~16s | Tools → reports → LFO |

### Why earlier uploads failed

App Store Connect rejects preview videos encoded at screenshot dimensions (e.g. 1284×2778) or with non‑1 sample aspect ratio / High@L5.x. Re-upload these 886×1920 files. If ASC shows a vague “network … try again” toast, wait a minute and retry — that message is often a failed validation, not an actual network drop.

## Regenerate

With Postgres + `npm run dev` running and seed data loaded:

```bash
npx playwright install chromium   # once
node scripts/capture-app-store-assets.mjs
```

Requires `ffmpeg`.
