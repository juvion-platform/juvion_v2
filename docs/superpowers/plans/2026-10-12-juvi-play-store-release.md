# Juvi Google Play Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a release-signed Android App Bundle for `in.juvion.juvi`, a live privacy-policy page, and the store-listing deliverables needed to publish to Google Play's Internal testing track.

**Architecture:** A fresh upload keystore + `key.properties` turns the existing (already wired) release signing config into a real one; a static privacy-policy page ships with the portal alongside the existing account-deletion page; a docs file carries the store copy, asset checklist and Play Console walkthrough. No app or backend code changes.

**Tech Stack:** Flutter 3.44 / Dart 3.12, Gradle (Kotlin DSL), Java keytool (Adoptium JDK 17), Vite (portal `public/`), Playwright (existing e2e pattern), Google Play Console.

**Design:** `docs/superpowers/specs/2026-10-12-juvi-play-store-release-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `mobile/android/app/upload-keystore.jks` | the release **upload key** (git-ignored, never committed) |
| `mobile/android/key.properties` | points Gradle at that keystore (git-ignored, never committed) |
| `mobile/android/.gitignore` | keep every keystore out of git |
| `mobile/README.md` | record how the keystore is created (no password) |
| `admin-portal/public/privacy-policy.html` | the hosted privacy policy (static, script-free) |
| `e2e/tests/privacy-policy.spec.ts` | asserts the page is served, script-free, and links to the deletion page |
| `docs/juvi/play-store-release.md` | store copy, asset checklist, Play Console walkthrough |

Task order: signing first (Tasks 1–2) because everything else assumes a signed bundle exists; then the policy page (Task 3); then the listing/console doc (Task 4).

---

### Task 1: Release upload keystore, `key.properties`, and `.gitignore` hardening

**Files:**
- Create: `mobile/android/app/upload-keystore.jks` (git-ignored)
- Create: `mobile/android/key.properties` (git-ignored)
- Modify: `mobile/android/.gitignore`
- Modify: `mobile/README.md` (Release signing section)

- [ ] **Step 1: Generate a password and the keystore**

Run from the repo root (`juvion_v2/`). `keytool` is on PATH (Adoptium JDK 17); confirmed in this environment.

```bash
PW=$(openssl rand -hex 24)          # 48 hex chars, safe in a .properties value and in a shell
echo "KEYSTORE PASSWORD: $PW"       # PRINT ONCE — the user must save this in a password manager
keytool -genkeypair -v \
  -keystore mobile/android/app/upload-keystore.jks \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" \
  -dname "CN=Juvion, OU=Mobile, O=Juvion, L=Hyderabad, ST=Telangana, C=IN"
printf '%s' "$PW" > /tmp/juvi_ks_pw   # kept for the next step only
```

Expected: `Generating 2,048 bit RSA key pair ... [Storing mobile/android/app/upload-keystore.jks]`.

> **Copy the printed password into your password manager now.** It is the only time it is shown. If it is lost, nothing is bound to it yet, so a fresh keystore can be regenerated freely — but do not lose it after the first Play upload.

- [ ] **Step 2: Write `key.properties`**

```bash
PW=$(cat /tmp/juvi_ks_pw); rm -f /tmp/juvi_ks_pw
printf 'storeFile=upload-keystore.jks\nstorePassword=%s\nkeyAlias=upload\nkeyPassword=%s\n' "$PW" "$PW" \
  > mobile/android/key.properties
