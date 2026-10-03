import 'dart:async';
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
  late FakeLocalNotifications local;

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
      localNotificationsProvider.overrideWithValue(local),
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
    local = FakeLocalNotifications();
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
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedOut());
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedIn(account));
    await settle();
    expect(calls.where((l) => l.startsWith('PUT')), [
      'PUT /me/devices/current/push-token {platform: android, token: fcm-token-1}',
      'PUT /me/devices/current/push-token {platform: android, token: fcm-token-2}',
    ]);
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
    var sent = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      sent++;
      h.next(o);
    }));
    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      notificationPermissionProvider.overrideWithValue(permission),
      mobileApiProvider.overrideWithValue(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi()),
      sessionControllerProvider.overrideWith(() => _Session(const SessionState.signedIn(account))),
    ]);
    addTearDown(c.dispose);
    expect(c.read(pushMessagingProvider), isA<NoPushMessaging>());
    await c.read(pushRegistrationProvider).sync();
    await c.read(pushRegistrationProvider).unregister();
    expect(sent, 0);
  });

  test('a forced sign-out deletes the FCM token locally and makes no request', () async {
    final c = container();
    await c.read(pushRegistrationProvider).sync();
    calls.clear();
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedOut(reason: 'revoked'));
    await settle();
    expect(messaging.deletes, 1);
    expect(calls, isEmpty);
  });

  test('a normal sign-out deletes the FCM token once, not again when the session ends', () async {
    final c = container();
    final registration = c.read(pushRegistrationProvider);
    await registration.sync();
    await registration.unregister();
    (c.read(sessionControllerProvider.notifier) as _Session).set(const SessionState.signedOut());
    await settle();
    expect(messaging.deletes, 1);
    expect(calls.where((l) => l.startsWith('DELETE')), hasLength(1));
  });

  test('an in-flight sync cannot register after unregister', () async {
    final c = container();
    final registration = c.read(pushRegistrationProvider);
    final sync = registration.sync();
    final out = registration.unregister();
    await Future.wait([sync, out]);
    expect(calls, ['PUT /me/devices/current/push-token {platform: android, token: fcm-token-1}', 'DELETE /me/devices/current/push-token']);
    // FCM would mint a fresh token here (the fake does too): nothing may register it on the
    // session that is about to be revoked, neither a sync nor a token refresh.
    await registration.sync();
    messaging.refreshes.add('fcm-token-3');
    await settle();
    expect(calls.where((l) => l.startsWith('PUT')), hasLength(1));
  });

  test('sign-out clears the tray, and so does a forced sign-out; the session ending after a sign-out does not clear it twice', () async {
    final c = container();
    final registration = c.read(pushRegistrationProvider);
    final session = c.read(sessionControllerProvider.notifier) as _Session;
    await registration.sync();
    await registration.unregister();
    expect(local.cancelled, 1);
    session.set(const SessionState.signedOut());
    await settle();
    expect(local.cancelled, 1);
    session.set(const SessionState.signedIn(account));
    await settle();
    session.set(const SessionState.signedOut(reason: 'revoked'));
    await settle();
    expect(local.cancelled, 2);
    session.set(const SessionState.signedIn(account));
    await settle();
    session.set(const SessionState.paused('Back on Monday'));
    await settle();
    expect(local.cancelled, 3);
  });

  test('sign-out clears the tray even while FCM is wedged', () async {
    final wedged = _WedgedMessaging();
    messaging = wedged;
    final c = container();
    final registration = c.read(pushRegistrationProvider);
    unawaited(registration.sync()); // stuck on getToken
    unawaited(registration.unregister());
    await settle();
    expect(local.cancelled, 1);
  });
}

/// FCM that never answers: `getToken` and `deleteToken` hang (offline, no Play services).
class _WedgedMessaging extends FakePushMessaging {
  @override
  Future<String?> token() => Completer<String?>().future;
  @override
  Future<void> deleteToken() => Completer<void>().future;
}
