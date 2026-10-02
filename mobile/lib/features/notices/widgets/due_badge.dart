import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/repos/notices_repository.dart';

/// The Due count on the Today / Teaching tab. It reads the same `dueCount` as the
/// attention stack and the sheet's Due segment, so the numbers always agree (spec §4 US-3.2).
class DueBadge extends ConsumerWidget {
  const DueBadge({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final due = ref.watch(attentionProvider).value?.data.dueCount ?? 0;
    return Semantics(
      value: due > 0 ? context.l10n.dueBadgeLabel(due) : null,
      child: Badge(isLabelVisible: due > 0, label: Text('$due'), child: child),
    );
  }
}
