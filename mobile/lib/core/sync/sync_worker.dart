import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';

// The brief's fixed interface shape (task-10-brief.md): three `final int` fields with a
// value-equality `==`/`hashCode` pair. Every field is final, so the class is immutable in
// practice even without the `@immutable` annotation (which would need an extra
// `package:meta` import for a Dart-only file).
class DrainResult {
  const DrainResult({required this.sent, required this.deferred, required this.dropped});
  final int sent;
  final int deferred;
  final int dropped;
  @override
  // Every field is final; the class is immutable in practice without `@immutable`.
  // ignore: avoid_equals_and_hash_code_on_mutable_classes
  bool operator ==(Object other) => other is DrainResult && other.sent == sent && other.deferred == deferred && other.dropped == dropped;
  @override
  // Every field is final; the class is immutable in practice without `@immutable`.
  // ignore: avoid_equals_and_hash_code_on_mutable_classes
  int get hashCode => Object.hash(sent, deferred, dropped);
  @override
  String toString() => 'DrainResult(sent: $sent, deferred: $deferred, dropped: $dropped)';
}

/// Replays queued writes FIFO. Offline stops the drain (the remaining queue, including
/// the item that just failed, is left in place for the next attempt, and — per R60 —
/// that item's attempt count is NOT incremented, since connectivity blips must not burn
/// down its retry budget); a non-offline failure counts an attempt and moves on to the
/// next item; ten attempts or a 4xx that is not a cooldown drops the action (spec §11).
///
/// This class is not re-entrant-safe on its own: calling [drain] again on the same
/// instance while a previous call is still running would read and process the queue a
/// second time concurrently. Serializing calls (e.g. so a reconnect and an app-resume
/// firing together only run one drain) is the caller's job — see `SyncLifecycle`
/// (`lib/core/sync/sync_lifecycle.dart`), which holds the in-flight `Future` itself
/// rather than relying on a guard here.
class SyncWorker {
  SyncWorker(this._db, this._me, this._spaces);
  final AppDatabase _db;
  final MeRepository _me;
  final SpacesRepository _spaces;
  static const maxAttempts = 10;

  Future<DrainResult> drain() async {
    var sent = 0;
    var deferred = 0;
    var dropped = 0;
    final actions = await _db.pendingActions();
    for (var i = 0; i < actions.length; i++) {
      final a = actions[i];
      try {
        await _apply(a);
        await _db.removeAction(a.id);
        sent++;
      } on ApiFailure catch (f) {
        if (f.isOffline) {
          // R60: record the error for diagnostics, but not as a counted attempt.
          deferred = actions.length - i;
          await _db.recordOfflineFailure(a.id, 'offline');
          break;
        }
        final permanent = (f.status ?? 500) >= 400 && (f.status ?? 500) < 500 && f.code != ApiErrorCode.cooldown;
        if (permanent || a.attempts + 1 >= maxAttempts) {
          await _db.removeAction(a.id);
          dropped++;
        } else {
          await _db.recordAttempt(a.id, f.message);
          deferred++;
        }
      }
    }
    return DrainResult(sent: sent, deferred: deferred, dropped: dropped);
  }

  Future<void> _apply(PendingAction a) async {
    switch (a.type) {
      case 'settings.patch': await _me.updateSettings(a.payload);
      case 'channel.mute': await _spaces.setMuted(a.payload['channelId'] as String, true);
      case 'channel.unmute': await _spaces.setMuted(a.payload['channelId'] as String, false);
      case 'channel.read': await _spaces.markRead(a.payload['channelId'] as String);
      default: throw const ApiFailure(ApiErrorCode.unknown, 'unknown action', status: 400); // dropped as permanent
    }
  }
}
