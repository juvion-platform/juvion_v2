import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/me/me_screen.dart';

import '../../core/repos/me_repository_test.dart' show meJson;

void main() {
  testWidgets('shows the identity card, settings, devices, about and sign-out entries', (t) async {
    // The full Me list (identity card, settings, devices, change password, about,
    // sign out) is taller than the default 800x600 test surface, and ListView only
    // builds children within the viewport + cache extent — grow the surface so every
    // entry this test checks is actually laid out, instead of scrolling to each one.
    t.view.physicalSize = const Size(800, 1400);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final me = Me.fromJson(meJson);
    await t.pumpWidget(
      ProviderScope(
        retry: (_, _) => null,
        overrides: [
          meProvider.overrideWith((_) async* {
            yield Cached(me, DateTime.now());
          }),
        ],
        child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: MeScreen()),
      ),
    );
    await t.pump();
    expect(find.text('Aditya Nair'), findsOneWidget);
    expect(find.text('24JIT0001'), findsOneWidget);
    expect(find.textContaining('B.Tech'), findsOneWidget);
    for (final label in ['Notifications and quiet hours', 'Devices', 'Change password', 'Sign out']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.textContaining('stays with your institution'), findsOneWidget);
  });
}
