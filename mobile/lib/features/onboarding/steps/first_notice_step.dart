import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi/features/notices/notice_detail_screen.dart' show externalLauncherProvider;
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/linked_text.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'first_notice_step.g.dart';

/// `GET /onboarding/first-notice`: the welcome notice for this account's kind; the
/// server creates the recipient row on demand (spec §6.5).
@riverpod
Future<NoticeDetail> firstNotice(Ref ref) async => (await ref.read(noticesRepositoryProvider.future)).firstNotice();

/// Step 4 (`first_notice`, spec §4 US-5): a real welcome notice with a real
/// acknowledgement. Finishing onboarding does not require it — an unacknowledged
/// welcome notice stays Due on Today.
class FirstNoticeStep extends ConsumerStatefulWidget {
  const FirstNoticeStep({super.key});

  @override
  ConsumerState<FirstNoticeStep> createState() => _FirstNoticeStepState();
}

class _FirstNoticeStepState extends ConsumerState<FirstNoticeStep> {
  bool _busy = false;

  Future<void> _acknowledge(String id, AckMethod method) async {
    setState(() => _busy = true);
    try {
      if (await acknowledgeNotice(ref, id, method) == AckOutcome.sent) ref.invalidate(firstNoticeProvider);
    } on ApiFailure catch (f) {
      if (mounted) ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(f.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final notice = ref.watch(firstNoticeProvider);
    final queued = ref.watch(pendingAcksProvider).value ?? const <String>{};
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text(l.onboardingFirstNoticeTitle, style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Text(l.onboardingFirstNoticeBody, style: t.bodyMedium),
      const SizedBox(height: 16),
      notice.when(
        loading: () => const SkeletonList(count: 2),
        error: (_, _) => Text(l.onboardingFirstNoticeOffline, style: t.bodyMedium),
        data: (d) => Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.office, style: t.labelMedium),
              const SizedBox(height: 4),
              Text(d.title, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              LinkedText(d.body, style: t.bodyMedium, onOpen: (uri) => unawaited(ref.read(externalLauncherProvider)(uri))),
              const SizedBox(height: 16),
              if (d.isAcknowledged)
                Row(children: [
                  Icon(Icons.check_circle, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(d.ackAt == null ? l.noticeAcknowledged : l.noticeAcknowledgedAt(dayMonthTime(d.ackAt!)), style: t.titleSmall)),
                ])
              else if (queued.contains(d.id))
                Row(children: [
                  const Icon(Icons.cloud_upload_outlined),
                  const SizedBox(width: 8),
                  Expanded(child: Text(l.noticeWillSendWhenOnline, style: t.titleSmall)),
                ])
              else if (d.needsAck)
                AckControl(onAcknowledge: (m) => _acknowledge(d.id, m), busy: _busy),
            ]),
          ),
        ),
      ),
    ]);
  }
}
