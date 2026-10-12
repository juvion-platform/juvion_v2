# Mobile institution theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Juvi app derive its colour palette from the institution accent with the same algorithm the web portal uses, so the phone and the browser render the same hexes.

**Architecture:** Port `admin-portal/src/lib/brand-ramp.ts` (219 lines: sRGB→HSL, a lightness ladder, a legibility clamp band, a WCAG luminance ceiling) to `mobile/lib/app/brand_ramp.dart`. Pin the two implementations together with one checked-in `accent → triplets` fixture that **both** suites assert against, so neither can drift alone. Then repoint only the brand-bearing Material roles in `mobile/lib/app/theme.dart`, leaving `fromSeed` to fill every other role.

**Tech Stack:** Flutter 3.44.9 / Dart 3.12 (mobile); TypeScript + Vitest (admin-portal). No new dependencies in either workspace.

**Spec:** `docs/superpowers/specs/2026-10-12-mobile-institution-theming-design.md` — the plan argues from it; read §4.3 for the role mapping and §5 for the test contract.

## Global Constraints

- **The port must be exact, not approximate.** Every constant in Task 2 is copied from `admin-portal/src/lib/brand-ramp.ts:55-98`. A "close enough" value silently breaks the fixture.
- **`flutter analyze` must stay clean.** It compiles the golden tests even though CI does not run them (`--exclude-tags golden`).
- **Mobile tests run with `mobile/` as the working directory** (`.github/workflows/mobile.yml:16`), which is what makes the fixture path in Task 2 resolve.
- **TypeScript strict; no `any`.** `npm run typecheck` must report 0 errors across all three workspaces.
- **No new dependency** in `mobile/pubspec.yaml` or `admin-portal/package.json`.
- **Never `git add -A`, `git add .` or `git add -u`** — path-scoped adds only. Leave the worktree's `.gitignore` modification and its `.ignore` file untouched.
- Commits end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Test commands, exactly: `npm test -w admin-portal` (from the repo root of this worktree) and, from `mobile/`, `flutter test`.
- **Shell quirk in this repo:** a hook rewrites plain `grep` and collapses results. Task 3 step 7's search must be run as `rtk proxy grep -rn …`, or it can report "0 files" while the matches are sitting right there.

## Review Focus

The five inputs or conditions the spec implies but no task's happy path exercises — each one gets its test in the task that owns the code.

1. **A bright or hostile accent** (`#FFEE00`, `#FFFFFF`) — a person setting those expects buttons they can still read, not an invisible white-on-white fill. Task 1 pins them as fixture rows; Task 2's parity test transfers the portal's luminance-ceiling guarantee.
2. **No accent at all** — an institution that set nothing expects the app it already ships. The spec changes that deliberately (§4.4). Task 3 asserts the resulting palette exactly.
3. **A near-grey accent** (`#7F8080`) — expects a neutral brand, not a saturated one invented at hue 0. Task 1 pins the row; Task 3 asserts the fill and its container remain distinguishable.
4. **The fixture missing** (fresh clone, wrong working directory) — expects a loud failure, because a drift guard that passes when its input is absent is not a drift guard. Task 2 pins the failure branch.
5. **Dark mode** — expects legible content and the same brand family as light. Task 3 asserts every dark role.

---

### Task 1: The golden fixture and the portal-side contract

The fixture is the whole drift guard. It is generated *from* the reference implementation and then asserted against it, so changing `resolveRamp` without regenerating the file reddens this suite.

**Files:**
- Create: `admin-portal/src/lib/brand-ramp.golden.json` (generated, then committed)
- Create: `admin-portal/src/lib/__tests__/brand-ramp.golden.test.ts`

**Interfaces:**
- Consumes: `resolveRamp`, `PRIMARY_STEPS`, `LEGACY_RAMP` from `admin-portal/src/lib/brand-ramp.ts` (all already exist).
- Produces: the fixture at `admin-portal/src/lib/brand-ramp.golden.json`, shape `{ note: string, source: string, rows: Array<{ accent: string | null, primary: Record<'50'…'900', string> }> }`. Task 2 reads exactly this shape.

- [ ] **Step 1: Write the fixture test**

