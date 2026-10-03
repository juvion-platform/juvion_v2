import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/app/deep_link_resolver.dart';
import 'package:juvi/app/router.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_lifecycle.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi_api/juvi_api.dart' show JuviApi;
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/redirect_test.dart' show acct;
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

class _Storage extends Mock implements FlutterSecureStorage {}

class _Session extends SessionController {
  _Session(this.initial);
  final SessionState initial;
  @override
  SessionState build() => initial;
}

class _SettableSession extends SessionController {
  _SettableSession(this.initial);
  final SessionState initial;
  @override
  SessionState build() => initial;
  // A test hook, not a property.
  // ignore: use_setters_to_change_properties
  void set(SessionState s) => state = s;
}

class _GatedLocal extends FakeLocalNotifications {
  final gate = Completer<void>();
  @override
  Future<void> init({void Function(String? payload)? onTap}) async {
    await super.init(onTap: onTap);
    await gate.future;
  }
}

class _ThrowingLaunchLocal extends FakeLocalNotifications {
  @override
  Future<String?> launchPayload() async => throw StateError('no launch details');
}

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

  testWidgets('cold start signed in: a forced sign-out before init finishes still deletes the FCM token', (t) async {
    final gated = _GatedLocal();
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    DioAdapter(dio: dio)
      ..onPut('/me/devices/current/push-token', (s) => s.reply(204, null), data: Matchers.any)
      ..onDelete('/me/devices/current/push-token', (s) => s.reply(204, null));
    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      localNotificationsProvider.overrideWithValue(gated),
      pushMessagingProvider.overrideWithValue(messaging),
      notificationPermissionProvider.overrideWithValue(permission),
      receiptsProvider.overrideWithValue(receipts),
      deepLinkResolverProvider.overrideWithValue(resolver),
      noticeActionsProvider.overrideWithValue(actions),
      mobileApiProvider.overrideWithValue(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi()),
      sessionControllerProvider.overrideWith(() => _SettableSession(SessionState.signedIn(acct()))),
    ]);
    addTearDown(c.dispose);
    await t.pumpWidget(UncontrolledProviderScope(container: c, child: const PushLifecycle(child: SizedBox())));
    await t.pump();
    (c.read(sessionControllerProvider.notifier) as _SettableSession).set(const SessionState.signedOut());
    await t.pump();
    gated.gate.complete();
    await t.pumpAndSettle();
    expect(messaging.deletes, 1);
  });

  testWidgets('launchPayload throwing does not skip the token sync or the receipt drain', (t) async {
    local = _ThrowingLaunchLocal();
    await ReceiptQueue().add(ReceiptItem(deliveryId: 'd00000000000000000000009', receipt: 'sig.1', event: 'delivered', at: DateTime.utc(2026, 10, 3)));
    await pump(t);
    verify(() => registration.sync()).called(1);
    expect(posted, hasLength(1));
  });

  testWidgets('real wiring: a destination held by an earlier process is opened at startup', (t) async {
    const noticeId = '66f1c0ffee0000000000abcd';
    final mem = <String, String>{
      'juvi.college_id': 'c1',
      'juvi.last_account': 'c1:${acct().id}',
      'juvi.pending_link': jsonEncode(PendingLink(location: '/notices/$noticeId', createdAt: DateTime.now().toUtc(), owner: 'c1:${acct().id}').toJson()),
    };
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    Widget page(String name) => Scaffold(body: Text('at $name'));
    final router = GoRouter(
      initialLocation: '/today',
      routes: [
        GoRoute(path: '/today', builder: (_, _) => page('today')),
        GoRoute(path: '/notices/:id', builder: (_, s) => page('notice ${s.pathParameters['id']}')),
      ],
    );
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: [
        localNotificationsProvider.overrideWithValue(local),
        pushMessagingProvider.overrideWithValue(messaging),
        notificationPermissionProvider.overrideWithValue(permission),
        receiptsProvider.overrideWithValue(receipts),
        pushRegistrationProvider.overrideWithValue(registration),
        noticeActionsProvider.overrideWithValue(actions),
        secureStoreProvider.overrideWithValue(SecureStore(storage)),
        analyticsProvider.overrideWithValue(SpyAnalytics()),
        routerProvider.overrideWithValue(router),
        sessionControllerProvider.overrideWith(() => _Session(SessionState.signedIn(acct()))),
      ],
      child: MaterialApp.router(routerConfig: router, builder: (_, child) => PushLifecycle(child: child!)),
    ));
    await t.pumpAndSettle();
    expect(find.text('at notice $noticeId'), findsOneWidget);
    expect(mem.containsKey('juvi.pending_link'), isFalse);
  });
}
