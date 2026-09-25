# Juvi Foundation — Plan 3 of 3: Flutter Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Flutter app at `mobile/` where a provisioned student or faculty member signs in with institution code, identifier and temporary password, sets a real password, walks through onboarding, and lands on a Today or Teaching shell with Spaces and Me, with cached content readable offline and every system state designed.

**Architecture:** Feature-first Flutter project. The generated `juvi_api` package (dart-dio, from `mobile/api/openapi.json`) does the wire work behind a `Dio` instance carrying the mobile headers and a single-flight refresh interceptor. Riverpod notifiers own session and screen state; repositories read the drift cache first, then the network, and emit both. One pure `redirect` function drives go_router from `SessionState`. Writes that can happen offline queue into a drift table that a sync worker drains on reconnect.

**Tech Stack:** Flutter 3.44 / Dart 3.12 (stable, installed locally), flutter_riverpod 3 + riverpod_generator, go_router, dio, freezed + json_serializable, drift + sqlcipher_flutter_libs, flutter_secure_storage, connectivity_plus, shared_preferences, image_picker + image_cropper + flutter_image_compress, intl + flutter_localizations, package_info_plus, url_launcher; dev: build_runner, drift_dev, very_good_analysis, mocktail, http_mock_adapter, integration_test. Java 21 + `@openapitools/openapi-generator-cli` 7.10.0 for the Dart client.

**Spec:** `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` §8 (device side), §10 (contract, errors), §11 (Flutter app), §14 (app failure handling), §15 (device security), §16 (Flutter tests). Depends on Plan 1 being merged (the API and `mobile/api/openapi.json` exist).

## Global Constraints

- `mobile/` is not an npm workspace. Flutter commands run from `mobile/`. Nothing under `mobile/` imports from `backend/`.
- Targets: Android `minSdk = 29` (Android 10), iOS 15.0. Application id `in.juvion.juvi`.
- Wire types come from the generated package `juvi_api` (class `JuviApi`, API class `MobileApi`, models `SignInRequest`, `SignInResponse`, `Me`, `Spaces`, `ChannelDetail`, `Config`, `InstitutionLookup`, `Settings`, `SettingsPatch`, `OnboardingAdvance`, `OnboardingState`, `Devices`, `Tokens`, `RefreshRequest`, `ChangePasswordRequest`). Repositories convert them to JSON maps (`toJson()`) and parse app-side freezed models from those maps, so the cache is JSON-native and inline-model names never leak into app code.
- Headers on every request: `Authorization: Bearer`, `X-Juvi-App-Version`, `X-Juvi-Platform` (`android` | `ios`), `X-Juvi-Device-Id`.
- Error handling: every `DioException` becomes an `ApiFailure { code, message, status, detail }`; screens switch on `code`. Codes: `validationFailed, invalidCredentials, tokenExpired, sessionInvalidated, accountDeactivated, forbidden, notFound, gone, updateRequired, cooldown, institutionPaused, internal, offline, unknown`.
- Secrets (access token, refresh token, device id, database key) live only in `flutter_secure_storage`. Nothing personal in logs; `avoid_print` is an error via `very_good_analysis`.
- Cache: drift table `kv_cache(key, json, as_of)` for `me`, `config`, `spaces`, `channel:{id}`; `pending_actions(id, type, payload, created_at, attempts, last_error)` for `settings.patch`, `channel.mute`, `channel.unmute`, `channel.read`. Pending actions give up after 10 attempts.
- Onboarding steps are server-owned: the app renders the step whose name the server returns at `onboardingSteps[onboardingStep]`; it never hard-codes the count.
- Every screen in scope has loading (skeleton), populated, empty, error (retry, input kept) and offline (cached + "As of HH:MM") states.
- Material 3, `ColorScheme.fromSeed(seedColor: accent)`, dark mode follows the OS unless overridden in Me; minimum touch target 44 pt; text scales to 2.0 without clipping actions.
- All user-visible strings live in `lib/app/l10n/app_en.arb`; `en_IN` for dates and numbers.
- Commit after every task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

```
mobile/
  pubspec.yaml, analysis_options.yaml, l10n.yaml, openapitools.json
  api/openapi.json                         (from Plan 1)
  packages/juvi_api/                       generated; regenerate with tool/gen_api.sh
  tool/gen_api.sh
  lib/
    main.dart                              bootstrap: SQLCipher override, ProviderScope, JuviApp
    app/
      app.dart                             JuviApp: MaterialApp.router, theme, l10n
      router.dart                          GoRouter + StatefulShellRoute
      redirect.dart                        pure redirect(SessionState, location) → String?
      theme.dart                           buildTheme(accent, brightness), text roles
      l10n/app_en.arb, l10n/l10n.dart      (generated AppLocalizations + extension)
    core/
      env.dart                             AppEnv (API base URL, platform)
      models/models.dart                   freezed: Tokens, AccountSummary, SupportContact, InstitutionIdentity, AppConfigData, Me, StudentCard, FacultyCard, Settings, SpacesData, SpaceGroup, SpaceChannel, ChannelDetail, DeviceRow, Cached<T>
      storage/secure_store.dart            SecureStore
      storage/app_database.dart            drift AppDatabase, KvCache, PendingActions
      http/api_failure.dart                ApiErrorCode, ApiFailure
      http/juvi_http.dart                  buildDio(...), AuthInterceptor
      http/api_providers.dart              dioProvider, mobileApiProvider
      session/session_state.dart           freezed SessionState union
      session/session_controller.dart      SessionController (restore, signIn, signOut, handleFailure)
      repos/config_repository.dart, auth_repository.dart, me_repository.dart, spaces_repository.dart
      sync/pending_action.dart, sync/sync_worker.dart
      connectivity/connectivity_provider.dart
      analytics/analytics.dart             Analytics interface + ConsoleAnalytics
    features/
      auth/sign_in_screen.dart, institution_code_field.dart, set_password_screen.dart, forgot_password_sheet.dart
      onboarding/onboarding_screen.dart, steps/identity_step.dart, steps/spaces_step.dart, steps/notifications_step.dart, steps/photo_step.dart
      home/today_shell_screen.dart, teaching_shell_screen.dart
      spaces/spaces_screen.dart, channel_row.dart, channel_screen.dart
      me/me_screen.dart, settings_screen.dart, devices_screen.dart, change_password_screen.dart, photo_picker.dart
      system/splash_screen.dart, offline_banner.dart, deactivated_screen.dart, paused_screen.dart, update_required_screen.dart
    shared/
      widgets/empty_state.dart, skeleton.dart, section_header.dart, identity_card.dart, app_shell.dart, as_of_line.dart, failure_view.dart
      format.dart                          date/time helpers (en_IN, Asia/Kolkata display)
  test/                                    unit + widget + golden
  integration_test/sign_in_flow_test.dart
.github/workflows/mobile.yml
```

---

### Task 1: Scaffold, dependencies, generated API client, CI

**Files:**
- Create: `mobile/` (via `flutter create`), `mobile/analysis_options.yaml`, `mobile/l10n.yaml`, `mobile/openapitools.json`, `mobile/tool/gen_api.sh`, `mobile/packages/juvi_api/` (generated), `mobile/README.md`, `.github/workflows/mobile.yml`
- Modify: `mobile/pubspec.yaml`, `mobile/android/app/build.gradle.kts`, `mobile/ios/Podfile`, `mobile/ios/Runner.xcodeproj/project.pbxproj`, `.gitignore`

**Interfaces:**
- Produces: a compiling app with `flutter analyze` clean, a smoke widget test, and the `juvi_api` package importable as `package:juvi_api/juvi_api.dart` exposing `JuviApi` and `MobileApi`.

- [ ] **Step 1: Create the project and pin targets**

```bash
cd /Users/srinivasarao.kandula/code/juvion_v2
flutter create mobile --org in.juvion --project-name juvi --platforms=android,ios --empty
cd mobile
# Android 10+
sed -i '' 's/minSdk = flutter.minSdkVersion/minSdk = 29/' android/app/build.gradle.kts
# iOS 15+
sed -i '' "s/^# platform :ios, '.*'/platform :ios, '15.0'/" ios/Podfile
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]*;/IPHONEOS_DEPLOYMENT_TARGET = 15.0;/g' ios/Runner.xcodeproj/project.pbxproj
grep -n "minSdk" android/app/build.gradle.kts && grep -c "IPHONEOS_DEPLOYMENT_TARGET = 15.0" ios/Runner.xcodeproj/project.pbxproj
```
Expected: `minSdk = 29` and a count of 3 (Debug, Release, Profile).

- [ ] **Step 2: Add dependencies**

```bash
cd /Users/srinivasarao.kandula/code/juvion_v2/mobile
flutter pub add flutter_riverpod riverpod_annotation go_router dio freezed_annotation json_annotation \
  drift sqlite3_flutter_libs sqlcipher_flutter_libs flutter_secure_storage connectivity_plus shared_preferences \
  image_picker image_cropper flutter_image_compress intl package_info_plus url_launcher path_provider path
flutter pub add --dev build_runner riverpod_generator riverpod_lint custom_lint freezed json_serializable drift_dev \
  very_good_analysis mocktail http_mock_adapter
```

Then edit `pubspec.yaml` by hand:

```yaml
dependencies:
  flutter_localizations:
    sdk: flutter
  juvi_api:
    path: packages/juvi_api

dev_dependencies:
  integration_test:
    sdk: flutter

flutter:
  uses-material-design: true
  generate: true
```

```yaml
# mobile/analysis_options.yaml
include: package:very_good_analysis/analysis_options.yaml
analyzer:
  plugins:
    - custom_lint
  exclude:
    - "**/*.g.dart"
    - "**/*.freezed.dart"
    - "lib/app/l10n/*.dart"
    - "packages/**"
linter:
  rules:
    public_member_api_docs: false
    lines_longer_than_80_chars: false
    avoid_print: true
```

```yaml
# mobile/l10n.yaml
arb-dir: lib/app/l10n
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
```

- [ ] **Step 3: Generate the API client**

```json
// mobile/openapitools.json
{
  "$schema": "./node_modules/@openapitools/openapi-generator-cli/config.schema.json",
  "spaces": 2,
  "generator-cli": { "version": "7.10.0" }
}
```

```bash
#!/usr/bin/env bash
# mobile/tool/gen_api.sh — regenerate packages/juvi_api from api/openapi.json.
# Requires Java 17+ and Node (npx). The generator version is pinned in openapitools.json.
set -euo pipefail
MOBILE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MOBILE"
rm -rf packages/juvi_api
npx --yes @openapitools/openapi-generator-cli generate \
  -i api/openapi.json \
  -g dart-dio \
  -o packages/juvi_api \
  --skip-validate-spec \
  --additional-properties=pubName=juvi_api,pubLibrary=juvi_api,pubVersion=1.0.0,pubDescription="Generated Juvi mobile API client",serializationLibrary=json_serializable
cd packages/juvi_api
dart pub get
dart run build_runner build --delete-conflicting-outputs
cd "$MOBILE"
flutter pub get
echo "juvi_api regenerated"
```

Run: `chmod +x tool/gen_api.sh && ./tool/gen_api.sh`
Expected: `packages/juvi_api/lib/src/api/mobile_api.dart` exists with methods `signIn`, `getMe`, `listSpaces`, `getChannel`, `lookupInstitution`, `getConfig`, `refresh`, `signOut`, `changePassword`, `getSettings`, `updateSettings`, `advanceOnboarding`, `listDevices`, `revokeDevice`, `revokeOtherDevices`, `uploadPhoto`, `muteChannel`, `unmuteChannel`, `markChannelRead`; `packages/juvi_api/lib/src/model/sign_in_request.dart` exists. Confirm with `grep -c "Future<Response<" packages/juvi_api/lib/src/api/mobile_api.dart` → 19.

Add to the repo root `.gitignore`:

```
# Flutter
mobile/.dart_tool/
mobile/build/
mobile/.flutter-plugins-dependencies
mobile/packages/juvi_api/.dart_tool/
mobile/packages/juvi_api/build/
mobile/ios/Pods/
mobile/android/.gradle/
mobile/android/local.properties
```

- [ ] **Step 4: Smoke test and analyzer**

```dart
// mobile/test/smoke_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi_api/juvi_api.dart';

void main() {
  test('generated client exposes MobileApi', () {
    final api = JuviApi(basePathOverride: 'http://localhost:3003/api/juvi-app/v1');
    expect(api.getMobileApi(), isA<MobileApi>());
  });
}
```

Run: `cd mobile && flutter analyze && flutter test`
Expected: no analyzer issues, 1 test passes.

- [ ] **Step 5: CI workflow and README**

```yaml
# .github/workflows/mobile.yml
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
      - run: flutter test --coverage
      - run: flutter build apk --debug
```

```markdown
<!-- mobile/README.md -->
# Juvi mobile app

Flutter client for the Juvion ERP's student and faculty network. Spec: `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md`.

## Run against a local backend
1. `npm run dev:backend` at the repo root (API on :3003) and `npm run seed -w backend` once — the seed prints demo credentials.
2. `flutter run --dart-define=JUVI_API_BASE_URL=http://10.0.2.2:3003/api/juvi-app/v1` (Android emulator) or `http://localhost:3003/...` (iOS simulator).
3. Institution code `JIT`, the printed roll number or employee code, temporary password `river-lamp-482`.

## Regenerate the API client
`./tool/gen_api.sh` after `npm run openapi:mobile -w backend`. CI fails if the committed package differs.

## Codegen
`dart run build_runner build --delete-conflicting-outputs` (riverpod, freezed, drift) and `flutter gen-l10n` after editing ARB files.
```

- [ ] **Step 6: Commit**

```bash
cd /Users/srinivasarao.kandula/code/juvion_v2
git add mobile .gitignore .github/workflows/mobile.yml
git commit -m "feat(mobile): scaffold the Juvi Flutter app with a generated dart-dio API client and CI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Secure store and encrypted database

**Files:**
- Create: `mobile/lib/core/storage/secure_store.dart`, `mobile/lib/core/storage/app_database.dart`, `mobile/lib/core/models/models.dart`, `mobile/lib/core/env.dart`
- Test: `mobile/test/core/storage/app_database_test.dart`, `mobile/test/core/storage/secure_store_test.dart`

**Interfaces:**
- Produces:
  ```dart
  class AppEnv { static const apiBaseUrl; static String get platform; }
  class SecureStore {
    Future<Tokens?> readTokens(); Future<void> writeTokens(Tokens t); Future<void> clearTokens();
    Future<String> deviceId();            // stable per install, created on first call
    Future<String> databaseKey();         // 32 random bytes as hex, created once
    Future<String?> readCollegeId(); Future<void> writeCollegeId(String id);
    Future<void> wipeAll();               // everything but deviceId and databaseKey
  }
  class AppDatabase {
    AppDatabase.memory(); static Future<AppDatabase> openEncrypted(String key);
    Future<CachedDoc?> readDoc(String key); Future<void> writeDoc(String key, Map<String, dynamic> json, DateTime asOf); Future<void> wipe();
    Future<void> enqueueAction(PendingAction a); Future<List<PendingAction>> pendingActions(); Future<void> recordAttempt(String id, String error); Future<void> removeAction(String id);
  }
  // models.dart (freezed): Tokens, AccountSummary, SupportContact, InstitutionIdentity, AppConfigData, Cached<T> (data, asOf, stale, failure)
  ```

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/core/storage/app_database_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';

void main() {
  late AppDatabase db;
  setUp(() => db = AppDatabase.memory());
  tearDown(() => db.close());

  test('kv cache round-trips JSON with its as-of time and overwrites on the same key', () async {
    final t1 = DateTime.utc(2026, 9, 23, 3);
    await db.writeDoc('me', {'a': 1}, t1);
    final first = await db.readDoc('me');
    expect(first!.json, {'a': 1});
    expect(first.asOf, t1);
    await db.writeDoc('me', {'a': 2}, t1.add(const Duration(minutes: 1)));
    expect((await db.readDoc('me'))!.json, {'a': 2});
    expect(await db.readDoc('missing'), isNull);
  });

  test('pending actions are FIFO, count attempts and can be removed', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await db.enqueueAction(PendingAction.create('settings.patch', {'tiers': {'routine': false}}));
    final list = await db.pendingActions();
    expect(list.map((a) => a.type), ['channel.mute', 'settings.patch']);
    await db.recordAttempt(list.first.id, 'offline');
    expect((await db.pendingActions()).first.attempts, 1);
    expect((await db.pendingActions()).first.lastError, 'offline');
    await db.removeAction(list.first.id);
    expect((await db.pendingActions()).map((a) => a.type), ['settings.patch']);
  });

  test('wipe clears everything', () async {
    await db.writeDoc('me', {'a': 1}, DateTime.now());
    await db.enqueueAction(PendingAction.create('channel.read', {'channelId': 'c1'}));
    await db.wipe();
    expect(await db.readDoc('me'), isNull);
    expect(await db.pendingActions(), isEmpty);
  });
}
```

```dart
// mobile/test/core/storage/secure_store_test.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:mocktail/mocktail.dart';

class _Storage extends Mock implements FlutterSecureStorage {}

