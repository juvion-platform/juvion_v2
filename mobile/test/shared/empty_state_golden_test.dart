@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/shared/widgets/empty_state.dart';

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('EmptyState golden ${brightness.name}', (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 300));
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(accent: const Color(0xFF0B5FA5), brightness: brightness),
        home: const Scaffold(body: Center(child: EmptyState(icon: Icons.check_circle_outline, title: "You're clear", hint: 'Nothing needs your attention right now.'))),
      ));
      await expectLater(find.byType(EmptyState), matchesGoldenFile('goldens/empty_state_${brightness.name}.png'));
    });
  }
}
