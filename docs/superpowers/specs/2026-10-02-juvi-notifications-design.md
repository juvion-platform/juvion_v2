# Juvi Notifications — Design

**Sub-project 3 of Juvi Release 1.** It depends on:
- Foundation (`2026-09-23-juvi-foundation-design.md`, #94, #96, #99)
- Notices (`2026-09-26-juvi-notices-design.md`, #102–#105)

**PRD references** (PRD-JUVI-R1 v1.0):
- §7.8 NTF-01..05
- §9 notification policy
- NFR-05, NFR-11
- SPC-05 (mute)
- NTC-08 (reminders at Important)
- PRF-03
- Appendix A.4, Appendix B `NotificationDelivery`, Appendix C `juvi.notification.*`

**Screens:**
- S02 step 3 (permission prompt)
- S04 (deep-link target)
- S11 (delivery diagnostics)
- S12 (blocked-permission row)
- S14 (permission-denied card)

## Problem

Notices reach the app only when it next refreshes or comes to the foreground. A student whose app is closed learns about an exam postponed today only when they happen to open it. The notices backend records `notice.published` and `notice.reminder` in the outbox, but nothing sends them to a phone.

Several pieces Foundation built are waiting for this sub-project:
- the settings for the three tiers and quiet hours (`JuviAccount.settings`), and channel mute (`ChannelMembership.mutedAt`)
- the reserved `MobileSession.pushToken` field
- the onboarding notifications step, which carries a comment: "the OS permission prompt itself arrives with push in sub-project 3"

There is also no crash reporting, and product analytics go only to the debug console.

#105 left two deep-link follow-ups:
- A cold-started `/notices/:id` has no Back target.
- A destination opened while signed out is lost after sign-in.

## 1. Decisions locked in review (2026-10-02)

- **Firebase.** The user creates the Firebase project and registers the Android app `in.juvion.juvi`.
  - Credentials (`google-services.json` and a service-account key) are never committed.
  - The design works end to end against a fake transport until they exist.
- **Analytics go to our backend.** The app batches events (ids and enums only) to `POST /v1/events`.
  - Nothing goes to Google except Crashlytics crash stacks, which keeps to NFR-05.
- **Payload.**
  - A normal notice's push shows the office and title, never the body.
  - A new **Confidential** flag makes the push say only "New notice from <office>", with the content fetched on open.
- **Urgent is admin-only.** It needs the admin role or a new `notices:urgent` permission, and a recorded reason.
  - Office publishers choose Routine or Important.
  - There is no approval queue in R1.
- **Architecture: a notification service with one `NotificationDelivery` row per person per notification.** One per-person row is what makes these possible:
  - holding a notification until quiet hours end
  - Routine batching
  - retries that never send twice
  - "not delivered" versus "delivered, not opened"
- **Android only.** iOS and APNs are sub-project 7, which has iOS parity; this machine has no Xcode.

## 2. Goals

1. **Urgent** notifies immediately, even during quiet hours and when the person has muted the notice's channels (NTF-01, NTF-02, SPC-05).
2. **Important** notifies with sound. During quiet hours it is held until the window ends, 07:00 by default (NTF-01, NTF-02).
3. **Routine** is silent and sent as a digest: at most one notification per person per batch key every 15 minutes, so ten notices produce one notification (NTF-01, NTF-04).
4. A person's tier toggles and mute are respected for Important and Routine. Urgent can't be turned off (PRF-03, S12 acceptance criterion).
5. Notifications group by notice in the tray. Tapping one opens S04 for that notice, with Back going to the user's home tab, and the destination survives sign-in, onboarding and a paused session (NTF-03, #105 follow-ups).
6. Delivery is tracked per notification (sent, delivered, opened), and Reach separates "not delivered" from "delivered, not opened" (NTF-05).
7. FCM receives only opaque ids, the office name and, for a non-confidential notice, the title. A confidential notice sends no title (NFR-05).
8. The OS permission is requested at onboarding step 3. If it is refused, Today shows a dismissible card at most once every 30 days (S02, S14).
9. Crash reporting is live in release builds, and product analytics reach the backend with no content or PII (NFR-11).

## 3. Non-goals

- iOS and APNs (sub-project 7).
- Notifications for posts, replies and mentions. These are built in sub-project 5 on this pipeline, with the channel as the batch key.
- Editing notification policy in the ERP (sub-project 6).
- Escalation to WhatsApp or SMS on a missed deadline (NTC-10, R4).
- Analytics dashboards and the §11 metrics feed to M12 (sub-project 7). This sub-project only ingests and stores events.
- An approval queue for Urgent requests.
- Bypassing Do Not Disturb. Urgent uses a maximum-importance channel, not the DND-override permission.

## 4. Data model

### 4.1 `NotificationDelivery` (`backend/src/models/juvi/NotificationDelivery.ts`)

There is one row per person per notification.

| Field | Type | Notes |
|---|---|---|
| `collegeId` | ObjectId, required, indexed | Multi-tenancy |
| `accountId` | ObjectId → JuviAccount | The recipient |
| `source` | `{ type: 'notice', id: ObjectId, kind: 'published' \| 'reminder-1' \| 'reminder-2' }` | Sub-project 5 adds `post` and `mention` |
| `tier` | `urgent \| important \| routine` | Copied from the notice; a reminder is always `important` |
| `status` | `suppressed \| scheduled \| sent \| delivered \| opened \| cancelled \| failed` | Moves forward only, except that `scheduled` can become `cancelled` |
| `reason` | `muted \| tier_off \| no_device \| acknowledged \| dismissed \| archived` or null | Set when the status is `suppressed` or `cancelled` |
| `batchKey` | string | `office:<officeId>` for notices |
| `groupKey` | string | `notice:<id>`, used for tray grouping |
| `sendAfter` | Date | Now, or the end of quiet hours, or the end of the batch window |
| `sentAt`, `deliveredAt`, `openedAt` | Date or null | `openedAt` implies `deliveredAt`; if no delivered receipt arrived, it is back-filled with the opened time |
| `attempts`, `lastError` | number, string | `lastError` holds a transport error code, never the payload |
| `lockedUntil` | Date or null | The sender's lease |

**Indexes:**
- Unique `(source.type, source.id, source.kind, accountId)`. This makes expansion idempotent.
- `(status, sendAfter)` for the sender.
- `(collegeId, source.id, status)` for Reach.
- `(accountId, batchKey, status)` for digest windows.

There is no TTL: rows live as long as the notice's Reach does.

### 4.2 Changes to existing models

- **`Notice`:**
  - `confidential: boolean` (default `false`), fixed once published.
  - `urgentReason: string | null` (10–300 characters), required when `priority === 'urgent'`.
- **`MobileSession.pushToken`:** gets a sparse unique index. A token registered on a new session is cleared from any older session first.
- **New `JuviEvent`:** `{ collegeId, accountId, name, at, props, appVersion, platform, receivedAt }`, with a 400-day TTL on `receivedAt`.

## 5. Pipeline

1. **Trigger.**
   - After `fanOutNotice` has written every `NoticeRecipient` and set the notice to `published`, it emits `notification.requested { source: { type: 'notice', id, kind: 'published' } }` with the dedupe key `notif:notice:<id>:published`.
   - After `markReminded` stamps the recipients, it emits `…kind: 'reminder-<n>'` with the dedupe key `notif:notice:<id>:reminder-<n>`.
   - The outbox allows one consumer per event type, so this new event is how push hangs off the existing events without replacing their consumers.
2. **Expand.**
   - The `notification.requested` consumer (`notifications/expand-consumer.ts`) loads the notice and walks its `NoticeRecipient` rows in batches of 1000.
   - **Who is included:**
     - A published notice: every recipient who is on Juvi.
     - A reminder: only recipients who have neither acknowledged nor dismissed it.
   - For each person it applies the §6 policy and upserts a row. `$setOnInsert` means re-runs change nothing.
3. **Send.**
   - The sender (`notifications/sender.ts`) runs on the existing dispatcher tick (every 5 s) as a sweeper, and also on `kick()`.
   - It claims rows that are `scheduled` with `sendAfter <= now`, up to 500 per tick, with a 60 s `lockedUntil` lease.
   - **For each account:**
     1. **Re-check the notice.** If the notice is archived, or the person has acknowledged or dismissed it, the row is `cancelled` with that reason.
     2. **For Routine rows**, take every `scheduled` row in the same digest window as well (§6.4).
     3. **Find devices.** It loads the account's active sessions that have a `pushToken`. With none, the row becomes `suppressed / no_device`.
     4. **Send** one data message per token through `PushTransport.send(tokens, message)`.
     5. **Mark the row `sent`** if at least one token was accepted.
   - **Errors:**
     - A token rejected as `UNREGISTERED` or `INVALID_ARGUMENT` has its session's `pushToken` cleared.
     - A transient error (`UNAVAILABLE`, `INTERNAL`, quota) sets `attempts++` and `sendAfter = now + backoff`, with the backoff being 30 s × 2^attempts, capped at 10 minutes.
     - After 5 attempts the row is `failed`.
4. **Receipts.** The app reports `delivered` and `opened` (§7.2).
5. **People added later.**
   - When reconcile backfills an added-later recipient (notices §6.6), it emits `notification.requested` for that one person with the dedupe key `notif:notice:<id>:published:<accountId>`.
   - It does this only if the notice is under 7 days old, not archived, and either has no deadline or a deadline that hasn't passed.
   - The unique key stops a second push.

### 5.1 Code layout

These live in `backend/src/modules/juvi-app/notifications/`:
- `policy.ts`: pure functions
- `expand-consumer.ts`
- `sender.ts`
- `receipts.ts`: HMAC sign and verify
- `transport/types.ts`, `transport/fcm.ts`, `transport/fake.ts`
- `events-service.ts`
- `routes.ts`, `controller.ts`, `schemas.ts`
- `index.ts`: `registerNotificationConsumers()`, called from `server.ts` alongside `registerNoticeConsumers()`

`firebase-admin` is imported only in `transport/fcm.ts`.

## 6. Policy (`policy.ts`, pure)

`decide(input) → { status: 'scheduled', sendAfter } | { status: 'suppressed', reason }`.

The input is `{ tier, settings, mutedAllMatchingChannels, now, collegeTimezone }`. The rules apply in this order.

### 6.1 Tier toggles

- If `tier === 'important'` and `settings.tiers.important === false`, the row is `suppressed / tier_off`. The same applies to Routine.
- Urgent is never suppressed by a setting.

### 6.2 Mute

- A notice appears in a channel when its audience matches that channel's scope. This is the same matching `channelNotices` in `notices/mobile-service.ts` uses for the channel screen; the expand consumer reuses that matcher, inverted.
- Mute: if the notice matches at least one of the person's channels and the person has muted every one of them, the row is `suppressed / muted`.
- A notice that matches none of the person's channels can't be muted.
- Urgent bypasses mute.

### 6.3 Quiet hours

- `settings.quietHours { start, end }` (HH:mm, default 22:00–07:00) is read in the college's timezone. The window may wrap past midnight.
- If `now` falls inside the window, Important and Routine get `sendAfter` set to the next occurrence of `end`.
- Urgent ignores quiet hours.

### 6.4 Routine batching (a digest window)

- **Opening a window.** When the expand consumer schedules a Routine row, it looks for an open window: a `scheduled` Routine row for the same `(accountId, batchKey)`.
  - If there is one, the new row takes that row's `sendAfter`.
  - If there isn't, a new window opens with `sendAfter = max(policy sendAfter, now + 15 min)`.
- **Sending.** When the window falls due, the sender sends every `scheduled` Routine row for that `(accountId, batchKey)` as one notification ("3 new notices from Exam Section", or the single title when there is only one). All of them are marked `sent` with the same `sentAt`.
- **Result.** Ten Routine notices from one office within 15 minutes produce exactly one notification (NTF-04 acceptance criterion).
  - Consecutive windows are always at least 15 minutes apart.
  - A Routine notification can arrive up to 15 minutes late. That is acceptable for the silent "badge + grouped digest" tier (PRD §9), and the attention stack and badge still update whenever the app opens.

### 6.5 Urgent gate (at publish)

- `priority: 'urgent'` needs `role ∈ {admin, super_admin}` or the `notices:urgent` permission. Otherwise the publish is refused with `403 URGENT_NOT_ALLOWED`.
- `urgentReason` must be 10–300 characters. It is stored on the Notice and written to the publish audit entry.
- `notices:urgent` is added to `DEFAULT_POLICIES` for admin and principal only.
- Notices already published as Urgent are left alone.

### 6.6 Payload (NFR-05)

FCM **data-only** messages. Android priority is `high` for Urgent and Important and `normal` for Routine, and `collapse_key` is `groupKey`.

```json
{ "deliveryId": "...", "receipt": "...", "kind": "notice", "noticeId": "...",
  "tier": "important", "groupKey": "notice:...", "office": "Exam Section",
  "title": "Hall tickets are out", "variant": "published", "count": "1" }
```

- **Confidential notice:** `title` is omitted. The app renders "New notice from <office>".
- **Reminder:** `variant: 'reminder'`. The app renders "Reminder: <title>", or "Reminder from <office>" when the notice is confidential.
- **Routine batch:** `count` is greater than 1, and `noticeId` is the newest notice. The app renders "<count> new notices from <office>", and tapping it opens the attention sheet.
- **Never included:** the body, attachments, names, roll numbers, deadlines or the audience.
- **Field types:** all values are strings, as FCM data requires.

## 7. API

### 7.1 Push token (mobile, authenticated)

- **`PUT /v1/me/devices/current/push-token`** `{ token: string (≤4096), platform: 'android' }`.
  - Sets `pushToken` on the caller's session after clearing the same token from any other session.
  - Returns `204`.
- **`DELETE /v1/me/devices/current/push-token`**: returns `204`.
- **When a token goes away:**
  - Revoking a session (sign-out, revoke-others, deactivation, reset) removes its token with the session.
  - A clean sign-out calls `DELETE` first.

### 7.2 Receipts (mobile, not session-authenticated)

- **Request:** `POST /v1/notifications/receipts` `{ items: [{ deliveryId, receipt, event: 'delivered' | 'opened', at }] }`, with 1–50 items.
- **The `receipt` token:**
  - It is `base64url(HMAC-SHA256(JUVI_RECEIPT_KEY, deliveryId + '.' + expiry)) + '.' + expiry`, with expiry 7 days after sending.
  - It authorises exactly one row. This is necessary because `delivered` is posted from Android's background isolate, where the app is often killed and the 15-minute access token has expired.
- **How items are applied:**
  - Status moves forward only.
  - `at` is clamped to the range `[sentAt, now]`.
  - A repeated receipt is a no-op.
- **Response:** `200 { accepted: n }`.
  - An item with a bad or expired receipt is skipped and counted under `rejected`.
  - The whole request returns `401` only if every item fails verification.
- **Rate limit:** per IP, using the existing mobile limiter.

### 7.3 Events (mobile, authenticated)

- **Request:** `POST /v1/events` `{ events: [{ name, at, props }] }`, with 1–100 events.
- **`name`** must be in the allow-list in `events-service.ts`:
  - `app.opened`, `account.signed_in`
  - `onboarding.step_completed`, `onboarding.completed`
  - `settings.changed`, `channel.muted`
  - `notice.seen`, `notice.acknowledged`, `notice.dismissed`
  - `notification.opened`, `notification.permission`
  - `permission_card.shown`, `permission_card.dismissed`
- **`props`:**
  - Each value must be a string of 64 characters or fewer that matches `^[A-Za-z0-9_.:-]*$`, or a number or a boolean.
  - At most 10 keys, and 1 KB serialised.
  - Free text is refused. That is how "no content or PII" is enforced on the server.
- **Response:** `200 { accepted, rejected }`. Invalid events are dropped one by one.

### 7.4 Reach diagnostics

The mobile `GET /v1/notices/:id/reach` and the admin `GET /api/juvi-app/admin/notices/:id/reach` both gain:

```json
"delivery": { "scheduled": 0, "sent": 0, "delivered": 0, "opened": 0, "failed": 0, "cancelled": 0,
              "suppressed": { "muted": 0, "tierOff": 0, "noDevice": 0 } }
```

- The counts are for `source.kind = 'published'`.
- Each pending-list entry, on mobile and in admin, gains `delivery`. Its value is one of: `not_delivered` (sent but no receipt, or failed), `delivered`, `opened`, `muted`, `tier_off`, `no_device`, `scheduled`, or `none` for someone not on Juvi.
- No device details are exposed.

### 7.5 Admin publish

`POST /api/juvi-app/admin/notices` accepts `confidential?: boolean` and `urgentReason?: string`, and enforces §6.5.

`GET /api/juvi-app/admin/notices/targets` gains `canPublishUrgent: boolean`.

### 7.6 Contract

`mobile/api/openapi.json` is regenerated (`npm run openapi:mobile -w backend`), and so is the Dart client (`mobile/tool/gen_api.sh`). None of the new schemas has an object-or-null field.

## 8. Flutter

### 8.1 Packages and setup

- Packages: `firebase_core`, `firebase_messaging`, `flutter_local_notifications`, `firebase_crashlytics`.
- Gradle plugins: `com.google.gms.google-services` and `com.google.firebase.crashlytics`.
- `google-services.json` is git-ignored (§10).

### 8.2 Showing notifications

**Notification channels**, created at startup:

| Channel | Importance | Sound |
|---|---|---|
| `juvi_urgent` | max | Yes |
| `juvi_important` | high | Yes |
| `juvi_routine` | low | No |

**Background and killed app.**
- A top-level `@pragma('vm:entry-point')` handler renders the notification with `flutter_local_notifications`, grouped by `groupKey` with a summary per group.
- It then posts the `delivered` receipt with a plain `Dio`, using the institution base URL that was written to secure storage at sign-in.
- If that post fails, the receipt goes into a small queue in shared preferences, which the foreground drains.

**Foreground.**
- Urgent and Important are rendered.
- For every tier, the app invalidates `attentionProvider` and the notice providers so the stack and the Due badge update immediately.
- `delivered` is posted as above.

**Copy.** Notification text comes from fixed English strings in the handler (the app is English-only in R1), mirroring the arb entries.

### 8.3 Push token lifecycle

A `PushRegistration` service registers the FCM token with `PUT /me/devices/current/push-token` once the session is ready and permission is granted.

It re-registers:
- on `onTokenRefresh`
- after an app upgrade
- when permission changes from denied to granted

On sign-out it calls `DELETE` and then `FirebaseMessaging.deleteToken()`.

### 8.4 Permission

- **Onboarding step 3 ("Stay informed").**
  - It keeps the explanation of the tiers and the quiet-hours toggle.
  - It adds "Allow notifications", which shows the Android 13+ `POST_NOTIFICATIONS` prompt, and "Not now".
  - Either choice continues, and the result is tracked as `notification.permission {granted}`.
- **S14 permission-denied card on Today.**
  - It shows when OS permission is off.
  - It explains what the user will miss, offers "Open settings", and can be dismissed.
  - It is re-shown at most once every 30 days; the dismissal date is kept in shared preferences.
  - Permission is re-checked whenever the app resumes.
- **S12 Settings.** While permission is off, a "Blocked in system settings" row links to the OS settings.

### 8.5 Deep links (`lib/app/deep_link_resolver.dart`)

**Sources.**
- `FirebaseMessaging.getInitialMessage()` and `flutter_local_notifications` launch details on a cold start.
- `onMessageOpenedApp` and the local-notification tap callback otherwise.

**On a tap:**
1. Post `opened` (an authenticated session isn't needed, because the receipt carries the HMAC).
2. Track `notification.opened {tier}`.
3. Resolve the destination: `/notices/:id`, or `/attention` for a Routine batch.

**When the session is ready** (signed in, active, onboarding done), the resolver navigates to the home tab (`/today` for students, `/teaching` for faculty) and pushes the destination on top, so Back lands on home.

**Otherwise it holds the destination as pending:**
- The pending destination is held in memory and in secure storage as `{ location, createdAt }`.
- The normal `redirect` continues through sign-in, onboarding or the paused screen.
- When `SessionState` becomes ready, the resolver uses the pending destination and clears it.
- **When it is dropped:**
  - A pending destination older than 24 hours is dropped.
  - Signing out with a different account (or a different institution) clears it.
- If the signed-in user can't see the notice, S04 shows its existing "not available" state.

### 8.6 Crash reporting

- Crashlytics is enabled in release builds only (`setCrashlyticsCollectionEnabled(!kDebugMode)`). It receives `FlutterError.onError` and `PlatformDispatcher.instance.onError`.
- No user identifier and no custom keys are sent.

### 8.7 Analytics sink

`BatchingAnalytics` replaces `ConsoleAnalytics` behind the existing `Analytics` interface. Callers don't change.
- **Queue:** events go into a drift table `analytics_events`, capped at 1,000 rows, with the oldest dropped first.
- **When it flushes** to `POST /v1/events`:
  - every 30 seconds
  - at 20 queued events
  - when the app goes to the background
- **Debug builds** still print events.
- **Sign-out** drops the queue along with the rest of the wiped database.

## 9. Portal (`/communication/notices`)

**Composer.**
- **Confidential checkbox.** Helper text: "The phone notification will say only 'New notice from <office>'. The content opens in the app."
- **Priority.**
  - Urgent is offered only when `/targets.canPublishUrgent` is true. Otherwise the composer shows Routine and Important, plus "Need Urgent? Ask an IT admin."
  - Choosing Urgent shows a required reason field (10–300 characters, with a counter) next to the existing Urgent note.
- **Preview.** It gains a phone-tray preview of the exact notification text.

**Detail page.**
- **Reach tab:**
  - A Delivery row next to the counts.
  - The pending list gains a delivery column: Not delivered, Delivered, Opened, Muted, Notifications off, No device, Scheduled, or "—" for someone not on Juvi.
  - The CSV export gains the same column.
- **Audit tab:** shows the Urgent reason and the Confidential flag.

## 10. Configuration, CI and signing

- **`FIREBASE_SERVICE_ACCOUNT_JSON`** (backend) holds the service-account JSON as a string.
  - If it's unset, `PushTransport` is the fake (logging) transport, with a startup warning.
  - In production it's required whenever `JUVI_PUSH_REQUIRED=true`.
- **`JUVI_RECEIPT_KEY`** (backend) is the HMAC key.
  - In dev it falls back to an HKDF derivation of `JWT_SECRET`.
  - When `NODE_ENV=production` it's required, with a startup guard like `PAYMENT_WEBHOOK_SECRET`.
- Both are documented in `.env.example` and the CLAUDE.md env block.
- **`mobile/android/app/google-services.json`** is git-ignored.
  - CI (`mobile.yml`) writes it from the `GOOGLE_SERVICES_JSON` secret when that secret is present.
  - Otherwise CI copies the committed `mobile/android/app/google-services.placeholder.json`, which belongs to a dummy project, so builds on forks and PRs without secrets keep passing.
  - The README documents the local step.
- **Release signing.**
  - `android/key.properties` (git-ignored) and CI secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) configure a real release keystore.
  - When they are absent, debug builds and CI's `flutter build apk --debug` are unaffected.
  - Firebase and Play both key on the signing certificate.

## 11. Failure handling

- **Expansion.** Expansion is idempotent through the unique key. A re-emitted `notification.requested` creates nothing new.
- **Transient FCM failures.** Rows stay `scheduled` with backoff and never block the outbox. After 5 attempts a row is `failed`, with the error code recorded.
- **Bad tokens.** `UNREGISTERED` or `INVALID_ARGUMENT` clears that session's `pushToken`.
- **Sender lease.** A lease that expires (the sender crashed mid-batch) lets the next tick reclaim the rows.
  - The cost is that a row whose send succeeded but whose status write failed can be sent twice.
  - The app collapses the duplicate, because it renders with a stable notification id derived from `deliveryId`.
- **Receipts.** Bad receipts are skipped. Receipts that arrive late keep their original `at`.
- **Events.** Invalid events are dropped one at a time, with no error to the user.
- **No permission or token.** The person is still counted, as `no_device`, so Reach shows them as not delivered.

## 12. Testing

**Backend.**
- `policy.ts` table tests cover:
  - every tier against tier-off, mute and quiet hours (inside and outside the window)
  - a window wrapping past midnight
  - a non-UTC college timezone
  - an Urgent bypass in every case
  - These map to the NTF-01, NTF-02 and SPC-05 acceptance criteria.
- Batching tests: ten Routine rows within 15 minutes produce exactly one send with `count: 10`, and the next window is at least 15 minutes later. This maps to NTF-04.
- Pipeline tests run `drainOutbox()`, then the sender, against the fake transport, which records every message. They assert that:
  - a confidential notice has no `title`
  - no payload ever carries the body
  - an acknowledgement before `sendAfter` cancels the row
  - `UNREGISTERED` clears the token
  - backoff runs to `failed`
  - added-later recipients get exactly one push
- Receipt tests: a forged or expired HMAC is rejected; status moves forward only; `at` is clamped.
- Events tests: the allow-list, refusal of free-text props, and the size caps.
- Backend e2e:
  - the Urgent gate (403, plus admin publish with the reason written to audit)
  - push-token uniqueness across sessions
  - the Reach `delivery` block, on mobile and admin

**Portal.**
- Vitest: Urgent is hidden without `canPublishUrgent`; the reason is required; the confidential tray preview; the delivery column.
- Playwright: the registrar is offered no Urgent option.

**Flutter.**
- `DeepLinkResolver` unit tests:
  - a cold start while ready
  - signed out, then sign-in
  - onboarding
  - paused
  - the 24-hour expiry
  - an account switch
  - Back landing on home
- Background-handler tests use a fake local-notifications plugin and fake Dio: the confidential rendering, the receipt post, and the queue when offline.
- Tests for the permission card's 30-day cadence.
- Tests for `BatchingAnalytics` flushing.
- The flow test extends to: a notification tap while signed out → sign in → S04 → Back → Today.

**Manual, on a real device with the Firebase project:**
- an Urgent notice during quiet hours rings
- an Important notice at 23:00 arrives at 07:00
- a confidential notice shows only the office
- tapping a notification opens S04
- Reach shows Delivered and Opened

## 13. Delivery

Three plans, each leaving `main` deployable:

1. **Backend:**
   - `NotificationDelivery`
   - expand consumer, sender and transports
   - receipts and events endpoints, push-token routes
   - the Urgent gate and the confidential flag
   - Reach diagnostics
   - the regenerated contract and Dart client
   - With no Firebase credentials, the fake transport makes this safe to merge.
2. **Portal:** composer changes (Confidential, Urgent gating and reason, tray preview), the Reach delivery row and column, and the Audit tab.
3. **Flutter:**
   - Firebase setup: the placeholder file, CI secret injection, release signing
   - rendering in the background and foreground
   - the token lifecycle
   - the permission prompt, S14 card and S12 row
   - `DeepLinkResolver`
   - Crashlytics and `BatchingAnalytics`
   - Real-device verification waits on the Firebase project.
