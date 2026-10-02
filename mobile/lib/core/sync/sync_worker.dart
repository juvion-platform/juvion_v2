import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';

// The brief's fixed interface shape (task-10-brief.md): three `final int` fields with a
// value-equality `==`/`hashCode` pair. Every field is final, so the class is immutable in
// practice even without the `@immutable` annotation (which would need an extra
// `package:meta` import for a Dart-only file).
class DrainResult {
  const DrainResult({required this.sent, required this.deferred, required this.dropped, this.ackedNoticeIds = const {}});
  final int sent;
  final int deferred;
  final int dropped;

  /// I2/M8: notice ids whose `notice.ack` was sent or dropped this drain (a 409 reply
  /// counts as sent) — not merely deferred, which changes nothing the UI shows. Left
  /// out of `==`/`hashCode` on purpose: it widens the brief's fixed three-`int` shape
  /// only for `SyncLifecycle` to read, and every existing `DrainResult(...)` equality
  /// check in `sync_worker_test.dart` compares just `sent`/`deferred`/`dropped`.
  final Set<String> ackedNoticeIds;
  @override
  // Every field is final; the class is immutable in practice without `@immutable`.
  // ignore: avoid_equals_and_hash_code_on_mutable_classes
  bool operator ==(Object other) => other is DrainResult && other.sent == sent && other.deferred == deferred && other.dropped == dropped;
  @override
  // Every field is final; the class is immutable in practice without `@immutable`.
  // ignore: avoid_equals_and_hash_code_on_mutable_classes
  int get hashCode => Object.hash(sent, deferred, dropped);
  @override
  String toString() => 'DrainResult(sent: $sent, deferred: $deferred, dropped: $dropped, ackedNoticeIds: $ackedNoticeIds)';
}

/// Replays queued writes FIFO. Offline stops the drain (the remaining queue, including
/// the item that just failed, is left in place for the next attempt, and — per R60 —
/// that item's attempt count is NOT incremented, since connectivity blips must not burn
/// down its retry budget); a non-offline failure counts an attempt and moves on to the
/// next item; ten attempts or a 4xx that is not a cooldown drops the action (spec §11).
///
/// A replayed `notice.ack` that gets a 409 is sent, not dropped: the server already
/// holds an acknowledgement for it, or the notice no longer takes one (notices spec §9).
///
/// The queue is re-read, not iterated from a snapshot: an action whose row is gone by the
/// time its turn comes (a sign-out wiped the queue mid-drain) is skipped, so it can never
/// go out under the next account's token; and actions enqueued mid-drain are picked up by
/// a further pass. Each action is tried at most once per drain, and at most [maxPasses]
/// passes run, so a drain always ends.
///
/// This class is not re-entrant-safe on its own: calling [drain] again on the same
/// instance while a previous call is still running would read and process the queue a
/// second time concurrently. Serializing calls (e.g. so a reconnect and an app-resume
/// firing together only run one drain) is the caller's job — see `SyncLifecycle`
/// (`lib/core/sync/sync_lifecycle.dart`), which holds the in-flight `Future` itself
/// rather than relying on a guard here.
class SyncWorker {
  SyncWorker(this._db, this._me, this._spaces, this._notices);
  final AppDatabase _db;
  final MeRepository _me;
  final SpacesRepository _spaces;
  final NoticesRepository _notices;
  static const maxAttempts = 10;
  static const maxPasses = 5;

  Future<DrainResult> drain() async {
    var sent = 0;
    var deferred = 0;
    var dropped = 0;
    final ackedNoticeIds = <String>{};
    final tried = <String>{};
    for (var pass = 0; pass < maxPasses; pass++) {
      final actions = (await _db.pendingActions()).where((a) => !tried.contains(a.id)).toList();
      if (actions.isEmpty) break;
      var wentOffline = false;
      for (var i = 0; i < actions.length; i++) {
        final a = actions[i];
        tried.add(a.id);
        if (!await _db.hasAction(a.id)) continue;
        try {
          await _apply(a);
          await _db.removeAction(a.id);
          sent++;
          if (a.type == 'notice.ack') ackedNoticeIds.add(a.payload['noticeId'] as String);
        } on ApiFailure catch (f) {
          if (f.isOffline) {
            // R60: record the error for diagnostics, but not as a counted attempt.
            deferred += actions.length - i;
            await _db.recordOfflineFailure(a.id, 'offline');
            wentOffline = true;
            break;
          }
          if (a.type == 'notice.ack' && f.status == 409) {
            await _db.removeAction(a.id);
            sent++;
            ackedNoticeIds.add(a.payload['noticeId'] as String);
            continue;
          }
          final permanent = (f.status ?? 500) >= 400 && (f.status ?? 500) < 500 && f.code != ApiErrorCode.cooldown;
          if (permanent || a.attempts + 1 >= maxAttempts) {
            await _db.removeAction(a.id);
            dropped++;
            // I2/M8: a dropped notice.ack (e.g. a replayed 404 NOTICE_NOT_FOUND) still
            // changes what S04/the stack show for it — it must stop offering "Will
            // send when online" for an acknowledgement that is never going out.
            if (a.type == 'notice.ack') ackedNoticeIds.add(a.payload['noticeId'] as String);
          } else {
            await _db.recordAttempt(a.id, f.message);
            deferred++;
          }
        }
      }
      if (wentOffline) break;
    }
    return DrainResult(sent: sent, deferred: deferred, dropped: dropped, ackedNoticeIds: ackedNoticeIds);
  }

  Future<void> _apply(PendingAction a) async {
    switch (a.type) {
      case 'settings.patch': await _me.updateSettings(a.payload);
      case 'channel.mute': await _spaces.setMuted(a.payload['channelId'] as String, true);
      case 'channel.unmute': await _spaces.setMuted(a.payload['channelId'] as String, false);
      case 'channel.read': await _spaces.markRead(a.payload['channelId'] as String);
      case 'notice.ack': await _notices.acknowledge(a.payload['noticeId'] as String, AckInput.fromQueued(a.payload));
      default: throw const ApiFailure(ApiErrorCode.unknown, 'unknown action', status: 400); // dropped as permanent
    }
  }
}
