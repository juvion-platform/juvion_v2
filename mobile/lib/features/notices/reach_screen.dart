import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'reach_screen.g.dart';

/// Reach is online only: it is the publisher's live view, never cached.
@riverpod
Future<NoticeReachData> noticeReach(Ref ref, String id) async => (await ref.read(noticesRepositoryProvider.future)).reach(id);

class PendingState {
  const PendingState({required this.page, this.group, this.query, this.loadingMore = false});
  final PendingPage page;
  final String? group;
  final String? query;
  final bool loadingMore;
}

/// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.
@riverpod
class PendingController extends _$PendingController {
  static const _copyPagesMax = 25;

  @override
  Future<PendingState> build(String noticeId) async {
    final repo = await ref.read(noticesRepositoryProvider.future);
    return PendingState(page: await repo.pending(noticeId));
  }

  /// Keeps showing the current list until the filtered one arrives.
  Future<void> _reload({String? group, String? query}) async {
    state = await AsyncValue.guard(() async {
      final repo = await ref.read(noticesRepositoryProvider.future);
      return PendingState(page: await repo.pending(noticeId, group: group, q: query), group: group, query: query);
    });
  }

  Future<void> selectGroup(String? group) => _reload(group: group, query: state.value?.query);

  Future<void> search(String text) => _reload(group: state.value?.group, query: text.trim().isEmpty ? null : text.trim());

  Future<void> loadMore() async {
    final s = state.value;
    final cursor = s?.page.nextCursor;
    if (s == null || cursor == null || s.loadingMore) return;
    state = AsyncData(PendingState(page: s.page, group: s.group, query: s.query, loadingMore: true));
    final repo = await ref.read(noticesRepositoryProvider.future);
    try {
      final next = await repo.pending(noticeId, group: s.group, q: s.query, cursor: cursor);
      state = AsyncData(PendingState(
        page: PendingPage(items: [...s.page.items, ...next.items], total: next.total, groups: next.groups, nextCursor: next.nextCursor),
        group: s.group,
        query: s.query,
      ));
    } on ApiFailure {
      state = AsyncData(s);
      rethrow;
    }
  }

  /// Every pending member under the current filter, fetching the remaining pages.
  Future<List<PendingPerson>> everyone() async {
    final s = state.value;
    if (s == null) return const [];
    final repo = await ref.read(noticesRepositoryProvider.future);
    final all = [...s.page.items];
    var cursor = s.page.nextCursor;
    for (var i = 0; cursor != null && i < _copyPagesMax; i++) {
      final next = await repo.pending(noticeId, group: s.group, q: s.query, cursor: cursor);
      all.addAll(next.items);
      cursor = next.nextCursor;
    }
    return all;
  }
}

/// S11, for the notice's publisher (spec §4 US-4). The four snapshot counts add up
/// to the audience; late acknowledgements, comments and members added after
/// publishing are listed on their own. Anyone else gets 403 `NOT_PUBLISHER`.
class ReachScreen extends ConsumerStatefulWidget {
  const ReachScreen({required this.noticeId, super.key});
  final String noticeId;

  @override
  ConsumerState<ReachScreen> createState() => _ReachScreenState();
}

class _ReachScreenState extends ConsumerState<ReachScreen> {
  bool _reminding = false;