Create `admin-portal/src/lib/__tests__/brand-ramp.golden.test.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIMARY_STEPS, resolveRamp } from '../brand-ramp';

const GOLDEN_PATH = fileURLToPath(new URL('../brand-ramp.golden.json', import.meta.url));

/**
 * The accents the Dart port is pinned against.
 *
 * The extremes earn their place rather than padding the list: `#FFEE00` and
 * `#FFFFFF` exercise the relative-luminance ceiling and the achromatic branch,
 * `#7F8080` sits just above the near-grey threshold, `#0F172A` is a dark accent
 * whose own lightness sits below the 500 step's clamp band, and `null` is the
 * no-accent path the phone renders as the legacy palette.
 */
export const GOLDEN_ACCENTS: (string | null)[] = [
  null, '#0B5FA5', '#FFEE00', '#FFFFFF', '#7F8080', '#0F172A', '#C62828', '#2E7D32', '#663399',
];

describe('golden fixture', () => {
  it('pins every row to resolveRamp, and can regenerate itself', () => {
    if (process.env.UPDATE_GOLDEN === '1') {
      const rows = GOLDEN_ACCENTS.map((accent) => ({ accent, primary: resolveRamp(accent).primary }));
      writeFileSync(
        GOLDEN_PATH,
        `${JSON.stringify(
          {
            note: 'Generated from admin-portal/src/lib/brand-ramp.ts. Asserted by this suite and read by mobile/test/app/brand_ramp_test.dart. Regenerate with: UPDATE_GOLDEN=1 npm test -w admin-portal',
            source: 'admin-portal/src/lib/brand-ramp.ts',
            rows,
          },
          null,
          2,
        )}\n`,
      );
    }

    const fixture = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as {
      rows: { accent: string | null; primary: Record<string, string> }[];
    };
    // Pins the row SET as well as the values: adding an accent to GOLDEN_ACCENTS
    // fails here until the fixture is regenerated, so the sweep cannot quietly
    // stop covering an extreme.
    expect(fixture.rows.map((r) => r.accent)).toEqual(GOLDEN_ACCENTS);
    for (const row of fixture.rows) {
      for (const step of PRIMARY_STEPS) {
        expect(resolveRamp(row.accent).primary[step]).toBe(row.primary[step]);
      }
    }
  });
});
```

- [ ] **Step 2: Generate the fixture**

```bash
UPDATE_GOLDEN=1 npm test -w admin-portal -- brand-ramp.golden
```

Expected: the file `admin-portal/src/lib/brand-ramp.golden.json` appears with 9 rows, and the test passes in the same run (generation happens before the assertions).

- [ ] **Step 3: Confirm the guard actually bites**

Temporarily change `L500_MAX` in `admin-portal/src/lib/brand-ramp.ts` from `0.58` to `0.60`, then:

```bash
npm test -w admin-portal -- brand-ramp.golden
```

Expected: **FAIL**, naming a step and an accent. Revert the constant (`git checkout admin-portal/src/lib/brand-ramp.ts`) and confirm the test passes again. Do not skip this — a contract test that cannot fail is the exact defect this repo has been bitten by before.

- [ ] **Step 4: Run the whole portal suite**

```bash
npm test -w admin-portal
```

Expected: PASS, including the existing `brand-ramp.test.ts` (this task must not change any of its assertions).

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/lib/brand-ramp.golden.json admin-portal/src/lib/__tests__/brand-ramp.golden.test.ts
git commit -m "$(cat <<'MSG'
test(theming): pin the brand ramp to a golden fixture

The mobile app needs the same derivation as the portal. This is the contract
between them: generated from brand-ramp.ts, asserted against it here and read
by the Dart port's test.

Co-Authored-By: Claude Code <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: The Dart port, pinned by the fixture

**Files:**
- Create: `mobile/lib/app/brand_ramp.dart`
- Create: `mobile/test/app/brand_ramp_test.dart`
- Read (not modified): `admin-portal/src/lib/brand-ramp.golden.json` from Task 1

**Interfaces:**
- Consumes: the fixture file from Task 1, at `../admin-portal/src/lib/brand-ramp.golden.json` relative to the `mobile/` working directory.
- Produces, for Task 3:
  - `typedef Triplet = String;`
  - `const List<int> primarySteps;` — `[50, 100, …, 900]`
  - `class BrandRamp { const BrandRamp(Map<int, Triplet> primary); final Map<int, Triplet> primary; Color color(int step); }`
  - `const BrandRamp kLegacyRamp;`
  - `BrandRamp resolveRamp(String? accentHex);` — total: never throws, never returns null
  - `bool isValidAccentHex(String? value);`

- [ ] **Step 1: Write the failing test**

Create `mobile/test/app/brand_ramp_test.dart`:

```dart
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd mobile && flutter test test/app/brand_ramp_test.dart
```

Expected: FAIL to compile — `Target of URI doesn't exist: 'package:juvi/app/brand_ramp.dart'`.

