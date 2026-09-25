import 'package:flutter/material.dart';

const kDefaultAccent = Color(0xFF0B5FA5);

/// Institution accent on primary actions only; everything else stays neutral (spec §11).
ThemeData buildTheme({required Brightness brightness, Color? accent}) {
  final scheme = ColorScheme.fromSeed(seedColor: accent ?? kDefaultAccent, brightness: brightness);
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

Color? parseHexColor(String? hex) {
  if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
  return Color(int.parse(hex.substring(1), radix: 16) | 0xFF000000);
}