  void _toast(String text) => ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(text)));

  Future<void> _remind() async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(l.reachRemindConfirmTitle),
        content: Text(l.reachRemindConfirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.of(c).pop(true), child: Text(l.reachSendReminder)),
        ],
      ),
    );
    if (!(ok ?? false) || !mounted) return;
    setState(() => _reminding = true);
    try {
      await (await ref.read(noticesRepositoryProvider.future)).remind(widget.noticeId);
      if (mounted) _toast(l.reachRemindSent);
    } on ApiFailure catch (f) {
      // A third reminder is refused with the server's reason (spec §4 US-4.4).
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    } finally {
      if (mounted) setState(() => _reminding = false);
      ref.invalidate(noticeReachProvider(widget.noticeId));
    }
  }

  String _stateLabel(AppLocalizations l, String state) => switch (state) {
        'acknowledged' => l.noticeAcknowledged,
        'seen' => l.reachSeenNotAcked,
        'not_on_juvi' => l.reachNotOnJuvi,
        _ => l.reachNotSeen,
      };

  Future<void> _copy() async {
    final l = context.l10n;
    try {
      final people = await ref.read(pendingControllerProvider(widget.noticeId).notifier).everyone();
      final text = people.map((p) => [p.name, if (p.identifier != null) '(${p.identifier})', '—', p.group, '—', _stateLabel(l, p.state)].join(' ')).join('\n');
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) _toast(l.reachCopied(people.length));
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final reach = ref.watch(noticeReachProvider(widget.noticeId));
    return Scaffold(
      appBar: AppBar(title: Text(l.reachTitle)),
      body: RefreshIndicator(
        onRefresh: () => Future.wait([
          ref.refresh(noticeReachProvider(widget.noticeId).future),
          ref.refresh(pendingControllerProvider(widget.noticeId).future),
        ]),
        child: reach.when(
          loading: () => const SkeletonList(),
          error: (e, _) {
            final f = ApiFailure.of(e);
            if (f.code == ApiErrorCode.notPublisher) return ListView(children: [EmptyState(icon: Icons.lock_outline, title: l.reachNotPublisher)]);
            if (f.code == ApiErrorCode.noticeNotFound) {
              return ListView(children: [EmptyState(icon: Icons.search_off, title: l.noticeNotAvailable, hint: l.noticeNotAvailableHint)]);
            }
            return ListView(children: [FailureView(f, onRetry: () => ref.invalidate(noticeReachProvider(widget.noticeId)))]);
          },
          data: (r) => _content(context, r),
        ),
      ),
    );
  }

  Widget _content(BuildContext context, NoticeReachData r) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final canRemind = r.status == 'published' && !r.reminders.exhausted && !_reminding;
    final counts = <(String, int)>[
      if (r.ackRequired) (l.noticeAcknowledged, r.acknowledged),
      (r.ackRequired ? l.reachSeenNotAcked : l.reachSeen, r.seen),
      (l.reachNotSeen, r.notSeen),
      (l.reachNotOnJuvi, r.notOnJuvi),
    ];
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Text(r.title, style: t.titleLarge),
        ),
        if (r.status == 'archived') Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 0), child: Text(l.noticeArchived, style: t.labelLarge)),
        AsOfLine(r.asOf),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final (label, n) in counts)
                SizedBox(
                  width: 150,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('$n', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                        Text(label, style: t.labelMedium),
                      ]),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text(l.reachOfAudience(r.audience), style: t.labelLarge)),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Semantics(
            label: l.reachSparkline,
            excludeSemantics: true,
            child: SizedBox(height: 48, child: CustomPaint(painter: _SparklinePainter(r.sparkline, math.max(r.audience, 1), scheme.primary), size: Size.infinite)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(l.reachReminders(r.reminders.used, r.reminders.max), style: t.bodyMedium),
              FilledButton.tonal(onPressed: canRemind ? _remind : null, child: Text(l.reachSendReminder)),
            ],
          ),
        ),
        if (r.groups.isNotEmpty) ...[
          SectionHeader(l.reachByGroup),
          for (final g in r.groups)
            ListTile(
              title: Text(g.label),
              subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l.reachGroupLine(g.acknowledged, g.total)),
                const SizedBox(height: 6),
                LinearProgressIndicator(value: g.total == 0 ? 0 : g.acknowledged / g.total),
              ]),
            ),
        ],
        _PendingSection(noticeId: widget.noticeId, stateLabel: (s) => _stateLabel(l, s), onCopy: _copy),
        if (r.lateAcks.isNotEmpty) ...[
          SectionHeader(l.reachLate(r.lateCount)),
          for (final p in r.lateAcks)
            ListTile(
              title: Text(p.name),
              subtitle: Text([?p.identifier, p.group, if (p.at != null) dayMonthTime(p.at!)].join(' · ')),
            ),
        ],
        if (r.comments.isNotEmpty) ...[
          SectionHeader(l.reachComments),
          for (final c in r.comments)
            ListTile(
              title: Text(c.name),
              subtitle: Text(c.comment),
              trailing: c.isLate ? Text(l.noticeLate, style: t.labelMedium?.copyWith(color: scheme.error)) : null,
            ),
        ],
        if (r.addedLater.total > 0) ...[
          SectionHeader(l.reachAddedLater),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(l.reachAddedLaterLine(r.addedLater.total, r.addedLater.acknowledged, r.addedLater.seen), style: t.bodyMedium),
          ),
          for (final p in r.addedLater.items)
            ListTile(title: Text(p.name), subtitle: Text([?p.identifier, p.group, _stateLabel(l, p.state)].join(' · '))),
        ],
      ],
    );
  }
}

class _PendingSection extends ConsumerStatefulWidget {
  const _PendingSection({required this.noticeId, required this.stateLabel, required this.onCopy});
  final String noticeId;
  final String Function(String state) stateLabel;
  final VoidCallback onCopy;

  @override
  ConsumerState<_PendingSection> createState() => _PendingSectionState();
}

class _PendingSectionState extends ConsumerState<_PendingSection> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final provider = pendingControllerProvider(widget.noticeId);
    final pending = ref.watch(provider);
    final s = pending.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          l.reachPending(s?.page.total ?? 0),
          trailing: TextButton.icon(onPressed: s == null || s.page.items.isEmpty ? null : widget.onCopy, icon: const Icon(Icons.copy, size: 18), label: Text(l.reachCopy)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: l.reachSearchHint, border: const OutlineInputBorder()),
            onSubmitted: (v) => ref.read(provider.notifier).search(v),
          ),
        ),
        if (s != null && s.page.groups.length > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Wrap(spacing: 8, runSpacing: 4, children: [
              for (final g in <PendingGroup?>[null, ...s.page.groups])
                FilterChip(
                  label: Text(g == null ? l.reachAllGroups : '${g.label} (${g.count})'),
                  selected: s.group == g?.label,
                  onSelected: (_) => ref.read(provider.notifier).selectGroup(g?.label),
                ),
            ]),
          ),
        ...pending.when(
          loading: () => [const SkeletonList(count: 2)],
          error: (e, _) => [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(provider))],
          data: (s) => [
            if (s.page.items.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(l.reachNoPending)),
            for (final p in s.page.items)
              ListTile(
                title: Text(p.name),
                subtitle: Text([
                  ?p.identifier,
                  p.group,
                  widget.stateLabel(p.state),
                  if (p.lastSeenInApp != null) l.reachLastInApp(dayMonthTime(p.lastSeenInApp!)) else if (p.state != 'not_on_juvi') l.reachNeverInApp,
                ].join(' · ')),
              ),
            if (s.page.nextCursor != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: s.loadingMore
                    ? const Center(child: CircularProgressIndicator())
                    : OutlinedButton(onPressed: () => ref.read(provider.notifier).loadMore(), child: Text(l.showMore)),
              ),
          ],
        ),
      ],
    );
  }
}

/// Cumulative acknowledgements (or views) across the notice's life, scaled to the audience.
class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.points, this.max, this.color);
  final List<int> points;
  final int max;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = size.width * i / (points.length - 1);
      final y = size.height - size.height * (points[i] / max).clamp(0.0, 1.0);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2);
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.points != points || old.max != max || old.color != color;
}
