# App Store Connect checklist — PoultryTech

App: **PoultryTech** · Bundle ID `com.poultrytech.app` · ASC App ID `6794784343`  
TestFlight: https://appstoreconnect.apple.com/apps/6794784343/testflight/ios

## Latest binary

| Field | Value |
|-------|-------|
| Version | 1.0.5 |
| Build | **88** (submitted to ASC 2026-07-31) |
| Status | EAS building → auto-submit to TestFlight when finished |
| EAS build | https://expo.dev/accounts/poultry-team/projects/poultry-team/builds/16ccd72a-3f1a-42ea-93e0-0320275e4561 |
| EAS submit | https://expo.dev/accounts/poultry-team/projects/poultry-team/submissions/35450d52-5539-42f1-aa2c-4586dc27dae0 |

## Paste into App Store listing

| Field | Value |
|-------|-------|
| Copyright | `2026 Alex Silvia` |
| Primary category | **Business** |
| Secondary category | Productivity |
| Age rating | All answers None / No → **4+** |
| Content rights | Yes, I own or have rights; no third-party content that needs clearance |

## Privacy & Support URLs

| ASC field | URL |
|-----------|-----|
| **Privacy Policy URL** | https://www.termsfeed.com/live/1e9fa9a7-3483-4186-88be-3eb0aab6c4c5 |
| Support URL | Still needed — use `docs/support.html` on a host you control, or email-based support page |

Repo fallbacks (optional):

- `docs/privacy.html` / `docs/support.html`
- Next.js app routes `/privacy` and `/support` (public, no login)

## Screenshots

Repo asset for the 13" iPad slot (2064×2752 Service Report UI preview):

- `docs/app-store/ipad-13-service-report.png`

Upload that under App Preview and Screenshots → 13" iPad (or replace with a live device capture if you prefer).
Also fill iPhone screenshots if not already set.

## Device QA after build 88 installs

- [ ] Dashboard: farm name only; issues badge (Normal / N issues); no Backup/Export
- [ ] Farm History: swipe left to delete completed flocks
- [ ] Placement scroll not stuck at blank bottom; min-vent recommended clear of bottom line
- [ ] Service Report PDF: water column shows prefilled `4-6`
- [ ] Log Temp → Service Report prefills → clears after midnight
- [ ] Visit edit → View/Edit checklist + Share PDF under it
- [ ] P.H. labels have no “(optional)”
- [ ] Service Report page 2 mortality / house numbers look correct
