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

  setUpAll(() {
    // mocktail needs a fallback instance for any type used with `any()`/`captureAny()`.
    registerFallbackValue(const DeviceInfo(id: 'd', name: 'n', platform: 'android', appVersion: '1.0.0', osVersion: 'os'));
  });

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
  tearDown(() async {
    c.dispose();
    await db.close();
  });

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

  test('restore with tokens but no cached account fetches it from the server', () async {
    // e.g. an iOS reinstall: the keychain survives, the on-device database does not.
    mem['juvi.access'] = 'a'; mem['juvi.refresh'] = 'r';
    when(() => auth.fetchAccount()).thenAnswer((_) async => account);
    final s = c.read(sessionControllerProvider.notifier);
    await s.restore();
    expect(c.read(sessionControllerProvider), const SessionState.signedIn(account));
    expect((await db.readDoc('account'))!.json['id'], 'a1');
  });

  test('restore with tokens but no cached account, offline, signs out without wiping the tokens', () async {
    mem['juvi.access'] = 'a'; mem['juvi.refresh'] = 'r';
    when(() => auth.fetchAccount()).thenAnswer((_) async => throw const ApiFailure(ApiErrorCode.offline, "You're offline."));
    final s = c.read(sessionControllerProvider.notifier);
    await s.restore();
    expect(c.read(sessionControllerProvider), const SessionState.signedOut(reason: 'restore'));
    expect(mem['juvi.access'], 'a');
  });

  test('handleFailure maps fatal codes to states and wipes on sign-out-class failures', () async {
    mem['juvi.access'] = 'a';
    final s = c.read(sessionControllerProvider.notifier);
    await s.handleFailure(const ApiFailure(ApiErrorCode.institutionPaused, 'Back Monday', detail: {'message': 'Back Monday'}));
    expect(c.read(sessionControllerProvider), const SessionState.paused('Back Monday'));
    await s.handleFailure(const ApiFailure(ApiErrorCode.updateRequired, 'x', detail: {'minVersion': '1.2.0', 'storeUrl': 'https://play'}));
    expect(c.read(sessionControllerProvider), const SessionState.updateRequired(minVersion: '1.2.0', storeUrl: 'https://play'));
    await s.handleFailure(const ApiFailure(ApiErrorCode.sessionInvalidated, 'x', detail: {'reason': 'password_changed'}));
    expect(c.read(sessionControllerProvider), const SessionState.signedOut(reason: 'password_changed'));
    expect(mem['juvi.access'], isNull);
  });

  test('accountDeactivated then sessionInvalidated keeps the deactivated state', () async {
    mem['juvi.access'] = 'a';
    final s = c.read(sessionControllerProvider.notifier);
    await s.handleFailure(const ApiFailure(ApiErrorCode.accountDeactivated, 'x', detail: {
      'supportContact': {'name': 'Help Desk'},
    }));
    expect(c.read(sessionControllerProvider), const SessionState.deactivated(supportContact: SupportContact(name: 'Help Desk')));
    await s.handleFailure(const ApiFailure(ApiErrorCode.sessionInvalidated, 'x', detail: {'reason': 'password_changed'}));
    expect(c.read(sessionControllerProvider), const SessionState.deactivated(supportContact: SupportContact(name: 'Help Desk')));
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

  // I2: restore() runs before runApp; nothing it hits may throw out of it.
  group('restore never throws', () {
    ProviderContainer containerWith(_Storage storage, {bool dbFails = false}) {
      final container = ProviderContainer(retry: (_, _) => null, overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        secureStoreProvider.overrideWithValue(SecureStore(storage)),
        appDatabaseProvider.overrideWith((_) async => dbFails ? throw Exception('file is not a database') : db),
        appVersionProvider.overrideWith((_) async => '1.0.0'),
      ]);
      addTearDown(container.dispose);
      return container;
    }

    test('an unreadable secure store ends signed out', () async {
      final storage = _Storage();
      when(() => storage.read(key: any(named: 'key'))).thenThrow(Exception('BadPaddingException'));
      when(() => storage.delete(key: any(named: 'key'))).thenAnswer((_) async {});
      final container = containerWith(storage);
      await container.read(sessionControllerProvider.notifier).restore();
      expect(container.read(sessionControllerProvider), const SessionState.signedOut());
    });

    test('a database that cannot open ends signed out', () async {
      final storage = _Storage();
      when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => {'juvi.access': 'a', 'juvi.refresh': 'r'}[i.namedArguments[#key]]);
      final container = containerWith(storage, dbFails: true);
      await container.read(sessionControllerProvider.notifier).restore();
      expect(container.read(sessionControllerProvider), const SessionState.signedOut(reason: 'restore'));
    });
  });

  // T4: handleFailure runs unawaited from the interceptor; a storage error in the wipe
  // must not escape as an uncaught zone error, and the rest of the wipe still runs.
  test('handleFailure completes and signs out when the secure store cannot delete', () async {
    final storage = _Storage();
    when(() => storage.delete(key: any(named: 'key'))).thenThrow(Exception('keystore'));
    final container = ProviderContainer(retry: (_, _) => null, overrides: [
      secureStoreProvider.overrideWithValue(SecureStore(storage)),
      appDatabaseProvider.overrideWith((_) async => db),
    ]);
    addTearDown(container.dispose);
    await db.writeDoc('me', {'a': 1}, DateTime.utc(2026));
    await container.read(sessionControllerProvider.notifier).handleFailure(
          const ApiFailure(ApiErrorCode.sessionInvalidated, 'x', status: 401, detail: {'reason': 'missing'}),
        );
    expect(container.read(sessionControllerProvider), const SessionState.signedOut(reason: 'missing'));
    expect(await db.readDoc('me'), isNull);
  });
}
