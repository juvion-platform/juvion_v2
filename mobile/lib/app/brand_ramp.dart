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
  final rn = r / 255;
  final gn = g / 255;
  final bn = b / 255;
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
