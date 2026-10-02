import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/shared/format.dart';

/// A notice as a list row: the attention sheet's segments (S05) and a channel's
/// notice list (S07). Tapping opens S04.
class NoticeTile extends StatelessWidget {
  const NoticeTile({required this.notice, this.pendingAck = false, this.onTap, this.now, super.key});
  final NoticeItem notice;
  final bool pendingAck;
  final VoidCallback? onTap;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final published = notice.publishedAt;
    final deadline = notice.deadline;
    final Widget trailing;
    if (notice.archived) {
      trailing = Text(l.noticeArchived, style: Theme.of(context).textTheme.labelMedium);
    } else if (notice.isAcknowledged) {
      trailing = Icon(Icons.check_circle, color: notice.isLate ? scheme.error : scheme.primary, semanticLabel: notice.isLate ? '${l.noticeAcknowledged} · ${l.noticeLate}' : l.noticeAcknowledged);
    } else if (pendingAck) {
      trailing = Icon(Icons.cloud_upload_outlined, semanticLabel: l.noticeWillSendWhenOnline);
    } else if (notice.needsAck) {
      trailing = deadline == null ? Text(l.noticeDue, style: Theme.of(context).textTheme.labelLarge) : DeadlineRing(deadline: deadline, start: published, now: now, size: 36);
    } else if (notice.state == 'received') {
      trailing = Text(l.noticeNew, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: scheme.primary));
    } else {
      trailing = const SizedBox.shrink();
    }
    return ListTile(
      onTap: onTap,
      title: Text(notice.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: notice.state == 'received' ? FontWeight.w700 : null)),
      subtitle: Text([notice.office, if (published != null) dayMonthTime(published)].join(' · ')),
      trailing: trailing,
    );
  }
}
