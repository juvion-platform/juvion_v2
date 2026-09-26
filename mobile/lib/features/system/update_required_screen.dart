import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:url_launcher/url_launcher.dart';

/// Reached via `lib/app/redirect.dart` when the session state is [UpdateRequired].
class UpdateRequiredScreen extends ConsumerWidget {
  const UpdateRequiredScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final (min, url) = s is UpdateRequired ? (s.minVersion, s.storeUrl) : ('', '');
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              EmptyState(icon: Icons.system_update_alt, title: context.l10n.updateRequiredTitle, hint: context.l10n.updateRequiredBody(min)),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: url.isEmpty ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                child: Text(context.l10n.openStore),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
