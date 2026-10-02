import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/sheet_page.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/notices/attention_sheet.dart';
import 'package:juvi/features/notices/widgets/due_badge.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

class _Notices extends Mock implements NoticesRepository {}

class _Session extends SessionController {
  _Session(this.kind);
  final String kind;
  @override
  SessionState build() => SessionState.signedIn(Me.fromJson(meJson).account.copyWith(kind: kind, onboardingComplete: true));
}

void main() {
  late _Notices repo;

  setUp(() {
    repo = _Notices();
    when(() => repo.list(any(), office: any(named: 'office'), cursor: any(named: 'cursor')))
        .thenAnswer((_) async => const NoticePage(items: []));
    when(() => repo.cachedList(any())).thenAnswer((_) async => null);
  });
  setUpAll(() => registerFallbackValue(NoticeSegment.due));

  List<Override> overrides({int dueCount = 5, String kind = 'student'}) => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        attentionProvider.overrideWith((_) => Stream.value(Cached(AttentionData.fromJson(attentionJson([cardJson('n1')], dueCount: dueCount)), DateTime.now()))),
        pendingAcksProvider.overrideWith((_) async => <String>{}),
        sessionControllerProvider.overrideWith(() => _Session(kind)),
      ];

  Future<void> pumpSheet(WidgetTester t, {int dueCount = 5, String kind = 'student', Widget? extra}) async {
    await t.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(noticeHost(
      Column(children: [?extra, const Expanded(child: AttentionSheet())]),
      overrides: overrides(dueCount: dueCount, kind: kind),
      scroll: false,
    ));
    await t.pump();
    await t.pump();
  }

  NoticeItem item(String id, {String office = 'Exam Section'}) => NoticeItem.fromJson(cardJson(id, office: office, title: 'Notice $id'));

  testWidgets('the Due segment count equals the tab badge', (t) async {
    await pumpSheet(t, extra: const DueBadge(child: Icon(Icons.today)));
    expect(find.text('Due (5)'), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('5')), findsOneWidget);
  });

  testWidgets('Due lists the due notices; empty Due is clear', (t) async {
    when(() => repo.list(NoticeSegment.due)).thenAnswer((_) async => const NoticePage(items: []));
    await pumpSheet(t, dueCount: 0);
    expect(find.text('Due (0)'), findsOneWidget);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('0')), findsNothing);
  });

  testWidgets('All reaches every notice, a page at a time', (t) async {
    when(() => repo.list(NoticeSegment.all)).thenAnswer((_) async => NoticePage(items: [item('a'), item('b')], nextCursor: 'c1'));
    when(() => repo.list(NoticeSegment.all, cursor: 'c1')).thenAnswer((_) async => NoticePage(items: [item('c')]));
    await pumpSheet(t);
    await t.tap(find.text('All'));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeTile), findsNWidgets(2));
    await t.tap(find.text('Show more'));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeTile), findsNWidgets(3));
    expect(find.text('Show more'), findsNothing);
  });

  // I3/queued item 6: NoticeListState.failure used to be computed but never shown, so a
  // failed "Show more" silently reoffered the same button with no explanation.
  testWidgets('a failed Show more shows a message with Retry, and Retry then appends the new items', (t) async {
    when(() => repo.list(NoticeSegment.all)).thenAnswer((_) async => NoticePage(items: [item('a')], nextCursor: 'c1'));
    when(() => repo.list(NoticeSegment.all, cursor: 'c1')).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.', status: 500));
    await pumpSheet(t);
    await t.tap(find.text('All'));
    await t.pump();
    await t.pump();

    await t.tap(find.text('Show more'));
    await t.pump();
    await t.pump();
    expect(find.text('Something went wrong.'), findsOneWidget);
    expect(find.byType(NoticeTile), findsOneWidget);
    expect(t.takeException(), isNull);

    when(() => repo.list(NoticeSegment.all, cursor: 'c1')).thenAnswer((_) async => NoticePage(items: [item('b')]));
    await t.tap(find.text('Try again'));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeTile), findsNWidgets(2));
    expect(find.text('Something went wrong.'), findsNothing);
  });

  testWidgets('Published by me is not offered to students', (t) async {
    await pumpSheet(t);
    expect(find.text('Published by me'), findsNothing);
  });

  testWidgets('Published by me is offered to faculty', (t) async {
    await pumpSheet(t, kind: 'faculty');
    expect(find.text('Published by me'), findsOneWidget);
  });

  testWidgets('the office filter narrows the segment', (t) async {
    when(() => repo.list(NoticeSegment.done)).thenAnswer((_) async => NoticePage(items: [item('a'), item('b', office: 'Finance')]));
    when(() => repo.list(NoticeSegment.done, office: 'Finance')).thenAnswer((_) async => NoticePage(items: [item('b', office: 'Finance')]));
    await pumpSheet(t);
    await t.tap(find.text('Done'));
    await t.pump();
    await t.pump();
    expect(find.text('All offices'), findsOneWidget);
    await t.tap(find.widgetWithText(FilterChip, 'Finance'));
    await t.pump();
    await t.pump();
    verify(() => repo.list(NoticeSegment.done, office: 'Finance')).called(1);
    expect(find.byType(NoticeTile), findsOneWidget);
  });

  testWidgets('offline, a segment shows its cached first page with the as-of time', (t) async {
    when(() => repo.list(NoticeSegment.due)).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    when(() => repo.cachedList(NoticeSegment.due)).thenAnswer((_) async => Cached(NoticePage(items: [item('a')]), DateTime(2026, 10, 1, 8, 14)));
    await pumpSheet(t);
    expect(find.byType(NoticeTile), findsOneWidget);
    expect(find.textContaining('As of 08:14'), findsOneWidget);
  });

  testWidgets('/attention opens as a modal sheet and returns to the calling screen', (t) async {
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const Scaffold(body: Text('Today'))),
      GoRoute(path: '/attention', pageBuilder: (_, s) => SheetPage<void>(key: s.pageKey, child: const AttentionSheet())),
    ]);
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: overrides(),
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    unawaited(router.push('/attention'));
    await t.pumpAndSettle();
    expect(find.byType(AttentionSheet), findsOneWidget);
    expect(find.byType(BottomSheet), findsOneWidget);
    router.pop();
    await t.pumpAndSettle();
    expect(find.byType(AttentionSheet), findsNothing);
    expect(find.text('Today'), findsOneWidget);
  });
}
