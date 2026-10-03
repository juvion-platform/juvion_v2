# Juvi mobile app

Flutter client for the Juvion ERP's student and faculty network. Spec: `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md`.

## Run against a local backend
0. Firebase config (once): `cp android/app/google-services.placeholder.json android/app/google-services.json`, or put the real file from the Firebase console there (see "Firebase" below). The build needs one of the two; neither is committed.
1. `npm run dev:backend` at the repo root (API on :3003) and `npm run seed -w backend` once — the seed prints demo credentials.
2. `flutter run --dart-define=JUVI_API_BASE_URL=http://10.0.2.2:3003/api/juvi-app/v1` (Android emulator) or `http://localhost:3003/...` (iOS simulator).
3. Institution code `JIT`, the printed roll number or employee code, temporary password `river-lamp-482`.

## Regenerate the API client
`./tool/gen_api.sh` after `npm run openapi:mobile -w backend`. CI fails if the committed package differs.

## Codegen
`dart run build_runner build --delete-conflicting-outputs` (riverpod, freezed, drift) and `flutter gen-l10n` after editing ARB files.

## Golden tests
Golden images are platform-sensitive (macOS renders differ from Linux CI), so every golden test file is tagged `@Tags(['golden'])` and CI runs `flutter test --exclude-tags golden --coverage`. Generate/update goldens locally with `flutter test --tags golden` (add `--update-goldens` to refresh the committed PNGs).

## Tests
- `flutter test` — unit, widget and golden tests (`flutter test --update-goldens` after an intentional visual change).
- `flutter test test/flows` — sign in → set password → onboarding (ending on the first-notice step) → Today → acknowledge the welcome notice → "You're clear"; and a notification tapped while signed out → sign in → S04 → Back → Today. Both against a mocked API.
- `flutter test integration_test` — the same flow on a connected device or emulator.

## Notices
Spec `docs/superpowers/specs/2026-09-26-juvi-notices-design.md` §9; plan `docs/superpowers/plans/2026-10-02-juvi-notices-3-mobile.md`.
- `lib/core/repos/notices_repository.dart` is the only notices client. Attention, each segment's first page and each detail are cached (`attention`, `notices:<segment>`, `notice:<id>`); reach is live only.
- Every acknowledgement goes through `acknowledgeNotice()` (`lib/features/notices/notice_actions.dart`) behind the `AckControl` gesture: a 1.2 s hold or tap-then-confirm, confirm-only under a screen reader, never a single tap. Online it is not optimistic; offline it is queued as `notice.ack`, which `SyncWorker` replays (a 409 on replay counts as sent).
- The Due count has one source, `attentionProvider`: the tab badge (`DueBadge`), the attention stack's "+N more" and the sheet's Due label.
- Routes: `/notices/:id` (S04), `/notices/:id/reach` (S11, publishers only) and `/attention` (S05, a modal `SheetPage`).

## Notifications
Spec `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md` §8 and §10; plan `docs/superpowers/plans/2026-10-03-juvi-notifications-3-mobile.md`.
- Firebase sits behind small interfaces so tests never start it: `PushMessaging` (`lib/core/push/push_messaging.dart`), `LocalNotifications`, `NotificationPermission` and `CrashSink`. Only `lib/main.dart`, `lib/core/push/background_handler.dart`, `lib/core/push/firebase_push.dart` and `lib/core/crash/firebase_crash_sink.dart` import a Firebase package (`test/core/firebase_boundary_test.dart` enforces it). The providers default to no-op implementations; `main()` swaps in the real ones once `Firebase.initializeApp()` succeeds, and push stays off if it does not.
- Pushes are FCM data messages (backend `notifications/payload.ts`). `lib/core/push/notice_push.dart` parses them and holds the tray wording, which must match the portal's `trayNotification()` (`admin-portal/src/lib/notices.ts`), the three channels (`juvi_urgent` max, `juvi_important` high, `juvi_routine` low and silent; a reminder is always Important) and the stable notification id from `deliveryId`.
- In the background `firebaseMessagingBackgroundHandler` renders every tier and posts `delivered` with the HMAC receipt on a plain Dio (no session); offline, the receipt waits in shared preferences (`ReceiptQueue`) and `PushLifecycle` drains it at start and on resume. In the foreground Urgent and Important are rendered and every tier refreshes the notice providers.
- `PushRegistration` is created first at start-up (so it sees the restored session) and PUTs the token while signed in with notifications allowed (once per process, on token rotation and on denied → allowed). Sign-out DELETEs it before revoking the session, and any transition out of SignedIn (forced sign-out included) deletes the local FCM token. Each start-up step in `PushLifecycle` runs in its own `try`, so one failing never skips the next.
- Taps go through `DeepLinkResolver` (`lib/app/deep_link_resolver.dart`): `opened` receipt, `notification.opened {tier}`, then home tab + the notice pushed on top, or held (memory and secure storage, 24 h, same account only) until the session is ready. It accepts only `/attention` and `/notices/<24 hex characters>`; any other destination is refused, and a cold-start tap is neither lost nor opened twice.
- Analytics: `BatchingAnalytics` queues allow-listed events in the drift `analytics_events` table (newest 1,000) and flushes to `POST /v1/events` every 30 s, at 20 events and when the app goes to the background; props that break the server's rules are dropped on the device.

