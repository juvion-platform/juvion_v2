import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/analytics/batching_analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/core/sync/sync_lifecycle.dart';
import 'package:mocktail/mocktail.dart';

import '../repos/me_repository_test.dart' show meJson;
import '../repos/notices_fixtures.dart';

class _Me extends Mock implements MeRepository {}

class _Spaces extends Mock implements SpacesRepository {}

class _Notices extends Mock implements NoticesRepository {}

/// A spy in place of `BatchingAnalytics` — records every tracked event name.
class _SpyAnalytics implements Analytics {
  final events = <String>[];
  @override
  void track(String event, [Map<String, Object?> props = const {}]) => events.add(event);
}

/// Counts flushes; queues nothing (never signed in).
class _FlushSpy extends BatchingAnalytics {
  _FlushSpy() : super(database: () => Completer<AppDatabase>().future, api: () => throw UnimplementedError(), signedIn: () => false);
  int flushes = 0;
  @override
  Future<void> flush() async => flushes++;
}

Widget host({
  required AppDatabase db,
  required MeRepository me,
  required SpacesRepository spaces,
  required Analytics analytics,
  required Stream<bool> online,
  NoticesRepository? notices,
  bool watchMe = false,
}) =>
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        appDatabaseProvider.overrideWith((_) async => db),
        meRepositoryProvider.overrideWith((_) async => me),
        spacesRepositoryProvider.overrideWith((_) async => spaces),
        noticesRepositoryProvider.overrideWith((_) async => notices ?? _Notices()),
        analyticsProvider.overrideWithValue(analytics),
        isOnlineProvider.overrideWith((_) => online),
      ],
      child: MaterialApp(
        home: SyncLifecycle(
          // `meProvider` is autoDispose, so invalidating it with nothing listening is a no-op —
          // which is why the tests that do not care about `/me` can leave this off. In the app the
          // pending-deletion banner is the listener, and that is the case under test here.
          child: watchMe
              ? Consumer(builder: (_, ref, _) {
                  ref.watch(meProvider);
                  return const SizedBox.shrink();
                })
              : const SizedBox.shrink(),
        ),
      ),
    );