void main() {
  late _Storage storage;
  late Map<String, String> mem;
  late SecureStore store;

  setUp(() {
    storage = _Storage();
    mem = {};
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    store = SecureStore(storage);
  });

  test('device id and database key are created once and stable', () async {
    final id1 = await store.deviceId();
    final id2 = await store.deviceId();
    expect(id1, id2);
    expect(id1, matches(RegExp(r'^[0-9a-f]{32}$')));
    final k = await store.databaseKey();
    expect(k, matches(RegExp(r'^[0-9a-f]{64}$')));
    expect(await store.databaseKey(), k);
  });

  test('tokens round-trip and wipeAll keeps device id and db key', () async {
    final id = await store.deviceId();
    final key = await store.databaseKey();
    await store.writeTokens(const Tokens(accessToken: 'a', refreshToken: 'r'));
    await store.writeCollegeId('c1');
    expect(await store.readTokens(), const Tokens(accessToken: 'a', refreshToken: 'r'));
    await store.wipeAll();
    expect(await store.readTokens(), isNull);
    expect(await store.readCollegeId(), isNull);
    expect(await store.deviceId(), id);
    expect(await store.databaseKey(), key);
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/core/storage`
Expected: FAIL: missing imports.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/core/env.dart
import 'dart:io' show Platform;

class AppEnv {
  /// Android emulator reaches the host at 10.0.2.2; override with --dart-define.
  static const apiBaseUrl = String.fromEnvironment(
    'JUVI_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3003/api/juvi-app/v1',
  );
  static String get platform => Platform.isIOS ? 'ios' : 'android';
}
```

```dart
// mobile/lib/core/models/models.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:juvi/core/http/api_failure.dart';

part 'models.freezed.dart';
part 'models.g.dart';

@freezed
class Tokens with _$Tokens {
  const factory Tokens({required String accessToken, required String refreshToken}) = _Tokens;
  factory Tokens.fromJson(Map<String, dynamic> json) => _$TokensFromJson(json);
}

@freezed
class SupportContact with _$SupportContact {
  const factory SupportContact({required String name, String? phone, String? email}) = _SupportContact;
  factory SupportContact.fromJson(Map<String, dynamic> json) => _$SupportContactFromJson(json);
}

@freezed
class AccountSummary with _$AccountSummary {
  const factory AccountSummary({
    required String id,
    required String kind,           // student | faculty | staff
    required String status,
    required int onboardingStep,
    required List<String> onboardingSteps,
    required bool onboardingComplete,
    required bool mustChangePassword,
  }) = _AccountSummary;
  factory AccountSummary.fromJson(Map<String, dynamic> json) => _$AccountSummaryFromJson(json);
}

@freezed
class InstitutionIdentity with _$InstitutionIdentity {
  const factory InstitutionIdentity({
    required String collegeId,
    required String name,
    String? logoUrl,
    String? accentColor,
    required bool paused,
    String? pausedMessage,
  }) = _InstitutionIdentity;
  factory InstitutionIdentity.fromJson(Map<String, dynamic> json) => _$InstitutionIdentityFromJson(json);
}

@freezed
class AppConfigData with _$AppConfigData {
  const factory AppConfigData({
    required String name,
    required String code,
    String? logoUrl,
    String? accentColor,
    SupportContact? supportContact,
    required Map<String, String> quietHoursDefault,
    required String timezone,
    required List<String> onboardingSteps,
  }) = _AppConfigData;
  factory AppConfigData.fromJson(Map<String, dynamic> json) => _$AppConfigDataFromJson(json);
}

/// A cached value with its server as-of time. `stale` means the last refresh failed.
class Cached<T> {
  const Cached(this.data, this.asOf, {this.stale = false, this.failure});
  final T data;
  final DateTime asOf;
  final bool stale;
  final ApiFailure? failure;
  Cached<T> markStale(ApiFailure f) => Cached(data, asOf, stale: true, failure: f);
}
```

`ApiFailure` is defined in Task 3; for this task create `lib/core/http/api_failure.dart` with the enum and class from Task 3 Step 3 now (it has no dependencies), so `models.dart` compiles.

```dart
// mobile/lib/core/storage/secure_store.dart
import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:juvi/core/models/models.dart';

class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _s = storage ?? const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  final FlutterSecureStorage _s;

  static const _access = 'juvi.access';
  static const _refresh = 'juvi.refresh';
  static const _device = 'juvi.device_id';
  static const _dbKey = 'juvi.db_key';
  static const _college = 'juvi.college_id';

  static String _randomHex(int bytes) {
    final r = Random.secure();
    return List.generate(bytes, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  Future<String> _getOrCreate(String key, int bytes) async {
    final existing = await _s.read(key: key);
    if (existing != null) return existing;
    final v = _randomHex(bytes);
    await _s.write(key: key, value: v);
    return v;
  }

  Future<String> deviceId() => _getOrCreate(_device, 16);
  Future<String> databaseKey() => _getOrCreate(_dbKey, 32);

  Future<Tokens?> readTokens() async {
    final a = await _s.read(key: _access);
    final r = await _s.read(key: _refresh);
    if (a == null || r == null) return null;
    return Tokens(accessToken: a, refreshToken: r);
  }

  Future<void> writeTokens(Tokens t) async {
    await _s.write(key: _access, value: t.accessToken);
    await _s.write(key: _refresh, value: t.refreshToken);
  }

  Future<void> clearTokens() async {
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
  }

  Future<String?> readCollegeId() => _s.read(key: _college);
  Future<void> writeCollegeId(String id) => _s.write(key: _college, value: id);

  /// Sign-out and deactivation: forget the session, keep the device identity and the DB key.
  Future<void> wipeAll() async {
    await clearTokens();
    await _s.delete(key: _college);
  }
}
```

```dart
// mobile/lib/core/sync/pending_action.dart
import 'dart:convert';
import 'dart:math';

class PendingAction {
  PendingAction({required this.id, required this.type, required this.payload, required this.createdAt, this.attempts = 0, this.lastError});
  factory PendingAction.create(String type, Map<String, dynamic> payload) => PendingAction(
        id: '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 20)}',
        type: type,
        payload: payload,
        createdAt: DateTime.now(),
      );
  final String id;
  final String type;        // settings.patch | channel.mute | channel.unmute | channel.read
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final int attempts;
  final String? lastError;
  String get payloadJson => jsonEncode(payload);
}
```

```dart
// mobile/lib/core/storage/app_database.dart
import 'dart:convert';
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

class KvCache extends Table {
  TextColumn get key => text()();
  TextColumn get json => text()();
  DateTimeColumn get asOf => dateTime()();
  @override
  Set<Column> get primaryKey => {key};
}

class PendingActions extends Table {
  TextColumn get id => text()();
  TextColumn get type => text()();
  TextColumn get payload => text()();
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  @override
  Set<Column> get primaryKey => {id};
}

class CachedDoc {
  const CachedDoc(this.json, this.asOf);
  final Map<String, dynamic> json;
  final DateTime asOf;
}

@DriftDatabase(tables: [KvCache, PendingActions])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);
  AppDatabase.memory() : super(NativeDatabase.memory());

  /// SQLCipher-encrypted file database. `key` comes from SecureStore.databaseKey().
  static Future<AppDatabase> openEncrypted(String key) async {
    final dir = await getApplicationSupportDirectory();
    final file = File(p.join(dir.path, 'juvi.db'));
    return AppDatabase(NativeDatabase.createInBackground(file, setup: (raw) {
      raw.execute("PRAGMA key = '$key';");
    }));
  }

  @override
  int get schemaVersion => 1;

  Future<CachedDoc?> readDoc(String key) async {
    final row = await (select(kvCache)..where((t) => t.key.equals(key))).getSingleOrNull();
    if (row == null) return null;
    return CachedDoc(jsonDecode(row.json) as Map<String, dynamic>, row.asOf.toUtc());
  }

  Future<void> writeDoc(String key, Map<String, dynamic> json, DateTime asOf) =>
      into(kvCache).insertOnConflictUpdate(KvCacheCompanion.insert(key: key, json: jsonEncode(json), asOf: asOf.toUtc()));

  Future<void> deleteDoc(String key) => (delete(kvCache)..where((t) => t.key.equals(key))).go();

  Future<void> enqueueAction(PendingAction a) => into(pendingActions).insert(PendingActionsCompanion.insert(
        id: a.id, type: a.type, payload: a.payloadJson, createdAt: a.createdAt,
      ));

  Future<List<PendingAction>> pendingActions() async {
    final rows = await (select(pendingActions)..orderBy([(t) => OrderingTerm.asc(t.createdAt)])).get();
    return rows
        .map((r) => PendingAction(
              id: r.id, type: r.type, payload: jsonDecode(r.payload) as Map<String, dynamic>,
              createdAt: r.createdAt, attempts: r.attempts, lastError: r.lastError,
            ))
        .toList();
  }

  Future<void> recordAttempt(String id, String error) => (update(pendingActions)..where((t) => t.id.equals(id)))
      .write(PendingActionsCompanion(attempts: Value.absentIfNull(null), lastError: Value(error)))
      .then((_) => customStatement('UPDATE pending_actions SET attempts = attempts + 1 WHERE id = ?', [id]));

  Future<void> removeAction(String id) => (delete(pendingActions)..where((t) => t.id.equals(id))).go();

  Future<void> wipe() async {
    await delete(kvCache).go();
    await delete(pendingActions).go();
  }
}
```

Run codegen: `cd mobile && dart run build_runner build --delete-conflicting-outputs`

- [ ] **Step 4: Run the tests and analyzer**

Run: `cd mobile && flutter test test/core/storage && flutter analyze`
Expected: PASS (5 tests), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(mobile): secure store, encrypted drift cache with pending-action queue, core models

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: HTTP layer — failures, headers, single-flight refresh

**Files:**
- Create: `mobile/lib/core/http/api_failure.dart` (finalise), `mobile/lib/core/http/juvi_http.dart`, `mobile/lib/core/http/api_providers.dart`
- Test: `mobile/test/core/http/api_failure_test.dart`, `mobile/test/core/http/juvi_http_test.dart`

**Interfaces:**
- Produces:
  ```dart
  enum ApiErrorCode { validationFailed, invalidCredentials, tokenExpired, sessionInvalidated, accountDeactivated, forbidden, notFound, gone, updateRequired, cooldown, institutionPaused, internal, offline, unknown; static ApiErrorCode fromWire(String?) }
  class ApiFailure implements Exception { final ApiErrorCode code; final String message; final int? status; final Map<String, dynamic> detail; bool get isOffline; int? get retryAfterSeconds; String? get reason; factory ApiFailure.fromDio(DioException); static ApiFailure of(Object e); }
  typedef RefreshFn = Future<Tokens?> Function();      // returns new tokens, or null when the session is gone
  Dio buildDio({required String baseUrl, required Future<String?> Function() accessToken, required RefreshFn refresh, required Future<String> Function() deviceId, required String appVersion, required String platform, void Function(ApiFailure)? onFatal});
  // api_providers.dart (riverpod): secureStoreProvider, appDatabaseProvider (FutureProvider), dioProvider, mobileApiProvider, bareMobileApiProvider (no interceptors, for refresh)
  ```

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/core/http/api_failure_test.dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';

DioException _dio(int status, Map<String, dynamic> body) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: status, data: body),
      type: DioExceptionType.badResponse,
    );

void main() {
  test('parses the envelope into code, message and detail', () {
    final f = ApiFailure.fromDio(_dio(429, {'error': {'code': 'COOLDOWN', 'message': 'Wait', 'retryAfterSeconds': 540}}));
    expect(f.code, ApiErrorCode.cooldown);
    expect(f.message, 'Wait');
    expect(f.status, 429);
    expect(f.retryAfterSeconds, 540);
    expect(f.detail.containsKey('code'), isFalse);
  });

  test('unknown wire codes become unknown; connection errors become offline', () {
    expect(ApiFailure.fromDio(_dio(500, {'error': {'code': 'WHATEVER', 'message': 'x'}})).code, ApiErrorCode.unknown);
    final off = ApiFailure.fromDio(DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.connectionError));
    expect(off.code, ApiErrorCode.offline);
    expect(off.isOffline, isTrue);
  });

  test('of() unwraps a DioException carrying an ApiFailure', () {
    final inner = const ApiFailure(ApiErrorCode.notFound, 'gone');
    final wrapped = DioException(requestOptions: RequestOptions(path: '/x'), error: inner);
    expect(ApiFailure.of(wrapped), same(inner));
    expect(ApiFailure.of(StateError('boom')).code, ApiErrorCode.unknown);
  });
}
```

```dart
// mobile/test/core/http/juvi_http_test.dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/models/models.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  String? token;
  int refreshes = 0;
  ApiFailure? fatal;

  setUp(() {
    token = 'old';
    refreshes = 0;
    fatal = null;
    dio = buildDio(
      baseUrl: 'https://api.test/v1',
      accessToken: () async => token,
      refresh: () async {
        refreshes++;
        token = 'new';
        return const Tokens(accessToken: 'new', refreshToken: 'r2');
      },
      deviceId: () async => 'dev-1',
      appVersion: '1.0.0',
      platform: 'android',
      onFatal: (f) => fatal = f,
    );
    adapter = DioAdapter(dio: dio);
  });

  test('sends the mobile headers', () async {
    adapter.onGet('/me', (s) => s.reply(200, {'ok': true}), headers: {
      'Authorization': 'Bearer old', 'X-Juvi-App-Version': '1.0.0', 'X-Juvi-Platform': 'android', 'X-Juvi-Device-Id': 'dev-1',
    });
    final r = await dio.get<Map<String, dynamic>>('/me');
    expect(r.data, {'ok': true});
  });

  test('refreshes once on TOKEN_EXPIRED and replays with the new token', () async {
    var calls = 0;
    adapter.onGet('/me', (s) {
      calls++;
      if (calls == 1) {
        s.reply(401, {'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'}});
      } else {
        s.reply(200, {'ok': true});
      }
    });
    final r = await dio.get<Map<String, dynamic>>('/me');
    expect(r.data, {'ok': true});
    expect(refreshes, 1);
    expect(calls, 2);
  });

  test('SESSION_INVALIDATED is fatal and surfaces as ApiFailure', () async {
    adapter.onGet('/spaces', (s) => s.reply(401, {'error': {'code': 'SESSION_INVALIDATED', 'message': 'x', 'reason': 'signed_out_elsewhere'}}));
    try {
      await dio.get<void>('/spaces');
      fail('should throw');
    } on DioException catch (e) {
      final f = ApiFailure.of(e);
      expect(f.code, ApiErrorCode.sessionInvalidated);
      expect(f.reason, 'signed_out_elsewhere');
    }
    expect(fatal?.code, ApiErrorCode.sessionInvalidated);
    expect(refreshes, 0);
  });

  test('a failed refresh turns into SESSION_INVALIDATED', () async {
    dio = buildDio(
      baseUrl: 'https://api.test/v1', accessToken: () async => 'old', refresh: () async => null,
      deviceId: () async => 'd', appVersion: '1', platform: 'ios', onFatal: (f) => fatal = f,
    );
    adapter = DioAdapter(dio: dio);
    adapter.onGet('/me', (s) => s.reply(401, {'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'}}));
    await expectLater(dio.get<void>('/me'), throwsA(isA<DioException>()));
    expect(fatal?.code, ApiErrorCode.sessionInvalidated);
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/core/http`
Expected: FAIL: `juvi_http.dart` missing.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/core/http/api_failure.dart
import 'package:dio/dio.dart';

enum ApiErrorCode {
  validationFailed, invalidCredentials, tokenExpired, sessionInvalidated, accountDeactivated,
  forbidden, notFound, gone, updateRequired, cooldown, institutionPaused, internal, offline, unknown;

  static ApiErrorCode fromWire(String? code) => switch (code) {
        'VALIDATION_FAILED' => validationFailed,
        'INVALID_CREDENTIALS' => invalidCredentials,
        'TOKEN_EXPIRED' => tokenExpired,
        'SESSION_INVALIDATED' => sessionInvalidated,
        'ACCOUNT_DEACTIVATED' => accountDeactivated,
        'FORBIDDEN' => forbidden,
        'NOT_FOUND' => notFound,
        'GONE' => gone,
        'UPDATE_REQUIRED' => updateRequired,
        'COOLDOWN' => cooldown,
        'INSTITUTION_PAUSED' => institutionPaused,
        'INTERNAL' => internal,
        _ => unknown,
      };
}

class ApiFailure implements Exception {
  const ApiFailure(this.code, this.message, {this.status, this.detail = const {}});

  factory ApiFailure.fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return const ApiFailure(ApiErrorCode.offline, "You're offline.");
      case DioExceptionType.unknown:
        if (e.response == null) return const ApiFailure(ApiErrorCode.offline, "You're offline.");
      case DioExceptionType.badResponse:
      case DioExceptionType.badCertificate:
      case DioExceptionType.cancel:
        break;
    }
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = Map<String, dynamic>.from(data['error'] as Map);
      final code = ApiErrorCode.fromWire(err.remove('code') as String?);
      final message = (err.remove('message') as String?) ?? 'Something went wrong.';
      return ApiFailure(code, message, status: e.response?.statusCode, detail: err);
    }
    return ApiFailure(ApiErrorCode.unknown, 'Something went wrong.', status: e.response?.statusCode);
  }

  /// Normalises anything thrown by the client into an ApiFailure.
  static ApiFailure of(Object e) {
    if (e is ApiFailure) return e;
    if (e is DioException) return e.error is ApiFailure ? e.error! as ApiFailure : ApiFailure.fromDio(e);
    return ApiFailure(ApiErrorCode.unknown, e.toString());
  }

  final ApiErrorCode code;
  final String message;
  final int? status;
  final Map<String, dynamic> detail;

  bool get isOffline => code == ApiErrorCode.offline;
  int? get retryAfterSeconds => detail['retryAfterSeconds'] as int?;
  String? get reason => detail['reason'] as String?;
  List<Map<String, dynamic>> get fields =>
      (detail['fields'] as List?)?.cast<Map>().map((m) => Map<String, dynamic>.from(m)).toList() ?? const [];

  @override
  String toString() => 'ApiFailure(${code.name}, $message)';
}
```

```dart
// mobile/lib/core/http/juvi_http.dart
import 'package:dio/dio.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';

typedef RefreshFn = Future<Tokens?> Function();

const _fatalCodes = {
  ApiErrorCode.sessionInvalidated, ApiErrorCode.accountDeactivated,
  ApiErrorCode.institutionPaused, ApiErrorCode.updateRequired,
};

/// Dio configured for the Juvi mobile API: headers, one refresh per expiry, ApiFailure errors.
Dio buildDio({
  required String baseUrl,
  required Future<String?> Function() accessToken,
  required RefreshFn refresh,
  required Future<String> Function() deviceId,
  required String appVersion,
  required String platform,
  void Function(ApiFailure failure)? onFatal,
}) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    headers: {'X-Juvi-App-Version': appVersion, 'X-Juvi-Platform': platform},
  ));
  dio.interceptors.add(_AuthInterceptor(dio, accessToken: accessToken, refresh: refresh, deviceId: deviceId, onFatal: onFatal));
  return dio;
}

/// QueuedInterceptorsWrapper serialises onError, so parallel 401s share one refresh.
class _AuthInterceptor extends QueuedInterceptorsWrapper {
  _AuthInterceptor(this._dio, {required this.accessToken, required this.refresh, required this.deviceId, this.onFatal});
  final Dio _dio;
  final Future<String?> Function() accessToken;
  final RefreshFn refresh;
  final Future<String> Function() deviceId;
  final void Function(ApiFailure)? onFatal;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await accessToken();
    if (token != null && options.headers['Authorization'] == null) options.headers['Authorization'] = 'Bearer $token';
    options.headers['X-Juvi-Device-Id'] = await deviceId();
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    var failure = ApiFailure.fromDio(err);

    if (failure.code == ApiErrorCode.tokenExpired && err.requestOptions.extra['retried'] != true) {
      final tokens = await refresh();
      if (tokens != null) {
        final opts = err.requestOptions
          ..headers['Authorization'] = 'Bearer ${tokens.accessToken}'
          ..extra['retried'] = true;
        try {
          final response = await _dio.fetch<dynamic>(opts);
          return handler.resolve(response);
        } on DioException catch (e) {
          failure = ApiFailure.fromDio(e);
          err = e;
        }
      } else {
        failure = const ApiFailure(ApiErrorCode.sessionInvalidated, 'Please sign in again.', status: 401, detail: {'reason': 'expired'});
      }
    }

    if (_fatalCodes.contains(failure.code)) onFatal?.call(failure);
    handler.reject(DioException(requestOptions: err.requestOptions, response: err.response, type: err.type, error: failure));
  }
}
```

```dart
// mobile/lib/core/http/api_providers.dart
import 'package:dio/dio.dart';
import 'package:juvi/core/env.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'api_providers.g.dart';

@Riverpod(keepAlive: true)
SecureStore secureStore(Ref ref) => SecureStore();

@Riverpod(keepAlive: true)
Future<AppDatabase> appDatabase(Ref ref) async => AppDatabase.openEncrypted(await ref.read(secureStoreProvider).databaseKey());

@Riverpod(keepAlive: true)
Future<String> appVersion(Ref ref) async => (await PackageInfo.fromPlatform()).version;

/// No interceptors: used only for the refresh call itself.
@Riverpod(keepAlive: true)
MobileApi bareMobileApi(Ref ref) => JuviApi(basePathOverride: AppEnv.apiBaseUrl).getMobileApi();

@Riverpod(keepAlive: true)
Dio dio(Ref ref) {
  final store = ref.read(secureStoreProvider);
  return buildDio(
    baseUrl: AppEnv.apiBaseUrl,
    accessToken: () async => (await store.readTokens())?.accessToken,
    refresh: () => ref.read(sessionControllerProvider.notifier).refreshTokens(),
    deviceId: store.deviceId,
    appVersion: ref.read(appVersionProvider).valueOrNull ?? '0.0.0',
    platform: AppEnv.platform,
    onFatal: (ApiFailure f) => ref.read(sessionControllerProvider.notifier).handleFailure(f),
  );
}

@Riverpod(keepAlive: true)
MobileApi mobileApi(Ref ref) => JuviApi(dio: ref.read(dioProvider), basePathOverride: AppEnv.apiBaseUrl).getMobileApi();
```

`api_providers.dart` references `SessionController.refreshTokens` and `handleFailure` from Task 4; it compiles once Task 4 lands. Commit it here anyway; the analyzer will flag the missing import until then, so run Task 4 immediately after.

- [ ] **Step 4: Run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter test test/core/http`
Expected: PASS (7 tests). `flutter analyze` reports only the unresolved `session_controller.dart` import, resolved by Task 4.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/http mobile/test/core/http
git commit -m "feat(mobile): ApiFailure envelope parsing and Dio with mobile headers and single-flight refresh

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Session controller and auth/config repositories

**Files:**
- Create: `mobile/lib/core/session/session_state.dart`, `mobile/lib/core/session/session_controller.dart`, `mobile/lib/core/repos/auth_repository.dart`, `mobile/lib/core/repos/config_repository.dart`
- Test: `mobile/test/core/session/session_controller_test.dart`

**Interfaces:**
- Produces:
  ```dart
  @freezed sealed class SessionState { loading(); signedOut({String? reason}); signedIn(AccountSummary account); deactivated({SupportContact? supportContact}); paused(String message); updateRequired({required String minVersion, required String storeUrl}); }
  abstract class AuthRepository {
    Future<InstitutionIdentity> lookupInstitution(String code);
    Future<({Tokens tokens, AccountSummary account})> signIn({required String collegeId, required String identifier, required String password, required DeviceInfo device});
    Future<Tokens?> refresh(String refreshToken, String deviceId);   // null when the session is gone
    Future<void> signOut(); Future<void> changePassword(String current, String next);
  }
  abstract class ConfigRepository { Future<Cached<AppConfigData>?> cached(); Future<Cached<AppConfigData>> refresh(); }
  class SessionController extends _$SessionController {
    Future<void> restore(); Future<void> signIn({collegeId, identifier, password}); Future<void> signOut();
    Future<Tokens?> refreshTokens(); void handleFailure(ApiFailure f); void updateAccount(AccountSummary a);
  }
  ```
  Providers: `authRepositoryProvider`, `configRepositoryProvider`, `sessionControllerProvider`, `deviceInfoProvider`.

- [ ] **Step 1: Write the failing test**

```dart
// mobile/test/core/session/session_controller_test.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:mocktail/mocktail.dart';

class _Auth extends Mock implements AuthRepository {}
class _Storage extends Mock implements FlutterSecureStorage {}

const account = AccountSummary(id: 'a1', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: false, mustChangePassword: true);

void main() {
  late _Auth auth;
  late Map<String, String> mem;
  late AppDatabase db;
  late ProviderContainer c;

  setUp(() {
    auth = _Auth();
    mem = {};
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async { mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String; });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    db = AppDatabase.memory();
    c = ProviderContainer(overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      secureStoreProvider.overrideWithValue(SecureStore(storage)),
      appDatabaseProvider.overrideWith((_) async => db),
      appVersionProvider.overrideWith((_) async => '1.0.0'),
    ]);
  });
  tearDown(() { c.dispose(); db.close(); });

  test('restore with no tokens → signedOut', () async {
    final s = c.read(sessionControllerProvider.notifier);
    await s.restore();
    expect(c.read(sessionControllerProvider), const SessionState.signedOut());
  });

  test('signIn stores tokens and account, state becomes signedIn', () async {
    when(() => auth.signIn(collegeId: 'c1', identifier: '21CS1', password: 'pw', device: any(named: 'device')))
        .thenAnswer((_) async => (tokens: const Tokens(accessToken: 'a', refreshToken: 'r'), account: account));
    final s = c.read(sessionControllerProvider.notifier);
    await s.signIn(collegeId: 'c1', identifier: '21CS1', password: 'pw');
    expect(c.read(sessionControllerProvider), const SessionState.signedIn(account));
    expect(mem['juvi.access'], 'a');
    expect(mem['juvi.college_id'], 'c1');
    expect((await db.readDoc('account'))!.json['id'], 'a1');
  });

  test('restore with tokens uses the cached account immediately', () async {
    mem['juvi.access'] = 'a'; mem['juvi.refresh'] = 'r';
    await db.writeDoc('account', account.toJson(), DateTime.now());
    final s = c.read(sessionControllerProvider.notifier);
    await s.restore();
    expect(c.read(sessionControllerProvider), const SessionState.signedIn(account));
  });

  test('handleFailure maps fatal codes to states and wipes on sign-out-class failures', () async {
    mem['juvi.access'] = 'a';
    final s = c.read(sessionControllerProvider.notifier);
    s.handleFailure(const ApiFailure(ApiErrorCode.institutionPaused, 'Back Monday', detail: {'message': 'Back Monday'}));
    expect(c.read(sessionControllerProvider), const SessionState.paused('Back Monday'));
    s.handleFailure(const ApiFailure(ApiErrorCode.updateRequired, 'x', detail: {'minVersion': '1.2.0', 'storeUrl': 'https://play'}));
    expect(c.read(sessionControllerProvider), const SessionState.updateRequired(minVersion: '1.2.0', storeUrl: 'https://play'));
    s.handleFailure(const ApiFailure(ApiErrorCode.sessionInvalidated, 'x', detail: {'reason': 'password_changed'}));
    await Future<void>.delayed(Duration.zero);
    expect(c.read(sessionControllerProvider), const SessionState.signedOut(reason: 'password_changed'));
    expect(mem['juvi.access'], isNull);
  });

  test('refreshTokens rotates and persists; a null refresh wipes', () async {
    mem['juvi.access'] = 'a'; mem['juvi.refresh'] = 'r';
    when(() => auth.refresh('r', any())).thenAnswer((_) async => const Tokens(accessToken: 'a2', refreshToken: 'r2'));
    final s = c.read(sessionControllerProvider.notifier);
    expect(await s.refreshTokens(), const Tokens(accessToken: 'a2', refreshToken: 'r2'));
    expect(mem['juvi.refresh'], 'r2');
    when(() => auth.refresh('r2', any())).thenAnswer((_) async => null);
    expect(await s.refreshTokens(), isNull);
    expect(mem['juvi.access'], isNull);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && flutter test test/core/session`
Expected: FAIL: missing files.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/core/session/session_state.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:juvi/core/models/models.dart';

part 'session_state.freezed.dart';

@freezed
sealed class SessionState with _$SessionState {
  const factory SessionState.loading() = SessionLoading;
  const factory SessionState.signedOut({String? reason}) = SignedOut;
  const factory SessionState.signedIn(AccountSummary account) = SignedIn;
  const factory SessionState.deactivated({SupportContact? supportContact}) = Deactivated;
  const factory SessionState.paused(String message) = Paused;
  const factory SessionState.updateRequired({required String minVersion, required String storeUrl}) = UpdateRequired;
}
```

```dart
// mobile/lib/core/repos/auth_repository.dart
import 'package:juvi/core/env.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_repository.g.dart';

class DeviceInfo {
  const DeviceInfo({required this.id, required this.name, required this.platform, required this.appVersion, required this.osVersion});
  final String id, name, platform, appVersion, osVersion;
}

abstract class AuthRepository {
  Future<InstitutionIdentity> lookupInstitution(String code);
  Future<({Tokens tokens, AccountSummary account})> signIn({required String collegeId, required String identifier, required String password, required DeviceInfo device});
  Future<Tokens?> refresh(String refreshToken, String deviceId);
  Future<void> signOut();
  Future<void> changePassword(String currentPassword, String newPassword);
}

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._api, this._bare);
  final MobileApi _api;
  final MobileApi _bare;

  @override
  Future<InstitutionIdentity> lookupInstitution(String code) async {
    try {
      final r = await _bare.lookupInstitution(code: code.trim().toUpperCase());
      return InstitutionIdentity.fromJson(r.data!.toJson());
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<({Tokens tokens, AccountSummary account})> signIn({required String collegeId, required String identifier, required String password, required DeviceInfo device}) async {
    try {
      final r = await _bare.signIn(signInRequest: SignInRequest.fromJson({
        'collegeId': collegeId, 'identifier': identifier, 'password': password,
        'device': {'id': device.id, 'name': device.name, 'platform': device.platform, 'appVersion': device.appVersion, 'osVersion': device.osVersion},
      }));
      final json = r.data!.toJson();
      return (
        tokens: Tokens(accessToken: json['accessToken'] as String, refreshToken: json['refreshToken'] as String),
        account: AccountSummary.fromJson(Map<String, dynamic>.from(json['account'] as Map)),
      );
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<Tokens?> refresh(String refreshToken, String deviceId) async {
    try {
      final r = await _bare.refresh(refreshRequest: RefreshRequest.fromJson({'refreshToken': refreshToken, 'deviceId': deviceId}));
      final json = r.data!.toJson();
      return Tokens(accessToken: json['accessToken'] as String, refreshToken: json['refreshToken'] as String);
    } catch (e) {
      final f = ApiFailure.of(e);
      if (f.isOffline) throw f;          // keep the session; the caller retries later
      return null;                        // 401: the session is gone
    }
  }

  @override
  Future<void> signOut() async {
    try { await _api.signOut(); } catch (_) { /* best effort; local wipe follows */ }
  }

  @override
  Future<void> changePassword(String currentPassword, String newPassword) async {
    try {
      await _api.changePassword(changePasswordRequest: ChangePasswordRequest.fromJson({'currentPassword': currentPassword, 'newPassword': newPassword}));
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }
}

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) => ApiAuthRepository(ref.read(mobileApiProvider), ref.read(bareMobileApiProvider));

@Riverpod(keepAlive: true)
Future<DeviceInfo> deviceInfo(Ref ref) async => DeviceInfo(
      id: await ref.read(secureStoreProvider).deviceId(),
      name: AppEnv.platform == 'ios' ? 'iPhone' : 'Android phone',
      platform: AppEnv.platform,
      appVersion: await ref.read(appVersionProvider.future),
      osVersion: 'unknown',
    );
```

```dart
// mobile/lib/core/repos/config_repository.dart
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'config_repository.g.dart';

abstract class ConfigRepository {
  Future<Cached<AppConfigData>?> cached();
  Future<Cached<AppConfigData>> refresh();
}

class ApiConfigRepository implements ConfigRepository {
  ApiConfigRepository(this._api, this._db);
  final MobileApi _api;
  final AppDatabase _db;

  @override
  Future<Cached<AppConfigData>?> cached() async {
    final doc = await _db.readDoc('config');
    return doc == null ? null : Cached(AppConfigData.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<AppConfigData>> refresh() async {
    try {
      final json = (await _api.getConfig()).data!.toJson();
      final now = DateTime.now().toUtc();
      await _db.writeDoc('config', json, now);
      return Cached(AppConfigData.fromJson(json), now);
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }
}

@Riverpod(keepAlive: true)
Future<ConfigRepository> configRepository(Ref ref) async => ApiConfigRepository(ref.read(mobileApiProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network config; the theme reads the accent from here.
@Riverpod(keepAlive: true)
Stream<Cached<AppConfigData>> appConfig(Ref ref) async* {
  final repo = await ref.read(configRepositoryProvider.future);
  final c = await repo.cached();
  if (c != null) yield c;
  try {
    yield await repo.refresh();
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}
```

```dart
// mobile/lib/core/session/session_controller.dart
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'session_controller.g.dart';

@Riverpod(keepAlive: true)
class SessionController extends _$SessionController {
  @override
  SessionState build() => const SessionState.loading();

  /// Called once at bootstrap. Never signs the user out for being offline.
  Future<void> restore() async {
    final store = ref.read(secureStoreProvider);
    final tokens = await store.readTokens();
    if (tokens == null) {
      state = const SessionState.signedOut();
      return;
    }
    final db = await ref.read(appDatabaseProvider.future);
    final cached = await db.readDoc('account');
    if (cached != null) state = SessionState.signedIn(AccountSummary.fromJson(cached.json));
    // A fresh /me is fetched by MeController (Task 8) which calls updateAccount(); nothing else to do here.
    if (cached == null) state = const SessionState.signedOut(reason: 'restore');
  }

  Future<void> signIn({required String collegeId, required String identifier, required String password}) async {
    final auth = ref.read(authRepositoryProvider);
    final device = await ref.read(deviceInfoProvider.future);
    final result = await auth.signIn(collegeId: collegeId, identifier: identifier, password: password, device: device);
    final store = ref.read(secureStoreProvider);
    await store.writeTokens(result.tokens);
    await store.writeCollegeId(collegeId);
    final db = await ref.read(appDatabaseProvider.future);
    await db.writeDoc('account', result.account.toJson(), DateTime.now().toUtc());
    state = SessionState.signedIn(result.account);
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    await _wipe();
    state = const SessionState.signedOut();
  }

  /// Used by the Dio interceptor. Returns null when the session is gone (and wipes).
  Future<Tokens?> refreshTokens() async {
    final store = ref.read(secureStoreProvider);
    final current = await store.readTokens();
    if (current == null) return null;
    final next = await ref.read(authRepositoryProvider).refresh(current.refreshToken, await store.deviceId());
    if (next == null) {
      await _wipe();
      state = const SessionState.signedOut(reason: 'expired');
      return null;
    }
    await store.writeTokens(next);
    return next;
  }

  void handleFailure(ApiFailure f) {
    switch (f.code) {
      case ApiErrorCode.sessionInvalidated:
        _wipe().then((_) => state = SessionState.signedOut(reason: f.reason));
      case ApiErrorCode.accountDeactivated:
        final sc = f.detail['supportContact'];
        _wipe().then((_) => state = SessionState.deactivated(
              supportContact: sc is Map ? SupportContact.fromJson(Map<String, dynamic>.from(sc)) : null,
            ));
      case ApiErrorCode.institutionPaused:
        state = SessionState.paused((f.detail['message'] as String?) ?? f.message);
      case ApiErrorCode.updateRequired:
        state = SessionState.updateRequired(minVersion: (f.detail['minVersion'] as String?) ?? '', storeUrl: (f.detail['storeUrl'] as String?) ?? '');
      default:
        break;
    }
  }

  /// After /me, change-password or onboarding advance.
  Future<void> updateAccount(AccountSummary account) async {
    final db = await ref.read(appDatabaseProvider.future);
    await db.writeDoc('account', account.toJson(), DateTime.now().toUtc());
    state = SessionState.signedIn(account);
  }

  Future<void> _wipe() async {
    await ref.read(secureStoreProvider).wipeAll();
    final db = await ref.read(appDatabaseProvider.future);
    await db.wipe();
  }
}
```

- [ ] **Step 4: Run codegen, tests, analyzer**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter test test/core && flutter analyze`
Expected: PASS (all core tests), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core mobile/test/core
git commit -m "feat(mobile): session controller with restore, sign-in, refresh, fatal-failure mapping; auth and config repositories

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Router, redirect, theme, localisation, shell and shared widgets

**Files:**
- Create: `mobile/lib/app/redirect.dart`, `mobile/lib/app/router.dart`, `mobile/lib/app/theme.dart`, `mobile/lib/app/app.dart`, `mobile/lib/app/l10n/app_en.arb`, `mobile/lib/app/l10n/l10n.dart`, `mobile/lib/main.dart`, `mobile/lib/shared/widgets/{app_shell,empty_state,skeleton,section_header,as_of_line,failure_view}.dart`, `mobile/lib/shared/format.dart`, `mobile/lib/features/system/splash_screen.dart`
- Test: `mobile/test/app/redirect_test.dart`, `mobile/test/shared/empty_state_golden_test.dart`

**Interfaces:**
- Produces:
  ```dart
  String? redirect(SessionState state, String location);   // pure
  GoRouter buildRouter(Ref ref);  // routes listed below
  ThemeData buildTheme({Color? accent, required Brightness brightness});
  extension L10nX on BuildContext { AppLocalizations get l10n; }
  class EmptyState extends StatelessWidget { const EmptyState({required IconData icon, required String title, String? hint}); }
  class Skeleton extends StatelessWidget { const Skeleton({double height = 16, double width = double.infinity}); } class SkeletonList { count }
  class AsOfLine extends StatelessWidget { const AsOfLine(DateTime asOf); }             // "As of 08:14"
  class FailureView extends StatelessWidget { const FailureView(ApiFailure failure, {VoidCallback? onRetry}); }
  class AppShell extends StatelessWidget { const AppShell({required StatefulNavigationShell navigationShell, required String kind}); }
  ```
  Routes: `/splash`, `/sign-in`, `/set-password`, `/onboarding/:step`, `/deactivated`, `/paused`, `/update-required`, shell tabs `/today` | `/teaching`, `/spaces` (child `/spaces/:channelId`), `/me` (children `/me/settings`, `/me/devices`, `/me/change-password`). Screens from Tasks 6–10 are placeholders here (a `Scaffold` with the route name) and get replaced as each task lands.

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/app/redirect_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/redirect.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_state.dart';

AccountSummary acct({bool mustChange = false, int step = 3, bool complete = true, String kind = 'student'}) => AccountSummary(
      id: 'a', kind: kind, status: 'active', onboardingStep: step, onboardingSteps: const ['identity', 'spaces', 'notifications'],
      onboardingComplete: complete, mustChangePassword: mustChange);

void main() {
  group('redirect', () {
    test('loading pins to /splash', () {
      expect(redirect(const SessionState.loading(), '/today'), '/splash');
      expect(redirect(const SessionState.loading(), '/splash'), isNull);
    });
    test('signed out goes to /sign-in and stays there', () {
      expect(redirect(const SessionState.signedOut(), '/today'), '/sign-in');
      expect(redirect(const SessionState.signedOut(), '/sign-in'), isNull);
    });
    test('must-change-password wins over everything', () {
      expect(redirect(SessionState.signedIn(acct(mustChange: true)), '/today'), '/set-password');
      expect(redirect(SessionState.signedIn(acct(mustChange: true)), '/set-password'), isNull);
    });
    test('incomplete onboarding goes to the current step', () {
      expect(redirect(SessionState.signedIn(acct(step: 1, complete: false)), '/today'), '/onboarding/1');
      expect(redirect(SessionState.signedIn(acct(step: 1, complete: false)), '/onboarding/1'), isNull);
    });
    test('complete accounts leave gates for their home tab and keep app routes', () {
      expect(redirect(SessionState.signedIn(acct()), '/sign-in'), '/today');
      expect(redirect(SessionState.signedIn(acct(kind: 'faculty')), '/splash'), '/teaching');
      expect(redirect(SessionState.signedIn(acct()), '/spaces/abc'), isNull);
      expect(redirect(SessionState.signedIn(acct()), '/me/settings'), isNull);
    });
    test('system states are full-screen', () {
      expect(redirect(const SessionState.deactivated(), '/today'), '/deactivated');
      expect(redirect(const SessionState.paused('x'), '/spaces'), '/paused');
      expect(redirect(const SessionState.updateRequired(minVersion: '1', storeUrl: 'u'), '/me'), '/update-required');
      expect(redirect(const SessionState.paused('x'), '/paused'), isNull);
    });
  });
}
```

```dart
// mobile/test/shared/empty_state_golden_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/shared/widgets/empty_state.dart';

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('EmptyState golden ${brightness.name}', (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 300));
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(accent: const Color(0xFF0B5FA5), brightness: brightness),
        home: const Scaffold(body: Center(child: EmptyState(icon: Icons.check_circle_outline, title: "You're clear", hint: 'Nothing needs your attention right now.'))),
      ));
      await expectLater(find.byType(EmptyState), matchesGoldenFile('goldens/empty_state_${brightness.name}.png'));
    });
  }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/app test/shared`
Expected: FAIL: missing files.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/app/redirect.dart
import 'package:juvi/core/session/session_state.dart';

const _gates = {'/splash', '/sign-in', '/set-password', '/deactivated', '/paused', '/update-required'};
bool _isGate(String l) => _gates.contains(l) || l.startsWith('/onboarding');

/// The only routing brain: which screen is allowed for this session state?
String? redirect(SessionState state, String location) {
  return switch (state) {
    SessionLoading() => location == '/splash' ? null : '/splash',
    SignedOut() => location == '/sign-in' ? null : '/sign-in',
    Deactivated() => location == '/deactivated' ? null : '/deactivated',
    Paused() => location == '/paused' ? null : '/paused',
    UpdateRequired() => location == '/update-required' ? null : '/update-required',
    SignedIn(:final account) => () {
        if (account.mustChangePassword) return location == '/set-password' ? null : '/set-password';
        if (!account.onboardingComplete) {
          final target = '/onboarding/${account.onboardingStep}';
          return location.startsWith('/onboarding') ? null : target;
        }
        if (_isGate(location)) return account.kind == 'student' ? '/today' : '/teaching';
        return null;
      }(),
  };
}
```

```dart
// mobile/lib/app/theme.dart
import 'package:flutter/material.dart';

const kDefaultAccent = Color(0xFF0B5FA5);

/// Institution accent on primary actions only; everything else stays neutral (spec §11).
ThemeData buildTheme({Color? accent, required Brightness brightness}) {
  final scheme = ColorScheme.fromSeed(seedColor: accent ?? kDefaultAccent, brightness: brightness);
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);
  final text = base.textTheme;
  return base.copyWith(
    scaffoldBackgroundColor: brightness == Brightness.dark ? const Color(0xFF111315) : const Color(0xFFFAFAF8),
    textTheme: text.copyWith(
      // Typography-led: notices and posts read like short documents.
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, height: 1.2),   // notice title
      labelMedium: text.labelMedium?.copyWith(color: scheme.onSurfaceVariant),          // publisher line / meta
      bodyLarge: text.bodyLarge?.copyWith(height: 1.45),                                // body
    ),
    cardTheme: CardTheme(elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: scheme.outlineVariant))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(44, 48))),
    listTileTheme: const ListTileThemeData(minVerticalPadding: 12),
  );
}

