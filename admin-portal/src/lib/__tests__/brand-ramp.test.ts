import { describe, expect, it } from 'vitest';
import {
  LEGACY_RAMP,
  isValidAccentHex,
  readableOn,
  resolveRamp,
  type Triplet,
} from '../brand-ramp';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;

/** HSL lightness of a 'R G B' triplet, 0–1. */
function lightness(t: Triplet): number {
  const [r, g, b] = t.split(' ').map(Number);
  return (Math.max(r!, g!, b!) + Math.min(r!, g!, b!)) / 2 / 255;
}

/** Hue of a 'R G B' triplet in degrees, 0–360. */
function hue(t: Triplet): number {
  const [r0, g0, b0] = t.split(' ').map(Number);
  const r = r0! / 255, g = g0! / 255, b = b0! / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

describe('LEGACY_RAMP', () => {
  // Success criterion 1. These are frozen from tailwind.config.js as it stood
  // before this feature; if any of them moves, every unthemed install shifts.
  it('is exactly the palette the portal shipped with', () => {
    expect(LEGACY_RAMP.primary).toEqual({
      '50': '240 244 255', '100': '219 234 254', '200': '186 212 242', '300': '123 174 212',
      '400': '74 141 192', '500': '43 108 176', '600': '37 99 160', '700': '30 79 130',
      '800': '26 54 93', '900': '15 39 68',
    });
    expect(LEGACY_RAMP.navy).toEqual({ DEFAULT: '15 39 68', dark: '26 54 93', light: '45 74 111' });
    expect(LEGACY_RAMP.chrome).toEqual({ soft: '94 234 212', wash: '56 178 172' });
  });

  it('is frozen, so a caller cannot corrupt the no-accent path process-wide', () => {
    expect(Object.isFrozen(LEGACY_RAMP)).toBe(true);
    expect(Object.isFrozen(LEGACY_RAMP.primary)).toBe(true);
    expect(Object.isFrozen(LEGACY_RAMP.navy)).toBe(true);
    expect(Object.isFrozen(LEGACY_RAMP.chrome)).toBe(true);
  });
});

describe('isValidAccentHex', () => {
  it('accepts six-digit hex in either case', () => {
    expect(isValidAccentHex('#0B5FA5')).toBe(true);
    expect(isValidAccentHex('#abcdef')).toBe(true);
  });
  it('rejects anything else', () => {
    for (const bad of ['', '0B5FA5', '#FFF', '#GGGGGG', 'red', null, undefined, 42, '#0B5FA5 ']) {
      expect(isValidAccentHex(bad)).toBe(false);
    }
  });
});

describe('resolveRamp', () => {
  it('returns the legacy ramp when no accent is set', () => {
    expect(resolveRamp(null)).toEqual(LEGACY_RAMP);
    expect(resolveRamp(undefined)).toEqual(LEGACY_RAMP);
    expect(resolveRamp('')).toEqual(LEGACY_RAMP);
  });

  it('returns the legacy ramp for a malformed accent rather than throwing', () => {
    expect(resolveRamp('not-a-colour')).toEqual(LEGACY_RAMP);
    expect(resolveRamp('#FFF')).toEqual(LEGACY_RAMP);
  });

  // Hue is only meaningful where the step carries enough chroma to survive
  // 8-bit rounding. At the very pale end the tint's chroma is a fraction of one
  // 8-bit step, so rounding dominates and the recovered hue swings wildly —
  // step 50 of #0B5FA5 lands ~12 degrees off for that reason alone. Assert hue
  // on every step whose chroma is real.
  it('preserves the accent hue below the palest tint', () => {
    const ramp = resolveRamp('#0B5FA5');
    for (const step of STEPS.filter((s) => s !== '50')) {
      expect(Math.abs(hue(ramp.primary[step]) - hue('11 95 165'))).toBeLessThan(5);
    }
  });

  // The accent's own lightness replaces the ladder at step 500, so a clamp band
  // that reaches outside (L_LADDER[6], L_LADDER[4]) inverts the ramp. Swept across
  // accents on both sides of the band, including one whose lightness falls below
  // it (#0B5FA5, 0.345) and one above it (#FFFFFF, 1.0).
  it('drops lightness monotonically from 50 to 900, for every accent', () => {
    for (const accent of ['#0B5FA5', '#7A1FA2', '#FFEE00', '#000080', '#FFFFFF', '#000000', '#808080']) {
      const ls = STEPS.map((s) => lightness(resolveRamp(accent).primary[s]));
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i]!, `step ${STEPS[i]} of ${accent} is not darker than ${STEPS[i - 1]}`)
          .toBeLessThan(ls[i - 1]!);
      }
    }
  });

  it('is deterministic', () => {
    expect(resolveRamp('#7A1FA2')).toEqual(resolveRamp('#7A1FA2'));
  });

  it('emits every value as a valid R G B triplet', () => {
    const ramp = resolveRamp('#7A1FA2');
    const all = [...STEPS.map((s) => ramp.primary[s]), ...Object.values(ramp.navy), ...Object.values(ramp.chrome)];
    for (const t of all) expect(t).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });

  // Review Focus 1 + 2. The bounds carry ~0.01 of slack: the assertion measures
  // the emitted 8-bit triplet, which rounds off the exact L500 value (#FFEE00
  // lands on 0.5, #FFFFFF on 0.578 against a 0.58 cap).
  it('keeps the 500 step legible for extreme accents', () => {
    for (const accent of ['#FFEE00', '#000080', '#FFFFFF', '#000000', '#808080']) {
      const l = lightness(resolveRamp(accent).primary['500']);
      expect(l).toBeGreaterThanOrEqual(0.43);
      expect(l).toBeLessThanOrEqual(0.59);
    }
  });

  it('keeps steps distinct even for a desaturated accent', () => {
    const ramp = resolveRamp('#808080');
    const ls = STEPS.map((s) => lightness(ramp.primary[s]));
    for (let i = 1; i < ls.length; i++) expect(ls[i - 1]! - ls[i]!).toBeGreaterThan(0.02);
  });

  it('derives chrome from the accent ramp so the sidebar stays coherent', () => {
    const ramp = resolveRamp('#7A1FA2');
    expect(ramp.chrome.soft).toBe(ramp.primary['300']);
    // `wash` is drawn from the fixed-lightness 700 step rather than the accent's own
    // 500 — the contrast guard below is the reason.
    expect(ramp.chrome.wash).toBe(ramp.primary['700']);
  });

  // Review Focus 1. The sidebar's active label sits on the wash tint composited over the
  // sidebar gradient, not on the wash itself. An operator may type any accent, so this
  // sweeps the ones that converge the 300/500 pair hardest. Both alphas matter: top-level
  // items use `/20` and submenu items `/15`, and for some accents `/15` is the binding one.
  it('keeps the themed sidebar label above AA contrast for any accent', () => {
    // WCAG 2.1 relative luminance and contrast ratio.
    const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
    const lum = (t: string) => {
      const [r, g, b] = t.split(' ').map(Number);
      return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
      return (hi + 0.05) / (lo + 0.05);
    };
    // CSS alpha compositing, in sRGB, as the browser blends `bg-chrome-wash/20` and `/15`.
    const over = (fg: string, alpha: number, bg: string) => {
      const f = fg.split(' ').map(Number);
      const b = bg.split(' ').map(Number);
      return f.map((v, i) => Math.round(alpha * v! + (1 - alpha) * b![i]!)).join(' ');
    };

    for (const accent of ['#BDB76B', '#C8B560', '#FFCC00', '#88DD88', '#7A1FA2', '#0B5FA5', '#000080']) {
      const ramp = resolveRamp(accent);
      for (const alpha of [0.15, 0.2]) {
        const bg = over(ramp.chrome.wash, alpha, ramp.navy.dark);
        expect(contrast(ramp.chrome.soft, bg), `${accent} at /${Math.round(alpha * 100)} dropped below AA`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // A neutral accent must stay neutral in every slot. Before the achromatic
  // guard, #808080 clamped its saturation up to S500_MIN and derived a maroon
  // ramp at hue 0; white and black derived pink and oxblood ones.
  it('keeps a neutral accent neutral rather than deriving a saturated ramp', () => {
    for (const accent of ['#808080', '#7F8080', '#FFFFFF', '#000000']) {
      const ramp = resolveRamp(accent);
      const all = [...STEPS.map((s) => ramp.primary[s]), ...Object.values(ramp.navy), ...Object.values(ramp.chrome)];
      for (const t of all) {
        const [r, g, b] = t.split(' ').map(Number);
        expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!), `${accent} emitted a tinted ${t}`).toBe(0);
      }
    }
  });
});

describe('readableOn', () => {
  it('picks dark text on a light fill and white on a dark one', () => {
    expect(readableOn('240 244 255')).toBe('#0F172A');
    expect(readableOn('15 39 68')).toBe('#FFFFFF');
  });

  // The extremes above are satisfied by any monotone rule, including a fixed
  // luminance cut. This grey has lightness 0.502 but relative luminance 0.216,
  // so a 0.5 cut would give it white text — which is the bug the ratio
  // comparison exists to prevent.
  it('takes dark ink on a mid-lightness fill', () => {
    expect(readableOn('128 128 128')).toBe('#0F172A');
  });
});
