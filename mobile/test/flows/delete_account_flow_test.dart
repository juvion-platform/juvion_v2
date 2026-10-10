import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/push/push_fixtures.dart';

class _Storage extends Mock implements FlutterSecureStorage {}

class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
}

const _account = AccountSummary(id: 'a1', kind: 'student', status: 'active', onboardingStep: 4, onboardingSteps: ['identity'], onboardingComplete: true, mustChangePassword: false);

_Storage _storageOver(Map<String, String> mem) {
  final storage = _Storage();
  when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
  when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
    mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
  });
  when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
  return storage;
}

/// S1 AC3/AC4/AC6 through the real stack: the generated client on the real `buildDio` (so the
/// Bearer header and the fatal-failure wiring are the app's own), the real repository and the
/// real session controller. A mocked repository could not show that a 401 on the delete request
/// itself reaches the wipe — that path runs through the interceptor's `onFatal`.
void main() {
  late Map<String, String> mem;
  late AppDatabase db;
  late SecureStore store;
  late FakePushMessaging messaging;
  late FakeLocalNotifications local;
  final sent = <String>[];

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    mem = {};
    sent.clear();
    db = AppDatabase.memory();
    messaging = FakePushMessaging();
    local = FakeLocalNotifications();
  });
  tearDown(() => db.close());

  /// `dioProvider` and `mobileApiProvider` are the app's own here — the fatal-failure wiring under
  /// test (interceptor → `onFatal` → `handleFailure` → wipe) is `api_providers.dart`'s, not a copy
  /// of it. Only the things that touch the platform (secure storage, database, app version, push)
  /// are overridden; the adapter is attached to the real Dio.
  ProviderContainer containerWith(void Function(DioAdapter) route) {
    store = SecureStore(_storageOver(mem));
    late final ProviderContainer c;
    c = ProviderContainer(retry: (_, _) => null, overrides: [
      secureStoreProvider.overrideWithValue(store),
      appDatabaseProvider.overrideWith((_) async => db),
      appVersionProvider.overrideWith((_) async => '1.0.0'),
      analyticsProvider.overrideWithValue(_NoopAnalytics()),
      pushRegistrationProvider.overrideWithValue(
        PushRegistration(messaging: messaging, local: local, api: () => c.read(mobileApiProvider), signedIn: () => true, allowed: () async => true),
      ),
    ]);
    addTearDown(c.dispose);
    final dio = c.read(dioProvider)..interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
        sent.add('${o.method} ${o.path} ${o.headers['Authorization']}');
        h.next(o);
      }));
    route(DioAdapter(dio: dio));
    return c;
  }

  Future<void> seedSignedIn(ProviderContainer container) async {
    mem['juvi.access'] = 'a';
    mem['juvi.refresh'] = 'r';
    mem['juvi.college_id'] = 'c1';
    await db.writeDoc('me', {'id': 'a1'}, DateTime.now().toUtc());
    await db.enqueueEvent('glance.opened', DateTime.now().toUtc(), {'n': 1});
    await ReceiptQueue().add(ReceiptItem(deliveryId: 'd1', receipt: 'sig.1', event: 'delivered', at: DateTime.now().toUtc()));
    await store.writePendingLink('{"route":"/notices/n1"}');
    await store.writeLastAccount('c1:a1');
    await container.read(sessionControllerProvider.notifier).updateAccount(_account);
    // Loaded first, so the assertions after the delete cannot pass by having had nothing to clear.
    expect(await store.readTokens(), isNotNull);
    expect(await db.readDoc('me'), isNotNull);
    expect(await db.eventCount(), 1);
    expect(await ReceiptQueue().read(), hasLength(1));
    expect(await store.readPendingLink(), isNotNull);
    expect(await store.readLastAccount(), isNotNull);
  }

  Future<void> expectEverythingGone() async {
    expect(mem['juvi.access'], isNull);
    expect(mem['juvi.college_id'], isNull);
    expect(await store.readTokens(), isNull);
    expect(await db.readDoc('me'), isNull);
    expect(await db.eventCount(), 0);
    expect(await ReceiptQueue().read(), isEmpty);
    expect(await store.readPendingLink(), isNull);
    expect(await store.readLastAccount(), isNull);
    // The device identity is not the account's: clearing it would orphan the encrypted database.
    expect(await store.deviceId(), isNotEmpty);
  }

  test('S1 AC3: the delete goes to the server with the session token, and only then is the device wiped', () async {
    final container = containerWith((a) => a.onDelete('/me/account', (s) => s.reply(204, null)));
    await seedSignedIn(container);

    await container.read(sessionControllerProvider.notifier).deleteAccount();

    expect(sent, ['DELETE /me/account Bearer a']);
    await expectEverythingGone();
    expect(container.read(sessionControllerProvider), const SessionState.signedOut(reason: 'account_deleted'));
    // AC3: not signOut() — nothing revokes this phone's push token, because there is no account
    // left to revoke it for.
    expect(messaging.deletes, 0);
    expect(local.cancelled, 0);
  });

  test('S1 AC4: an offline delete deletes nothing locally and keeps the session', () async {
    final container = containerWith((a) => a.onDelete('/me/account', (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline'))));
    await seedSignedIn(container);

    await expectLater(
      container.read(sessionControllerProvider.notifier).deleteAccount(),
      throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.offline)),
    );

    expect(mem['juvi.access'], 'a');
    expect(await store.readTokens(), isNotNull);
    expect(await db.readDoc('me'), isNotNull);
    expect(await db.eventCount(), 1);
    expect(await ReceiptQueue().read(), hasLength(1));
    expect(await store.readPendingLink(), isNotNull);
    expect(await store.readLastAccount(), isNotNull);
    expect(container.read(sessionControllerProvider), const SessionState.signedIn(_account));
  });

  // AC6: another device deleting the account first makes this device's delete 401. That is not a
  // bounce to sign-in — the interceptor's onFatal routes it through the same wipe, so the copy
  // this device still holds is dropped on its next launch.
  test('S1 AC6: a 401 SESSION_INVALIDATED on the delete routes through the same wipe', () async {
    final container = containerWith((a) => a.onDelete(
          '/me/account',
          (s) => s.reply(401, {
            'error': {'code': 'SESSION_INVALIDATED', 'message': 'Please sign in again.', 'reason': 'account_deleted'},
          }),
        ));
    await seedSignedIn(container);

    await expectLater(
      container.read(sessionControllerProvider.notifier).deleteAccount(),
      throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.sessionInvalidated)),
    );
    // onFatal runs unawaited from the interceptor, so let the wipe it starts finish.
    await pumpEventQueue();

    await expectEverythingGone();
    expect(container.read(sessionControllerProvider), const SessionState.signedOut(reason: 'account_deleted'));
  });
}