Color? parseHexColor(String? hex) {
  if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
  return Color(int.parse(hex.substring(1), radix: 16) | 0xFF000000);
}
```

```json
// mobile/lib/app/l10n/app_en.arb  (starter set; later tasks add keys as they need them)
{
  "@@locale": "en",
  "appName": "Juvi",
  "signInTitle": "Sign in to your college",
  "institutionCodeLabel": "Institution code",
  "institutionCodeNotFound": "We couldn't find that college code.",
  "identifierLabel": "Roll number, employee code or email",
  "passwordLabel": "Password",
  "signInButton": "Sign in",
  "firstTimeHint": "First time? Use the temporary password you received.",
  "forgotPassword": "Forgot password?",
  "forgotPasswordBody": "Your college resets Juvi passwords. Contact the office listed below and they will give you a new temporary password.",
  "invalidCredentials": "That identifier or password is not right.",
  "cooldownMessage": "Too many attempts. Try again in {minutes} minutes.",
  "@cooldownMessage": { "placeholders": { "minutes": { "type": "int" } } },
  "signInNeedsConnection": "Signing in needs a connection. Your last content is still available once you're back online.",
  "setPasswordTitle": "Set your password",
  "setPasswordBody": "Choose a password you'll remember. At least 8 characters.",
  "newPasswordLabel": "New password",
  "currentPasswordLabel": "Current password",
  "savePassword": "Save password",
  "passwordTooShort": "Use at least 8 characters",
  "youreClear": "You're clear",
  "youreClearHint": "Nothing needs your attention right now.",
  "noClassesToday": "No classes today",
  "nothingNew": "Nothing new",
  "asOf": "As of {time}",
  "@asOf": { "placeholders": { "time": { "type": "String" } } },
  "offlineBanner": "You're offline. Showing what you last saw.",
  "retry": "Try again",
  "tabToday": "Today",
  "tabTeaching": "Teaching",
  "tabSpaces": "Spaces",
  "tabMe": "Me",
  "deactivatedTitle": "This account is no longer active",
  "deactivatedBody": "Your institution has closed your Juvi account. If that's a mistake, contact the office below.",
  "pausedTitle": "Juvi is paused",
  "updateRequiredTitle": "Update Juvi to continue",
  "updateRequiredBody": "Your college needs version {version} or later.",
  "@updateRequiredBody": { "placeholders": { "version": { "type": "String" } } },
  "openStore": "Open the store",
  "signedOutElsewhere": "You were signed out from another device.",
  "signedOutPasswordChanged": "Your password was changed. Sign in again.",
  "signedOutGeneric": "Please sign in again."
}
```

```dart
// mobile/lib/app/l10n/l10n.dart
import 'package:flutter/widgets.dart';
import 'package:juvi/app/l10n/app_localizations.dart';

