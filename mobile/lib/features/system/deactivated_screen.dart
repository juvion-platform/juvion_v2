import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/shared/widgets/empty_state.dart';

/// Reached via `lib/app/redirect.dart` when the session state is [Deactivated].
class DeactivatedScreen extends ConsumerWidget {
  const DeactivatedScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final contact = s is Deactivated ? s.supportContact : null;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              EmptyState(icon: Icons.lock_outline, title: context.l10n.deactivatedTitle, hint: context.l10n.deactivatedBody),
              if (contact != null)
                ListTile(
                  leading: const Icon(Icons.support_agent_outlined),
                  title: Text(contact.name),
                  subtitle: Text([contact.phone, contact.email].whereType<String>().join(' · ')),
                ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => ref.read(sessionControllerProvider.notifier).signOut(),
                child: Text(context.l10n.deactivatedBackToSignIn),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
