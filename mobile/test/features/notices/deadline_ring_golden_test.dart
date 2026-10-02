@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';

import 'host.dart';

void main() {
  final start = DateTime.utc(2026, 10);
  final deadline = DateTime.utc(2026, 10, 5);
  for (final brightness in Brightness.values) {
    testWidgets('DeadlineRing golden ${brightness.name}', (t) async {
      await t.binding.setSurfaceSize(const Size(260, 80));
      addTearDown(() => t.binding.setSurfaceSize(null));
      await t.pumpWidget(noticeHost(
        Row(
          key: const ValueKey('rings'),
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 1, 6)),
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 3)),
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 4, 21)),
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 6)),
          ],
        ),
        brightness: brightness,
      ));
      await expectLater(find.byKey(const ValueKey('rings')), matchesGoldenFile('goldens/deadline_ring_${brightness.name}.png'));
    });
  }
}
