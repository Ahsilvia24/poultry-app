# App Store Connect checklist — PoultryTech

App: **PoultryTech** · Bundle ID `com.poultrytech.app` · ASC App ID `6794784343`  
TestFlight: https://appstoreconnect.apple.com/apps/6794784343/testflight/ios

## Latest binary

| Field | Value |
|-------|-------|
| Version | 1.0.9 |
| Build | **133** (EAS auto-increment from 132; this session’s UI: Propagate, house catch time, LFO keypad/Manual, dashboard catch date/time, one Import, Export off Tools/More) |
| Status | EAS production iOS build + ASC submit in progress |

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

Contact email on both pages is **talentpro024@gmail.com**.

`https://ahsilvia24.github.io/poultry-app/privacy/` redirects to the TermsFeed policy.

## Screenshots

Repo asset for the 13" iPad slot (2064×2752 Service Report UI preview):

- `docs/app-store/ipad-13-service-report.png`

Upload that under App Preview and Screenshots → 13" iPad (or replace with a live device capture if you prefer).
Also fill iPhone screenshots if not already set.

## Device QA after build 133 installs

- [ ] Log Temp on house tiles → value shows → Service Report prefills → clears after midnight
- [ ] Visit tile tap → edit → View/Edit checklist → Save / Share PDF
- [ ] Comments heading stays visible while typing
- [ ] Compact litter/ammonia and Heat/Cool grids
- [ ] P.H. labels have no “(optional)”
- [ ] Service Report page 2 mortality / house numbers look correct
- [ ] Dashboard has one Import card; Tools and More have no Export data
- [ ] Upcoming catches: date without year, catch time immediately to the right
- [ ] Expanded house tile: catch time under catch date
- [ ] Propagate checkbox is left of the label
- [ ] LFO Manual tab: type bird count, save, newest LFO on top
- [ ] LFO Daily water / Head count opens integer keypad (no decimal)
