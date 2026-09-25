import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/me/theme_preference.dart';
import 'package:juvi/shared/widgets/section_header.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  Future<void> _pickTime(BuildContext context, WidgetRef ref, String key, String current, Map<String, String> quiet) async {
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
    final settings = ref.watch(settingsControllerProvider).value;
    final mode = ref.watch(themePreferenceProvider);
    if (settings == null) return Scaffold(appBar: AppBar(title: Text(l.settingsTitle)), body: const Center(child: CircularProgressIndicator()));
    final quiet = {'start': settings.quietHours.start, 'end': settings.quietHours.end};
    final ctrl = ref.read(settingsControllerProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: Text(l.settingsTitle)),
      body: ListView(
        children: [
          SectionHeader(l.settingsTiersSection),
          ListTile(title: Text(l.settingsTierUrgent), subtitle: Text(l.settingsTierUrgentDesc), trailing: const Switch(value: true, onChanged: null)),
          SwitchListTile(
            title: Text(l.settingsTierImportant),
            subtitle: Text(l.settingsTierImportantDesc),
            value: settings.tiers.important,
            onChanged: (v) => ctrl.patch({
              'tiers': {'important': v},
            }),
          ),
          SwitchListTile(
            title: Text(l.settingsTierRoutine),
            subtitle: Text(l.settingsTierRoutineDesc),
            value: settings.tiers.routine,
            onChanged: (v) => ctrl.patch({
              'tiers': {'routine': v},
            }),
          ),
          SectionHeader(l.settingsQuietHoursSection),
          ListTile(title: Text(l.settingsQuietStart), trailing: Text(settings.quietHours.start), onTap: () => _pickTime(context, ref, 'start', settings.quietHours.start, quiet)),
          ListTile(title: Text(l.settingsQuietEnd), trailing: Text(settings.quietHours.end), onTap: () => _pickTime(context, ref, 'end', settings.quietHours.end, quiet)),
          SectionHeader(l.settingsAppearanceSection),
          RadioGroup<ThemeMode>(
            groupValue: mode,
            onChanged: (m) {
              if (m != null) unawaited(ref.read(themePreferenceProvider.notifier).set(m));
            },
            child: Column(
              children: [
                for (final (m, label) in [(ThemeMode.system, l.settingsThemeSystem), (ThemeMode.light, l.settingsThemeLight), (ThemeMode.dark, l.settingsThemeDark)])
                  RadioListTile<ThemeMode>(value: m, title: Text(label)),
              ],
            ),
          ),
          SectionHeader(l.settingsLanguageSection),
          ListTile(title: Text(l.settingsLanguageEnglish), subtitle: Text(l.settingsLanguageMore)),
        ],
      ),
    );
  }
}
