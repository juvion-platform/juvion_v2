import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/notices/notice_list_controller.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S05, shown as a modal sheet over the screen that opened it (route `/attention`).
/// Segments Due, Done, All and — for faculty and staff — Published by me, each paged
/// and filterable by office. The Due label's count is the badge count (spec §4 US-3.2).
class AttentionSheet extends ConsumerStatefulWidget {
  const AttentionSheet({this.initial = NoticeSegment.due, super.key});
  final NoticeSegment initial;

  @override
  ConsumerState<AttentionSheet> createState() => _AttentionSheetState();
}

class _AttentionSheetState extends ConsumerState<AttentionSheet> {
  late NoticeSegment _segment = widget.initial;
  String? _office;

  /// Offices seen in this segment so far, so a chosen filter stays offered.
  final _offices = <String>{};

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionControllerProvider);
    final canPublish = session is SignedIn && session.account.kind != 'student';
    final due = ref.watch(attentionProvider).value?.data.dueCount;
    final list = ref.watch(noticeListProvider(_segment, _office));
    final pending = ref.watch(pendingAcksProvider).value ?? const <String>{};
    _offices.addAll(list.value?.items.map((n) => n.office) ?? const <String>[]);
    final segments = <(NoticeSegment, String)>[
      (NoticeSegment.due, due == null ? l.noticeDue : l.segmentDue(due)),
      (NoticeSegment.done, l.segmentDone),
      (NoticeSegment.all, l.segmentAll),
      if (canPublish) (NoticeSegment.published, l.segmentPublished),
    ];
    final offices = _offices.toList()..sort();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.85,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(l.attentionSheetTitle, style: Theme.of(context).textTheme.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final (s, label) in segments)
                  ChoiceChip(
                    label: Text(label),
                    selected: _segment == s,
                    onSelected: (_) => setState(() {
                      _segment = s;
                      _office = null;
                      _offices.clear();
                    }),
                  ),
              ],
            ),
          ),
          if (offices.length > 1 || _office != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final o in <String?>[null, ...offices])
                    FilterChip(
                      label: Text(o ?? l.officeAll),
                      selected: _office == o,
                      onSelected: (_) => setState(() => _office = o),
                    ),
                ],
              ),
            ),
          const Divider(height: 1),
          Expanded(
            child: list.when(
              loading: () => const SkeletonList(),
              error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(noticeListProvider(_segment, _office))),
              data: (s) {
                if (s.items.isEmpty) return ListView(children: [_empty(l)]);
                return ListView.builder(
                  itemCount: s.items.length + 2,
                  itemBuilder: (context, i) {
                    if (i == 0) return s.stale ? AsOfLine(s.asOf!) : const SizedBox.shrink();
                    if (i == s.items.length + 1) {
                      if (s.nextCursor == null) return const SizedBox(height: 24);
                      final notifier = ref.read(noticeListProvider(_segment, _office).notifier);
                      if (s.loadingMore) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
                      // I3/queued item 6: a failed "Show more" (NoticeListState.failure) must
                      // say so, with a retry — not silently reoffer the same button.
                      if (s.failure != null) return FailureView(s.failure!, onRetry: notifier.loadMore);
                      return Padding(
                        padding: const EdgeInsets.all(16),
                        child: OutlinedButton(onPressed: notifier.loadMore, child: Text(l.showMore)),
                      );
                    }
                    final n = s.items[i - 1];
                    return NoticeTile(
                      notice: n,
                      pendingAck: pending.contains(n.id),
                      onTap: () => GoRouter.maybeOf(context)?.push('/notices/${n.id}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _empty(AppLocalizations l) => switch (_segment) {
        NoticeSegment.due => EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
        NoticeSegment.done => EmptyState(icon: Icons.task_alt, title: l.noticesNoneDone),
        NoticeSegment.all => EmptyState(icon: Icons.inbox_outlined, title: l.noticesNoneAll),
        NoticeSegment.published => EmptyState(icon: Icons.campaign_outlined, title: l.noticesNonePublished),
      };
}
