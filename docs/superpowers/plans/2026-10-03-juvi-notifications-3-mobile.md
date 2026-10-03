# Juvi Notifications — Plan 3 of 3: Flutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring push notifications to the Juvi Android app: Firebase wired without committed secrets (placeholder `google-services.json`, CI secret injection, real release signing), the three tier channels and the tray wording the portal previews, background and foreground rendering with HMAC `delivered` receipts (queued when offline), the push-token lifecycle, the OS permission at onboarding step 3 with the S14 card and the S12 row, a `DeepLinkResolver` that opens S04 over the home tab and survives sign-in, Crashlytics in release builds, and `BatchingAnalytics` sending allow-listed events to `/v1/events`.

**Architecture:** Firebase never reaches a test: four small interfaces (`PushMessaging`, `LocalNotifications`, `NotificationPermission`, `CrashSink`) have no-op provider defaults, and only `lib/main.dart`, `lib/core/push/background_handler.dart`, `lib/core/push/firebase_push.dart` and `lib/core/crash/firebase_crash_sink.dart` import a Firebase package (a test enforces it); `main()` overrides the providers once `Firebase.initializeApp()` succeeds. Pure code holds the contract: `notice_push.dart` parses the FCM data message and owns the tray wording, the channels and the stable notification id; `receipts.dart` posts receipts through the generated client on a session-less Dio and queues them in shared preferences. `firebaseMessagingBackgroundHandler` (own isolate) and `PushLifecycle` (a widget beside `SyncLifecycle`) feed `push_handlers.dart`; taps go to `DeepLinkResolver` (`lib/app/deep_link_resolver.dart`); `PushRegistration` keeps the server's token current; `BatchingAnalytics` replaces `ConsoleAnalytics` behind the unchanged `Analytics` interface, queueing in a new drift table.

**Tech Stack:** Flutter 3.44.9 / Dart 3.12.2, flutter_riverpod 3 + riverpod_generator (`retry: (_, _) => null` in tests), go_router 17, dio 5.11, drift 2.35 over SQLCipher (schema 1 → 2), shared_preferences, flutter_secure_storage 11, the generated `juvi_api` (dart-dio 7.10.0); new: `firebase_core` ^4.15.0, `firebase_messaging` ^16.7.0, `firebase_crashlytics` ^5.4.0, `flutter_local_notifications` ^22.3.1; Gradle plugins `com.google.gms.google-services` 4.5.0 and `com.google.firebase.crashlytics` 3.0.8 on AGP 9.0.1; tests with flutter_test, mocktail, http_mock_adapter. Android only.

