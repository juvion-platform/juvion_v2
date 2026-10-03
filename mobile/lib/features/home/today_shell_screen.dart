import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
import 'package:juvi/features/notifications/permission_card.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S03: header, the S14 permission card when notifications are off (notifications spec
/// §8.4), the attention stack (acknowledgement notices, notices spec §4 US-3.1) and two
/// designed empty states. Timeline and At a glance arrive in sub-project 4.
class TodayShellScreen extends ConsumerWidget {
  const TodayShellScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final me = ref.watch(meProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => Future.wait([ref.refresh(meProvider.future), ref.refresh(attentionProvider.future)]),
          child: me.when(
            loading: () => ListView(
              children: const [Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 28, width: 160)), SkeletonList(count: 3)],
            ),
            error: (e, _) => ListView(children: [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider))]),
            data: (c) => ListView(
              children: [
                _Header(firstName: c.data.person.firstName, logoUrl: c.data.institution.logoUrl),
                if (c.stale) AsOfLine(c.asOf),
                const PermissionCard(),
                SectionHeader(
                  l.todayAttentionSection,
                  trailing: TextButton(onPressed: () => GoRouter.maybeOf(context)?.push('/attention'), child: Text(l.attentionSeeAll)),
                ),
                const AttentionStack(),
                SectionHeader(l.todayTimelineSection),
                EmptyState(icon: Icons.event_available_outlined, title: l.noClassesToday),
                SectionHeader(l.todayGlanceSection),
                EmptyState(icon: Icons.insights_outlined, title: l.todayGlancePlaceholder),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.firstName, this.logoUrl});
  final String firstName;
  final String? logoUrl;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(firstName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                  Text(dayAndDate(DateTime.now()), style: Theme.of(context).textTheme.labelMedium),
                ],
              ),
            ),
            if (logoUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(logoUrl!, width: 28, height: 28, errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
          ],
        ),
      );
}
