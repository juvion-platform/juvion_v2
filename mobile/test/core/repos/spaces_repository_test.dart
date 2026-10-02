import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// riverpod 3.4.3 moved `Override` out of the main flutter_riverpod.dart barrel; see misc.dart.
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' show JuviApi;
import 'package:mocktail/mocktail.dart';

import 'notices_fixtures.dart';

class _Spaces extends Mock implements SpacesRepository {}

const channel = SpaceChannel(
  id: 'c2',
  name: 'CS202 OS · A',
  about: 'About CS202',
  scopeType: 'course_offering',
  templateCode: 'course',
  role: 'member',
  muted: false,
  memberCount: 60,
  archived: false,
);

final DateTime seededAsOf = DateTime.parse('2026-09-23T08:14:00+05:30').toUtc();

Map<String, dynamic> spacesDoc({required bool muted}) => {
      'groups': [
        {
          'key': 'courses',
          'title': 'My Courses',
          'channels': [
            {
              'id': 'c2',
              'name': 'CS202 OS · A',
              'about': 'About CS202',
              'scopeType': 'course_offering',
              'templateCode': 'course',
              'role': 'member',
              'muted': muted,
              'memberCount': 60,
              'archived': false,
              'nextClassAt': null,
              'nextClassLabel': null,
            },
          ],
        },
      ],
      'asOf': '2026-09-23T08:14:00+05:30',
    };

/// Pumps a bare `Consumer` under a `ProviderScope` with the given overrides and hands
/// back its `WidgetRef`, so `toggleMute` (which takes a `WidgetRef`, matching every other
/// call site) can be exercised directly, the same way a screen's `ref` would call it.
Future<WidgetRef> pumpRef(WidgetTester t, List<Override> overrides) async {
  late WidgetRef captured;
  await t.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: overrides,
    child: MaterialApp(
      home: Consumer(builder: (context, ref, _) {
        captured = ref;
        return const SizedBox();
      }),
    ),
  ));
  await t.pump();
  return captured;
}

void main() {
  test('channel detail parses its notices through the generated client, nulls included', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    DioAdapter(dio: dio).onGet('/channels/c3', (s) => s.reply(200, {
          'id': 'c3', 'name': 'CSE 2024', 'about': 'Batch space', 'scopeType': 'batch', 'templateCode': 'batch',
          'status': 'active', 'memberCount': 120, 'replyRule': 'announcement_only', 'defaultPriority': 'important',
          'role': 'member', 'muted': false, 'canPost': false, 'canReply': false, 'whoCanPost': 'Class teachers',
          'linkedObject': {'type': 'batch', 'id': null},
          'notices': [cardJson('n1', deadline: null)],
        }));
    final db = AppDatabase.memory();
    addTearDown(db.close);
    final repo = ApiSpacesRepository(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), db);
    final detail = (await repo.refreshChannel('c3')).data;
    expect(detail.notices.single.id, 'n1');
    expect(detail.notices.single.deadline, isNull);
    expect(detail.notices.single.isLate, isFalse);
    expect((await repo.cachedChannel('c3'))?.data.notices, hasLength(1));
  });

  test('a channel document cached before notices existed reads as no notices', () {
    final legacy = ChannelDetail.fromJson({
      'id': 'c3', 'name': 'CSE 2024', 'about': 'Batch space', 'scopeType': 'batch', 'templateCode': 'batch',
      'status': 'active', 'memberCount': 120, 'replyRule': 'announcement_only', 'defaultPriority': 'important',
      'role': 'member', 'muted': false, 'canPost': false, 'canReply': false, 'whoCanPost': 'Class teachers',
    });
    expect(legacy.notices, isEmpty);
  });

  testWidgets('a 500 from setMuted restores the cached muted value and the error surfaces', (t) async {
    final repo = _Spaces();
    final db = AppDatabase.memory();
    addTearDown(db.close);
    await db.writeDoc('spaces', spacesDoc(muted: false), seededAsOf);
    when(() => repo.setMuted('c2', true)).thenAnswer((_) async => throw const ApiFailure(ApiErrorCode.internal, 'Server exploded'));

    final ref = await pumpRef(t, [
      appDatabaseProvider.overrideWith((_) async => db),
      spacesRepositoryProvider.overrideWith((_) async => repo),
    ]);

    await expectLater(() => toggleMute(ref, channel), throwsA(isA<ApiFailure>()));

    final doc = await db.readDoc('spaces');
    final channels = ((doc!.json['groups'] as List).first as Map)['channels'] as List;
    expect((channels.first as Map)['muted'], isFalse);
    expect(doc.asOf, seededAsOf);
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('offline still enqueues the pending action and keeps the optimistic state', (t) async {
    final repo = _Spaces();
    final db = AppDatabase.memory();
    addTearDown(db.close);
    await db.writeDoc('spaces', spacesDoc(muted: false), seededAsOf);
    when(() => repo.setMuted('c2', true)).thenAnswer((_) async => throw const ApiFailure(ApiErrorCode.offline, "You're offline."));

    final ref = await pumpRef(t, [
      appDatabaseProvider.overrideWith((_) async => db),
      spacesRepositoryProvider.overrideWith((_) async => repo),
    ]);

    await toggleMute(ref, channel);

    final doc = await db.readDoc('spaces');
    final channels = ((doc!.json['groups'] as List).first as Map)['channels'] as List;
    expect((channels.first as Map)['muted'], isTrue);

    final pending = await db.pendingActions();
    expect(pending, hasLength(1));
    expect(pending.single.type, 'channel.mute');
    expect(pending.single.payload, {'channelId': 'c2'});
  });

  testWidgets('a second toggle of the same channel is ignored while the first is in flight', (t) async {
    final repo = _Spaces();
    final db = AppDatabase.memory();
    addTearDown(db.close);
    await db.writeDoc('spaces', spacesDoc(muted: false), seededAsOf);
    when(() => repo.setMuted('c2', true)).thenAnswer((_) async {});

    final ref = await pumpRef(t, [
      appDatabaseProvider.overrideWith((_) async => db),
      spacesRepositoryProvider.overrideWith((_) async => repo),
    ]);

    // Both calls are made before either awaits anything (Dart runs an async function
    // synchronously up to its first `await`), so the second sees the guard already set
    // by the first and returns immediately without calling the repository again.
    await Future.wait([toggleMute(ref, channel), toggleMute(ref, channel)]);

    verify(() => repo.setMuted('c2', true)).called(1);
  });
}
