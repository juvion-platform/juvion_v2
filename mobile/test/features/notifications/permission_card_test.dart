import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/features/notifications/permission_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/push/push_fixtures.dart';
import '../notices/notice_actions_test.dart' show SpyAnalytics;

final now = DateTime.utc(2026, 10, 3, 9);

Widget host(FakeNotificationPermission permission, SpyAnalytics analytics) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        notificationPermissionProvider.overrideWithValue(permission),
        analyticsProvider.overrideWithValue(analytics),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: ListView(children: [PermissionCard(now: () => now)])),
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('the card is due while denied, then again 30 days after a dismissal', () {
    expect(permissionCardDue(allowed: false, dismissedAt: null, now: now), isTrue);
    expect(permissionCardDue(allowed: true, dismissedAt: null, now: now), isFalse);
    expect(permissionCardDue(allowed: null, dismissedAt: null, now: now), isFalse);
    expect(permissionCardDue(allowed: false, dismissedAt: now.subtract(const Duration(days: 29, hours: 23)), now: now), isFalse);
    expect(permissionCardDue(allowed: false, dismissedAt: now.subtract(const Duration(days: 30)), now: now), isTrue);
  });

  testWidgets('denied: the card shows once, and Open settings opens the system settings', (t) async {
    final permission = FakeNotificationPermission();
    final analytics = SpyAnalytics();
    await t.pumpWidget(host(permission, analytics));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsOneWidget);
    expect(analytics.events.map((e) => e.$1), ['permission_card.shown']);
    await t.tap(find.text('Open settings'));
    expect(permission.settingsOpened, 1);
  });

  testWidgets('Not now hides it, remembers when, and records the dismissal', (t) async {
    final analytics = SpyAnalytics();
    await t.pumpWidget(host(FakeNotificationPermission(), analytics));
    await t.pumpAndSettle();
    await t.tap(find.text('Not now'));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsNothing);
    expect(analytics.events.map((e) => e.$1), ['permission_card.shown', 'permission_card.dismissed']);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(PermissionCardDismissal.key), now.toIso8601String());
  });

  testWidgets('dismissed 10 days ago: still hidden', (t) async {
    SharedPreferences.setMockInitialValues({PermissionCardDismissal.key: now.subtract(const Duration(days: 10)).toIso8601String()});
    final analytics = SpyAnalytics();
    await t.pumpWidget(host(FakeNotificationPermission(), analytics));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsNothing);
    expect(analytics.events, isEmpty);
  });

  testWidgets('dismissed 31 days ago: shown again', (t) async {
    SharedPreferences.setMockInitialValues({PermissionCardDismissal.key: now.subtract(const Duration(days: 31)).toIso8601String()});
    await t.pumpWidget(host(FakeNotificationPermission(), SpyAnalytics()));
    await t.pumpAndSettle();
    expect(find.text('Notifications are off'), findsOneWidget);
  });

  testWidgets('allowed: no card', (t) async {
    await t.pumpWidget(host(FakeNotificationPermission(granted: true), SpyAnalytics()));
    await t.pumpAndSettle();
    expect(find.byType(PermissionDeniedCard), findsNothing);
  });

  testWidgets('text scale 2.0 lays out without overflow', (t) async {
    await t.pumpWidget(MediaQuery(data: const MediaQueryData(textScaler: TextScaler.linear(2)), child: host(FakeNotificationPermission(), SpyAnalytics())));
    await t.pumpAndSettle();
    expect(find.text('Open settings'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
