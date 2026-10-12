import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/brand_ramp.dart';

/// Generated from, and asserted against, admin-portal/src/lib/brand-ramp.ts.
/// This file is the only thing keeping the two implementations in agreement.
///
/// The path is relative to `mobile/`, which is the working directory `flutter
/// test` runs with (and what CI uses: .github/workflows/mobile.yml:16).
const String _fixturePath = '../admin-portal/src/lib/brand-ramp.golden.json';

void main() {
  group('golden parity with the portal', () {
    test('every fixture row matches resolveRamp, triplet for triplet', () {
      final file = File(_fixturePath);
      // A failure, deliberately not a skip: a drift guard that passes when its
      // input is missing is not a drift guard.
      if (!file.existsSync()) {
        fail(
          'Golden fixture missing at ${file.absolute.path}. Regenerate it from the repo root '
          'with: UPDATE_GOLDEN=1 npm test -w admin-portal -- brand-ramp.golden',
        );
      }

      final rows = (jsonDecode(file.readAsStringSync()) as Map<String, dynamic>)['rows'] as List;
      expect(rows, isNotEmpty, reason: 'the fixture must pin at least one accent');

      for (final entry in rows) {
        final row = entry as Map<String, dynamic>;
        final accent = row['accent'] as String?;
        final expected = (row['primary'] as Map).cast<String, dynamic>();
        final actual = resolveRamp(accent).primary;
        for (final step in primarySteps) {
          expect(actual[step], expected['$step'], reason: 'accent $accent, step $step');
        }
      }
    });
  });

  group('resolveRamp', () {
    test('returns the legacy ramp when no accent is set', () {
      expect(resolveRamp(null).primary, kLegacyRamp.primary);
    });

    test('returns the legacy ramp for a malformed accent rather than throwing', () {
      for (final bad in ['', 'not-a-colour', '#FFF', '#GGGGGG', '0B5FA5', '#0B5FA5 ', '#0B5FA5F']) {
        expect(resolveRamp(bad).primary, kLegacyRamp.primary, reason: bad);
      }
    });

    test('the legacy ramp is the palette the portal froze, step by step', () {
      expect(kLegacyRamp.primary, {
        50: '240 244 255',
        100: '219 234 254',
        200: '186 212 242',
        300: '123 174 212',
        400: '74 141 192',
        500: '43 108 176',
        600: '37 99 160',
        700: '30 79 130',
        800: '26 54 93',
        900: '15 39 68',
      });
    });
  });

  group('color', () {
    test('maps a triplet onto the matching Color', () {
      expect(kLegacyRamp.color(600), const Color(0xFF2563A0));
      expect(kLegacyRamp.color(50), const Color(0xFFF0F4FF));
    });

    test('every step of every ramp is a real Color', () {
      for (final accent in [null, '#0B5FA5', '#FFEE00', '#7F8080']) {
        for (final step in primarySteps) {
          expect(resolveRamp(accent).color(step).a, 1.0, reason: '$accent step $step');
        }
      }
    });
  });
}
