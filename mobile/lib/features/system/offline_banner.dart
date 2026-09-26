import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';

/// Mounted above the tab content in `AppShell` (`lib/shared/widgets/app_shell.dart`),
/// so it never covers the `NavigationBar` or any interactive content below it.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // R42: AsyncValue.valueOrNull is gone in Riverpod 3 — use .value.
    final online = ref.watch(isOnlineProvider).value ?? true;
    if (online) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Material(
        color: scheme.surfaceContainerHighest,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(children: [
              Icon(Icons.cloud_off_outlined, size: 16, color: scheme.onSurfaceVariant),
              const SizedBox(width: 8),
              Expanded(child: Text(context.l10n.offlineBanner, style: Theme.of(context).textTheme.labelMedium)),
            ]),
          ),
        ),
      ),
    );
  }
}