## Firebase
The Android app is `in.juvion.juvi`. `android/app/google-services.json` is git-ignored:
- **Local:** copy the placeholder (`android/app/google-services.placeholder.json`, a dummy project: the app builds and runs, push stays off) or download the real file from the Firebase console (Project settings → Your apps → `in.juvion.juvi`).
- **CI:** `.github/workflows/mobile.yml` writes the real file from the `GOOGLE_SERVICES_JSON` secret when it is set, and copies the placeholder otherwise.
- **Real-device check** (needs the real file and the backend's `FIREBASE_SERVICE_ACCOUNT_JSON`): an Urgent notice during quiet hours rings; an Important one sent at 23:00 arrives at 07:00; a confidential notice shows only the office; tapping a notification opens S04 with Back to Today; the portal's Reach shows Delivered and then Opened.

## Release signing
`android/key.properties` (git-ignored, with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `storeFile` is relative to `android/app/`) signs release builds; without it a release build uses the debug key. CI writes it from `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` and then also builds a signed App Bundle (artifact `juvi-release-aab`); without those secrets CI builds only the debug APK. Firebase and Play both key on the signing certificate: add the release SHA-1/SHA-256 to the Firebase app.

## Toolchain notes
- `riverpod_lint` / `custom_lint` are not installed: they require Dart >=3.13, and this toolchain pins Dart 3.12.2. Re-add them once the pinned Flutter/Dart version moves past that floor.
- `freezed` resolves to a `4.0.0-dev.x` prerelease for the same reason (`freezed` ^4.0.0 stable requires Dart >=3.13).
- The generated client (`dart-dio` 7.10.0) casts nullable-object fields (`type: ["object", "null"]` in the contract, e.g. `Me.student`/`Me.faculty`, `Config.minAppVersion`, `Config.supportContact`, `InstitutionLookup.minAppVersion`) to a non-nullable `Map`, so it throws on every real payload where one of those is actually `null` — which, for `minAppVersion`/`supportContact`, is the common case (no app-version gate, no support contact configured), not an edge case. A contract sweep (2026-09) found exactly four call sites affected, and each reads a raw `Dio` instead of going through `MobileApi` to route around it: `lib/core/repos/me_repository.dart` (`/me`, and the `/me/photo` upload body — a separate generator gap, not a nullable-object one), `lib/core/repos/auth_repository.dart`'s `lookupInstitution` (`/institutions/{code}`, on the new unauthenticated `bareDioProvider`) and `fetchAccount` (`/me`), and `lib/core/repos/config_repository.dart`'s `refresh` (`/config`). No other endpoint is affected. **When mocking any of these four, send the field as a real `null`** (as the contract and the real server do) — never a placeholder object; a mock that can't reproduce `null` here can't catch a regression back onto the generated client (R61).
- The notices endpoints carry no nullable-object field and go through the generated client, except `GET /notices/:id/attachments/:key`: the generated method interpolates the slash-bearing key (`colleges/<cid>/notices/<uuid>`) unencoded, so `notices_repository.dart` sends it on the shared Dio as one `Uri.encodeComponent` segment.
