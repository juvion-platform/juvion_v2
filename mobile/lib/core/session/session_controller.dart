import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/push/push_registration.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'session_controller.g.dart';

/// Mirrors juvi_http.dart's `_fatalCodes`: when `restore()`'s account fetch fails with
/// one of these, the Dio interceptor's `onFatal` has already routed it through
/// [SessionController.handleFailure] and set the right state — `restore()` must not
/// overwrite it with a bare sign-out.
const Set<ApiErrorCode> _fatalRestoreCodes = {
  ApiErrorCode.sessionInvalidated,
  ApiErrorCode.accountDeactivated,
  ApiErrorCode.institutionPaused,
  ApiErrorCode.updateRequired,
};

const Duration _unregisterBound = Duration(seconds: 5);

@Riverpod(keepAlive: true)
class SessionController extends _$SessionController {
  @override
  SessionState build() => const SessionState.loading();

  /// Called once at bootstrap, before `runApp`, so it never throws: storage that cannot
  /// be read (e.g. restored from a backup without its key) or a cache that cannot open
  /// ends signed out instead of leaving the app with no first frame. Never signs the user
  /// out for being offline.
  Future<void> restore() async {
    try {
      await _restore();
    } on Object {
      if (state is SessionLoading) state = const SessionState.signedOut(reason: 'restore');
    }
  }

  Future<void> _restore() async {
    final store = ref.read(secureStoreProvider);
    final tokens = await store.readTokens();
    if (tokens == null) {
      state = const SessionState.signedOut();
      return;
    }
    final db = await ref.read(appDatabaseProvider.future);
    final cached = await db.readDoc('account');
    if (cached != null) {
      state = SessionState.signedIn(AccountSummary.fromJson(cached.json));
      return;
    }
    // The keychain survived but the on-device cache didn't (e.g. an iOS reinstall) —
    // ask the server once rather than assuming the session is gone.
    try {
      final account = await ref.read(authRepositoryProvider).fetchAccount();
      await db.writeDoc('account', account.toJson(), DateTime.now().toUtc());
      state = SessionState.signedIn(account);
    } on ApiFailure catch (f) {
      // A fatal code already went through the Dio interceptor's onFatal ->
      // handleFailure(), which has set the right state (Deactivated/Paused/
      // UpdateRequired/SignedOut) — leave it alone. Anything else (offline,
      // internal, unknown) signs out without touching the still-good tokens.
      if (_fatalRestoreCodes.contains(f.code)) return;
      state = const SessionState.signedOut(reason: 'restore');
    }
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
    ref.read(analyticsProvider).track('account.signed_in', {'kind': result.account.kind});
  }

  Future<void> signOut() async {
    // While the session is still valid, the server forgets this phone's push token and FCM
    // issues the next account a fresh one (notifications spec §8.3). FCM's getToken and
    // deleteToken have no deadline of their own (offline, no Play services), so they get
    // 5 s: the revoke and the wipe that protect the next person on this phone never wait
    // longer than that.
    await ref.read(pushRegistrationProvider).unregister().timeout(_unregisterBound, onTimeout: () {});
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

  Future<void> handleFailure(ApiFailure f) async {
    switch (f.code) {
      case ApiErrorCode.sessionInvalidated:
        // Deactivation carries the support contact and must not be clobbered by a
        // later sign-out (e.g. a second in-flight request that also 401s).
        if (state is Deactivated) return;
        state = SessionState.signedOut(reason: f.reason);
        await _wipe();
      case ApiErrorCode.accountDeactivated:
        final sc = f.detail['supportContact'];
        state = SessionState.deactivated(
          supportContact: sc is Map ? SupportContact.fromJson(Map<String, dynamic>.from(sc)) : null,
        );
        await _wipe();
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
      case ApiErrorCode.noticeNotFound:
      case ApiErrorCode.alreadyAcknowledged:
      case ApiErrorCode.noticeArchived:
      case ApiErrorCode.notPublisher:
      case ApiErrorCode.reminderLimit:
      case ApiErrorCode.ackRequired:
      case ApiErrorCode.ackNotRequired:
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

  /// Best effort, each part on its own: a storage error must not stop the rest of the
  /// wipe, nor escape as an uncaught error from the interceptor's `onFatal`.
  ///
  /// 011 Story 1 AC3: this is a *deletion* wipe, so it also clears what a sign-out keeps. The
  /// secure store's `wipeAll()` is a 3-key allowlist and deliberately keeps the held
  /// notification destination and the last-account marker — a sign-out has to leave them for the
  /// account that signs back in — and the receipt queue never reaches `db.wipe()` because it
  /// lives in shared preferences, so it can be added to by the background isolate.
  Future<void> _wipe() async {
    final store = ref.read(secureStoreProvider);
    try {
      await store.wipeAll();
    } on Object {
      // Tokens that cannot be deleted cannot be read either (see SecureStore).
    }
    try {
      await store.clearPendingLink();
      await store.clearLastAccount();
    } on Object {
      // Defensive: both deletes are already best effort, so this only covers the read above.
    }
    try {
      await ReceiptQueue().clear();
    } on Object {
      // An undrained receipt is unusable without the account it belongs to.
    }
    try {
      final db = await ref.read(appDatabaseProvider.future);
      await db.wipe();
    } on Object {
      // The cache is disposable; an unopenable one holds nothing to leak.
    }
  }
}
