import 'dart:async';

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
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi/features/me/pending_deletion_banner.dart';
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

/// The banner's own Cancel button. Its `onPressed` is where "the action is spent" (the 409) and
/// "the action is live again" (a request re-made later) tell each other apart.
TextButton _cancelButton(WidgetTester t) =>
    t.widget<TextButton>(find.ancestor(of: find.text(_cancel), matching: find.byType(TextButton)));

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
    var gets = 0;
    // The invalidate that follows the 204 sends a *second* `GET /me`, and that refetch writes the
    // whole document back — with `deletionRequestedAt: null` of its own. Holding it open is what
    // lets the assertions below read the cache at a moment the refetch cannot yet have written
    // over: the repo's own clear is the only thing that could have left a null there.
    final refetch = Completer<void>();
    addTearDown(() {
      if (!refetch.isCompleted) refetch.complete();
    });
    await pumpShell(t, (a) => a
      ..onGet(
        '/me',
        (s) => s.replyCallbackAsync(200, (_) async {
          final n = gets++;
          if (n > 0) await refetch.future;
          return _pending(pending: n == 0);
        }),
      )
      ..onDelete('/me/account/deletion-request', (s) => s.reply(204, null)));

    // The Settings surface really is what this is standing on (§"the test never asserts anything
    // Settings-specific" — without this the banner assertions would hold over any screen at all).
    expect(find.text('Notifications and quiet hours'), findsOneWidget);
    expect(find.text(_title), findsOneWidget);
    expect(find.text(_cancel), findsOneWidget);

    await t.tap(find.text(_cancel));
    // Frames, not `pumpAndSettle`: the refetch is deliberately held open. `gets == 2` is the proof
    // that the cancel's own `ref.invalidate` has dispatched it, i.e. that the repo's clear — which
    // runs before the invalidate — has already landed.
    for (var i = 0; i < 10 && gets < 2; i++) {
      await t.pump(const Duration(milliseconds: 1));
    }
    expect(sent, contains('DELETE /me/account/deletion-request'));
    expect(gets, 2);

    // …and the request is gone because the 204 *cleared the cached request*. Read here, with the
    // refetch still in flight, because a refetch that landed would rewrite this document and hide
    // whether the clear happened at all: without this timing the assertion below passes even
    // against a repository that never touched the cache. Remove `_clearCachedDeletionRequest` and
    // this is the line that reddens.
    final doc = await db.readDoc('me');
    expect(doc!.json['deletionRequestedAt'], isNull);
    expect(doc.json['deletionRequestedVia'], isNull);

    refetch.complete();
    await t.pumpAndSettle();
    expect(find.text(_title), findsNothing);
    expect(find.text(_cancel), findsNothing);
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
    // The cached request survives the failed cancel too — the *other* half of why the banner is
    // still up, and the half no mock of `/me` can stand in for.
    expect((await db.readDoc('me'))!.json['deletionRequestedAt'], isNotNull);
    // …and the failure path must not have re-fetched `/me` either. `sent` covers the whole life of
    // the shell, and the mock above answers `pending` forever, so a `ref.invalidate(meProvider)`
    // wrongly added to the error branch would be invisible to the document assertion — the cached
    // row would simply be re-fetched as pending again — but shows up here as a second `GET /me`.
    expect(sent.where((s) => s == 'GET /me'), hasLength(1));
    // …and the action is spent: the 409 says the deletion is already committing, so a second tap
    // can only 409 again. A live button under that sentence invites exactly that.
    expect(_cancelButton(t).onPressed, isNull);
  });

  // A 409 is terminal for the request, not for the banner: the element stays mounted (it returns
  // `SizedBox.shrink` when there is nothing to show), so a request cancelled on another device and
  // then re-made would otherwise come back with Cancel already dead.
  testWidgets('a request re-made after a 409 leaves Cancel usable again', (t) async {
    var pending = true;
    final c = await pumpShell(t, (a) => a
      ..onGet('/me', (s) => s.replyCallback(200, (_) => _pending(pending: pending)))
      ..onDelete(
        '/me/account/deletion-request',
        (s) => s.reply(409, {
          'error': {'code': 'DELETION_NOT_CANCELLABLE', 'message': _serverTooLate},
        }),
      ));

    await t.tap(find.text(_cancel));
    await t.pumpAndSettle();
    expect(_cancelButton(t).onPressed, isNull);

    // Cleared (cancelled on another device), then re-requested from the public page.
    pending = false;
    c.invalidate(meProvider);
    await t.pumpAndSettle();
    expect(find.text(_title), findsNothing);

    pending = true;
    c.invalidate(meProvider);
    await t.pumpAndSettle();
    expect(find.text(_title), findsOneWidget);
    expect(_cancelButton(t).onPressed, isNotNull);
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

    // The shell is up and Settings rendered; what is absent is the banner. Without this the test
    // would also pass against a banner that simply never renders anywhere at all.
    expect(find.text('Notifications and quiet hours'), findsOneWidget);
    // …and it is mounted — the banner widget is in the tree and choosing to render nothing, which
    // is the state this asserts, rather than the shell having failed to mount it at all. (That it
    // renders the banner copy when a request *is* pending is the sibling test's half.)
    expect(find.byType(PendingDeletionBanner), findsOneWidget);
    expect(find.text(_title), findsNothing);
    expect(find.text(_cancel), findsNothing);
  });

  // The 204 can land after the widget is gone: a concurrent 401, a deactivation or a paused
  // institution tears the session down, the router redirects, and the shell unmounts while this
  // DELETE is still in flight. `ref.invalidate` asserts the element is still mounted
  // (`ConsumerStatefulElement.invalidate` → `_assertNotDisposed`, package-private in
  // `flutter_riverpod`) and throws a `StateError` out of a `Future` nobody awaits — an unhandled
  // async error on a path that has, from the user's side, already succeeded.
  testWidgets('a 204 arriving after the banner is gone does not throw', (t) async {
    final inFlight = Completer<void>();
    await pumpShell(t, (a) => a
      ..onGet('/me', (s) => s.replyCallback(200, (_) => _pending()))
      ..onDelete(
        '/me/account/deletion-request',
        (s) => s.replyCallbackAsync(204, (_) async {
          await inFlight.future;
          return null;
        }),
      ));

    await t.tap(find.text(_cancel));
    // Frames, not `pumpAndSettle`: the reply is deliberately held open. The tap's future chain has
    // to get all the way to the adapter first — the interceptor mints a device id on the way — so
    // pump until the request is actually out and then assert it is.
    for (var i = 0; i < 10 && !sent.contains('DELETE /me/account/deletion-request'); i++) {
      await t.pump(const Duration(milliseconds: 1));
    }
    expect(sent, contains('DELETE /me/account/deletion-request'));

    // Tear the app down with the request still out — the shell is disposed, the container is not.
    await t.pumpWidget(const SizedBox.shrink());
    inFlight.complete();
    await t.pumpAndSettle();

    expect(t.takeException(), isNull);
  });
}
