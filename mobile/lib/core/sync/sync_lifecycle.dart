import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/sync/sync_worker.dart';

/// Drains queued writes when connectivity returns or the app resumes; records
/// `app.opened`. Wraps `MaterialApp.router` in `JuviApp` (`lib/app/app.dart`).
class SyncLifecycle extends ConsumerStatefulWidget {
  const SyncLifecycle({required this.child, super.key});
  final Widget child;
  @override
  ConsumerState<SyncLifecycle> createState() => _SyncLifecycleState();
}

class _SyncLifecycleState extends ConsumerState<SyncLifecycle> with WidgetsBindingObserver {
  bool _wasOnline = true;

  // I1: the real re-entrancy guard. A fresh `SyncWorker` is built on every trigger, so a
  // guard field on `SyncWorker` itself would never protect anything (it never outlives a
  // single `drain()` call) — reconnect and resume can fire within moments of each other,
  // so every trigger below awaits this same in-flight future instead of starting a
  // second, overlapping drain.
  Future<void>? _inFlight;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.read(analyticsProvider).track('app.opened');
    // I2: also drain at launch, not just on reconnect/resume — an action queued in a
    // previous session (e.g. the app was killed while offline) should go out as soon as
    // possible rather than waiting for the next connectivity change or resume.
    unawaited(_drain());
    ref.listenManual<AsyncValue<bool>>(isOnlineProvider, (_, next) {
      final online = next.value ?? true;
      if (online && !_wasOnline) unawaited(_drain());
      _wasOnline = online;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(analyticsProvider).track('app.opened');
      unawaited(_drain());
    }
  }

  Future<void> _drain() => _inFlight ??= _runDrain().whenComplete(() => _inFlight = null);

  Future<void> _runDrain() async {
    try {
      final db = await ref.read(appDatabaseProvider.future);
      final me = await ref.read(meRepositoryProvider.future);
      final spaces = await ref.read(spacesRepositoryProvider.future);
      final result = await SyncWorker(db, me, spaces).drain();
      if (result.sent > 0) ref..invalidate(meProvider)..invalidate(spacesProvider);
    } on Object catch (_) {
      // Nothing to drain, or storage not ready yet — the next trigger tries again.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
