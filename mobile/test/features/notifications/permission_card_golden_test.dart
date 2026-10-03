@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/features/notifications/permission_card.dart';

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('PermissionDeniedCard golden ${brightness.name}', (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 320));
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(accent: const Color(0xFF0B5FA5), brightness: brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: Center(child: PermissionDeniedCard(onOpenSettings: () {}, onDismiss: () {}))),
      ));
      await expectLater(find.byType(PermissionDeniedCard), matchesGoldenFile('goldens/permission_card_${brightness.name}.png'));
    });
  }
}