export 'package:juvi/app/l10n/app_localizations.dart';

extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
```

Run `flutter gen-l10n` to produce `lib/app/l10n/app_localizations.dart`.

```dart
// mobile/lib/shared/format.dart
import 'package:intl/intl.dart';

/// Wall-clock in the device's zone; institution timezone display arrives with Today (sub-project 4).
String hhmm(DateTime t) => DateFormat.Hm('en_IN').format(t.toLocal());
String dayAndDate(DateTime t) => DateFormat('EEEE, d MMMM', 'en_IN').format(t.toLocal());
```

```dart
// mobile/lib/shared/widgets/empty_state.dart
import 'package:flutter/material.dart';

/// Designed empty state: calm, intentional, with an illustration slot (spec §11).
class EmptyState extends StatelessWidget {
  const EmptyState({required this.icon, required this.title, this.hint, super.key});
  final IconData icon;
  final String title;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: 0.5), shape: BoxShape.circle),
          child: Icon(icon, size: 30, color: scheme.primary),
        ),
        const SizedBox(height: 12),
        Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
        if (hint != null) ...[
          const SizedBox(height: 4),
          Text(hint!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant), textAlign: TextAlign.center),
        ],
      ]),
    );
  }
}
```

```dart
// mobile/lib/shared/widgets/skeleton.dart
import 'package:flutter/material.dart';

class Skeleton extends StatelessWidget {
  const Skeleton({this.height = 16, this.width = double.infinity, this.radius = 6, super.key});
  final double height, width, radius;
  @override
  Widget build(BuildContext context) => Container(
        height: height, width: width,
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(radius)),
      );
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({this.count = 4, super.key});
  final int count;
  @override
  Widget build(BuildContext context) => Column(
        children: List.generate(count, (_) => const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [Skeleton(height: 40, width: 40, radius: 20), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton(width: 180), SizedBox(height: 6), Skeleton(height: 12, width: 120)]))]),
        )),
      );
}
```

```dart
// mobile/lib/shared/widgets/section_header.dart
import 'package:flutter/material.dart';

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {this.trailing, super.key});
  final String title;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
        child: Row(children: [
          Expanded(child: Text(title.toUpperCase(), style: Theme.of(context).textTheme.labelMedium?.copyWith(letterSpacing: 1.1, fontWeight: FontWeight.w600))),
          if (trailing != null) trailing!,
        ]),
      );
}
```

```dart
// mobile/lib/shared/widgets/as_of_line.dart
import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/shared/format.dart';

class AsOfLine extends StatelessWidget {
  const AsOfLine(this.asOf, {super.key});
  final DateTime asOf;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Text(context.l10n.asOf(hhmm(asOf)), style: Theme.of(context).textTheme.labelMedium),
      );
}
```

```dart
// mobile/lib/shared/widgets/failure_view.dart
import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';

class FailureView extends StatelessWidget {
  const FailureView(this.failure, {this.onRetry, super.key});
  final ApiFailure failure;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(failure.isOffline ? Icons.cloud_off_outlined : Icons.error_outline, size: 36, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(height: 10),
          Text(failure.isOffline ? context.l10n.offlineBanner : failure.message, textAlign: TextAlign.center),
          if (onRetry != null) ...[const SizedBox(height: 12), OutlinedButton(onPressed: onRetry, child: Text(context.l10n.retry))],
        ]),
      );
}
```

```dart
// mobile/lib/shared/widgets/app_shell.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/features/system/offline_banner.dart';

/// Three tabs; the fourth slot is reserved for the Companion (Release 3).
class AppShell extends StatelessWidget {
  const AppShell({required this.navigationShell, required this.kind, super.key});
  final StatefulNavigationShell navigationShell;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final isStudent = kind == 'student';
    return Scaffold(
      body: Column(children: [const OfflineBanner(), Expanded(child: navigationShell)]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (i) => navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex),
        destinations: [
          NavigationDestination(icon: Icon(isStudent ? Icons.today_outlined : Icons.school_outlined), selectedIcon: Icon(isStudent ? Icons.today : Icons.school), label: isStudent ? l.tabToday : l.tabTeaching),
          NavigationDestination(icon: const Icon(Icons.forum_outlined), selectedIcon: const Icon(Icons.forum), label: l.tabSpaces),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: l.tabMe),
        ],
      ),
    );
  }
}
```

`OfflineBanner` is implemented in Task 10; create it now as a `SizedBox.shrink()` placeholder in `lib/features/system/offline_banner.dart`.

```dart
// mobile/lib/features/system/splash_screen.dart
import 'package:flutter/material.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5))));
}
```

```dart
// mobile/lib/app/router.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/redirect.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/set_password_screen.dart';
import 'package:juvi/features/auth/sign_in_screen.dart';
import 'package:juvi/features/home/teaching_shell_screen.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/features/me/change_password_screen.dart';
import 'package:juvi/features/me/devices_screen.dart';
import 'package:juvi/features/me/me_screen.dart';
import 'package:juvi/features/me/settings_screen.dart';
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:juvi/features/spaces/channel_screen.dart';
import 'package:juvi/features/spaces/spaces_screen.dart';
import 'package:juvi/features/system/deactivated_screen.dart';
import 'package:juvi/features/system/paused_screen.dart';
import 'package:juvi/features/system/splash_screen.dart';
import 'package:juvi/features/system/update_required_screen.dart';
import 'package:juvi/shared/widgets/app_shell.dart';

/// Bridges Riverpod state changes into GoRouter's refreshListenable.
class _SessionListenable extends ChangeNotifier {
  _SessionListenable(Ref ref) {
    ref.listen<SessionState>(sessionControllerProvider, (_, __) => notifyListeners());
  }
}

GoRouter buildRouter(Ref ref) {
  final listenable = _SessionListenable(ref);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: listenable,
    redirect: (context, state) => redirect(ref.read(sessionControllerProvider), state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/sign-in', builder: (_, __) => const SignInScreen()),
      GoRoute(path: '/set-password', builder: (_, __) => const SetPasswordScreen()),
      GoRoute(path: '/onboarding/:step', builder: (_, s) => OnboardingScreen(step: int.tryParse(s.pathParameters['step'] ?? '0') ?? 0)),
      GoRoute(path: '/deactivated', builder: (_, __) => const DeactivatedScreen()),
      GoRoute(path: '/paused', builder: (_, __) => const PausedScreen()),
      GoRoute(path: '/update-required', builder: (_, __) => const UpdateRequiredScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) {
          final session = ref.read(sessionControllerProvider);
          final kind = session is SignedIn ? session.account.kind : 'student';
          return AppShell(navigationShell: shell, kind: kind);
        },
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/today', builder: (_, __) => const TodayShellScreen()),
            GoRoute(path: '/teaching', builder: (_, __) => const TeachingShellScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/spaces', builder: (_, __) => const SpacesScreen(), routes: [
              GoRoute(path: ':channelId', builder: (_, s) => ChannelScreen(channelId: s.pathParameters['channelId']!)),
            ]),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/me', builder: (_, __) => const MeScreen(), routes: [
              GoRoute(path: 'settings', builder: (_, __) => const SettingsScreen()),
              GoRoute(path: 'devices', builder: (_, __) => const DevicesScreen()),
              GoRoute(path: 'change-password', builder: (_, __) => const ChangePasswordScreen()),
            ]),
          ]),
        ],
      ),
    ],
  );
}

final routerProvider = Provider<GoRouter>(buildRouter);
```

Create each screen referenced above as a placeholder `Scaffold(appBar: AppBar(title: Text('<route>')))` in its final file path; Tasks 6–10 replace them. The `/today` and `/teaching` routes both live in branch 0 so the shell tab index stays stable regardless of kind.

```dart
// mobile/lib/app/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/router.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/core/repos/config_repository.dart';
import 'package:juvi/features/me/theme_preference.dart';

class JuviApp extends ConsumerWidget {
  const JuviApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accent = parseHexColor(ref.watch(appConfigProvider).valueOrNull?.data.accentColor);
    final mode = ref.watch(themePreferenceProvider);
    return MaterialApp.router(
      onGenerateTitle: (c) => c.l10n.appName,
      theme: buildTheme(accent: accent, brightness: Brightness.light),
      darkTheme: buildTheme(accent: accent, brightness: Brightness.dark),
      themeMode: mode,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
```

`themePreferenceProvider` (Task 8) is a `Notifier<ThemeMode>` persisted in shared_preferences; create `lib/features/me/theme_preference.dart` now with the minimal version:

```dart
// mobile/lib/features/me/theme_preference.dart
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'theme_preference.g.dart';

@Riverpod(keepAlive: true)
class ThemePreference extends _$ThemePreference {
  static const _key = 'juvi.theme_mode';
  @override
  ThemeMode build() {
    SharedPreferences.getInstance().then((p) {
      final v = p.getString(_key);
      if (v != null) state = ThemeMode.values.byName(v);
    });
    return ThemeMode.system;
  }
  Future<void> set(ThemeMode mode) async {
    state = mode;
    (await SharedPreferences.getInstance()).setString(_key, mode.name);
  }
}
```

```dart
// mobile/lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:juvi/app/app.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:sqlcipher_flutter_libs/sqlcipher_flutter_libs.dart';
import 'package:sqlite3/open.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // drift must load SQLCipher instead of plain sqlite on Android.
  open.overrideFor(OperatingSystem.android, openCipherOnAndroid);
  await initializeDateFormatting('en_IN');
  final container = ProviderContainer();
  // Cached state renders before any network round-trip (spec §11).
  await container.read(sessionControllerProvider.notifier).restore();
  runApp(UncontrolledProviderScope(container: container, child: const JuviApp()));
}
```

Add `sqlite3` to dependencies (`flutter pub add sqlite3`) for the `open` import.

- [ ] **Step 4: Codegen, l10n, tests, goldens, analyzer**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter gen-l10n && flutter test test/app && flutter test --update-goldens test/shared && flutter test test/shared && flutter analyze`
Expected: redirect tests PASS (6), goldens created then PASS (2), analyzer clean. Then `flutter run` shows the splash and lands on the sign-in placeholder.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test mobile/pubspec.yaml mobile/pubspec.lock
git commit -m "feat(mobile): router with a pure session redirect, institution-tinted theme, l10n, shell and shared widgets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Sign-in and set-password (S01)

**Files:**
- Replace: `mobile/lib/features/auth/sign_in_screen.dart`, `mobile/lib/features/auth/set_password_screen.dart`
- Create: `mobile/lib/features/auth/institution_code_field.dart`, `mobile/lib/features/auth/forgot_password_sheet.dart`
- Test: `mobile/test/features/auth/sign_in_screen_test.dart`, `mobile/test/features/auth/set_password_screen_test.dart`

**Interfaces:**
- Consumes: `authRepositoryProvider`, `sessionControllerProvider` (Task 4), l10n keys (Task 5).
- Produces: `SignInScreen`, `SetPasswordScreen`, `InstitutionCodeField({onResolved(InstitutionIdentity?)})`, `showForgotPasswordSheet(BuildContext, {SupportContact?})`. Remembered institution code under shared_preferences key `juvi.institution_code`.

- [ ] **Step 1: Write the failing widget tests**

```dart
// mobile/test/features/auth/sign_in_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/sign_in_screen.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Auth extends Mock implements AuthRepository {}
class _Session extends SessionController {
  ApiFailure? failWith;
  @override SessionState build() => const SessionState.signedOut();
  @override Future<void> signIn({required String collegeId, required String identifier, required String password}) async {
    if (failWith != null) throw failWith!;
    state = const SessionState.signedIn(AccountSummary(id: 'a', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity'], onboardingComplete: false, mustChangePassword: true));
  }
}

const jit = InstitutionIdentity(collegeId: 'c1', name: 'JIT College', paused: false);

Widget app(List<Override> overrides) => ProviderScope(overrides: overrides, child: const MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SignInScreen()));

void main() {
  late _Auth auth; late _Session session;
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    auth = _Auth(); session = _Session();
    registerFallbackValue(const DeviceInfo(id: 'd', name: 'n', platform: 'android', appVersion: '1', osVersion: '1'));
    when(() => auth.lookupInstitution('JIT')).thenAnswer((_) async => jit);
    when(() => auth.lookupInstitution('NOPE')).thenThrow(const ApiFailure(ApiErrorCode.notFound, "We couldn't find that college code."));
  });
  List<Override> ov() => [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)];

  testWidgets('resolves the institution code and shows the college name; unknown code shows the not-found message', (t) async {
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text('JIT College'), findsOneWidget);
    await t.enterText(find.bySemanticsLabel('Institution code'), 'NOPE');
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text("We couldn't find that college code."), findsOneWidget);
    expect(find.text('JIT College'), findsNothing);
  });

  testWidgets('sign-in button is disabled until code, identifier and password are present; success remembers the code', (t) async {
    await t.pumpWidget(app(ov()));
    final button = find.widgetWithText(FilledButton, 'Sign in');
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '21CS1042');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNotNull);
    await t.tap(button);
    await t.pumpAndSettle();
    expect((await SharedPreferences.getInstance()).getString('juvi.institution_code'), 'JIT');
  });

  testWidgets('wrong credentials show one generic message and keep the typed identifier; cooldown shows minutes', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.invalidCredentials, 'x');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '21CS1042');
    await t.enterText(find.bySemanticsLabel('Password'), 'bad');
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('That identifier or password is not right.'), findsOneWidget);
    expect(find.text('21CS1042'), findsOneWidget);
    session.failWith = const ApiFailure(ApiErrorCode.cooldown, 'x', detail: {'retryAfterSeconds': 540});
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('Too many attempts. Try again in 9 minutes.'), findsOneWidget);
  });

  testWidgets('offline explains that sign-in needs a connection', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.offline, 'x');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), 'x');
    await t.enterText(find.bySemanticsLabel('Password'), 'y');
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.textContaining('needs a connection'), findsOneWidget);
  });

  testWidgets('forgot password opens the explanation sheet', (t) async {
    await t.pumpWidget(app(ov()));
    await t.tap(find.text('Forgot password?'));
    await t.pumpAndSettle();
    expect(find.textContaining('Your college resets Juvi passwords'), findsOneWidget);
  });
}
```

```dart
// mobile/test/features/auth/set_password_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/set_password_screen.dart';
import 'package:mocktail/mocktail.dart';

class _Auth extends Mock implements AuthRepository {}
const acct = AccountSummary(id: 'a', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity'], onboardingComplete: false, mustChangePassword: true);
class _Session extends SessionController {
  AccountSummary? updated;
  @override SessionState build() => const SessionState.signedIn(acct);
  @override Future<void> updateAccount(AccountSummary a) async { updated = a; state = SessionState.signedIn(a); }
}

void main() {
  testWidgets('validates length client-side, submits, and clears the must-change flag', (t) async {
    final auth = _Auth(); final session = _Session();
    when(() => auth.changePassword('river-lamp-482', 'longenough1')).thenAnswer((_) async {});
    await t.pumpWidget(ProviderScope(overrides: [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SetPasswordScreen())));
    await t.enterText(find.bySemanticsLabel('Current password'), 'river-lamp-482');
    await t.enterText(find.bySemanticsLabel('New password'), 'short');
    await t.tap(find.text('Save password'));
    await t.pump();
    expect(find.text('Use at least 8 characters'), findsOneWidget);
    verifyNever(() => auth.changePassword(any(), any()));
    await t.enterText(find.bySemanticsLabel('New password'), 'longenough1');
    await t.tap(find.text('Save password'));
    await t.pumpAndSettle();
    expect(session.updated?.mustChangePassword, isFalse);
  });

  testWidgets('a wrong current password shows the server message and keeps input', (t) async {
    final auth = _Auth(); final session = _Session();
    when(() => auth.changePassword(any(), any())).thenThrow(const ApiFailure(ApiErrorCode.invalidCredentials, 'Your current password is not right.'));
    await t.pumpWidget(ProviderScope(overrides: [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SetPasswordScreen())));
    await t.enterText(find.bySemanticsLabel('Current password'), 'nope');
    await t.enterText(find.bySemanticsLabel('New password'), 'longenough1');
    await t.tap(find.text('Save password'));
    await t.pumpAndSettle();
    expect(find.text('Your current password is not right.'), findsOneWidget);
    expect(find.text('longenough1'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/features/auth`
Expected: FAIL: placeholders render no fields.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/features/auth/institution_code_field.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';

/// Institution code with a debounced lookup. Unknown and disabled codes look identical (spec §8).
class InstitutionCodeField extends ConsumerStatefulWidget {
  const InstitutionCodeField({required this.onResolved, this.initialCode, super.key});
  /// Called with the identity (or null while unresolved) and the code that was typed.
  final void Function(InstitutionIdentity? identity, String code) onResolved;
  final String? initialCode;
  @override
  ConsumerState<InstitutionCodeField> createState() => _State();
}

class _State extends ConsumerState<InstitutionCodeField> {
  late final _ctrl = TextEditingController(text: widget.initialCode ?? '');
  Timer? _debounce;
  InstitutionIdentity? _identity;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if ((widget.initialCode ?? '').isNotEmpty) _lookup(widget.initialCode!);
  }

