# App Store Connect checklist — PoultryTech

App: **PoultryTech** · Bundle ID `com.poultrytech.app` · ASC App ID `6794784343`  
TestFlight: https://appstoreconnect.apple.com/apps/6794784343/testflight/ios

## Latest binary

| Field | Value |
|-------|-------|
| Version | 1.0.6 |
| Build | **84** (pending EAS build → TestFlight) |
| Status | Waiting on Expo auth / EAS build |

## Paste into App Store listing

| Field | Value |
|-------|-------|
| Copyright | `2026 Alex Silvia` |
| Primary category | **Business** |
| Secondary category | Productivity |
| Age rating | All answers None / No → **4+** |
| Content rights | Yes, I own or have rights; no third-party content that needs clearance |

## Privacy & Support URLs

Paste these into App Store Connect → App Information:

| ASC field | URL |
|-----------|-----|
| **Privacy Policy URL** | Prefer the offline-accurate in-repo policy once published (see note below). Current ASC value: https://www.termsfeed.com/live/c019d958-bfad-4ce8-8ab4-afbb983092ab |
| **Support URL** | https://ahsilvia24.github.io/poultry-app/support/ |

Contact email on both pages is **talentpro024@gmail.com**.

**Privacy note for App Review:** The mobile app is offline-first and does **not** use camera, photos, contacts, or location. If the TermsFeed page still lists those, update App Privacy answers / the policy URL so they match the binary (or point ASC at a published copy of `src/app/privacy/page.tsx`). Mismatches can trigger Guideline 5.1.1 questions.

`https://ahsilvia24.github.io/poultry-app/privacy/` currently redirects to the TermsFeed policy.

## Screenshots

Repo asset for the 13" iPad slot (2064×2752 Service Report UI preview):

- `docs/app-store/ipad-13-service-report.png`

Upload that under App Preview and Screenshots → 13" iPad (or replace with a live device capture if you prefer).
Also fill iPhone screenshots if not already set.

## App Review notes (paste into ASC)

```
PoultryTech is an offline farm-management app for poultry service technicians.

Demo login (also prefilled on the Sign in screen):
Email: tech@poultry.local
Password: password123

On first launch the app seeds demo farms/houses automatically. No internet is required after install.

Suggested path for review:
1. Sign in with the demo account
2. Open Farms → pick a farm → open a house / Enter mortality
3. Use Dashboard, LFO, and Tools tabs
```

## Device QA after build 83 installs

- [ ] Log Temp on house tiles → value shows → Service Report prefills → clears after midnight
- [ ] Visit tile tap → edit → View/Edit checklist → Save / Share PDF
- [ ] Comments heading stays visible while typing
- [ ] Compact litter/ammonia and Heat/Cool grids
- [ ] P.H. labels have no “(optional)”
- [ ] Service Report page 2 mortality / house numbers look correct