void main() {
  late AppDatabase db;
  late _Me me;
  late _Spaces spaces;
  late _SpyAnalytics analytics;

  setUp(() {
    db = AppDatabase.memory();
    me = _Me();
    spaces = _Spaces();
    analytics = _SpyAnalytics();
  });
  tearDown(() => db.close());

  testWidgets('app.opened is tracked once per launch', (t) async {
    final controller = StreamController<bool>();
    addTearDown(controller.close);
    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    await t.pumpAndSettle();
    expect(analytics.events.where((e) => e == 'app.opened'), hasLength(1));
  });

  testWidgets('going to the background flushes queued analytics (notifications spec §8.7)', (t) async {
    final controller = StreamController<bool>();
    addTearDown(controller.close);
    final spy = _FlushSpy();
    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: spy, online: controller.stream));
    await t.pumpAndSettle();
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    expect(spy.flushes, 1);
  });

  testWidgets('an action queued before launch is sent at startup (I2)', (t) async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {});
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    await t.pumpAndSettle();

    verify(() => spaces.setMuted('c1', true)).called(1);
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('an offline to online transition triggers a drain', (t) async {
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {});
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    await t.pumpAndSettle();
    // The launch-time (I2) drain above found nothing queued yet.
    verifyNever(() => spaces.setMuted('c1', true));

    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    controller
      ..add(false)
      ..add(true);
    await t.pumpAndSettle();

    verify(() => spaces.setMuted('c1', true)).called(1);
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('two triggers firing together still send the queued action once (I1)', (t) async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    final ready = Completer<void>();
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) => ready.future);
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    // The launch-time (I2) drain is already running and is now blocked inside
    // `setMuted`, awaiting `ready` — it hasn't reached `removeAction` yet.
    await t.pump();

    // A same-moment offline->online transition must reuse that in-flight drain rather
    // than starting a second, overlapping one (the misleading per-instance guard this
    // replaced never protected against this, since a fresh SyncWorker is built per call).
    controller
      ..add(false)
      ..add(true);
    await t.pump();

    ready.complete();
    await t.pumpAndSettle();

    verify(() => spaces.setMuted('c1', true)).called(1);
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('a notice.ack queued before launch is replayed at startup', (t) async {
    registerFallbackValue(const AckInput(method: AckMethod.hold));
    final notices = _Notices();
    await db.enqueueAction(PendingAction.create('notice.ack', {'noticeId': 'n1', 'method': 'hold', 'comment': null, 'clientAt': '2026-10-01T04:59:00.000Z', 'offline': true}));
    when(() => notices.acknowledge('n1', any()))
        .thenAnswer((_) async => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'hold', offline: true));
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream, notices: notices));
    await t.pumpAndSettle();

    verify(() => notices.acknowledge('n1', any())).called(1);
    expect(await db.pendingActions(), isEmpty);
  });

  // I2: SyncLifecycle used to invalidate only pendingAcksProvider (plus attention when
  // something was sent) — an open S04 for the replayed notice kept showing the old,
  // un-acknowledged state once the queue cleared.
  testWidgets('after a replayed notice.ack, an open noticeDetailProvider re-reads and shows acknowledged (I2)', (t) async {
    registerFallbackValue(const AckInput(method: AckMethod.hold));
    final notices = _Notices();
    await db.enqueueAction(PendingAction.create(
      'notice.ack',
      {'noticeId': 'n1', 'method': 'hold', 'comment': null, 'clientAt': '2026-10-01T04:59:00.000Z', 'offline': true},
    ));
    var served = detailJson('n1');
    when(() => notices.cachedDetail('n1')).thenAnswer((_) async => Cached(NoticeDetail.fromJson(served), DateTime.now()));
    when(() => notices.detail('n1')).thenAnswer((_) async => Cached(NoticeDetail.fromJson(served), DateTime.now()));
    when(() => notices.acknowledge('n1', any())).thenAnswer((_) async {
      served = detailJson('n1', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z');
      return AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'hold', offline: true);
    });
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: [
        appDatabaseProvider.overrideWith((_) async => db),
        meRepositoryProvider.overrideWith((_) async => me),
        spacesRepositoryProvider.overrideWith((_) async => spaces),
        noticesRepositoryProvider.overrideWith((_) async => notices),
        analyticsProvider.overrideWithValue(analytics),
        isOnlineProvider.overrideWith((_) => controller.stream),
      ],
      // A second widget stands in for an open S04, watching the same provider
      // SyncLifecycle must invalidate once the drain replays n1's acknowledgement.
      child: MaterialApp(home: Column(children: [
        const SyncLifecycle(child: SizedBox.shrink()),
        Consumer(builder: (context, ref, _) {
          final d = ref.watch(noticeDetailProvider('n1')).value?.data;
          return Text(d?.isAcknowledged == true ? 'Acknowledged' : 'Not yet');
        }),
      ])),
    ));
    await t.pumpAndSettle();

    expect(find.text('Acknowledged'), findsOneWidget);
  });

  // M8: a dropped notice.ack (not just a sent one) must still trigger the I2 refresh —
  // the server will never hold this acknowledgement, so "Will send when online" must
  // stop showing for it once the drain gives up.
  testWidgets('a replayed notice.ack dropped on a 404 NOTICE_NOT_FOUND still refreshes the open detail (M8)', (t) async {
    registerFallbackValue(const AckInput(method: AckMethod.hold));
    final notices = _Notices();
    await db.enqueueAction(PendingAction.create(
      'notice.ack',
      {'noticeId': 'n1', 'method': 'hold', 'comment': null, 'clientAt': '2026-10-01T04:59:00.000Z', 'offline': true},
    ));
    when(() => notices.cachedDetail('n1')).thenAnswer((_) async => Cached(NoticeDetail.fromJson(detailJson('n1')), DateTime.now()));
    when(() => notices.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.', status: 404));
    when(() => notices.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.', status: 404));
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: [
        appDatabaseProvider.overrideWith((_) async => db),
        meRepositoryProvider.overrideWith((_) async => me),
        spacesRepositoryProvider.overrideWith((_) async => spaces),
        noticesRepositoryProvider.overrideWith((_) async => notices),
        analyticsProvider.overrideWithValue(analytics),
        isOnlineProvider.overrideWith((_) => controller.stream),
      ],
      // Stands in for an open S04, kept watching noticeDetailProvider('n1') so an
      // invalidate from SyncLifecycle is observable as a second `detail('n1')` call.
      child: MaterialApp(home: Column(children: [
        const SyncLifecycle(child: SizedBox.shrink()),
        Consumer(builder: (context, ref, _) {
          ref.watch(noticeDetailProvider('n1'));
          return const SizedBox.shrink();
        }),
      ])),
    ));
    await t.pumpAndSettle();

    // The drop happens on the very first attempt (a non-offline, non-409 4xx), so the
    // action is gone, and the detail provider was invalidated (a second network read).
    expect(await db.pendingActions(), isEmpty);
    verify(() => notices.detail('n1')).called(greaterThanOrEqualTo(2));
  });

  // 011 S1 AC7 / T21. A deletion requested on the public web page creates no local action, so the
  // `sent > 0` invalidate in `_runDrain` never fires for it — and `meProvider` is where
  // `deletionRequestedAt` lives, and therefore where the banner that tells the person *and* carries
  // the Cancel that makes the grace period mean anything comes from. Without a refresh on resume, a
  // request made while this app sat warm in the background is invisible until some unrelated
  // invalidate happens to come along.
  testWidgets('resuming re-reads /me, so a request made while the app was warm still reaches the banner', (t) async {
    var reads = 0;
    when(() => me.cached()).thenAnswer((_) async => null);
    when(() => me.refresh()).thenAnswer((_) async {
      reads++;
      return Cached(Me.fromJson(meJson), DateTime.now());
    });
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream, watchMe: true));
    await t.pumpAndSettle();
    expect(reads, 1);

    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await t.pumpAndSettle();

    expect(reads, 2);
  });
}
