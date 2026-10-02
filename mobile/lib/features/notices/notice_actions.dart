import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/features/notices/notice_list_controller.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notice_actions.g.dart';

enum AckOutcome { sent, queued }

/// Re-reads everything that shows a notice's state (I2): the attention stack and
/// sheet, any open S04, the notice lists and a channel's inline tiles. Pass
/// [noticeId] to also target just that notice's detail; left out, the whole
/// `noticeDetailProvider` family is invalidated — used after a sync drain, where more
/// than one queued notice may have changed. Takes a plain [Ref] (never a widget's
/// `WidgetRef`) so it is safe to call from `SyncLifecycle`, which outlives any screen.
///
/// [includeDetail] is false only from S04's own `_markSeen`: that screen's
/// `noticeDetailProvider(noticeId)` can still be in the middle of its own first
/// (cached-then-network) resolution when `markSeen` returns — e.g. the cached doc was
/// just served and the network refresh is still in flight. Invalidating that same
/// provider from inside the listener its own emission triggered tears down and
/// restarts it mid-flight; the original generator's pending result (success or a
/// goneNoticeCodes failure that still needs to delete the cache doc) then has nowhere
/// to land and surfaces as an uncaught error instead of an `AsyncError` state. S04
/// already shows whatever that in-flight resolution produces, so re-invalidating it
/// here would only be wasted work even without the hazard.
void refreshNotices(Ref ref, {String? noticeId, bool includeDetail = true}) {
  ref
    ..invalidate(attentionProvider)
    ..invalidate(noticeListProvider)
    ..invalidate(channelProvider);
  if (!includeDetail) return;
  if (noticeId != null) {
    ref.invalidate(noticeDetailProvider(noticeId));
  } else {
    ref.invalidate(noticeDetailProvider);
  }
}

/// Notice acknowledge/dismiss, container-scoped (I1). Built from the provider's own
/// [Ref] rather than a widget's `WidgetRef`, so everything after an `await` — the
/// analytics call, the enqueue, the invalidation — keeps working even if the screen
/// that started the call has since been popped. Widgets call
/// `ref.read(noticeActionsProvider).acknowledge(...)`, capturing the instance before
/// any `await` so the read itself never risks a disposed `WidgetRef`.
class NoticeActions {
  NoticeActions(this._ref);
  final Ref _ref;

  /// Notice ids with an offline acknowledgement currently being enqueued — guards two
  /// overlapping offline calls for the same notice (queued item 1 / M4) from firing
  /// `notice.acknowledged` twice or enqueueing twice. Checked and set with no `await`
  /// in between, so it is safe against two calls racing, unlike a check against
  /// [pendingAcksProvider] alone (which only updates once the first call's enqueue and
  /// invalidation have actually completed).
  final _enqueueing = <String>{};

  /// Acknowledges [noticeId]. Online it is not optimistic: the caller keeps the card
  /// until this returns [AckOutcome.sent], and a failure is rethrown so the caller can
  /// restore the card with a message (spec §4 US-3.3). Offline the acknowledgement is
  /// queued as `notice.ack` with `offline: true` and the gesture's `clientAt`, once per
  /// notice, and this returns [AckOutcome.queued] (spec §4 US-3.4, §9).
  Future<AckOutcome> acknowledge(String noticeId, AckMethod method, {String? comment}) async {
    final clientAt = DateTime.now().toUtc();
    final trimmed = comment?.trim();
    final note = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
    final repo = await _ref.read(noticesRepositoryProvider.future);
    try {
      final record = await repo.acknowledge(noticeId, AckInput(method: method, comment: note));
      _ref.read(analyticsProvider).track('notice.acknowledged', {'noticeId': noticeId, 'late': record.isLate, 'method': method.name});
      refreshNotices(_ref, noticeId: noticeId);
      return AckOutcome.sent;
    } on ApiFailure catch (f) {
      if (!f.isOffline) rethrow;
      if (_enqueueing.contains(noticeId)) return AckOutcome.queued;
      _enqueueing.add(noticeId);
      try {
        if (!(await _ref.read(pendingAcksProvider.future)).contains(noticeId)) {
          final db = await _ref.read(appDatabaseProvider.future);
          await db.enqueueAction(PendingAction.create('notice.ack', {
            'noticeId': noticeId,
            'method': method.name,
            'comment': note,
            'clientAt': clientAt.toIso8601String(),
            'offline': true,
          }));
          // The server decides `late` when the queued acknowledgement arrives.
          _ref.read(analyticsProvider).track('notice.acknowledged', {'noticeId': noticeId, 'late': null, 'method': method.name});
          _ref.invalidate(pendingAcksProvider);
        }
      } finally {
        _enqueueing.remove(noticeId);
      }
      return AckOutcome.queued;
    }
  }

  /// Dismisses a notice that needs no acknowledgement. Online only: a failure, offline
  /// included, is rethrown for the caller to show.
  Future<void> dismiss(String noticeId) async {
    final repo = await _ref.read(noticesRepositoryProvider.future);
    await repo.dismiss(noticeId);
    _ref.read(analyticsProvider).track('notice.dismissed', {'noticeId': noticeId});
    refreshNotices(_ref, noticeId: noticeId);
  }

  /// Re-reads everything that shows [noticeId]'s state (I2). Exposed as a method, in
  /// addition to the top-level [refreshNotices], so a caller that already holds a
  /// `NoticeActions` (captured before an `await`, as S04's `_markSeen` does) never
  /// needs its own widget `Ref` again afterwards.
  void refresh({String? noticeId, bool includeDetail = true}) =>
      refreshNotices(_ref, noticeId: noticeId, includeDetail: includeDetail);
}

@Riverpod(keepAlive: true)
NoticeActions noticeActions(Ref ref) => NoticeActions(ref);
