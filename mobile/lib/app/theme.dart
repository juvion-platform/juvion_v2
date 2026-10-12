import 'package:flutter/material.dart';
import 'package:juvi/app/brand_ramp.dart';

/// Institution accent on primary actions only; everything else stays neutral (spec §11).
///
/// The palette comes from [resolveRamp] — the same derivation the web portal uses
/// (`admin-portal/src/lib/brand-ramp.ts`), so both surfaces render the same hexes.
/// `fromSeed` still fills every role; only the brand-bearing ones are repointed,
/// which is why no obscure Material role can be left unpopulated.
ThemeData buildTheme({required Brightness brightness, String? accentHex}) {
  final ramp = resolveRamp(accentHex);
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: ramp.color(600), brightness: brightness).copyWith(
    primary: ramp.color(dark ? 300 : 600),
    onPrimary: dark ? ramp.color(900) : const Color(0xFFFFFFFF),
    primaryContainer: ramp.color(dark ? 800 : 100),
    onPrimaryContainer: ramp.color(dark ? 100 : 900),
    tertiary: ramp.color(dark ? 300 : 700),
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);
  final text = base.textTheme;
  return base.copyWith(
    scaffoldBackgroundColor: brightness == Brightness.dark ? const Color(0xFF111315) : const Color(0xFFFAFAF8),
    textTheme: text.copyWith(
      // Typography-led: notices and posts read like short documents.
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, height: 1.2),   // notice title
      labelMedium: text.labelMedium?.copyWith(color: scheme.onSurfaceVariant),          // publisher line / meta
      bodyLarge: text.bodyLarge?.copyWith(height: 1.45),                                // body
    ),
    // R42: Flutter 3.44's ThemeData.cardTheme takes CardThemeData, not CardTheme.
    cardTheme: CardThemeData(elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: scheme.outlineVariant))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(44, 48))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(44, 48))),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(minimumSize: const Size(44, 48))),
    listTileTheme: const ListTileThemeData(minVerticalPadding: 12),
  );
}
