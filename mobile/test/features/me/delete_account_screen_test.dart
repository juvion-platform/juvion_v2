import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/me/delete_account_screen.dart';
import 'package:juvi/features/me/settings_screen.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/repos/me_repository_test.dart' show meJson;

class _MeRepo extends Mock implements MeRepository {}

class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
}

/// The disclosure AC1 requires, in the words the app shows. The two categories must be
/// distinguishable — a screen that lists only one of them has not told the user what is kept.
const _deleted = [
  'Your Juvi account',
  'Every device signed in to it',
  'Your channel memberships',
  'Notification delivery records',
  'App analytics events',
  'Your own seen and acknowledged state on notices',
];
const _retained = [
  'Academic, attendance, fee and exam records',
  'The audience record of notices already published',
  'Your profile photo, which is your photo in the ERP',
];

Widget _screen({Future<void> Function()? onConfirm}) => ProviderScope(
      retry: (_, _) => null,
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: DeleteAccountScreen(onConfirm: onConfirm),
      ),
    );

/// The two lists plus the field make the screen taller than the default 800x600 test surface,
/// and `ListView` only builds what is within the viewport + cache extent — so the confirm
/// button would not exist to assert on. Grow the surface instead of scrolling to each control.
Future<void> _pump(WidgetTester t, {Future<void> Function()? onConfirm}) async {
  t.view.physicalSize = const Size(900, 1800);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(_screen(onConfirm: onConfirm));
  await t.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('S1 AC1: the Settings row opens the confirmation screen', (t) async {
    t.view.physicalSize = const Size(800, 1600);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final router = GoRouter(
      initialLocation: '/me/settings',
      routes: [
        GoRoute(
          path: '/me/settings',
          builder: (_, _) => const SettingsScreen(),
          routes: [GoRoute(path: 'delete-account', builder: (_, _) => const DeleteAccountScreen())],
        ),
      ],
    );
    await t.pumpWidget(
      ProviderScope(
        retry: (_, _) => null,
        overrides: [
          meProvider.overrideWith((_) async* {
            yield Cached(Me.fromJson(meJson), DateTime.now());
          }),
          meRepositoryProvider.overrideWith((_) async => _MeRepo()),
          analyticsProvider.overrideWithValue(_NoopAnalytics()),
        ],
        child: MaterialApp.router(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('Delete my Juvi account'));
    await t.pumpAndSettle();
    // `SectionHeader` renders its title uppercased (shared/widgets/section_header.dart), so
    // these assert what is actually on screen.
    expect(find.text('DELETED FROM JUVI'), findsOneWidget);
    expect(find.text('KEPT BY YOUR INSTITUTION'), findsOneWidget);
  });

  testWidgets('S1 AC1: both lists render, and they are not the same list', (t) async {
    await _pump(t);
    expect(find.text('DELETED FROM JUVI'), findsOneWidget);
    expect(find.text('KEPT BY YOUR INSTITUTION'), findsOneWidget);
    for (final s in _deleted) {
      expect(find.text(s), findsOneWidget, reason: 'deleted list is missing "$s"');
    }
    for (final s in _retained) {
      expect(find.text(s), findsOneWidget, reason: 'retained list is missing "$s"');
    }
  });

  // S1 AC2: a deliberate second step, not one tap. The phrase is exact — not case-folded,
  // not trimmed — and nothing runs until it is typed.
  testWidgets('S1 AC2: the confirmation is unreachable without the exact phrase', (t) async {
    var deletes = 0;
    await _pump(t, onConfirm: () async => deletes++);
    FilledButton confirm() => t.widget<FilledButton>(find.byType(FilledButton));

    expect(confirm().onPressed, isNull);
    await t.tap(find.byType(FilledButton), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(deletes, 0);

    for (final wrong in ['delete', 'DELETE ', ' DELETE', 'DELET', 'Delete']) {
      await t.enterText(find.byType(TextField), wrong);
      await t.pumpAndSettle();
      expect(confirm().onPressed, isNull, reason: '"$wrong" must not arm the button');
    }

    expect(find.text('Type DELETE to confirm'), findsOneWidget);

    await t.enterText(find.byType(TextField), 'DELETE');
    await t.pumpAndSettle();
    expect(confirm().onPressed, isNotNull);
    await t.tap(find.byType(FilledButton));
    await t.pumpAndSettle();
    expect(deletes, 1);
  });
}
