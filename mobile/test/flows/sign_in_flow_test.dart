import 'dart:async';

import 'package:dio/dio.dart' show InterceptorsWrapper;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/app/app.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/push/push_fixtures.dart';
import '../core/repos/me_repository_test.dart' show meJson;
import '../core/repos/notices_fixtures.dart';
import '../features/spaces/spaces_screen_test.dart' show spacesJson;

class _Storage extends Mock implements FlutterSecureStorage {}

/// A no-op stand-in for `BatchingAnalytics` — `SyncLifecycle` fires `track('app.opened')`
/// on every launch/resume; this test only needs it not to throw.
class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
}

void main() {
  testWidgets('sign in → set password → onboarding with the first notice → Today → acknowledge → clear', (t) async {
    SharedPreferences.setMockInitialValues({});
    final mem = <String, String>{};
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));

    // A single Dio + mock adapter backs every provider the app makes HTTP calls through:
    // `dioProvider` (me_repository.dart's `/me`/`/me/photo` and config_repository.dart's
    // `/config` call it directly), `bareDioProvider` (auth_repository.dart's
    // `lookupInstitution` calls it directly), and `mobileApiProvider`/
    // `bareMobileApiProvider` (the generated client, used for everything else). See
    // mobile/README.md's "generated-client gap" note for why those three calls bypass
    // the generated client.
    //
    // The Dio is the real `buildDio`, so requests carry the Bearer token from the secure
    // store once there is one and a fatal failure reaches `handleFailure` exactly as in
    // the app — which is what lets the `/config` mock below reject unauthenticated calls.
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
    final adapter = DioAdapter(dio: dio);
    var step = 0;
    var mustChange = true;
    // The welcome notice (onboarding step 4) stays Due until it is acknowledged.
    var acked = false;
    const steps = ['identity', 'spaces', 'notifications', 'first_notice'];
    Map<String, dynamic> account() => {
          'id': 'a',
          'kind': 'student',
          'status': step >= steps.length ? 'active' : 'onboarding',
          'onboardingStep': step,
          'onboardingSteps': steps,
          'onboardingComplete': step >= steps.length,
          'mustChangePassword': mustChange,
        };
    Map<String, dynamic> welcome() => acked
        ? detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z')
        : detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome');

    // `/institutions/{code}` and `/config` send `minAppVersion`/`supportContact` as
    // `null` here because that's what the real server sends whenever there's no
    // app-version gate or support contact configured — the common (not the edge) case.
    // Both endpoints are read on a raw Dio (auth_repository.dart's `lookupInstitution`,
    // config_repository.dart's `refresh`), not through the generated client, precisely
    // because the generated client's `fromJson` cannot handle that `null` (see
    // mobile/README.md's generated-client-gap note) — a mock that papered over this with
    // a non-null placeholder would hide the bug the raw-Dio fix exists for, instead of
    // exercising it (R61).
    //
    // Registered with `replyCallback` (not `reply`) wherever the response depends on
    // `step`/`mustChange`: its data callback runs once per dispatched request, so
    // `account()` reflects that mutable state at the moment each endpoint is actually
    // hit. A plain `reply(status, {...})` bakes its map argument in once, at
    // registration time — before the test has signed in, changed the password or
    // advanced a single onboarding step — which would freeze every one of these
    // responses at their step-0/mustChange-true starting values for the rest of the test.
    adapter
      ..onGet(
        '/institutions/JIT',
        (s) => s.reply(200, {
          'collegeId': 'c1',
          'name': 'JIT College',
          'logoUrl': null,
          'accentColor': '#0B5FA5',
          'paused': false,
          'pausedMessage': null,
          'minAppVersion': null,
        }),
      )
      ..onPost(
        '/auth/sign-in',
        (s) => s.replyCallback(200, (_) => {'accessToken': 'a', 'accessExpiresIn': 900, 'refreshToken': 'r' * 43, 'account': account()}),
        data: Matchers.any,
      )
      ..onPost(
        '/auth/change-password',
        (s) => s.replyCallback(204, (_) {
          mustChange = false;
          return null;
        }),
        data: Matchers.any,
      )
      ..onGet('/me', (s) => s.replyCallback(200, (_) => {...meJson, 'account': account()}))
      // I1: the contract's reply to `/config` without a Bearer token. http_mock_adapter
      // answers with the LAST registered mock that matches, so this one only answers
      // requests the authenticated mock below does not match.
      ..onGet(
        '/config',
        (s) => s.reply(401, {
          'error': {'code': 'SESSION_INVALIDATED', 'message': 'Please sign in again.', 'reason': 'missing'},
        }),
      )
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
          'onboardingSteps': steps,
        }),
      )
      ..onGet('/spaces', (s) => s.reply(200, spacesJson))
      ..onGet('/onboarding/first-notice', (s) => s.replyCallback(200, (_) => welcome()))
      ..onGet(
        '/attention',
        (s) => s.replyCallback(200, (_) => attentionJson([if (!acked) cardJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome')])),
      )
      ..onPost(
        '/notices/w1/ack',
        (s) => s.replyCallback(200, (_) {
          acked = true;
          return ackJson();
        }),
        data: Matchers.any,
      )
      ..onPost(
        '/me/onboarding/advance',
        (s) => s.replyCallback(200, (_) {
          step++;
          return {'onboardingStep': step, 'onboardingSteps': steps, 'onboardingComplete': step >= steps.length};
        }),
        data: Matchers.any,
      );

    final api = JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi();
    final db = AppDatabase.memory();
    addTearDown(db.close);
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
        // Task 10 additions (SyncLifecycle's dependencies): no platform channels in a
        // widget test, so connectivity is a fixed "online" stream and analytics is a
        // no-op.
        isOnlineProvider.overrideWith((_) => Stream.value(true)),
        analyticsProvider.overrideWithValue(_NoopAnalytics()),
      ],
    );
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.notifier).restore();
    await t.pumpWidget(UncontrolledProviderScope(container: container, child: const JuviApp()));
    await t.pumpAndSettle();

    // S01 — a first launch must not be told its (non-existent) session ended.
    expect(find.text('Please sign in again.'), findsNothing);
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text('JIT College'), findsOneWidget);
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '24JIT0001');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the (now-enabled) button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();

    // Set password
    expect(find.text('Set your password'), findsOneWidget);
    await t.enterText(find.bySemanticsLabel('Current password'), 'river-lamp-482');
    await t.enterText(find.bySemanticsLabel('New password'), 'longenough1');
    await t.tap(find.text('Save password'));
    await t.pumpAndSettle();

    // Onboarding ×4
    expect(find.text('Your college has set you up'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(find.text('Your spaces'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(find.text('Stay informed, not overwhelmed'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    // Step 4: the real welcome notice. Finishing without acknowledging leaves it Due.
    expect(find.text('Your first notice'), findsOneWidget);
    expect(find.text('Welcome to Juvi'), findsOneWidget);
    expect(find.byType(AckControl), findsOneWidget);
    await t.tap(find.text('Finish'));
    await t.pumpAndSettle();

    // Today: the welcome notice is the one due item, and the tab badge says 1.
    expect(find.text('Welcome to Juvi'), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('1')), findsWidgets);
    expect(find.text("You're clear"), findsNothing);

    // Acknowledge with a 1.2 s hold (the press is recognised after kPressTimeout).
    final hold = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 1250));
    await hold.up();
    await t.pumpAndSettle();

    expect(acked, isTrue);
    expect(find.text('Welcome to Juvi'), findsNothing);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('1')), findsNothing);
    expect(find.text('No classes today'), findsOneWidget);
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
    // pushData()'s notice id: 24 hex characters, the only shape DeepLinkResolver accepts.
    const noticeId = '66f1c0ffee0000000000abcd';
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
