import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi/features/me/settings_screen.dart';
import 'package:juvi/shared/widgets/app_shell.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';

class _Storage extends Mock implements FlutterSecureStorage {}

class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
}

/// The 409 body the backend actually sends (`deletion-service.ts:139`). The banner must never
/// render this text — the copy is the app's own, through `context.l10n` (AC5).
const _serverTooLate = 'This deletion is already being processed and can no longer be cancelled.';

const _title = 'Your account is scheduled for deletion';
const _cancel = 'Cancel deletion';
const _tooLate = 'Too late — this deletion is already being processed and can no longer be cancelled.';

/// A `/me` payload with the public-web request recorded on the account (spec §3.5.3).
Map<String, dynamic> _pending({bool pending = true}) => {
      ...meJson,
      'deletionRequestedAt': pending ? '2026-11-03T04:00:00.000Z' : null,
      'deletionRequestedVia': pending ? 'public_web' : null,
    };

void main() {
  late Map<String, String> mem;
  late AppDatabase db;
  final sent = <String>[];

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    mem = {'juvi.access': 'a', 'juvi.refresh': 'r', 'juvi.college_id': 'c1'};
    sent.clear();
    db = AppDatabase.memory();
  });
  tearDown(() => db.close());

  /// The banner is mounted in `AppShell`, above the tab content — so this pumps the real shell
  /// over the real repository, the real Dio and the app's own interceptor wiring, and lands on
  /// `/me/settings` so the Settings surface is what is under test. Only the platform pieces
  /// (secure storage, database, analytics) are stood in for; the adapter is attached to the app's
  /// own Dio. `attentionProvider` is stubbed because the shell's Due badge watches it — a stray
  /// `/attention` call would hit the adapter's `failOnMissingMock`.
  Future<ProviderContainer> pumpShell(WidgetTester t, void Function(DioAdapter) route) async {
    final storage = _Storage();
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    final c = ProviderContainer(retry: (_, _) => null, overrides: [
      secureStoreProvider.overrideWithValue(SecureStore(storage)),
      appDatabaseProvider.overrideWith((_) async => db),
      analyticsProvider.overrideWithValue(_NoopAnalytics()),
      attentionProvider.overrideWith((_) => Stream.value(Cached(AttentionData.fromJson(attentionJson([])), DateTime.now()))),
    ]);
    addTearDown(c.dispose);
    final dio = c.read(dioProvider)..interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
        sent.add('${o.method} ${o.path}');
        h.next(o);
      }));
    route(DioAdapter(dio: dio));
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: MaterialApp.router(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: GoRouter(
            initialLocation: '/me/settings',
            routes: [
              StatefulShellRoute.indexedStack(
                builder: (_, _, shell) => AppShell(navigationShell: shell, kind: 'student'),
                branches: [
                  StatefulShellBranch(routes: [GoRoute(path: '/today', builder: (_, _) => const SizedBox.shrink())]),
                  StatefulShellBranch(routes: [GoRoute(path: '/spaces', builder: (_, _) => const SizedBox.shrink())]),
                  StatefulShellBranch(routes: [
                    GoRoute(path: '/me', builder: (_, _) => const SizedBox.shrink(), routes: [
                      GoRoute(path: 'settings', builder: (_, _) => const SettingsScreen()),
                    ]),
                  ]),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    await t.pumpAndSettle();
    return c;
  }

  // S1 AC7: the banner is driven by `deletionRequestedAt` on GET /me, and a 204 — the server's
  // confirmation that the field is cleared — takes it away.
  testWidgets('a pending request banners Settings, and Cancel clears it', (t) async {
    var deleted = false;
    // `MockServerCallback` runs once, when the mock is *registered* — it configures the reply.
    // Only the data callbacks (`replyCallback*`) run per request, so `/me` answering differently
    // after the cancel has to go through one: a closure over `deleted` in `reply` would be read at
    // registration, and the banner would then be re-lit by the refresh that follows the cancel.
    await pumpShell(t, (a) => a
      ..onGet('/me', (s) => s.replyCallback(200, (_) => _pending(pending: !deleted)))
      ..onDelete(
        '/me/account/deletion-request',
        (s) => s.replyCallback(204, (_) {
          deleted = true;
          return null;
        }),
      ));

    expect(find.text(_title), findsOneWidget);
    expect(find.text(_cancel), findsOneWidget);

    await t.tap(find.text(_cancel));
    await t.pumpAndSettle();

    expect(find.text(_title), findsNothing);
    expect(find.text(_cancel), findsNothing);
    expect(sent, contains('DELETE /me/account/deletion-request'));
  });

  // S1 AC7 / Story 4 AC1: the 409 is the whole reason this is not a lying 204 — the deletion has
  // been claimed and is already committing, so the copy says so and the banner does not go away.
  testWidgets('a 409 says it is too late, in our own words, and the banner stays', (t) async {
    await pumpShell(t, (a) => a
      ..onGet('/me', (s) => s.reply(200, _pending()))
      ..onDelete(
        '/me/account/deletion-request',
        (s) => s.reply(409, {
          'error': {'code': 'DELETION_NOT_CANCELLABLE', 'message': _serverTooLate},
        }),
      ));

    await t.tap(find.text(_cancel));
    await t.pumpAndSettle();

    expect(find.text(_tooLate), findsOneWidget);
    expect(find.text(_serverTooLate), findsNothing);
    expect(find.text(_title), findsOneWidget);
    expect(find.text(_cancel), findsOneWidget);
  });

  // Only a 204 counts. Anything else — offline here — leaves the request exactly where it was.
  testWidgets('an offline cancel clears nothing and says why', (t) async {
    await pumpShell(t, (a) => a
      ..onGet('/me', (s) => s.reply(200, _pending()))
      ..onDelete(
        '/me/account/deletion-request',
        (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')),
      ));

    await t.tap(find.text(_cancel));
    await t.pumpAndSettle();

    expect(find.text("You're offline."), findsOneWidget);
    expect(find.text(_title), findsOneWidget);
    expect(find.text(_cancel), findsOneWidget);
  });

  // R61: no request is a real `null` from the server (never an absent key), and it must leave the
  // shell exactly as it was — no banner, no Cancel.
  testWidgets('no pending request means no banner', (t) async {
    await pumpShell(t, (a) => a.onGet('/me', (s) => s.reply(200, _pending(pending: false))));

    expect(find.text(_title), findsNothing);
    expect(find.text(_cancel), findsNothing);
  });
}
