import 'dart:async';

import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'session_controller.g.dart';

@Riverpod(keepAlive: true)
class SessionController extends _$SessionController {
  @override
  SessionState build() => const SessionState.loading();

  /// Called once at bootstrap. Never signs the user out for being offline.
  Future<void> restore() async {
    final store = ref.read(secureStoreProvider);
    final tokens = await store.readTokens();
    if (tokens == null) {
      state = const SessionState.signedOut();
      return;
    }
    final db = await ref.read(appDatabaseProvider.future);
    final cached = await db.readDoc('account');
    if (cached != null) state = SessionState.signedIn(AccountSummary.fromJson(cached.json));
    // A fresh /me is fetched by MeController (Task 8) which calls updateAccount(); nothing else to do here.
    if (cached == null) state = const SessionState.signedOut(reason: 'restore');
  }

  Future<void> signIn({required String collegeId, required String identifier, required String password}) async {
    final auth = ref.read(authRepositoryProvider);
    final device = await ref.read(deviceInfoProvider.future);
    final result = await auth.signIn(collegeId: collegeId, identifier: identifier, password: password, device: device);
    final store = ref.read(secureStoreProvider);
    await store.writeTokens(result.tokens);
    await store.writeCollegeId(collegeId);
    final db = await ref.read(appDatabaseProvider.future);
    await db.writeDoc('account', result.account.toJson(), DateTime.now().toUtc());
    state = SessionState.signedIn(result.account);
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    await _wipe();
    state = const SessionState.signedOut();
  }

  /// Used by the Dio interceptor. Returns null when the session is gone (and wipes).
  Future<Tokens?> refreshTokens() async {
    final store = ref.read(secureStoreProvider);
    final current = await store.readTokens();
    if (current == null) return null;
    final next = await ref.read(authRepositoryProvider).refresh(current.refreshToken, await store.deviceId());
    if (next == null) {
      await _wipe();
      state = const SessionState.signedOut(reason: 'expired');
      return null;
    }
    await store.writeTokens(next);
    return next;
  }

  void handleFailure(ApiFailure f) {
    switch (f.code) {
      case ApiErrorCode.sessionInvalidated:
        unawaited(_wipe().then((_) => state = SessionState.signedOut(reason: f.reason)));
      case ApiErrorCode.accountDeactivated:
        final sc = f.detail['supportContact'];
        unawaited(_wipe().then((_) => state = SessionState.deactivated(
              supportContact: sc is Map ? SupportContact.fromJson(Map<String, dynamic>.from(sc)) : null,
            )));
      case ApiErrorCode.institutionPaused:
        state = SessionState.paused((f.detail['message'] as String?) ?? f.message);
      case ApiErrorCode.updateRequired:
        state = SessionState.updateRequired(minVersion: (f.detail['minVersion'] as String?) ?? '', storeUrl: (f.detail['storeUrl'] as String?) ?? '');
      case ApiErrorCode.validationFailed:
      case ApiErrorCode.invalidCredentials:
      case ApiErrorCode.tokenExpired:
      case ApiErrorCode.forbidden:
      case ApiErrorCode.notFound:
      case ApiErrorCode.gone:
      case ApiErrorCode.cooldown:
      case ApiErrorCode.internal:
      case ApiErrorCode.offline:
      case ApiErrorCode.unknown:
        break;
    }
  }

  /// After /me, change-password or onboarding advance.
  Future<void> updateAccount(AccountSummary account) async {
    final db = await ref.read(appDatabaseProvider.future);
    await db.writeDoc('account', account.toJson(), DateTime.now().toUtc());
    state = SessionState.signedIn(account);
  }

  Future<void> _wipe() async {
    await ref.read(secureStoreProvider).wipeAll();
    final db = await ref.read(appDatabaseProvider.future);
    await db.wipe();
  }
}
