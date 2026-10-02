import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/minute_clock.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/shared/format.dart';

/// A notice as a card: the attention stack on Today and Teaching (S03, S10). The
/// footer is the acknowledgement state: archived, acknowledged (with Late), queued
/// offline ("Will send when online"), or the [AckControl] while it is still due.
class NoticeCard extends ConsumerWidget {
  const NoticeCard({
    required this.notice,
    this.pendingAck = false,
    this.busy = false,
    this.onOpen,
    this.onAcknowledge,
    this.now,
    super.key,
  });
  final NoticeItem notice;

  /// An acknowledgement for this notice is waiting in the offline queue.
  final bool pendingAck;

  /// An online acknowledgement is in flight.
  final bool busy;
  final VoidCallback? onOpen;
  final ValueChanged<AckMethod>? onAcknowledge;

  /// Injectable clock for the deadline ring (tests and goldens). Left null in
  /// production, where the card watches the shared minute clock instead, so the
  /// ring still repaints at least once a minute (Task 3 review R4).
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final clock = now ?? ref.watch(minuteClockProvider).value ?? DateTime.now();
    final deadline = notice.deadline;
    final showDeadline = deadline != null && notice.needsAck;
    final overdue = deadline != null && !clock.isBefore(deadline);
    final priority = switch (notice.priority) {
      'urgent' => l.noticeUrgent,
      'important' => l.noticeImportant,
      _ => null,
    };
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text([notice.office, ?priority].join(' · '), style: t.labelMedium),
                        const SizedBox(height: 4),
                        Text(notice.title, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  if (showDeadline) ...[
                    const SizedBox(width: 12),
                    DeadlineRing(deadline: deadline, start: notice.publishedAt, now: clock),
                  ],
                ],
              ),
              const SizedBox(height: 6),
              Text(notice.preview, style: t.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
              if (showDeadline) ...[
                const SizedBox(height: 6),
                Text(
                  overdue ? l.deadlinePassed(dayMonthTime(deadline)) : l.deadlineDueBy(dayMonthTime(deadline)),
                  style: t.labelMedium?.copyWith(color: overdue ? scheme.error : null),
                ),
              ],
              const SizedBox(height: 12),
              _Footer(notice: notice, pendingAck: pendingAck, busy: busy, onAcknowledge: onAcknowledge),
            ],
          ),
        ),
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.notice, required this.pendingAck, required this.busy, this.onAcknowledge});
  final NoticeItem notice;
  final bool pendingAck;
  final bool busy;
  final ValueChanged<AckMethod>? onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    Widget line(IconData icon, String text, {Color? color}) => Row(children: [
          Icon(icon, size: 18, color: color ?? scheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: t.labelLarge?.copyWith(color: color))),
        ]);
    final ackAt = notice.ackAt;
    if (notice.archived) return line(Icons.inventory_2_outlined, l.noticeArchived);
    if (notice.isAcknowledged) {
      final text = ackAt == null ? l.noticeAcknowledged : l.noticeAcknowledgedAt(dayMonthTime(ackAt));
      return line(Icons.check_circle, notice.isLate ? '$text · ${l.noticeLate}' : text, color: notice.isLate ? scheme.error : scheme.primary);
    }
    if (pendingAck) return line(Icons.cloud_upload_outlined, l.noticeWillSendWhenOnline);
    if (notice.needsAck && onAcknowledge != null) return AckControl(onAcknowledge: onAcknowledge!, busy: busy);
    return const SizedBox.shrink();
  }
}
