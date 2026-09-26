@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/system/deactivated_screen.dart';
import 'package:juvi/features/system/paused_screen.dart';
import 'package:juvi/features/system/update_required_screen.dart';

class _S extends SessionController {
  _S(this.s); final SessionState s;
  @override SessionState build() => s;
}

Widget host(SessionState s, Widget screen, Brightness b) => ProviderScope(overrides: [sessionControllerProvider.overrideWith(() => _S(s))],
  child: MaterialApp(theme: buildTheme(brightness: b), localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: screen));

void main() {
  final cases = <(String, SessionState, Widget)>[
    ('deactivated', const SessionState.deactivated(supportContact: SupportContact(name: 'Exam Office', phone: '040-1')), const DeactivatedScreen()),
    ('paused', const SessionState.paused('Juvi is paused for maintenance until Monday 8:00.'), const PausedScreen()),
    ('update_required', const SessionState.updateRequired(minVersion: '1.2.0', storeUrl: 'https://play.google.com/'), const UpdateRequiredScreen()),
  ];
  for (final (name, state, screen) in cases) {
    for (final b in Brightness.values) {
      testWidgets('$name ${b.name}', (t) async {
        await t.binding.setSurfaceSize(const Size(390, 780));
        await t.pumpWidget(host(state, screen, b));
        await t.pump();
        await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/${name}_${b.name}.png'));
      });
    }
  }
}
