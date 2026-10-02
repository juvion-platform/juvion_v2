import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
// `NoticeDetail` is ambiguous with the app model of the same name from
// `juvi/core/models/notices.dart`; this file only needs `JuviApi` from here.
import 'package:juvi_api/juvi_api.dart' hide NoticeDetail;
import 'package:mocktail/mocktail.dart';

import 'notices_fixtures.dart';

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late AppDatabase db;
  late ApiNoticesRepository repo;
  late List<RequestOptions> sent;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    sent = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      sent.add(o);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio);
    db = AppDatabase.memory();
    repo = ApiNoticesRepository(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), dio, db);
  });
  tearDown(() => db.close());

  test('attention parses the contract payload, nulls included, and caches it', () async {
    adapter.onGet('/attention', (s) => s.reply(200, attentionJson([cardJson('n1'), cardJson('n2', deadline: null)], dueCount: 5)));
    final fresh = await repo.attention();
    expect(fresh.data.dueCount, 5);
    expect(fresh.data.items.map((c) => c.id), ['n1', 'n2']);
    expect(fresh.data.items.first.deadline, DateTime.utc(2026, 10, 3, 11, 30));
    expect(fresh.data.items.last.deadline, isNull);
    expect(fresh.data.items.first.ackAt, isNull);
    expect(fresh.data.items.first.needsAck, isTrue);
    expect((await repo.cachedAttention())?.data.dueCount, 5);
  });

  test('list sends the segment and caches only the unfiltered first page', () async {
    adapter
      ..onGet('/notices', (s) => s.reply(200, {'items': [cardJson('n1')], 'nextCursor': 'abc'}), queryParameters: {'segment': 'all'})
      ..onGet('/notices', (s) => s.reply(200, {'items': [cardJson('n2')], 'nextCursor': null}), queryParameters: {'segment': 'all', 'cursor': 'abc'});
    final first = await repo.list(NoticeSegment.all);
    expect(first.nextCursor, 'abc');
    final second = await repo.list(NoticeSegment.all, cursor: 'abc');
    expect(second.items.single.id, 'n2');
    expect(second.nextCursor, isNull);
    expect((await repo.cachedList(NoticeSegment.all))?.data.items.single.id, 'n1');
    expect(await repo.cachedList(NoticeSegment.due), isNull);
  });

  test('detail parses attachments and the flattened acknowledgement, and caches it', () async {
    adapter.onGet('/notices/n1', (s) => s.reply(200, detailJson('n1', attachments: [pdfAttachment])));
    final d = (await repo.detail('n1')).data;
    expect(d.attachments.single.name, 'timetable.pdf');
    expect(d.ackMethod, isNull);
    expect(d.ackClientAt, isNull);
    expect(d.item.id, 'n1');
    expect((await repo.cachedDetail('n1'))?.data.body, contains('mid-semester'));
  });

  test('markSeen moves a cached received notice to seen', () async {
    adapter
      ..onGet('/notices/n1', (s) => s.reply(200, detailJson('n1')))
      ..onPost('/notices/n1/seen', (s) => s.reply(200, {'seenAt': '2026-10-01T04:00:00.000Z'}));
    await repo.detail('n1');
    expect(await repo.markSeen('n1'), DateTime.utc(2026, 10, 1, 4));
    final cached = (await repo.cachedDetail('n1'))!.data;
    expect(cached.state, 'seen');
    expect(cached.seenAt, DateTime.utc(2026, 10, 1, 4));
  });

  test('acknowledge sends method, offline and a UTC clientAt, omits a null comment, and updates the caches', () async {
    adapter
      ..onGet('/attention', (s) => s.reply(200, attentionJson([cardJson('n1'), cardJson('n2')], dueCount: 4)))
      ..onGet('/notices/n1', (s) => s.reply(200, detailJson('n1')))
      ..onPost('/notices/n1/ack', (s) => s.reply(200, ackJson(offline: true, clientAt: '2026-10-01T04:59:00.000Z')), data: Matchers.any);
    await repo.attention();
    await repo.detail('n1');
    final record = await repo.acknowledge(
      'n1',
      AckInput(method: AckMethod.hold, offline: true, clientAt: DateTime.utc(2026, 10, 1, 4, 59)),
    );
    expect(record.method, 'hold');
    expect(record.offline, isTrue);
    final body = jsonDecode(sent.last.data as String) as Map<String, dynamic>;
    expect(body, {'method': 'hold', 'offline': true, 'clientAt': '2026-10-01T04:59:00.000Z'});
    final cached = (await repo.cachedDetail('n1'))!.data;
    expect(cached.state, 'acknowledged');
    expect(cached.ackAt, DateTime.utc(2026, 10, 1, 5));
    expect(cached.ackOffline, isTrue);
    final attention = (await repo.cachedAttention())!.data;
    expect(attention.items.map((i) => i.id), ['n2']);
    expect(attention.dueCount, 3);
  });

  test('a 409 ALREADY_ACKNOWLEDGED returns the existing record from error.ack', () async {
    adapter.onPost(
      '/notices/n1/ack',
      (s) => s.reply(409, {
        'error': {'code': 'ALREADY_ACKNOWLEDGED', 'message': 'You have already acknowledged this notice.', 'ack': ackJson(late: true, method: 'confirm')},
      }),
      data: Matchers.any,
    );
    final record = await repo.acknowledge('n1', const AckInput(method: AckMethod.hold));
    expect(record.method, 'confirm');
    expect(record.isLate, isTrue);
  });

  test('a 409 NOTICE_ARCHIVED on acknowledge is a failure', () async {
    adapter.onPost(
      '/notices/n1/ack',
      (s) => s.reply(409, {'error': {'code': 'NOTICE_ARCHIVED', 'message': 'This notice has been archived.'}}),
      data: Matchers.any,
    );
    await expectLater(
      repo.acknowledge('n1', const AckInput(method: AckMethod.confirm)),
      throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.noticeArchived).having((f) => f.status, 'status', 409)),
    );
  });

  test('a notice the caller did not receive is NOTICE_NOT_FOUND', () async {
    adapter.onGet('/notices/zz', (s) => s.reply(404, {'error': {'code': 'NOTICE_NOT_FOUND', 'message': 'This notice is not available.'}}));
    await expectLater(repo.detail('zz'), throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.noticeNotFound)));
  });

  test('attachmentUrl sends the key as one encoded path segment', () async {
    adapter.onGet(
      '/notices/n1/attachments/colleges%2Fc1%2Fnotices%2F7f3a',
      (s) => s.reply(200, {'url': 'https://s3.test/signed?x=1', 'expiresAt': '2026-10-01T05:05:00.000Z'}),
    );
    final url = await repo.attachmentUrl('n1', 'colleges/c1/notices/7f3a');
    expect(url.host, 's3.test');
    expect(sent.last.uri.path, '/v1/notices/n1/attachments/colleges%2Fc1%2Fnotices%2F7f3a');
  });

  test('reach parses counts that reconcile, and the late, comment and added-later lists', () async {
    adapter.onGet('/notices/n1/reach', (s) => s.reply(200, reachJson()));
    final r = await repo.reach('n1');
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi, r.audience);
    expect(r.lateCount, 1);
    expect(r.comments.single.identifier, isNull);
    expect(r.addedLater.items.single.at, isNull);
    expect(r.reminders.lastAt, isNull);
  });

  test('pending passes group, search and cursor', () async {
    adapter.onGet(
      '/notices/n1/reach/pending',
      (s) => s.reply(200, pendingJson()),
      queryParameters: {'group': '2024 Batch · A', 'q': 'adi', 'cursor': 'c2'},
    );
    final p = await repo.pending('n1', group: '2024 Batch · A', q: 'adi', cursor: 'c2');
    expect(p.items.last.lastSeenInApp, isNull);
    expect(p.groups, hasLength(2));
  });

  test('a student calling reach gets NOT_PUBLISHER', () async {
    adapter.onGet('/notices/n1/reach', (s) => s.reply(403, {'error': {'code': 'NOT_PUBLISHER', 'message': 'Only the publisher of this notice can do that.'}}));
    await expectLater(repo.reach('n1'), throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.notPublisher)));
  });

  test('a third reminder is refused with the reminder budget in error.reminders', () async {
    adapter.onPost(
      '/notices/n1/remind',
      (s) => s.reply(409, {
        'error': {
          'code': 'REMINDER_LIMIT',
          'message': 'A notice can have at most two reminders.',
          'reminders': {'used': 2, 'max': 2, 'lastAt': '2026-10-01T04:00:00.000Z'},
        },
      }),
    );
    try {
      await repo.remind('n1');
      fail('expected REMINDER_LIMIT');
    } on ApiFailure catch (f) {
      expect(f.code, ApiErrorCode.reminderLimit);
      expect(f.message, 'A notice can have at most two reminders.');
      expect(Reminders.fromJson(f.reminders!).exhausted, isTrue);
    }
  });

  test('firstNotice returns the welcome notice and caches it as a detail', () async {
    adapter.onGet('/onboarding/first-notice', (s) => s.reply(200, detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome')));
    final d = await repo.firstNotice();
    expect(d.purpose, 'welcome');
    expect(d.deadline, isNull);
    expect((await repo.cachedDetail('w1'))?.data.title, 'Welcome to Juvi');
  });

  test('noticeDetail drops the cached doc and errors when the refresh is NOTICE_NOT_FOUND', () async {
    final mock = _Notices();
    await db.writeDoc(ApiNoticesRepository.detailKey('n1'), detailJson('n1'), DateTime.utc(2026, 10));
    when(() => mock.cachedDetail('n1')).thenAnswer((_) async {
      final doc = await db.readDoc(ApiNoticesRepository.detailKey('n1'));
      return doc == null ? null : Cached(NoticeDetail.fromJson(doc.json), doc.asOf);
    });
    when(() => mock.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.'));

    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      noticesRepositoryProvider.overrideWith((_) async => mock),
      appDatabaseProvider.overrideWith((_) async => db),
    ]);
    addTearDown(c.dispose);
    c.listen(noticeDetailProvider('n1'), (_, _) {});
    await pumpEventQueue();

    final state = c.read(noticeDetailProvider('n1'));
    expect(state.hasError, isTrue);
    expect((state.error! as ApiFailure).code, ApiErrorCode.noticeNotFound);
    expect(await db.readDoc(ApiNoticesRepository.detailKey('n1')), isNull);
  });

  test('noticeDetail still serves the stale cached doc when the refresh is offline', () async {
    final mock = _Notices();
    await db.writeDoc(ApiNoticesRepository.detailKey('n1'), detailJson('n1'), DateTime.utc(2026, 10));
    when(() => mock.cachedDetail('n1')).thenAnswer((_) async {
      final doc = await db.readDoc(ApiNoticesRepository.detailKey('n1'));
      return doc == null ? null : Cached(NoticeDetail.fromJson(doc.json), doc.asOf);
    });
    when(() => mock.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));

    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      noticesRepositoryProvider.overrideWith((_) async => mock),
      appDatabaseProvider.overrideWith((_) async => db),
    ]);
    addTearDown(c.dispose);
    c.listen(noticeDetailProvider('n1'), (_, _) {});
    await pumpEventQueue();

    final value = c.read(noticeDetailProvider('n1')).value;
    expect(value?.stale, isTrue);
    expect(value?.data.id, 'n1');
    expect(await db.readDoc(ApiNoticesRepository.detailKey('n1')), isNotNull);
  });
}
