import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/minute_clock.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

void main() {
  final now = DateTime.utc(2026, 10, 1, 6);
  NoticeItem item(String id, {String state = 'received', String? ackAt, bool late = false, bool archived = false, bool ackRequired = true, String? deadline = '2026-10-03T11:30:00.000Z'}) =>
      NoticeItem.fromJson(cardJson(id, state: state, ackAt: ackAt, late: late, archived: archived, ackRequired: ackRequired, deadline: deadline));

  testWidgets('a due card shows office, priority, the deadline ring and the AckControl', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1'), now: now, onAcknowledge: (_) {})));
    expect(find.text('Exam Section · Important'), findsOneWidget);
    expect(find.byType(DeadlineRing), findsOneWidget);
    expect(find.byType(AckControl), findsOneWidget);
    expect(find.textContaining('Acknowledge by'), findsOneWidget);
  });

  testWidgets('an acknowledged late card says so and offers no control', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1', state: 'acknowledged', ackAt: '2026-10-03T12:00:00.000Z', late: true), now: now, onAcknowledge: (_) {})));
    expect(find.textContaining('Acknowledged'), findsOneWidget);
    expect(find.textContaining('Late'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
    expect(find.byType(DeadlineRing), findsNothing);
  });

  testWidgets('an archived card is read-only and marked Archived', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1', archived: true), now: now, onAcknowledge: (_) {})));
    expect(find.text('Archived'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('a queued acknowledgement shows Will send when online', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1'), pendingAck: true, now: now, onAcknowledge: (_) {})));
    expect(find.text('Will send when online'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('tiles mark new, due, acknowledged and archived notices', (t) async {
    await t.pumpWidget(noticeHost(Column(children: [
      NoticeTile(notice: item('a', ackRequired: false, deadline: null), now: now),
      NoticeTile(notice: item('b', deadline: null), now: now),
      NoticeTile(notice: item('c', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z'), now: now),
      NoticeTile(notice: item('d', archived: true), now: now),
    ])));
    expect(find.text('New'), findsOneWidget);
    expect(find.text('Due'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    expect(find.text('Archived'), findsOneWidget);
  });

  testWidgets('a card at text scale 2.0 lays out without overflow', (t) async {
    await t.binding.setSurfaceSize(const Size(360, 900));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1'), now: now, onAcknowledge: (_) {}), textScale: 2));
    expect(t.takeException(), isNull);
  });

  testWidgets('without an explicit clock, the card watches the shared minute clock so its ring updates on tick', (t) async {
    final controller = StreamController<DateTime>();
    addTearDown(controller.close);
    await t.pumpWidget(noticeHost(
      NoticeCard(notice: item('n1'), onAcknowledge: (_) {}),
      overrides: [minuteClockProvider.overrideWith((_) => controller.stream)],
    ));

    controller.add(DateTime.utc(2026, 10, 1, 6));
    await t.pump();
    await t.pump();
    expect(find.descendant(of: find.byType(DeadlineRing), matching: find.text('2d')), findsOneWidget);

    controller.add(DateTime.utc(2026, 10, 3, 10));
    await t.pump();
    await t.pump();
    expect(find.descendant(of: find.byType(DeadlineRing), matching: find.text('1h')), findsOneWidget);
  });
}