```

`storeFile` is relative and resolves from `android/app/` (`android/app/build.gradle.kts:47`).

- [ ] **Step 3: Verify the keystore reads back with the right alias**

```bash
keytool -list -v -keystore mobile/android/app/upload-keystore.jks -storepass "$(grep '^storePassword=' mobile/android/key.properties | cut -d= -f2-)" | grep -E "Alias name|Valid from"
```

Expected: `Alias name: upload` and a "Valid from" date in 2026.

- [ ] **Step 4: Harden `mobile/android/.gitignore`**

Add these lines (keep the existing `key.properties`, `**/*.keystore`, `**/*.jks` entries):

```
# A legacy keystore at android/juvion (no extension) — never committed.
/juvion
# PKCS#12 keystores
**/*.p12
```

- [ ] **Step 5: Verify git ignores every keystore and the properties file**

```bash
cd mobile/android
git check-ignore -v app/upload-keystore.jks key.properties juvion
```

Expected: three lines, each naming `.gitignore:<line>:<pattern>` — i.e. all three are ignored. `git status --porcelain` must NOT list any keystore.

- [ ] **Step 6: Record how the keystore is created in `mobile/README.md`**

In the "Release signing" section, after the existing paragraph, add:

```markdown
Create the upload keystore once, from the repo root (never commit it):

    keytool -genkeypair -v -keystore mobile/android/app/upload-keystore.jks \
      -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass <pw> -keypass <pw> -dname "CN=Juvion, O=Juvion, C=IN"

then write `mobile/android/key.properties` (`storeFile=upload-keystore.jks`, `storePassword=…`,
`keyAlias=upload`, `keyPassword=…`) and base64-encode the keystore into the GitHub secret
`ANDROID_KEYSTORE_BASE64`. A legacy keystore at `android/juvion` has no known password and is
unused.
```

- [ ] **Step 7: Commit**

```bash
git add mobile/android/.gitignore mobile/README.md
git commit -m "chore(mobile): real release signing — upload keystore wiring and gitignore hardening

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

(The keystore and `key.properties` are git-ignored and intentionally not staged.)

---

### Task 2: Build and verify a release-signed App Bundle

**Files:** none changed — this is the acceptance check for Task 1.

- [ ] **Step 1: Ensure a Firebase config is present (the build needs one of the two files)**

```bash
ls mobile/android/app/google-services.json || cp mobile/android/app/google-services.placeholder.json mobile/android/app/google-services.json
```

- [ ] **Step 2: Build the release bundle**

```bash
cd mobile && flutter build appbundle --release
```

Expected: `✓ Built build/app/outputs/bundle/release/app-release.aab`.

- [ ] **Step 3: Verify the bundle is signed by the upload key, not the debug key**

```bash
keytool -printcert -jarfile mobile/build/app/outputs/bundle/release/app-release.aab | grep -E "Owner|Issuer"
```

Expected: `Owner: CN=Juvion, OU=Mobile, O=Juvion, ...` — **not** `CN=Android Debug, O=Android, C=US`. If `-jarfile` reports "Not a signed jar", the fallback is:

```bash
cd mobile/build/app/outputs/bundle/release && unzip -o app-release.aab 'META-INF/*' -d /tmp/aab_sig && keytool -printcert -file /tmp/aab_sig/META-INF/*.RSA | grep Owner
```

- [ ] **Step 4: Record the signing certificate fingerprints (for later Firebase reference, if needed)**

```bash
keytool -printcert -jarfile mobile/build/app/outputs/bundle/release/app-release.aab | grep -E "SHA1|SHA256"
```

Expected: a SHA1 and a SHA256 line. Save them; they are not required by FCM/Crashlytics (this app uses no Firebase Auth) but are useful if that changes.

- [ ] **Step 5: No commit** — this task produces an artifact, not a source change.

---

### Task 3: Privacy-policy page served with the portal

**Files:**
- Create: `e2e/tests/privacy-policy.spec.ts`
- Create: `admin-portal/public/privacy-policy.html`

- [ ] **Step 1: Write the failing test**

Model it on the existing `e2e/tests/account-deletion.spec.ts` (a served-artifact assertion, no seed needed).

```typescript
/**
 * The hosted privacy policy (Play requires a live privacy-policy URL for the listing).
 * Asserted on the *served* artifact, like account-deletion.spec.ts: it is plain HTML with no
 * script, and it links to the public deletion page. No backend route is involved.
 */
import { test, expect } from '@playwright/test';

const PAGE = '/privacy-policy.html';

