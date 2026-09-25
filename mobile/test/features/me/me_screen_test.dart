import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/me/devices_screen.dart';
import 'package:juvi/features/me/me_screen.dart';
import 'package:juvi/features/me/settings_screen.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/repos/me_repository_test.dart' show meJson;

class _MeRepo extends Mock implements MeRepository {}

class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
}

const _boom = ApiFailure(ApiErrorCode.internal, 'Server exploded', status: 500);

Widget _host(Widget screen, MeRepository repo) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        meProvider.overrideWith((_) async* {
          yield Cached(Me.fromJson(meJson), DateTime.now());
        }),
        meRepositoryProvider.overrideWith((_) async => repo),
        analyticsProvider.overrideWithValue(_NoopAnalytics()),
      ],
      child: MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: screen),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  // Minor (c): a non-offline failure used to revert (settings) or do nothing (devices)
  // with no message.
  testWidgets('a failed settings change says why', (t) async {
    final repo = _MeRepo();
    when(() => repo.updateSettings(any())).thenThrow(_boom);
    await t.pumpWidget(_host(const SettingsScreen(), repo));
    await t.pumpAndSettle();
    await t.tap(find.text('Routine'));
    await t.pumpAndSettle();
    expect(find.text('Server exploded'), findsOneWidget);
  });

  testWidgets('a failed device sign-out says why', (t) async {
    final repo = _MeRepo();
    when(repo.devices).thenAnswer((_) async => [
          DeviceRow.fromJson(const {'sessionId': 's1', 'deviceName': 'Pixel 8', 'platform': 'android', 'appVersion': '1.0.0', 'lastActiveAt': '2026-09-23T08:00:00Z', 'isCurrent': true}),
          DeviceRow.fromJson(const {'sessionId': 's2', 'deviceName': 'iPad', 'platform': 'ios', 'appVersion': '1.0.0', 'lastActiveAt': '2026-09-22T08:00:00Z', 'isCurrent': false}),
        ]);
    when(() => repo.revokeDevice('s2')).thenThrow(_boom);
    when(repo.revokeOtherDevices).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    await t.pumpWidget(_host(const DevicesScreen(), repo));
    await t.pumpAndSettle();
    await t.tap(find.byIcon(Icons.logout));
    await t.pumpAndSettle();
    expect(find.text('Server exploded'), findsOneWidget);
    await t.pump(const Duration(seconds: 5)); // let the first snackbar time out
    await t.pumpAndSettle();
    await t.tap(find.byType(OutlinedButton));
    await t.pumpAndSettle();
    expect(find.text("You're offline."), findsOneWidget);
  });

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
