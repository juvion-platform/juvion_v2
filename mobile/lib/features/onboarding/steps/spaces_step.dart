import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// Step 2: a reveal, not a selection. Channels are grouped exactly as in Spaces.
class SpacesStep extends ConsumerWidget {
  const SpacesStep(this.me, {super.key});
  final Me me;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final spaces = ref.watch(spacesProvider);
    final lateral = me.student?.isLateralEntry == true;
    final body = me.faculty != null ? l.onboardingSpacesBodyFaculty : (lateral ? l.onboardingSpacesBodyLateral : l.onboardingSpacesBodyStudent);
    return ListView(padding: const EdgeInsets.symmetric(vertical: 24), children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(l.onboardingSpacesTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700))),
      Padding(padding: const EdgeInsets.fromLTRB(24, 8, 24, 0), child: Text(body)),
      spaces.when(
        loading: () => const SkeletonList(),
        error: (_, _) => Padding(padding: const EdgeInsets.all(24), child: Text(l.onboardingSpacesOffline)),
        data: (c) => Column(children: [
          for (final g in c.data.groups) ...[
            SectionHeader(g.title),
            for (final ch in g.channels) ListTile(dense: true, leading: const Icon(Icons.forum_outlined), title: Text(ch.name), subtitle: Text(ch.about, maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (g.channels.isEmpty && g.emptyHint != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(g.emptyHint!)),
          ],
        ]),
      ),
    ]);
  }
}
