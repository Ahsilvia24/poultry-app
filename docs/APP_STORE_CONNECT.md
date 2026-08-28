# App Store Connect checklist — PoultryTech

App: **PoultryTech** · Bundle ID `com.poultrytech.app` · ASC App ID `6794784343`  
TestFlight: https://appstoreconnect.apple.com/apps/6794784343/testflight/ios

Do **not** run EAS production iOS builds, `eas submit`, or TestFlight uploads unless explicitly asked.

## Latest binary

| Field | Value |
|-------|-------|
| Version | 1.0.9 |
| Build | Next store binary after 133 (bump with EAS when you ask to submit) |
| Status | 5.6 hidden-feature fixes in repo — wait for an explicit submit ask |

## Identity (keep these the same everywhere)

| Surface | Value |
|---------|-------|
| App name | PoultryTech |
| Operator | Alex Silvia |
| Support / privacy email | talentpro024@gmail.com |
| Copyright | 2026 Alex Silvia |

In [expo.dev](https://expo.dev) → poultry-team project → Settings, rename the project display name from **Bachoco Tecs** to **PoultryTech**. The iOS display name in `mobile/app.json` is already PoultryTech. The app is an independent technician tool, not a Bachoco product. Service-report PDF templates are used with permission.

## Paste into App Store listing

| Field | Value |
|-------|-------|
| Copyright | `2026 Alex Silvia` |
| Primary category | **Business** |
| Secondary category | Productivity |
| Age rating | All answers None / No → **4+** |
| Content rights | Yes — I have permission to use the service-report form templates included in the app |

## Privacy & Support URLs

Paste these into App Store Connect → App Information (replace the old TermsFeed URL):

| ASC field | URL |
|-----------|-----|
| **Privacy Policy URL** | https://ahsilvia24.github.io/poultry-app/privacy/ |
| **Support URL** | https://ahsilvia24.github.io/poultry-app/support/ |

Contact on both pages is **Alex Silvia**, **talentpro024@gmail.com**.

GitHub Pages publishes those files from `docs/privacy.html` and `docs/support.html` after they land on `main`.

## App Review notes (paste into the submission)

PoultryTech is an offline farm-management tool for independent poultry service technicians. It is published by Alex Silvia. It is not a Bachoco app.

Demo access for review (not shown in the app UI):

- Email: `tech@poultry.local`
- Password: `password123`

Sign-in fields ship empty. There is no remote feature flag, no account-gated extra mode, and no content loaded after approval. All farm data stays in on-device SQLite.

Reports is a visible tab. Export is on the Dashboard under Export. Import offers Placement and Catch Schedule only. The previous TermsFeed privacy URL was a generator page that did not describe this app; the live policy is https://ahsilvia24.github.io/poultry-app/privacy/

## Resolution Center reply for guideline 5.6 (paste)

Hello App Review,

Thank you for the 5.6 note. Nothing in PoultryTech is account-gated or remotely unlocked after approval. The pattern you saw was leftover navigation: Reports and More were registered as tabs with `href: null` (hidden from the tab bar), Export existed in the binary after we removed it from Tools, and login was pre-filled with a demo account.

In this version:

- Reports is a visible tab
- The unused More screen is removed
- Export is on the Dashboard, next to Import
- Sign-in fields are empty (demo credentials are only in these notes)
- App Transport Security no longer allows arbitrary HTTP loads
- The Privacy Policy URL is our own page and matches what the app actually collects

PoultryTech is an independent technician tool operated by Alex Silvia (talentpro024@gmail.com), not a Bachoco product. We have permission to use the service-report form templates.

Please let us know if you need anything else.

Respectfully,
Alex Silvia

## Screenshots

Repo asset for the 13" iPad slot (2064×2752 Service Report UI preview):

- `docs/app-store/ipad-13-service-report.png`

Upload that under App Preview and Screenshots → 13" iPad (or replace with a live device capture if you prefer).
Also fill iPhone screenshots if not already set.

## Device QA after the next store build installs

- [ ] Login fields are empty (no demo email/password on screen)
- [ ] Reports is a visible bottom tab
- [ ] There is no More tab
- [ ] Dashboard shows Import (Placement / Catch only) and Export
- [ ] Privacy URL in App Store Connect is the GitHub Pages policy, not TermsFeed
- [ ] Log Temp on house tiles → value shows → Service Report prefills → clears after midnight
- [ ] Visit tile tap → edit → View/Edit checklist → Save / Share PDF
