import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/features/notices/notice_list_controller.dart';

enum AckOutcome { sent, queued }

/// Acknowledges [noticeId]. Online it is not optimistic: the caller keeps the card
/// until this returns [AckOutcome.sent], and a failure is rethrown so the caller can
/// restore the card with a message (spec §4 US-3.3). Offline the acknowledgement is
/// queued as `notice.ack` with `offline: true` and the gesture's `clientAt`, once per
/// notice, and this returns [AckOutcome.queued] (spec §4 US-3.4, §9).
Future<AckOutcome> acknowledgeNotice(WidgetRef ref, String noticeId, AckMethod method, {String? comment}) async {
  final clientAt = DateTime.now().toUtc();
  final trimmed = comment?.trim();
  final note = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  final repo = await ref.read(noticesRepositoryProvider.future);
  try {
    final record = await repo.acknowledge(noticeId, AckInput(method: method, comment: note));
    ref.read(analyticsProvider).track('notice.acknowledged', {'noticeId': noticeId, 'late': record.isLate, 'method': method.name});
    refreshNotice(ref, noticeId);
    return AckOutcome.sent;
  } on ApiFailure catch (f) {
    if (!f.isOffline) rethrow;
    if (!(await ref.read(pendingAcksProvider.future)).contains(noticeId)) {
      final db = await ref.read(appDatabaseProvider.future);
      await db.enqueueAction(PendingAction.create('notice.ack', {
        'noticeId': noticeId,
        'method': method.name,
        'comment': note,
        'clientAt': clientAt.toIso8601String(),
        'offline': true,
      }));
    }
    // The server decides `late` when the queued acknowledgement arrives.
    ref.read(analyticsProvider).track('notice.acknowledged', {'noticeId': noticeId, 'late': null, 'method': method.name});
    ref.invalidate(pendingAcksProvider);
    return AckOutcome.queued;
  }
}

/// Dismisses a notice that needs no acknowledgement. Online only: a failure, offline
/// included, is rethrown for the caller to show.
Future<void> dismissNotice(WidgetRef ref, String noticeId) async {
  final repo = await ref.read(noticesRepositoryProvider.future);
  await repo.dismiss(noticeId);
  ref.read(analyticsProvider).track('notice.dismissed', {'noticeId': noticeId});
  refreshNotice(ref, noticeId);
}

/// Re-reads everything that shows [noticeId]'s state.
void refreshNotice(WidgetRef ref, String noticeId) {
  ref
    ..invalidate(attentionProvider)
    ..invalidate(noticeDetailProvider(noticeId))
    ..invalidate(noticeListProvider);
}