test.describe('Privacy policy page', () => {
  test('is served as static HTML with no script and links to the deletion page', async ({ page }) => {
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');

    const html = await page.content();
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/\son(click|submit|load|input|change|focus|blur)\s*=/i);

    await expect(page.locator('a[href="/account-deletion.html"]')).toHaveCount(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Prerequisite: the portal is served per the e2e suite's `webServer` (see `e2e/playwright.config.ts`). Run:

```bash
npm run test -w e2e -- tests/privacy-policy.spec.ts
```

Expected: FAIL — the Vite dev server answers the missing path with **200** (its SPA fallback serves `index.html`), so the run fails on `expect(html).not.toContain('<script')`; a production static host would 404 instead.

- [ ] **Step 3: Create `admin-portal/public/privacy-policy.html`**

Static, no `<script>`, styled in the spirit of `account-deletion.html`. Full content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Privacy Policy — Juvi</title>
    <meta name="description" content="How the Juvi app handles your data." />
    <link rel="icon" href="/favicon.svg" />
    <!--
      The hosted privacy policy for the Juvi Android app (Play listing requirement).
      Static asset: vite copies admin-portal/public/ into dist/ verbatim and the deploy publishes
      it to the web root, served at /privacy-policy.html — no script, no auth, no backend HTML.
    -->
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
             color: #1f2937; background: #f8fafc; }
      main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
      h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
      h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; }
      .updated { color: #6b7280; font-size: .9rem; }
      ul { padding-left: 1.25rem; }
      a { color: #1d4ed8; }
      footer { margin-top: 3rem; color: #6b7280; font-size: .9rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Privacy Policy — Juvi</h1>
      <p class="updated">Last updated: 12 October 2026</p>

      <p>
        Juvi is the mobile app for a college that runs on the Juvion platform. Your college operates
        the app for its students and faculty; Juvion provides the platform. This policy explains what
        the Juvi app collects, why, and the choices you have. It does not cover the college's own
        academic and financial records, which are governed by the college.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account and sign-in data.</strong> The name and identifiers your college already
          holds for you (roll number or employee code), and the device sessions created when you sign
          in.</li>
        <li><strong>Device push registration.</strong> A per-device token so the app can receive
          notifications, and its status while your account exists.</li>
        <li><strong>Notification activity.</strong> Which notices were sent to you, whether they were
          delivered, opened or acknowledged.</li>
        <li><strong>App usage events.</strong> Server-side events recording which notices you saw and
          acknowledged, used to operate the service.</li>
        <li><strong>Profile photo.</strong> If you upload one, it is stored on your college person
          record, not kept only on the device.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Sign you in and show your timetable, teaching, dues and academics.</li>
        <li>Deliver notices and notifications, and show their reach and acknowledgements.</li>
        <li>Keep the service secure and diagnose crashes.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        Notifications are delivered through <strong>Firebase Cloud Messaging</strong> and crash
        reports are collected by <strong>Firebase Crashlytics</strong>, both Google services, and the
        app is distributed through <strong>Google Play</strong>. We do not sell your data. Notification
        content is not placed in the push payload's title or body for confidential notices.
      </p>

      <h2>Retention</h2>
      <p>
        Your Juvi data is kept while your account exists. Deleting your Juvi account removes the data
        described on the deletion page below. Your college's own records (person, student or faculty
        records, fees and the rest) are retained by the college under its record-keeping obligations
        and are not deleted by removing your Juvi account.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Control notification tiers, mute, and quiet hours in the app's Settings.</li>
        <li>Ask for your Juvi account to be deleted — see the deletion page.</li>
      </ul>

      <h2>Account deletion</h2>
      <p>
        You can delete your Juvi account from inside the app (immediately) or by requesting deletion
        on the web: <a href="/account-deletion.html">Delete your Juvi account</a>. A web request takes
        effect after a 7-day grace period, which gives you time to cancel a request you did not make.
      </p>

      <h2>Children</h2>
      <p>
        Juvi is for the enrolled students and staff of the college and is not directed at children
        outside that roll.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: <a href="mailto:privacy@juvion.in">privacy@juvion.in</a>.</p>

      <footer>Juvion — Juvi mobile app. This page carries no scripts.</footer>
    </main>
  </body>
</html>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -w e2e -- tests/privacy-policy.spec.ts
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add admin-portal/public/privacy-policy.html e2e/tests/privacy-policy.spec.ts
git commit -m "feat(portal): hosted privacy policy page for the Play listing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 6: Deploy so the URL is live**

```bash
./scripts/deploy.sh
```

Then confirm `https://juvion.in/privacy-policy` returns 200 and links to
`https://juvion.in/account-deletion`. (This step is the user's, on the deploy host.)

---

### Task 4: Store listing copy, asset checklist, and Play Console walkthrough

**Files:**
- Create: `docs/juvi/play-store-release.md`

- [ ] **Step 1: Write the doc**

```markdown
# Juvi — Play Store release kit

For the Android app `in.juvion.juvi`. Design: `docs/superpowers/specs/2026-10-12-juvi-play-store-release-design.md`.

## URLs the listing needs

- Privacy policy: `https://juvion.in/privacy-policy`
- Account deletion: `https://juvion.in/account-deletion`

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

| Asset | Spec |
|---|---|
| App icon | 512×512 PNG, 32-bit, ≤1 MB, no transparency |
| Feature graphic | 1024×500 PNG or JPEG |
| Phone screenshots | ≥2, each side 320–3840 px, 16:9 or 9:16 |
| (optional) 7-inch / 10-inch tablet screenshots | same rules |

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
| Account deletion URL | `https://juvion.in/account-deletion` |
| Data collected / retention | The two lists in the policy page are authoritative. |

## Releasing a new version

Every upload must increase `versionCode` in `mobile/pubspec.yaml` (currently `0.1.0+1` → code **1**).
Bump the number after `+`, run `flutter build appbundle --release`, upload the new AAB.

## CI (phase 2 — not this plan)

When a Play **service account** JSON is available, add a publish step to
`.github/workflows/mobile.yml` after the existing signed-AAB step (`mobile.yml:66-71`) and store the
service account as the secret `PLAY_SERVICE_ACCOUNT_JSON`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/juvi/play-store-release.md
git commit -m "docs(juvi): Play Store release kit — listing copy, asset checklist, console steps

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Notes for the executor

- **Confirm before publishing:** the policy contact email (`privacy@juvion.in` in Task 3 Step 3) and
  the entity/developer name `Juvion` (used on both the policy page and the deletion page). Change
  them if the account's registered values differ.
- **Do not commit** `mobile/android/app/upload-keystore.jks` or `mobile/android/key.properties`; both
  are git-ignored and the plan never stages them. After Task 1, run `git status` and confirm neither
  appears.
- **Never** print the keystore password into a committed file or a log; it is shown once in Task 1
  Step 1 for the user to save.
- Phase 2 (CI Play publishing) is deliberately **not** in this plan; it becomes its own plan once a
  Play service account exists.
