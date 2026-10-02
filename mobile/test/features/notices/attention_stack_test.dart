import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';
import 'notice_actions_test.dart' show SpyAnalytics;

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late _Notices repo;
  late AppDatabase db;
  late Map<String, dynamic> served;
  final now = DateTime.utc(2026, 10, 1, 6);

  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() {
    repo = _Notices();
    db = AppDatabase.memory();
    served = attentionJson([]);
    when(repo.cachedAttention).thenAnswer((_) async => null);
    when(repo.attention).thenAnswer((_) async => Cached(AttentionData.fromJson(served), DateTime.now()));
  });
  tearDown(() => db.close());

  List<Override> overrides() => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(SpyAnalytics()),
      ];

  Future<void> pumpStack(WidgetTester t) async {
    await t.pumpWidget(noticeHost(AttentionStack(now: now), overrides: overrides()));
    await t.pump();
    await t.pump();
  }

  Future<void> confirmAck(WidgetTester t, String title) async {
    await t.tap(find.descendant(of: find.ancestor(of: find.text(title), matching: find.byType(Card)), matching: find.byType(AckControl)));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
    await t.pump();
  }

  testWidgets("nothing due shows You're clear", (t) async {
    await pumpStack(t);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.byType(Card), findsNothing);
  });

  testWidgets('shows at most three due items in the server order, then a +N more pill', (t) async {
    served = attentionJson([
      cardJson('n1', title: 'Exam timetable'),
      cardJson('n2', title: 'Fee notice', deadline: '2026-10-05T11:30:00.000Z'),
      cardJson('n3', title: 'Library rules', deadline: null),
    ], dueCount: 5);
    await pumpStack(t);
    expect(find.byType(Card), findsNWidgets(3));
    final ys = ['Exam timetable', 'Fee notice', 'Library rules'].map((s) => t.getTopLeft(find.text(s)).dy).toList();
    expect(ys[0], lessThan(ys[1]));
    expect(ys[1], lessThan(ys[2]));
    expect(find.text('+2 more'), findsOneWidget);
  });

  testWidgets('no pill when every due item is shown', (t) async {
    served = attentionJson([cardJson('n1'), cardJson('n2')]);
    await pumpStack(t);
    expect(find.byType(Card), findsNWidgets(2));
    expect(find.textContaining('more'), findsNothing);
  });

  testWidgets('online: the card stays, busy, until the server confirms; then it leaves', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    final reply = Completer<AckRecord>();
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) => reply.future);
    await pumpStack(t);

    await confirmAck(t, 'Exam timetable');
    expect(find.text('Exam timetable'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    served = attentionJson([]);
    reply.complete(AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false));
    await t.pump();
    await t.pump();
    await t.pump();
    expect(find.text('Exam timetable'), findsNothing);
    expect(find.text("You're clear"), findsOneWidget);
  });

  testWidgets('online failure restores the card with a message', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong. Please try again.', status: 500));
    await pumpStack(t);

    await confirmAck(t, 'Exam timetable');
    await t.pump();
    expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
    expect(find.text('Exam timetable'), findsOneWidget);
    expect(find.text('Hold to acknowledge'), findsOneWidget);
  });

  testWidgets('offline: the acknowledgement is queued and the card says Will send when online', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    await pumpStack(t);

    await confirmAck(t, 'Exam timetable');
    await t.pump();
    await t.pump();
    expect(find.text('Will send when online'), findsOneWidget);
    expect(find.text('Hold to acknowledge'), findsNothing);
    expect((await db.pendingActions()).single.type, 'notice.ack');
  });

  testWidgets('a hold on a card acknowledges it and never opens the notice', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    final reply = Completer<AckRecord>();
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) => reply.future);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => Scaffold(body: ListView(children: [AttentionStack(now: now)]))),
      GoRoute(path: '/notices/:id', builder: (_, s) => Text('detail ${s.pathParameters['id']}')),
    ]);
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: overrides(),
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    await t.pump();
    await t.pump();

    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 1250));
    await g.up();
    await t.pump();
    verify(() => repo.acknowledge('n1', any())).called(1);
    expect(find.text('detail n1'), findsNothing);

    served = attentionJson([]);
    reply.complete(AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'hold', offline: false));
    await t.pumpAndSettle();
    expect(find.text('detail n1'), findsNothing);
    expect(find.text("You're clear"), findsOneWidget);
  });

  testWidgets('a failure with nothing cached offers a retry', (t) async {
    when(repo.attention).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.'));
    await pumpStack(t);
    expect(find.text('Try again'), findsOneWidget);
  });
}
