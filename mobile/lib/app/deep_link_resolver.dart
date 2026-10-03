// mobile/lib/app/deep_link_resolver.dart
import 'dart:async';
import 'dart:convert';

import 'package:go_router/go_router.dart';
import 'package:juvi/app/router.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'deep_link_resolver.g.dart';

/// A notification destination waiting for the session (spec §8.5).
class PendingLink {
  const PendingLink({required this.location, required this.createdAt, this.owner});
  factory PendingLink.fromJson(Map<String, dynamic> j) => PendingLink(
        location: j['location'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        owner: j['owner'] as String?,
      );
  final String location;
  final DateTime createdAt;

  /// `<collegeId>:<accountId>` of the account last ready on this phone when the tap came.
  final String? owner;
  Map<String, dynamic> toJson() => {'location': location, 'createdAt': createdAt.toUtc().toIso8601String(), 'owner': owner};
}

/// Signed in, password set and onboarding done: the tabs are reachable.
bool sessionReady(SessionState s) => s is SignedIn && !s.account.mustChangePassword && s.account.onboardingComplete;

String homeOf(SignedIn s) => s.account.kind == 'student' ? '/today' : '/teaching';

/// Where a notification tap goes (spec §8.5; settles the #105 deep-link follow-ups).
///
/// When the session is ready it goes to the home tab and pushes the destination on top,
/// so Back lands on home even on a cold start. Otherwise the destination is held, in
/// memory and in secure storage, while `redirect()` walks the person through sign-in,
/// onboarding or the paused screen; the next ready session uses it once. A held
/// destination older than 24 hours, or meant for another account or institution, is
/// dropped. A notice the signed-in person cannot see opens S04's "not available" state.
class DeepLinkResolver {
  DeepLinkResolver({
    required this._router,
    required this._session,
    required this._store,
    required this._receipts,
    required this._analytics,
    this._now = DateTime.now,
  });

  final GoRouter Function() _router;
  final SessionState Function() _session;
  final SecureStore _store;
  final Receipts _receipts;
  final Analytics _analytics;
  final DateTime Function() _now;

  static const maxAge = Duration(hours: 24);
  PendingLink? _pending;

  /// A tapped notification: post `opened` (the HMAC receipt needs no session), record the
  /// tier, then open its destination.
  Future<void> onNotificationTap(NoticePush p) async {
    unawaited(_receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'opened', at: _now().toUtc())));
    _analytics.track('notification.opened', {'tier': p.tier});
    await open(p.location);
  }

  Future<void> open(String location) async {
    final session = _session();
    if (session is SignedIn && sessionReady(session)) {
      _navigate(session, location);
      return;
    }
    final link = PendingLink(location: location, createdAt: _now().toUtc(), owner: await _store.readLastAccount());
    _pending = link;
    await _store.writePendingLink(jsonEncode(link.toJson()));
  }

  /// On every session change (and once at startup): a ready session uses the held
  /// destination, if it is still fresh and meant for this account.
  Future<void> onSessionChanged(SessionState next) async {
    if (next is! SignedIn || !sessionReady(next)) return;
    final owner = '${await _store.readCollegeId() ?? ''}:${next.account.id}';
    final link = _pending ?? _decode(await _store.readPendingLink());
    await _store.writeLastAccount(owner);
    if (link == null) return;
    _pending = null;
    await _store.clearPendingLink();
    if (_now().toUtc().difference(link.createdAt) > maxAge) return;
    if (link.owner != null && link.owner != owner) return;
    final current = _session();
    if (current is SignedIn && sessionReady(current)) _navigate(current, link.location);
  }

  void _navigate(SignedIn session, String location) {
    final router = _router()..go(homeOf(session));
    unawaited(router.push<void>(location));
  }

  static PendingLink? _decode(String? raw) {
    if (raw == null) return null;
    try {
      return PendingLink.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } on Object {
      return null;
    }
  }
}

@Riverpod(keepAlive: true)
DeepLinkResolver deepLinkResolver(Ref ref) {
  final resolver = DeepLinkResolver(
    router: () => ref.read(routerProvider),
    session: () => ref.read(sessionControllerProvider),
    store: ref.read(secureStoreProvider),
    receipts: ref.read(receiptsProvider),
    analytics: ref.read(analyticsProvider),
  );
  ref.listen<SessionState>(sessionControllerProvider, (_, next) => unawaited(resolver.onSessionChanged(next)));
  return resolver;
}
