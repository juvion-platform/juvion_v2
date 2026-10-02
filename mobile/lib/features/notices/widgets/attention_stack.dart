import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/minute_clock.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// The attention stack on Today and Teaching (spec §4 US-3.1): at most three due
/// acknowledgement cards in the server's order (deadline, nulls last), a "+N more"
/// pill to the attention sheet when more are due, and "You're clear" when none are.
class AttentionStack extends ConsumerStatefulWidget {
  const AttentionStack({this.now, super.key});
  static const maxItems = 3;

  /// Injectable clock for the deadline rings (tests and goldens).
  final DateTime? now;

  @override
  ConsumerState<AttentionStack> createState() => _AttentionStackState();
}

class _AttentionStackState extends ConsumerState<AttentionStack> {
  final _busy = <String>{};

  Future<void> _acknowledge(NoticeItem notice, AckMethod method) async {
    setState(() => _busy.add(notice.id));
    try {
      final outcome = await acknowledgeNotice(ref, notice.id, method);
      // Online, the card stays (busy) until the refreshed attention list drops it.
      if (outcome == AckOutcome.sent) await ref.read(attentionProvider.future);
    } on ApiFailure catch (f) {
      if (mounted) ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(f.message)));
    } finally {
      if (mounted) setState(() => _busy.remove(notice.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    // Forces a rebuild at least once a minute (Task 3 review R4), same reason
    // notice_card.dart watches it: in production widget.now is null, so each
    // NoticeCard below also watches it directly and repaints its own ring.
    ref.watch(minuteClockProvider);
    final attention = ref.watch(attentionProvider);
    final pending = ref.watch(pendingAcksProvider).value ?? const <String>{};
    return attention.when(
      loading: () => const SkeletonList(count: 1),
      error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(attentionProvider)),
      data: (c) {
        final items = c.data.items.take(AttentionStack.maxItems).toList();
        if (items.isEmpty) return EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint);
        final more = c.data.dueCount - items.length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final n in items)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: NoticeCard(
                  key: ValueKey('attention-${n.id}'),
                  notice: n,
                  pendingAck: pending.contains(n.id),
                  busy: _busy.contains(n.id),
                  now: widget.now,
                  onOpen: () => GoRouter.maybeOf(context)?.push('/notices/${n.id}'),
                  onAcknowledge: (m) => _acknowledge(n, m),
                ),
              ),
            if (more > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: ActionChip(
                  label: Text(l.attentionMore(more)),
                  onPressed: () => GoRouter.maybeOf(context)?.push('/attention'),
                ),
              ),
          ],
        );
      },
    );
  }
}
