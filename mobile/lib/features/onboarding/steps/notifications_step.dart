import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';

/// Step 3: an honest explanation of the three tiers and a quiet-hours toggle.
/// The OS permission prompt itself arrives with push in sub-project 3.
class NotificationsStep extends ConsumerWidget {
  const NotificationsStep(this.me, {super.key});
  final Me me;

  // Mirrors settings_screen.dart's _pickTime: `quiet` is built fresh from the currently
  // watched settings (not the onboarding-load-time `me`), so editing one bound doesn't
  // clobber the other with a stale value.
  Future<void> _pick(BuildContext context, WidgetRef ref, String key, String current, Map<String, String> quiet) async {
    final parts = current.split(':').map(int.parse).toList();
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: parts[0], minute: parts[1]));
    if (picked == null) return;
    final v = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    await ref.read(settingsControllerProvider.notifier).patch({
      'quietHours': {...quiet, key: v},
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final s = ref.watch(settingsControllerProvider).value ?? me.settings;
    final quiet = {'start': s.quietHours.start, 'end': s.quietHours.end};
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text(l.onboardingNotificationsTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 12),
      ListTile(leading: const Icon(Icons.priority_high), title: Text(l.settingsTierUrgent), subtitle: Text(l.settingsTierUrgentDesc)),
      ListTile(leading: const Icon(Icons.notifications_active_outlined), title: Text(l.settingsTierImportant), subtitle: Text(l.settingsTierImportantDesc)),
      ListTile(leading: const Icon(Icons.notifications_none), title: Text(l.settingsTierRoutine), subtitle: Text(l.settingsTierRoutineDesc)),
      const Divider(height: 32),
      Text(l.settingsQuietHoursSection, style: Theme.of(context).textTheme.titleMedium),
      ListTile(title: Text(l.settingsQuietStart), trailing: Text(s.quietHours.start), onTap: () => _pick(context, ref, 'start', s.quietHours.start, quiet)),
      ListTile(title: Text(l.settingsQuietEnd), trailing: Text(s.quietHours.end), onTap: () => _pick(context, ref, 'end', s.quietHours.end, quiet)),
    ]);
  }
}
