import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/shared/widgets/empty_state.dart';

/// Reached via `lib/app/redirect.dart` when the session state is [Paused].
class PausedScreen extends ConsumerWidget {
  const PausedScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final message = s is Paused ? s.message : '';
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              EmptyState(icon: Icons.pause_circle_outline, title: context.l10n.pausedTitle, hint: message),
              const SizedBox(height: 16),
              // A successful /me after the institution resumes puts the session back to
              // signedIn via updateAccount.
              OutlinedButton(
                onPressed: () async {
                  try {
                    final fresh = await (await ref.read(meRepositoryProvider.future)).refresh();
                    await ref.read(sessionControllerProvider.notifier).updateAccount(fresh.data.account);
                  } on Object catch (_) {
                    // Still paused or offline: stay here.
                  }
                },
                child: Text(context.l10n.retry),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