  void _changed(String v) {
    _debounce?.cancel();
    setState(() { _identity = null; _error = null; });
    widget.onResolved(null, v.trim().toUpperCase());
    if (v.trim().length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 500), () => _lookup(v));
  }

  Future<void> _lookup(String code) async {
    setState(() => _busy = true);
    try {
      final id = await ref.read(authRepositoryProvider).lookupInstitution(code);
      if (!mounted) return;
      setState(() { _identity = id; _error = null; });
      widget.onResolved(id, code.trim().toUpperCase());
    } on ApiFailure catch (f) {
      if (!mounted) return;
      setState(() => _error = f.isOffline ? context.l10n.signInNeedsConnection : context.l10n.institutionCodeNotFound);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() { _debounce?.cancel(); _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _ctrl,
        textCapitalization: TextCapitalization.characters,
        autocorrect: false,
        decoration: InputDecoration(labelText: context.l10n.institutionCodeLabel, errorText: _error,
          suffixIcon: _busy ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))) : null),
        onChanged: _changed,
      ),
      if (_identity != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(children: [
            if (_identity!.logoUrl != null) ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(_identity!.logoUrl!, width: 40, height: 40, errorBuilder: (_, __, ___) => const SizedBox.shrink()))
            else Icon(Icons.account_balance_outlined, color: scheme.primary),
            const SizedBox(width: 12),
            Expanded(child: Text(_identity!.name, style: Theme.of(context).textTheme.titleMedium)),
          ]),
        ),
    ]);
  }
}
```

```dart
// mobile/lib/features/auth/forgot_password_sheet.dart
import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';

Future<void> showForgotPasswordSheet(BuildContext context, {SupportContact? contact}) => showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(c.l10n.forgotPassword, style: Theme.of(c).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(c.l10n.forgotPasswordBody),
          if (contact != null) ...[
            const SizedBox(height: 16),
            ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.support_agent_outlined), title: Text(contact.name), subtitle: Text([contact.phone, contact.email].whereType<String>().join(' · '))),
          ],
        ]),
      ),
    );
```

```dart
// mobile/lib/features/auth/sign_in_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/forgot_password_sheet.dart';
import 'package:juvi/features/auth/institution_code_field.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});
  @override
  ConsumerState<SignInScreen> createState() => _SignInState();
}

class _SignInState extends ConsumerState<SignInScreen> {
  static const _rememberKey = 'juvi.institution_code';
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  InstitutionIdentity? _institution;
  String? _rememberedCode;
  String? _error;
  bool _busy = false;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) { if (mounted) setState(() => _rememberedCode = p.getString(_rememberKey) ?? ''); });
  }

  bool get _canSubmit => _institution != null && !_institution!.paused && _identifier.text.trim().isNotEmpty && _password.text.isNotEmpty && !_busy;

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      await ref.read(sessionControllerProvider.notifier).signIn(collegeId: _institution!.collegeId, identifier: _identifier.text.trim(), password: _password.text);
      (await SharedPreferences.getInstance()).setString(_rememberKey, _resolvedCode ?? '');
    } on ApiFailure catch (f) {
      final l = context.l10n;
      setState(() => _error = switch (f.code) {
            ApiErrorCode.invalidCredentials => l.invalidCredentials,
            ApiErrorCode.cooldown => l.cooldownMessage(((f.retryAfterSeconds ?? 60) / 60).ceil()),
            ApiErrorCode.offline => l.signInNeedsConnection,
            ApiErrorCode.institutionPaused => (f.detail['message'] as String?) ?? f.message,
            _ => f.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// The institution code that resolved; remembered for the next launch (S01 AC 2).
  String? _resolvedCode;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionControllerProvider);
    final reason = session is SignedOut ? session.reason : null;
    final reasonText = switch (reason) {
      'signed_out_elsewhere' => l.signedOutElsewhere,
      'password_changed' => l.signedOutPasswordChanged,
      null || 'restore' => null,
      _ => l.signedOutGeneric,
    };
    if (_rememberedCode == null) return const Scaffold(body: SizedBox.shrink());   // waiting for prefs, one frame

    return Scaffold(
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          const SizedBox(height: 32),
          Text(l.appName, style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(l.signInTitle, style: Theme.of(context).textTheme.titleMedium),
          if (reasonText != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(reasonText, style: TextStyle(color: Theme.of(context).colorScheme.tertiary))),
          const SizedBox(height: 28),
          InstitutionCodeField(
            initialCode: _rememberedCode!.isEmpty ? null : _rememberedCode,
            onResolved: (id, code) => setState(() { _institution = id; _resolvedCode = id != null ? code : null; }),
          ),
          if (_institution?.paused == true) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_institution!.pausedMessage ?? l.pausedTitle)),
          const SizedBox(height: 16),
          TextField(controller: _identifier, autocorrect: false, decoration: InputDecoration(labelText: l.identifierLabel), onChanged: (_) => setState(() {})),
          const SizedBox(height: 12),
          TextField(
            controller: _password, obscureText: _obscure, autocorrect: false,
            decoration: InputDecoration(labelText: l.passwordLabel, suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscure = !_obscure))),
            onChanged: (_) => setState(() {}), onSubmitted: (_) { if (_canSubmit) _submit(); },
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          const SizedBox(height: 20),
          FilledButton(onPressed: _canSubmit ? _submit : null, child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.signInButton)),
          const SizedBox(height: 16),
          Text(l.firstTimeHint, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
          TextButton(onPressed: () => showForgotPasswordSheet(context), child: Text(l.forgotPassword)),
        ]),
      ),
    );
  }
}
```

```dart
// mobile/lib/features/auth/set_password_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';

class SetPasswordScreen extends ConsumerStatefulWidget {
  const SetPasswordScreen({super.key});
  @override
  ConsumerState<SetPasswordScreen> createState() => _State();
}

class _State extends ConsumerState<SetPasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  String? _error;
  String? _lengthError;
  bool _busy = false;
  bool _obscure = true;

  String _strength(String v) => v.length >= 16 ? 'Strong' : v.length >= 12 ? 'Good' : v.length >= 8 ? 'OK' : 'Too short';

  Future<void> _submit() async {
    final l = context.l10n;
    setState(() { _error = null; _lengthError = _next.text.length < 8 ? l.passwordTooShort : null; });
    if (_lengthError != null) return;
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).changePassword(_current.text, _next.text);
      final s = ref.read(sessionControllerProvider);
      if (s is SignedIn) await ref.read(sessionControllerProvider.notifier).updateAccount(s.account.copyWith(mustChangePassword: false));
    } on ApiFailure catch (f) {
      setState(() => _error = f.isOffline ? l.signInNeedsConnection : f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.setPasswordTitle), automaticallyImplyLeading: false),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        Text(l.setPasswordBody),
        const SizedBox(height: 20),
        TextField(controller: _current, obscureText: true, autocorrect: false, decoration: InputDecoration(labelText: l.currentPasswordLabel)),
        const SizedBox(height: 12),
        TextField(
          controller: _next, obscureText: _obscure, autocorrect: false,
          decoration: InputDecoration(labelText: l.newPasswordLabel, errorText: _lengthError, helperText: _next.text.isEmpty ? null : _strength(_next.text),
            suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscure = !_obscure))),
          onChanged: (_) => setState(() => _lengthError = null),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        const SizedBox(height: 20),
        FilledButton(onPressed: _busy ? null : _submit, child: Text(l.savePassword)),
      ]),
    );
  }
}
```

- [ ] **Step 4: Run the tests and analyzer**

Run: `cd mobile && flutter test test/features/auth && flutter analyze`
Expected: PASS (7 tests), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/auth mobile/test/features/auth
git commit -m "feat(mobile): sign-in with institution lookup, cooldown and offline states; forced set-password

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Me repository, Today and Teaching shells, Me screens (S03/S10 shells, S12)

**Files:**
- Create: `mobile/lib/core/repos/me_repository.dart`, `mobile/lib/features/me/photo_picker.dart`, `mobile/lib/shared/widgets/identity_card.dart`
- Replace: `mobile/lib/features/home/today_shell_screen.dart`, `teaching_shell_screen.dart`, `mobile/lib/features/me/me_screen.dart`, `settings_screen.dart`, `devices_screen.dart`, `change_password_screen.dart`
- Test: `mobile/test/core/repos/me_repository_test.dart`, `mobile/test/features/me/me_screen_test.dart`, `mobile/test/features/home/today_shell_test.dart`

**Interfaces:**
- Produces:
  ```dart
  // models added to models.dart: Me, PersonCard, StudentCard, FacultyCard, Settings, InstitutionInfo, OnboardingStateData, DeviceRow
  abstract class MeRepository {
    Future<Cached<Me>?> cached(); Future<Cached<Me>> refresh();
    Future<Settings> updateSettings(Map<String, dynamic> patch);      // online; throws ApiFailure offline
    Future<OnboardingStateData> advanceOnboarding(int step);
    Future<List<DeviceRow>> devices(); Future<void> revokeDevice(String sessionId); Future<int> revokeOtherDevices();
    Future<String?> uploadPhoto(List<int> bytes, String filename);
  }
  @riverpod Stream<Cached<Me>> me(Ref ref);        // cached → fresh; on fresh also sessionController.updateAccount
  @riverpod class SettingsController extends _$SettingsController { Future<void> patch(Map<String, dynamic> p); }   // optimistic; enqueues 'settings.patch' when offline
  ```
  Widgets: `TodayShellScreen`, `TeachingShellScreen`, `MeScreen`, `SettingsScreen`, `DevicesScreen`, `ChangePasswordScreen`, `IdentityCard(Me)`, `pickAndUploadPhoto(WidgetRef)`.

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/core/repos/me_repository_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/models.dart';

const meJson = {
  'account': {'id': 'a', 'kind': 'student', 'status': 'onboarding', 'onboardingStep': 0, 'onboardingSteps': ['identity', 'spaces', 'notifications'], 'onboardingComplete': false, 'mustChangePassword': false},
  'person': {'name': 'Aditya Nair', 'firstName': 'Aditya', 'photoUrl': null},
  'student': {'rollNumber': '24JIT0001', 'programme': 'B.Tech', 'branch': 'CSE', 'batch': '2024 Batch', 'section': 'A', 'department': 'Computer Science', 'hostel': null, 'isLateralEntry': false},
  'faculty': null,
  'settings': {'quietHours': {'start': '22:00', 'end': '07:00'}, 'tiers': {'important': true, 'routine': true}, 'language': 'en'},
  'institution': {'name': 'JIT', 'code': 'JIT', 'logoUrl': null, 'accentColor': '#0B5FA5', 'supportContact': {'name': 'Office'}, 'timezone': 'Asia/Kolkata'},
  'asOf': '2026-09-23T08:14:00+05:30',
};

void main() {
  test('Me parses the /me payload, including nulls', () {
    final me = Me.fromJson(meJson);
    expect(me.person.firstName, 'Aditya');
    expect(me.student?.section, 'A');
    expect(me.faculty, isNull);
    expect(me.settings.tiers.routine, isTrue);
    expect(me.institution.supportContact?.name, 'Office');
    expect(me.toJson()['student'], isA<Map<String, dynamic>>());
  });
}
```

```dart
// mobile/test/features/home/today_shell_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import '../../core/repos/me_repository_test.dart' show meJson;

Widget host(Stream<Cached<Me>> Function() stream) => ProviderScope(
  overrides: [meProvider.overrideWith((ref) => stream())],
  child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: TodayShellScreen()));

void main() {
  final me = Me.fromJson(meJson);
  testWidgets('loading shows skeletons, populated shows header and the three empty states', (t) async {
    await t.pumpWidget(host(() async* { await Future<void>.delayed(const Duration(milliseconds: 50)); yield Cached(me, DateTime.now()); }));
    expect(find.byType(Skeleton), findsWidgets);
    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('Aditya'), findsOneWidget);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.text('No classes today'), findsOneWidget);
  });
  testWidgets('offline with cache shows the as-of line', (t) async {
    final asOf = DateTime(2026, 9, 23, 8, 14);
    await t.pumpWidget(host(() async* { yield Cached(me, asOf, stale: true, failure: const ApiFailure(ApiErrorCode.offline, 'x')); }));
    await t.pump();
    expect(find.textContaining('As of 08:14'), findsOneWidget);
  });
  testWidgets('error without cache shows retry', (t) async {
    await t.pumpWidget(host(() => Stream.error(const ApiFailure(ApiErrorCode.internal, 'boom'))));
    await t.pump();
    expect(find.text('Try again'), findsOneWidget);
  });
}
```

```dart
// mobile/test/features/me/me_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/me/me_screen.dart';
import '../../core/repos/me_repository_test.dart' show meJson;

void main() {
  testWidgets('shows the identity card, settings, devices, about and sign-out entries', (t) async {
    final me = Me.fromJson(meJson);
    await t.pumpWidget(ProviderScope(overrides: [meProvider.overrideWith((_) async* { yield Cached(me, DateTime.now()); })],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: MeScreen())));
    await t.pump();
    expect(find.text('Aditya Nair'), findsOneWidget);
    expect(find.text('24JIT0001'), findsOneWidget);
    expect(find.textContaining('B.Tech'), findsOneWidget);
    for (final label in ['Notifications and quiet hours', 'Devices', 'Change password', 'Sign out']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.textContaining('stays with your institution'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/core/repos test/features/home test/features/me`
Expected: FAIL: `Me` and `meProvider` missing.

- [ ] **Step 3: Implement**

Add to `mobile/lib/core/models/models.dart`:

```dart
@freezed
class PersonCard with _$PersonCard {
  const factory PersonCard({required String name, required String firstName, String? photoUrl}) = _PersonCard;
  factory PersonCard.fromJson(Map<String, dynamic> json) => _$PersonCardFromJson(json);
}

@freezed
class StudentCard with _$StudentCard {
  const factory StudentCard({String? rollNumber, String? programme, String? branch, String? batch, String? section, String? department, String? hostel, required bool isLateralEntry}) = _StudentCard;
  factory StudentCard.fromJson(Map<String, dynamic> json) => _$StudentCardFromJson(json);
}

@freezed
class FacultyCard with _$FacultyCard {
  const factory FacultyCard({required String employeeCode, required String designation, String? department, required bool isHod}) = _FacultyCard;
  factory FacultyCard.fromJson(Map<String, dynamic> json) => _$FacultyCardFromJson(json);
}

@freezed
class QuietHours with _$QuietHours {
  const factory QuietHours({required String start, required String end}) = _QuietHours;
  factory QuietHours.fromJson(Map<String, dynamic> json) => _$QuietHoursFromJson(json);
}

@freezed
class Tiers with _$Tiers {
  const factory Tiers({required bool important, required bool routine}) = _Tiers;
  factory Tiers.fromJson(Map<String, dynamic> json) => _$TiersFromJson(json);
}

@freezed
class Settings with _$Settings {
  const factory Settings({required QuietHours quietHours, required Tiers tiers, required String language}) = _Settings;
  factory Settings.fromJson(Map<String, dynamic> json) => _$SettingsFromJson(json);
}

@freezed
class InstitutionInfo with _$InstitutionInfo {
  const factory InstitutionInfo({required String name, required String code, String? logoUrl, String? accentColor, SupportContact? supportContact, required String timezone}) = _InstitutionInfo;
  factory InstitutionInfo.fromJson(Map<String, dynamic> json) => _$InstitutionInfoFromJson(json);
}

@freezed
class Me with _$Me {
  const factory Me({required AccountSummary account, required PersonCard person, StudentCard? student, FacultyCard? faculty, required Settings settings, required InstitutionInfo institution, required String asOf}) = _Me;
  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);
}

@freezed
class OnboardingStateData with _$OnboardingStateData {
  const factory OnboardingStateData({required int onboardingStep, required List<String> onboardingSteps, required bool onboardingComplete}) = _OnboardingStateData;
  factory OnboardingStateData.fromJson(Map<String, dynamic> json) => _$OnboardingStateDataFromJson(json);
}

@freezed
class DeviceRow with _$DeviceRow {
  const factory DeviceRow({required String sessionId, required String deviceName, required String platform, required String appVersion, required String lastActiveAt, required bool isCurrent}) = _DeviceRow;
  factory DeviceRow.fromJson(Map<String, dynamic> json) => _$DeviceRowFromJson(json);
}
```

```dart
// mobile/lib/core/repos/me_repository.dart
import 'package:dio/dio.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'me_repository.g.dart';

abstract class MeRepository {
  Future<Cached<Me>?> cached();
  Future<Cached<Me>> refresh();
  Future<Settings> updateSettings(Map<String, dynamic> patch);
  Future<OnboardingStateData> advanceOnboarding(int step);
  Future<List<DeviceRow>> devices();
  Future<void> revokeDevice(String sessionId);
  Future<int> revokeOtherDevices();
  Future<String?> uploadPhoto(List<int> bytes, String filename);
}

class ApiMeRepository implements MeRepository {
  ApiMeRepository(this._api, this._db);
  final MobileApi _api;
  final AppDatabase _db;

  Future<T> _guard<T>(Future<T> Function() f) async {
    try { return await f(); } catch (e) { throw ApiFailure.of(e); }
  }

  @override
  Future<Cached<Me>?> cached() async {
    final doc = await _db.readDoc('me');
    return doc == null ? null : Cached(Me.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<Me>> refresh() => _guard(() async {
        final json = (await _api.getMe()).data!.toJson();
        final asOf = DateTime.tryParse(json['asOf'] as String? ?? '')?.toUtc() ?? DateTime.now().toUtc();
        await _db.writeDoc('me', json, asOf);
        return Cached(Me.fromJson(json), asOf);
      });

  @override
  Future<Settings> updateSettings(Map<String, dynamic> patch) => _guard(() async {
        final r = await _api.updateSettings(settingsPatch: SettingsPatch.fromJson(patch));
        final settings = Settings.fromJson(r.data!.toJson());
        final doc = await _db.readDoc('me');
        if (doc != null) await _db.writeDoc('me', {...doc.json, 'settings': settings.toJson()}, doc.asOf);
        return settings;
      });

  @override
  Future<OnboardingStateData> advanceOnboarding(int step) => _guard(() async {
        final r = await _api.advanceOnboarding(onboardingAdvance: OnboardingAdvance.fromJson({'step': step}));
        return OnboardingStateData.fromJson(r.data!.toJson());
      });

  @override
  Future<List<DeviceRow>> devices() => _guard(() async {
        final json = (await _api.listDevices()).data!.toJson();
        return (json['items'] as List).map((e) => DeviceRow.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      });

  @override
  Future<void> revokeDevice(String sessionId) => _guard(() => _api.revokeDevice(id: sessionId));

  @override
  Future<int> revokeOtherDevices() => _guard(() async => (await _api.revokeOtherDevices()).data!.toJson()['revoked'] as int);

  @override
  Future<String?> uploadPhoto(List<int> bytes, String filename) => _guard(() async {
        final r = await _api.uploadPhoto(file: MultipartFile.fromBytes(bytes, filename: filename));
        final url = r.data!.toJson()['photoUrl'] as String?;
        final doc = await _db.readDoc('me');
        if (doc != null) await _db.writeDoc('me', {...doc.json, 'person': {...(doc.json['person'] as Map), 'photoUrl': url}}, doc.asOf);
        return url;
      });
}

@Riverpod(keepAlive: true)
Future<MeRepository> meRepository(Ref ref) async => ApiMeRepository(ref.read(mobileApiProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network. A fresh /me also refreshes the session's account summary.
@riverpod
Stream<Cached<Me>> me(Ref ref) async* {
  final repo = await ref.read(meRepositoryProvider.future);
  final c = await repo.cached();
  if (c != null) yield c;
  try {
    final fresh = await repo.refresh();
    await ref.read(sessionControllerProvider.notifier).updateAccount(fresh.data.account);
    yield fresh;
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}

/// Optimistic settings with an offline queue (spec §11 pending actions).
@riverpod
class SettingsController extends _$SettingsController {
  @override
  Future<Settings?> build() async => (await ref.watch(meProvider.future)).data.settings;

  Future<void> patch(Map<String, dynamic> p) async {
    final repo = await ref.read(meRepositoryProvider.future);
    final current = state.valueOrNull;
    if (current != null) state = AsyncData(_merge(current, p));
    try {
      state = AsyncData(await repo.updateSettings(p));
    } on ApiFailure catch (f) {
      if (f.isOffline) {
        final db = await ref.read(appDatabaseProvider.future);
        await db.enqueueAction(PendingAction.create('settings.patch', p));
      } else {
        state = AsyncData(current);
        rethrow;
      }
    }
    ref.invalidate(meProvider);
  }

  Settings _merge(Settings s, Map<String, dynamic> p) => Settings(
        quietHours: p['quietHours'] != null ? QuietHours.fromJson(Map<String, dynamic>.from(p['quietHours'] as Map)) : s.quietHours,
        tiers: Tiers(
          important: (p['tiers'] as Map?)?['important'] as bool? ?? s.tiers.important,
          routine: (p['tiers'] as Map?)?['routine'] as bool? ?? s.tiers.routine,
        ),
        language: p['language'] as String? ?? s.language,
      );
}
```

