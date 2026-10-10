import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/analytics/batching_analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/sync/sync_worker.dart';
import 'package:juvi/features/notices/notice_actions.dart';

/// Drains queued writes when connectivity returns or the app resumes; records
/// `app.opened`; flushes queued analytics when the app goes to the background. Wraps `MaterialApp.router` in `JuviApp` (`lib/app/app.dart`).
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
      // Unconditional, and deliberately *not* folded into `_drain`'s `sent > 0` invalidate below:
      // `meProvider` is the only source of the pending-deletion banner (`deletionRequestedAt` on
      // `GET /me`), and a request made on the public web page creates no local action to send — so a
      // drain that sends nothing would leave a request made while this app sat warm in the
      // background invisible until some unrelated invalidate. The stream re-runs with
      // `copyWithPrevious`, so this is not a visible reload; offline, the refresh fails into the
      // existing `markStale` path and the cached document still drives the banner.
      ref.invalidate(meProvider);
      unawaited(_drain());
    }
    if (state == AppLifecycleState.paused) {
      final analytics = ref.read(analyticsProvider);
      if (analytics is BatchingAnalytics) unawaited(analytics.flush());
    }
  }

  Future<void> _drain() => _inFlight ??= _runDrain().whenComplete(() => _inFlight = null);

  Future<void> _runDrain() async {
    try {
      final db = await ref.read(appDatabaseProvider.future);
      final me = await ref.read(meRepositoryProvider.future);
      final spaces = await ref.read(spacesRepositoryProvider.future);
      final notices = await ref.read(noticesRepositoryProvider.future);
      final result = await SyncWorker(db, me, spaces, notices).drain();
      // Sent or dropped, a drained `notice.ack` no longer shows "Will send when online".
      ref.invalidate(pendingAcksProvider);
      if (result.sent > 0) ref..invalidate(meProvider)..invalidate(spacesProvider)..invalidate(attentionProvider);
      // I2/M8: a replayed notice.ack changes what S04, the attention sheet and a
      // channel's tiles show for it, whether it was sent or dropped (e.g. a replayed
      // 404 NOTICE_NOT_FOUND). Routed through `NoticeActions.refresh` (its own
      // container-scoped `Ref`, captured when the keepAlive provider was built) rather
      // than calling `refreshNotices(ref)` directly: this `ref` is `SyncLifecycle`'s
      // `WidgetRef`, a different type than the `Ref` `refreshNotices` takes.
      if (result.ackedNoticeIds.isNotEmpty) ref.read(noticeActionsProvider).refresh();
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
