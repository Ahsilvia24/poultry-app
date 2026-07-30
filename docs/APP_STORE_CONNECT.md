# App Store Connect checklist — PoultryTech

App: **PoultryTech** · Bundle ID `com.poultrytech.app` · ASC App ID `6794784343`  
TestFlight: https://appstoreconnect.apple.com/apps/6794784343/testflight/ios

## Latest binary

| Field | Value |
|-------|-------|
| Version | 1.0.5 |
| Build | **83** (submitted to ASC 2026-07-30) |
| Status | Processing → install from TestFlight when ready |

## Paste into App Store listing

| Field | Value |
|-------|-------|
| Copyright | `2026 Alex Silvia` |
| Primary category | **Business** |
| Secondary category | Productivity |
| Age rating | All answers None / No → **4+** |
| Content rights | Yes, I own or have rights; no third-party content that needs clearance |

## Privacy & Support URLs

Static pages live in this repo:

- `docs/privacy.html`
- `docs/support.html`

Also available in the Next.js app at `/privacy` and `/support` (public, no login).

**Recommended for ASC** (use a host you control long-term):

1. Deploy the web app (or just these two HTML files) to your domain / Vercel / Netlify.
2. Set:
   - Privacy Policy URL → `https://YOUR_DOMAIN/privacy` (or `/privacy.html`)
   - Support URL → `https://YOUR_DOMAIN/support` (or `/support.html`)

Temporary tunnel (only while this cloud agent session is up):

- Privacy: `https://southeast-ate-freeware-length.trycloudflare.com/privacy.html`
- Support: `https://southeast-ate-freeware-length.trycloudflare.com/support.html`

## Screenshots still needed in ASC

- 13" iPad (2064×2752) — capture from Simulator or device and upload under App Preview and Screenshots.
- iPhone screenshots if not already filled.

## Device QA after build 83 installs

- [ ] Log Temp on house tiles → value shows → Service Report prefills → clears after midnight
- [ ] Visit tile tap → edit → View/Edit checklist → Save / Share PDF
- [ ] Comments heading stays visible while typing
- [ ] Compact litter/ammonia and Heat/Cool grids
- [ ] P.H. labels have no “(optional)”
- [ ] Service Report page 2 mortality / house numbers look correct
