@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

void main() {
  final now = DateTime.utc(2026, 10, 1, 6);
  for (final brightness in Brightness.values) {
    testWidgets('NoticeCard golden ${brightness.name}', (t) async {
      await t.binding.setSurfaceSize(const Size(400, 520));
      addTearDown(() => t.binding.setSurfaceSize(null));
      await t.pumpWidget(noticeHost(
        Column(key: const ValueKey('cards'), children: [
          NoticeCard(notice: NoticeItem.fromJson(cardJson('n1')), now: now, onAcknowledge: (_) {}),
          const SizedBox(height: 12),
          NoticeCard(notice: NoticeItem.fromJson(cardJson('n2', title: 'Fee payment window', office: 'Finance', priority: 'urgent', state: 'acknowledged', ackAt: '2026-10-03T12:00:00.000Z', late: true)), now: now),
        ]),
        brightness: brightness,
      ));
      await expectLater(find.byKey(const ValueKey('cards')), matchesGoldenFile('goldens/notice_card_${brightness.name}.png'));
    });

    testWidgets('AttentionStack golden ${brightness.name}', (t) async {
      await t.binding.setSurfaceSize(const Size(400, 900));
      addTearDown(() => t.binding.setSurfaceSize(null));
      final data = AttentionData.fromJson(attentionJson([
        cardJson('n1'),
        cardJson('n2', title: 'Hostel curfew update', office: 'Welfare', deadline: '2026-10-01T09:00:00.000Z'),
        cardJson('n3', title: 'Library rules', office: 'Campus Ops', deadline: null, priority: 'routine'),
      ], dueCount: 5));
      await t.pumpWidget(noticeHost(
        AttentionStack(key: const ValueKey('stack'), now: now),
        brightness: brightness,
        overrides: [
          attentionProvider.overrideWith((_) => Stream.value(Cached(data, now))),
          pendingAcksProvider.overrideWith((_) async => {'n2'}),
        ],
      ));
      await t.pump();
      await t.pump();
      await expectLater(find.byKey(const ValueKey('stack')), matchesGoldenFile('goldens/attention_stack_${brightness.name}.png'));
    });
  }
}