```dart
// mobile/lib/shared/widgets/identity_card.dart
import 'package:flutter/material.dart';
import 'package:juvi/core/models/models.dart';

class IdentityCard extends StatelessWidget {
  const IdentityCard(this.me, {this.onChangePhoto, super.key});
  final Me me;
  final VoidCallback? onChangePhoto;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final s = me.student; final f = me.faculty;
    final lines = <String>[
      if (s != null) ...[s.rollNumber ?? '', [s.programme, s.branch].whereType<String>().join(' · '), [s.batch, if (s.section != null) 'Section ${s.section}'].whereType<String>().join(' · '), s.department ?? '', if (s.hostel != null) s.hostel!],
      if (f != null) ...[f.employeeCode, f.designation, f.department ?? '', if (f.isHod) 'Head of department'],
      me.institution.name,
    ].where((l) => l.isNotEmpty).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GestureDetector(
            onTap: onChangePhoto,
            child: CircleAvatar(radius: 32, backgroundImage: me.person.photoUrl != null ? NetworkImage(me.person.photoUrl!) : null,
              child: me.person.photoUrl == null ? Text(me.person.firstName.characters.first.toUpperCase(), style: t.titleLarge) : null),
          ),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(me.person.name, style: t.titleLarge),
            const SizedBox(height: 4),
            for (final l in lines) Text(l, style: t.bodyMedium),
          ])),
        ]),
      ),
    );
  }
}
```

```dart
// mobile/lib/features/home/today_shell_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// Foundation shell: header + three designed empty states. Content arrives in sub-projects 2 and 4.
class TodayShellScreen extends ConsumerWidget {
  const TodayShellScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final me = ref.watch(meProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(meProvider.future),
          child: me.when(
            loading: () => ListView(children: const [Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 28, width: 160)), SkeletonList(count: 3)]),
            error: (e, _) => ListView(children: [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider))]),
            data: (c) => ListView(children: [
              _Header(firstName: c.data.person.firstName, logoUrl: c.data.institution.logoUrl),
              if (c.stale) AsOfLine(c.asOf),
              SectionHeader('Attention'),
              EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
              SectionHeader('Timeline'),
              EmptyState(icon: Icons.event_available_outlined, title: l.noClassesToday),
              SectionHeader('At a glance'),
              const EmptyState(icon: Icons.insights_outlined, title: 'Attendance and dues appear here soon'),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.firstName, this.logoUrl});
  final String firstName; final String? logoUrl;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(firstName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            Text(dayAndDate(DateTime.now()), style: Theme.of(context).textTheme.labelMedium),
          ])),
          if (logoUrl != null) ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.network(logoUrl!, width: 28, height: 28, errorBuilder: (_, __, ___) => const SizedBox.shrink())),
        ]),
      );
}
```

```dart
// mobile/lib/features/home/teaching_shell_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// Faculty home shell (S10). Post-to-class and the department/college feeds arrive in sub-projects 4 and 5.
class TeachingShellScreen extends ConsumerWidget {
  const TeachingShellScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final me = ref.watch(meProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(meProvider.future),
          child: me.when(
            loading: () => ListView(children: const [Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 28, width: 160)), SkeletonList(count: 3)]),
            error: (e, _) => ListView(children: [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider))]),
            data: (c) => ListView(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(c.data.person.firstName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                  Text([dayAndDate(DateTime.now()), c.data.faculty?.department].whereType<String>().join(' · '), style: Theme.of(context).textTheme.labelMedium),
                ]),
              ),
              if (c.stale) AsOfLine(c.asOf),
              const SectionHeader('My acknowledgements'),
              EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
              const SectionHeader('Teaching today'),
              EmptyState(icon: Icons.event_available_outlined, title: l.noClassesToday),
              const SectionHeader('Department'),
              EmptyState(icon: Icons.apartment_outlined, title: l.nothingNew),
              const SectionHeader('College'),
              EmptyState(icon: Icons.account_balance_outlined, title: l.nothingNew),
            ]),
          ),
        ),
      ),
    );
  }
}
```

```dart
// mobile/lib/features/me/me_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/features/me/photo_picker.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/identity_card.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    final version = ref.watch(appVersionProvider).valueOrNull ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('Me')),
      body: me.when(
        loading: () => const SkeletonList(),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider)),
        data: (c) {
          final m = c.data;
          return ListView(children: [
            Padding(padding: const EdgeInsets.all(16), child: IdentityCard(m, onChangePhoto: () => pickAndUploadPhoto(context, ref))),
            if (c.stale) AsOfLine(c.asOf),
            TextButton(onPressed: () => _somethingWrong(context, m), child: const Text('Something wrong? Tell the office')),
            const SectionHeader('Settings'),
            ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('Notifications and quiet hours'), trailing: const Icon(Icons.chevron_right), onTap: () => context.go('/me/settings')),
            ListTile(leading: const Icon(Icons.devices_outlined), title: const Text('Devices'), trailing: const Icon(Icons.chevron_right), onTap: () => context.go('/me/devices')),
            ListTile(leading: const Icon(Icons.password_outlined), title: const Text('Change password'), trailing: const Icon(Icons.chevron_right), onTap: () => context.go('/me/change-password')),
            const SectionHeader('About'),
            ListTile(leading: const Icon(Icons.info_outline), title: Text('Juvi $version'), subtitle: const Text('Your data stays with your institution. Juvi never shares it with third parties.')),
            if (m.institution.supportContact != null)
              ListTile(leading: const Icon(Icons.support_agent_outlined), title: Text(m.institution.supportContact!.name), subtitle: Text([m.institution.supportContact!.phone, m.institution.supportContact!.email].whereType<String>().join(' · '))),
            const SizedBox(height: 8),
            Padding(padding: const EdgeInsets.all(16), child: OutlinedButton(onPressed: () => ref.read(sessionControllerProvider.notifier).signOut(), child: const Text('Sign out'))),
          ]);
        },
      ),
    );
  }

  void _somethingWrong(BuildContext context, Me m) {
    final c = m.institution.supportContact;
    showModalBottomSheet<void>(context: context, showDragHandle: true, builder: (_) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Something wrong with your details?', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        const Text('Juvi shows what your college records hold. The office can correct them.'),
        if (c != null) ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.support_agent_outlined), title: Text(c.name), subtitle: Text([c.phone, c.email].whereType<String>().join(' · '))),
      ]),
    ));
  }
}
```

```dart
// mobile/lib/features/me/photo_picker.dart
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';

/// Pick → square crop → compress to ≤ 1280px JPEG → upload. Online only.
Future<void> pickAndUploadPhoto(BuildContext context, WidgetRef ref) async {
  final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2048, maxHeight: 2048);
  if (picked == null) return;
  final cropped = await ImageCropper().cropImage(sourcePath: picked.path, aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1));
  if (cropped == null) return;
  final bytes = await FlutterImageCompress.compressWithFile(cropped.path, minWidth: 1280, minHeight: 1280, quality: 82, format: CompressFormat.jpeg);
  if (bytes == null) return;
  try {
    final repo = await ref.read(meRepositoryProvider.future);
    await repo.uploadPhoto(bytes, 'photo.jpg');
    ref.invalidate(meProvider);
  } on ApiFailure catch (f) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.isOffline ? 'Photo upload needs a connection.' : f.message)));
  }
}
```

```dart
// mobile/lib/features/me/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/me/theme_preference.dart';
import 'package:juvi/shared/widgets/section_header.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  Future<void> _pickTime(BuildContext context, WidgetRef ref, String key, String current, Map<String, String> quiet) async {
    final parts = current.split(':').map(int.parse).toList();
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: parts[0], minute: parts[1]));
    if (picked == null) return;
    final v = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    await ref.read(settingsControllerProvider.notifier).patch({'quietHours': {...quiet, key: v}});
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsControllerProvider).valueOrNull;
    final mode = ref.watch(themePreferenceProvider);
    if (settings == null) return Scaffold(appBar: AppBar(title: const Text('Settings')), body: const Center(child: CircularProgressIndicator()));
    final quiet = {'start': settings.quietHours.start, 'end': settings.quietHours.end};
    final ctrl = ref.read(settingsControllerProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications and quiet hours')),
      body: ListView(children: [
        const SectionHeader('Notification tiers'),
        const ListTile(title: Text('Urgent'), subtitle: Text('Exam changes, campus closures. Always delivered; cannot be turned off.'), trailing: Switch(value: true, onChanged: null)),
        SwitchListTile(title: const Text('Important'), subtitle: const Text('Notices needing acknowledgement, department posts, mentions.'), value: settings.tiers.important, onChanged: (v) => ctrl.patch({'tiers': {'important': v}})),
        SwitchListTile(title: const Text('Routine'), subtitle: const Text('Course posts and replies. Badge and digest only, no sound.'), value: settings.tiers.routine, onChanged: (v) => ctrl.patch({'tiers': {'routine': v}})),
        const SectionHeader('Quiet hours'),
        ListTile(title: const Text('Start'), trailing: Text(settings.quietHours.start), onTap: () => _pickTime(context, ref, 'start', settings.quietHours.start, quiet)),
        ListTile(title: const Text('End'), trailing: Text(settings.quietHours.end), onTap: () => _pickTime(context, ref, 'end', settings.quietHours.end, quiet)),
        const SectionHeader('Appearance'),
        RadioGroup<ThemeMode>(
          groupValue: mode,
          onChanged: (m) { if (m != null) ref.read(themePreferenceProvider.notifier).set(m); },
          child: Column(children: [
            for (final (m, label) in [(ThemeMode.system, 'Follow system'), (ThemeMode.light, 'Light'), (ThemeMode.dark, 'Dark')])
              RadioListTile<ThemeMode>(value: m, title: Text(label)),
          ]),
        ),
        const SectionHeader('Language'),
        const ListTile(title: Text('English'), subtitle: Text('More languages are planned.')),
      ]),
    );
  }
}
```

```dart
// mobile/lib/features/me/devices_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

final devicesProvider = FutureProvider.autoDispose<List<DeviceRow>>((ref) async => (await ref.read(meRepositoryProvider.future)).devices());

class DevicesScreen extends ConsumerWidget {
  const DevicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devices = ref.watch(devicesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Devices')),
      body: devices.when(
        loading: () => const SkeletonList(),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(devicesProvider)),
        data: (rows) => ListView(children: [
          for (final d in rows)
            ListTile(
              leading: Icon(d.platform == 'ios' ? Icons.phone_iphone : Icons.phone_android),
              title: Text(d.isCurrent ? '${d.deviceName} (this device)' : d.deviceName),
              subtitle: Text('v${d.appVersion} · last active ${DateTime.parse(d.lastActiveAt).toLocal()}'),
              trailing: d.isCurrent ? null : IconButton(icon: const Icon(Icons.logout), tooltip: 'Sign out this device', onPressed: () async {
                await (await ref.read(meRepositoryProvider.future)).revokeDevice(d.sessionId);
                ref.invalidate(devicesProvider);
              }),
            ),
          if (rows.length > 1)
            Padding(padding: const EdgeInsets.all(16), child: OutlinedButton(onPressed: () async {
              await (await ref.read(meRepositoryProvider.future)).revokeOtherDevices();
              ref.invalidate(devicesProvider);
            }, child: const Text('Sign out other devices'))),
        ]),
      ),
    );
  }
}
```

`ChangePasswordScreen` reuses `SetPasswordScreen`'s form with an `AppBar` back button and, on success, pops instead of updating the session:

```dart
// mobile/lib/features/me/change_password_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/auth_repository.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  ConsumerState<ChangePasswordScreen> createState() => _State();
}

class _State extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController(); final _next = TextEditingController();
  String? _error; bool _busy = false;
  Future<void> _submit() async {
    if (_next.text.length < 8) { setState(() => _error = 'Use at least 8 characters'); return; }
    setState(() { _busy = true; _error = null; });
    try {
      await ref.read(authRepositoryProvider).changePassword(_current.text, _next.text);
      if (mounted) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed. Other devices were signed out.'))); context.pop(); }
    } on ApiFailure catch (f) { setState(() => _error = f.message); } finally { if (mounted) setState(() => _busy = false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Change password')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          TextField(controller: _current, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
          const SizedBox(height: 12),
          TextField(controller: _next, obscureText: true, decoration: InputDecoration(labelText: 'New password', errorText: _error)),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: const Text('Save password')),
        ]),
      );
}
```

- [ ] **Step 4: Codegen, tests, analyzer**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter test test/core/repos test/features/home test/features/me && flutter analyze`
Expected: PASS (5 tests), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(mobile): Me repository with cached-then-network stream, Today/Teaching shells, Me, settings, devices

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Spaces and channel header (S06, S07)

**Files:**
- Create: `mobile/lib/core/repos/spaces_repository.dart`, `mobile/lib/features/spaces/channel_row.dart`
- Replace: `mobile/lib/features/spaces/spaces_screen.dart`, `mobile/lib/features/spaces/channel_screen.dart`
- Test: `mobile/test/features/spaces/spaces_screen_test.dart`

**Interfaces:**
- Produces:
  ```dart
  // models: SpaceChannel, SpaceGroup, SpacesData, ChannelDetail (freezed, fromJson)
  abstract class SpacesRepository {
    Future<Cached<SpacesData>?> cached(); Future<Cached<SpacesData>> refresh();
    Future<Cached<ChannelDetail>?> cachedChannel(String id); Future<Cached<ChannelDetail>> refreshChannel(String id);
    Future<void> setMuted(String channelId, bool muted);   // online; throws offline
    Future<void> markRead(String channelId);
  }
  @riverpod Stream<Cached<SpacesData>> spaces(Ref ref);
  @riverpod Stream<Cached<ChannelDetail>> channel(Ref ref, String id);
  Future<void> toggleMute(WidgetRef ref, SpaceChannel c);   // optimistic; enqueues 'channel.mute' | 'channel.unmute' offline
  ```

- [ ] **Step 1: Write the failing test**

```dart
// mobile/test/features/spaces/spaces_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/spaces/spaces_screen.dart';

Map<String, dynamic> ch(String id, String name, {bool muted = false, String? next, bool archived = false}) => {
  'id': id, 'name': name, 'about': 'About $name', 'scopeType': 'course_offering', 'templateCode': 'course', 'role': 'member',
  'muted': muted, 'memberCount': 60, 'archived': archived, 'nextClassAt': null, 'nextClassLabel': next,
};
final spacesJson = {
  'groups': [
    {'key': 'college', 'title': 'College', 'channels': [ch('c1', 'JIT College')..['scopeType'] = 'college'..['templateCode'] = 'college']},
    {'key': 'courses', 'title': 'My Courses', 'channels': [ch('c2', 'CS202 OS · A', next: 'Next: Today 08:00'), ch('c3', 'CS201 DBMS · A', muted: true, next: 'Next: Today 17:00')]},
    {'key': 'archived', 'title': 'Archived', 'channels': [ch('c9', 'CS101 · A', archived: true)]},
  ],
  'asOf': '2026-09-23T08:14:00+05:30',
};
final emptyCourses = {'groups': [{'key': 'courses', 'title': 'My Courses', 'emptyHint': 'Your course spaces appear here once your registrations are in.', 'channels': <Map<String, dynamic>>[]}], 'asOf': '2026-09-23T08:14:00+05:30'};

Widget host(Map<String, dynamic> json) => ProviderScope(
  overrides: [spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(json), DateTime.now()); })],
  child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SpacesScreen()));

