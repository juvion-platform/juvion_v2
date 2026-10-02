import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/shared/format.dart';

import 'host.dart';

void main() {
  final start = DateTime.utc(2026, 10);
  final deadline = DateTime.utc(2026, 10, 5);

  test('remaining depletes from 1 to 0 across the window and stays 0 after it', () {
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: start), 1);
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 2)), closeTo(0.75, 1e-9));
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: deadline), 0);
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 9)), 0);
    expect(DeadlineRing.remaining(deadline: deadline, now: DateTime.utc(2026, 10, 2)), 1);
  });

  testWidgets('shows the time left, and the due time to a screen reader', (t) async {
    await t.pumpWidget(noticeHost(DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 2))));
    expect(find.text('3d'), findsOneWidget);
    expect(find.bySemanticsLabel('Acknowledge by ${dayMonthTime(deadline)}'), findsOneWidget);
    await t.pumpWidget(noticeHost(DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 4, 19))));
    expect(find.text('5h'), findsOneWidget);
  });

  testWidgets('after the deadline it says so', (t) async {
    await t.pumpWidget(noticeHost(DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 6))));
    expect(find.text('!'), findsOneWidget);
    expect(find.bySemanticsLabel('Deadline passed ${dayMonthTime(deadline)}'), findsOneWidget);
  });
}
