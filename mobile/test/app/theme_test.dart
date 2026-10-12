import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/brand_ramp.dart';
import 'package:juvi/app/theme.dart';

void main() {
  group('brand roles', () {
    test('no accent repoints them to the legacy ramp', () {
      // Omitting accentHex is the no-accent case: it defaults to null.
      final light = buildTheme(brightness: Brightness.light).colorScheme;
      expect(light.primary, kLegacyRamp.color(600));
      expect(light.onPrimary, const Color(0xFFFFFFFF));
      expect(light.primaryContainer, kLegacyRamp.color(100));
      expect(light.onPrimaryContainer, kLegacyRamp.color(900));
      expect(light.tertiary, kLegacyRamp.color(700));

      final dark = buildTheme(brightness: Brightness.dark).colorScheme;
      expect(dark.primary, kLegacyRamp.color(300));
      expect(dark.onPrimary, kLegacyRamp.color(900));
      expect(dark.primaryContainer, kLegacyRamp.color(800));
      expect(dark.onPrimaryContainer, kLegacyRamp.color(100));
      expect(dark.tertiary, kLegacyRamp.color(300));
    });

    test('an accent repoints them to the derived ramp', () {
      final ramp = resolveRamp('#0B5FA5');
      final light = buildTheme(brightness: Brightness.light, accentHex: '#0B5FA5').colorScheme;
      expect(light.primary, ramp.color(600));
      expect(light.primaryContainer, ramp.color(100));
      expect(light.onPrimaryContainer, ramp.color(900));
      expect(light.tertiary, ramp.color(700));
    });

    test('a malformed accent falls back rather than throwing', () {
      final scheme = buildTheme(brightness: Brightness.light, accentHex: 'not-a-colour').colorScheme;
      expect(scheme.primary, kLegacyRamp.color(600));
    });

    test('the fill and its container stay distinct for a near-grey accent', () {
      final scheme = buildTheme(brightness: Brightness.light, accentHex: '#7F8080').colorScheme;
      expect(scheme.primary, isNot(scheme.primaryContainer));
    });
  });

  group('neutrality guarantee', () {
    // The whole point of repointing rather than rebuilding: every role the ramp
    // does not name must remain exactly what fromSeed produced.
    test('non-brand roles are untouched, in both brightnesses', () {
      for (final brightness in [Brightness.light, Brightness.dark]) {
        for (final accent in [null, '#0B5FA5', '#FFEE00']) {
          final scheme = buildTheme(brightness: brightness, accentHex: accent).colorScheme;
          final base = ColorScheme.fromSeed(
            seedColor: resolveRamp(accent).color(600),
            brightness: brightness,
          );
          final where = '$brightness / $accent';
          expect(scheme.error, base.error, reason: where);
          expect(scheme.onError, base.onError, reason: where);
          expect(scheme.errorContainer, base.errorContainer, reason: where);
          expect(scheme.surface, base.surface, reason: where);
          expect(scheme.onSurface, base.onSurface, reason: where);
          expect(scheme.onSurfaceVariant, base.onSurfaceVariant, reason: where);
          expect(scheme.outlineVariant, base.outlineVariant, reason: where);
          expect(scheme.surfaceContainerHighest, base.surfaceContainerHighest, reason: where);
          expect(scheme.inversePrimary, base.inversePrimary, reason: where);
        }
      }
    });
  });

  group('unchanged theme furniture', () {
    test('the scaffold colours and card shape are what they were', () {
      final light = buildTheme(brightness: Brightness.light, accentHex: '#0B5FA5');
      final dark = buildTheme(brightness: Brightness.dark, accentHex: '#0B5FA5');
      expect(light.scaffoldBackgroundColor, const Color(0xFFFAFAF8));
      expect(dark.scaffoldBackgroundColor, const Color(0xFF111315));
      expect(light.cardTheme.elevation, 0);
      expect(light.useMaterial3, isTrue);
    });
  });
}
