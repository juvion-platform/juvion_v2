/**
 * Derives a full brand ramp from an institution's accent colour.
 *
 * The portal's Tailwind ramps resolve to CSS custom properties, and this module
 * computes the values those properties receive. It is deliberately pure — no
 * DOM, no React — so the colour maths is testable on its own.
 *
 * Two guarantees the rest of the feature leans on:
 *
 *  1. `resolveRamp` never throws and never returns a partial ramp. An absent,
 *     malformed or hostile accent yields `LEGACY_RAMP`.
 *  2. `LEGACY_RAMP` is frozen to the palette the portal shipped with, so an
 *     install that has not set an accent renders byte-identically to before.
 */

export type Triplet = string; // 'R G B', each channel 0-255
export type PrimaryStep = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export interface BrandRamp {
  primary: Record<PrimaryStep, Triplet>;
  navy: { DEFAULT: Triplet; dark: Triplet; light: Triplet };
  chrome: { soft: Triplet; wash: Triplet };
}

export const PRIMARY_STEPS: readonly PrimaryStep[] =
  ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;

/**
 * The palette frozen from `tailwind.config.js` before this feature landed.
 *
 * Deep-frozen, and returned by reference on the no-accent path: a caller that
 * mutated the ramp it was handed would otherwise corrupt this constant for the
 * whole process and silently break the pixel-identical guarantee.
 */
export const LEGACY_RAMP: BrandRamp = Object.freeze({
  primary: Object.freeze({
    '50': '240 244 255', '100': '219 234 254', '200': '186 212 242', '300': '123 174 212',
    '400': '74 141 192', '500': '43 108 176', '600': '37 99 160', '700': '30 79 130',
    '800': '26 54 93', '900': '15 39 68',
  }),
  navy: Object.freeze({ DEFAULT: '15 39 68', dark: '26 54 93', light: '45 74 111' }),
  // The sidebar's active state is teal today. It becomes an accent tint when an
  // accent is set (see `resolveRamp`), and must stay teal when one is not — which
  // is why it is a token rather than a reuse of `primary-300`.
  chrome: Object.freeze({ soft: '94 234 212', wash: '56 178 172' }),
});

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidAccentHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value);
}

/** Lightness for steps 50-400 and 600-900; index 5 (the 500 step) is the accent itself. */
const L_LADDER = [0.97, 0.93, 0.86, 0.76, 0.65, 0, 0.40, 0.32, 0.24, 0.16];
/** Saturation as a fraction of the 500 step's, so pale tints stay greyish and shades stay rich. */
const S_SCALE = [0.35, 0.45, 0.60, 0.72, 0.85, 1, 1, 0.95, 0.85, 0.75];
/**
 * Legibility band for the 500 step — the clamp that makes arbitrary operator input safe.
 *
 * The band MUST sit strictly inside `(L_LADDER[6], L_LADDER[4])` = `(0.40, 0.65)`.
 * The accent's own lightness replaces the ladder at index 5, so a band that
 * reached below 0.40 would place the 500 step lighter than the 600 step and
 * break the ramp's monotonicity — which is exactly what an accent like
 * `#0B5FA5` (lightness 0.345) would do. 0.44 and 0.58 leave 0.04 of headroom
 * below and 0.07 above — room enough that 8-bit rounding cannot close either gap.
 */
const L500_MIN = 0.44;
const L500_MAX = 0.58;
const S500_MIN = 0.35;
const S500_MAX = 0.75;
/**
 * Saturation below which an accent is treated as achromatic.
 *
 * `rgbToHsl` reports hue 0 for a pure grey, and a grey's saturation sits far
 * below `S500_MIN` — so clamping it up derives a fully saturated ramp at that
 * arbitrary hue, handing a neutral brand a red identity. A threshold rather than
 * `s === 0` so that near-greys like `#7F8080` (s ≈ 0.004) are caught too; they
 * would otherwise derive an equally arbitrary saturated ramp.
 */
const ACHROMATIC_S = 0.04;
/** Dark chrome is deliberately low-chroma: a red accent yields oxblood, not fire-engine. */
const NAVY_S_MAX = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const seg: [number, number, number] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((seg[0] + m) * 255),
    Math.round((seg[1] + m) * 255),
    Math.round((seg[2] + m) * 255),
  ];
}

const triplet = (rgb: [number, number, number]): Triplet =>
  `${clamp(rgb[0], 0, 255)} ${clamp(rgb[1], 0, 255)} ${clamp(rgb[2], 0, 255)}`;

/** WCAG relative luminance, 0-1. */
function luminance(t: Triplet): number {
  const [r, g, b] = t.split(' ').map(Number);
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r!) + 0.7152 * chan(g!) + 0.0722 * chan(b!);
}

/** Dark ink used for text on light fills; matches Tailwind's `slate-900`. */
const INK = '15 23 42';

/**
 * Picks whichever of white / dark ink contrasts better against `background`.
 * Comparing the two ratios beats a fixed luminance threshold, which lands badly
 * for mid-lightness accents.
 */
export function readableOn(background: Triplet): '#FFFFFF' | '#0F172A' {
  const l = luminance(background);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(INK) + 0.05);
  return onInk >= onWhite ? '#0F172A' : '#FFFFFF';
}

export function resolveRamp(accentHex: string | null | undefined): BrandRamp {
  if (!isValidAccentHex(accentHex)) return LEGACY_RAMP;

  const [h, s, l] = rgbToHsl(...hexToRgb(accentHex));
  // A neutral accent carries no hue worth preserving, so it keeps the grey it
  // arrived with instead of acquiring a saturated identity at hue 0.
  const achromatic = s < ACHROMATIC_S;
  const hueDeg = achromatic ? 0 : h;
  const s500 = achromatic ? 0 : clamp(s, S500_MIN, S500_MAX);
  const l500 = clamp(l, L500_MIN, L500_MAX);

  const primary = {} as Record<PrimaryStep, Triplet>;
  PRIMARY_STEPS.forEach((step, i) => {
    const stepL = i === 5 ? l500 : L_LADDER[i]!;
    const stepS = i === 5 ? s500 : clamp(s500 * S_SCALE[i]!, achromatic ? 0 : 0.02, 0.95);
    primary[step] = triplet(hslToRgb(hueDeg, stepS, stepL));
  });

  const navyS = Math.min(s500, NAVY_S_MAX);
  return {
    primary,
    navy: {
      DEFAULT: triplet(hslToRgb(hueDeg, navyS, 0.163)),
      dark: triplet(hslToRgb(hueDeg, navyS, 0.233)),
      light: triplet(hslToRgb(hueDeg, navyS, 0.306)),
    },
    // `wash` is the active nav item's background, drawn from a fixed-lightness step
    // rather than from the accent's own 500: the 300/500 pair converges for light
    // accents and drops the label below AA. 600 is still too close, so it is 700.
    chrome: { soft: primary['300'], wash: primary['700'] },
  };
}
