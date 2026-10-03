import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/deep_link_resolver.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_handlers.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/features/notices/notice_actions.dart';

/// Push in the running app (notifications spec §8.2–§8.5). After the first frame (so the
/// router exists) it initialises the tray with its tap handler, renders foreground
/// messages, routes taps through `DeepLinkResolver`, opens whatever notification launched
/// the app (after any destination held across a restart), registers the push token and
/// drains queued receipts. On resume it re-checks the OS permission and drains again.
/// Reading `deepLinkResolverProvider` here is also what starts the resolver (its session
/// listener and startup check): nothing else reads it.
/// Wraps `MaterialApp.router` in `JuviApp`, inside `SyncLifecycle`.
class PushLifecycle extends ConsumerStatefulWidget {
  const PushLifecycle({required this.child, super.key});
  final Widget child;
  @override
  ConsumerState<PushLifecycle> createState() => _PushLifecycleState();
}

class _PushLifecycleState extends ConsumerState<PushLifecycle> with WidgetsBindingObserver {
  final _subscriptions = <StreamSubscription<Object?>>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
      ..addObserver(this)
      ..addPostFrameCallback((_) => unawaited(_start()));
  }

  void _tap(NoticePush? p) {
    if (p != null) unawaited(ref.read(deepLinkResolverProvider).onNotificationTap(p));
  }

  Future<void> _start() async {
    try {
      final local = ref.read(localNotificationsProvider);
      final messaging = ref.read(pushMessagingProvider);
      final resolver = ref.read(deepLinkResolverProvider);
      await local.init(onTap: (payload) => _tap(NoticePush.fromPayload(payload)));
      if (!mounted) return;
      _subscriptions
        ..add(messaging.foregroundMessages.listen((data) => unawaited(handleForegroundPush(
              data,
              local: local,
              receipts: ref.read(receiptsProvider),
              refresh: () => ref.read(noticeActionsProvider).refresh(),
            ))))
        ..add(messaging.openedMessages.listen((data) => _tap(NoticePush.tryParse(data))));
      final launchPayload = await local.launchPayload();
      final initial = await messaging.initialMessage();
      final launch = NoticePush.fromPayload(launchPayload) ?? (initial == null ? null : NoticePush.tryParse(initial));
      if (!mounted) return;
      // A destination held across a restart first; the notification that launched the app wins.
      await resolver.onSessionChanged(ref.read(sessionControllerProvider));
      _tap(launch);
      unawaited(ref.read(pushRegistrationProvider).sync());
      unawaited(ref.read(receiptsProvider).drain());
    } on Object {
      // Push is best effort; the app works without it.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    // The person may have changed the permission in the system settings (S12, S14).
    unawaited(ref.read(notificationsAllowedProvider.notifier).recheck());
    unawaited(ref.read(receiptsProvider).drain());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final s in _subscriptions) {
      unawaited(s.cancel());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
