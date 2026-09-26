import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/core/sync/sync_lifecycle.dart';
import 'package:mocktail/mocktail.dart';

class _Me extends Mock implements MeRepository {}

class _Spaces extends Mock implements SpacesRepository {}

/// A spy in place of `ConsoleAnalytics` — records every tracked event name.
class _SpyAnalytics implements Analytics {
  final events = <String>[];
  @override
  void track(String event, [Map<String, Object?> props = const {}]) => events.add(event);
}

Widget host({required AppDatabase db, required MeRepository me, required SpacesRepository spaces, required Analytics analytics, required Stream<bool> online}) =>
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        appDatabaseProvider.overrideWith((_) async => db),
        meRepositoryProvider.overrideWith((_) async => me),
        spacesRepositoryProvider.overrideWith((_) async => spaces),
        analyticsProvider.overrideWithValue(analytics),
        isOnlineProvider.overrideWith((_) => online),
      ],
      child: const MaterialApp(home: SyncLifecycle(child: SizedBox.shrink())),
    );

void main() {
  late AppDatabase db;
  late _Me me;
  late _Spaces spaces;
  late _SpyAnalytics analytics;

  setUp(() {
    db = AppDatabase.memory();
    me = _Me();
    spaces = _Spaces();
    analytics = _SpyAnalytics();
  });
  tearDown(() => db.close());

  testWidgets('app.opened is tracked once per launch', (t) async {
    final controller = StreamController<bool>();
    addTearDown(controller.close);
    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    await t.pumpAndSettle();
    expect(analytics.events.where((e) => e == 'app.opened'), hasLength(1));
  });

  testWidgets('an action queued before launch is sent at startup (I2)', (t) async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {});
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    await t.pumpAndSettle();

    verify(() => spaces.setMuted('c1', true)).called(1);
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('an offline to online transition triggers a drain', (t) async {
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {});
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    await t.pumpAndSettle();
    // The launch-time (I2) drain above found nothing queued yet.
    verifyNever(() => spaces.setMuted('c1', true));

    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    controller
      ..add(false)
      ..add(true);
    await t.pumpAndSettle();

    verify(() => spaces.setMuted('c1', true)).called(1);
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('two triggers firing together still send the queued action once (I1)', (t) async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    final ready = Completer<void>();
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) => ready.future);
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream));
    // The launch-time (I2) drain is already running and is now blocked inside
    // `setMuted`, awaiting `ready` — it hasn't reached `removeAction` yet.
    await t.pump();

    // A same-moment offline->online transition must reuse that in-flight drain rather
    // than starting a second, overlapping one (the misleading per-instance guard this
    // replaced never protected against this, since a fresh SyncWorker is built per call).
    controller
      ..add(false)
      ..add(true);
    await t.pump();

    ready.complete();
    await t.pumpAndSettle();

    verify(() => spaces.setMuted('c1', true)).called(1);
    expect(await db.pendingActions(), isEmpty);
  });
}
