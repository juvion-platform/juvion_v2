import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// Faculty home shell (S10). Post-to-class and the department/college feeds arrive in
/// sub-projects 4 and 5.
class TeachingShellScreen extends ConsumerWidget {
  const TeachingShellScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final me = ref.watch(meProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(meProvider.future),
          child: me.when(
            loading: () => ListView(
              children: const [Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 28, width: 160)), SkeletonList(count: 3)],
            ),
            error: (e, _) => ListView(children: [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider))]),
            data: (c) => ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.data.person.firstName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                      Text(
                        [dayAndDate(DateTime.now()), c.data.faculty?.department].whereType<String>().join(' · '),
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ],
                  ),
                ),
                if (c.stale) AsOfLine(c.asOf),
                SectionHeader(l.teachingAcknowledgementsSection),
                EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
                SectionHeader(l.teachingTodaySection),
                EmptyState(icon: Icons.event_available_outlined, title: l.noClassesToday),
                SectionHeader(l.teachingDepartmentSection),
                EmptyState(icon: Icons.apartment_outlined, title: l.nothingNew),
                SectionHeader(l.teachingCollegeSection),
                EmptyState(icon: Icons.account_balance_outlined, title: l.nothingNew),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
