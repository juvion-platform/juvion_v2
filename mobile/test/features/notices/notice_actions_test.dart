import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:mocktail/mocktail.dart';

import '../spaces/channel_screen_test.dart' show channelJson;

class _Notices extends Mock implements NoticesRepository {}

class _Spaces extends Mock implements SpacesRepository {}

/// Records every tracked event with its props.
class SpyAnalytics implements Analytics {
  final events = <(String, Map<String, Object?>)>[];
  @override
  void track(String event, [Map<String, Object?> props = const {}]) => events.add((event, props));
}

/// Pumps a bare `Consumer` inside its own `ProviderContainer` and hands back both: the
/// container so a test can dispose/replace the widget tree while the container (and
/// anything `keepAlive`, like `NoticeActions`) lives on, exactly the scenario I1 covers.
class Harness {
  Harness(this.container);
  final ProviderContainer container;
  NoticeActions get actions => container.read(noticeActionsProvider);
}

Future<Harness> pumpHarness(WidgetTester t, List<Override> overrides) async {
  final container = ProviderContainer(retry: (_, _) => null, overrides: overrides);
  addTearDown(container.dispose);
  await t.pumpWidget(UncontrolledProviderScope(container: container, child: const MaterialApp(home: SizedBox())));
  await t.pump();
  return Harness(container);
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
    final h = await pumpHarness(t, overrides());

    expect(await h.actions.acknowledge('n1', AckMethod.hold, comment: '  '), AckOutcome.sent);

    final input = verify(() => repo.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.offline, isFalse);
    expect(input.comment, isNull);
    expect(analytics.events.single.$1, 'notice.acknowledged');
    expect(analytics.events.single.$2, {'noticeId': 'n1', 'late': true, 'method': 'hold'});
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('online failure is rethrown, nothing is queued and nothing is tracked', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.', status: 500));
    final h = await pumpHarness(t, overrides());

    await expectLater(h.actions.acknowledge('n1', AckMethod.confirm), throwsA(isA<ApiFailure>()));
    expect(await db.pendingActions(), isEmpty);
    expect(analytics.events, isEmpty);
  });

  testWidgets('offline: queues one notice.ack with offline and a UTC clientAt, and marks it pending', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    final h = await pumpHarness(t, overrides());

    expect(await h.actions.acknowledge('n1', AckMethod.confirm, comment: 'Noted'), AckOutcome.queued);
    expect(await h.actions.acknowledge('n1', AckMethod.confirm), AckOutcome.queued);

    final queued = await db.pendingActions();
    expect(queued, hasLength(1));
    expect(queued.single.type, 'notice.ack');
    expect(queued.single.payload['noticeId'], 'n1');
    expect(queued.single.payload['method'], 'confirm');
    expect(queued.single.payload['comment'], 'Noted');
    expect(queued.single.payload['offline'], isTrue);
    expect(DateTime.parse(queued.single.payload['clientAt'] as String).isUtc, isTrue);
    expect(await h.container.read(pendingAcksProvider.future), {'n1'});
    // The repeat call above is sequential (awaited), so it is caught by the
    // pendingAcksProvider check, not the in-flight guard; it still fires analytics once.
    expect(analytics.events.where((e) => e.$1 == 'notice.acknowledged'), hasLength(1));
  });

  // Queued item 1 / M4: two overlapping (not sequentially awaited) offline calls for the
  // same notice must still enqueue, and track, exactly once. Before I1's fix this was a
  // check-then-enqueue race: both calls could pass the `pendingAcksProvider` check before
  // either had actually enqueued anything.
  testWidgets('two overlapping offline acknowledgements for the same notice enqueue and track only once', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    final h = await pumpHarness(t, overrides());

    final first = h.actions.acknowledge('n1', AckMethod.confirm);
    final second = h.actions.acknowledge('n1', AckMethod.confirm);
    expect(await Future.wait([first, second]), [AckOutcome.queued, AckOutcome.queued]);

    expect(await db.pendingActions(), hasLength(1));
    expect(analytics.events.where((e) => e.$1 == 'notice.acknowledged'), hasLength(1));
  });

  // I1 is exercised end-to-end at the screen level, where a widget genuinely unmounts
  // mid-request (notice_detail_screen_test.dart, attention_stack_test.dart): this
  // class's own `_ref` is the provider's container-scoped Ref from the moment
  // `NoticeActions` is built, so there is no widget-mounted/unmounted distinction to
  // exercise here — `acknowledge`/`dismiss` never read a `WidgetRef`.

  testWidgets('dismiss tracks notice.dismissed', (t) async {
    when(() => repo.dismiss('n2')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 5));
    final h = await pumpHarness(t, overrides());

    await h.actions.dismiss('n2');
    expect(analytics.events.single.$1, 'notice.dismissed');
    expect(analytics.events.single.$2, {'noticeId': 'n2'});
  });

  // I2: refreshNotice used to omit channelProvider, so a channel's inline notice tiles
  // kept showing Due/New after the user acknowledged from the channel screen itself.
  testWidgets('I2: an online acknowledge invalidates channelProvider', (t) async {
    when(() => repo.acknowledge('n1', any()))
        .thenAnswer((_) async => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false));
    final spaces = _Spaces();
    when(() => spaces.cachedChannel('c3')).thenAnswer((_) async => null);
    when(() => spaces.refreshChannel('c3')).thenAnswer((_) async => Cached(ChannelDetail.fromJson(channelJson(const [])), DateTime.now()));
    final h = await pumpHarness(t, [...overrides(), spacesRepositoryProvider.overrideWith((_) async => spaces)]);

    // Keeps channelProvider('c3') alive and watched, the same way a mounted ChannelScreen
    // would, so an invalidate actually triggers an observable second fetch.
    h.container.listen(channelProvider('c3'), (_, _) {}, fireImmediately: true);
    await t.pump();
    verify(() => spaces.refreshChannel('c3')).called(1);

    await h.actions.acknowledge('n1', AckMethod.confirm);
    await t.pump();

    verify(() => spaces.refreshChannel('c3')).called(1);
  });
}
