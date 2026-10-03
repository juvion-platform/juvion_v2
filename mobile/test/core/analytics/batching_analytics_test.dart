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
