# Juvi — Play Store release kit

For the Android app `in.juvion.juvi`. Design: `docs/superpowers/specs/2026-10-12-juvi-play-store-release-design.md`.

## URLs the listing needs

- Privacy policy: `https://admin.juvion.in/privacy-policy`
- Account deletion: `https://admin.juvion.in/account-deletion.html`

## Store listing copy

**App name (≤30):** `Juvi`

**Short description (≤80):**
```
Notices, timetable, dues and academics for your college — in one app.
```

**Full description (≤4000):**
```
Juvi is your college's app for staying on top of what matters, without the notice board.

For students:
- See the notices you actually need, grouped and prioritised, with a clear list of what still
  needs your attention.
- Check today's timetable and any class changes.
- Follow your attendance and dues at a glance.

For faculty:
- See your teaching for the day and the notices from your office.
- Reach the students and groups you are responsible for.

Built for your institution:
- Sign in with your college roll number or employee code.
- Notifications respect your quiet hours and the tiers you choose.
- Available in English; your institution sets the app's colour to match its brand.

Juvi is provided by your college on the Juvion platform. Access requires an account issued by
your college.
```

**Release notes (internal testing, ≤500):**
```
First internal build: sign-in, notices and acknowledgement, Today, teaching, academics, dues,
notifications and account deletion.
```

## Assets to supply (Play's current specs)

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, ≤1 MB, no transparency | **provided** — `docs/juvi/playstore-icon.png` (512×512) |
| Feature graphic | 1024×500 PNG or JPEG | to supply |
| Phone screenshots | ≥2, each side 320–3840 px, 16:9 or 9:16 | to supply |
| (optional) 7-inch / 10-inch tablet screenshots | same rules | to supply |

The launcher icons inside the app (Android `mipmap-*` incl. the adaptive/round variants, iOS
`AppIcon.appiconset`) are already the Juvi brand icon; only the feature graphic and screenshots
above remain.

## Play Console walkthrough

1. **Create the app.** Console → All apps → Create app. Name `Juvi`, default language English (India),
   App, Free.
2. **Play App Signing.** Accept it (default for new apps). Google holds the app-signing key; the
   `upload-keystore.jks` key is only the upload key.
3. **App content** (Dashboard → App content):
   - Privacy policy URL: the policy URL above.
   - **Data safety**: answer from the table below.
   - Content rating questionnaire; target audience; ads = No; government app = No.
4. **Internal testing.** Testing → Internal testing → Create new release. Upload
   `mobile/build/app/outputs/bundle/release/app-release.aab`, add the tester emails, roll out.
5. **Confirm the developer display name** matches "Juvion" (the name used on the deletion page).

## Data safety answers (from docs/juvi/account-deletion-retention.md §Operator notes)

| Question | Answer |
|---|---|
| Data deleted on request? | Yes — in-app immediately; web request after a 7-day grace period. |
| Not deleted on request? | College ERP records and the profile photo (part of the person record); regulatory record-keeping. |
| Account deletion URL | `https://admin.juvion.in/account-deletion.html` |
| Data collected / retention | The two lists in the policy page are authoritative. |

## Releasing a new version

Every upload must increase `versionCode` in `mobile/pubspec.yaml` (currently `0.1.0+1` → code **1**).
Bump the number after `+`, run `flutter build appbundle --release`, upload the new AAB.

## CI (phase 2 — not this plan)

When a Play **service account** JSON is available, add a publish step to
`.github/workflows/mobile.yml` after the existing signed-AAB step (`mobile.yml:66-71`) and store the
service account as the secret `PLAY_SERVICE_ACCOUNT_JSON`.