void main() {
  testWidgets('renders groups in server order with next-class labels, muted marker and archived section', (t) async {
    await t.pumpWidget(host(spacesJson));
    await t.pump();
    final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
    expect(texts.indexOf('COLLEGE'), lessThan(texts.indexOf('MY COURSES')));
    expect(texts.indexOf('MY COURSES'), lessThan(texts.indexOf('ARCHIVED')));
    expect(texts.indexOf('CS202 OS · A'), lessThan(texts.indexOf('CS201 DBMS · A')));
    expect(find.text('Next: Today 08:00'), findsOneWidget);
    expect(find.byIcon(Icons.notifications_off_outlined), findsOneWidget);
    expect(find.text('CS101 · A'), findsOneWidget);
  });

  testWidgets('empty courses group shows the hint', (t) async {
    await t.pumpWidget(host(emptyCourses));
    await t.pump();
    expect(find.textContaining('once your registrations are in'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && flutter test test/features/spaces`
Expected: FAIL: `SpacesData` missing.

- [ ] **Step 3: Implement**

Add to `models.dart`:

```dart
@freezed
class SpaceChannel with _$SpaceChannel {
  const factory SpaceChannel({required String id, required String name, required String about, required String scopeType, required String templateCode, required String role, required bool muted, required int memberCount, required bool archived, String? nextClassAt, String? nextClassLabel}) = _SpaceChannel;
  factory SpaceChannel.fromJson(Map<String, dynamic> json) => _$SpaceChannelFromJson(json);
}

@freezed
class SpaceGroup with _$SpaceGroup {
  const factory SpaceGroup({required String key, required String title, String? emptyHint, required List<SpaceChannel> channels}) = _SpaceGroup;
  factory SpaceGroup.fromJson(Map<String, dynamic> json) => _$SpaceGroupFromJson(json);
}

@freezed
class SpacesData with _$SpacesData {
  const factory SpacesData({required List<SpaceGroup> groups, required String asOf}) = _SpacesData;
  factory SpacesData.fromJson(Map<String, dynamic> json) => _$SpacesDataFromJson(json);
}

@freezed
class ChannelDetail with _$ChannelDetail {
  const factory ChannelDetail({required String id, required String name, required String about, required String scopeType, required String templateCode, required String status, required int memberCount, required String replyRule, required String defaultPriority, required String role, required bool muted, required bool canPost, required bool canReply, required String whoCanPost}) = _ChannelDetail;
  factory ChannelDetail.fromJson(Map<String, dynamic> json) => _$ChannelDetailFromJson(json);
}
```

```dart
// mobile/lib/core/repos/spaces_repository.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'spaces_repository.g.dart';

abstract class SpacesRepository {
  Future<Cached<SpacesData>?> cached();
  Future<Cached<SpacesData>> refresh();
  Future<Cached<ChannelDetail>?> cachedChannel(String id);
  Future<Cached<ChannelDetail>> refreshChannel(String id);
  Future<void> setMuted(String channelId, bool muted);
  Future<void> markRead(String channelId);
}

class ApiSpacesRepository implements SpacesRepository {
  ApiSpacesRepository(this._api, this._db);
  final MobileApi _api;
  final AppDatabase _db;
  Future<T> _guard<T>(Future<T> Function() f) async { try { return await f(); } catch (e) { throw ApiFailure.of(e); } }

  @override
  Future<Cached<SpacesData>?> cached() async {
    final doc = await _db.readDoc('spaces');
    return doc == null ? null : Cached(SpacesData.fromJson(doc.json), doc.asOf);
  }
  @override
  Future<Cached<SpacesData>> refresh() => _guard(() async {
        final json = (await _api.listSpaces()).data!.toJson();
        final asOf = DateTime.tryParse(json['asOf'] as String? ?? '')?.toUtc() ?? DateTime.now().toUtc();
        await _db.writeDoc('spaces', json, asOf);
        return Cached(SpacesData.fromJson(json), asOf);
      });
  @override
  Future<Cached<ChannelDetail>?> cachedChannel(String id) async {
    final doc = await _db.readDoc('channel:$id');
    return doc == null ? null : Cached(ChannelDetail.fromJson(doc.json), doc.asOf);
  }
  @override
  Future<Cached<ChannelDetail>> refreshChannel(String id) => _guard(() async {
        final json = (await _api.getChannel(id: id)).data!.toJson();
        final now = DateTime.now().toUtc();
        await _db.writeDoc('channel:$id', json, now);
        return Cached(ChannelDetail.fromJson(json), now);
      });
  @override
  Future<void> setMuted(String channelId, bool muted) => _guard(() => muted ? _api.muteChannel(id: channelId) : _api.unmuteChannel(id: channelId));
  @override
  Future<void> markRead(String channelId) => _guard(() => _api.markChannelRead(id: channelId));
}

@Riverpod(keepAlive: true)
Future<SpacesRepository> spacesRepository(Ref ref) async => ApiSpacesRepository(ref.read(mobileApiProvider), await ref.read(appDatabaseProvider.future));

@riverpod
Stream<Cached<SpacesData>> spaces(Ref ref) async* {
  final repo = await ref.read(spacesRepositoryProvider.future);
  final c = await repo.cached();
  if (c != null) yield c;
  try { yield await repo.refresh(); } on ApiFailure catch (f) { if (c == null) rethrow; yield c.markStale(f); }
}

@riverpod
Stream<Cached<ChannelDetail>> channel(Ref ref, String id) async* {
  final repo = await ref.read(spacesRepositoryProvider.future);
  final c = await repo.cachedChannel(id);
  if (c != null) yield c;
  try { yield await repo.refreshChannel(id); } on ApiFailure catch (f) { if (c == null) rethrow; yield c.markStale(f); }
}

/// Optimistic mute toggle; queues the write when offline and rewrites the cached list so the row flips immediately.
Future<void> toggleMute(WidgetRef ref, SpaceChannel c) async {
  final db = await ref.read(appDatabaseProvider.future);
  final repo = await ref.read(spacesRepositoryProvider.future);
  final muted = !c.muted;
  final doc = await db.readDoc('spaces');
  if (doc != null) {
    final groups = (doc.json['groups'] as List).map((g) => {...g as Map, 'channels': (g['channels'] as List).map((x) => x['id'] == c.id ? {...x as Map, 'muted': muted} : x).toList()}).toList();
    await db.writeDoc('spaces', {...doc.json, 'groups': groups}, doc.asOf);
  }
  try {
    await repo.setMuted(c.id, muted);
  } on ApiFailure catch (f) {
    if (f.isOffline) await db.enqueueAction(PendingAction.create(muted ? 'channel.mute' : 'channel.unmute', {'channelId': c.id}));
  }
  ref.invalidate(spacesProvider);
}
```

```dart
// mobile/lib/features/spaces/channel_row.dart
import 'package:flutter/material.dart';
import 'package:juvi/core/models/models.dart';

class ChannelRow extends StatelessWidget {
  const ChannelRow(this.c, {required this.onTap, required this.onLongPress, super.key});
  final SpaceChannel c; final VoidCallback onTap; final VoidCallback onLongPress;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final faded = c.archived ? scheme.onSurfaceVariant : null;
    return ListTile(
      onTap: onTap, onLongPress: onLongPress,
      leading: CircleAvatar(backgroundColor: c.templateCode == 'college' ? scheme.primaryContainer : scheme.surfaceContainerHighest, child: Text(c.name.characters.first, style: TextStyle(color: faded))),
      title: Text(c.name, style: TextStyle(color: faded, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(c.nextClassLabel ?? c.about, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: c.muted ? Icon(Icons.notifications_off_outlined, size: 18, color: scheme.onSurfaceVariant) : null,
    );
  }
}
```

```dart
// mobile/lib/features/spaces/spaces_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/spaces/channel_row.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

class SpacesScreen extends ConsumerWidget {
  const SpacesScreen({super.key});

  void _actions(BuildContext context, WidgetRef ref, SpaceChannel c) {
    showModalBottomSheet<void>(context: context, showDragHandle: true, builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(leading: Icon(c.muted ? Icons.notifications_active_outlined : Icons.notifications_off_outlined), title: Text(c.muted ? 'Unmute' : 'Mute'), onTap: () { Navigator.pop(context); toggleMute(ref, c); }),
      ListTile(leading: const Icon(Icons.done_all), title: const Text('Mark all read'), onTap: () async { Navigator.pop(context); (await ref.read(spacesRepositoryProvider.future)).markRead(c.id).catchError((_) {}); }),
    ])));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final spaces = ref.watch(spacesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Spaces')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(spacesProvider.future),
        child: spaces.when(
          loading: () => const SkeletonList(count: 6),
          error: (e, _) => ListView(children: [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(spacesProvider))]),
          data: (c) => ListView(children: [
            if (c.stale) AsOfLine(c.asOf),
            for (final g in c.data.groups) ...[
              SectionHeader(g.title),
              if (g.channels.isEmpty && g.emptyHint != null) EmptyState(icon: Icons.menu_book_outlined, title: g.title, hint: g.emptyHint),
              for (final ch in g.channels) ChannelRow(ch, onTap: () => context.go('/spaces/${ch.id}'), onLongPress: () => _actions(context, ref, ch)),
            ],
            const SizedBox(height: 24),
          ]),
        ),
      ),
    );
  }
}
```

```dart
// mobile/lib/features/spaces/channel_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

class ChannelScreen extends ConsumerWidget {
  const ChannelScreen({required this.channelId, super.key});
  final String channelId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(channelProvider(channelId));
    return Scaffold(
      appBar: AppBar(title: Text(detail.valueOrNull?.data.name ?? '')),
      body: detail.when(
        loading: () => const SkeletonList(count: 2),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(channelProvider(channelId))),
        data: (c) => ListView(padding: const EdgeInsets.all(16), children: [
          if (c.stale) AsOfLine(c.asOf),
          Text(c.data.name, style: Theme.of(context).textTheme.titleLarge),
          Text('${c.data.memberCount} members${c.data.status == 'archived' ? ' · Archived' : ''}', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 12),
          Text('About', style: Theme.of(context).textTheme.titleSmall),
          Text(c.data.about),
          const SizedBox(height: 8),
          Text('Who can post: ${c.data.whoCanPost}', style: Theme.of(context).textTheme.bodyMedium),
          Text(c.data.replyRule == 'allowed' ? 'Members can reply in threads.' : 'Announcement only.', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 32),
          EmptyState(icon: Icons.chat_bubble_outline, title: context.l10n.nothingNew),
        ]),
      ),
    );
  }
}
```

- [ ] **Step 4: Codegen, tests, analyzer**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter test test/features/spaces && flutter analyze`
Expected: PASS (2 tests), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(mobile): Spaces grouped list with next-class labels, mute via long-press, channel About

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Onboarding (S02, steps 1–3 plus optional photo)

**Files:**
- Replace: `mobile/lib/features/onboarding/onboarding_screen.dart`
- Create: `mobile/lib/features/onboarding/steps/identity_step.dart`, `spaces_step.dart`, `notifications_step.dart`
- Test: `mobile/test/features/onboarding/onboarding_screen_test.dart`

**Interfaces:**
- `OnboardingScreen({required int step})` reads `meProvider` and `spacesProvider`, renders the step named `account.onboardingSteps[step]` (`identity`, `spaces`, `notifications`; unknown names render a generic continue card so a future server step never bricks the app), shows progress dots and a back button, and on Continue calls `MeRepository.advanceOnboarding(step)` then `sessionController.updateAccount(...)`.

- [ ] **Step 1: Write the failing test**

```dart
// mobile/test/features/onboarding/onboarding_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:mocktail/mocktail.dart';
import '../../core/repos/me_repository_test.dart' show meJson;
import '../spaces/spaces_screen_test.dart' show spacesJson;

class _Repo extends Mock implements MeRepository {}
class _Session extends SessionController {
  AccountSummary? updated;
  @override SessionState build() => SessionState.signedIn(Me.fromJson(meJson).account);
  @override Future<void> updateAccount(AccountSummary a) async { updated = a; state = SessionState.signedIn(a); }
}

Widget host(int step, _Repo repo, _Session session, {Map<String, dynamic>? me}) => ProviderScope(
  overrides: [
    meProvider.overrideWith((_) async* { yield Cached(Me.fromJson(me ?? meJson), DateTime.now()); }),
    spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(spacesJson), DateTime.now()); }),
    meRepositoryProvider.overrideWith((_) async => repo),
    sessionControllerProvider.overrideWith(() => session),
  ],
  child: MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: OnboardingScreen(step: step)));

void main() {
  testWidgets('identity step shows ERP facts, no typed input, and advances', (t) async {
    final repo = _Repo(); final session = _Session();
    when(() => repo.advanceOnboarding(0)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 1, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: false));
    await t.pumpWidget(host(0, repo, session));
    await t.pump();
    expect(find.text('Aditya Nair'), findsOneWidget);
    expect(find.text('24JIT0001'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.text('Add a photo (optional)'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(session.updated?.onboardingStep, 1);
  });

  testWidgets('lateral-entry copy appears when the student joined mid-way', (t) async {
    final me = Map<String, dynamic>.from(meJson)..['student'] = {...meJson['student'] as Map, 'isLateralEntry': true};
    await t.pumpWidget(host(1, _Repo(), _Session(), me: me));
    await t.pump();
    expect(find.textContaining('joining the batch mid-way'), findsOneWidget);
    expect(find.text('JIT College'), findsOneWidget);   // spaces revealed from the spaces provider
  });

  testWidgets('notifications step explains tiers, offers quiet hours, and the last step completes', (t) async {
    final repo = _Repo(); final session = _Session();
    when(() => repo.advanceOnboarding(2)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 3, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: true));
    await t.pumpWidget(host(2, repo, session));
    await t.pump();
    expect(find.textContaining('Urgent'), findsWidgets);
    expect(find.text('22:00'), findsOneWidget);
    await t.tap(find.text('Finish'));
    await t.pumpAndSettle();
    expect(session.updated?.onboardingComplete, isTrue);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && flutter test test/features/onboarding`
Expected: FAIL: placeholder screen.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/features/onboarding/onboarding_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/onboarding/steps/identity_step.dart';
import 'package:juvi/features/onboarding/steps/notifications_step.dart';
import 'package:juvi/features/onboarding/steps/spaces_step.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({required this.step, super.key});
  final int step;
  @override
  ConsumerState<OnboardingScreen> createState() => _State();
}

class _State extends ConsumerState<OnboardingScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _advance(AccountSummary account) async {
    setState(() { _busy = true; _error = null; });
    try {
      final repo = await ref.read(meRepositoryProvider.future);
      final next = await repo.advanceOnboarding(widget.step);
      await ref.read(sessionControllerProvider.notifier).updateAccount(account.copyWith(
        onboardingStep: next.onboardingStep, onboardingSteps: next.onboardingSteps, onboardingComplete: next.onboardingComplete,
        status: next.onboardingComplete ? 'active' : account.status,
      ));
      // GoRouter.maybeOf keeps the screen testable without a router; in the app the router is always present.
      if (mounted && !next.onboardingComplete) GoRouter.maybeOf(context)?.go('/onboarding/${next.onboardingStep}');
    } on ApiFailure catch (f) {
      setState(() => _error = f.isOffline ? 'This step needs a connection.' : f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    final account = session is SignedIn ? session.account : null;
    final me = ref.watch(meProvider);
    if (account == null) return const Scaffold(body: SizedBox.shrink());
    final steps = account.onboardingSteps;
    final name = widget.step < steps.length ? steps[widget.step] : 'unknown';
    final isLast = widget.step >= steps.length - 1;

    return Scaffold(
      appBar: AppBar(
        leading: widget.step > 0 ? BackButton(onPressed: () => GoRouter.maybeOf(context)?.go('/onboarding/${widget.step - 1}')) : null,
        title: Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < steps.length; i++)
            Container(width: 8, height: 8, margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(shape: BoxShape.circle, color: i <= widget.step ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.outlineVariant)),
        ]),
        centerTitle: true,
      ),
      body: me.when(
        loading: () => const SkeletonList(),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider)),
        data: (c) => Column(children: [
          Expanded(child: switch (name) {
            'identity' => IdentityStep(c.data),
            'spaces' => SpacesStep(c.data),
            'notifications' => NotificationsStep(c.data),
            _ => const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('One more thing from your college is on its way. Continue for now.'))),
          }),
          if (_error != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          Padding(
            padding: const EdgeInsets.all(24),
            child: FilledButton(onPressed: _busy ? null : () => _advance(account), child: Text(isLast ? 'Finish' : 'Continue')),
          ),
        ]),
      ),
    );
  }
}
```

```dart
// mobile/lib/features/onboarding/steps/identity_step.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/features/me/photo_picker.dart';
import 'package:juvi/shared/widgets/identity_card.dart';

/// Step 1: the app already knows you. Zero typed input; photo is optional (spec S02).
class IdentityStep extends ConsumerWidget {
  const IdentityStep(this.me, {super.key});
  final Me me;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ListView(padding: const EdgeInsets.all(24), children: [
        Text('Your college has set you up', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text("Here's what ${me.institution.name} has on record. Nothing to fill in."),
        const SizedBox(height: 20),
        IdentityCard(me, onChangePhoto: () => pickAndUploadPhoto(context, ref)),
        TextButton.icon(onPressed: () => pickAndUploadPhoto(context, ref), icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Add a photo (optional)')),
        if (me.institution.supportContact != null)
          TextButton(onPressed: () => showModalBottomSheet<void>(context: context, showDragHandle: true, builder: (_) => ListTile(leading: const Icon(Icons.support_agent_outlined), title: Text(me.institution.supportContact!.name), subtitle: Text([me.institution.supportContact!.phone, me.institution.supportContact!.email].whereType<String>().join(' · ')))),
            child: const Text('Something wrong? Tell the office')),
      ]);
}
```

```dart
// mobile/lib/features/onboarding/steps/spaces_step.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// Step 2: a reveal, not a selection. Channels are grouped exactly as in Spaces.
class SpacesStep extends ConsumerWidget {
  const SpacesStep(this.me, {super.key});
  final Me me;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final spaces = ref.watch(spacesProvider);
    final lateral = me.student?.isLateralEntry == true;
    return ListView(padding: const EdgeInsets.symmetric(vertical: 24), children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text('Your spaces', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700))),
      Padding(padding: const EdgeInsets.fromLTRB(24, 8, 24, 0), child: Text(me.faculty != null
          ? 'One space per course you teach, plus your department and the college.'
          : lateral
              ? "You're joining the batch mid-way, so your spaces match the courses you're registered for now. First-year spaces aren't included."
              : 'One space for the college, your department, your batch and each course. They come from your registrations, so nothing to set up.')),
      spaces.when(
        loading: () => const SkeletonList(),
        error: (_, __) => const Padding(padding: EdgeInsets.all(24), child: Text('Spaces will appear once you are online.')),
        data: (c) => Column(children: [
          for (final g in c.data.groups) ...[
            SectionHeader(g.title),
            for (final ch in g.channels) ListTile(dense: true, leading: const Icon(Icons.forum_outlined), title: Text(ch.name), subtitle: Text(ch.about, maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (g.channels.isEmpty && g.emptyHint != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(g.emptyHint!)),
          ],
        ]),
      ),
    ]);
  }
}
```

```dart
// mobile/lib/features/onboarding/steps/notifications_step.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';

/// Step 3: an honest explanation of the three tiers and a quiet-hours toggle.
/// The OS permission prompt itself arrives with push in sub-project 3.
class NotificationsStep extends ConsumerWidget {
  const NotificationsStep(this.me, {super.key});
  final Me me;

  Future<void> _pick(BuildContext context, WidgetRef ref, String key, String current) async {
    final p = current.split(':').map(int.parse).toList();
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: p[0], minute: p[1]));
    if (t == null) return;
    final v = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    await ref.read(settingsControllerProvider.notifier).patch({'quietHours': {'start': me.settings.quietHours.start, 'end': me.settings.quietHours.end, key: v}});
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(settingsControllerProvider).valueOrNull ?? me.settings;
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text('Stay informed, not overwhelmed', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 12),
      const ListTile(leading: Icon(Icons.priority_high), title: Text('Urgent'), subtitle: Text('Exam changes, campus closures. Always gets through, even in quiet hours.')),
      const ListTile(leading: Icon(Icons.notifications_active_outlined), title: Text('Important'), subtitle: Text('Notices you must acknowledge and department posts. Waits for quiet hours to end.')),
      const ListTile(leading: Icon(Icons.notifications_none), title: Text('Routine'), subtitle: Text('Course posts and replies. A badge and a digest, no sound.')),
      const Divider(height: 32),
      Text('Quiet hours', style: Theme.of(context).textTheme.titleMedium),
      ListTile(title: const Text('From'), trailing: Text(s.quietHours.start), onTap: () => _pick(context, ref, 'start', s.quietHours.start)),
      ListTile(title: const Text('Until'), trailing: Text(s.quietHours.end), onTap: () => _pick(context, ref, 'end', s.quietHours.end)),
    ]);
  }
}
```

- [ ] **Step 4: Tests and analyzer**

Run: `cd mobile && flutter test test/features/onboarding && flutter analyze`
Expected: PASS (3 tests), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/onboarding mobile/test/features/onboarding
git commit -m "feat(mobile): server-driven onboarding with identity reveal, spaces reveal and notification tiers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: System states, connectivity, sync worker, analytics (S14)

**Files:**
- Create: `mobile/lib/core/connectivity/connectivity_provider.dart`, `mobile/lib/core/sync/sync_worker.dart`, `mobile/lib/core/analytics/analytics.dart`
- Replace: `mobile/lib/features/system/offline_banner.dart`, `deactivated_screen.dart`, `paused_screen.dart`, `update_required_screen.dart`
- Modify: `mobile/lib/app/app.dart` (mount `SyncWorker` lifecycle + `app.opened` event), `mobile/lib/core/session/session_controller.dart` (emit `account.signed_in`)
- Test: `mobile/test/core/sync/sync_worker_test.dart`, `mobile/test/features/system/system_screens_golden_test.dart`

**Interfaces:**
- Produces:
  ```dart
  @riverpod Stream<bool> isOnline(Ref ref);                          // connectivity_plus, true when any interface is up
  class SyncWorker { SyncWorker(AppDatabase db, MeRepository me, SpacesRepository spaces); Future<DrainResult> drain(); }   // FIFO; stops on offline; removes on success or after 10 attempts
  class DrainResult { final int sent, deferred, dropped; }
  abstract class Analytics { void track(String event, [Map<String, Object?> props = const {}]); }
  class ConsoleAnalytics implements Analytics;  @Riverpod(keepAlive: true) Analytics analytics(Ref ref);
  ```
  Events recorded in Foundation: `app.opened`, `account.signed_in`, `onboarding.step_completed {step}`, `onboarding.completed`, `settings.changed {key}`, `channel.muted`. Payloads carry ids and enums only.

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/core/sync/sync_worker_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/core/sync/sync_worker.dart';
import 'package:mocktail/mocktail.dart';

class _Me extends Mock implements MeRepository {}
class _Spaces extends Mock implements SpacesRepository {}

void main() {
  late AppDatabase db; late _Me me; late _Spaces spaces; late SyncWorker w;
  setUp(() { db = AppDatabase.memory(); me = _Me(); spaces = _Spaces(); w = SyncWorker(db, me, spaces); });
  tearDown(() => db.close());

  test('drains in order and removes sent actions', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await db.enqueueAction(PendingAction.create('settings.patch', {'tiers': {'routine': false}}));
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {});
    when(() => me.updateSettings({'tiers': {'routine': false}})).thenAnswer((_) async =>
        const Settings(quietHours: QuietHours(start: '22:00', end: '07:00'), tiers: Tiers(important: true, routine: false), language: 'en'));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 2, deferred: 0, dropped: 0));
    expect(await db.pendingActions(), isEmpty);
    verifyInOrder([() => spaces.setMuted('c1', true), () => me.updateSettings({'tiers': {'routine': false}})]);
  });

  test('stops at the first offline failure and keeps the rest', () async {
    await db.enqueueAction(PendingAction.create('channel.read', {'channelId': 'c1'}));
    await db.enqueueAction(PendingAction.create('channel.unmute', {'channelId': 'c2'}));
    when(() => spaces.markRead('c1')).thenThrow(const ApiFailure(ApiErrorCode.offline, 'off'));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 2, dropped: 0));
    expect((await db.pendingActions()).length, 2);
    expect((await db.pendingActions()).first.attempts, 1);
    verifyNever(() => spaces.setMuted('c2', false));
  });

  test('drops an action on a non-offline 4xx', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'gone'}));
    when(() => spaces.setMuted('gone', true)).thenThrow(const ApiFailure(ApiErrorCode.notFound, 'nope', status: 404));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 0, dropped: 1));
    expect(await db.pendingActions(), isEmpty);
  });

  test('drops an action after ten failed attempts', () async {
    final a = PendingAction.create('channel.read', {'channelId': 'flaky'});
    await db.enqueueAction(a);
    for (var i = 0; i < 9; i++) { await db.recordAttempt(a.id, 'server'); }
    when(() => spaces.markRead('flaky')).thenThrow(const ApiFailure(ApiErrorCode.internal, 'boom', status: 500));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 0, dropped: 1));
    expect(await db.pendingActions(), isEmpty);
  });
}
```

