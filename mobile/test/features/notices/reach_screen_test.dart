import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
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
}
