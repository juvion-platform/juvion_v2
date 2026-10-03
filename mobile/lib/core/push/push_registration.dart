import 'dart:async';

import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'push_registration.g.dart';

/// Keeps this session's FCM token on the server (notifications spec §8.3, §7.1).
///
/// The token is `PUT` once per process while signed in with notifications allowed, which
/// also covers an app upgrade (an upgrade always starts a new process); again whenever
/// FCM rotates it; again on a denied → allowed change; and again after the next sign-in.
/// Sign-out `DELETE`s it first, while the session is still valid, then deletes the FCM
/// token so the next account on this phone gets a fresh one.
class PushRegistration {
  PushRegistration({
    required this._messaging,
    required this._api,
    required this._signedIn,
    required this._allowed,
  });

  final PushMessaging _messaging;
  final wire.MobileApi Function() _api;
  final bool Function() _signedIn;
  final Future<bool> Function() _allowed;

  /// The token this process registered for the current session.
  String? _registered;

  /// Registrations run one at a time, so two triggers firing together send one PUT. A step
  /// that fails never blocks the ones after it.
  Future<void> _last = Future.value();
  Future<void> _serial(Future<void> Function() step) => _last = _last.then((_) => step()).catchError((Object _) {});

  Future<void> sync() => _serial(() async {
        if (!_messaging.available || !_signedIn() || !await _allowed()) return;
        final token = await _tokenOrNull();
        if (token != null) await _register(token);
      });

  Future<void> onTokenRefresh(String token) => _serial(() async {
        if (!_signedIn() || !await _allowed()) return;
        await _register(token);
      });

  void onSessionChanged(SessionState next) {
    if (next is SignedIn) {
      unawaited(sync());
    } else {
      _registered = null;
    }
  }

  /// Only a real denied → allowed change; the first answer is covered by [sync] itself.
  void onPermissionChanged({required bool? before, required bool? after}) {
    if (before == false && after == true) unawaited(sync());
  }

  /// Sign-out (spec §8.3): best effort on both steps; a failure never blocks the sign-out.
  Future<void> unregister() async {
    _registered = null;
    if (!_messaging.available) return;
    try {
      await _api().clearPushToken();
    } on Object {
      // Revoking the session clears its token on the server anyway.
    }
    try {
      await _messaging.deleteToken();
    } on Object {
      // A stale FCM token is rotated by FCM later.
    }
  }

  Future<String?> _tokenOrNull() async {
    try {
      return await _messaging.token();
    } on Object {
      return null; // No Play services, or the placeholder Firebase project.
    }
  }

  Future<void> _register(String token) async {
    if (token == _registered) return;
    try {
      await _api().registerPushToken(pushTokenRequest: wire.PushTokenRequest.fromJson({'token': token, 'platform': 'android'}));
      _registered = token;
    } on Object {
      // Offline or refused: the next launch, resume-to-allowed or token refresh tries again.
    }
  }
}

@Riverpod(keepAlive: true)
PushRegistration pushRegistration(Ref ref) {
  final messaging = ref.read(pushMessagingProvider);
  final registration = PushRegistration(
    messaging: messaging,
    api: () => ref.read(mobileApiProvider),
    signedIn: () => ref.read(sessionControllerProvider) is SignedIn,
    allowed: () => ref.read(notificationsAllowedProvider.future),
  );
  ref
    ..listen<SessionState>(sessionControllerProvider, (_, next) => registration.onSessionChanged(next))
    ..listen<AsyncValue<bool>>(notificationsAllowedProvider, (prev, next) => registration.onPermissionChanged(before: prev?.value, after: next.value));
  final refreshes = messaging.tokenRefreshes.listen((t) => unawaited(registration.onTokenRefresh(t)));
  ref.onDispose(refreshes.cancel);
  return registration;
}