**Spec:** `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md` — this plan is §13 item 3. §8 (Flutter), §6.6 (payload), §7.1–§7.3 (push token, receipts, events), §10 (configuration, CI, signing), §11 (failure handling) and the Flutter part of §12 are binding. The backend is Plan 1 (`docs/superpowers/plans/2026-10-02-juvi-notifications-1-backend.md`, merged in #106; its Rulings 13–15 shape the receipt, digest and events contract used here) and the portal is Plan 2 (#107), whose `trayNotification()` (`admin-portal/src/lib/notices.ts:58`) is the wording the app must reproduce. Style follows the notices Flutter plan (`docs/superpowers/plans/2026-10-02-juvi-notices-3-mobile.md`).

## Rulings

Decisions this plan makes where the spec is silent, or where the live code forces a different shape. Each is restated in the task that implements it.

1. **Versions.** `firebase_core` ^4.15.0, `firebase_messaging` ^16.7.0, `firebase_crashlytics` ^5.4.0 and `flutter_local_notifications` ^22.3.1 (the newest on pub.dev on 2026-10-03, all resolving against Flutter 3.44.9; FLN brings `timezone` 0.11.1). Add them with explicit constraints: an unconstrained `flutter pub add flutter_local_notifications` resolves to **8.2.0**. Gradle: `com.google.gms.google-services` 4.5.0 and `com.google.firebase.crashlytics` 3.0.8 (newest on Google Maven). FLN needs core library desugaring (`isCoreLibraryDesugaringEnabled` + `desugar_jdk_libs` 2.1.4). The build prints a warning that `firebase_core` and `firebase_crashlytics` still apply the Kotlin Gradle plugin ("future versions of Flutter will fail"); nothing to do until FlutterFire migrates.
2. **No stored base URL.** Spec §8.2 says the background handler uses "the institution base URL that was written to secure storage at sign-in". There is no per-institution URL: every institution shares the compile-time `AppEnv.apiBaseUrl` (`mobile/lib/core/env.dart:5`; the institution is the `collegeId` request field). The handler builds a plain `Dio(juviBaseOptions(baseUrl: AppEnv.apiBaseUrl, …))`; nothing new is written at sign-in.
3. **Receipts use the generated client** (`MobileApi.postNotificationReceipts`) on a session-less Dio: `bareMobileApiProvider` in the foreground, a fresh Dio in the background. Unsent receipts wait in shared preferences under `juvi.push.receipts` (newest 200, one per `(deliveryId, event)`), read after `prefs.reload()` because the background isolate writes the same key. A 4xx other than 429 drops the item (an expired or forged receipt never becomes valid); offline, 429 and 5xx keep it.
4. **OS permission off ⇒ no `delivered`.** While Android blocks Juvi's notifications the background handler neither renders nor posts `delivered`, so Reach keeps that person under "Not delivered" instead of claiming a delivery the tray never showed. In the foreground `delivered` is still posted: the app itself refreshed the attention stack.
5. **Taps come from the local-notifications plugin.** Juvi's pushes are data-only and drawn by `flutter_local_notifications`, so FCM's `getInitialMessage()` / `onMessageOpenedApp` never fire for them; both are still wired (spec §8.5) next to the plugin's launch details and tap callback, which carry every real tap. The payload is the push's own fields as JSON (`NoticePush.toPayload()`).
6. **Grouping.** Each notification is posted with a group summary for its `groupKey` (summary id = stable hash of `group:<groupKey>`, same text as the newest child, `GroupAlertBehavior.children` so only the child alerts). The small icon is `@mipmap/ic_launcher` (the repo has no monochrome notification icon yet).
7. **Stable ids** are a 31-bit FNV-1a hash of `deliveryId`, so a row re-sent after a lost sender lease replaces its first notification (spec §11).
8. **Token registration** (`PushRegistration`): one `PUT` per process while signed in (`SignedIn`; the server does not gate the route on onboarding) with notifications allowed — an upgrade always starts a new process, which is how "re-register after an app upgrade" is met without persisted state — plus every `onTokenRefresh`, a real denied → allowed change (`false` → `true`, not the first answer) and the next sign-in. Triggers run one at a time, so two firing together send one `PUT`. Sign-out calls `DELETE` and then `deleteToken()` before `AuthRepository.signOut()` revokes the session. Turning the permission off later does not `DELETE` (Ruling 4 keeps Reach honest).
9. **Permission without new packages.** `NotificationPermission` uses `flutter_local_notifications`' Android plugin (`areNotificationsEnabled`, `requestNotificationsPermission`); "Open settings" is a one-method `MethodChannel('in.juvion.juvi/settings')` in `MainActivity.kt` that opens `Settings.ACTION_APP_NOTIFICATION_SETTINGS`. An answer the plugin cannot give (no Android implementation, as in every widget test) counts as allowed, so the app never nags blind and existing widget tests are untouched. Onboarding step 3 shows "Allow notifications" and "Not now" only while notifications are not already allowed; otherwise the usual Continue/Finish.
10. **S14 also on Teaching** (the faculty home tab; the spec names Today, the student one). The dismissal date is a device setting in shared preferences (`juvi.permission_card.dismissed_at`), so it survives sign-out. `permission_card.shown` is recorded once per appearance.
11. **`notice.opened` becomes `notice.seen`.** S04 has tracked `notice.opened` since #105, but the server allow-list (§7.3, `events-service.ts:11`) has `notice.seen`, so every one would be refused. S04 now records `notice.seen {noticeId}` (it fires where S04 marks the notice seen). `BatchingAnalytics` reads the allow-list from the generated `EventsRequestEventsInnerNameEnum`, so the two cannot drift, and never queues anything else. Props are cleaned on the device to the server's rules — a `null` (`late` on a queued acknowledgement) or a comma-joined `settings.changed {key}` is dropped, the event kept — at most 10 keys.
12. **Analytics only while signed in.** `/v1/events` needs a session, and a call without one would come back `SESSION_INVALIDATED` through the shared Dio's `onFatal`; an event from before sign-in cannot be attributed anyway. So events are queued and flushed only in `SignedIn`; a tap's `notification.opened` while signed out is therefore not recorded (its `opened` receipt is). The 30-second flush is a one-shot timer started by the first unsent event (never a periodic timer); "on background" is `AppLifecycleState.paused` in `SyncLifecycle`. 401, 429, 5xx and offline keep the batch; another 4xx drops it.
13. **Drift schema 2** creates `analytics_events` in `onUpgrade`; the migration test opens a hand-built version-1 database (the repo keeps no drift schema dumps).
14. **Deep links.** "Ready" is `SignedIn` with the password set and onboarding complete. Whenever a ready session is seen the resolver records its owner, `<collegeId>:<accountId>`, in secure storage (`juvi.last_account`, kept across sign-out); a held destination (`juvi.pending_link`, `{location, createdAt, owner}`, also not wiped) carries the owner at tap time and is dropped when a different owner — another account or another institution — is the next ready session, or when it is older than 24 hours. `go(home)` followed at once by `push(location)` works with go_router 17 because `redirect()` is synchronous (verified in the dry run and by the flow test).
15. **Crashlytics** collection is `!kDebugMode`, as spec §8.6 writes it (so profile builds report too); the hooks are installed only then.
16. **Release signing.** Without `android/key.properties` a release build is signed with the debug key, as today, so `flutter run --release` keeps working. CI writes `google-services.json` after the tests (they never need it) and before `flutter build apk --debug`, and, when `ANDROID_KEYSTORE_BASE64` is set, also builds a signed release App Bundle as an artifact. The dry run built a release APK with a throwaway keystore and the placeholder JSON; `apksigner` showed the release certificate.
17. **`.kotlin/`** is added to `mobile/android/.gitignore`: the Firebase Gradle plugins make the first build create that Kotlin session directory.
18. **No backend gap.** Every route, field and code the app needs is in the live contract (`mobile/api/openapi.json`) and the generated client; `tool/check_nullable_objects.js` needs no change. `RECEIPT_INVALID` stays `ApiErrorCode.unknown` on the app side: receipts only look at the status.

**Spec name → code name:** "the background handler" → `firebaseMessagingBackgroundHandler` (`lib/core/push/background_handler.dart`) over `handleBackgroundPush()`; foreground rendering → `handleForegroundPush()` (`lib/core/push/push_handlers.dart`) driven by `PushLifecycle`; "small queue in shared preferences" → `ReceiptQueue`; `PushRegistration`, `DeepLinkResolver`, `BatchingAnalytics` as named; the S14 card → `PermissionCard` (logic) over `PermissionDeniedCard` (presentational).

## Dry run

Every task was applied in order to a copy of `main` at d01a9f2 (`git archive`), in the scratch directory `notif-mobile-dryrun/`, then **replayed from an untouched copy** (`notif-mobile-replay/`) one task at a time, running `build_runner`, `gen-l10n`, `flutter analyze` and both test runs at every boundary.

- **Baseline:** `flutter analyze` → `No issues found!`; `flutter test --exclude-tags golden` → `+203: All tests passed!`; `flutter test --tags golden` → `+14: All tests passed!`.
- **Per task (non-golden / golden):** 1: 205/14, 2: 219/14, 3: 225/14, 4: 234/14, 5: 242/14, 6: 250/16, 7: 260/16, 8: 268/16, 9: 278/16, 10: 285/16, 11: 286/16
- **Final:** analyze clean; `+286` non-golden, `+16` golden; `node tool/check_nullable_objects.js api/openapi.json` → `object-or-null check passed (6 known field(s), all parsed via raw Dio)`; `flutter build apk --debug` with the placeholder `google-services.json` → `✓ Built build/app/outputs/flutter-apk/app-debug.apk`. A signed `flutter build apk --release` with a throwaway `key.properties` also built.
- **Fixes the dry run forced into the plan:** an unconstrained `flutter pub add` picked `flutter_local_notifications` 8.2.0 (Ruling 1); the generated client sends request bodies already JSON-encoded, so tests decode `RequestOptions.data` as a `String`; two triggers registering the token at once sent two `PUT`s until registrations were serialised (Ruling 8); a `Future` chain that one failed step would have stalled forever (`_serial` swallows errors); the permission listener fired on the first answer as well as on a change (now only `false` → `true`); the S14 golden needed a 320-pixel-high surface; `PushRegistration`'s positional boolean failed `avoid_positional_boolean_parameters`.

## Global Constraints

- `mobile/` is not an npm workspace; every Flutter command runs from `mobile/`. Nothing under `mobile/` imports from `backend/`, and `mobile/packages/juvi_api/` (generated) is never edited by hand.
- **No committed secrets** (spec §10): `mobile/android/app/google-services.json` and `mobile/android/key.properties` are git-ignored; `google-services.placeholder.json` (a dummy project) is committed. Builds and CI pass without any secret.
- **Firebase stays out of tests:** only `lib/main.dart`, `lib/core/push/background_handler.dart`, `lib/core/push/firebase_push.dart` and `lib/core/crash/firebase_crash_sink.dart` import `package:firebase_*` (`test/core/firebase_boundary_test.dart`). Every provider over a plugin defaults to a no-op or an answer that never nags.
- **Payload (spec §6.6):** data-only; every value a string; keys `deliveryId`, `receipt`, `kind` (`notice`), `noticeId`, `tier` (`urgent | important | routine`), `groupKey` (`notice:<id>`), `office`, `variant` (`published | reminder`), `count`, and `title` only for a single non-confidential notice.
- **Tray wording** (must equal the portal's `trayNotification()`): Published → `<office>` / `<title>`; confidential → "New notice from <office>", one line. Reminder → `<office>` / "Reminder: <title>"; confidential → "Reminder from <office>"; always on the Important channel. Routine batch, `count` > 1 → "<count> new notices from <office>", one line, tap opens `/attention`; `count` = 1 renders like Published. Never the body, attachments, names, deadlines or audience.
- **Channels:** `juvi_urgent` importance max, sound; `juvi_important` high, sound; `juvi_routine` low, silent.
- **Receipts (spec §7.2):** `POST /v1/notifications/receipts` `{ items: [{ deliveryId, receipt, event: 'delivered' | 'opened', at }] }`, 1–50 items, no session; `401 RECEIPT_INVALID` only when every item fails.
- **Push token (spec §7.1):** `PUT /v1/me/devices/current/push-token` `{ token, platform: 'android' }` → 204; `DELETE` → 204.
- **Events (spec §7.3):** `POST /v1/events` `{ events: [{ name, at, props }] }`, 1–100 per request; names from the allow-list; each prop value a string of ≤ 64 characters matching `^[A-Za-z0-9_.:-]*$`, a number or a boolean; ≤ 10 keys. New events: `notification.opened {tier}`, `notification.permission {granted}`, `permission_card.shown`, `permission_card.dismissed`.
- **Analytics queue (spec §8.7):** drift table `analytics_events`, newest 1,000 kept; flush every 30 s, at 20 queued events and when the app goes to the background; debug builds still print; sign-out drops it with the wiped database.
- **Deep links (spec §8.5):** ready → home tab (`/today` student, `/teaching` faculty), then the destination pushed on top; otherwise held in memory and secure storage as `{ location, createdAt }`, dropped after 24 hours or on an account or institution switch, used once by the next ready session.
- **S14:** shown while the OS permission is off, dismissible, back at most once every 30 days; permission re-checked on every resume. **S12:** "Blocked in system settings" row while it is off.
- **Crash reporting:** `setCrashlyticsCollectionEnabled(!kDebugMode)`; `FlutterError.onError` and `PlatformDispatcher.instance.onError`; no user id, no custom keys.
- **Generated-client rule (Foundation R57/R61):** the notification endpoints (`registerPushToken`, `clearPushToken`, `postNotificationReceipts`, `postEvents`) have no object-or-null field and go through `wire.MobileApi`. Mocks follow `openapi.json`, with real `null`s where the contract has them (`/institutions`, `/config` in the flow test).
- All user-visible strings live in `lib/app/l10n/app_en.arb`; run `flutter gen-l10n` after editing it. The tray strings are fixed English in `notice_push.dart` (the background isolate has no `BuildContext`) and a test holds each equal to its arb entry.
- Tests: `ProviderScope(retry: (_, _) => null)` / `ProviderContainer(retry: …)` wherever a provider can fail; golden tests are tagged `@Tags(['golden'])`, live in a `goldens/` folder beside the test, and are excluded in CI; new goldens are generated once with `--update-goldens` in the task that adds them.
- Every task ends with `flutter analyze` at 0 issues and both test runs green. Baseline before Task 1: `+203` non-golden, `+14` golden.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **The same notice notifies twice** (published, then its reminder, or a re-send after a lost lease): one tray group for the notice, the reminder on the Important channel, a re-send replacing rather than repeating. Pinned in Task 2 (`channelFor`, stable ids) and Task 5 (group summary, ids passed to the plugin).
2. **A tap on an old notification after someone else signs in** on the same phone: the held destination must not open for the new account or institution. Pinned in Task 9 ("another account, or another institution, signs in: dropped").
3. **Offline when the push arrives:** the `delivered` receipt waits and goes out at the next app start or resume, not never. Pinned in Task 5 (queued) and Task 10 (drained at start).
4. **Permission turned off in the system settings while Juvi is in the background:** on return S12 and S14 reflect it without a restart, and the background handler stops claiming deliveries. Pinned in Task 10 (resume re-check) and Task 5 (no receipt while blocked).
5. **Events the server would refuse** (`null` props, free text, an unlisted name): dropped on the device one prop or one event at a time, never poisoning a batch. Pinned in Task 7 (sanitising and allow-list tests, 400 drops the batch).

---

## File structure

**Create**

```
mobile/android/app/google-services.placeholder.json        dummy Firebase project (package in.juvion.juvi); copied to google-services.json when no real one exists
mobile/lib/core/push/notice_push.dart                      NoticePush (parse, payload, location), TrayContent + trayContent(), PushChannel + channels, stable ids
mobile/lib/core/push/receipts.dart                         ReceiptItem, ReceiptQueue (shared preferences), Receipts (post, drain)
mobile/lib/core/push/notification_permission.dart          NotificationPermission, PluginNotificationPermission, notificationPermissionProvider, NotificationsAllowed
mobile/lib/core/push/local_notifications.dart              LocalNotifications, NoLocalNotifications, PluginLocalNotifications
mobile/lib/core/push/push_handlers.dart                    handleBackgroundPush, handleForegroundPush
mobile/lib/core/push/background_handler.dart               firebaseMessagingBackgroundHandler (@pragma('vm:entry-point'))
mobile/lib/core/push/push_messaging.dart                   PushMessaging, NoPushMessaging; pushMessaging, localNotifications, receipts providers
mobile/lib/core/push/firebase_push.dart                    FirebasePushMessaging
mobile/lib/core/push/push_registration.dart                PushRegistration, pushRegistrationProvider
mobile/lib/core/push/push_lifecycle.dart                   PushLifecycle (foreground messages, taps, cold start, resume)
mobile/lib/core/analytics/batching_analytics.dart          BatchingAnalytics, sanitizeProps, eventNames
mobile/lib/core/crash/crash_reporting.dart                 CrashSink, installCrashReporting
mobile/lib/core/crash/firebase_crash_sink.dart             FirebaseCrashSink
mobile/lib/app/deep_link_resolver.dart                     PendingLink, sessionReady, DeepLinkResolver, deepLinkResolverProvider
mobile/lib/features/notifications/permission_card.dart     S14: permissionCardDue, PermissionCardDismissal, PermissionCard, PermissionDeniedCard
mobile/test/core/firebase_boundary_test.dart
mobile/test/core/push/push_fixtures.dart                   pushData + fakes (not a test file)
mobile/test/core/push/notice_push_test.dart
mobile/test/core/push/receipts_test.dart
mobile/test/core/push/notification_permission_test.dart
mobile/test/core/push/push_handlers_test.dart
mobile/test/core/push/push_registration_test.dart
mobile/test/core/push/push_lifecycle_test.dart
mobile/test/core/analytics/batching_analytics_test.dart
mobile/test/core/crash/crash_reporting_test.dart
mobile/test/app/deep_link_resolver_test.dart
mobile/test/features/notifications/permission_card_test.dart
mobile/test/features/notifications/permission_card_golden_test.dart
mobile/test/features/notifications/goldens/permission_card_{light,dark}.png   generated in Task 6
```

**Modify**

```
mobile/pubspec.yaml, mobile/pubspec.lock                   four Firebase / notification packages
mobile/android/settings.gradle.kts                         google-services 4.5.0, crashlytics 3.0.8
mobile/android/app/build.gradle.kts                        both plugins, desugaring, release signingConfig from key.properties
mobile/android/app/src/main/AndroidManifest.xml            POST_NOTIFICATIONS
mobile/android/app/src/main/kotlin/in/juvion/juvi/MainActivity.kt   in.juvion.juvi/settings channel
mobile/.gitignore, mobile/android/.gitignore               google-services.json; .kotlin/
.github/workflows/mobile.yml                               google-services.json from the secret or the placeholder; signed bundle when the keystore secret exists
mobile/lib/main.dart                                       Firebase, Crashlytics, background handler, provider overrides
mobile/lib/app/app.dart                                    PushLifecycle inside SyncLifecycle
mobile/lib/app/l10n/app_en.arb (+ generated app_localizations*.dart)
mobile/lib/core/analytics/analytics.dart                   analyticsProvider → BatchingAnalytics (ConsoleAnalytics removed)
mobile/lib/core/storage/app_database.dart                  analytics_events, schema 2, migration, wipe
mobile/lib/core/storage/secure_store.dart                  pending link, last account
mobile/lib/core/session/session_controller.dart            signOut unregisters the push token first
mobile/lib/core/sync/sync_lifecycle.dart                   flush analytics on pause
mobile/lib/features/onboarding/onboarding_screen.dart      step 3 Allow notifications / Not now
mobile/lib/features/onboarding/steps/notifications_step.dart   doc comment
mobile/lib/features/me/settings_screen.dart                S12 blocked row
mobile/lib/features/home/today_shell_screen.dart, teaching_shell_screen.dart   S14 card
mobile/lib/features/notices/notice_detail_screen.dart      notice.seen
mobile/test/core/session/session_controller_test.dart, test/core/storage/app_database_test.dart, test/core/sync/sync_lifecycle_test.dart,
mobile/test/features/me/me_screen_test.dart, test/features/onboarding/onboarding_screen_test.dart, test/features/home/today_shell_test.dart,
mobile/test/features/notices/notice_detail_screen_test.dart, test/flows/sign_in_flow_test.dart
mobile/README.md, CLAUDE.md
```

---

### Task 1: Firebase packages, Gradle plugins, the placeholder config, release signing and CI

**Files:**
- Create: `mobile/android/app/google-services.placeholder.json`, `mobile/test/core/firebase_boundary_test.dart`
- Modify: `mobile/pubspec.yaml` (+ `pubspec.lock`), `mobile/android/settings.gradle.kts:20-24`, `mobile/android/app/build.gradle.kts` (whole file), `mobile/.gitignore` (end), `mobile/android/.gitignore` (end), `.github/workflows/mobile.yml` (whole file)

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: the four packages for Tasks 4–10; `test/core/firebase_boundary_test.dart`'s `firebaseFiles` allow-list (`lib/main.dart`, `lib/core/push/background_handler.dart`, `lib/core/push/firebase_push.dart`, `lib/core/crash/firebase_crash_sink.dart`) that Tasks 5, 8 and 10 fill; a buildable app with `android/app/google-services.json` copied from the placeholder.

Decisions (Rulings 1, 16, 17):
- Pin the constraints: `flutter pub add` without them resolves `flutter_local_notifications` to 8.2.0.
- Without `android/key.properties` a release build keeps the debug key; CI writes the file only when `ANDROID_KEYSTORE_BASE64` is set and then also builds a signed bundle.
- CI writes `google-services.json` after the tests and before the APK build: tests never read it.

- [ ] **Step 1: Write the failing test**

```dart
// mobile/test/core/firebase_boundary_test.dart
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Firebase stays behind small interfaces (notifications spec §8, §10): tests never
/// initialise it, and a build with the placeholder google-services.json still runs. Only
/// these files may import a Firebase package.
const firebaseFiles = {
  'lib/main.dart',
  'lib/core/push/background_handler.dart',
  'lib/core/push/firebase_push.dart',
  'lib/core/crash/firebase_crash_sink.dart',
};

void main() {
  test('only the Firebase boundary files import package:firebase_*', () {
    final offenders = [
      for (final f in Directory('lib').listSync(recursive: true).whereType<File>())
        if (f.path.endsWith('.dart') && !firebaseFiles.contains(f.path) && f.readAsStringSync().contains("import 'package:firebase_")) f.path,
    ];
    expect(offenders, isEmpty);
  });

  test('google-services.json is git-ignored and a placeholder is committed', () {
    expect(File('android/app/google-services.placeholder.json').existsSync(), isTrue);
    expect(File('.gitignore').readAsStringSync(), contains('/android/app/google-services.json'));
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && flutter test test/core/firebase_boundary_test.dart`
Expected: FAIL — `google-services.json is git-ignored and a placeholder is committed` (`Expected: true  Actual: <false>`); the boundary test passes (nothing imports Firebase yet).

- [ ] **Step 3: Add the packages**

```bash
cd mobile
flutter pub add firebase_core:^4.15.0 firebase_messaging:^16.7.0 firebase_crashlytics:^5.4.0 flutter_local_notifications:^22.3.1
```

`pubspec.yaml` gains, in alphabetical order inside `dependencies:`:

```yaml
  firebase_core: ^4.15.0
  firebase_crashlytics: ^5.4.0
  firebase_messaging: ^16.7.0
```

after `drift: ^2.35.0`, and

```yaml
  flutter_local_notifications: ^22.3.1
```

after `flutter_image_compress: ^2.5.1`. Check `pubspec.lock` says `flutter_local_notifications` `22.3.1` and `timezone` `0.11.1`.

- [ ] **Step 4: Declare the Gradle plugins**

In `mobile/android/settings.gradle.kts` replace:

```kotlin
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
}
```

with:

```kotlin
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
    id("com.google.gms.google-services") version "4.5.0" apply false
    id("com.google.firebase.crashlytics") version "3.0.8" apply false
}
```

- [ ] **Step 5: Apply them, enable desugaring and sign releases from `key.properties`**

Replace the whole of `mobile/android/app/build.gradle.kts` with:

```kotlin
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // Reads app/google-services.json, which is git-ignored (mobile/README.md, "Firebase").
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
}

// Release signing (notifications spec §10). android/key.properties is git-ignored; CI writes
// it from the ANDROID_KEYSTORE_* secrets. Without it a release build is signed with the debug
// key, so `flutter run --release` still works on a developer machine.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "in.juvion.juvi"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // flutter_local_notifications needs core library desugaring.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Firebase (google-services.json) and Play both key on this id.
        applicationId = "in.juvion.juvi"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 29
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (hasReleaseKeystore) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(if (hasReleaseKeystore) "release" else "debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}
```

- [ ] **Step 6: Commit the placeholder, ignore the real file**

Create `mobile/android/app/google-services.placeholder.json`:

```json
{
  "project_info": {
    "project_number": "000000000000",
    "project_id": "juvi-placeholder",
    "storage_bucket": "juvi-placeholder.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:000000000000:android:0000000000000000000000",
        "android_client_info": {
          "package_name": "in.juvion.juvi"
        }
      },
      "oauth_client": [],
      "api_key": [
        {
          "current_key": "placeholder-not-a-real-key"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      }
    }
  ],
  "configuration_version": "1"
}
```

Append to `mobile/.gitignore` (after the `/android/app/release` line):

```gitignore

# Firebase config is never committed (notifications spec §10): copy the real file from the
# Firebase console, or google-services.placeholder.json, to this path (mobile/README.md).
/android/app/google-services.json
```

Append to `mobile/android/.gitignore` (after `**/*.jks`):

```gitignore
/.kotlin/
```

Then, locally only (the file is ignored):

```bash
cp mobile/android/app/google-services.placeholder.json mobile/android/app/google-services.json
```

- [ ] **Step 7: CI writes the config and, when it can, signs a release bundle**

Replace the whole of `.github/workflows/mobile.yml` with:

```yaml
name: mobile
on:
  pull_request:
    branches: [main]
    paths: ['mobile/**', '.github/workflows/mobile.yml']
  push:
    branches: [main]
    paths: ['mobile/**']
concurrency:
  group: mobile-${{ github.ref }}
  cancel-in-progress: true
jobs:
  flutter:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    defaults: { run: { working-directory: mobile } }
    env:
      # Secrets are empty on forks and on PRs from them; every step below copes.
      HAS_RELEASE_KEYSTORE: ${{ secrets.ANDROID_KEYSTORE_BASE64 != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: subosito/flutter-action@v2
        with: { flutter-version: '3.44.9', channel: stable, cache: true }
      - run: flutter pub get
      - name: Generated client is up to date
        run: ./tool/gen_api.sh && git diff --exit-code -- packages/juvi_api
      - run: dart run build_runner build --delete-conflicting-outputs
      - run: flutter gen-l10n
      - run: flutter analyze
      - name: Install host SQLite for drift tests
        run: sudo apt-get update && sudo apt-get install -y libsqlite3-dev
      - run: flutter test --exclude-tags golden --coverage
      - name: Firebase config (the real project when the secret is set, otherwise the placeholder)
        env:
          GOOGLE_SERVICES_JSON: ${{ secrets.GOOGLE_SERVICES_JSON }}
        run: |
          if [ -n "$GOOGLE_SERVICES_JSON" ]; then
            printf '%s' "$GOOGLE_SERVICES_JSON" > android/app/google-services.json
          else
            cp android/app/google-services.placeholder.json android/app/google-services.json
          fi
      - run: flutter build apk --debug
      - name: Release keystore
        if: env.HAS_RELEASE_KEYSTORE == 'true'
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: |
          printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > android/app/upload-keystore.jks
          printf 'storeFile=upload-keystore.jks\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' \
            "$ANDROID_KEYSTORE_PASSWORD" "$ANDROID_KEY_ALIAS" "$ANDROID_KEY_PASSWORD" > android/key.properties
      - name: Signed release bundle
        if: env.HAS_RELEASE_KEYSTORE == 'true'
        run: flutter build appbundle --release
      - uses: actions/upload-artifact@v4
        if: env.HAS_RELEASE_KEYSTORE == 'true'
        with: { name: juvi-release-aab, path: mobile/build/app/outputs/bundle/release/app-release.aab, retention-days: 14 }
```

Secrets reach the scripts only through `env:` (never interpolated into `run:`), and every step copes with them being empty (forks, PRs from forks).

- [ ] **Step 8: Run the tests, analyze and build**

Run: `cd mobile && flutter test test/core/firebase_boundary_test.dart`
Expected: `+2: All tests passed!`

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden && flutter test --tags golden`
Expected: `No issues found!`, `+205: All tests passed!`, `+14: All tests passed!`

Run: `cd mobile && flutter build apk --debug`
Expected: `✓ Built build/app/outputs/flutter-apk/app-debug.apk` (a warning that `firebase_core` / `firebase_crashlytics` apply the Kotlin Gradle plugin is expected — Ruling 1).

- [ ] **Step 9: Commit**

```bash
git add mobile/pubspec.yaml mobile/pubspec.lock mobile/android/settings.gradle.kts mobile/android/app/build.gradle.kts \
  mobile/android/app/google-services.placeholder.json mobile/.gitignore mobile/android/.gitignore \
  mobile/test/core/firebase_boundary_test.dart .github/workflows/mobile.yml
git commit -m "build(mobile): Firebase and notification packages, placeholder google-services.json, release signing from key.properties

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The push payload, the tray wording and the channels

**Files:**
- Create: `mobile/lib/core/push/notice_push.dart`, `mobile/test/core/push/push_fixtures.dart`, `mobile/test/core/push/notice_push_test.dart`
- Modify: `mobile/lib/app/l10n/app_en.arb` (end; regenerate `app_localizations*.dart`)

**Interfaces:**
- Consumes: the backend payload (`backend/src/modules/juvi-app/notifications/payload.ts` `buildNoticePush`).
- Produces:
  ```dart
  // lib/core/push/notice_push.dart
  class NoticePush { String deliveryId, receipt, noticeId, tier, groupKey, office, variant; int count; String? title;
    static NoticePush? tryParse(Map<String, dynamic> data); static NoticePush? fromPayload(String? payload);
    bool get isDigest; bool get isReminder; String get location; String toPayload(); }
  class TrayContent { String title; String? text; }      TrayContent trayContent(NoticePush p);
  class PushChannel { String id, name, description, importance; bool get sound; }
  const urgentChannel, importantChannel, routineChannel; const List<PushChannel> pushChannels;
  PushChannel channelFor(NoticePush p);  int stableNotificationId(String key);
  int notificationIdFor(NoticePush p);   int summaryIdFor(NoticePush p);
  // test/core/push/push_fixtures.dart
  Map<String, dynamic> pushData({String deliveryId, String tier, String variant, String count, String? title});
  ```

Decisions:
- The tray wording is the portal's `trayNotification()` (`admin-portal/src/lib/notices.ts:58`) plus the batch line; the strings are fixed English (the background isolate has no `BuildContext`) and each has an arb twin that the test compares against `AppLocalizationsEn`.
- A reminder is always on the Important channel, whatever `tier` says; the channel descriptions are the S12 tier descriptions.
- Ids are FNV-1a over `deliveryId` (Ruling 7); the group summary's id hashes `group:<groupKey>`.

- [ ] **Step 1: Add the arb entries**

In `mobile/lib/app/l10n/app_en.arb` replace the last entry:

```json
  "@channelNotices": { "description": "Channel screen section: notices whose audience matches this channel (spec §4 US-6)." }
}
```

with:

```json
  "@channelNotices": { "description": "Channel screen section: notices whose audience matches this channel (spec §4 US-6)." },
  "pushNewNoticeFrom": "New notice from {office}",
  "@pushNewNoticeFrom": { "description": "Tray title for a confidential notice (notifications spec §6.6). Mirrored as a fixed string in lib/core/push/notice_push.dart.", "placeholders": { "office": { "type": "String" } } },
  "pushReminderFrom": "Reminder from {office}",
  "@pushReminderFrom": { "description": "Tray title for a reminder about a confidential notice. Mirrored in notice_push.dart.", "placeholders": { "office": { "type": "String" } } },
  "pushReminderTitle": "Reminder: {title}",
  "@pushReminderTitle": { "description": "Tray text line for a reminder. Mirrored in notice_push.dart.", "placeholders": { "title": { "type": "String" } } },
  "pushDigest": "{count} new notices from {office}",
  "@pushDigest": { "description": "Tray title for a Routine batch. Mirrored in notice_push.dart.", "placeholders": { "count": { "type": "int" }, "office": { "type": "String" } } },
  "pushChannelUrgent": "Urgent notices",
  "pushChannelImportant": "Important notices",
  "pushChannelRoutine": "Routine notices",
  "@pushChannelRoutine": { "description": "Android notification channel names, shown in the system settings. Mirrored in notice_push.dart; the channel descriptions mirror settingsTier*Desc." }
}
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the fixture and the failing test**

```dart
// mobile/test/core/push/push_fixtures.dart
/// The FCM data message the backend builds (`backend/src/modules/juvi-app/notifications/payload.ts`):
/// every value a string, and no `title` key at all for a confidential notice or a batch.
Map<String, dynamic> pushData({
  String deliveryId = 'd00000000000000000000001',
  String tier = 'important',
  String variant = 'published',
  String count = '1',
  String? title = 'Hall tickets are out',
}) => {
  'deliveryId': deliveryId,
  'receipt': 'sig.1760000000',
  'kind': 'notice',
  'noticeId': 'n00000000000000000000001',
  'tier': tier,
  'groupKey': 'notice:n00000000000000000000001',
  'office': 'Exam Section',
  'variant': variant,
  'count': count,
  'title': ?title,
};
```

```dart
// mobile/test/core/push/notice_push_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/app_localizations_en.dart';
import 'package:juvi/core/push/notice_push.dart';

import 'push_fixtures.dart';

void main() {
  final l = AppLocalizationsEn();

  group('NoticePush.tryParse', () {
    test('reads every field of the backend payload (strings only)', () {
      final p = NoticePush.tryParse(pushData())!;
      expect(p.deliveryId, 'd00000000000000000000001');
      expect(p.receipt, 'sig.1760000000');
      expect(p.noticeId, 'n00000000000000000000001');
      expect(p.tier, 'important');
      expect(p.groupKey, 'notice:n00000000000000000000001');
      expect(p.office, 'Exam Section');
      expect(p.title, 'Hall tickets are out');
      expect(p.variant, 'published');
      expect(p.count, 1);
      expect(p.location, '/notices/n00000000000000000000001');
    });

    test('a confidential notice has no title', () {
      expect(NoticePush.tryParse(pushData(title: null))!.title, isNull);
    });

    test('a Routine batch opens the attention sheet', () {
      final p = NoticePush.tryParse(pushData(tier: 'routine', count: '3', title: null))!;
      expect(p.isDigest, isTrue);
      expect(p.location, '/attention');
    });

    test('anything that is not a well-formed notice push is ignored', () {
      expect(NoticePush.tryParse({...pushData(), 'kind': 'post'}), isNull);
      expect(NoticePush.tryParse({...pushData(), 'tier': 'loud'}), isNull);
      expect(NoticePush.tryParse(Map.of(pushData())..remove('receipt')), isNull);
      expect(NoticePush.tryParse(const {}), isNull);
    });

    test('the local-notification payload round-trips', () {
      final p = NoticePush.tryParse(pushData(title: null, variant: 'reminder'))!;
      final back = NoticePush.fromPayload(p.toPayload())!;
      expect(back.deliveryId, p.deliveryId);
      expect(back.receipt, p.receipt);
      expect(back.variant, 'reminder');
      expect(back.title, isNull);
      expect(NoticePush.fromPayload('not json'), isNull);
      expect(NoticePush.fromPayload(null), isNull);
    });
  });

  group('trayContent matches the portal tray preview', () {
    test('published: office, then title', () {
      expect(trayContent(NoticePush.tryParse(pushData())!), const TrayContent('Exam Section', 'Hall tickets are out'));
    });
    test('published, confidential: one line', () {
      expect(trayContent(NoticePush.tryParse(pushData(title: null))!), TrayContent(l.pushNewNoticeFrom('Exam Section')));
    });
    test('reminder: office, then "Reminder: <title>"', () {
      expect(trayContent(NoticePush.tryParse(pushData(variant: 'reminder'))!), TrayContent('Exam Section', l.pushReminderTitle('Hall tickets are out')));
    });
    test('reminder, confidential: one line', () {
      expect(trayContent(NoticePush.tryParse(pushData(variant: 'reminder', title: null))!), TrayContent(l.pushReminderFrom('Exam Section')));
    });
    test('Routine batch of 3: one line', () {
      expect(trayContent(NoticePush.tryParse(pushData(tier: 'routine', count: '3', title: null))!), TrayContent(l.pushDigest(3, 'Exam Section')));
    });
    test('Routine batch of 1 renders like Published', () {
      expect(trayContent(NoticePush.tryParse(pushData(tier: 'routine'))!), const TrayContent('Exam Section', 'Hall tickets are out'));
    });
  });

  group('channels', () {
    test('tier picks the channel; a reminder is always Important', () {
      expect(channelFor(NoticePush.tryParse(pushData(tier: 'urgent'))!).id, 'juvi_urgent');
      expect(channelFor(NoticePush.tryParse(pushData())!).id, 'juvi_important');
      expect(channelFor(NoticePush.tryParse(pushData(tier: 'routine'))!).id, 'juvi_routine');
      expect(channelFor(NoticePush.tryParse(pushData(tier: 'urgent', variant: 'reminder'))!).id, 'juvi_important');
    });
    test('importance and sound per tier; names mirror the arb', () {
      expect([for (final c in pushChannels) (c.id, c.importance, c.sound)], [
        ('juvi_urgent', 'max', true),
        ('juvi_important', 'high', true),
        ('juvi_routine', 'low', false),
      ]);
      expect([for (final c in pushChannels) c.name], [l.pushChannelUrgent, l.pushChannelImportant, l.pushChannelRoutine]);
      expect([for (final c in pushChannels) c.description], [l.settingsTierUrgentDesc, l.settingsTierImportantDesc, l.settingsTierRoutineDesc]);
    });
  });

  test('notification ids are stable per delivery and per group', () {
    final a = NoticePush.tryParse(pushData())!;
    final again = NoticePush.tryParse(pushData())!;
    final other = NoticePush.tryParse(pushData(deliveryId: 'd00000000000000000000002'))!;
    expect(notificationIdFor(a), notificationIdFor(again));
    expect(notificationIdFor(a), isNot(notificationIdFor(other)));
    expect(summaryIdFor(a), summaryIdFor(other));
    expect(notificationIdFor(a), inInclusiveRange(0, 0x7fffffff));
  });
}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd mobile && flutter test test/core/push/notice_push_test.dart`
Expected: FAIL — `Error: Error when reading 'lib/core/push/notice_push.dart': No such file or directory`.

- [ ] **Step 4: Implement**

```dart
// mobile/lib/core/push/notice_push.dart
import 'dart:convert';

import 'package:flutter/foundation.dart' show immutable;

/// The FCM data message for a notice (notifications spec §6.6), as built by the backend's
/// `notifications/payload.ts`: every value a string; `title` absent for a confidential
/// notice and for a Routine batch (`count` > 1). Never a body, names or deadlines.
class NoticePush {
  const NoticePush({
    required this.deliveryId,
    required this.receipt,
    required this.noticeId,
    required this.tier,
    required this.groupKey,
    required this.office,
    required this.variant,
    required this.count,
    this.title,
  });

  /// Null for anything that is not a well-formed notice push (an unknown `kind` from a
  /// later sub-project, or a missing field), which the app then ignores.
  static NoticePush? tryParse(Map<String, dynamic> data) {
    String? s(String k) => data[k] is String ? data[k] as String : null;
    final deliveryId = s('deliveryId');
    final receipt = s('receipt');
    final noticeId = s('noticeId');
    final tier = s('tier');
    final groupKey = s('groupKey');
    final office = s('office');
    if (s('kind') != 'notice' || deliveryId == null || receipt == null || noticeId == null || groupKey == null || office == null) return null;
    if (!const {'urgent', 'important', 'routine'}.contains(tier)) return null;
    return NoticePush(
      deliveryId: deliveryId,
      receipt: receipt,
      noticeId: noticeId,
      tier: tier!,
      groupKey: groupKey,
      office: office,
      variant: s('variant') == 'reminder' ? 'reminder' : 'published',
      count: int.tryParse(s('count') ?? '') ?? 1,
      title: s('title'),
    );
  }

  /// Parses the local-notification payload written by [toPayload].
  static NoticePush? fromPayload(String? payload) {
    if (payload == null) return null;
    try {
      return tryParse(Map<String, dynamic>.from(jsonDecode(payload) as Map));
    } on Object {
      return null;
    }
  }

  final String deliveryId;
  final String receipt;
  final String noticeId;

  /// `urgent | important | routine`.
  final String tier;
  final String groupKey;
  final String office;

  /// `published | reminder`.
  final String variant;

  /// Notices in this notification: more than 1 only for a Routine batch.
  final int count;
  final String? title;

  bool get isDigest => count > 1;
  bool get isReminder => variant == 'reminder';

  /// Where a tap goes: the attention sheet for a Routine batch, otherwise S04.
  String get location => isDigest ? '/attention' : '/notices/$noticeId';

  /// Carried as the local notification's payload so a tap can post `opened`.
  String toPayload() => jsonEncode({
        'kind': 'notice',
        'deliveryId': deliveryId,
        'receipt': receipt,
        'noticeId': noticeId,
        'tier': tier,
        'groupKey': groupKey,
        'office': office,
        'variant': variant,
        'count': '$count',
        'title': ?title,
      });
}

/// What the tray shows: a title line and an optional text line.
@immutable
class TrayContent {
  const TrayContent(this.title, [this.text]);
  final String title;
  final String? text;
  @override
  bool operator ==(Object other) => other is TrayContent && other.title == title && other.text == text;
  @override
  int get hashCode => Object.hash(title, text);
  @override
  String toString() => 'TrayContent($title, $text)';
}

/// The tray wording (spec §6.6), identical to the portal's `trayNotification()` in
/// `admin-portal/src/lib/notices.ts`. Fixed English strings, because the background
/// isolate has no `BuildContext`; each mirrors an `app_en.arb` entry (`pushNewNoticeFrom`,
/// `pushReminderFrom`, `pushReminderTitle`, `pushDigest`) and a test holds them equal.
TrayContent trayContent(NoticePush p) {
  if (p.isDigest) return TrayContent('${p.count} new notices from ${p.office}');
  final title = p.title;
  if (p.isReminder) return title == null ? TrayContent('Reminder from ${p.office}') : TrayContent(p.office, 'Reminder: $title');
  return title == null ? TrayContent('New notice from ${p.office}') : TrayContent(p.office, title);
}

/// One Android notification channel per tier (spec §8.2).
class PushChannel {
  const PushChannel(this.id, this.name, this.description, this.importance);
  final String id;
  final String name;
  final String description;

  /// `max | high | low`, mapped onto the plugin's `Importance` by the renderer.
  final String importance;
  bool get sound => importance != 'low';
}

// Names and descriptions mirror app_en.arb (`pushChannel*`, `settingsTier*Desc`).
const urgentChannel = PushChannel('juvi_urgent', 'Urgent notices', 'Exam changes, campus closures. Always delivered; cannot be turned off.', 'max');
const importantChannel = PushChannel('juvi_important', 'Important notices', 'Notices needing acknowledgement, department posts, mentions.', 'high');
const routineChannel = PushChannel('juvi_routine', 'Routine notices', 'Course posts and replies. Badge and digest only, no sound.', 'low');
const List<PushChannel> pushChannels = [urgentChannel, importantChannel, routineChannel];

/// A reminder is always on the Important channel; otherwise the tier picks it.
PushChannel channelFor(NoticePush p) {
  if (p.isReminder) return importantChannel;
  return switch (p.tier) {
    'urgent' => urgentChannel,
    'important' => importantChannel,
    _ => routineChannel,
  };
}

/// A stable 31-bit id (FNV-1a), so a notification re-sent after a sender lease expired
/// replaces the first one instead of appearing twice (spec §11).
int stableNotificationId(String key) {
  var h = 0x811c9dc5;
  for (final c in key.codeUnits) {
    h = ((h ^ c) * 0x01000193) & 0xffffffff;
  }
  return h & 0x7fffffff;
}

/// The id of one notification, and of its group's summary.
int notificationIdFor(NoticePush p) => stableNotificationId(p.deliveryId);
int summaryIdFor(NoticePush p) => stableNotificationId('group:${p.groupKey}');
```

- [ ] **Step 5: Run the tests and analyze**

Run: `cd mobile && flutter test test/core/push/notice_push_test.dart`
Expected: `+14: All tests passed!`

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`, `+219: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/core/push/notice_push.dart mobile/test/core/push mobile/lib/app/l10n
git commit -m "feat(mobile): notice push payload, tray wording matching the portal, tier channels and stable ids

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Delivery receipts and their offline queue

**Files:**
- Create: `mobile/lib/core/push/receipts.dart`, `mobile/test/core/push/receipts_test.dart`

**Interfaces:**
- Consumes: `wire.MobileApi.postNotificationReceipts({ReceiptsRequest receiptsRequest})`, `wire.ReceiptsRequest.fromJson` (`packages/juvi_api`); `ApiFailure.of(e)` with `status` and `isOffline` (`lib/core/http/api_failure.dart`).
- Produces:
  ```dart
  class ReceiptItem { String deliveryId, receipt, event; DateTime at; String get key; Map<String, dynamic> toJson(); factory ReceiptItem.fromJson(Map<String, dynamic>); }
  class ReceiptQueue { static const key = 'juvi.push.receipts'; static const max = 200;
    Future<List<ReceiptItem>> read(); Future<void> add(ReceiptItem); Future<void> remove(Set<String> keys); }
  class Receipts { Receipts(wire.MobileApi api, ReceiptQueue queue); Future<void> post(ReceiptItem); Future<void> drain(); }
  ```

Decisions (Ruling 3): the generated client on a session-less Dio; legacy `SharedPreferences` with `reload()` before every read (the background isolate writes the same key, and the foreground's instance caches); one queued item per `(deliveryId, event)`, newest 200; a 4xx other than 429 drops the item, offline / 429 / 5xx keep it; `drain()` sends 50 a request and stops at the first batch that cannot go.

- [ ] **Step 1: Write the failing test**

```dart
// mobile/test/core/push/receipts_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The generated client sends the body already encoded.
Map<String, dynamic> decoded(Object? body) => jsonDecode(body! as String) as Map<String, dynamic>;

ReceiptItem item(String id, {String event = 'delivered'}) =>
    ReceiptItem(deliveryId: id, receipt: 'sig.1760000000', event: event, at: DateTime.utc(2026, 10, 3, 5));

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late List<Object?> bodies;
  late Receipts receipts;
  final queue = ReceiptQueue();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    bodies = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      bodies.add(o.data);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio);
    receipts = Receipts(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), queue);
  });

  void offline() => adapter.onPost(
        '/notifications/receipts',
        (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')),
        data: Matchers.any,
      );

  test('posts one item in the contract shape and queues nothing on success', () async {
    adapter.onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000001'));
    expect(decoded(bodies.single), {
      'items': [
        {'deliveryId': 'd00000000000000000000001', 'receipt': 'sig.1760000000', 'event': 'delivered', 'at': '2026-10-03T05:00:00.000Z'},
      ],
    });
    expect(await queue.read(), isEmpty);
  });

  test('offline: the receipt is queued, once per delivery and event', () async {
    offline();
    await receipts.post(item('d00000000000000000000001'));
    await receipts.post(item('d00000000000000000000001'));
    await receipts.post(item('d00000000000000000000001', event: 'opened'));
    expect([for (final i in await queue.read()) i.key], ['d00000000000000000000001:delivered', 'd00000000000000000000001:opened']);
  });

  test('a server error or 429 keeps the receipt; a 401 RECEIPT_INVALID drops it', () async {
    adapter.onPost('/notifications/receipts', (s) => s.reply(503, {'error': {'code': 'INTERNAL', 'message': 'x'}}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000001'));
    adapter.onPost('/notifications/receipts', (s) => s.reply(429, {'error': {'code': 'COOLDOWN', 'message': 'x'}}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000002'));
    adapter.onPost('/notifications/receipts', (s) => s.reply(401, {'error': {'code': 'RECEIPT_INVALID', 'message': 'x'}}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000003'));
    expect([for (final i in await queue.read()) i.deliveryId], ['d00000000000000000000001', 'd00000000000000000000002']);
  });

  test('drain sends the queue in batches of 50 and empties it', () async {
    for (var n = 0; n < 60; n++) {
      await queue.add(item('d${n.toString().padLeft(23, '0')}'));
    }
    adapter.onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 50, 'rejected': 0}), data: Matchers.any);
    await receipts.drain();
    expect([for (final b in bodies) (decoded(b)['items'] as List).length], [50, 10]);
    expect(await queue.read(), isEmpty);
  });

  test('drain stops at the first batch that cannot be sent and keeps it', () async {
    await queue.add(item('d00000000000000000000001'));
    offline();
    await receipts.drain();
    expect(await queue.read(), hasLength(1));
  });

  test('the queue keeps the newest 200', () async {
    for (var n = 0; n < 205; n++) {
      await queue.add(item('d${n.toString().padLeft(23, '0')}'));
    }
    final kept = await queue.read();
    expect(kept, hasLength(200));
    expect(kept.first.deliveryId, 'd${5.toString().padLeft(23, '0')}');
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && flutter test test/core/push/receipts_test.dart`
Expected: FAIL — `Error when reading 'lib/core/push/receipts.dart'`.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/core/push/receipts.dart
import 'dart:convert';

import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:shared_preferences/shared_preferences.dart';

/// One `delivered` or `opened` receipt (notifications spec §7.2). The HMAC [receipt] from
/// the push authorises it, so no session is needed.
class ReceiptItem {
  const ReceiptItem({required this.deliveryId, required this.receipt, required this.event, required this.at});
  factory ReceiptItem.fromJson(Map<String, dynamic> j) => ReceiptItem(
        deliveryId: j['deliveryId'] as String,
        receipt: j['receipt'] as String,
        event: j['event'] as String,
        at: DateTime.parse(j['at'] as String),
      );
  final String deliveryId;
  final String receipt;

  /// `delivered | opened`.
  final String event;
  final DateTime at;

  /// One queued receipt per delivery and event.
  String get key => '$deliveryId:$event';
  Map<String, dynamic> toJson() => {'deliveryId': deliveryId, 'receipt': receipt, 'event': event, 'at': at.toUtc().toIso8601String()};
}

/// Receipts that could not be posted, kept in shared preferences so the background isolate
/// (which has no database connection) can add to it and the foreground can drain it.
/// Every read starts with `reload()`: the other isolate may have written since.
class ReceiptQueue {
  static const key = 'juvi.push.receipts';

  /// Receipts are worth little after the 7-day receipt expiry; the oldest go first.
  static const max = 200;

  Future<List<ReceiptItem>> read() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getString(key);
    if (raw == null) return [];
    try {
      return [for (final j in jsonDecode(raw) as List) ReceiptItem.fromJson(Map<String, dynamic>.from(j as Map))];
    } on Object {
      return [];
    }
  }

  Future<void> _write(List<ReceiptItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    if (items.isEmpty) {
      await prefs.remove(key);
    } else {
      final kept = items.length > max ? items.sublist(items.length - max) : items;
      await prefs.setString(key, jsonEncode([for (final i in kept) i.toJson()]));
    }
  }

  Future<void> add(ReceiptItem item) async {
    final items = await read();
    await _write([...items.where((i) => i.key != item.key), item]);
  }

  Future<void> remove(Set<String> keys) async {
    final items = await read();
    await _write(items.where((i) => !keys.contains(i.key)).toList());
  }
}

/// Posts receipts through the generated client on a Dio with no session (the foreground's
/// `bareDioProvider`, or a plain Dio in the background isolate). A receipt that cannot be
/// sent now is queued; one the server refuses for good is dropped.
class Receipts {
  Receipts(this._api, this._queue);
  final wire.MobileApi _api;
  final ReceiptQueue _queue;

  static const _batch = 50;

  Future<void> post(ReceiptItem item) async {
    if (!await _send([item])) await _queue.add(item);
  }

  /// Sends everything queued, 50 at a time; what still cannot be sent stays queued.
  Future<void> drain() async {
    final items = await _queue.read();
    final done = <String>{};
    for (var i = 0; i < items.length; i += _batch) {
      final chunk = items.sublist(i, i + _batch > items.length ? items.length : i + _batch);
      if (!await _send(chunk)) break;
      done.addAll(chunk.map((r) => r.key));
    }
    if (done.isNotEmpty) await _queue.remove(done);
  }

  /// True when the server has the items, or refused them in a way no retry fixes (a 4xx
  /// other than 429: an expired or forged receipt, a malformed item). False when offline,
  /// rate-limited or the server failed, so the items are kept for later.
  Future<bool> _send(List<ReceiptItem> items) async {
    try {
      await _api.postNotificationReceipts(
        receiptsRequest: wire.ReceiptsRequest.fromJson({'items': [for (final i in items) i.toJson()]}),
      );
      return true;
    } on Object catch (e) {
      final f = ApiFailure.of(e);
      final status = f.status;
      return !f.isOffline && status != null && status >= 400 && status < 500 && status != 429;
    }
  }
}
```

- [ ] **Step 4: Run the tests and analyze**

Run: `cd mobile && flutter test test/core/push/receipts_test.dart`
Expected: `+6: All tests passed!`

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`, `+225: All tests passed!`

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/push/receipts.dart mobile/test/core/push/receipts_test.dart
git commit -m "feat(mobile): HMAC delivery receipts with an offline queue shared with the background isolate

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The OS permission — onboarding step 3 and the S12 row

**Files:**
- Create: `mobile/lib/core/push/notification_permission.dart`, `mobile/test/core/push/notification_permission_test.dart`
- Modify: `mobile/android/app/src/main/kotlin/in/juvion/juvi/MainActivity.kt` (whole file), `mobile/android/app/src/main/AndroidManifest.xml:2-3`, `mobile/lib/features/onboarding/onboarding_screen.dart:8`, `:73`, `:87`, `:139-142`, `mobile/lib/features/onboarding/steps/notifications_step.dart:7-8`, `mobile/lib/features/me/settings_screen.dart:6`, `:29`, `:37`, `mobile/lib/app/l10n/app_en.arb` (end), `mobile/test/core/push/push_fixtures.dart`, `mobile/test/features/onboarding/onboarding_screen_test.dart`, `mobile/test/features/me/me_screen_test.dart`

**Interfaces:**
- Consumes: `FlutterLocalNotificationsPlugin().resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()` with `areNotificationsEnabled()` / `requestNotificationsPermission()` (FLN 22); `analyticsProvider`; `OnboardingScreen._advance` (`onboarding_screen.dart:38`).
- Produces:
  ```dart
  // lib/core/push/notification_permission.dart
  abstract class NotificationPermission { Future<bool> isGranted(); Future<bool> request(); Future<void> openSettings(); }
  class PluginNotificationPermission implements NotificationPermission { const PluginNotificationPermission(); static const settingsChannel; }
  final notificationPermissionProvider;   // Provider<NotificationPermission>, keepAlive
  final notificationsAllowedProvider;     // AsyncNotifier<bool> NotificationsAllowed: build(), recheck(), request()
  // test/core/push/push_fixtures.dart
  class FakeNotificationPermission { bool granted; bool grantOnRequest; int requests; int settingsOpened; }
  ```

Decisions (Ruling 9):
- No new package: FLN's Android plugin reads and requests the permission; a one-method `MethodChannel('in.juvion.juvi/settings')` in `MainActivity` opens this app's notification settings.
- An answer the plugin cannot give counts as allowed, so widget tests and the flow test see no prompt and no card unless they override `notificationPermissionProvider`.
- Step 3 swaps Continue/Finish for "Allow notifications" + "Not now" only while notifications are not already allowed; both continue and record `notification.permission {granted}`.

- [ ] **Step 1: Add the arb entries**

In `mobile/lib/app/l10n/app_en.arb` replace the last entry:

```json
  "@pushChannelRoutine": { "description": "Android notification channel names, shown in the system settings. Mirrored in notice_push.dart; the channel descriptions mirror settingsTier*Desc." }
}
```

with:

```json
  "@pushChannelRoutine": { "description": "Android notification channel names, shown in the system settings. Mirrored in notice_push.dart; the channel descriptions mirror settingsTier*Desc." },
  "onboardingAllowNotifications": "Allow notifications",
  "@onboardingAllowNotifications": { "description": "Onboarding step 3: shows the Android notification permission prompt, then continues (notifications spec §8.4)." },
  "onboardingNotNow": "Not now",
  "@onboardingNotNow": { "description": "Onboarding step 3: continues without asking for the permission." },
  "settingsNotificationsBlocked": "Blocked in system settings",
  "settingsNotificationsBlockedBody": "Juvi can't show notifications. Tap to allow them.",
  "@settingsNotificationsBlockedBody": { "description": "S12: shown while the OS permission is off; opens this app's notification settings." }
}
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Grow the fixture**

Replace `mobile/test/core/push/push_fixtures.dart` with:

```dart
import 'package:juvi/core/push/notification_permission.dart';

/// The FCM data message the backend builds (`backend/src/modules/juvi-app/notifications/payload.ts`):
/// every value a string, and no `title` key at all for a confidential notice or a batch.
Map<String, dynamic> pushData({
  String deliveryId = 'd00000000000000000000001',
  String tier = 'important',
  String variant = 'published',
  String count = '1',
  String? title = 'Hall tickets are out',
}) => {
  'deliveryId': deliveryId,
  'receipt': 'sig.1760000000',
  'kind': 'notice',
  'noticeId': 'n00000000000000000000001',
  'tier': tier,
  'groupKey': 'notice:n00000000000000000000001',
  'office': 'Exam Section',
  'variant': variant,
  'count': count,
  'title': ?title,
};

/// The OS permission, answered by the test: [granted] now, and what a prompt would return.
class FakeNotificationPermission implements NotificationPermission {
  FakeNotificationPermission({this.granted = false, this.grantOnRequest = true});
  bool granted;
  final bool grantOnRequest;
  int requests = 0;
  int settingsOpened = 0;
  @override
  Future<bool> isGranted() async => granted;
  @override
  Future<bool> request() async {
    requests++;
    return granted = grantOnRequest;
  }

  @override
  Future<void> openSettings() async => settingsOpened++;
}
```

- [ ] **Step 3: Write the failing tests**

```dart
// mobile/test/core/push/notification_permission_test.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/push/notification_permission.dart';

import 'push_fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('openSettings asks MainActivity for the app notification settings', () async {
    final calls = <String>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(PluginNotificationPermission.settingsChannel, (c) async {
      calls.add(c.method);
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(PluginNotificationPermission.settingsChannel, null));
    await const PluginNotificationPermission().openSettings();
    expect(calls, ['openNotificationSettings']);
  });

  test('with no Android plugin to ask, notifications count as allowed (never nag blind)', () async {
    expect(await const PluginNotificationPermission().isGranted(), isTrue);
  });

  test('NotificationsAllowed reads, re-checks and requests through the permission', () async {
    final permission = FakeNotificationPermission();
    final c = ProviderContainer(retry: (_, _) => null, overrides: [notificationPermissionProvider.overrideWithValue(permission)]);
    addTearDown(c.dispose);
    expect(await c.read(notificationsAllowedProvider.future), isFalse);
    permission.granted = true; // changed in the system settings while the app was away
    await c.read(notificationsAllowedProvider.notifier).recheck();
    expect(c.read(notificationsAllowedProvider).value, isTrue);
    permission.granted = false;
    expect(await c.read(notificationsAllowedProvider.notifier).request(), isTrue);
    expect(permission.requests, 1);
    expect(c.read(notificationsAllowedProvider).value, isTrue);
  });
}
```

In `mobile/test/features/onboarding/onboarding_screen_test.dart`:

- after `import 'package:juvi/core/models/notices.dart';` add `import 'package:juvi/core/push/notification_permission.dart';`
- after `import 'package:mocktail/mocktail.dart';` (before `import '../../core/repos/me_repository_test.dart' show meJson;`) add `import '../../core/push/push_fixtures.dart';`
- before `  group('first_notice (step 4)', () {` insert:

```dart
  group('notifications permission (step 3)', () {
    late _Repo repo;
    late _Session session;
    late SpyAnalytics analytics;
    setUp(() {
      repo = _Repo();
      session = _Session();
      analytics = SpyAnalytics();
      when(() => repo.advanceOnboarding(2)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 3, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: true));
    });
    List<Override> extra(NotificationPermission p) => [notificationPermissionProvider.overrideWithValue(p), analyticsProvider.overrideWithValue(analytics)];

    testWidgets('Allow notifications shows the OS prompt, records the answer and continues', (t) async {
      final permission = FakeNotificationPermission();
      await t.pumpWidget(host(2, repo, session, extra: extra(permission)));
      await t.pump();
      await t.pump();
      expect(find.text('Finish'), findsNothing);
      await t.tap(find.text('Allow notifications'));
      await t.pumpAndSettle();
      expect(permission.requests, 1);
      expect(analytics.events.first.$1, 'notification.permission');
      expect(analytics.events.first.$2, {'granted': true});
      expect(session.updated?.onboardingComplete, isTrue);
    });

    testWidgets('a refused prompt still continues, recorded as not granted', (t) async {
      await t.pumpWidget(host(2, repo, session, extra: extra(FakeNotificationPermission(grantOnRequest: false))));
      await t.pump();
      await t.pump();
      await t.tap(find.text('Allow notifications'));
      await t.pumpAndSettle();
      expect(analytics.events.first.$1, 'notification.permission');
      expect(analytics.events.first.$2, {'granted': false});
      expect(session.updated?.onboardingComplete, isTrue);
    });

    testWidgets('Not now continues without the prompt', (t) async {
      final permission = FakeNotificationPermission();
      await t.pumpWidget(host(2, repo, session, extra: extra(permission)));
      await t.pump();
      await t.pump();
      await t.tap(find.text('Not now'));
      await t.pumpAndSettle();
      expect(permission.requests, 0);
      expect(analytics.events.first.$1, 'notification.permission');
      expect(analytics.events.first.$2, {'granted': false});
      expect(session.updated?.onboardingComplete, isTrue);
    });

    testWidgets('a phone that already allows notifications just gets Finish', (t) async {
      await t.pumpWidget(host(2, repo, session, extra: extra(FakeNotificationPermission(granted: true))));
      await t.pump();
      await t.pump();
      expect(find.text('Allow notifications'), findsNothing);
      expect(find.text('Finish'), findsOneWidget);
    });
  });
```

In `mobile/test/features/me/me_screen_test.dart`:

- after `import 'package:juvi/core/models/models.dart';` add `import 'package:juvi/core/push/notification_permission.dart';`
- before `import '../../core/repos/me_repository_test.dart' show meJson;` add `import '../../core/push/push_fixtures.dart';`
- replace:

```dart
Widget _host(Widget screen, MeRepository repo) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
```

  with:

```dart
Widget _host(Widget screen, MeRepository repo, {NotificationPermission? permission}) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        if (permission != null) notificationPermissionProvider.overrideWithValue(permission),
```

- before `  testWidgets('a failed device sign-out says why', (t) async {` insert:

```dart
  testWidgets('S12: while the OS blocks notifications a row says so and opens the system settings', (t) async {
    final permission = FakeNotificationPermission();
    await t.pumpWidget(_host(const SettingsScreen(), _MeRepo(), permission: permission));
    await t.pumpAndSettle();
    expect(find.text('Blocked in system settings'), findsOneWidget);
    await t.tap(find.text('Blocked in system settings'));
    expect(permission.settingsOpened, 1);
  });

  testWidgets('S12: no blocked row while notifications are allowed', (t) async {
    await t.pumpWidget(_host(const SettingsScreen(), _MeRepo(), permission: FakeNotificationPermission(granted: true)));
    await t.pumpAndSettle();
    expect(find.text('Blocked in system settings'), findsNothing);
    expect(find.text('Routine'), findsOneWidget);
  });
```

- [ ] **Step 4: Run them to verify they fail**

Run: `cd mobile && flutter test test/core/push/notification_permission_test.dart test/features/onboarding test/features/me`
Expected: FAIL — `Error when reading 'lib/core/push/notification_permission.dart'`.

- [ ] **Step 5: Implement the permission**

```dart
// mobile/lib/core/push/notification_permission.dart
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notification_permission.g.dart';

/// The OS notification permission (Android 13+ `POST_NOTIFICATIONS`, spec §8.4), behind an
/// interface so widget tests never reach the plugin.
abstract class NotificationPermission {
  Future<bool> isGranted();

  /// Shows the system prompt (a no-op returning the current answer once the OS stops
  /// asking) and returns whether notifications are now allowed.
  Future<bool> request();

  /// This app's notification page in the system settings (S12, S14 "Open settings").
  Future<void> openSettings();
}

class PluginNotificationPermission implements NotificationPermission {
  const PluginNotificationPermission();

  /// Handled in `android/app/src/main/kotlin/in/juvion/juvi/MainActivity.kt`.
  static const settingsChannel = MethodChannel('in.juvion.juvi/settings');

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      FlutterLocalNotificationsPlugin().resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  /// An answer the plugin cannot give (no Android implementation, as in a widget test)
  /// counts as allowed: the app never nags about a permission it cannot read.
  @override
  Future<bool> isGranted() async {
    try {
      return await _android?.areNotificationsEnabled() ?? true;
    } on Object {
      return true;
    }
  }

  @override
  Future<bool> request() async {
    try {
      return await _android?.requestNotificationsPermission() ?? true;
    } on Object {
      return false;
    }
  }

  @override
  Future<void> openSettings() async {
    try {
      await settingsChannel.invokeMethod<void>('openNotificationSettings');
    } on Object {
      // Nothing to open on this platform.
    }
  }
}

@Riverpod(keepAlive: true)
NotificationPermission notificationPermission(Ref ref) => const PluginNotificationPermission();

/// Whether the OS lets Juvi post notifications. `PushLifecycle` re-checks it whenever the
/// app resumes (the person may have changed it in the system settings); `PushRegistration`
/// registers the token on a denied → allowed change; S12 and the S14 card watch it.
@Riverpod(keepAlive: true)
class NotificationsAllowed extends _$NotificationsAllowed {
  @override
  Future<bool> build() => ref.read(notificationPermissionProvider).isGranted();

  Future<void> recheck() async {
    final allowed = await ref.read(notificationPermissionProvider).isGranted();
    if (ref.mounted && state.value != allowed) state = AsyncData(allowed);
  }

  Future<bool> request() async {
    final allowed = await ref.read(notificationPermissionProvider).request();
    if (ref.mounted) state = AsyncData(allowed);
    return allowed;
  }
}
```

Replace the whole of `mobile/android/app/src/main/kotlin/in/juvion/juvi/MainActivity.kt` with:

```kotlin
package `in`.juvion.juvi

import android.content.Intent
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // S12 and S14 "Open settings" (lib/core/push/notification_permission.dart): this
        // app's page in the system notification settings.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.juvion.juvi/settings").setMethodCallHandler { call, result ->
            if (call.method == "openNotificationSettings") {
                startActivity(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                result.success(null)
            } else {
                result.notImplemented()
            }
        }
    }
}
```

In `mobile/android/app/src/main/AndroidManifest.xml` replace:

```xml
    <uses-permission android:name="android.permission.INTERNET"/>
```

with:

```xml
    <uses-permission android:name="android.permission.INTERNET"/>
    <!-- Android 13+ runtime permission, asked at onboarding step 3 (notifications spec §8.4).
         firebase_messaging also merges it in; declared here so the app's own manifest says so. -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

- [ ] **Step 6: Onboarding step 3 asks**

In `mobile/lib/features/onboarding/onboarding_screen.dart`:

- after `import 'package:juvi/core/models/models.dart';` add `import 'package:juvi/core/push/notification_permission.dart';`
- after the closing `}` of `_advance` (the line after `if (mounted) setState(() => _busy = false);` and its two closing braces) insert:

```dart

  /// Step 3 (notifications spec §8.4): "Allow notifications" shows the Android prompt,
  /// "Not now" does not; either way the answer is recorded and onboarding continues.
  Future<void> _answerPermission(AccountSummary account, {required bool ask}) async {
    setState(() => _busy = true);
    final granted = ask && await ref.read(notificationsAllowedProvider.notifier).request();
    ref.read(analyticsProvider).track('notification.permission', {'granted': granted});
    if (mounted) await _advance(account);
  }
```

- replace:

```dart
    final me = ref.watch(meProvider);

```

  with:

```dart
    final me = ref.watch(meProvider);
    // Step 3 asks for the OS permission unless the phone already allows notifications.
    final askPermission = name == 'notifications' && ref.watch(notificationsAllowedProvider).value != true;

```

- replace:

```dart
                child: FilledButton(onPressed: _busy ? null : () => _advance(account), child: Text(isLast ? l.onboardingFinish : l.onboardingContinue)),
```

  with:

```dart
                child: askPermission
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          FilledButton(
                            onPressed: _busy ? null : () => _answerPermission(account, ask: true),
                            child: Text(l.onboardingAllowNotifications),
                          ),
                          TextButton(
                            onPressed: _busy ? null : () => _answerPermission(account, ask: false),
                            child: Text(l.onboardingNotNow),
                          ),
                        ],
                      )
                    : FilledButton(onPressed: _busy ? null : () => _advance(account), child: Text(isLast ? l.onboardingFinish : l.onboardingContinue)),
```

In `mobile/lib/features/onboarding/steps/notifications_step.dart` replace the doc comment:

```dart
/// Step 3: an honest explanation of the three tiers and a quiet-hours toggle.
/// The OS permission prompt itself arrives with push in sub-project 3.
```

with:

```dart
/// Step 3: an honest explanation of the three tiers and a quiet-hours toggle. The OS
/// permission prompt is behind the screen's "Allow notifications" button
/// (`OnboardingScreen._answerPermission`, notifications spec §8.4).
```

- [ ] **Step 7: S12 says when the OS blocks notifications**

In `mobile/lib/features/me/settings_screen.dart`:

- after `import 'package:juvi/core/http/api_failure.dart';` add `import 'package:juvi/core/push/notification_permission.dart';`
- replace:

```dart
    final mode = ref.watch(themePreferenceProvider);
    if (settings == null)
```

  with:

```dart
    final mode = ref.watch(themePreferenceProvider);
    final blocked = ref.watch(notificationsAllowedProvider).value == false;
    if (settings == null)
```

- replace:

```dart
          SectionHeader(l.settingsTiersSection),
```

  with:

```dart
          SectionHeader(l.settingsTiersSection),
          // S12 (notifications spec §8.4): while the OS permission is off, nothing below reaches the tray.
          if (blocked)
            ListTile(
              leading: Icon(Icons.notifications_off_outlined, color: Theme.of(context).colorScheme.error),
              title: Text(l.settingsNotificationsBlocked),
              subtitle: Text(l.settingsNotificationsBlockedBody),
              trailing: const Icon(Icons.open_in_new),
              onTap: () => unawaited(ref.read(notificationPermissionProvider).openSettings()),
            ),
```

- [ ] **Step 8: Generate, run the tests and analyze**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs`

Run: `cd mobile && flutter test test/core/push/notification_permission_test.dart test/features/onboarding test/features/me`
Expected: all pass (3 new permission tests, 4 new step-3 tests, 2 new S12 tests).

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden && flutter test --tags golden`
Expected: `No issues found!`, `+234: All tests passed!`, `+14: All tests passed!`

- [ ] **Step 9: Commit**

```bash
git add mobile/lib/core/push/notification_permission.dart mobile/lib/core/push/notification_permission.g.dart \
  mobile/android/app/src/main mobile/lib/features/onboarding mobile/lib/features/me/settings_screen.dart mobile/lib/app/l10n \
  mobile/test/core/push mobile/test/features/onboarding mobile/test/features/me
git commit -m "feat(mobile): notification permission at onboarding step 3 and a Blocked row in Settings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rendering — the tray, the background handler and the foreground handler

**Files:**
- Create: `mobile/lib/core/push/local_notifications.dart`, `mobile/lib/core/push/push_handlers.dart`, `mobile/lib/core/push/background_handler.dart`, `mobile/test/core/push/push_handlers_test.dart`
- Modify: `mobile/test/core/push/push_fixtures.dart`

**Interfaces:**
- Consumes: `NoticePush`, `trayContent`, `channelFor`, `pushChannels`, `notificationIdFor`, `summaryIdFor` (Task 2); `Receipts`, `ReceiptItem`, `ReceiptQueue` (Task 3); `PluginNotificationPermission` (Task 4); `juviBaseOptions` (`lib/core/http/juvi_http.dart:16`), `AppEnv.apiBaseUrl` / `AppEnv.platform` (`lib/core/env.dart`); FLN 22's named-parameter `initialize({settings, onDidReceiveNotificationResponse})` and `show({id, title, body, notificationDetails, payload})`.
- Produces:
  ```dart
  // lib/core/push/local_notifications.dart
  abstract class LocalNotifications { Future<void> init({void Function(String? payload)? onTap}); Future<void> show(NoticePush p); Future<String?> launchPayload(); }
  class NoLocalNotifications implements LocalNotifications { const NoLocalNotifications(); }
  class PluginLocalNotifications implements LocalNotifications { PluginLocalNotifications(FlutterLocalNotificationsPlugin plugin); }
  // lib/core/push/push_handlers.dart
  Future<void> handleBackgroundPush(Map<String, dynamic> data, {required LocalNotifications local, required Receipts receipts, required Future<bool> Function() allowed, DateTime Function() now});
  Future<void> handleForegroundPush(Map<String, dynamic> data, {required LocalNotifications local, required Receipts receipts, required void Function() refresh, DateTime Function() now});
  // lib/core/push/background_handler.dart
  @pragma('vm:entry-point') Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message);
  // test/core/push/push_fixtures.dart
  class FakeLocalNotifications implements LocalNotifications { List<NoticePush> shown; String? launch; void Function(String?)? onTap; }
  ```

Decisions (Rulings 2, 4, 5, 6):
- The background handler builds a plain Dio on the compile-time `AppEnv.apiBaseUrl` (there is no stored per-institution URL) and posts with no session.
- While the OS blocks notifications the background handler neither renders nor posts `delivered`.
- Every notification is posted with its group's summary (`setAsGroupSummary`, `GroupAlertBehavior.children`); the payload is `NoticePush.toPayload()`.
- Foreground: Urgent and Important are rendered; every tier calls `refresh` and posts `delivered` (the caller, `PushLifecycle` in Task 10, passes `NoticeActions.refresh`).

- [ ] **Step 1: Grow the fixture**

Replace `mobile/test/core/push/push_fixtures.dart` with:

```dart
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';

/// The FCM data message the backend builds (`backend/src/modules/juvi-app/notifications/payload.ts`):
/// every value a string, and no `title` key at all for a confidential notice or a batch.
Map<String, dynamic> pushData({
  String deliveryId = 'd00000000000000000000001',
  String tier = 'important',
  String variant = 'published',
  String count = '1',
  String? title = 'Hall tickets are out',
}) => {
  'deliveryId': deliveryId,
  'receipt': 'sig.1760000000',
  'kind': 'notice',
  'noticeId': 'n00000000000000000000001',
  'tier': tier,
  'groupKey': 'notice:n00000000000000000000001',
  'office': 'Exam Section',
  'variant': variant,
  'count': count,
  'title': ?title,
};

/// The OS permission, answered by the test: [granted] now, and what a prompt would return.
class FakeNotificationPermission implements NotificationPermission {
  FakeNotificationPermission({this.granted = false, this.grantOnRequest = true});
  bool granted;
  final bool grantOnRequest;
  int requests = 0;
  int settingsOpened = 0;
  @override
  Future<bool> isGranted() async => granted;
  @override
  Future<bool> request() async {
    requests++;
    return granted = grantOnRequest;
  }

  @override
  Future<void> openSettings() async => settingsOpened++;
}

/// Records what would have reached the tray.
class FakeLocalNotifications implements LocalNotifications {
  final shown = <NoticePush>[];
  String? launch;
  void Function(String? payload)? onTap;
  @override
  Future<void> init({void Function(String? payload)? onTap}) async => this.onTap = onTap;
  @override
  Future<void> show(NoticePush p) async => shown.add(p);
  @override
  Future<String?> launchPayload() async => launch;
}
```

- [ ] **Step 2: Write the failing test**

```dart
// mobile/test/core/push/push_handlers_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/push_handlers.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'push_fixtures.dart';

class _Plugin extends Mock implements FlutterLocalNotificationsPlugin {}

class _Android extends Mock implements AndroidFlutterLocalNotificationsPlugin {}

void main() {
  late DioAdapter adapter;
  late List<Map<String, dynamic>> posted;
  late Receipts receipts;
  late FakeLocalNotifications local;
  final at = DateTime.utc(2026, 10, 3, 5);
  Future<bool> allowed() async => true;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    posted = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      posted.add(jsonDecode(o.data as String) as Map<String, dynamic>);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio)
      ..onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    receipts = Receipts(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), ReceiptQueue());
    local = FakeLocalNotifications();
  });

  group('background', () {
    test('renders every tier and posts delivered with no session', () async {
      for (final tier in ['urgent', 'important', 'routine']) {
        await handleBackgroundPush(pushData(tier: tier), local: local, receipts: receipts, allowed: allowed, now: () => at);
      }
      expect(local.shown.map((p) => p.tier), ['urgent', 'important', 'routine']);
      expect(posted.first, {
        'items': [
          {'deliveryId': 'd00000000000000000000001', 'receipt': 'sig.1760000000', 'event': 'delivered', 'at': '2026-10-03T05:00:00.000Z'},
        ],
      });
    });

    test('a confidential notice is rendered with only the office', () async {
      await handleBackgroundPush(pushData(title: null), local: local, receipts: receipts, allowed: allowed, now: () => at);
      expect(trayContent(local.shown.single), const TrayContent('New notice from Exam Section'));
    });

    test('offline: the delivered receipt is queued for the foreground', () async {
      adapter.onPost(
        '/notifications/receipts',
        (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')),
        data: Matchers.any,
      );
      await handleBackgroundPush(pushData(), local: local, receipts: receipts, allowed: allowed, now: () => at);
      expect(local.shown, hasLength(1));
      expect([for (final i in await ReceiptQueue().read()) i.key], ['d00000000000000000000001:delivered']);
    });

    test('while the OS blocks notifications nothing is shown and no receipt is posted', () async {
      await handleBackgroundPush(pushData(), local: local, receipts: receipts, allowed: () async => false, now: () => at);
      expect(local.shown, isEmpty);
      expect(posted, isEmpty);
      expect(await ReceiptQueue().read(), isEmpty);
    });

    test('a message that is not a notice push is ignored', () async {
      await handleBackgroundPush({'kind': 'post'}, local: local, receipts: receipts, allowed: allowed);
      expect(local.shown, isEmpty);
      expect(posted, isEmpty);
    });
  });

  group('foreground', () {
    test('Urgent and Important are rendered, Routine is not; every tier refreshes and posts delivered', () async {
      var refreshed = 0;
      for (final tier in ['urgent', 'important', 'routine']) {
        await handleForegroundPush(pushData(tier: tier), local: local, receipts: receipts, refresh: () => refreshed++, now: () => at);
      }
      expect(local.shown.map((p) => p.tier), ['urgent', 'important']);
      expect(refreshed, 3);
      expect(posted, hasLength(3));
    });
  });

  group('PluginLocalNotifications', () {
    late _Plugin plugin;
    late _Android android;
    setUpAll(() {
      registerFallbackValue(const AndroidNotificationChannel('x', 'x'));
      registerFallbackValue(const InitializationSettings());
    });
    setUp(() {
      plugin = _Plugin();
      android = _Android();
      when(() => plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()).thenReturn(android);
      when(() => android.createNotificationChannel(any())).thenAnswer((_) async {});
      when(() => plugin.initialize(settings: any(named: 'settings'), onDidReceiveNotificationResponse: any(named: 'onDidReceiveNotificationResponse')))
          .thenAnswer((_) async => true);
      when(() => plugin.show(
            id: any(named: 'id'),
            title: any(named: 'title'),
            body: any(named: 'body'),
            notificationDetails: any(named: 'notificationDetails'),
            payload: any(named: 'payload'),
          )).thenAnswer((_) async {});
    });

    test('init creates the three channels at their importance', () async {
      await PluginLocalNotifications(plugin).init();
      final channels = verify(() => android.createNotificationChannel(captureAny())).captured.cast<AndroidNotificationChannel>();
      expect([for (final c in channels) (c.id, c.importance, c.playSound)], [
        ('juvi_urgent', Importance.max, true),
        ('juvi_important', Importance.high, true),
        ('juvi_routine', Importance.low, false),
      ]);
    });

    test('show posts the notification and its group summary on the tier channel, with stable ids', () async {
      final p = NoticePush.tryParse(pushData(tier: 'urgent'))!;
      await PluginLocalNotifications(plugin).show(p);
      final calls = verify(() => plugin.show(
            id: captureAny(named: 'id'),
            title: captureAny(named: 'title'),
            body: captureAny(named: 'body'),
            notificationDetails: captureAny(named: 'notificationDetails'),
            payload: captureAny(named: 'payload'),
          )).captured;
      // Five captures per call: id, title, body, details, payload.
      expect(calls[0], notificationIdFor(p));
      expect([calls[1], calls[2]], ['Exam Section', 'Hall tickets are out']);
      final details = (calls[3] as NotificationDetails).android!;
      expect([details.channelId, details.importance, details.priority, details.groupKey, details.setAsGroupSummary],
          ['juvi_urgent', Importance.max, Priority.max, 'notice:n00000000000000000000001', false]);
      expect(NoticePush.fromPayload(calls[4] as String)!.deliveryId, p.deliveryId);
      expect(calls[5], summaryIdFor(p));
      final summary = (calls[8] as NotificationDetails).android!;
      expect([summary.groupKey, summary.setAsGroupSummary, summary.groupAlertBehavior], ['notice:n00000000000000000000001', true, GroupAlertBehavior.children]);
    });
  });
}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd mobile && flutter test test/core/push/push_handlers_test.dart`
Expected: FAIL — `Error when reading 'lib/core/push/local_notifications.dart'`.

- [ ] **Step 4: Implement the tray**

```dart
// mobile/lib/core/push/local_notifications.dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';

/// The tray, behind an interface so tests never touch the plugin (spec §8.2).
abstract class LocalNotifications {
  /// Initialises the plugin and creates the three tier channels. [onTap] receives the
  /// payload of a notification tapped while the app is running.
  Future<void> init({void Function(String? payload)? onTap});

  /// Shows [p] on its tier's channel, grouped by `groupKey` under a summary, with an id
  /// derived from `deliveryId` so a duplicate send replaces rather than repeats.
  Future<void> show(NoticePush p);

  /// The payload of the notification whose tap launched the app, if one did.
  Future<String?> launchPayload();
}

/// The default until `main()` initialises the plugin: widget tests and builds without
/// Firebase never render anything.
class NoLocalNotifications implements LocalNotifications {
  const NoLocalNotifications();
  @override
  Future<void> init({void Function(String? payload)? onTap}) async {}
  @override
  Future<void> show(NoticePush p) async {}
  @override
  Future<String?> launchPayload() async => null;
}

class PluginLocalNotifications implements LocalNotifications {
  PluginLocalNotifications(this._plugin);
  final FlutterLocalNotificationsPlugin _plugin;

  static const Map<String, Importance> _importance = {'max': Importance.max, 'high': Importance.high, 'low': Importance.low};
  static const Map<String, Priority> _priority = {'max': Priority.max, 'high': Priority.high, 'low': Priority.low};

  @override
  Future<void> init({void Function(String? payload)? onTap}) async {
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: onTap == null ? null : (r) => onTap(r.payload),
    );
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    for (final c in pushChannels) {
      await android?.createNotificationChannel(AndroidNotificationChannel(
        c.id,
        c.name,
        description: c.description,
        importance: _importance[c.importance]!,
        playSound: c.sound,
      ));
    }
  }

  AndroidNotificationDetails _details(PushChannel c, NoticePush p, {bool summary = false}) => AndroidNotificationDetails(
        c.id,
        c.name,
        channelDescription: c.description,
        importance: _importance[c.importance]!,
        priority: _priority[c.importance]!,
        playSound: c.sound,
        groupKey: p.groupKey,
        setAsGroupSummary: summary,
        // Only the notification itself alerts; its group summary never rings a second time.
        groupAlertBehavior: GroupAlertBehavior.children,
      );

  @override
  Future<void> show(NoticePush p) async {
    final content = trayContent(p);
    final channel = channelFor(p);
    await _plugin.show(
      id: notificationIdFor(p),
      title: content.title,
      body: content.text,
      notificationDetails: NotificationDetails(android: _details(channel, p)),
      payload: p.toPayload(),
    );
    await _plugin.show(
      id: summaryIdFor(p),
      title: content.title,
      body: content.text,
      notificationDetails: NotificationDetails(android: _details(channel, p, summary: true)),
      payload: p.toPayload(),
    );
  }

  @override
  Future<String?> launchPayload() async {
    final details = await _plugin.getNotificationAppLaunchDetails();
    return (details?.didNotificationLaunchApp ?? false) ? details?.notificationResponse?.payload : null;
  }
}
```

- [ ] **Step 5: Implement the two handlers**

```dart
// mobile/lib/core/push/push_handlers.dart
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/receipts.dart';

/// A push received while the app is in the background or killed (spec §8.2): render it on
/// its tier's channel, whatever the tier, then post `delivered` (queued when offline).
/// While the OS blocks notifications nothing can reach the tray, so nothing is posted and
/// Reach keeps the person under "Not delivered". Called from
/// `firebaseMessagingBackgroundHandler` in its own isolate.
Future<void> handleBackgroundPush(
  Map<String, dynamic> data, {
  required LocalNotifications local,
  required Receipts receipts,
  required Future<bool> Function() allowed,
  DateTime Function() now = DateTime.now,
}) async {
  final p = NoticePush.tryParse(data);
  if (p == null || !await allowed()) return;
  await local.show(p);
  await receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'delivered', at: now().toUtc()));
}

/// A push received in the foreground (spec §8.2): Urgent and Important are rendered; every
/// tier refreshes what shows notices ([refresh]: the attention stack and Due badge, the
/// lists, any open S04), and `delivered` is posted.
Future<void> handleForegroundPush(
  Map<String, dynamic> data, {
  required LocalNotifications local,
  required Receipts receipts,
  required void Function() refresh,
  DateTime Function() now = DateTime.now,
}) async {
  final p = NoticePush.tryParse(data);
  if (p == null) return;
  if (p.tier != 'routine') await local.show(p);
  refresh();
  await receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'delivered', at: now().toUtc()));
}
```

- [ ] **Step 6: Implement FCM's background entry point**

```dart
// mobile/lib/core/push/background_handler.dart
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:juvi/core/env.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_handlers.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:package_info_plus/package_info_plus.dart';

/// FCM's background entry point (spec §8.2), registered in `main()` with
/// `FirebaseMessaging.onBackgroundMessage`. It runs in its own isolate, often after the app
/// was killed, with no providers, no database and usually an expired access token — so it
/// builds a plain Dio on the compile-time base URL and posts the HMAC receipt without a
/// session.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  String version;
  try {
    version = (await PackageInfo.fromPlatform()).version;
  } on Object {
    version = '0.0.0';
  }
  final dio = Dio(juviBaseOptions(baseUrl: AppEnv.apiBaseUrl, appVersion: version, platform: AppEnv.platform));
  final api = wire.JuviApi(dio: dio, basePathOverride: AppEnv.apiBaseUrl).getMobileApi();
  final local = PluginLocalNotifications(FlutterLocalNotificationsPlugin());
  await local.init();
  await handleBackgroundPush(
    message.data,
    local: local,
    receipts: Receipts(api, ReceiptQueue()),
    allowed: const PluginNotificationPermission().isGranted,
  );
}
```

It is registered in `main()` in Task 10; `test/core/firebase_boundary_test.dart` already allows its `firebase_messaging` import.

- [ ] **Step 7: Run the tests and analyze**

Run: `cd mobile && flutter test test/core/push/push_handlers_test.dart test/core/firebase_boundary_test.dart`
Expected: `+10: All tests passed!` (8 handler tests, 2 boundary tests)

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`, `+242: All tests passed!`

- [ ] **Step 8: Commit**

```bash
git add mobile/lib/core/push mobile/test/core/push
git commit -m "feat(mobile): render notice pushes on tier channels, grouped, and post delivered receipts from the background

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: S14 — the permission-denied card on Today and Teaching

**Files:**
- Create: `mobile/lib/features/notifications/permission_card.dart`, `mobile/test/features/notifications/permission_card_test.dart`, `mobile/test/features/notifications/permission_card_golden_test.dart`, `mobile/test/features/notifications/goldens/permission_card_light.png`, `…_dark.png` (generated)
- Modify: `mobile/lib/features/home/today_shell_screen.dart:8`, `:16-17`, `:36`, `mobile/lib/features/home/teaching_shell_screen.dart:8`, `:16`, `:49`, `mobile/lib/app/l10n/app_en.arb` (end), `mobile/test/features/home/today_shell_test.dart`

**Interfaces:**
- Consumes: `notificationsAllowedProvider`, `notificationPermissionProvider` (Task 4); `analyticsProvider`; `FakeNotificationPermission` (Task 4 fixture); `SpyAnalytics` (`test/features/notices/notice_actions_test.dart:23`).
- Produces:
  ```dart
  const permissionCardCooldown = Duration(days: 30);
  bool permissionCardDue({required bool? allowed, required DateTime? dismissedAt, required DateTime now});
  final permissionCardDismissalProvider;   // AsyncNotifier<DateTime?> PermissionCardDismissal: key 'juvi.permission_card.dismissed_at', dismiss(DateTime)
  class PermissionCard extends ConsumerStatefulWidget { const PermissionCard({DateTime Function()? now}); }
  class PermissionDeniedCard extends StatelessWidget { const PermissionDeniedCard({required VoidCallback onOpenSettings, required VoidCallback onDismiss}); }
  ```

Decisions (Ruling 10):
- The card sits between the header (and the as-of line) and the attention section, on Today and on Teaching.
- It stays hidden until both the permission and the dismissal date have loaded (no flash), is due while the permission is off and at least 30 days after the last dismissal, and records `permission_card.shown` once per appearance and `permission_card.dismissed` on "Not now".
- The re-check on resume lives in `PushLifecycle` (Task 10).
- `OverflowBar` stacks the two buttons at large text scales.

- [ ] **Step 1: Add the arb entries**

In `mobile/lib/app/l10n/app_en.arb` replace the last entry:

```json
  "@settingsNotificationsBlockedBody": { "description": "S12: shown while the OS permission is off; opens this app's notification settings." }
}
```

with:

```json
  "@settingsNotificationsBlockedBody": { "description": "S12: shown while the OS permission is off; opens this app's notification settings." },
  "permissionCardTitle": "Notifications are off",
  "permissionCardBody": "You won't hear about Urgent notices, reminders or deadlines until you allow notifications.",
  "permissionCardOpenSettings": "Open settings",
  "permissionCardDismiss": "Not now",
  "@permissionCardDismiss": { "description": "S14 permission-denied card on Today/Teaching (notifications spec §8.4); dismissing hides it for 30 days." }
}
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/features/notifications/permission_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/features/notifications/permission_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/push/push_fixtures.dart';
import '../notices/notice_actions_test.dart' show SpyAnalytics;

final now = DateTime.utc(2026, 10, 3, 9);

Widget host(FakeNotificationPermission permission, SpyAnalytics analytics) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        notificationPermissionProvider.overrideWithValue(permission),
        analyticsProvider.overrideWithValue(analytics),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: ListView(children: [PermissionCard(now: () => now)])),
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('the card is due while denied, then again 30 days after a dismissal', () {
    expect(permissionCardDue(allowed: false, dismissedAt: null, now: now), isTrue);
    expect(permissionCardDue(allowed: true, dismissedAt: null, now: now), isFalse);
    expect(permissionCardDue(allowed: null, dismissedAt: null, now: now), isFalse);
    expect(permissionCardDue(allowed: false, dismissedAt: now.subtract(const Duration(days: 29, hours: 23)), now: now), isFalse);
    expect(permissionCardDue(allowed: false, dismissedAt: now.subtract(const Duration(days: 30)), now: now), isTrue);
  });

  testWidgets('denied: the card shows once, and Open settings opens the system settings', (t) async {
    final permission = FakeNotificationPermission();
    final analytics = SpyAnalytics();
    await t.pumpWidget(host(permission, analytics));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsOneWidget);
    expect(analytics.events.map((e) => e.$1), ['permission_card.shown']);
    await t.tap(find.text('Open settings'));
    expect(permission.settingsOpened, 1);
  });

  testWidgets('Not now hides it, remembers when, and records the dismissal', (t) async {
    final analytics = SpyAnalytics();
    await t.pumpWidget(host(FakeNotificationPermission(), analytics));
    await t.pumpAndSettle();
    await t.tap(find.text('Not now'));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsNothing);
    expect(analytics.events.map((e) => e.$1), ['permission_card.shown', 'permission_card.dismissed']);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(PermissionCardDismissal.key), now.toIso8601String());
  });

  testWidgets('dismissed 10 days ago: still hidden', (t) async {
    SharedPreferences.setMockInitialValues({PermissionCardDismissal.key: now.subtract(const Duration(days: 10)).toIso8601String()});
    final analytics = SpyAnalytics();
    await t.pumpWidget(host(FakeNotificationPermission(), analytics));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsNothing);
    expect(analytics.events, isEmpty);
  });

  testWidgets('dismissed 31 days ago: shown again', (t) async {
    SharedPreferences.setMockInitialValues({PermissionCardDismissal.key: now.subtract(const Duration(days: 31)).toIso8601String()});
    await t.pumpWidget(host(FakeNotificationPermission(), SpyAnalytics()));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsOneWidget);
  });

  testWidgets('allowed: no card', (t) async {
    await t.pumpWidget(host(FakeNotificationPermission(granted: true), SpyAnalytics()));
    await t.pumpAndSettle();
    expect(find.byType(PermissionDeniedCard), findsNothing);
  });

  testWidgets('text scale 2.0 lays out without overflow', (t) async {
    await t.pumpWidget(MediaQuery(data: const MediaQueryData(textScaler: TextScaler.linear(2)), child: host(FakeNotificationPermission(), SpyAnalytics())));
    await t.pumpAndSettle();
    expect(find.text('Open settings'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
```

```dart
// mobile/test/features/notifications/permission_card_golden_test.dart
@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/features/notifications/permission_card.dart';

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('PermissionDeniedCard golden ${brightness.name}', (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 320));
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(accent: const Color(0xFF0B5FA5), brightness: brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: Center(child: PermissionDeniedCard(onOpenSettings: () {}, onDismiss: () {}))),
      ));
      await expectLater(find.byType(PermissionDeniedCard), matchesGoldenFile('goldens/permission_card_${brightness.name}.png'));
    });
  }
}
```

In `mobile/test/features/home/today_shell_test.dart`:

- after `import 'package:juvi/core/models/notices.dart';` add `import 'package:juvi/core/push/notification_permission.dart';`
- after `import 'package:juvi/features/notices/widgets/notice_card.dart';` add `import 'package:juvi/features/notifications/permission_card.dart';`
- after `import 'package:juvi/shared/widgets/skeleton.dart';` add `import 'package:shared_preferences/shared_preferences.dart';`
- before `import '../../core/repos/me_repository_test.dart' show meJson;` add `import '../../core/push/push_fixtures.dart';`
- replace:

```dart
Widget host(Stream<Cached<Me>> Function() stream, {Map<String, dynamic>? attention, Widget home = const TodayShellScreen()}) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
```

  with:

```dart
Widget host(Stream<Cached<Me>> Function() stream, {Map<String, dynamic>? attention, Widget home = const TodayShellScreen(), NotificationPermission? permission}) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        if (permission != null) notificationPermissionProvider.overrideWithValue(permission),
```

- before `  testWidgets('offline with cache shows the as-of line', (t) async {` insert:

```dart
  testWidgets('notifications off: the S14 card sits above the attention stack, on Today and Teaching', (t) async {
    SharedPreferences.setMockInitialValues({});
    for (final home in const [TodayShellScreen(), TeachingShellScreen()]) {
      await t.pumpWidget(host(() async* { yield Cached(me, DateTime.now()); }, home: home, permission: FakeNotificationPermission()));
      await t.pumpAndSettle();
      expect(find.byType(PermissionDeniedCard), findsOneWidget);
    }
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd mobile && flutter test test/features/notifications test/features/home --exclude-tags golden`
Expected: FAIL — `Error when reading 'lib/features/notifications/permission_card.dart'`.

- [ ] **Step 4: Implement the card**

```dart
// mobile/lib/features/notifications/permission_card.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'permission_card.g.dart';

/// S14 comes back at most once every 30 days after it is dismissed (spec §8.4).
const permissionCardCooldown = Duration(days: 30);

bool permissionCardDue({required bool? allowed, required DateTime? dismissedAt, required DateTime now}) =>
    allowed == false && (dismissedAt == null || now.difference(dismissedAt) >= permissionCardCooldown);

/// When S14 was last dismissed, kept in shared preferences (a device setting, so it
/// survives sign-out).
@Riverpod(keepAlive: true)
class PermissionCardDismissal extends _$PermissionCardDismissal {
  static const key = 'juvi.permission_card.dismissed_at';

  @override
  Future<DateTime?> build() async {
    final raw = (await SharedPreferences.getInstance()).getString(key);
    return raw == null ? null : DateTime.tryParse(raw);
  }

  Future<void> dismiss(DateTime at) async {
    state = AsyncData(at);
    await (await SharedPreferences.getInstance()).setString(key, at.toUtc().toIso8601String());
  }
}

/// S14 on Today and Teaching: shown while the OS permission is off and the card is due.
/// Records `permission_card.shown` once per appearance and `permission_card.dismissed`.
class PermissionCard extends ConsumerStatefulWidget {
  const PermissionCard({this.now, super.key});

  /// Fixed in tests; the wall clock otherwise.
  final DateTime Function()? now;

  @override
  ConsumerState<PermissionCard> createState() => _PermissionCardState();
}

class _PermissionCardState extends ConsumerState<PermissionCard> {
  bool _trackedShown = false;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  Widget build(BuildContext context) {
    final allowed = ref.watch(notificationsAllowedProvider).value;
    final dismissal = ref.watch(permissionCardDismissalProvider);
    // Until the dismissal date has loaded, the card stays hidden rather than flashing.
    final due = dismissal.hasValue && permissionCardDue(allowed: allowed, dismissedAt: dismissal.value, now: _now());
    if (!due) {
      _trackedShown = false;
      return const SizedBox.shrink();
    }
    if (!_trackedShown) {
      _trackedShown = true;
      ref.read(analyticsProvider).track('permission_card.shown');
    }
    return PermissionDeniedCard(
      onOpenSettings: () => unawaited(ref.read(notificationPermissionProvider).openSettings()),
      onDismiss: () {
        ref.read(analyticsProvider).track('permission_card.dismissed');
        unawaited(ref.read(permissionCardDismissalProvider.notifier).dismiss(_now()));
      },
    );
  }
}

/// The card itself, presentational (golden-tested).
class PermissionDeniedCard extends StatelessWidget {
  const PermissionDeniedCard({required this.onOpenSettings, required this.onDismiss, super.key});
  final VoidCallback onOpenSettings;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      color: scheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2, right: 12),
                  child: Icon(Icons.notifications_off_outlined, color: scheme.onErrorContainer),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.permissionCardTitle, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: scheme.onErrorContainer)),
                      const SizedBox(height: 4),
                      Text(l.permissionCardBody, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onErrorContainer)),
                    ],
                  ),
                ),
              ],
            ),
            // OverflowBar stacks the buttons instead of overflowing at large text scales.
            OverflowBar(
              alignment: MainAxisAlignment.end,
              overflowAlignment: OverflowBarAlignment.end,
              spacing: 8,
              children: [
                TextButton(onPressed: onDismiss, child: Text(l.permissionCardDismiss)),
                FilledButton.tonal(onPressed: onOpenSettings, child: Text(l.permissionCardOpenSettings)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Show it on Today and Teaching**

In `mobile/lib/features/home/today_shell_screen.dart`:

- after `import 'package:juvi/features/notices/widgets/attention_stack.dart';` add `import 'package:juvi/features/notifications/permission_card.dart';`
- replace the doc comment:

```dart
/// S03: header, the attention stack (acknowledgement notices, notices spec §4 US-3.1)
/// and two designed empty states. Timeline and At a glance arrive in sub-project 4.
```

  with:

```dart
/// S03: header, the S14 permission card when notifications are off (notifications spec
/// §8.4), the attention stack (acknowledgement notices, notices spec §4 US-3.1) and two
/// designed empty states. Timeline and At a glance arrive in sub-project 4.
```

- replace:

```dart
                if (c.stale) AsOfLine(c.asOf),
                SectionHeader(
                  l.todayAttentionSection,
```

  with:

```dart
                if (c.stale) AsOfLine(c.asOf),
                const PermissionCard(),
                SectionHeader(
                  l.todayAttentionSection,
```

In `mobile/lib/features/home/teaching_shell_screen.dart`:

- after `import 'package:juvi/features/notices/widgets/attention_stack.dart';` add `import 'package:juvi/features/notifications/permission_card.dart';`
- replace `/// Faculty home shell (S10): my acknowledgements (the attention stack, notices spec` with:

```dart
/// Faculty home shell (S10): the S14 permission card when notifications are off
/// (notifications spec §8.4), then my acknowledgements (the attention stack, notices spec
```

- replace:

```dart
                if (c.stale) AsOfLine(c.asOf),
                SectionHeader(
                  l.teachingAcknowledgementsSection,
```

  with:

```dart
                if (c.stale) AsOfLine(c.asOf),
                const PermissionCard(),
                SectionHeader(
                  l.teachingAcknowledgementsSection,
```

- [ ] **Step 6: Generate, create the goldens, run the tests and analyze**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs`

Run: `cd mobile && flutter test --tags golden test/features/notifications --update-goldens`
Expected: `+2: All tests passed!`, writing `goldens/permission_card_light.png` and `goldens/permission_card_dark.png`.

Run: `cd mobile && flutter test test/features/notifications test/features/home --exclude-tags golden`
Expected: `+13: All tests passed!` (7 card tests, 6 home tests)

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden && flutter test --tags golden`
Expected: `No issues found!`, `+250: All tests passed!`, `+16: All tests passed!`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/features/notifications mobile/lib/features/home mobile/lib/app/l10n mobile/test/features/notifications mobile/test/features/home
git commit -m "feat(mobile): S14 permission-denied card on Today and Teaching, back at most every 30 days

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `BatchingAnalytics` — the `analytics_events` queue and `/v1/events`

**Files:**
- Create: `mobile/lib/core/analytics/batching_analytics.dart`, `mobile/test/core/analytics/batching_analytics_test.dart`
- Modify: `mobile/lib/core/analytics/analytics.dart` (whole file), `mobile/lib/core/storage/app_database.dart:40`, `:98`, `:130-131`, `:189-192`, `mobile/lib/core/sync/sync_lifecycle.dart:5`, `:14-15`, `:50-55`, `mobile/lib/features/notices/notice_detail_screen.dart:29`, `:51`, `mobile/test/features/notices/notice_detail_screen_test.dart:70`, `:76`, `mobile/test/core/storage/app_database_test.dart` (end), `mobile/test/core/sync/sync_lifecycle_test.dart`

**Interfaces:**
- Consumes: `wire.MobileApi.postEvents({EventsRequest eventsRequest})`, `wire.EventsRequest.fromJson`, `wire.EventsRequestEventsInnerNameEnum.values` (`packages/juvi_api/lib/src/model/events_request_events_inner.dart`); `appDatabaseProvider`, `mobileApiProvider`, `sessionControllerProvider`.
- Produces:
  ```dart
  // lib/core/storage/app_database.dart (schema 2)
  class AnalyticsEvents extends Table;  class QueuedEvent { int id; String name; DateTime at; Map<String, dynamic> props; }
  static const AppDatabase.analyticsCap = 1000;
  Future<void> enqueueEvent(String name, DateTime at, Map<String, Object> props); Future<int> eventCount();
  Future<List<QueuedEvent>> eventBatch(int limit); Future<void> removeEvents(Iterable<int> ids);   // wipe() also clears it
  // lib/core/analytics/batching_analytics.dart
  final Set<String> eventNames;   Map<String, Object> sanitizeProps(Map<String, Object?> props);
  class BatchingAnalytics implements Analytics {
    BatchingAnalytics({required database, required api, required signedIn, Duration flushEvery = 30 s, int flushAt = 20, DateTime Function() now, void Function(String)? log});
    Future<void> flush(); void dispose(); }
  // lib/core/analytics/analytics.dart
  analyticsProvider → BatchingAnalytics   // the Analytics interface is unchanged; ConsoleAnalytics is removed
  ```

Decisions (Rulings 11–13):
- The allow-list comes from the generated enum.
- Props are sanitised on the device.
- S04's `notice.opened` becomes `notice.seen`.
- Only a signed-in session queues and flushes; the 30 s timer is one-shot from the first unsent event; 401 / 429 / 5xx / offline keep the batch, another 4xx drops it.
- `SyncLifecycle` flushes on `AppLifecycleState.paused`.
- Schema 2's migration is tested on a hand-built version-1 database.
- The `BatchingAnalytics` constructor uses Dart 3.12's private named initialising formals (`required this._database` is called as `database:`).

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/core/analytics/batching_analytics_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/analytics/batching_analytics.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart';

void main() {
  late AppDatabase db;
  late DioAdapter adapter;
  late List<Map<String, dynamic>> posted;
  late MobileApi api;
  var signedIn = true;
  final at = DateTime.utc(2026, 10, 3, 5);

  setUp(() {
    db = AppDatabase.memory();
    signedIn = true;
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    posted = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      posted.add(jsonDecode(o.data as String) as Map<String, dynamic>);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio)..onPost('/events', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    api = JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi();
  });
  tearDown(() => db.close());

  BatchingAnalytics build({Duration flushEvery = const Duration(minutes: 5), List<String>? log}) => BatchingAnalytics(
        database: () async => db,
        api: () => api,
        signedIn: () => signedIn,
        flushEvery: flushEvery,
        now: () => at,
        log: log?.add,
      );

  /// `track` is fire-and-forget; let its database writes (and any flush) finish.
  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 50));

  /// Waits (up to 5 s) for a flush that `track` started in the background.
  Future<void> untilPosted(int n) async {
    for (var i = 0; i < 500 && posted.length < n; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    await settle();
  }

  test('queues allow-listed events with sanitised props', () async {
    final a = build()
      ..track('notice.acknowledged', {'noticeId': '66f1c0ffee0000000000abcd', 'late': null, 'method': 'hold'})
      ..track('settings.changed', {'key': 'tiers,quietHours'})
      ..track('notice.opened', {'noticeId': 'x'});
    await settle();
    final queued = await db.eventBatch(10);
    // `late: null` and the comma-joined key break the server's prop rules and are dropped;
    // `notice.opened` is not on the allow-list.
    expect([for (final e in queued) e.name], ['notice.acknowledged', 'settings.changed']);
    expect([for (final e in queued) e.props], [
      {'noticeId': '66f1c0ffee0000000000abcd', 'method': 'hold'},
      <String, dynamic>{},
    ]);
    a.dispose();
  });

  test('sanitizeProps keeps ids, numbers and booleans, and at most ten keys', () {
    expect(sanitizeProps({'a': 'ok_id:1.2-3', 'b': 'has space', 'c': 3, 'd': double.nan, 'e': true, 'f': null, 'g': 'x' * 65, 'bad key': 1}),
        {'a': 'ok_id:1.2-3', 'c': 3, 'e': true});
    expect(sanitizeProps({for (var i = 0; i < 12; i++) 'k$i': i}).length, 10);
  });

  test('nothing is queued while signed out (the server needs a session)', () async {
    signedIn = false;
    final log = <String>[];
    build(log: log).track('app.opened');
    await settle();
    expect(await db.eventCount(), 0);
    expect(log, ['[analytics] app.opened ']);
  });

  test('flushes at 20 queued events, in the contract shape', () async {
    final a = build();
    for (var i = 0; i < 20; i++) {
      a.track('onboarding.step_completed', {'step': i});
    }
    await untilPosted(1);
    expect(posted, hasLength(1));
    final events = posted.single['events'] as List;
    expect(events, hasLength(20));
    expect(events.first, {'at': '2026-10-03T05:00:00.000Z', 'name': 'onboarding.step_completed', 'props': {'step': 0}});
    expect(await db.eventCount(), 0);
    a.dispose();
  });

  test('flushes on the timer after the first unsent event', () async {
    final a = build(flushEvery: const Duration(milliseconds: 20))..track('app.opened');
    await untilPosted(1);
    expect(posted, hasLength(1));
    expect(await db.eventCount(), 0);
    a.dispose();
  });

  test('flush on demand (the app went to the background) sends 100 a request', () async {
    for (var i = 0; i < 150; i++) {
      await db.enqueueEvent('app.opened', at, const {});
    }
    await build().flush();
    expect([for (final p in posted) (p['events'] as List).length], [100, 50]);
    expect(await db.eventCount(), 0);
  });

  test('offline or a server error keeps the queue; a 400 drops the batch', () async {
    await db.enqueueEvent('app.opened', at, const {});
    adapter.onPost('/events', (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')), data: Matchers.any);
    final a = build();
    await a.flush();
    expect(await db.eventCount(), 1);
    adapter.onPost('/events', (s) => s.reply(503, {'error': {'code': 'INTERNAL', 'message': 'x'}}), data: Matchers.any);
    await a.flush();
    expect(await db.eventCount(), 1);
    adapter.onPost('/events', (s) => s.reply(400, {'error': {'code': 'VALIDATION_FAILED', 'message': 'x'}}), data: Matchers.any);
    await a.flush();
    expect(await db.eventCount(), 0);
    a.dispose();
  });

  test('the queue keeps the newest 1,000 and sign-out wipes it', () async {
    for (var i = 0; i < 1005; i++) {
      await db.enqueueEvent('onboarding.step_completed', at, {'step': i});
    }
    expect(await db.eventCount(), 1000);
    expect((await db.eventBatch(1)).single.props, {'step': 5});
    await db.wipe();
    expect(await db.eventCount(), 0);
  });
}
```

Append to `mobile/test/core/storage/app_database_test.dart`, inside `main()` after the closing `});` of the `openRecovering` group:

```dart
  test('schema 2 migration: a version-1 database keeps its cache and gains analytics_events', () async {
    final v1 = AppDatabase(NativeDatabase.memory(setup: (raw) {
      raw
        ..execute('CREATE TABLE kv_cache (key TEXT NOT NULL PRIMARY KEY, json TEXT NOT NULL, as_of INTEGER NOT NULL)')
        ..execute('CREATE TABLE pending_actions (id TEXT NOT NULL PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT)')
        ..execute("INSERT INTO kv_cache VALUES ('me', '{\"a\":1}', 1759467600)")
        ..execute('PRAGMA user_version = 1');
    }));
    addTearDown(v1.close);
    expect((await v1.readDoc('me'))!.json, {'a': 1});
    await v1.enqueueEvent('app.opened', DateTime.utc(2026, 10, 3), const {});
    expect(await v1.eventCount(), 1);
  });
```

In `mobile/test/core/sync/sync_lifecycle_test.dart`:

- after `import 'package:juvi/core/analytics/analytics.dart';` add `import 'package:juvi/core/analytics/batching_analytics.dart';`
- replace:

```dart
/// A spy in place of `ConsoleAnalytics` — records every tracked event name.
```

  with:

```dart
/// A spy in place of `BatchingAnalytics` — records every tracked event name.
```

- before `Widget host({` insert:

```dart
/// Counts flushes; queues nothing (never signed in).
class _FlushSpy extends BatchingAnalytics {
  _FlushSpy() : super(database: () => Completer<AppDatabase>().future, api: () => throw UnimplementedError(), signedIn: () => false);
  int flushes = 0;
  @override
  Future<void> flush() async => flushes++;
}

```

- before `  testWidgets('an action queued before launch is sent at startup (I2)', (t) async {` insert:

```dart
  testWidgets('going to the background flushes queued analytics (notifications spec §8.7)', (t) async {
    final controller = StreamController<bool>();
    addTearDown(controller.close);
    final spy = _FlushSpy();
    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: spy, online: controller.stream));
    await t.pumpAndSettle();
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    expect(spy.flushes, 1);
  });

```

In `mobile/test/features/notices/notice_detail_screen_test.dart` replace `testWidgets('opening tracks notice.opened and marks the notice seen once'` with `testWidgets('opening tracks notice.seen and marks the notice seen once'`, and `expect(analytics.events.first.$1, 'notice.opened');` with `expect(analytics.events.first.$1, 'notice.seen');`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile && flutter test test/core/analytics test/core/storage test/core/sync test/features/notices/notice_detail_screen_test.dart`
Expected: FAIL — `Error when reading 'lib/core/analytics/batching_analytics.dart'`.

- [ ] **Step 3: The `analytics_events` table, schema 2**

In `mobile/lib/core/storage/app_database.dart`:

- before `class CachedDoc {` insert:

```dart
/// Analytics events waiting for `POST /v1/events` (notifications spec §8.7). Props are
/// stored as JSON: ids, enums, numbers and booleans only.
@DataClassName('AnalyticsEventRow')
class AnalyticsEvents extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  DateTimeColumn get at => dateTime()();
  TextColumn get props => text()();
}

class QueuedEvent {
  const QueuedEvent(this.id, this.name, this.at, this.props);
  final int id;
  final String name;
  final DateTime at;
  final Map<String, dynamic> props;
}

```

- replace `@DriftDatabase(tables: [KvCache, PendingActionRows])` with `@DriftDatabase(tables: [KvCache, PendingActionRows, AnalyticsEvents])`
- replace:

```dart
  @override
  int get schemaVersion => 1;
```

  with:

```dart
  /// 2: `analytics_events` (notifications Plan 3).
  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) await m.createTable(analyticsEvents);
        },
      );

  /// The queue keeps the newest 1,000 events; older ones are dropped first.
  static const analyticsCap = 1000;
```

- replace:

```dart
  Future<void> wipe() async {
    await delete(kvCache).go();
    await delete(pendingActionRows).go();
  }
```

  with:

```dart
  Future<void> enqueueEvent(String name, DateTime at, Map<String, Object> props) async {
    await into(analyticsEvents).insert(AnalyticsEventsCompanion.insert(name: name, at: at.toUtc(), props: jsonEncode(props)));
    await customStatement(
      'DELETE FROM analytics_events WHERE id NOT IN (SELECT id FROM analytics_events ORDER BY id DESC LIMIT $analyticsCap)',
    );
  }

  Future<int> eventCount() async {
    final count = analyticsEvents.id.count();
    return (await (selectOnly(analyticsEvents)..addColumns([count])).getSingle()).read(count) ?? 0;
  }

  /// The oldest [limit] queued events.
  Future<List<QueuedEvent>> eventBatch(int limit) async {
    final rows = await (select(analyticsEvents)
          ..orderBy([(t) => OrderingTerm.asc(t.id)])
          ..limit(limit))
        .get();
    return [for (final r in rows) QueuedEvent(r.id, r.name, r.at.toUtc(), jsonDecode(r.props) as Map<String, dynamic>)];
  }

  Future<void> removeEvents(Iterable<int> ids) => (delete(analyticsEvents)..where((t) => t.id.isIn(ids))).go();

  /// Sign-out: the cache, the queued writes and the queued analytics all go.
  Future<void> wipe() async {
    await delete(kvCache).go();
    await delete(pendingActionRows).go();
    await delete(analyticsEvents).go();
  }
```

- [ ] **Step 4: `BatchingAnalytics`**

```dart
// mobile/lib/core/analytics/batching_analytics.dart
import 'dart:async';

import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' as wire;

/// The server's allow-list (`POST /v1/events`, notifications spec §7.3), read from the
/// generated contract so the two cannot drift. Anything else is never queued.
final Set<String> eventNames = {for (final n in wire.EventsRequestEventsInnerNameEnum.values) n.value};

final _propString = RegExp(r'^[A-Za-z0-9_.:-]*$');
bool _validPropString(String s) => s.length <= 64 && _propString.hasMatch(s);

/// The server's prop rules (§7.3): at most 10 keys, each value an id-like string of at most
/// 64 characters, a finite number or a boolean. Anything else is dropped here rather than
/// costing the whole event at the server (e.g. `late: null` on a queued acknowledgement).
Map<String, Object> sanitizeProps(Map<String, Object?> props) {
  final out = <String, Object>{};
  for (final MapEntry(:key, :value) in props.entries) {
    if (out.length == 10) break;
    if (!_validPropString(key)) continue;
    final ok = switch (value) {
      final String s => _validPropString(s),
      final num n => n.isFinite,
      bool() => true,
      _ => false,
    };
    if (ok) out[key] = value!;
  }
  return out;
}

/// Product analytics to our backend (spec §8.7, NFR-11), behind the Foundation [Analytics]
/// interface so callers do not change. Events are queued in the drift `analytics_events`
/// table (newest 1,000 kept) and flushed to `POST /v1/events` 30 s after the first unsent
/// one, as soon as 20 are queued, and when the app goes to the background (SyncLifecycle).
/// Only a signed-in session queues or sends: `/events` needs one, and a sign-out wipes the
/// queue with the rest of the database. Debug builds still print every event.
class BatchingAnalytics implements Analytics {
  BatchingAnalytics({
    required this._database,
    required this._api,
    required this._signedIn,
    this.flushEvery = const Duration(seconds: 30),
    this.flushAt = 20,
    this._now = DateTime.now,
    this._log,
  });

  final Future<AppDatabase> Function() _database;
  final wire.MobileApi Function() _api;
  final bool Function() _signedIn;
  final DateTime Function() _now;
  final void Function(String line)? _log;
  final Duration flushEvery;
  final int flushAt;

  static const _batch = 100;
  Timer? _timer;
  Future<void>? _inFlight;

  @override
  void track(String event, [Map<String, Object?> props = const {}]) {
    _log?.call('[analytics] $event ${props.isEmpty ? '' : props}');
    if (!eventNames.contains(event) || !_signedIn()) return;
    unawaited(_enqueue(event, sanitizeProps(props), _now()));
  }

  Future<void> _enqueue(String event, Map<String, Object> props, DateTime at) async {
    try {
      final db = await _database();
      await db.enqueueEvent(event, at, props);
      if (await db.eventCount() >= flushAt) {
        await flush();
      } else {
        _schedule();
      }
    } on Object {
      // Analytics never fails a user action.
    }
  }

  void _schedule() => _timer ??= Timer(flushEvery, () {
        _timer = null;
        unawaited(flush());
      });

  /// Sends everything queued, 100 events a request. One flush at a time.
  Future<void> flush() => _inFlight ??= _flush().whenComplete(() => _inFlight = null);

  Future<void> _flush() async {
    _timer?.cancel();
    _timer = null;
    if (!_signedIn()) return;
    try {
      final db = await _database();
      while (true) {
        final batch = await db.eventBatch(_batch);
        if (batch.isEmpty) return;
        if (!await _send(batch)) {
          _schedule();
          return;
        }
        await db.removeEvents(batch.map((e) => e.id));
        if (batch.length < _batch) return;
      }
    } on Object {
      // The database closed under us (sign-out); nothing left to send.
    }
  }

  /// True when the batch is done with: accepted (the server drops invalid events one by
  /// one), or refused in a way a retry cannot fix. False keeps it for later: offline, a
  /// server error, rate limiting or an expired session.
  Future<bool> _send(List<QueuedEvent> batch) async {
    try {
      await _api().postEvents(
        eventsRequest: wire.EventsRequest.fromJson({
          'events': [
            for (final e in batch) {'name': e.name, 'at': e.at.toIso8601String(), 'props': e.props},
          ],
        }),
      );
      return true;
    } on Object catch (e) {
      final f = ApiFailure.of(e);
      final s = f.status;
      return !(f.isOffline || s == null || s >= 500 || s == 429 || s == 401);
    }
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }
}
```

Replace the whole of `mobile/lib/core/analytics/analytics.dart` with:

```dart
import 'package:flutter/foundation.dart';
import 'package:juvi/core/analytics/batching_analytics.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'analytics.g.dart';

/// Product events (Foundation spec §11, notifications spec §7.3): `app.opened`,
/// `account.signed_in`, `onboarding.step_completed {step}`, `onboarding.completed`,
/// `settings.changed {key}`, `channel.muted {muted}`, `notice.seen {noticeId}`,
/// `notice.acknowledged`, `notice.dismissed`, `notification.opened {tier}`,
/// `notification.permission {granted}`, `permission_card.shown`, `permission_card.dismissed`.
/// Payloads carry ids and enums only — never names, emails, identifiers or message text
/// (NFR-11); the server refuses anything else.
// The brief's fixed interface shape (task-10-brief.md): a single-method abstraction so
// call sites can be swapped for a real analytics SDK later without touching callers.
// ignore: one_member_abstracts
abstract class Analytics {
  void track(String event, [Map<String, Object?> props = const {}]);
}

@Riverpod(keepAlive: true)
Analytics analytics(Ref ref) {
  final analytics = BatchingAnalytics(
    database: () => ref.read(appDatabaseProvider.future),
    api: () => ref.read(mobileApiProvider),
    signedIn: () => ref.read(sessionControllerProvider) is SignedIn,
    log: kDebugMode ? debugPrint : null,
  );
  ref.onDispose(analytics.dispose);
  return analytics;
}
```

- [ ] **Step 5: Flush on background; S04 records `notice.seen`**

In `mobile/lib/core/sync/sync_lifecycle.dart`:

- after `import 'package:juvi/core/analytics/analytics.dart';` add `import 'package:juvi/core/analytics/batching_analytics.dart';`
- replace:

```dart
/// `app.opened`. Wraps `MaterialApp.router` in `JuviApp` (`lib/app/app.dart`).
```

  with:

```dart
/// `app.opened`; flushes queued analytics when the app goes to the background. Wraps `MaterialApp.router` in `JuviApp` (`lib/app/app.dart`).
```

- replace:

```dart
    if (state == AppLifecycleState.resumed) {
      ref.read(analyticsProvider).track('app.opened');
      unawaited(_drain());
    }
```

  with:

```dart
    if (state == AppLifecycleState.resumed) {
      ref.read(analyticsProvider).track('app.opened');
      unawaited(_drain());
    }
    if (state == AppLifecycleState.paused) {
      final analytics = ref.read(analyticsProvider);
      if (analytics is BatchingAnalytics) unawaited(analytics.flush());
    }
```

In `mobile/lib/features/notices/notice_detail_screen.dart` replace:

```dart
/// S04. Opening it records `notice.opened` and sets `seenAt` once (spec §4 US-2.1);
```

with:

```dart
/// S04. Opening it records `notice.seen` and sets `seenAt` once (spec §4 US-2.1);
```

and:

```dart
    ref.read(analyticsProvider).track('notice.opened', {'noticeId': widget.noticeId});
```

with:

```dart
    ref.read(analyticsProvider).track('notice.seen', {'noticeId': widget.noticeId});
```

- [ ] **Step 6: Generate, run the tests and analyze**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs`

Run: `cd mobile && flutter test test/core/analytics test/core/storage test/core/sync test/features/notices/notice_detail_screen_test.dart`
Expected: all pass (8 analytics tests, the migration test, the flush-on-background test).

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden && flutter test --tags golden`
Expected: `No issues found!`, `+260: All tests passed!`, `+16: All tests passed!`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/core/analytics mobile/lib/core/storage/app_database.dart mobile/lib/core/storage/app_database.g.dart \
  mobile/lib/core/sync/sync_lifecycle.dart mobile/lib/features/notices/notice_detail_screen.dart \
  mobile/test/core/analytics mobile/test/core/storage/app_database_test.dart mobile/test/core/sync/sync_lifecycle_test.dart \
  mobile/test/features/notices/notice_detail_screen_test.dart
git commit -m "feat(mobile): BatchingAnalytics queues allow-listed events in drift and flushes them to /v1/events

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The push token — `PushMessaging`, `PushRegistration` and sign-out

**Files:**
- Create: `mobile/lib/core/push/push_messaging.dart`, `mobile/lib/core/push/firebase_push.dart`, `mobile/lib/core/push/push_registration.dart`, `mobile/test/core/push/push_registration_test.dart`
- Modify: `mobile/lib/core/session/session_controller.dart:4`, `:81-82`, `mobile/test/core/push/push_fixtures.dart`, `mobile/test/core/session/session_controller_test.dart`

**Interfaces:**
- Consumes: `LocalNotifications`, `NoLocalNotifications` (Task 5); `Receipts`, `ReceiptQueue` (Task 3); `notificationsAllowedProvider` (Task 4); `wire.MobileApi.registerPushToken({PushTokenRequest pushTokenRequest})`, `clearPushToken()`, `wire.PushTokenRequest.fromJson`; `mobileApiProvider`, `bareMobileApiProvider`, `sessionControllerProvider`.
- Produces:
  ```dart
  // lib/core/push/push_messaging.dart
  abstract class PushMessaging { bool get available; Future<String?> token(); Stream<String> get tokenRefreshes; Future<void> deleteToken();
    Future<Map<String, dynamic>?> initialMessage(); Stream<Map<String, dynamic>> get foregroundMessages; Stream<Map<String, dynamic>> get openedMessages; }
  class NoPushMessaging implements PushMessaging { const NoPushMessaging(); }
  final pushMessagingProvider;        // default NoPushMessaging; main() overrides (Task 10)
  final localNotificationsProvider;   // default NoLocalNotifications; main() overrides (Task 10)
  final receiptsProvider;             // Receipts(bareMobileApi, ReceiptQueue())
  // lib/core/push/firebase_push.dart
  class FirebasePushMessaging implements PushMessaging { FirebasePushMessaging([FirebaseMessaging? messaging]); }
  // lib/core/push/push_registration.dart
  class PushRegistration { PushRegistration({required messaging, required api, required signedIn, required allowed});
    Future<void> sync(); Future<void> onTokenRefresh(String token); void onSessionChanged(SessionState next);
    void onPermissionChanged({required bool? before, required bool? after}); Future<void> unregister(); }
  final pushRegistrationProvider;     // listens to the session, the permission and token refreshes
  // test/core/push/push_fixtures.dart
  class FakePushMessaging { String? currentToken; int deletes; Map<String, dynamic>? initial; StreamController refreshes, foreground, opened; }
  ```

Decisions (Ruling 8):
- One `PUT` per process while `SignedIn` and allowed, which covers an upgrade; again on rotation, on a real `false` → `true` permission change and on the next sign-in.
- Triggers are serialised, and a failed step never blocks the next.
- A failed `PUT` is retried by the next trigger.
- `signOut()` calls `unregister()` (`DELETE`, then `deleteToken()`) before `AuthRepository.signOut()` revokes the session.
- Without Firebase (`available == false`) nothing is ever sent.

- [ ] **Step 1: Grow the fixture**

Replace `mobile/test/core/push/push_fixtures.dart` with:

```dart
import 'dart:async';

import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_messaging.dart';

/// The FCM data message the backend builds (`backend/src/modules/juvi-app/notifications/payload.ts`):
/// every value a string, and no `title` key at all for a confidential notice or a batch.
Map<String, dynamic> pushData({
  String deliveryId = 'd00000000000000000000001',
  String tier = 'important',
  String variant = 'published',
  String count = '1',
  String? title = 'Hall tickets are out',
}) => {
  'deliveryId': deliveryId,
  'receipt': 'sig.1760000000',
  'kind': 'notice',
  'noticeId': 'n00000000000000000000001',
  'tier': tier,
  'groupKey': 'notice:n00000000000000000000001',
  'office': 'Exam Section',
  'variant': variant,
  'count': count,
  'title': ?title,
};

/// The OS permission, answered by the test: [granted] now, and what a prompt would return.
class FakeNotificationPermission implements NotificationPermission {
  FakeNotificationPermission({this.granted = false, this.grantOnRequest = true});
  bool granted;
  final bool grantOnRequest;
  int requests = 0;
  int settingsOpened = 0;
  @override
  Future<bool> isGranted() async => granted;
  @override
  Future<bool> request() async {
    requests++;
    return granted = grantOnRequest;
  }

  @override
  Future<void> openSettings() async => settingsOpened++;
}

/// Records what would have reached the tray.
class FakeLocalNotifications implements LocalNotifications {
  final shown = <NoticePush>[];
  String? launch;
  void Function(String? payload)? onTap;
  @override
  Future<void> init({void Function(String? payload)? onTap}) async => this.onTap = onTap;
  @override
  Future<void> show(NoticePush p) async => shown.add(p);
  @override
  Future<String?> launchPayload() async => launch;
}

/// FCM, driven by the test: emit on [refreshes], [foreground] or [opened].
class FakePushMessaging implements PushMessaging {
  FakePushMessaging({this.currentToken = 'fcm-token-1'});
  String? currentToken;
  int deletes = 0;
  Map<String, dynamic>? initial;
  final refreshes = StreamController<String>.broadcast();
  final foreground = StreamController<Map<String, dynamic>>.broadcast();
  final opened = StreamController<Map<String, dynamic>>.broadcast();
  @override
  bool get available => true;
  @override
  Future<String?> token() async => currentToken;
  @override
  Stream<String> get tokenRefreshes => refreshes.stream;
  @override
  Future<void> deleteToken() async {
    deletes++;
    currentToken = null;
  }

  @override
  Future<Map<String, dynamic>?> initialMessage() async => initial;
  @override
  Stream<Map<String, dynamic>> get foregroundMessages => foreground.stream;
  @override
  Stream<Map<String, dynamic>> get openedMessages => opened.stream;
}
```

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/core/push/push_registration_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi_api/juvi_api.dart';

import 'push_fixtures.dart';

const account = AccountSummary(id: 'a1', kind: 'student', status: 'active', onboardingStep: 3, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: true, mustChangePassword: false);

class _Session extends SessionController {
  _Session(this.initial);
  final SessionState initial;
  @override
  SessionState build() => initial;
  // A test hook, not a property.
  // ignore: use_setters_to_change_properties
  void set(SessionState s) => state = s;
}

void main() {
  late DioAdapter adapter;
  late List<String> calls;
  late FakePushMessaging messaging;
  late FakeNotificationPermission permission;

  ProviderContainer container({SessionState session = const SessionState.signedIn(account)}) {
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      calls.add('${o.method} ${o.path}${o.data == null ? '' : ' ${jsonDecode(o.data as String)}'}');
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio)
      ..onPut('/me/devices/current/push-token', (s) => s.reply(204, null), data: Matchers.any)
      ..onDelete('/me/devices/current/push-token', (s) => s.reply(204, null));
    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      pushMessagingProvider.overrideWithValue(messaging),
      notificationPermissionProvider.overrideWithValue(permission),
      mobileApiProvider.overrideWithValue(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi()),
      sessionControllerProvider.overrideWith(() => _Session(session)),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

  setUp(() {
    calls = [];
    messaging = FakePushMessaging();
    permission = FakeNotificationPermission(granted: true);
  });

  test('signed in and allowed: the token is PUT once per process', () async {
    final c = container();
    await c.read(pushRegistrationProvider).sync();
    await c.read(pushRegistrationProvider).sync();
    expect(calls, ['PUT /me/devices/current/push-token {platform: android, token: fcm-token-1}']);
  });

  test('not allowed: nothing is registered until the permission turns on', () async {
    permission.granted = false;
    final c = container();
    await c.read(pushRegistrationProvider).sync();
    expect(calls, isEmpty);
    permission.granted = true;
    await c.read(notificationsAllowedProvider.notifier).recheck(); // e.g. back from the system settings
    await settle();
    expect(calls, ['PUT /me/devices/current/push-token {platform: android, token: fcm-token-1}']);
  });

  test('a rotated FCM token is registered again', () async {
    final c = container();
    await c.read(pushRegistrationProvider).sync();
    messaging.refreshes.add('fcm-token-2');
    await settle();
    expect(calls.last, 'PUT /me/devices/current/push-token {platform: android, token: fcm-token-2}');
  });

  test('signed out: nothing; signing in registers', () async {
    final c = container(session: const SessionState.signedOut());
    await c.read(pushRegistrationProvider).sync();
    expect(calls, isEmpty);
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedIn(account));
    await settle();
    expect(calls, hasLength(1));
  });

  test('sign-out: DELETE, then the FCM token is deleted; the next sign-in registers afresh', () async {
    final c = container();
    final registration = c.read(pushRegistrationProvider);
    await registration.sync();
    await registration.unregister();
    expect(calls.last, 'DELETE /me/devices/current/push-token');
    expect(messaging.deletes, 1);
    messaging.currentToken = 'fcm-token-1';
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedOut());
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedIn(account));
    await settle();
    expect(calls.where((l) => l.startsWith('PUT')), hasLength(2));
  });

  test('a failed PUT is retried at the next trigger', () async {
    final c = container();
    adapter.onPut('/me/devices/current/push-token', (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')), data: Matchers.any);
    await c.read(pushRegistrationProvider).sync();
    adapter.onPut('/me/devices/current/push-token', (s) => s.reply(204, null), data: Matchers.any);
    await c.read(pushRegistrationProvider).sync();
    expect(calls, hasLength(2));
  });

  test('without Firebase nothing is sent, not even on sign-out', () async {
    messaging = FakePushMessaging();
    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      notificationPermissionProvider.overrideWithValue(permission),
      sessionControllerProvider.overrideWith(() => _Session(const SessionState.signedIn(account))),
    ]);
    addTearDown(c.dispose);
    expect(c.read(pushMessagingProvider), isA<NoPushMessaging>());
    await c.read(pushRegistrationProvider).sync();
    await c.read(pushRegistrationProvider).unregister();
  });
}
```

In `mobile/test/core/session/session_controller_test.dart`:

- add `import 'package:dio/dio.dart';` first, `import 'package:http_mock_adapter/http_mock_adapter.dart';` after the `flutter_test` import, `import 'package:juvi/core/push/push_registration.dart';` after the `models` import, `import 'package:juvi_api/juvi_api.dart' show JuviApi;` after the `secure_store` import (`show`: the package's `Tokens` would clash with the app's), and, after `import 'package:mocktail/mocktail.dart';`, a blank line and `import '../push/push_fixtures.dart';`
- after `class _Storage extends Mock implements FlutterSecureStorage {}` insert:

```dart

_Storage _storageOver(Map<String, String> mem) {
  final storage = _Storage();
  when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
  when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async => mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String);
  when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
  return storage;
}
```

- before `  test('refreshTokens rotates and persists; a null refresh wipes', () async {` insert:

```dart
  test('signOut clears the push token while the session is still valid, then revokes and wipes', () async {
    final order = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      order.add('${o.method} ${o.path}');
      h.next(o);
    }));
    DioAdapter(dio: dio).onDelete('/me/devices/current/push-token', (s) => s.reply(204, null));
    final messaging = FakePushMessaging();
    final registration = PushRegistration(
      messaging: messaging,
      api: () => JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(),
      signedIn: () => true,
      allowed: () async => true,
    );
    when(() => auth.signOut()).thenAnswer((_) async => order.add('sign-out'));
    final container = ProviderContainer(retry: (_, _) => null, overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      secureStoreProvider.overrideWithValue(SecureStore(_storageOver(mem))),
      appDatabaseProvider.overrideWith((_) async => db),
      pushRegistrationProvider.overrideWithValue(registration),
    ]);
    addTearDown(container.dispose);
    mem['juvi.access'] = 'a';
    await container.read(sessionControllerProvider.notifier).signOut();
    expect(order, ['DELETE /me/devices/current/push-token', 'sign-out']);
    expect(messaging.deletes, 1);
    expect(mem['juvi.access'], isNull);
    expect(container.read(sessionControllerProvider), const SessionState.signedOut());
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd mobile && flutter test test/core/push/push_registration_test.dart test/core/session`
Expected: FAIL — `Error when reading 'lib/core/push/push_messaging.dart'`.

- [ ] **Step 4: Implement the FCM seam and its providers**

```dart
// mobile/lib/core/push/push_messaging.dart
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'push_messaging.g.dart';

/// Firebase Cloud Messaging, behind an interface so tests never initialise Firebase
/// (`firebase_push.dart` is the real one). Messages arrive as FCM's data map.
abstract class PushMessaging {
  /// False when Firebase is not initialised (tests, a build that failed to set it up).
  bool get available;
  Future<String?> token();
  Stream<String> get tokenRefreshes;
  Future<void> deleteToken();

  /// The FCM-displayed message whose tap launched the app. Juvi's pushes are data-only and
  /// rendered by `LocalNotifications`, whose launch payload carries the usual cold start.
  Future<Map<String, dynamic>?> initialMessage();
  Stream<Map<String, dynamic>> get foregroundMessages;
  Stream<Map<String, dynamic>> get openedMessages;
}

class NoPushMessaging implements PushMessaging {
  const NoPushMessaging();
  @override
  bool get available => false;
  @override
  Future<String?> token() async => null;
  @override
  Stream<String> get tokenRefreshes => const Stream.empty();
  @override
  Future<void> deleteToken() async {}
  @override
  Future<Map<String, dynamic>?> initialMessage() async => null;
  @override
  Stream<Map<String, dynamic>> get foregroundMessages => const Stream.empty();
  @override
  Stream<Map<String, dynamic>> get openedMessages => const Stream.empty();
}

/// `main()` overrides these two with the Firebase and plugin implementations once
/// Firebase is up; everywhere else (tests included) push is inert.
@Riverpod(keepAlive: true)
PushMessaging pushMessaging(Ref ref) => const NoPushMessaging();

@Riverpod(keepAlive: true)
LocalNotifications localNotifications(Ref ref) => const NoLocalNotifications();

/// Receipts from the foreground, on the session-less Dio (spec §7.2).
@Riverpod(keepAlive: true)
Receipts receipts(Ref ref) => Receipts(ref.read(bareMobileApiProvider), ReceiptQueue());
```

```dart
// mobile/lib/core/push/firebase_push.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:juvi/core/push/push_messaging.dart';

/// The real [PushMessaging]. Constructed only in `main()`, after `Firebase.initializeApp()`.
class FirebasePushMessaging implements PushMessaging {
  FirebasePushMessaging([FirebaseMessaging? messaging]) : _m = messaging ?? FirebaseMessaging.instance;
  final FirebaseMessaging _m;

  @override
  bool get available => true;
  @override
  Future<String?> token() => _m.getToken();
  @override
  Stream<String> get tokenRefreshes => _m.onTokenRefresh;
  @override
  Future<void> deleteToken() => _m.deleteToken();
  @override
  Future<Map<String, dynamic>?> initialMessage() async => (await _m.getInitialMessage())?.data;
  @override
  Stream<Map<String, dynamic>> get foregroundMessages => FirebaseMessaging.onMessage.map((m) => m.data);
  @override
  Stream<Map<String, dynamic>> get openedMessages => FirebaseMessaging.onMessageOpenedApp.map((m) => m.data);
}
```

- [ ] **Step 5: Implement `PushRegistration`**

```dart
// mobile/lib/core/push/push_registration.dart
import 'dart:async';

import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'push_registration.g.dart';

/// Keeps this session's FCM token on the server (notifications spec §8.3, §7.1).
///
/// The token is `PUT` once per process while signed in with notifications allowed, which
/// also covers an app upgrade (an upgrade always starts a new process); again whenever
/// FCM rotates it; again on a denied → allowed change; and again after the next sign-in.
/// Sign-out `DELETE`s it first, while the session is still valid, then deletes the FCM
/// token so the next account on this phone gets a fresh one.
class PushRegistration {
  PushRegistration({
    required this._messaging,
    required this._api,
    required this._signedIn,
    required this._allowed,
  });

  final PushMessaging _messaging;
  final wire.MobileApi Function() _api;
  final bool Function() _signedIn;
  final Future<bool> Function() _allowed;

  /// The token this process registered for the current session.
  String? _registered;

  /// Registrations run one at a time, so two triggers firing together send one PUT. A step
  /// that fails never blocks the ones after it.
  Future<void> _last = Future.value();
  Future<void> _serial(Future<void> Function() step) => _last = _last.then((_) => step()).catchError((Object _) {});

  Future<void> sync() => _serial(() async {
        if (!_messaging.available || !_signedIn() || !await _allowed()) return;
        final token = await _tokenOrNull();
        if (token != null) await _register(token);
      });

  Future<void> onTokenRefresh(String token) => _serial(() async {
        if (!_signedIn() || !await _allowed()) return;
        await _register(token);
      });

  void onSessionChanged(SessionState next) {
    if (next is SignedIn) {
      unawaited(sync());
    } else {
      _registered = null;
    }
  }

  /// Only a real denied → allowed change; the first answer is covered by [sync] itself.
  void onPermissionChanged({required bool? before, required bool? after}) {
    if (before == false && after == true) unawaited(sync());
  }

  /// Sign-out (spec §8.3): best effort on both steps; a failure never blocks the sign-out.
  Future<void> unregister() async {
    _registered = null;
    if (!_messaging.available) return;
    try {
      await _api().clearPushToken();
    } on Object {
      // Revoking the session clears its token on the server anyway.
    }
    try {
      await _messaging.deleteToken();
    } on Object {
      // A stale FCM token is rotated by FCM later.
    }
  }

  Future<String?> _tokenOrNull() async {
    try {
      return await _messaging.token();
    } on Object {
      return null; // No Play services, or the placeholder Firebase project.
    }
  }

  Future<void> _register(String token) async {
    if (token == _registered) return;
    try {
      await _api().registerPushToken(pushTokenRequest: wire.PushTokenRequest.fromJson({'token': token, 'platform': 'android'}));
      _registered = token;
    } on Object {
      // Offline or refused: the next launch, resume-to-allowed or token refresh tries again.
    }
  }
}

@Riverpod(keepAlive: true)
PushRegistration pushRegistration(Ref ref) {
  final messaging = ref.read(pushMessagingProvider);
  final registration = PushRegistration(
    messaging: messaging,
    api: () => ref.read(mobileApiProvider),
    signedIn: () => ref.read(sessionControllerProvider) is SignedIn,
    allowed: () => ref.read(notificationsAllowedProvider.future),
  );
  ref
    ..listen<SessionState>(sessionControllerProvider, (_, next) => registration.onSessionChanged(next))
    ..listen<AsyncValue<bool>>(notificationsAllowedProvider, (prev, next) => registration.onPermissionChanged(before: prev?.value, after: next.value));
  final refreshes = messaging.tokenRefreshes.listen((t) => unawaited(registration.onTokenRefresh(t)));
  ref.onDispose(refreshes.cancel);
  return registration;
}
```

- [ ] **Step 6: Sign-out clears the token first**

In `mobile/lib/core/session/session_controller.dart`:

- after `import 'package:juvi/core/models/models.dart';` add `import 'package:juvi/core/push/push_registration.dart';`
- replace:

```dart
  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
```

  with:

```dart
  Future<void> signOut() async {
    // While the session is still valid, the server forgets this phone's push token and FCM
    // issues the next account a fresh one (notifications spec §8.3).
    await ref.read(pushRegistrationProvider).unregister();
    await ref.read(authRepositoryProvider).signOut();
```

- [ ] **Step 7: Generate, run the tests and analyze**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs`

Run: `cd mobile && flutter test test/core/push/push_registration_test.dart test/core/session`
Expected: all pass (7 registration tests, the sign-out order test).

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`, `+268: All tests passed!`

- [ ] **Step 8: Commit**

```bash
git add mobile/lib/core/push mobile/lib/core/session/session_controller.dart mobile/test/core/push mobile/test/core/session
git commit -m "feat(mobile): register the FCM token while signed in and allowed; clear it on sign-out

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `DeepLinkResolver` — home first, and a destination that survives sign-in

**Files:**
- Create: `mobile/lib/app/deep_link_resolver.dart`, `mobile/test/app/deep_link_resolver_test.dart`
- Modify: `mobile/lib/core/storage/secure_store.dart:26`, `:89`

**Interfaces:**
- Consumes: `routerProvider` (`lib/app/router.dart:87`), `redirect()` (`lib/app/redirect.dart:7`, used by the test's router); `receiptsProvider` (Task 8); `NoticePush.location` (Task 2); `ReceiptItem` (Task 3); `analyticsProvider`; `acct()` (`test/app/redirect_test.dart:5`).
- Produces:
  ```dart
  // lib/core/storage/secure_store.dart
  Future<String?> readPendingLink(); Future<void> writePendingLink(String json); Future<void> clearPendingLink();
  Future<String?> readLastAccount(); Future<void> writeLastAccount(String owner);   // neither is part of wipeAll()
  // lib/app/deep_link_resolver.dart
  class PendingLink { String location; DateTime createdAt; String? owner; }
  bool sessionReady(SessionState s);   String homeOf(SignedIn s);
  class DeepLinkResolver { static const maxAge = Duration(hours: 24);
    Future<void> onNotificationTap(NoticePush p); Future<void> open(String location); Future<void> onSessionChanged(SessionState next); }
  final deepLinkResolverProvider;      // listens to sessionControllerProvider
  ```

Decisions (Ruling 14):
- Ready means signed in, password set and onboarding done.
- A ready session navigates at once: `go(home)` and then `push(location)`, so Back lands on Today or Teaching.
- Anything else holds `{location, createdAt, owner}` in memory and secure storage. The next ready session uses it once, unless it is older than 24 h or its owner (`<collegeId>:<accountId>`, recorded whenever a ready session is seen) differs.
- A tap posts `opened` and records `notification.opened {tier}` before resolving; the latter is recorded only when signed in (Ruling 12).
- A notice the person cannot see opens S04's existing "not available" state; nothing here checks it.

- [ ] **Step 1: Write the failing test**

```dart
// mobile/test/app/deep_link_resolver_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/app/deep_link_resolver.dart';
import 'package:juvi/app/redirect.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi_api/juvi_api.dart' show JuviApi;
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/push/push_fixtures.dart';
import '../features/notices/notice_actions_test.dart' show SpyAnalytics;
import 'redirect_test.dart' show acct;

class _Storage extends Mock implements FlutterSecureStorage {}

void main() {
  late Map<String, String> mem;
  late SecureStore store;
  late SessionState session;
  late GoRouter router;
  late ValueNotifier<int> refresh;
  late List<String> receipts;
  late SpyAnalytics analytics;
  var now = DateTime.utc(2026, 10, 3, 9);

  final student = SessionState.signedIn(acct());
  final faculty = SessionState.signedIn(acct(kind: 'faculty'));

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    now = DateTime.utc(2026, 10, 3, 9);
    mem = {'juvi.college_id': 'c1'};
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    store = SecureStore(storage);
    receipts = [];
    analytics = SpyAnalytics();
  });

  /// The app's real `redirect()` over stub screens, driven by [session].
  Future<DeepLinkResolver> pump(WidgetTester t, SessionState initial) async {
    session = initial;
    refresh = ValueNotifier(0);
    Widget page(String name) => Scaffold(appBar: AppBar(title: Text(name)), body: Text('at $name'));
    router = GoRouter(
      initialLocation: '/splash',
      refreshListenable: refresh,
      redirect: (_, s) => redirect(session, s.matchedLocation),
      routes: [
        for (final p in ['/splash', '/sign-in', '/set-password', '/paused', '/today', '/teaching', '/attention']) GoRoute(path: p, builder: (_, _) => page(p)),
        GoRoute(path: '/onboarding/:step', builder: (_, s) => page('/onboarding/${s.pathParameters['step']}')),
        GoRoute(path: '/notices/:id', builder: (_, s) => page('/notices/${s.pathParameters['id']}')),
      ],
    );
    addTearDown(router.dispose);
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      receipts.add(o.data as String);
      h.next(o);
    }));
    DioAdapter(dio: dio).onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    final resolver = DeepLinkResolver(
      router: () => router,
      session: () => session,
      store: store,
      receipts: Receipts(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), ReceiptQueue()),
      analytics: analytics,
      now: () => now,
    );
    await t.pumpWidget(MaterialApp.router(routerConfig: router));
    await t.pumpAndSettle();
    return resolver;
  }

  Future<void> become(WidgetTester t, DeepLinkResolver r, SessionState next) async {
    session = next;
    refresh.value++;
    await r.onSessionChanged(next);
    await t.pumpAndSettle();
  }

  Future<void> back(WidgetTester t) async {
    await t.pageBack();
    await t.pumpAndSettle();
  }

  testWidgets('ready (cold start): home, then the notice on top; Back lands on Today', (t) async {
    final r = await pump(t, student);
    await r.open('/notices/n1');
    await t.pumpAndSettle();
    expect(find.text('at /notices/n1'), findsOneWidget);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
  });

  testWidgets('faculty: Back lands on Teaching', (t) async {
    final r = await pump(t, faculty);
    await r.open('/notices/n1');
    await t.pumpAndSettle();
    await back(t);
    expect(find.text('at /teaching'), findsOneWidget);
  });

  testWidgets('a Routine batch opens the attention sheet over home', (t) async {
    final r = await pump(t, student);
    await r.onNotificationTap(NoticePush.tryParse(pushData(tier: 'routine', count: '4', title: null))!);
    await t.pumpAndSettle();
    expect(find.text('at /attention'), findsOneWidget);
  });

  testWidgets('a tap posts opened and records the tier', (t) async {
    final r = await pump(t, student);
    await r.onNotificationTap(NoticePush.tryParse(pushData(tier: 'urgent'))!);
    await t.pumpAndSettle();
    expect((jsonDecode(receipts.single) as Map)['items'], [
      {'deliveryId': 'd00000000000000000000001', 'receipt': 'sig.1760000000', 'event': 'opened', 'at': '2026-10-03T09:00:00.000Z'},
    ]);
    expect(analytics.events.single.$1, 'notification.opened');
    expect(analytics.events.single.$2, {'tier': 'urgent'});
  });

  testWidgets('signed out: held through sign-in, then opened once; Back lands on Today', (t) async {
    mem['juvi.last_account'] = 'c1:a';
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/n1');
    await t.pumpAndSettle();
    expect(find.text('at /sign-in'), findsOneWidget);
    expect(jsonDecode(mem['juvi.pending_link']!), {'location': '/notices/n1', 'createdAt': '2026-10-03T09:00:00.000Z', 'owner': 'c1:a'});
    await become(t, r, student);
    expect(find.text('at /notices/n1'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
    // Used once: a later session change does not open it again.
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
  });

  testWidgets('held through the password change and onboarding', (t) async {
    final r = await pump(t, SessionState.signedIn(acct(mustChange: true)));
    await r.open('/notices/n1');
    await become(t, r, SessionState.signedIn(acct(step: 2, complete: false)));
    expect(find.text('at /onboarding/2'), findsOneWidget);
    await become(t, r, student);
    expect(find.text('at /notices/n1'), findsOneWidget);
  });

  testWidgets('held while the institution is paused', (t) async {
    final r = await pump(t, const SessionState.paused('Back on Monday'));
    await r.open('/notices/n1');
    await t.pumpAndSettle();
    expect(find.text('at /paused'), findsOneWidget);
    await become(t, r, student);
    expect(find.text('at /notices/n1'), findsOneWidget);
  });

  testWidgets('survives a restart: a new resolver uses the stored destination', (t) async {
    mem['juvi.pending_link'] = jsonEncode(PendingLink(location: '/notices/n9', createdAt: now.subtract(const Duration(hours: 2))).toJson());
    final r = await pump(t, const SessionState.signedOut());
    await become(t, r, student);
    expect(find.text('at /notices/n9'), findsOneWidget);
  });

  testWidgets('older than 24 hours: dropped', (t) async {
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/n1');
    now = now.add(const Duration(hours: 24, minutes: 1));
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
  });

  testWidgets('another account, or another institution, signs in: dropped', (t) async {
    mem['juvi.last_account'] = 'c1:someone-else';
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/n1');
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
    expect(mem['juvi.last_account'], 'c1:a');

    mem['juvi.college_id'] = 'c2';
    await become(t, r, const SessionState.signedOut());
    await r.open('/notices/n2');
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && flutter test test/app/deep_link_resolver_test.dart`
Expected: FAIL — `Error when reading 'lib/app/deep_link_resolver.dart'`.

- [ ] **Step 3: Two secure-storage entries that outlive sign-out**

In `mobile/lib/core/storage/secure_store.dart`:

- after `  static const _college = 'juvi.college_id';` add:

```dart
  static const _pendingLink = 'juvi.pending_link';
  static const _lastAccount = 'juvi.last_account';
```

- before `  /// Sign-out and deactivation: forget the session, keep the device identity and the DB key.` insert:

```dart
  /// A notification destination waiting for the session (`DeepLinkResolver`), as JSON.
  /// Not part of [wipeAll]: it has to outlive the sign-out it is waiting behind.
  Future<String?> readPendingLink() => _readOrNull(_pendingLink);
  Future<void> writePendingLink(String json) => _s.write(key: _pendingLink, value: json);
  Future<void> clearPendingLink() => _deleteQuietly(_pendingLink);

  /// `<collegeId>:<accountId>` of the last account that was ready on this phone, so a held
  /// destination is only used by the account it was meant for. Kept across sign-out.
  Future<String?> readLastAccount() => _readOrNull(_lastAccount);
  Future<void> writeLastAccount(String owner) => _s.write(key: _lastAccount, value: owner);

```

- [ ] **Step 4: Implement the resolver**

```dart
// mobile/lib/app/deep_link_resolver.dart
import 'dart:async';
import 'dart:convert';

import 'package:go_router/go_router.dart';
import 'package:juvi/app/router.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'deep_link_resolver.g.dart';

/// A notification destination waiting for the session (spec §8.5).
class PendingLink {
  const PendingLink({required this.location, required this.createdAt, this.owner});
  factory PendingLink.fromJson(Map<String, dynamic> j) => PendingLink(
        location: j['location'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        owner: j['owner'] as String?,
      );
  final String location;
  final DateTime createdAt;

  /// `<collegeId>:<accountId>` of the account last ready on this phone when the tap came.
  final String? owner;
  Map<String, dynamic> toJson() => {'location': location, 'createdAt': createdAt.toUtc().toIso8601String(), 'owner': owner};
}

/// Signed in, password set and onboarding done: the tabs are reachable.
bool sessionReady(SessionState s) => s is SignedIn && !s.account.mustChangePassword && s.account.onboardingComplete;

String homeOf(SignedIn s) => s.account.kind == 'student' ? '/today' : '/teaching';

/// Where a notification tap goes (spec §8.5; settles the #105 deep-link follow-ups).
///
/// When the session is ready it goes to the home tab and pushes the destination on top,
/// so Back lands on home even on a cold start. Otherwise the destination is held, in
/// memory and in secure storage, while `redirect()` walks the person through sign-in,
/// onboarding or the paused screen; the next ready session uses it once. A held
/// destination older than 24 hours, or meant for another account or institution, is
/// dropped. A notice the signed-in person cannot see opens S04's "not available" state.
class DeepLinkResolver {
  DeepLinkResolver({
    required this._router,
    required this._session,
    required this._store,
    required this._receipts,
    required this._analytics,
    this._now = DateTime.now,
  });

  final GoRouter Function() _router;
  final SessionState Function() _session;
  final SecureStore _store;
  final Receipts _receipts;
  final Analytics _analytics;
  final DateTime Function() _now;

  static const maxAge = Duration(hours: 24);
  PendingLink? _pending;

  /// A tapped notification: post `opened` (the HMAC receipt needs no session), record the
  /// tier, then open its destination.
  Future<void> onNotificationTap(NoticePush p) async {
    unawaited(_receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'opened', at: _now().toUtc())));
    _analytics.track('notification.opened', {'tier': p.tier});
    await open(p.location);
  }

  Future<void> open(String location) async {
    final session = _session();
    if (session is SignedIn && sessionReady(session)) {
      _navigate(session, location);
      return;
    }
    final link = PendingLink(location: location, createdAt: _now().toUtc(), owner: await _store.readLastAccount());
    _pending = link;
    await _store.writePendingLink(jsonEncode(link.toJson()));
  }

  /// On every session change (and once at startup): a ready session uses the held
  /// destination, if it is still fresh and meant for this account.
  Future<void> onSessionChanged(SessionState next) async {
    if (next is! SignedIn || !sessionReady(next)) return;
    final owner = '${await _store.readCollegeId() ?? ''}:${next.account.id}';
    final link = _pending ?? _decode(await _store.readPendingLink());
    await _store.writeLastAccount(owner);
    if (link == null) return;
    _pending = null;
    await _store.clearPendingLink();
    if (_now().toUtc().difference(link.createdAt) > maxAge) return;
    if (link.owner != null && link.owner != owner) return;
    final current = _session();
    if (current is SignedIn && sessionReady(current)) _navigate(current, link.location);
  }

  void _navigate(SignedIn session, String location) {
    final router = _router()..go(homeOf(session));
    unawaited(router.push<void>(location));
  }

  static PendingLink? _decode(String? raw) {
    if (raw == null) return null;
    try {
      return PendingLink.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } on Object {
      return null;
    }
  }
}

@Riverpod(keepAlive: true)
DeepLinkResolver deepLinkResolver(Ref ref) {
  final resolver = DeepLinkResolver(
    router: () => ref.read(routerProvider),
    session: () => ref.read(sessionControllerProvider),
    store: ref.read(secureStoreProvider),
    receipts: ref.read(receiptsProvider),
    analytics: ref.read(analyticsProvider),
  );
  ref.listen<SessionState>(sessionControllerProvider, (_, next) => unawaited(resolver.onSessionChanged(next)));
  return resolver;
}
```

- [ ] **Step 5: Generate, run the tests and analyze**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs`

Run: `cd mobile && flutter test test/app`
Expected: all pass (10 resolver tests and the existing redirect tests).

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`, `+278: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/app/deep_link_resolver.dart mobile/lib/app/deep_link_resolver.g.dart mobile/lib/core/storage/secure_store.dart mobile/test/app/deep_link_resolver_test.dart
git commit -m "feat(mobile): DeepLinkResolver opens S04 over the home tab and holds a tapped destination through sign-in

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Wiring — `PushLifecycle`, `main()` and Crashlytics

**Files:**
- Create: `mobile/lib/core/push/push_lifecycle.dart`, `mobile/lib/core/crash/crash_reporting.dart`, `mobile/lib/core/crash/firebase_crash_sink.dart`, `mobile/test/core/push/push_lifecycle_test.dart`, `mobile/test/core/crash/crash_reporting_test.dart`
- Modify: `mobile/lib/main.dart` (whole file), `mobile/lib/app/app.dart` (whole file)

**Interfaces:**
- Consumes: everything above — `localNotificationsProvider`, `pushMessagingProvider`, `receiptsProvider`, `pushRegistrationProvider` (Task 8), `deepLinkResolverProvider` (Task 9), `handleForegroundPush` (Task 5), `notificationsAllowedProvider` (Task 4), `noticeActionsProvider.refresh()` (`lib/features/notices/notice_actions.dart:116`), `firebaseMessagingBackgroundHandler` (Task 5), `FirebasePushMessaging` (Task 8), `PluginLocalNotifications` (Task 5).
- Produces:
  ```dart
  class PushLifecycle extends ConsumerStatefulWidget { const PushLifecycle({required Widget child}); }
  abstract class CrashSink { Future<void> setCollectionEnabled({required bool enabled}); void recordFlutterFatalError(FlutterErrorDetails d); void recordError(Object e, StackTrace s); }
  Future<void> installCrashReporting(CrashSink sink, {required bool enabled});
  class FirebaseCrashSink implements CrashSink { FirebaseCrashSink([FirebaseCrashlytics? crashlytics]); }
  ```

Decisions (Rulings 5, 15):
- `PushLifecycle` starts after the first frame, so the router exists. It then:
  1. initialises the tray with its tap handler;
  2. subscribes to foreground and FCM-opened messages;
  3. applies a destination held across a restart (`resolver.onSessionChanged(current)`), then the notification that launched the app, which wins;
  4. registers the token and drains queued receipts.
- On resume it re-checks the permission and drains again.
- Every failure is swallowed: push is best effort.
- `main()` starts Firebase before the container, and installs Crashlytics with `enabled: !kDebugMode`. It registers the background handler and overrides `pushMessagingProvider` and `localNotificationsProvider`; if Firebase fails, it overrides nothing and push stays off.

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/core/crash/crash_reporting_test.dart
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/crash/crash_reporting.dart';

class _Sink implements CrashSink {
  bool? enabled;
  final flutterErrors = <FlutterErrorDetails>[];
  final errors = <Object>[];
  @override
  Future<void> setCollectionEnabled({required bool enabled}) async => this.enabled = enabled;
  @override
  void recordFlutterFatalError(FlutterErrorDetails details) => flutterErrors.add(details);
  @override
  void recordError(Object error, StackTrace stack) => errors.add(error);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('debug builds: collection off and the error hooks untouched', () async {
    final before = FlutterError.onError;
    final sink = _Sink();
    await installCrashReporting(sink, enabled: false);
    expect(sink.enabled, isFalse);
    expect(FlutterError.onError, same(before));
  });

  test('release builds: Flutter and platform errors reach the sink', () async {
    final flutterBefore = FlutterError.onError;
    final platformBefore = PlatformDispatcher.instance.onError;
    try {
      final sink = _Sink();
      await installCrashReporting(sink, enabled: true);
      expect(sink.enabled, isTrue);
      FlutterError.onError!(FlutterErrorDetails(exception: StateError('build')));
      expect(PlatformDispatcher.instance.onError!(StateError('async'), StackTrace.current), isTrue);
      expect(sink.flutterErrors.single.exception, isA<StateError>());
      expect(sink.errors.single, isA<StateError>());
    } finally {
      FlutterError.onError = flutterBefore;
      PlatformDispatcher.instance.onError = platformBefore;
    }
  });
}
```

```dart
// mobile/test/core/push/push_lifecycle_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/app/deep_link_resolver.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_lifecycle.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi_api/juvi_api.dart' show JuviApi;
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/notices/notice_actions_test.dart' show SpyAnalytics;
import 'push_fixtures.dart';

class _Resolver extends DeepLinkResolver {
  _Resolver(Receipts receipts)
      : super(
          router: () => throw UnimplementedError(),
          session: () => const SessionState.signedOut(),
          store: SecureStore(),
          receipts: receipts,
          analytics: SpyAnalytics(),
        );
  final calls = <String>[];
  @override
  Future<void> onNotificationTap(NoticePush p) async => calls.add('tap ${p.deliveryId}');
  @override
  Future<void> onSessionChanged(SessionState next) async => calls.add('held link');
}

class _Registration extends Mock implements PushRegistration {}

class _Actions extends Mock implements NoticeActions {}

void main() {
  late FakeLocalNotifications local;
  late FakePushMessaging messaging;
  late FakeNotificationPermission permission;
  late _Resolver resolver;
  late _Registration registration;
  late _Actions actions;
  late Receipts receipts;
  late List<Map<String, dynamic>> posted;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    local = FakeLocalNotifications();
    messaging = FakePushMessaging();
    permission = FakeNotificationPermission();
    registration = _Registration();
    when(() => registration.sync()).thenAnswer((_) async {});
    actions = _Actions();
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    posted = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      posted.add(jsonDecode(o.data as String) as Map<String, dynamic>);
      h.next(o);
    }));
    DioAdapter(dio: dio).onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    receipts = Receipts(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), ReceiptQueue());
    resolver = _Resolver(receipts);
  });

  Future<ProviderContainer> pump(WidgetTester t) async {
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: [
        localNotificationsProvider.overrideWithValue(local),
        pushMessagingProvider.overrideWithValue(messaging),
        notificationPermissionProvider.overrideWithValue(permission),
        receiptsProvider.overrideWithValue(receipts),
        deepLinkResolverProvider.overrideWithValue(resolver),
        pushRegistrationProvider.overrideWithValue(registration),
        noticeActionsProvider.overrideWithValue(actions),
      ],
      child: const PushLifecycle(child: SizedBox()),
    ));
    await t.pumpAndSettle();
    return ProviderScope.containerOf(t.element(find.byType(PushLifecycle)));
  }

  testWidgets('after the first frame: the tray is set up, the token registered, queued receipts sent', (t) async {
    await ReceiptQueue().add(ReceiptItem(deliveryId: 'd00000000000000000000009', receipt: 'sig.1', event: 'delivered', at: DateTime.utc(2026, 10, 3)));
    await pump(t);
    expect(local.onTap, isNotNull);
    verify(() => registration.sync()).called(1);
    expect(resolver.calls, ['held link']);
    expect(posted, hasLength(1));
    expect(await ReceiptQueue().read(), isEmpty);
  });

  testWidgets('foreground: Urgent and Important are shown, every tier refreshes notices and posts delivered', (t) async {
    await pump(t);
    messaging.foreground
      ..add(pushData())
      ..add(pushData(tier: 'routine', deliveryId: 'd00000000000000000000002'));
    await t.pumpAndSettle();
    expect(local.shown.map((p) => p.tier), ['important']);
    verify(() => actions.refresh()).called(2);
    expect(posted.map((p) => ((p['items'] as List).single as Map)['deliveryId']), ['d00000000000000000000001', 'd00000000000000000000002']);
  });

  testWidgets('a tapped tray notification and an FCM-opened message both go to the resolver', (t) async {
    await pump(t);
    local.onTap!(NoticePush.tryParse(pushData())!.toPayload());
    messaging.opened.add(pushData(deliveryId: 'd00000000000000000000002'));
    await t.pumpAndSettle();
    expect(resolver.calls, ['held link', 'tap d00000000000000000000001', 'tap d00000000000000000000002']);
  });

  testWidgets('cold start: the notification that launched the app opens after any held destination', (t) async {
    local.launch = NoticePush.tryParse(pushData())!.toPayload();
    await pump(t);
    expect(resolver.calls, ['held link', 'tap d00000000000000000000001']);
  });

  testWidgets('resume re-checks the OS permission', (t) async {
    final c = await pump(t);
    expect(await c.read(notificationsAllowedProvider.future), isFalse);
    permission.granted = true;
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await t.pumpAndSettle();
    expect(c.read(notificationsAllowedProvider).value, isTrue);
  });
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile && flutter test test/core/crash test/core/push/push_lifecycle_test.dart`
Expected: FAIL — `Error when reading 'lib/core/crash/crash_reporting.dart'` and `'lib/core/push/push_lifecycle.dart'`.

- [ ] **Step 3: Crash reporting**

```dart
// mobile/lib/core/crash/crash_reporting.dart
import 'package:flutter/foundation.dart';

/// Where crashes go (Crashlytics in the app, `firebase_crash_sink.dart`; a fake in tests).
abstract class CrashSink {
  Future<void> setCollectionEnabled({required bool enabled});
  void recordFlutterFatalError(FlutterErrorDetails details);
  void recordError(Object error, StackTrace stack);
}

/// Crash reporting (notifications spec §8.6): collection is on only when [enabled] (`main()`
/// passes `!kDebugMode`), and only then are `FlutterError.onError` and
/// `PlatformDispatcher.instance.onError` routed to [sink]. Nothing identifies the person:
/// no user id and no custom keys are ever set.
Future<void> installCrashReporting(CrashSink sink, {required bool enabled}) async {
  await sink.setCollectionEnabled(enabled: enabled);
  if (!enabled) return;
  FlutterError.onError = sink.recordFlutterFatalError;
  PlatformDispatcher.instance.onError = (error, stack) {
    sink.recordError(error, stack);
    return true;
  };
}
```

```dart
// mobile/lib/core/crash/firebase_crash_sink.dart
import 'dart:async';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:juvi/core/crash/crash_reporting.dart';

/// Crashlytics behind [CrashSink]. Constructed only in `main()`, after `Firebase.initializeApp()`.
class FirebaseCrashSink implements CrashSink {
  FirebaseCrashSink([FirebaseCrashlytics? crashlytics]) : _c = crashlytics ?? FirebaseCrashlytics.instance;
  final FirebaseCrashlytics _c;

  @override
  Future<void> setCollectionEnabled({required bool enabled}) => _c.setCrashlyticsCollectionEnabled(enabled);
  @override
  void recordFlutterFatalError(FlutterErrorDetails details) => unawaited(_c.recordFlutterFatalError(details));
  @override
  void recordError(Object error, StackTrace stack) => unawaited(_c.recordError(error, stack, fatal: true));
}
```

- [ ] **Step 4: `PushLifecycle`**

```dart
// mobile/lib/core/push/push_lifecycle.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/deep_link_resolver.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_handlers.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/features/notices/notice_actions.dart';

/// Push in the running app (notifications spec §8.2–§8.5). After the first frame (so the
/// router exists) it initialises the tray with its tap handler, renders foreground
/// messages, routes taps through `DeepLinkResolver`, opens whatever notification launched
/// the app (after any destination held across a restart), registers the push token and
/// drains queued receipts. On resume it re-checks the OS permission and drains again.
/// Wraps `MaterialApp.router` in `JuviApp`, inside `SyncLifecycle`.
class PushLifecycle extends ConsumerStatefulWidget {
  const PushLifecycle({required this.child, super.key});
  final Widget child;
  @override
  ConsumerState<PushLifecycle> createState() => _PushLifecycleState();
}

class _PushLifecycleState extends ConsumerState<PushLifecycle> with WidgetsBindingObserver {
  final _subscriptions = <StreamSubscription<Object?>>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
      ..addObserver(this)
      ..addPostFrameCallback((_) => unawaited(_start()));
  }

  void _tap(NoticePush? p) {
    if (p != null) unawaited(ref.read(deepLinkResolverProvider).onNotificationTap(p));
  }

  Future<void> _start() async {
    try {
      final local = ref.read(localNotificationsProvider);
      final messaging = ref.read(pushMessagingProvider);
      final resolver = ref.read(deepLinkResolverProvider);
      await local.init(onTap: (payload) => _tap(NoticePush.fromPayload(payload)));
      if (!mounted) return;
      _subscriptions
        ..add(messaging.foregroundMessages.listen((data) => unawaited(handleForegroundPush(
              data,
              local: local,
              receipts: ref.read(receiptsProvider),
              refresh: () => ref.read(noticeActionsProvider).refresh(),
            ))))
        ..add(messaging.openedMessages.listen((data) => _tap(NoticePush.tryParse(data))));
      final launchPayload = await local.launchPayload();
      final initial = await messaging.initialMessage();
      final launch = NoticePush.fromPayload(launchPayload) ?? (initial == null ? null : NoticePush.tryParse(initial));
      if (!mounted) return;
      // A destination held across a restart first; the notification that launched the app wins.
      await resolver.onSessionChanged(ref.read(sessionControllerProvider));
      _tap(launch);
      unawaited(ref.read(pushRegistrationProvider).sync());
      unawaited(ref.read(receiptsProvider).drain());
    } on Object {
      // Push is best effort; the app works without it.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    // The person may have changed the permission in the system settings (S12, S14).
    unawaited(ref.read(notificationsAllowedProvider.notifier).recheck());
    unawaited(ref.read(receiptsProvider).drain());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final s in _subscriptions) {
      unawaited(s.cancel());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
```

- [ ] **Step 5: Mount it and start Firebase**

Replace the whole of `mobile/lib/app/app.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/router.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/core/push/push_lifecycle.dart';
import 'package:juvi/core/repos/config_repository.dart';
import 'package:juvi/core/sync/sync_lifecycle.dart';
import 'package:juvi/features/me/theme_preference.dart';

class JuviApp extends ConsumerWidget {
  const JuviApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // R42: AsyncValue.valueOrNull is gone in Riverpod 3 — use .value.
    final accent = parseHexColor(ref.watch(appConfigProvider).value?.data.accentColor);
    final mode = ref.watch(themePreferenceProvider);
    return SyncLifecycle(
      child: PushLifecycle(
        child: MaterialApp.router(
          onGenerateTitle: (c) => c.l10n.appName,
          theme: buildTheme(accent: accent, brightness: Brightness.light),
          darkTheme: buildTheme(accent: accent, brightness: Brightness.dark),
          themeMode: mode,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: ref.watch(routerProvider),
        ),
      ),
    );
  }
}
```

Replace the whole of `mobile/lib/main.dart` with:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:intl/date_symbol_data_local.dart';
import 'package:juvi/app/app.dart';
import 'package:juvi/core/crash/crash_reporting.dart';
import 'package:juvi/core/crash/firebase_crash_sink.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/background_handler.dart';
import 'package:juvi/core/push/firebase_push.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/session/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_IN');
  // R42: disable Riverpod 3's automatic provider retry; the app owns retry UX.
  final container = ProviderContainer(retry: (_, _) => null, overrides: await _startFirebase());
  // R52: the Dio built for the first request must carry the real app version,
  // not the "0.0.0" fallback, so this resolves before restore() (which can make
  // a network call on a cache miss) and before runApp.
  await container.read(appVersionProvider.future);
  // Cached state renders before any network round-trip (spec §11). restore() never
  // throws (unreadable storage or cache ends signed out), so runApp is always reached.
  await container.read(sessionControllerProvider.notifier).restore();
  runApp(UncontrolledProviderScope(container: container, child: const JuviApp()));
}

/// Firebase, Crashlytics and push (notifications spec §8). Any failure — no
/// google-services.json values, no Play services — leaves push inert and the app running:
/// the providers keep their no-op defaults.
Future<List<Override>> _startFirebase() async {
  try {
    await Firebase.initializeApp();
    await installCrashReporting(FirebaseCrashSink(), enabled: !kDebugMode);
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    return [
      pushMessagingProvider.overrideWithValue(FirebasePushMessaging()),
      localNotificationsProvider.overrideWithValue(PluginLocalNotifications(FlutterLocalNotificationsPlugin())),
    ];
  } on Object catch (e) {
    debugPrint('Push is off: Firebase did not start ($e)');
    return const [];
  }
}
```

- [ ] **Step 6: Run the tests, analyze and build**

Run: `cd mobile && flutter test test/core/crash test/core/push test/core/firebase_boundary_test.dart test/flows`
Expected: all pass (2 crash tests, 5 lifecycle tests; the existing flow test now runs with `PushLifecycle` and the no-op push providers).

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden && flutter test --tags golden`
Expected: `No issues found!`, `+285: All tests passed!`, `+16: All tests passed!`

Run: `cd mobile && flutter build apk --debug`
Expected: `✓ Built build/app/outputs/flutter-apk/app-debug.apk`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/core/push/push_lifecycle.dart mobile/lib/core/crash mobile/lib/main.dart mobile/lib/app/app.dart \
  mobile/test/core/push/push_lifecycle_test.dart mobile/test/core/crash
git commit -m "feat(mobile): start Firebase, Crashlytics in release, foreground pushes, taps and resume checks via PushLifecycle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The flow test (tap while signed out → sign in → S04 → Back → Today), README, CLAUDE.md and final verification

**Files:**
- Modify: `mobile/test/flows/sign_in_flow_test.dart`, `mobile/README.md`, `CLAUDE.md` ("Juvi mobile app" section, the `- Notifications:` bullet)

**Interfaces:**
- Consumes: everything above, through the real router, `JuviApp`, `buildDio` and the generated client over one mocked Dio (the Foundation flow-test harness); `FakeLocalNotifications`, `FakePushMessaging`, `pushData` (Task 8 fixture); `detailJson`, `attentionJson` (`test/core/repos/notices_fixtures.dart`).
- Produces: the spec §12 flow test. `integration_test/sign_in_flow_test.dart` runs it on a device unchanged (it calls this file's `main()`).

Decisions:
- The phone's last ready account is `c1:a` (`juvi.last_account`), the account that signs in, so the held destination is used.
- The account is already onboarded with its password set, so sign-in leads straight to "ready".
- `/institutions/JIT` and `/config` carry real `null`s, as the contract does (R61).
- The test also checks the `opened` receipt (posted while signed out), the S04 seen call and the token `PUT` after sign-in (the default permission answer is "allowed", Ruling 9).

- [ ] **Step 1: Extend the flow test**

In `mobile/test/flows/sign_in_flow_test.dart`:

- after `import 'dart:async';` and its blank line, add `import 'package:dio/dio.dart' show InterceptorsWrapper;` before `import 'package:flutter/material.dart';`
- after `import 'package:juvi/core/http/juvi_http.dart';` add:

```dart
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/push_messaging.dart';
```

- before `import '../core/repos/me_repository_test.dart' show meJson;` add `import '../core/push/push_fixtures.dart';`
- replace ``/// A no-op stand-in for `ConsoleAnalytics` — `SyncLifecycle` fires `track('app.opened')` `` with ``/// A no-op stand-in for `BatchingAnalytics` — `SyncLifecycle` fires `track('app.opened')` ``
- replace the file's last three lines:

```dart
    expect(mem['juvi.access'], 'a');
  });
}
```

  with:

```dart
    expect(mem['juvi.access'], 'a');
  });

  // Notifications spec §12: the #105 follow-ups. A notification tapped while signed out
  // survives sign-in, opens S04, and Back lands on Today rather than leaving the app.
  testWidgets('a notification tapped while signed out → sign in → S04 → Back → Today', (t) async {
    SharedPreferences.setMockInitialValues({});
    // The phone's last account, which the notification was for.
    final mem = <String, String>{'juvi.last_account': 'c1:a'};
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    final store = SecureStore(storage);
    late final ProviderContainer container;
    final dio = buildDio(
      baseUrl: 'https://api.test/v1',
      accessToken: () async => (await store.readTokens())?.accessToken,
      refresh: () async => null,
      deviceId: store.deviceId,
      appVersion: '1.0.0',
      platform: 'android',
      onFatal: (f) => unawaited(container.read(sessionControllerProvider.notifier).handleFailure(f)),
    );
    final requests = <String>[];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      requests.add('${o.method} ${o.path}');
      h.next(o);
    }));
    const noticeId = 'n00000000000000000000001';
    const account = {
      'id': 'a',
      'kind': 'student',
      'status': 'active',
      'onboardingStep': 3,
      'onboardingSteps': ['identity', 'spaces', 'notifications'],
      'onboardingComplete': true,
      'mustChangePassword': false,
    };
    DioAdapter(dio: dio)
      ..onGet(
        '/institutions/JIT',
        (s) => s.reply(200, {'collegeId': 'c1', 'name': 'JIT College', 'logoUrl': null, 'accentColor': '#0B5FA5', 'paused': false, 'pausedMessage': null, 'minAppVersion': null}),
      )
      ..onPost(
        '/auth/sign-in',
        (s) => s.reply(200, {'accessToken': 'a', 'accessExpiresIn': 900, 'refreshToken': 'r' * 43, 'account': account}),
        data: Matchers.any,
      )
      ..onGet('/me', (s) => s.reply(200, {...meJson, 'account': account}))
      ..onGet('/config', (s) => s.reply(401, {'error': {'code': 'SESSION_INVALIDATED', 'message': 'Please sign in again.', 'reason': 'missing'}}))
      ..onGet(
        '/config',
        headers: {'Authorization': Matchers.pattern('^Bearer .+')},
        (s) => s.reply(200, {
          'name': 'JIT College',
          'code': 'JIT',
          'logoUrl': null,
          'accentColor': '#0B5FA5',
          'supportContact': null,
          'quietHoursDefault': {'start': '22:00', 'end': '07:00'},
          'timezone': 'Asia/Kolkata',
          'featureFlags': {'languageRoadmap': false},
          'minAppVersion': null,
          'onboardingSteps': ['identity', 'spaces', 'notifications'],
        }),
      )
      ..onGet('/spaces', (s) => s.reply(200, spacesJson))
      ..onGet('/attention', (s) => s.reply(200, attentionJson([])))
      ..onGet('/notices/$noticeId', (s) => s.reply(200, detailJson(noticeId, title: 'Hall tickets are out')))
      ..onPost('/notices/$noticeId/seen', (s) => s.reply(200, {'seenAt': '2026-10-03T09:00:00.000Z'}))
      ..onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any)
      ..onPut('/me/devices/current/push-token', (s) => s.reply(204, null), data: Matchers.any);

    final api = JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi();
    final db = AppDatabase.memory();
    addTearDown(db.close);
    final local = FakeLocalNotifications();
    container = ProviderContainer(
      retry: (_, _) => null,
      overrides: [
        secureStoreProvider.overrideWithValue(store),
        appDatabaseProvider.overrideWith((_) async => db),
        appVersionProvider.overrideWith((_) async => '1.0.0'),
        dioProvider.overrideWithValue(dio),
        bareDioProvider.overrideWithValue(dio),
        mobileApiProvider.overrideWithValue(api),
        bareMobileApiProvider.overrideWithValue(api),
        isOnlineProvider.overrideWith((_) => Stream.value(true)),
        analyticsProvider.overrideWithValue(_NoopAnalytics()),
        localNotificationsProvider.overrideWithValue(local),
        pushMessagingProvider.overrideWithValue(FakePushMessaging()),
      ],
    );
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.notifier).restore();
    await t.pumpWidget(UncontrolledProviderScope(container: container, child: const JuviApp()));
    await t.pumpAndSettle();

    // Signed out: the tap is held behind S01 and its `opened` receipt goes out anyway.
    expect(find.text('Sign in to your college'), findsOneWidget);
    local.onTap!(NoticePush.tryParse(pushData())!.toPayload());
    await t.pumpAndSettle();
    expect(find.text('Sign in to your college'), findsOneWidget);
    expect(requests, contains('POST /notifications/receipts'));

    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '24JIT0001');
    await t.enterText(find.bySemanticsLabel('Password'), 'longenough1');
    await t.pump();
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();

    // S04 for the tapped notice, and this phone's push token is now registered.
    expect(find.text('Hall tickets are out'), findsWidgets);
    expect(requests, contains('POST /notices/$noticeId/seen'));
    expect(requests, contains('PUT /me/devices/current/push-token'));
    expect(mem['juvi.pending_link'], isNull);

    // Back lands on Today, not out of the app.
    await t.pageBack();
    await t.pumpAndSettle();
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.text('No classes today'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run it**

Run: `cd mobile && flutter test test/flows`
Expected: `+2: All tests passed!`

- [ ] **Step 3: Document notifications in the mobile README**

In `mobile/README.md`:

- replace:

```markdown
## Run against a local backend
1. `npm run dev:backend`
```

  with:

```markdown
## Run against a local backend
0. Firebase config (once): `cp android/app/google-services.placeholder.json android/app/google-services.json`, or put the real file from the Firebase console there (see "Firebase" below). The build needs one of the two; neither is committed.
1. `npm run dev:backend`
```

- replace:

```markdown
- `flutter test test/flows` — sign in → set password → onboarding (ending on the first-notice step) → Today → acknowledge the welcome notice → "You're clear", against a mocked API.
```

  with:

```markdown
- `flutter test test/flows` — sign in → set password → onboarding (ending on the first-notice step) → Today → acknowledge the welcome notice → "You're clear"; and a notification tapped while signed out → sign in → S04 → Back → Today. Both against a mocked API.
```

- replace `## Toolchain notes` (the heading line only) with:

```markdown
## Notifications
Spec `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md` §8 and §10; plan `docs/superpowers/plans/2026-10-03-juvi-notifications-3-mobile.md`.
- Firebase sits behind small interfaces so tests never start it: `PushMessaging` (`lib/core/push/push_messaging.dart`), `LocalNotifications`, `NotificationPermission` and `CrashSink`. Only `lib/main.dart`, `lib/core/push/background_handler.dart`, `lib/core/push/firebase_push.dart` and `lib/core/crash/firebase_crash_sink.dart` import a Firebase package (`test/core/firebase_boundary_test.dart` enforces it). The providers default to no-op implementations; `main()` swaps in the real ones once `Firebase.initializeApp()` succeeds, and push stays off if it does not.
- Pushes are FCM data messages (backend `notifications/payload.ts`). `lib/core/push/notice_push.dart` parses them and holds the tray wording, which must match the portal's `trayNotification()` (`admin-portal/src/lib/notices.ts`), the three channels (`juvi_urgent` max, `juvi_important` high, `juvi_routine` low and silent; a reminder is always Important) and the stable notification id from `deliveryId`.
- In the background `firebaseMessagingBackgroundHandler` renders every tier and posts `delivered` with the HMAC receipt on a plain Dio (no session); offline, the receipt waits in shared preferences (`ReceiptQueue`) and `PushLifecycle` drains it at start and on resume. In the foreground Urgent and Important are rendered and every tier refreshes the notice providers.
- `PushRegistration` PUTs the token while signed in with notifications allowed (once per process, on token rotation and on denied → allowed) and sign-out DELETEs it before revoking the session.
- Taps go through `DeepLinkResolver` (`lib/app/deep_link_resolver.dart`): `opened` receipt, `notification.opened {tier}`, then home tab + the notice pushed on top, or held (memory and secure storage, 24 h, same account only) until the session is ready.
- Analytics: `BatchingAnalytics` queues allow-listed events in the drift `analytics_events` table (newest 1,000) and flushes to `POST /v1/events` every 30 s, at 20 events and when the app goes to the background; props that break the server's rules are dropped on the device.

## Firebase
The Android app is `in.juvion.juvi`. `android/app/google-services.json` is git-ignored:
- **Local:** copy the placeholder (`android/app/google-services.placeholder.json`, a dummy project: the app builds and runs, push stays off) or download the real file from the Firebase console (Project settings → Your apps → `in.juvion.juvi`).
- **CI:** `.github/workflows/mobile.yml` writes the real file from the `GOOGLE_SERVICES_JSON` secret when it is set, and copies the placeholder otherwise.
- **Real-device check** (needs the real file and the backend's `FIREBASE_SERVICE_ACCOUNT_JSON`): an Urgent notice during quiet hours rings; an Important one sent at 23:00 arrives at 07:00; a confidential notice shows only the office; tapping a notification opens S04 with Back to Today; the portal's Reach shows Delivered and then Opened.

## Release signing
`android/key.properties` (git-ignored, with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `storeFile` is relative to `android/app/`) signs release builds; without it a release build uses the debug key. CI writes it from `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` and then also builds a signed App Bundle (artifact `juvi-release-aab`); without those secrets CI builds only the debug APK. Firebase and Play both key on the signing certificate: add the release SHA-1/SHA-256 to the Firebase app.

## Toolchain notes
```

- [ ] **Step 4: Point CLAUDE.md at the app side**

In `CLAUDE.md`, "Juvi mobile app" section, at the end of the `- Notifications:` bullet replace:

```markdown
Urgent needs admin/super_admin or `notices:urgent` (`notices/urgent-gate.ts`) plus a 10–300 character `urgentReason`. Spec: `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md`.
```

with:

```markdown
Urgent needs admin/super_admin or `notices:urgent` (`notices/urgent-gate.ts`) plus a 10–300 character `urgentReason`. Spec: `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md`. In the app: Firebase is behind `PushMessaging` / `LocalNotifications` / `NotificationPermission` / `CrashSink` with no-op provider defaults, so tests never start it, and only `main.dart`, `core/push/background_handler.dart`, `core/push/firebase_push.dart` and `core/crash/firebase_crash_sink.dart` import it; the tray wording in `mobile/lib/core/push/notice_push.dart` must match the portal's `trayNotification()`; every tap goes through `DeepLinkResolver` (`mobile/lib/app/deep_link_resolver.dart`); analytics go through `BatchingAnalytics` to `/v1/events`. `mobile/android/app/google-services.json` is git-ignored (copy `google-services.placeholder.json` locally; CI uses the `GOOGLE_SERVICES_JSON` secret or the placeholder), and release signing reads the git-ignored `mobile/android/key.properties` (CI: `ANDROID_KEYSTORE_*` secrets).
```

- [ ] **Step 5: Final verification**

Run: `cd mobile && flutter analyze`
Expected: `No issues found!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+286: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+16: All tests passed!`

Run: `cd mobile && node tool/check_nullable_objects.js api/openapi.json`
Expected: `object-or-null check passed (6 known field(s), all parsed via raw Dio)` (no contract change in this plan).

Run (with the placeholder copied to `android/app/google-services.json`, Task 1 Step 6): `cd mobile && flutter build apk --debug`
Expected: `✓ Built build/app/outputs/flutter-apk/app-debug.apk`

Run: `git status --short mobile/android`
Expected: no `google-services.json`, `key.properties`, `*.jks` or `.kotlin/` entries.

- [ ] **Step 6: Commit**

```bash
git add mobile/test/flows mobile/README.md CLAUDE.md
git commit -m "test(mobile): notification tap while signed out to sign-in to S04 to Today; notifications docs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Real-device verification (after merge, needs the user's Firebase project)

Nothing above needs Firebase; these steps do, and wait on the Firebase project for the Android app `in.juvion.juvi`.

1. **Firebase project.** In the Firebase console:
   - Create the project and add the Android app `in.juvion.juvi`.
   - Add the SHA-1 and SHA-256 of the debug keystore (`keytool -list -v -keystore ~/.android/debug.keystore -storepass android`) and, once it exists, of the release keystore.
   - Download `google-services.json` to `mobile/android/app/` (it is git-ignored).
   - Save its contents as the GitHub secret `GOOGLE_SERVICES_JSON`.
2. **Backend push.**
   - Create a service-account key (Project settings → Service accounts → Generate new private key).
   - Set it, as one JSON string, in the backend's `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - In production also set `JUVI_PUSH_REQUIRED=true` and a 32+ character `JUVI_RECEIPT_KEY` (Plan 1 Ruling 16).
   - Restart; the "fake transport" startup warning should be gone.
3. **Release keystore.**
   - Create it once: `keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`.
   - Locally, put it at `mobile/android/app/upload-keystore.jks` with `mobile/android/key.properties` (`storeFile=upload-keystore.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…`).
   - In GitHub, set `ANDROID_KEYSTORE_BASE64` (`base64 -i upload-keystore.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`.
   - Add its SHA-1 and SHA-256 to the Firebase app.
4. **Run on a phone (Android 13+).** Start the backend with real FCM, then run `flutter run --dart-define=JUVI_API_BASE_URL=http://<LAN-IP>:3003/api/juvi-app/v1`.
   - Sign in as the seeded student and allow notifications at step 3.
   - Check `MobileSession.pushToken` is set for that session.
5. **Checks (spec §12 manual list, plus the app side):**
   - An Urgent notice published during the student's quiet hours rings at once, on the `juvi_urgent` channel.
   - An Important notice published at 23:00 arrives at 07:00.
   - A confidential notice shows only "New notice from <office>".
   - Three Routine notices from one office within 15 minutes arrive as one "3 new notices from <office>", and tapping it opens the attention sheet.
   - Tapping a notification opens S04 with Back to Today: with the app running, in the background, killed, and signed out (sign in, then S04).
   - In the portal, Reach shows Delivered and then Opened.
   - Turning notifications off in the system settings and returning shows S14 on Today and "Blocked in system settings" in Settings.
   - A forced crash in a release build (`flutter run --release`, then a test `throw`) appears in Crashlytics with no user id.

## Spec coverage

| Spec item | Where |
|---|---|
| §8.1 packages `firebase_core`, `firebase_messaging`, `flutter_local_notifications`, `firebase_crashlytics` | Task 1 (Ruling 1) |
| §8.1 / §10 Gradle plugins; `google-services.json` git-ignored; placeholder committed; CI secret or placeholder; README local step | Task 1, Task 11 (README "Firebase") |
| §10 release signing: `key.properties` + four CI secrets; debug builds unaffected | Task 1 (Ruling 16; dry run built a signed release APK) |
| §8.2 channels `juvi_urgent` max / `juvi_important` high / `juvi_routine` low, no sound | Task 2 (`pushChannels`), Task 5 (created at `init`, plugin test) |
| §8.2 background: top-level `@pragma('vm:entry-point')` handler, rendered with FLN, grouped by `groupKey` with a summary | Task 5 (`firebaseMessagingBackgroundHandler`, `PluginLocalNotifications.show`) |
| §8.2 `delivered` with a plain Dio, queued in shared preferences when offline, drained by the foreground | Task 3 (`Receipts`, `ReceiptQueue`), Task 5 (offline test), Task 10 (drain at start and resume) |
| §8.2 foreground: Urgent and Important rendered; every tier refreshes attention and notice providers; `delivered` | Task 5 (`handleForegroundPush`), Task 10 (wired to `NoticeActions.refresh`) |
| §8.2 fixed English strings mirroring the arb | Task 2 (test compares with `AppLocalizationsEn`) |
| §6.6 payload: confidential has no title; reminder; Routine batch `count` > 1 opens the attention sheet | Task 2 (`trayContent`, `location`) |
| §11 stable notification id from `deliveryId` collapses a duplicate send | Task 2 (`notificationIdFor`), Task 5 (ids passed to the plugin) |
| §8.3 PUT once ready and permitted; on `onTokenRefresh`, app upgrade, denied → granted; DELETE then `deleteToken()` on sign-out | Task 8 (Ruling 8; 7 tests + sign-out order test) |
| §8.4 onboarding step 3 "Allow notifications" / "Not now", either continues, `notification.permission {granted}` | Task 4 (4 tests) |
| §8.4 S14 card on Today: dismissible, "Open settings", at most every 30 days (shared preferences), re-checked on resume | Task 6 (7 card tests + Today/Teaching), Task 10 (resume re-check test) |
| §8.4 S12 "Blocked in system settings" row | Task 4 (2 tests) |
| §8.5 sources: `getInitialMessage` + FLN launch details; `onMessageOpenedApp` + FLN tap callback | Task 8 (`PushMessaging`), Task 5 (`launchPayload`, `onTap`), Task 10 (wired; cold-start and tap tests) |
| §8.5 on tap: post `opened`, `notification.opened {tier}`, `/notices/:id` or `/attention` | Task 9 (`onNotificationTap` tests) |
| §8.5 ready → home tab then push (Back lands on home); else pending in memory and secure storage, 24 h, account/institution switch, consumed when ready | Task 9 (10 tests: cold start, faculty, batch, receipt, signed out, password + onboarding, paused, restart, 24 h, account and institution switch) |
| §8.6 Crashlytics release only, `FlutterError.onError` + `PlatformDispatcher.onError`, no user id or keys | Task 10 (`installCrashReporting`, 2 tests) |
| §8.7 `BatchingAnalytics` behind `Analytics`; drift `analytics_events`, 1,000 cap oldest-first; flush 30 s / 20 events / background; debug prints; dropped on sign-out | Task 7 (8 tests, migration test, flush-on-background test) |
| §7.3 new events and the prop rules | Task 4 (`notification.permission`), Task 6 (`permission_card.*`), Task 9 (`notification.opened`), Task 7 (allow-list from the contract, `sanitizeProps`) |
| §12 Flutter tests: resolver cases; background handler with fake plugin and fake Dio (confidential, receipt, offline queue); permission card cadence; `BatchingAnalytics` flushing | Tasks 9, 5, 6, 7 |
| §12 flow: tap while signed out → sign in → S04 → Back → Today | Task 11 |
| §13 "real-device verification waits on the Firebase project" | "Real-device verification" above |

## Self-review

- **Dry run.** Every task was applied in order to a scratch copy of `main` at d01a9f2, then replayed from an untouched copy one task at a time with `build_runner`, `gen-l10n`, `flutter analyze` and both test runs at each boundary; the counts in each task are the observed ones (see "Dry run" at the top). The debug APK built with the placeholder `google-services.json`, and a release APK built and verified with a throwaway keystore.
- **Spec deviations, all in Rulings:** no stored base URL (2), no `delivered` while the OS blocks notifications (4), FCM's tap sources are wired but FLN carries the taps (5), S14 also on Teaching (10), `notice.opened` → `notice.seen` (11), analytics only while signed in (12), and `!kDebugMode` kept literally from §8.6 (15).
- **No backend gap.** The four endpoints, their schemas and the events allow-list are in the live contract and generated client; `check_nullable_objects.js` is unchanged.
- **Names are stable across tasks:** `NoticePush`, `trayContent`, `channelFor`, `notificationIdFor` / `summaryIdFor` (Task 2); `ReceiptItem` / `ReceiptQueue` / `Receipts` (3); `NotificationPermission`, `notificationsAllowedProvider` (4); `LocalNotifications`, `handleBackgroundPush` / `handleForegroundPush`, `firebaseMessagingBackgroundHandler` (5); `PermissionCard` / `PermissionDeniedCard` (6); `BatchingAnalytics`, `eventNames`, `sanitizeProps`, `QueuedEvent` (7); `PushMessaging`, `pushMessagingProvider`, `localNotificationsProvider`, `receiptsProvider`, `PushRegistration` (8); `DeepLinkResolver`, `PendingLink`, `sessionReady` (9); `PushLifecycle`, `CrashSink`, `installCrashReporting` (10).
- **Risks while executing:**
  - `flutter pub add` without constraints downgrades FLN (Ruling 1).
  - The generated client sends JSON-encoded string bodies, so a test interceptor must `jsonDecode(o.data as String)`.
  - `testWidgets` fails on a pending timer, so `BatchingAnalytics` never starts one unless signed in, and the tests that need it override `analyticsProvider`.
  - Goldens are macOS-rendered (CI excludes them).
  - The first Gradle build with the Firebase plugins takes about two minutes and prints the Kotlin Gradle plugin warning.
