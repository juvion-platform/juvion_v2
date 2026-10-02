import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S07: channel header, About, and the channel's notices inline (notices spec §4
/// US-6); each opens S04. Posts arrive in sub-project 5.
class ChannelScreen extends ConsumerWidget {
  const ChannelScreen({required this.channelId, super.key});
  final String channelId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final detail = ref.watch(channelProvider(channelId));
    final pending = ref.watch(pendingAcksProvider).value ?? const <String>{};
    return Scaffold(
      appBar: AppBar(title: Text(detail.value?.data.name ?? '')),
      body: detail.when(
        loading: () => const SkeletonList(count: 2),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(channelProvider(channelId))),
        data: (c) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (c.stale) AsOfLine(c.asOf),
            Text(c.data.name, style: Theme.of(context).textTheme.titleLarge),
            Text(
              c.data.status == 'archived' ? l.channelMemberCountArchived(c.data.memberCount) : l.channelMemberCount(c.data.memberCount),
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 12),
            Text(l.channelAboutTitle, style: Theme.of(context).textTheme.titleSmall),
            Text(c.data.about),
            const SizedBox(height: 8),
            Text(l.channelWhoCanPost(c.data.whoCanPost), style: Theme.of(context).textTheme.bodyMedium),
            Text(c.data.replyRule == 'allowed' ? l.channelReplyAllowed : l.channelAnnouncementOnly, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            if (c.data.notices.isEmpty)
              EmptyState(icon: Icons.chat_bubble_outline, title: l.nothingNew)
            else ...[
              SectionHeader(l.channelNotices),
              for (final n in c.data.notices)
                NoticeTile(
                  notice: n,
                  pendingAck: pending.contains(n.id),
                  onTap: () => GoRouter.maybeOf(context)?.push('/notices/${n.id}'),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
