import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/spaces/channel_row.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S06: grouped channel list (College / Department / Batch / My Courses / Hostel /
/// Archived, in server order) with next-class labels and mute-via-long-press.
class SpacesScreen extends ConsumerWidget {
  const SpacesScreen({super.key});

  void _actions(BuildContext context, WidgetRef ref, SpaceChannel c) {
    final l = context.l10n;
    unawaited(showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(c.muted ? Icons.notifications_active_outlined : Icons.notifications_off_outlined),
              title: Text(c.muted ? l.channelUnmute : l.channelMute),
              onTap: () {
                Navigator.pop(sheetContext);
                unawaited(toggleMute(ref, c));
              },
            ),
            ListTile(
              leading: const Icon(Icons.done_all),
              title: Text(l.channelMarkAllRead),
              onTap: () async {
                Navigator.pop(sheetContext);
                final repo = await ref.read(spacesRepositoryProvider.future);
                unawaited(repo.markRead(c.id).catchError((_) {}));
              },
            ),
          ],
        ),
      ),
    ));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final spaces = ref.watch(spacesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.tabSpaces)),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(spacesProvider.future),
        child: spaces.when(
          loading: () => const SkeletonList(count: 6),
          error: (e, _) => ListView(children: [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(spacesProvider))]),
          data: (c) => ListView(
            children: [
              if (c.stale) AsOfLine(c.asOf),
              for (final g in c.data.groups) ...[
                SectionHeader(g.title),
                if (g.channels.isEmpty && g.emptyHint != null) EmptyState(icon: Icons.menu_book_outlined, title: g.title, hint: g.emptyHint),
                for (final ch in g.channels)
                  ChannelRow(ch, onTap: () => context.go('/spaces/${ch.id}'), onLongPress: () => _actions(context, ref, ch)),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
