import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

import '../../core/repos/me_repository_test.dart' show meJson;

// R42: Riverpod 3 retries a failing provider automatically; disable it so a test that
// expects an error state sees it without waiting for retries.
Widget host(Stream<Cached<Me>> Function() stream) => ProviderScope(
      retry: (_, _) => null,
      overrides: [meProvider.overrideWith((ref) => stream())],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: TodayShellScreen()),
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
    expect(find.text('Aditya'), findsOneWidget);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.text('No classes today'), findsOneWidget);
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
