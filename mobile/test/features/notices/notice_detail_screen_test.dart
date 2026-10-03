import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/minute_clock.dart';
import 'package:juvi/features/notices/notice_detail_screen.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/features/notices/widgets/linked_text.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';
import 'notice_actions_test.dart' show SpyAnalytics;

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late _Notices repo;
  late AppDatabase db;
  late SpyAnalytics analytics;
  late List<Uri> launched;
  late Map<String, dynamic> served;
  final now = DateTime.utc(2026, 10, 1, 6);

  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() {
    repo = _Notices();
    db = AppDatabase.memory();
    analytics = SpyAnalytics();
    launched = [];
    served = detailJson('n1');
    when(() => repo.cachedDetail(any())).thenAnswer((_) async => null);
    when(() => repo.detail('n1')).thenAnswer((_) async => Cached(NoticeDetail.fromJson(served), DateTime.now()));
    when(() => repo.markSeen('n1')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 6));
    when(repo.cachedAttention).thenAnswer((_) async => null);
    when(repo.attention).thenAnswer((_) async => Cached(AttentionData.fromJson(attentionJson([])), DateTime.now()));
  });
  tearDown(() => db.close());

  List<Override> overrides({bool online = true}) => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(analytics),
        isOnlineProvider.overrideWith((_) => Stream.value(online)),
        externalLauncherProvider.overrideWithValue((uri) async {
          launched.add(uri);
          return true;
        }),
      ];

  Future<void> open(WidgetTester t, {bool online = true, double textScale = 1}) async {
    await t.pumpWidget(noticeHost(NoticeDetailScreen(noticeId: 'n1', now: now), overrides: overrides(online: online), scroll: false, textScale: textScale));
    await t.pump();
    await t.pump();
  }

  testWidgets('opening tracks notice.seen and marks the notice seen once', (t) async {
    await open(t);
    expect(find.text('Mid-semester exam timetable'), findsOneWidget);
    expect(find.text('Sent to 2024 Batch'), findsOneWidget);
    expect(find.text('See who has read it'), findsNothing);
    verify(() => repo.markSeen('n1')).called(1);
    expect(analytics.events.first.$1, 'notice.seen');
    expect(analytics.events.first.$2, {'noticeId': 'n1'});
  });

  testWidgets('a notice already seen is not marked again', (t) async {
    served = {...detailJson('n1'), 'state': 'seen', 'seenAt': '2026-09-30T05:00:00.000Z'};
    await open(t);
    verifyNever(() => repo.markSeen(any()));
  });

  testWidgets('a notice not sent to this person is not available, with no retry', (t) async {
    when(() => repo.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.', status: 404));
    await open(t);
    expect(find.text('This notice is not available'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  // M1: `forbidden` is one of the repository's goneNoticeCodes (notices_repository.dart)
  // just like noticeNotFound, so the screen must treat it the same way instead of
  // falling to the generic FailureView, whose retry could never succeed for either.
  testWidgets('access revoked (forbidden) is also not available, with no retry (M1)', (t) async {
    when(() => repo.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.forbidden, 'You no longer have access.', status: 403));
    await open(t);
    expect(find.text('This notice is not available'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  // Queued item 5: a screen-level pass at R3 with a populated cache, complementing the
  // repository-level test in notices_repository_test.dart.
  testWidgets('a cached notice is dropped from view when the refresh comes back NOTICE_NOT_FOUND (R3, screen-level)', (t) async {
    await db.writeDoc(ApiNoticesRepository.detailKey('n1'), detailJson('n1'), DateTime.utc(2026, 9, 30));
    when(() => repo.cachedDetail('n1')).thenAnswer((_) async {
      final doc = await db.readDoc(ApiNoticesRepository.detailKey('n1'));
      return doc == null ? null : Cached(NoticeDetail.fromJson(doc.json), doc.asOf);
    });
    when(() => repo.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.', status: 404));

    await open(t);

    expect(find.text('This notice is not available'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
    expect(await db.readDoc(ApiNoticesRepository.detailKey('n1')), isNull);
  });

  // M6: S04's deadline ring used to freeze at the time the screen opened; it must now
  // tick the same way NoticeCard's does (notice_card_test.dart has the identical case).
  testWidgets('without an explicit clock, the deadline ring watches the shared minute clock so it ticks (M6)', (t) async {
    final controller = StreamController<DateTime>();
    addTearDown(controller.close);
    await t.pumpWidget(noticeHost(
      const NoticeDetailScreen(noticeId: 'n1'),
      overrides: [...overrides(), minuteClockProvider.overrideWith((_) => controller.stream)],
      scroll: false,
    ));
    await t.pump();
    await t.pump();

    controller.add(DateTime.utc(2026, 10, 1, 6));
    await t.pump();
    await t.pump();
    expect(find.descendant(of: find.byType(DeadlineRing), matching: find.text('2d')), findsOneWidget);

    controller.add(DateTime.utc(2026, 10, 3, 10));
    await t.pump();
    await t.pump();
    expect(find.descendant(of: find.byType(DeadlineRing), matching: find.text('1h')), findsOneWidget);
  });

  // I1: `_acknowledge` used to call back into its own WidgetRef after the acknowledge
  // await resolved; popping the screen mid-request made that throw an uncaught
  // StateError, and — worse — the offline enqueue never happened either, since
  // notice_actions.dart's old refreshNotice/invalidate calls ran first and threw.
  testWidgets('I1: popping S04 while an offline acknowledgement is pending still queues exactly one notice.ack, with no uncaught error', (t) async {
    final ready = Completer<AckRecord>();
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) => ready.future);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const Scaffold(body: Text('Today'))),
      GoRoute(path: '/notices/:id', builder: (_, s) => NoticeDetailScreen(noticeId: s.pathParameters['id']!, now: now)),
    ]);
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: overrides(),
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    unawaited(router.push('/notices/n1'));
    await t.pumpAndSettle();

    await t.tap(find.byType(AckControl));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
    await t.pump();

    router.pop();
    await t.pumpAndSettle();
    expect(find.text('Today'), findsOneWidget);

    ready.completeError(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    await t.pump();
    await t.pump();

    expect(t.takeException(), isNull);
    final queued = await db.pendingActions();
    expect(queued, hasLength(1));
    expect(queued.single.type, 'notice.ack');
    expect(queued.single.payload['noticeId'], 'n1');
  });

  testWidgets('acknowledging with a comment sends it, then shows the acknowledgement', (t) async {
    served = detailJson('n1', ackCommentAllowed: true);
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) async {
      served = {...detailJson('n1', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z'), 'ackComment': 'Room clash'};
      return AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false, comment: 'Room clash');
    });
    await open(t);
    await t.enterText(find.byType(TextField), 'Room clash');
    await t.tap(find.byType(AckControl));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
    await t.pump();
    await t.pump();
    await t.pump();
    final input = verify(() => repo.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.method, AckMethod.confirm);
    expect(input.comment, 'Room clash');
    expect(find.textContaining('Acknowledged'), findsOneWidget);
    expect(find.text('Your comment: Room clash'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('a late acknowledgement is flagged Late', (t) async {
    served = detailJson('n1', state: 'acknowledged', ackAt: '2026-10-03T12:00:00.000Z', late: true);
    await open(t);
    expect(find.textContaining('Late'), findsOneWidget);
  });

  testWidgets('an archived notice is read-only and marked Archived', (t) async {
    served = detailJson('n1', archived: true);
    await open(t);
    expect(find.textContaining('Archived'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('offline, attachments are disabled and say Available when online', (t) async {
    served = detailJson('n1', attachments: [pdfAttachment]);
    await open(t, online: false);
    expect(find.text('timetable.pdf'), findsOneWidget);
    expect(find.text('Available when online'), findsOneWidget);
    await t.tap(find.text('timetable.pdf'));
    await t.pump();
    verifyNever(() => repo.attachmentUrl(any(), any()));
  });

  testWidgets('online, an attachment opens its signed URL outside the app', (t) async {
    served = detailJson('n1', attachments: [pdfAttachment]);
    when(() => repo.attachmentUrl('n1', 'colleges/c1/notices/7f3a')).thenAnswer((_) async => Uri.parse('https://s3.test/signed'));
    await open(t);
    expect(find.text('240 KB'), findsOneWidget);
    await t.tap(find.text('timetable.pdf'));
    await t.pump();
    await t.pump();
    expect(launched, [Uri.parse('https://s3.test/signed')]);
  });

  testWidgets('a notice that needs no acknowledgement can be dismissed', (t) async {
    served = detailJson('n1', ackRequired: false, deadline: null);
    when(() => repo.dismiss('n1')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 6));
    await open(t);
    expect(find.byType(AckControl), findsNothing);
    await t.tap(find.text('Dismiss'));
    await t.pump();
    verify(() => repo.dismiss('n1')).called(1);
    expect(analytics.events.map((e) => e.$1), contains('notice.dismissed'));
  });

  // Queued item 2: dismiss (unlike acknowledge) has no offline queue — it is existing,
  // online-only behaviour that a failure, offline included, is rethrown for the caller
  // to show, not silently dropped.
  testWidgets('offline, dismiss is refused with a message and nothing is tracked', (t) async {
    served = detailJson('n1', ackRequired: false, deadline: null);
    when(() => repo.dismiss('n1')).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    await open(t);
    await t.tap(find.text('Dismiss'));
    await t.pump();
    expect(find.text('This needs a connection.'), findsOneWidget);
    expect(find.text('Dismiss'), findsOneWidget);
    expect(analytics.events.map((e) => e.$1), isNot(contains('notice.dismissed')));
  });

  testWidgets('the publisher sees the reach button', (t) async {
    served = detailJson('n1', isPublisher: true);
    await open(t);
    expect(find.text('See who has read it'), findsOneWidget);
  });

  testWidgets('links in the body are detected', (t) async {
    expect(LinkedText.segments('See https://jit.example/exams. Thanks').map((s) => s.$2?.toString()), [null, 'https://jit.example/exams', null]);
    await open(t);
    expect(find.byType(LinkedText), findsOneWidget);
  });

  testWidgets('text scale 2.0 lays out without overflow', (t) async {
    await t.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => t.binding.setSurfaceSize(null));
    served = detailJson('n1', ackCommentAllowed: true, attachments: [pdfAttachment]);
    await open(t, textScale: 2);
    expect(t.takeException(), isNull);
  });
}