- [ ] **Step 3: Write the port**

Create `mobile/lib/app/brand_ramp.dart`:

```dart
import 'dart:math' as math;

import 'package:flutter/material.dart';

/// 'R G B', each channel 0-255 — the portal's own triplet format, kept verbatim
/// so the golden fixture can be compared without normalising.
typedef Triplet = String;

/// The ten ramp positions, in the portal's `PRIMARY_STEPS` order.
const List<int> primarySteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/// A brand ramp derived from an institution's accent colour.
///
/// Only `primary` is carried. Nothing on the phone consumes the portal's `navy`
/// or `chrome` — there is no sidebar and no teal — and shipping them would put
/// two tested-but-unconsumed fields in the public surface.
class BrandRamp {
  const BrandRamp(this.primary);

  /// Keyed 50, 100, … 900. Values are 'R G B' triplets.
  final Map<int, Triplet> primary;

  /// The ramp position as a Flutter [Color].
  Color color(int step) {
    final parts = primary[step]!.split(' ');
    final r = int.parse(parts[0]);
    final g = int.parse(parts[1]);
    final b = int.parse(parts[2]);
    return Color(0xFF000000 | (r << 16) | (g << 8) | b);
  }
}

/// The palette the app shipped with, frozen from the portal's `LEGACY_RAMP.primary`.
///
/// Returned whenever no usable accent is set, so an unthemed institution renders
/// the same palette in the browser and on the phone.
const BrandRamp kLegacyRamp = BrandRamp({
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

/// The same predicate as the portal's `isValidAccentHex`.
final RegExp _hexRe = RegExp(r'^#[0-9a-fA-F]{6}$');

/// Lightness for steps 50-400 and 600-900; index 5 (the 500 step) is the accent itself.
const List<double> _lLadder = [0.97, 0.93, 0.86, 0.76, 0.65, 0, 0.40, 0.32, 0.24, 0.16];
/// Saturation as a fraction of the 500 step's, so pale tints stay greyish.
const List<double> _sScale = [0.35, 0.45, 0.60, 0.72, 0.85, 1, 1, 0.95, 0.85, 0.75];
/// Legibility band for the 500 step. It MUST sit strictly inside
/// `(_lLadder[6], _lLadder[4])` = `(0.40, 0.65)`: the accent's own lightness replaces
/// the ladder at index 5, so a band reaching below 0.40 would place the 500 step
/// lighter than the 600 step and break the ramp's monotonicity. 0.44 and 0.58 leave
/// 0.04 of headroom below and 0.07 above — room enough that 8-bit rounding cannot
/// close either gap.
const double _l500Min = 0.44;
const double _l500Max = 0.58;
const double _s500Min = 0.35;
const double _s500Max = 0.75;
/// Relative-luminance ceilings for steps 500-900, in step order. HSL lightness is
/// not relative luminance: for a high-luminance hue an `L` of 0.40 is still a bright
/// colour, so these keep white label text at or above WCAG AA. Steps 50-400 are
/// light tints and are not clamped.
const List<double> _lumCeiling = [0.170, 0.130, 0.080, 0.045, 0.024];
/// Saturation below which an accent is treated as achromatic. A threshold rather
/// than `s == 0` so near-greys like `#7F8080` are caught too — `_rgbToHsl` reports
/// hue 0 for a grey, and clamping it up would hand a neutral brand a red identity.
const double _achromaticS = 0.04;

bool isValidAccentHex(String? value) => value != null && _hexRe.hasMatch(value);

double _clamp(double v, double lo, double hi) => v < lo ? lo : (v > hi ? hi : v);

