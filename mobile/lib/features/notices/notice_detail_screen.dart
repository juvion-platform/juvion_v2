import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/minute_clock.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/features/notices/widgets/linked_text.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens an attachment or body link outside the app; overridden in tests.
final externalLauncherProvider = Provider<Future<bool> Function(Uri)>((_) => (uri) => launchUrl(uri, mode: LaunchMode.externalApplication));

/// S04. Opening it records `notice.seen` and sets `seenAt` once (spec §4 US-2.1);
/// an archived notice is read-only (US-2.6); a notice that was not sent to this
/// person is "not available" (US-2.5).
class NoticeDetailScreen extends ConsumerStatefulWidget {
  const NoticeDetailScreen({required this.noticeId, this.now, super.key});
  final String noticeId;

  /// Injectable clock for the deadline ring (tests).
  final DateTime? now;

  @override
  ConsumerState<NoticeDetailScreen> createState() => _NoticeDetailScreenState();
}

class _NoticeDetailScreenState extends ConsumerState<NoticeDetailScreen> {
  final _comment = TextEditingController();
  bool _busy = false;
  bool _seenSent = false;

  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).track('notice.seen', {'noticeId': widget.noticeId});
    ref.listenManual<AsyncValue<Cached<NoticeDetail>>>(noticeDetailProvider(widget.noticeId), (_, next) {
      final d = next.value?.data;
      if (d == null || d.seenAt != null || _seenSent) return;
      _seenSent = true;
      unawaited(_markSeen());
    }, fireImmediately: true);
  }

  Future<void> _markSeen() async {
    // Captured before any `await` (I2/I1 pattern): `actions` holds its own
    // container-scoped `Ref`, so calling `.refresh` on it after the awaits below never
    // risks `ref` (this widget's `WidgetRef`) having been disposed in the meantime.
    final actions = ref.read(noticeActionsProvider);
    try {
      await (await ref.read(noticesRepositoryProvider.future)).markSeen(widget.noticeId);
      // includeDetail: false — this screen's own noticeDetailProvider(id) can still be
      // mid-flight on its first (cached-then-network) resolution right now; invalidating
      // it from here would tear that down mid-request (see refreshNotices's doc).
      actions.refresh(noticeId: widget.noticeId, includeDetail: false);
    } on ApiFailure {
      // Offline or gone: seen is best-effort; the next open tries again.
      _seenSent = false;
    }
  }

  void _toast(String text) => ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(text)));

  Future<void> _acknowledge(AckMethod method) async {
    setState(() => _busy = true);
    try {
      await ref.read(noticeActionsProvider).acknowledge(widget.noticeId, method, comment: _comment.text);
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _dismiss() async {
    final l = context.l10n;
    try {
      await ref.read(noticeActionsProvider).dismiss(widget.noticeId);
      if (mounted) await Navigator.of(context).maybePop();
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    }
  }

  Future<void> _openAttachment(NoticeAttachment a) async {
    final l = context.l10n;
    try {
      final url = await (await ref.read(noticesRepositoryProvider.future)).attachmentUrl(widget.noticeId, a.key);
      await ref.read(externalLauncherProvider)(url);
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    }
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final detail = ref.watch(noticeDetailProvider(widget.noticeId));
    return Scaffold(
      appBar: AppBar(title: Text(detail.value?.data.office ?? '')),
      body: detail.when(
        loading: () => const SkeletonList(count: 3),
        error: (e, _) {
          final f = ApiFailure.of(e);
          // M1: `forbidden` is one of the repository's `goneNoticeCodes` — it already
          // drops the cache and rethrows (notices_repository.dart) — so it belongs with
          // `noticeNotFound` here too, not the generic retry branch below (whose retry
          // could never succeed for either).
          if (goneNoticeCodes.contains(f.code) || f.code == ApiErrorCode.notFound) {
            return EmptyState(icon: Icons.search_off, title: l.noticeNotAvailable, hint: l.noticeNotAvailableHint);
          }
          return FailureView(f, onRetry: () => ref.invalidate(noticeDetailProvider(widget.noticeId)));
        },
        data: (c) => _body(context, c),
      ),
    );
  }

  Widget _body(BuildContext context, Cached<NoticeDetail> c) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final d = c.data;
    final online = ref.watch(isOnlineProvider).value ?? true;
    final queued = (ref.watch(pendingAcksProvider).value ?? const <String>{}).contains(d.id);
    final deadline = d.deadline;
    final published = d.publishedAt;
    // M6: matches NoticeCard's clock (widgets/notice_card.dart) — ticks at least once a
    // minute via the shared provider when widget.now (tests/goldens) is null, instead of
    // freezing at the time the screen opened.
    final clock = widget.now ?? ref.watch(minuteClockProvider).value ?? DateTime.now();
    final overdue = deadline != null && !clock.isBefore(deadline);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (c.stale) AsOfLine(c.asOf),
        if (d.archived)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(Icons.inventory_2_outlined),
              const SizedBox(width: 12),
              Expanded(child: Text('${l.noticeArchived}. ${l.noticeArchivedBody}')),
            ]),
          ),
        Text([d.office, if (published != null) dayMonthTime(published)].join(' · '), style: t.labelMedium),
        const SizedBox(height: 6),
        Text(d.title, style: t.titleLarge),
        const SizedBox(height: 4),
        Text(d.audienceLine, style: t.labelMedium),
        if (deadline != null && d.ackRequired) ...[
          const SizedBox(height: 12),
          Row(children: [
            if (d.needsAck) ...[DeadlineRing(deadline: deadline, start: published, now: clock), const SizedBox(width: 12)],
            Expanded(
              child: Text(
                overdue ? l.deadlinePassed(dayMonthTime(deadline)) : l.deadlineDueBy(dayMonthTime(deadline)),
                style: t.labelLarge?.copyWith(color: overdue && d.needsAck ? scheme.error : null),
              ),
            ),
          ]),
        ],
        const SizedBox(height: 16),
        LinkedText(d.body, style: t.bodyLarge, onOpen: (uri) => unawaited(ref.read(externalLauncherProvider)(uri))),
        if (d.attachments.isNotEmpty) ...[
          SectionHeader(l.noticeAttachments),
          for (final a in d.attachments)
            ListTile(
              contentPadding: EdgeInsets.zero,
              enabled: online,
              leading: Icon(a.mime.startsWith('image/') ? Icons.image_outlined : Icons.description_outlined),
              title: Text(a.name),
              subtitle: Text(online ? _size(l, a.size) : l.noticeAvailableWhenOnline),
              onTap: () => _openAttachment(a),
            ),
        ],
        const SizedBox(height: 16),
        ..._ackSection(context, d, queued),
        if (d.isPublisher) ...[
          const SizedBox(height: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.insights_outlined),
            label: Text(l.noticeSeeReach),
            onPressed: () => GoRouter.maybeOf(context)?.push('/notices/${d.id}/reach'),
          ),
        ],
      ],
    );
  }

  List<Widget> _ackSection(BuildContext context, NoticeDetail d, bool queued) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    if (d.archived) return const [];
    if (!d.ackRequired) {
      if (d.state == 'dismissed') return [Text(l.noticeDismissed, style: t.labelLarge)];
      return [Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: _dismiss, child: Text(l.noticeDismiss)))];
    }
    final ackAt = d.ackAt;
    if (d.isAcknowledged) {
      return [
        Row(children: [
          Icon(Icons.check_circle, color: d.isLate ? scheme.error : scheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              [
                if (ackAt == null) l.noticeAcknowledged else l.noticeAcknowledgedAt(dayMonthTime(ackAt)),
                if (d.isLate) l.noticeLate,
                if (d.ackOffline) l.noticeSentOffline,
              ].join(' · '),
              style: t.titleSmall,
            ),
          ),
        ]),
        if (d.ackComment != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(l.noticeYourComment(d.ackComment!))),
      ];
    }
    if (queued) {
      return [
        Row(children: [
          const Icon(Icons.cloud_upload_outlined),
          const SizedBox(width: 8),
          Expanded(child: Text(l.noticeWillSendWhenOnline, style: t.titleSmall)),
        ]),
      ];
    }
    return [
      if (d.ackCommentAllowed) ...[
        TextField(
          controller: _comment,
          maxLength: 500,
          maxLines: 3,
          minLines: 1,
          enabled: !_busy,
          decoration: InputDecoration(labelText: l.noticeCommentLabel, border: const OutlineInputBorder()),
        ),
        const SizedBox(height: 8),
      ],
      AckControl(onAcknowledge: _acknowledge, busy: _busy),
    ];
  }

  String _size(AppLocalizations l, int bytes) =>
      bytes < 1024 * 1024 ? l.fileSizeKb((bytes / 1024).ceil()) : l.fileSizeMb((bytes / (1024 * 1024)).toStringAsFixed(1));
}
