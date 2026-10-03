import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/home/teaching_shell_screen.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';
import 'package:juvi/features/notifications/permission_card.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/push/push_fixtures.dart';
import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';

// R42: Riverpod 3 retries a failing provider automatically; disable it so a test that
// expects an error state sees it without waiting for retries.
Widget host(Stream<Cached<Me>> Function() stream, {Map<String, dynamic>? attention, Widget home = const TodayShellScreen(), NotificationPermission? permission}) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        if (permission != null) notificationPermissionProvider.overrideWithValue(permission),
        meProvider.overrideWith((ref) => stream()),
        attentionProvider.overrideWith((ref) => Stream.value(Cached(AttentionData.fromJson(attention ?? attentionJson([])), DateTime.now()))),
        pendingAcksProvider.overrideWith((ref) async => <String>{}),
      ],
      child: MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: home),
    );

void main() {
  final me = Me.fromJson(meJson);
  testWidgets('loading shows skeletons, populated shows header and the three empty states', (t) async {
    await t.pumpWidget(
      host(() async* {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        yield Cached(me, DateTime.now());
      }),
    );
    expect(find.byType(Skeleton), findsWidgets);
    await t.pump(const Duration(milliseconds: 100));
    await t.pump(); // the attention stack's first value
    expect(find.text('Aditya'), findsOneWidget);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.text('No classes today'), findsOneWidget);
  });
  testWidgets('due acknowledgements appear in the Attention section', (t) async {
    await t.pumpWidget(host(() async* { yield Cached(me, DateTime.now()); }, attention: attentionJson([cardJson('n1')], dueCount: 4)));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeCard), findsOneWidget);
    expect(find.text('+3 more'), findsOneWidget);
    expect(find.text('See all'), findsOneWidget);
    expect(find.text("You're clear"), findsNothing);
  });
  testWidgets('Teaching shows the attention stack under My acknowledgements', (t) async {
    await t.pumpWidget(host(() async* { yield Cached(me, DateTime.now()); }, attention: attentionJson([cardJson('n1')]), home: const TeachingShellScreen()));
    await t.pump();
    await t.pump();
    expect(find.text('MY ACKNOWLEDGEMENTS'), findsOneWidget);
    expect(find.byType(NoticeCard), findsOneWidget);
  });
  testWidgets('notifications off: the S14 card sits above the attention stack, on Today and Teaching', (t) async {
    SharedPreferences.setMockInitialValues({});
    for (final home in const [TodayShellScreen(), TeachingShellScreen()]) {
      await t.pumpWidget(host(() async* { yield Cached(me, DateTime.now()); }, home: home, permission: FakeNotificationPermission()));
      await t.pumpAndSettle();
      expect(find.byType(PermissionDeniedCard), findsOneWidget);
    }
  });

  testWidgets('offline with cache shows the as-of line', (t) async {
    final asOf = DateTime(2026, 9, 23, 8, 14);
    await t.pumpWidget(host(() async* { yield Cached(me, asOf, stale: true, failure: const ApiFailure(ApiErrorCode.offline, 'x')); }));
    await t.pump();
    expect(find.textContaining('As of 08:14'), findsOneWidget);
  });
  testWidgets('error without cache shows retry', (t) async {
    await t.pumpWidget(host(() => Stream.error(const ApiFailure(ApiErrorCode.internal, 'boom'))));
    await t.pump();
    expect(find.text('Try again'), findsOneWidget);
  });
}
