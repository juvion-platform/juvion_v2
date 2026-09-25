import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/router.dart';
import 'package:juvi/app/theme.dart';
import 'package:juvi/core/repos/config_repository.dart';
import 'package:juvi/core/sync/sync_lifecycle.dart';
import 'package:juvi/features/me/theme_preference.dart';

class JuviApp extends ConsumerWidget {
  const JuviApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // R42: AsyncValue.valueOrNull is gone in Riverpod 3 — use .value.
    final accent = parseHexColor(ref.watch(appConfigProvider).value?.data.accentColor);
    final mode = ref.watch(themePreferenceProvider);
    return SyncLifecycle(
      child: MaterialApp.router(
        onGenerateTitle: (c) => c.l10n.appName,
        theme: buildTheme(accent: accent, brightness: Brightness.light),
        darkTheme: buildTheme(accent: accent, brightness: Brightness.dark),
        themeMode: mode,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: ref.watch(routerProvider),
      ),
    );
  }
}
