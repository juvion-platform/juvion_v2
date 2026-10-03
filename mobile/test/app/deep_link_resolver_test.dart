// mobile/test/app/deep_link_resolver_test.dart
import 'dart:async';
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
  const id = '66f1c0ffee0000000000abcd';
  const id2 = '66f1c0ffee0000000000abce';
  const id9 = '66f1c0ffee0000000000abcf';
  late Map<String, String> mem;
  late _Storage storage;
  late SecureStore store;
  late SessionState session;
  late GoRouter router;
  late ValueNotifier<int> refresh;
  late List<String> receipts;
  late SpyAnalytics analytics;
  Completer<String?>? gate;
  var now = DateTime.utc(2026, 10, 3, 9);

  final student = SessionState.signedIn(acct());
  final faculty = SessionState.signedIn(acct(kind: 'faculty'));

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    now = DateTime.utc(2026, 10, 3, 9);
    mem = {'juvi.college_id': 'c1'};
    storage = _Storage();
    gate = null;
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async {
      if (i.namedArguments[#key] == 'juvi.last_account' && gate != null) return gate!.future;
      return mem[i.namedArguments[#key]];
    });
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
    await r.open('/notices/$id');
    await t.pumpAndSettle();
    expect(find.text('at /notices/$id'), findsOneWidget);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
  });

  testWidgets('faculty: Back lands on Teaching', (t) async {
    final r = await pump(t, faculty);
    await r.open('/notices/$id');
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
    await r.open('/notices/$id');
    await t.pumpAndSettle();
    expect(find.text('at /sign-in'), findsOneWidget);
    expect(jsonDecode(mem['juvi.pending_link']!), {'location': '/notices/$id', 'createdAt': '2026-10-03T09:00:00.000Z', 'owner': 'c1:a'});
    await become(t, r, student);
    expect(find.text('at /notices/$id'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
    // Used once: a later session change does not open it again.
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
  });

  testWidgets('a keystore that cannot record the owner does not lose the held tap', (t) async {
    mem['juvi.last_account'] = 'c1:a';
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/$id');
    await t.pumpAndSettle();
    when(() => storage.write(key: 'juvi.last_account', value: any(named: 'value'))).thenAnswer((_) async => throw Exception('keystore'));
    await become(t, r, student);
    expect(find.text('at /notices/$id'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
  });

  testWidgets('held through the password change and onboarding', (t) async {
    final r = await pump(t, SessionState.signedIn(acct(mustChange: true)));
    await r.open('/notices/$id');
    await become(t, r, SessionState.signedIn(acct(step: 2, complete: false)));
    expect(find.text('at /onboarding/2'), findsOneWidget);
    await become(t, r, student);
    expect(find.text('at /notices/$id'), findsOneWidget);
  });

  testWidgets('held while the institution is paused', (t) async {
    final r = await pump(t, const SessionState.paused('Back on Monday'));
    await r.open('/notices/$id');
    await t.pumpAndSettle();
    expect(find.text('at /paused'), findsOneWidget);
    await become(t, r, student);
    expect(find.text('at /notices/$id'), findsOneWidget);
  });

  testWidgets('survives a restart: a new resolver uses the stored destination', (t) async {
    mem['juvi.pending_link'] = jsonEncode(PendingLink(location: '/notices/$id9', createdAt: now.subtract(const Duration(hours: 2))).toJson());
    final r = await pump(t, const SessionState.signedOut());
    await become(t, r, student);
    expect(find.text('at /notices/$id9'), findsOneWidget);
  });

  testWidgets('older than 24 hours: dropped', (t) async {
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/$id');
    now = now.add(const Duration(hours: 24, minutes: 1));
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
  });

  testWidgets('another account, or another institution, signs in: dropped', (t) async {
    mem['juvi.last_account'] = 'c1:someone-else';
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/$id');
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
    expect(mem['juvi.last_account'], 'c1:a');

    mem['juvi.college_id'] = 'c2';
    await become(t, r, const SessionState.signedOut());
    await r.open('/notices/$id2');
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
  });


  testWidgets('only /attention and /notices/<id> open: anything else is refused', (t) async {
    final r = await pump(t, student);
    for (final bad in ['/notices/x/reach', '/notices/abc', '/notices/$id/reach', '/notices/$id?x=1', '/notices/../today', '/today', 'https://evil.test/']) {
      await r.open(bad);
      await t.pumpAndSettle();
      expect(find.text('at /today'), findsOneWidget, reason: bad);
      expect(router.canPop(), isFalse, reason: bad);
    }
    await r.open('/notices/$id');
    await t.pumpAndSettle();
    expect(find.text('at /notices/$id'), findsOneWidget);
  });

  testWidgets('a refused destination is not held while signed out', (t) async {
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/x/reach');
    expect(mem['juvi.pending_link'], isNull);
  });

  testWidgets('a stored destination that fails the check is dropped and cleared', (t) async {
    mem['juvi.pending_link'] = jsonEncode(PendingLink(location: '/notices/x/reach', createdAt: now).toJson());
    final r = await pump(t, const SessionState.signedOut());
    await become(t, r, student);
    expect(find.text('at /today'), findsOneWidget);
    expect(router.canPop(), isFalse);
    expect(mem['juvi.pending_link'], isNull);
  });

  testWidgets('the session turns ready while open() is still reading: pushed exactly once', (t) async {
    final r = await pump(t, const SessionState.signedOut());
    gate = Completer<String?>();
    final opening = r.open('/notices/$id');
    await become(t, r, student);
    gate!.complete('c1:a');
    await opening;
    await t.pumpAndSettle();
    expect(find.text('at /notices/$id'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
    expect(router.canPop(), isFalse);
  });

  testWidgets('two ready emissions back to back push the destination once', (t) async {
    final r = await pump(t, const SessionState.signedOut());
    await r.open('/notices/$id');
    session = student;
    refresh.value++;
    await Future.wait([r.onSessionChanged(student), r.onSessionChanged(student)]);
    await t.pumpAndSettle();
    expect(find.text('at /notices/$id'), findsOneWidget);
    await back(t);
    expect(find.text('at /today'), findsOneWidget);
    expect(router.canPop(), isFalse);
  });

  testWidgets('start(): a link held by an earlier process opens for a session that is already ready', (t) async {
    mem['juvi.last_account'] = 'c1:a';
    mem['juvi.pending_link'] = jsonEncode(PendingLink(location: '/notices/$id', createdAt: now, owner: 'c1:a').toJson());
    final r = await pump(t, student);
    await r.start();
    await t.pumpAndSettle();
    expect(find.text('at /notices/$id'), findsOneWidget);
    expect(mem['juvi.pending_link'], isNull);
  });
}
