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

Paste these into App Store Connect → App Information:

| ASC field | URL |
|-----------|-----|
| **Privacy Policy URL** | https://www.termsfeed.com/live/c019d958-bfad-4ce8-8ab4-afbb983092ab |
| **Support URL** | https://ahsilvia24.github.io/poultry-app/support/ |

Contact email on both pages should be **talentpro024@gmail.com**.

### Update the TermsFeed privacy email (one-time)
1. Open [TermsFeed](https://www.termsfeed.com/) and sign in
2. Open your PoultryTech Privacy Policy → **Live Editor** / Edit
3. Change the Contact email from `Alexsilvia24@yahoo.com` to `talentpro024@gmail.com`
4. Save — the same live URL above will show the new email

`https://ahsilvia24.github.io/poultry-app/privacy/` redirects to the TermsFeed policy.

## Screenshots

Repo asset for the 13" iPad slot (2064×2752 Service Report UI preview):

- `docs/app-store/ipad-13-service-report.png`

Upload that under App Preview and Screenshots → 13" iPad (or replace with a live device capture if you prefer).
Also fill iPhone screenshots if not already set.

## Device QA after build 83 installs

- [ ] Log Temp on house tiles → value shows → Service Report prefills → clears after midnight
- [ ] Visit tile tap → edit → View/Edit checklist → Save / Share PDF
- [ ] Comments heading stays visible while typing
- [ ] Compact litter/ammonia and Heat/Cool grids
- [ ] P.H. labels have no “(optional)”
- [ ] Service Report page 2 mortality / house numbers look correct
