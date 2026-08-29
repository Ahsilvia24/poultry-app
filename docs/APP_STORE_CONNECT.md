# App Store Connect checklist — PoultryTech

App: **PoultryTech** · Bundle ID `com.poultrytech.app` · ASC App ID `6794784343`  
TestFlight: https://appstoreconnect.apple.com/apps/6794784343/testflight/ios

Do **not** run EAS production iOS builds, `eas submit`, or TestFlight uploads unless explicitly asked.

## Latest binary

| Field | Value |
|-------|-------|
| Version | 1.0.9 |
| Build | Next store binary after 133 (bump with EAS when you ask to submit) |
| Status | 5.6 + 4.2 quality polish in repo — wait for an explicit submit ask |

## Identity (keep these the same everywhere)

| Surface | Value |
|---------|-------|
| App name (home screen / listing) | PoultryTech |
| Expo project display name | Poultry Tech |
| Operator | Alex Silvia |
| Support / privacy email | talentpro024@gmail.com |
| Copyright | 2026 Alex Silvia |

The expo.dev project is already **Poultry Tech** (no longer Bachoco Tecs). The iOS display name in `mobile/app.json` stays **PoultryTech** — that is the name under the icon and in App Store Connect. The app is an independent technician tool, not a Bachoco product. Service-report PDF templates are used with permission.

## Paste into App Store listing

| Field | Value |
|-------|-------|
| Copyright | `2026 Alex Silvia` |
| Primary category | **Business** |
| Secondary category | Productivity |
| Age rating | All answers None / No → **4+** |
| Devices | **iPhone only** (`supportsTablet` is false — do not list iPad) |
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

Reports is a visible tab. There is no phone-data export or backup-import feature. Import offers Placement and Catch Schedule only. Sample farms are included so Review can exercise the product; they are not labeled as demo or unfinished. The previous TermsFeed privacy URL was a generator page that did not describe this app; the live policy is https://ahsilvia24.github.io/poultry-app/privacy/

This binary is iPhone-only. We are not claiming iPad support.

## Resolution Center reply for guideline 5.6 (paste)

Hello App Review,

Thank you for the 5.6 note. Nothing in PoultryTech is account-gated or remotely unlocked after approval. The pattern you saw was leftover navigation: Reports and More were registered as tabs with `href: null` (hidden from the tab bar), Export existed in the binary after we removed it from Tools, and login was pre-filled with a demo account.

In this version:

- Reports is a visible tab
- The unused More screen is removed
- Phone-data export and web backup import are removed from the app
- Sign-in fields are empty (demo credentials are only in these notes)
- App Transport Security no longer allows arbitrary HTTP loads
- The Privacy Policy URL is our own page and matches what the app actually collects

PoultryTech is an independent technician tool operated by Alex Silvia (talentpro024@gmail.com), not a Bachoco product. We have permission to use the service-report form templates.

Please let us know if you need anything else.

Respectfully,
Alex Silvia

## Screenshots

Listing is **iPhone only**. Fill iPhone screenshots. Do not upload iPad screenshots for this binary (`ios.supportsTablet` is false).

A 13" iPad preview still lives at `docs/app-store/ipad-13-service-report.png` if iPad support is added later.

## Device QA after the next store build installs

- [ ] Login shows PoultryTech, empty email/password (no demo credentials on screen)
- [ ] Reports is a visible bottom tab
- [ ] There is no More tab
- [ ] Dashboard shows Import (Placement / Catch only) and no Export
- [ ] Tools → Cool Cells: no Big Bird title or subtitle above the first table
- [ ] Farm list includes Triple Place (not “Triple Place Demo”); visit notes are not “Offline demo visit”
- [ ] Add Farm name field placeholder is “Farm name”, not a sample farm
- [ ] Privacy URL in App Store Connect is the GitHub Pages policy, not TermsFeed
- [ ] Log Temp on house tiles → value shows → Service Report prefills → clears after midnight
- [ ] Visit tile tap → edit → View/Edit checklist → Save / Share PDF
- [ ] App Store Connect listing is iPhone-only (no iPad availability)
- [ ] Mortality keypad ⌫ at day 0 deletes the last digit (does not get stuck)
- [ ] Empty LFO keypad ⌫ or scroll dismisses the keypad so tabs come back
- [ ] Swiping a second farm/LFO/house row closes the first swipe action