The test file also imports `package:juvi/core/models/models.dart` for `Settings`, `QuietHours` and `Tiers`.

```dart
// mobile/test/features/system/system_screens_golden_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/system/deactivated_screen.dart';
import 'package:juvi/features/system/paused_screen.dart';
import 'package:juvi/features/system/update_required_screen.dart';

class _S extends SessionController {
  _S(this.s); final SessionState s;
  @override SessionState build() => s;
}

Widget host(SessionState s, Widget screen, Brightness b) => ProviderScope(overrides: [sessionControllerProvider.overrideWith(() => _S(s))],
  child: MaterialApp(theme: buildTheme(brightness: b), localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: screen));

void main() {
  final cases = <(String, SessionState, Widget)>[
    ('deactivated', const SessionState.deactivated(supportContact: SupportContact(name: 'Exam Office', phone: '040-1')), const DeactivatedScreen()),
    ('paused', const SessionState.paused('Juvi is paused for maintenance until Monday 8:00.'), const PausedScreen()),
    ('update_required', const SessionState.updateRequired(minVersion: '1.2.0', storeUrl: 'https://play.google.com/'), const UpdateRequiredScreen()),
  ];
  for (final (name, state, screen) in cases) {
    for (final b in Brightness.values) {
      testWidgets('$name ${b.name}', (t) async {
        await t.binding.setSurfaceSize(const Size(390, 780));
        await t.pumpWidget(host(state, screen, b));
        await t.pump();
        await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/${name}_${b.name}.png'));
      });
    }
  }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/core/sync test/features/system`
Expected: FAIL: missing `sync_worker.dart`; placeholders render.

- [ ] **Step 3: Implement**

```dart
// mobile/lib/core/connectivity/connectivity_provider.dart
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'connectivity_provider.g.dart';

@Riverpod(keepAlive: true)
Stream<bool> isOnline(Ref ref) async* {
  final c = Connectivity();
  yield !(await c.checkConnectivity()).contains(ConnectivityResult.none);
  yield* c.onConnectivityChanged.map((r) => !r.contains(ConnectivityResult.none));
}
```

```dart
// mobile/lib/core/sync/sync_worker.dart
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';

class DrainResult {
  const DrainResult({required this.sent, required this.deferred, required this.dropped});
  final int sent, deferred, dropped;
  @override bool operator ==(Object o) => o is DrainResult && o.sent == sent && o.deferred == deferred && o.dropped == dropped;
  @override int get hashCode => Object.hash(sent, deferred, dropped);
  @override String toString() => 'DrainResult(sent: $sent, deferred: $deferred, dropped: $dropped)';
}

/// Replays queued writes FIFO. Offline stops the drain; a non-offline failure counts an attempt;
/// ten attempts or a 4xx that is not a cooldown drops the action (spec §11).
class SyncWorker {
  SyncWorker(this._db, this._me, this._spaces);
  final AppDatabase _db; final MeRepository _me; final SpacesRepository _spaces;
  static const maxAttempts = 10;
  bool _running = false;

  Future<DrainResult> drain() async {
    if (_running) return const DrainResult(sent: 0, deferred: 0, dropped: 0);
    _running = true;
    var sent = 0, deferred = 0, dropped = 0;
    try {
      final actions = await _db.pendingActions();
      for (var i = 0; i < actions.length; i++) {
        final a = actions[i];
        try {
          await _apply(a);
          await _db.removeAction(a.id);
          sent++;
        } on ApiFailure catch (f) {
          if (f.isOffline) { deferred = actions.length - i; await _db.recordAttempt(a.id, 'offline'); break; }
          final permanent = (f.status ?? 500) >= 400 && (f.status ?? 500) < 500 && f.code != ApiErrorCode.cooldown;
          if (permanent || a.attempts + 1 >= maxAttempts) { await _db.removeAction(a.id); dropped++; }
          else { await _db.recordAttempt(a.id, f.message); deferred++; }
        }
      }
    } finally { _running = false; }
    return DrainResult(sent: sent, deferred: deferred, dropped: dropped);
  }

  Future<void> _apply(PendingAction a) async {
    switch (a.type) {
      case 'settings.patch': await _me.updateSettings(a.payload);
      case 'channel.mute': await _spaces.setMuted(a.payload['channelId'] as String, true);
      case 'channel.unmute': await _spaces.setMuted(a.payload['channelId'] as String, false);
      case 'channel.read': await _spaces.markRead(a.payload['channelId'] as String);
      default: throw const ApiFailure(ApiErrorCode.unknown, 'unknown action', status: 400);   // dropped as permanent
    }
  }
}
```

```dart
// mobile/lib/core/analytics/analytics.dart
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'analytics.g.dart';

/// Section 11 product events. Ids and enums only — never names or content (NFR-11).
abstract class Analytics {
  void track(String event, [Map<String, Object?> props = const {}]);
}

class ConsoleAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {
    if (kDebugMode) debugPrint('[analytics] $event ${props.isEmpty ? '' : props}');
  }
}

@Riverpod(keepAlive: true)
Analytics analytics(Ref ref) => ConsoleAnalytics();
```

Wire the events: in `SessionController.signIn` after `state = SessionState.signedIn(...)` add `ref.read(analyticsProvider).track('account.signed_in', {'kind': result.account.kind});`; in `OnboardingScreen._advance` after success `track('onboarding.step_completed', {'step': widget.step})` and `track('onboarding.completed')` when complete; in `SettingsController.patch` `track('settings.changed', {'key': p.keys.join(',')})`; in `toggleMute` `track('channel.muted', {'muted': muted})`.

```dart
// mobile/lib/features/system/offline_banner.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';

class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider).valueOrNull ?? true;
    if (online) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerHighest,
      child: SafeArea(bottom: false, child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(children: [Icon(Icons.cloud_off_outlined, size: 16, color: scheme.onSurfaceVariant), const SizedBox(width: 8), Expanded(child: Text(context.l10n.offlineBanner, style: Theme.of(context).textTheme.labelMedium))]),
      )),
    );
  }
}
```

```dart
// mobile/lib/features/system/deactivated_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/shared/widgets/empty_state.dart';

class DeactivatedScreen extends ConsumerWidget {
  const DeactivatedScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final contact = s is Deactivated ? s.supportContact : null;
    return Scaffold(body: SafeArea(child: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
      EmptyState(icon: Icons.lock_outline, title: context.l10n.deactivatedTitle, hint: context.l10n.deactivatedBody),
      if (contact != null) ListTile(leading: const Icon(Icons.support_agent_outlined), title: Text(contact.name), subtitle: Text([contact.phone, contact.email].whereType<String>().join(' · '))),
      const SizedBox(height: 16),
      OutlinedButton(onPressed: () => ref.read(sessionControllerProvider.notifier).signOut(), child: const Text('Back to sign in')),
    ])))));
  }
}
```

```dart
// mobile/lib/features/system/paused_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/repos/config_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/shared/widgets/empty_state.dart';

class PausedScreen extends ConsumerWidget {
  const PausedScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final message = s is Paused ? s.message : '';
    return Scaffold(body: SafeArea(child: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
      EmptyState(icon: Icons.pause_circle_outline, title: context.l10n.pausedTitle, hint: message),
      const SizedBox(height: 16),
      // A successful /me after the institution resumes puts the session back to signedIn via updateAccount.
      OutlinedButton(
        onPressed: () async {
          try {
            final fresh = await (await ref.read(meRepositoryProvider.future)).refresh();
            await ref.read(sessionControllerProvider.notifier).updateAccount(fresh.data.account);
          } catch (_) { /* still paused or offline: stay here */ }
        },
        child: Text(context.l10n.retry),
      ),
    ])))));
  }
}
```

`PausedScreen` imports `package:juvi/core/repos/me_repository.dart` instead of `config_repository.dart`.

```dart
// mobile/lib/features/system/update_required_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:url_launcher/url_launcher.dart';

class UpdateRequiredScreen extends ConsumerWidget {
  const UpdateRequiredScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final (min, url) = s is UpdateRequired ? (s.minVersion, s.storeUrl) : ('', '');
    return Scaffold(body: SafeArea(child: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
      EmptyState(icon: Icons.system_update_alt, title: context.l10n.updateRequiredTitle, hint: context.l10n.updateRequiredBody(min)),
      const SizedBox(height: 16),
      FilledButton(onPressed: url.isEmpty ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication), child: Text(context.l10n.openStore)),
    ])))));
  }
}
```

Mount the sync worker and the `app.opened` event in `JuviApp` (Task 5 file) by wrapping `MaterialApp.router` in this widget:

```dart
// mobile/lib/core/sync/sync_lifecycle.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/sync/sync_worker.dart';

/// Drains queued writes when connectivity returns or the app resumes; records app.opened.
class SyncLifecycle extends ConsumerStatefulWidget {
  const SyncLifecycle({required this.child, super.key});
  final Widget child;
  @override
  ConsumerState<SyncLifecycle> createState() => _SyncLifecycleState();
}

class _SyncLifecycleState extends ConsumerState<SyncLifecycle> with WidgetsBindingObserver {
  bool _wasOnline = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.read(analyticsProvider).track('app.opened');
    ref.listenManual<AsyncValue<bool>>(isOnlineProvider, (_, next) {
      final online = next.valueOrNull ?? true;
      if (online && !_wasOnline) _drain();
      _wasOnline = online;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(analyticsProvider).track('app.opened');
      _drain();
    }
  }

  Future<void> _drain() async {
    try {
      final db = await ref.read(appDatabaseProvider.future);
      final me = await ref.read(meRepositoryProvider.future);
      final spaces = await ref.read(spacesRepositoryProvider.future);
      final result = await SyncWorker(db, me, spaces).drain();
      if (result.sent > 0) { ref.invalidate(meProvider); ref.invalidate(spacesProvider); }
    } catch (_) { /* nothing to drain or storage not ready yet */ }
  }

  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }

  @override
  Widget build(BuildContext context) => widget.child;
}
```

In `JuviApp.build`, return `SyncLifecycle(child: MaterialApp.router(...))` with the same `MaterialApp.router` arguments as before, and import `package:juvi/core/sync/sync_lifecycle.dart`.

- [ ] **Step 4: Codegen, tests, goldens, analyzer**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter test test/core/sync && flutter test --update-goldens test/features/system && flutter test test/features/system && flutter analyze`
Expected: PASS (3 sync tests, 6 goldens), analyzer clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(mobile): offline banner, deactivated/paused/update screens, pending-action sync worker, analytics events

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end flow test and wrap-up

**Files:**
- Create: `mobile/test/flows/sign_in_flow_test.dart`, `mobile/integration_test/sign_in_flow_test.dart`
- Modify: `mobile/README.md` (flow test note), `CLAUDE.md` (mobile pointers)

**Interfaces:**
- The flow test drives the real `JuviApp` with `mobileApiProvider`/`bareMobileApiProvider` overridden to a `JuviApi` on a `Dio` with `http_mock_adapter`, and `secureStoreProvider`/`appDatabaseProvider` overridden with in-memory fakes: sign-in → set-password → three onboarding steps → Today.

- [ ] **Step 1: Write the flow test**

```dart
// mobile/test/flows/sign_in_flow_test.dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/app/app.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/repos/me_repository_test.dart' show meJson;
import '../features/spaces/spaces_screen_test.dart' show spacesJson;

class _Storage extends Mock implements FlutterSecureStorage {}

void main() {
  testWidgets('sign in → set password → onboarding → Today', (t) async {
    SharedPreferences.setMockInitialValues({});
    final mem = <String, String>{};
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async { mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String; });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));

    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    final adapter = DioAdapter(dio: dio);
    var step = 0; var mustChange = true;
    Map<String, dynamic> account() => {'id': 'a', 'kind': 'student', 'status': step >= 3 ? 'active' : 'onboarding', 'onboardingStep': step, 'onboardingSteps': ['identity', 'spaces', 'notifications'], 'onboardingComplete': step >= 3, 'mustChangePassword': mustChange};
    adapter.onGet('/institutions/JIT', (s) => s.reply(200, {'collegeId': 'c1', 'name': 'JIT College', 'logoUrl': null, 'accentColor': '#0B5FA5', 'paused': false, 'pausedMessage': null, 'minAppVersion': null}));
    adapter.onPost('/auth/sign-in', (s) => s.reply(200, {'accessToken': 'a', 'accessExpiresIn': 900, 'refreshToken': 'r' * 43, 'account': account()}), data: Matchers.any);
    adapter.onPost('/auth/change-password', (s) { mustChange = false; s.reply(204, null); }, data: Matchers.any);
    adapter.onGet('/me', (s) => s.reply(200, {...meJson, 'account': account()}));
    adapter.onGet('/config', (s) => s.reply(200, {'name': 'JIT College', 'code': 'JIT', 'logoUrl': null, 'accentColor': '#0B5FA5', 'supportContact': null, 'quietHoursDefault': {'start': '22:00', 'end': '07:00'}, 'timezone': 'Asia/Kolkata', 'featureFlags': {'languageRoadmap': false}, 'minAppVersion': null, 'onboardingSteps': ['identity', 'spaces', 'notifications']}));
    adapter.onGet('/spaces', (s) => s.reply(200, spacesJson));
    adapter.onPost('/me/onboarding/advance', (s) { step++; s.reply(200, {'onboardingStep': step, 'onboardingSteps': ['identity', 'spaces', 'notifications'], 'onboardingComplete': step >= 3}); }, data: Matchers.any);

    final api = JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi();
    final db = AppDatabase.memory();
    final container = ProviderContainer(overrides: [
      secureStoreProvider.overrideWithValue(SecureStore(storage)),
      appDatabaseProvider.overrideWith((_) async => db),
      appVersionProvider.overrideWith((_) async => '1.0.0'),
      mobileApiProvider.overrideWithValue(api),
      bareMobileApiProvider.overrideWithValue(api),
    ]);
    await container.read(sessionControllerProvider.notifier).restore();
    await t.pumpWidget(UncontrolledProviderScope(container: container, child: const JuviApp()));
    await t.pumpAndSettle();

    // S01
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text('JIT College'), findsOneWidget);
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '24JIT0001');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();

    // Set password
    expect(find.text('Set your password'), findsOneWidget);
    await t.enterText(find.bySemanticsLabel('Current password'), 'river-lamp-482');
    await t.enterText(find.bySemanticsLabel('New password'), 'longenough1');
    await t.tap(find.text('Save password'));
    await t.pumpAndSettle();

    // Onboarding ×3
    expect(find.text('Your college has set you up'), findsOneWidget);
    await t.tap(find.text('Continue')); await t.pumpAndSettle();
    expect(find.text('Your spaces'), findsOneWidget);
    await t.tap(find.text('Continue')); await t.pumpAndSettle();
    expect(find.text('Stay informed, not overwhelmed'), findsOneWidget);
    await t.tap(find.text('Finish')); await t.pumpAndSettle();

    // Today
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.text('No classes today'), findsOneWidget);
    expect(mem['juvi.access'], 'a');
    await db.close();
  });
}
```

```dart
// mobile/integration_test/sign_in_flow_test.dart
// Same flow on a real device/emulator: `flutter test integration_test`.
import 'package:integration_test/integration_test.dart';
import '../test/flows/sign_in_flow_test.dart' as flow;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  flow.main();
}
```

- [ ] **Step 2: Run it**

Run: `cd mobile && flutter test test/flows && flutter analyze && flutter test`
Expected: the flow test PASSES; the full suite PASSES; analyzer clean. Then, with the backend running and seeded, `flutter run --dart-define=JUVI_API_BASE_URL=http://10.0.2.2:3003/api/juvi-app/v1` and sign in with the seed's demo credentials end to end.

- [ ] **Step 3: Documentation**

Append to `mobile/README.md`:

```markdown
## Tests
- `flutter test` — unit, widget and golden tests (`flutter test --update-goldens` after an intentional visual change).
- `flutter test test/flows` — the sign-in → onboarding → Today flow against a mocked API.
- `flutter test integration_test` — the same flow on a connected device or emulator.
```

Add to `CLAUDE.md` under the Juvi section written in Plan 1:

```markdown
- Flutter app lives in `mobile/` (not an npm workspace). `flutter test` and `flutter analyze` from `mobile/`; CI is `.github/workflows/mobile.yml`. Regenerate the Dart client with `mobile/tool/gen_api.sh` after any contract change.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/srinivasarao.kandula/code/juvion_v2
git add mobile CLAUDE.md
git commit -m "test(mobile): end-to-end sign-in, set-password, onboarding and Today flow against a mocked API

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| §8 On the device: secure storage, refresh once, invalidated → sign-in with reason, never sign out offline | 2, 3, 4, 6 |
| §10 Contract: generated Dart client, error envelope handling | 1, 3 |
| §11 Layout, routing, state and data, security on the device | 1, 2, 4, 5, 7, 8 |
| §11 Look and feel: accent theme, dark mode, typography roles, empty states, skeletons, offline banner | 5, 10 |
| §11 Screens: S01, set-password, S02, Today/Teaching shells, S06, S07 header, S12 + devices + settings + change password, S14 | 6, 9, 7, 8, 10 |
| §11 Instrumentation | 10 |
| §11 Build/CI | 1 |
| §14 App failure handling: typed failures, retry keeps input, pending actions never dropped silently | 3, 6, 10 |
| §15 Device security | 2 |
| §16 Flutter tests: unit, widget five states, goldens, integration flow | 2–11 |
| US-1 (S01 ACs), US-2 (session ACs), US-3 (onboarding ACs), US-4 (Spaces ACs), US-5 (Me ACs) | 6, 3–4, 9, 8, 7 |
