import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/reach_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late _Notices repo;
  late Map<String, dynamic> served;

  setUp(() {
    repo = _Notices();
    served = reachJson();
    when(() => repo.reach('n1')).thenAnswer((_) async => NoticeReachData.fromJson(served));
    when(() => repo.pending('n1', group: any(named: 'group'), q: any(named: 'q'), cursor: any(named: 'cursor')))
        .thenAnswer((_) async => PendingPage.fromJson(pendingJson()));
  });

  List<Override> overrides() => [noticesRepositoryProvider.overrideWith((_) async => repo)];

  Future<void> open(WidgetTester t, {double textScale = 1}) async {
    await t.binding.setSurfaceSize(const Size(400, 2400));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(noticeHost(const ReachScreen(noticeId: 'n1'), overrides: overrides(), scroll: false, textScale: textScale));
    await t.pump();
    await t.pump();
  }

  testWidgets('the four counts reconcile to the audience', (t) async {
    await open(t);
    final r = NoticeReachData.fromJson(served);
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi, r.audience);
    for (final (label, n) in [('Acknowledged', 4), ('Seen, not acknowledged', 3), ('Not seen', 2), ('Not on Juvi', 1)]) {
      expect(find.ancestor(of: find.text(label), matching: find.byType(Card)), findsOneWidget);
      expect(find.descendant(of: find.ancestor(of: find.text(label), matching: find.byType(Card)), matching: find.text('$n')), findsOneWidget);
    }
    expect(find.text('of 10 in the audience'), findsOneWidget);
    expect(find.text('3 of 6 acknowledged'), findsOneWidget);
  });

  testWidgets('late acknowledgements, comments and added-later members are listed separately', (t) async {
    await open(t);
    expect(find.text('LATE ACKNOWLEDGEMENTS (1)'), findsOneWidget);
    expect(find.text('Kavya Rao'), findsOneWidget);
    expect(find.text('COMMENTS'), findsOneWidget);
    expect(find.text('Room 204 clashes with lab.'), findsOneWidget);
    expect(find.text('ADDED AFTER PUBLISHING'), findsOneWidget);
    expect(find.text('1 people · 0 acknowledged · 1 seen'), findsOneWidget);
    expect(find.text('Ishaan Gupta'), findsOneWidget);
  });

  testWidgets('the pending list shows last-seen-in-app, filters by group and searches', (t) async {
    await open(t);
    expect(find.text('PENDING (2)'), findsOneWidget);
    expect(find.textContaining('Last in app'), findsOneWidget);
    await t.tap(find.widgetWithText(FilterChip, '2024 Batch · B (1)'));
    await t.pump();
    verify(() => repo.pending('n1', group: '2024 Batch · B')).called(1);
    await t.enterText(find.byType(TextField), 'meera');
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();
    verify(() => repo.pending('n1', group: '2024 Batch · B', q: 'meera')).called(1);
  });

  testWidgets('Copy list puts every pending member on the clipboard as text', (t) async {
    String? copied;
    t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    addTearDown(() => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    await open(t);
    await t.tap(find.text('Copy list'));
    await t.pump();
    await t.pump();
    expect(copied, 'Aditya Nair (24JIT0001) — 2024 Batch · A — Seen, not acknowledged\nMeera Iyer — 2024 Batch · B — Not on Juvi');
    expect(find.text('Copied 2 names'), findsOneWidget);
  });

  testWidgets('a reminder is confirmed, then sent', (t) async {
    when(() => repo.remind('n1')).thenAnswer((_) async => const Reminders(used: 1, max: 2));
    await open(t);
    expect(find.text('Reminders sent: 0 of 2'), findsOneWidget);
    await t.tap(find.widgetWithText(FilledButton, 'Send reminder'));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Send reminder')));
    await t.pump();
    await t.pump();
    verify(() => repo.remind('n1')).called(1);
    expect(find.text('Reminder sent'), findsOneWidget);
  });

  testWidgets('a third reminder is refused with the reason', (t) async {
    served = reachJson(used: 1);
    when(() => repo.remind('n1')).thenThrow(const ApiFailure(ApiErrorCode.reminderLimit, 'A notice can have at most two reminders.', status: 409));
    await open(t);
    await t.tap(find.widgetWithText(FilledButton, 'Send reminder'));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Send reminder')));
    await t.pump();
    await t.pump();
    expect(find.text('A notice can have at most two reminders.'), findsOneWidget);
  });

  testWidgets('with both reminders used, the button is disabled', (t) async {
    served = reachJson(used: 2);
    await open(t);
    expect(t.widget<FilledButton>(find.widgetWithText(FilledButton, 'Send reminder')).onPressed, isNull);
  });

  testWidgets('a student is refused: only the publisher sees reach', (t) async {
    when(() => repo.reach('n1')).thenThrow(const ApiFailure(ApiErrorCode.notPublisher, 'Only the publisher of this notice can do that.', status: 403));
    await open(t);
    expect(find.text('Only the publisher can see who has read this notice.'), findsOneWidget);
  });

  testWidgets('text scale 2.0 lays out without overflow', (t) async {
    await open(t, textScale: 2);
    expect(t.takeException(), isNull);
  });

  // I3: PendingController.loadMore used to rethrow into a dropped Future from a bare
  // `onPressed: () => ... loadMore()`, an uncaught async error with no feedback at all.
  testWidgets('I3: a failed Show more in the pending list shows a message with Retry, and Retry appends the new items', (t) async {
    when(() => repo.pending('n1', group: any(named: 'group'), q: any(named: 'q'), cursor: any(named: 'cursor')))
        .thenAnswer((_) async => PendingPage.fromJson(pendingJson(nextCursor: 'c1')));
    when(() => repo.pending('n1', group: any(named: 'group'), q: any(named: 'q'), cursor: 'c1'))
        .thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.', status: 500));
    await open(t);

    await t.tap(find.widgetWithText(OutlinedButton, 'Show more'));
    await t.pump();
    await t.pump();
    expect(find.text('Something went wrong.'), findsOneWidget);
    expect(t.takeException(), isNull);

    when(() => repo.pending('n1', group: any(named: 'group'), q: any(named: 'q'), cursor: 'c1'))
        .thenAnswer((_) async => PendingPage.fromJson(pendingJson(items: [
              {'name': 'Rohan Shah', 'identifier': null, 'group': '2024 Batch · A', 'state': 'seen', 'lastSeenInApp': null},
            ])));
    await t.tap(find.text('Try again'));
    await t.pump();
    await t.pump();
    expect(find.text('Rohan Shah'), findsOneWidget);
    expect(find.text('Something went wrong.'), findsNothing);
  });

  // M7: without a generation guard, a slower response for an earlier search could land
  // after a faster response for a later one and silently overwrite it.
  testWidgets('M7: a slower response for an older search cannot overwrite a newer one', (t) async {
    final slow = Completer<PendingPage>();
    final fast = Completer<PendingPage>();
    when(() => repo.pending('n1', group: any(named: 'group'), q: 'alpha', cursor: any(named: 'cursor'))).thenAnswer((_) => slow.future);
    when(() => repo.pending('n1', group: any(named: 'group'), q: 'beta', cursor: any(named: 'cursor'))).thenAnswer((_) => fast.future);
    await open(t);

    await t.enterText(find.byType(TextField), 'alpha');
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();
    await t.enterText(find.byType(TextField), 'beta');
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();

    // The newer (beta) request's response lands first...
    fast.complete(PendingPage.fromJson(pendingJson(items: const [
      {'name': 'Beta Person', 'identifier': null, 'group': '2024 Batch · A', 'state': 'seen', 'lastSeenInApp': null},
    ])));
    await t.pump();
    await t.pump();
    // ...then the older (alpha) request's response arrives late and must be discarded.
    slow.complete(PendingPage.fromJson(pendingJson(items: const [
      {'name': 'Alpha Person', 'identifier': null, 'group': '2024 Batch · A', 'state': 'seen', 'lastSeenInApp': null},
    ])));
    await t.pump();
    await t.pump();

    expect(find.text('Beta Person'), findsOneWidget);
    expect(find.text('Alpha Person'), findsNothing);
  });

  // Queued item 7: typing debounces the search by ~300 ms; submitting (the keyboard's
  // search action) still searches immediately, same as before.
  testWidgets('queued item 7: typing debounces search by ~300ms; submitting searches immediately', (t) async {
    await open(t);

    await t.enterText(find.byType(TextField), 'meera');
    await t.pump(const Duration(milliseconds: 100));
    verifyNever(() => repo.pending('n1', group: any(named: 'group'), q: 'meera', cursor: any(named: 'cursor')));
    await t.pump(const Duration(milliseconds: 250));
    verify(() => repo.pending('n1', group: any(named: 'group'), q: 'meera', cursor: any(named: 'cursor'))).called(1);

    await t.enterText(find.byType(TextField), 'aditya');
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();
    verify(() => repo.pending('n1', group: any(named: 'group'), q: 'aditya', cursor: any(named: 'cursor'))).called(1);
  });

  // Queued item 8: Send reminder has no explanation while the notice is still
  // publishing; this is the only disabled-reminder case that gets one (an exhausted
  // budget and an archived notice both already explain themselves elsewhere).
  testWidgets('queued item 8: Send reminder explains itself while the notice is still publishing', (t) async {
    served = reachJson(status: 'publishing');
    await open(t);
    final button = t.widget<FilledButton>(find.widgetWithText(FilledButton, 'Send reminder'));
    expect(button.onPressed, isNull);
    expect(find.byTooltip('You can send a reminder once this notice is published.'), findsOneWidget);
  });

  // M2: ReachScreen._remind used to invalidate noticeReachProvider in its `finally`
  // block outside the `mounted` guard — popping mid-request threw the same StateError
  // I1 covers for notice actions.
  testWidgets('M2: popping Reach while a reminder request is pending does not throw', (t) async {
    final ready = Completer<Reminders>();
    when(() => repo.remind('n1')).thenAnswer((_) => ready.future);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const Scaffold(body: Text('Today'))),
      GoRoute(path: '/reach', builder: (_, _) => const ReachScreen(noticeId: 'n1')),
    ]);
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: overrides(),
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    unawaited(router.push('/reach'));
    await t.pumpAndSettle();

    await t.tap(find.widgetWithText(FilledButton, 'Send reminder'));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Send reminder')));
    await t.pump();

    router.pop();
    await t.pumpAndSettle();
    expect(find.text('Today'), findsOneWidget);

    ready.complete(const Reminders(used: 1, max: 2));
    await t.pump();
    await t.pump();

    expect(t.takeException(), isNull);
  });
}
