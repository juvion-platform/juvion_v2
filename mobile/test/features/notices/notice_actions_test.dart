import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:mocktail/mocktail.dart';

class _Notices extends Mock implements NoticesRepository {}

/// Records every tracked event with its props.
class SpyAnalytics implements Analytics {
  final events = <(String, Map<String, Object?>)>[];
  @override
  void track(String event, [Map<String, Object?> props = const {}]) => events.add((event, props));
}

/// Pumps a bare `Consumer` and hands back its `WidgetRef`, as `spaces_repository_test.dart` does.
Future<WidgetRef> pumpRef(WidgetTester t, List<Override> overrides) async {
  late WidgetRef captured;
  await t.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: overrides,
    child: MaterialApp(home: Consumer(builder: (context, ref, _) {
      captured = ref;
      return const SizedBox();
    })),
  ));
  await t.pump();
  return captured;
}

void main() {
  late _Notices repo;
  late AppDatabase db;
  late SpyAnalytics analytics;
  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() {
    repo = _Notices();
    db = AppDatabase.memory();
    analytics = SpyAnalytics();
  });
  tearDown(() => db.close());

  List<Override> overrides() => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(analytics),
      ];

  testWidgets('online: waits for the server, tracks {late, method} and queues nothing', (t) async {
    when(() => repo.acknowledge('n1', any()))
        .thenAnswer((_) async => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: true, method: 'hold', offline: false));
    final ref = await pumpRef(t, overrides());

    expect(await acknowledgeNotice(ref, 'n1', AckMethod.hold, comment: '  '), AckOutcome.sent);

    final input = verify(() => repo.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.offline, isFalse);
    expect(input.comment, isNull);
    expect(analytics.events.single.$1, 'notice.acknowledged');
    expect(analytics.events.single.$2, {'noticeId': 'n1', 'late': true, 'method': 'hold'});
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('online failure is rethrown, nothing is queued and nothing is tracked', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.', status: 500));
    final ref = await pumpRef(t, overrides());

    await expectLater(acknowledgeNotice(ref, 'n1', AckMethod.confirm), throwsA(isA<ApiFailure>()));
    expect(await db.pendingActions(), isEmpty);
    expect(analytics.events, isEmpty);
  });

  testWidgets('offline: queues one notice.ack with offline and a UTC clientAt, and marks it pending', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    final ref = await pumpRef(t, overrides());

    expect(await acknowledgeNotice(ref, 'n1', AckMethod.confirm, comment: 'Noted'), AckOutcome.queued);
    expect(await acknowledgeNotice(ref, 'n1', AckMethod.confirm), AckOutcome.queued);

    final queued = await db.pendingActions();
    expect(queued, hasLength(1));
    expect(queued.single.type, 'notice.ack');
    expect(queued.single.payload['noticeId'], 'n1');
    expect(queued.single.payload['method'], 'confirm');
    expect(queued.single.payload['comment'], 'Noted');
    expect(queued.single.payload['offline'], isTrue);
    expect(DateTime.parse(queued.single.payload['clientAt'] as String).isUtc, isTrue);
    expect(await ref.read(pendingAcksProvider.future), {'n1'});
  });

  testWidgets('dismiss tracks notice.dismissed', (t) async {
    when(() => repo.dismiss('n2')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 5));
    final ref = await pumpRef(t, overrides());

    await dismissNotice(ref, 'n2');
    expect(analytics.events.single.$1, 'notice.dismissed');
    expect(analytics.events.single.$2, {'noticeId': 'n2'});
  });
}