int _chan(int v) => v < 0 ? 0 : (v > 255 ? 255 : v);

List<int> _hexToRgb(String hex) => [
      int.parse(hex.substring(1, 3), radix: 16),
      int.parse(hex.substring(3, 5), radix: 16),
      int.parse(hex.substring(5, 7), radix: 16),
    ];

/// Returns `(hue degrees, saturation 0-1, lightness 0-1)`.
List<double> _rgbToHsl(int r, int g, int b) {
  final rn = r / 255, gn = g / 255, bn = b / 255;
  final max = math.max(rn, math.max(gn, bn));
  final min = math.min(rn, math.min(gn, bn));
  final l = (max + min) / 2;
  final d = max - min;
  if (d == 0) return [0, 0, l];
  final s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  final h = max == rn
      ? (gn - bn) / d + (gn < bn ? 6 : 0)
      : max == gn
          ? (bn - rn) / d + 2
          : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

/// Rounded 0-255 channels, matching the TypeScript — which rounds here so that
/// `_capLuminance`'s binary search runs on the same 8-bit values it emits.
List<int> _hslToRgb(double h, double s, double l) {
  final c = (1 - (2 * l - 1).abs()) * s;
  final hp = (((h % 360) + 360) % 360) / 60;
  final x = c * (1 - ((hp % 2) - 1).abs());
  final List<double> seg;
  if (hp < 1) {
    seg = [c, x, 0];
  } else if (hp < 2) {
    seg = [x, c, 0];
  } else if (hp < 3) {
    seg = [0, c, x];
  } else if (hp < 4) {
    seg = [0, x, c];
  } else if (hp < 5) {
    seg = [x, 0, c];
  } else {
    seg = [c, 0, x];
  }
  final m = l - c / 2;
  return [
    ((seg[0] + m) * 255).round(),
    ((seg[1] + m) * 255).round(),
    ((seg[2] + m) * 255).round(),
  ];
}

Triplet _triplet(List<int> rgb) => '${_chan(rgb[0])} ${_chan(rgb[1])} ${_chan(rgb[2])}';

/// WCAG relative luminance, 0-1. Computed from the clamped 8-bit channels, so the
/// value checked is the value emitted.
double _luminance(List<int> rgb) {
  double channel(int v) {
    final s = _chan(v) / 255;
    return s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  }

  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/// Lowers `l` until the emitted triplet's relative luminance is at or below
/// `ceiling`, preserving hue and saturation so the step still reads as the accent.
///
/// Luminance rises monotonically with lightness and reaches 0 at `l = 0`, so the
/// ceiling is always reachable; a binary search keeps the step as vivid as the
/// ceiling allows.
List<int> _capLuminance(double h, double s, double l, double ceiling) {
  final direct = _hslToRgb(h, s, l);
  if (_luminance(direct) <= ceiling) return direct;
  var lo = 0.0;
  var hi = l;
  for (var i = 0; i < 32; i++) {
    final mid = (lo + hi) / 2;
    if (_luminance(_hslToRgb(h, s, mid)) <= ceiling) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return _hslToRgb(h, s, lo);
}

/// Mirrors `resolveRamp` in `admin-portal/src/lib/brand-ramp.ts`.
///
/// Total by construction: an absent, malformed or hostile accent yields
/// [kLegacyRamp]. Keep it total — the accent is operator-supplied.
BrandRamp resolveRamp(String? accentHex) {
  if (!isValidAccentHex(accentHex)) return kLegacyRamp;

  final rgb = _hexToRgb(accentHex!);
  final hsl = _rgbToHsl(rgb[0], rgb[1], rgb[2]);
  final s = hsl[1];
  final l = hsl[2];

  // A neutral accent carries no hue worth preserving, so it keeps the grey it
  // arrived with instead of acquiring a saturated identity at hue 0.
  final achromatic = s < _achromaticS;
  final hueDeg = achromatic ? 0.0 : hsl[0];
  final s500 = achromatic ? 0.0 : _clamp(s, _s500Min, _s500Max);
  final l500 = _clamp(l, _l500Min, _l500Max);

  final primary = <int, Triplet>{};
  for (var i = 0; i < primarySteps.length; i++) {
    final stepL = i == 5 ? l500 : _lLadder[i];
    final stepS = i == 5 ? s500 : _clamp(s500 * _sScale[i], achromatic ? 0 : 0.02, 0.95);
    final atStep = _hslToRgb(hueDeg, stepS, stepL);
    // Steps 500-900 also take a relative-luminance ceiling. 50-400 are tints.
    final ceiling = i >= 5 ? _lumCeiling[i - 5] : null;
    primary[primarySteps[i]] =
        _triplet(ceiling == null ? atStep : _capLuminance(hueDeg, stepS, stepL, ceiling));
  }

  return BrandRamp(primary);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd mobile && flutter test test/app/brand_ramp_test.dart
```

Expected: PASS. If the parity test fails, **do not adjust the fixture and do not loosen the assertion** — a mismatch means the port diverges from the TypeScript, and the TypeScript is the authority (spec §3 A, §8). Diff the two implementations line by line; the usual causes are a rounded-vs-unrounded `_hslToRgb`, a transposed `_lLadder` entry, or `i >= 5` written as `i > 5`.

- [ ] **Step 5: Confirm the guard bites on this side too**

Temporarily perturb one constant in the Dart port — `_l500Max` from `0.58` to `0.60` — then:

```bash
cd mobile && flutter test test/app/brand_ramp_test.dart
```

Expected: **FAIL**, naming an accent and a step. Revert and confirm PASS. This proves the fixture constrains the Dart side, not just the TypeScript side.

- [ ] **Step 6: Analyze**

```bash
cd mobile && flutter analyze
```

Expected: `No issues found!`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/app/brand_ramp.dart mobile/test/app/brand_ramp_test.dart
git commit -m "$(cat <<'MSG'
feat(mobile): derive the brand ramp with the portal's algorithm

Port of admin-portal/src/lib/brand-ramp.ts, pinned to it by the shared golden
fixture so neither implementation can drift alone. Unused for now; theme.dart
adopts it in the next commit.

Co-Authored-By: Claude Code <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Repoint the brand roles in the theme

All four edits land together: the signature change breaks `app.dart` and two test call sites, so anything less does not compile.

**Files:**
- Modify: `mobile/lib/app/theme.dart` (replace `buildTheme`'s head; delete `kDefaultAccent` and `parseHexColor`)
- Modify: `mobile/lib/app/app.dart:16,22-23`
- Modify: `mobile/test/features/notifications/permission_card_golden_test.dart:15`
- Modify: `mobile/test/shared/empty_state_golden_test.dart:14`
- Create: `mobile/test/app/theme_test.dart`

**Interfaces:**
- Consumes: `resolveRamp`, `kLegacyRamp`, `BrandRamp.color` from Task 2.
- Produces: `ThemeData buildTheme({required Brightness brightness, String? accentHex})`. The `Color? accent` parameter is gone; every caller must migrate in this commit.

- [ ] **Step 1: Write the failing test**

Create `mobile/test/app/theme_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/brand_ramp.dart';
import 'package:juvi/app/theme.dart';

void main() {
  group('brand roles', () {
    test('no accent repoints them to the legacy ramp', () {
      final light = buildTheme(brightness: Brightness.light, accentHex: null).colorScheme;
      expect(light.primary, kLegacyRamp.color(600));
      expect(light.onPrimary, const Color(0xFFFFFFFF));
      expect(light.primaryContainer, kLegacyRamp.color(100));
      expect(light.onPrimaryContainer, kLegacyRamp.color(900));
      expect(light.tertiary, kLegacyRamp.color(700));

      final dark = buildTheme(brightness: Brightness.dark, accentHex: null).colorScheme;
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd mobile && flutter test test/app/theme_test.dart
```

Expected: FAIL to compile — `No named parameter with the name 'accentHex'`.

- [ ] **Step 3: Rewire the theme**

In `mobile/lib/app/theme.dart`, replace everything above `ThemeData buildTheme(...)`'s body's `final base = …` line with the following, and **delete `kDefaultAccent` and `parseHexColor`** (spec D8 — after this change `parseHexColor` has no caller):

```dart
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
```

Leave the rest of the function — the `textTheme` `copyWith`, the `cardTheme` (including its R42 comment), the three button themes and `listTileTheme` — **exactly as it is**.

- [ ] **Step 4: Migrate the callers**

`mobile/lib/app/app.dart:16` — pass the raw string through instead of parsing:

```dart
    final accentHex = ref.watch(appConfigProvider).value?.data.accentColor;
```

and at `:22-23`:

```dart
          theme: buildTheme(accentHex: accentHex, brightness: Brightness.light),
          darkTheme: buildTheme(accentHex: accentHex, brightness: Brightness.dark),
```

Then in the two golden tests that pass an accent, replace the named argument:

- `mobile/test/features/notifications/permission_card_golden_test.dart:15`
- `mobile/test/shared/empty_state_golden_test.dart:14`

```dart
        theme: buildTheme(accentHex: '#0B5FA5', brightness: brightness),
```

These are the only two call sites that pass an accent. The other two (`test/features/notices/host.dart:21`, `test/features/system/system_screens_golden_test.dart:22`) pass only `brightness` and need no edit.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd mobile && flutter test test/app/theme_test.dart test/app/brand_ramp_test.dart
```

Expected: PASS.

- [ ] **Step 6: Analyze and run the full mobile suite**

```bash
cd mobile && flutter analyze && flutter test --exclude-tags golden
```

Expected: `No issues found!`, then all tests pass. `flutter analyze` compiles the golden tests too, so a missed call site surfaces here even though CI does not run them.

- [ ] **Step 7: Confirm nothing else reached for the removed API**

```bash
rtk proxy grep -rn "parseHexColor\|kDefaultAccent\|accent:" mobile/lib mobile/test --include=*.dart || echo "clean"
```

Expected: `clean`. Any hit is a call site this commit missed.

- [ ] **Step 8: Commit**

```bash
git add mobile/lib/app/theme.dart mobile/lib/app/app.dart mobile/test/app/theme_test.dart mobile/test/features/notifications/permission_card_golden_test.dart mobile/test/shared/empty_state_golden_test.dart
git commit -m "$(cat <<'MSG'
feat(mobile): theme from the portal's ramp instead of Material's seed

Repoints primary, its container pair and tertiary at the derived ramp, in both
brightnesses, and leaves fromSeed to fill every other role. With no accent set
the app now renders the portal's legacy palette rather than seeding Material
from #0B5FA5, so an unthemed college matches the browser.

Golden images for the four buildTheme call sites need regenerating locally
(they are tag-excluded from CI); that is expected, not a regression.

Co-Authored-By: Claude Code <noreply@anthropic.com>
MSG
)"
```

---

## Self-review

**Spec coverage.** §4.1 → Task 2. §4.2 → Task 3 steps 3-4. §4.3's mapping → Task 3 step 1 asserts every one of the ten light and dark role values. §4.4 → Task 3's first test. §4.5 → Task 2's `BrandRamp` carries `primary` only. §4.6 → the four file lists match, including the spec's deletion of `parseHexColor` (D8). §5's golden contract → Tasks 1-2; §5's loud-failure requirement → Task 2 step 1; §5's golden-image note → Task 3's commit message.

**Not carried into a task, deliberately.** §5 lists a Dart monotonicity test and a determinism test, both of which the portal suite already has. Neither is worth porting: parity asserts the Dart values *equal* the portal's, so a Dart-side monotonicity check can only fail after the parity test has already failed, and Dart's `const` map is immutable by construction, so the mutation risk the portal's freezing test guards against cannot arise. The Dart suite covers the three things parity cannot — malformed input, the `color()` adapter, and the missing-fixture branch. Recorded here rather than silently dropped.

**Type consistency.** `resolveRamp` is spelled the same in both languages and takes `string | null` / `String?`. `primarySteps` / `PRIMARY_STEPS` both denote the same ten values in the same order. The fixture's `primary` keys are JSON strings (`'50'`…`'900'`) read as such in the portal test and mapped to Dart's `int` keys via `expected['$step']` — checked in Task 2 step 1's fixture-reading code. `BrandRamp.color(int)` is the only Dart-only addition and is what `theme.dart` calls.

**Task right-sizing.** Tasks 1 and 2 are each independently reviewable and independently meaningful (the contract; the port). Task 3 is atomic by necessity — the signature change cannot compile without its call sites — and has its own test file, so it is still one reviewer's gate.
