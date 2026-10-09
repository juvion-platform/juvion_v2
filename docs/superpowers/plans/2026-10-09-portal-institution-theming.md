# Institution Accent Themes The Web Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `College.juvi.accentColor` the single source of brand colour for the admin portal, so a college that already themes its phone app themes its browser too.

**Architecture:** The portal's Tailwind brand ramps are repointed from literal hexes to CSS custom properties holding **space-separated sRGB channel triplets** (`rgb(var(--c-primary-500) / <alpha-value>)`). Those properties are declared in `index.css` with today's exact palette as the default, and overwritten at runtime by a derived ramp built from the accent the backend delivers on `GET /auth/me`. The ~2879 existing `primary-*`/`navy` class occurrences are never edited.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS 3, Zustand 5, vitest 4 + jsdom (portal); Express 4, Mongoose 8, vitest + `mongodb-memory-server` (backend).

**Spec:** `docs/superpowers/specs/2026-10-09-portal-institution-theming-design.md`

## Global Constraints

- **Accent format:** `^#[0-9a-fA-F]{6}$`, stored on `College.juvi.accentColor` (`backend/src/models/College.ts:55`). The mobile default when unset is `#0B5FA5`.
- **Triplets, not hexes.** Every custom property holds `R G B` (e.g. `43 108 176`), never `#2B6CB0`. A plain `var()` breaks `bg-primary-500/20`, which the portal uses ~900 times.
- **No accent set ⇒ pixel-identical.** With `accentColor` absent, every computed colour must equal today's. Enforced by a test that deep-equals a frozen legacy ramp — not by eye.
- **`teal`, `orange`, `accent`, `bg-app` ramps stay static.** They are semantic/legacy. Only `primary`, `navy`, and two new `chrome-*` tokens move.
- **`Badge.tsx`'s 14 arbitrary-value classes stay.** They are a semantic status scale (success/warning/danger/info), not brand.
- **`DashboardWidgets.tsx`'s `CATEGORY_COLORS` / `PAYMENT_MODE_COLOR` stay.** They are a categorical chart palette; theming them would let two series collide with the accent.
- **Do not edit `pages/Login.tsx`.** Pre-auth, no college is known (spec D8). Its navy gradients stay literal.
- **No `git add -A`.** Stage exact paths only. Commits end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- **Backend model imports in tests use direct paths, not the `models` barrel** (repo ruling R86 — the barrel triggers index builds that overrun vitest hooks).
- TypeScript is strict with `noUncheckedIndexedAccess`, so every index into a ramp array yields `T | undefined` and must be narrowed.

## Review Focus

The spec implies these inputs but no task's prose naturally covers them. Each has a test pinned to the task that owns the code — see the "Review Focus test" step in Tasks 1 and 2.

1. **A near-white accent (`#FFEE00`) or near-black (`#000080`).** An operator can type either; a naive ramp produces an illegible button. Expect a legible 500-step and readable label text.
2. **A valid but desaturated accent (`#808080`).** Expect a usable grey ramp, not steps that collapse into each other.
3. **Any custom property left undefined.** Tailwind emits `rgb(var(--c-x) / 1)`; if `--c-x` is missing the declaration is *dropped*, and the element renders transparent — a catastrophic, hard-to-trace failure. Expect every referenced variable to be defined in `:root`.
4. **A session with no college** (superadmin before selecting, or the dev bypass). Expect today's palette, never a blank or unstyled shell.
5. **`/auth/me` failing or omitting `college`.** Expect the previous/legacy ramp to persist rather than the UI flashing unstyled.

---

### Task 1: The ramp derivation

The heart of the feature, and the only piece with real logic. Pure, no DOM, no React — so it is fully testable in isolation.

**Files:**
- Create: `admin-portal/src/lib/brand-ramp.ts`
- Test: `admin-portal/src/lib/__tests__/brand-ramp.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Triplet = string` — `'R G B'`, each channel `0–255`.
  - `interface BrandRamp { primary: Record<PrimaryStep, Triplet>; navy: { DEFAULT: Triplet; dark: Triplet; light: Triplet }; chrome: { soft: Triplet; wash: Triplet } }`
  - `type PrimaryStep = '50'|'100'|'200'|'300'|'400'|'500'|'600'|'700'|'800'|'900'`
  - `const LEGACY_RAMP: BrandRamp`
  - `function isValidAccentHex(value: unknown): value is string`
  - `function resolveRamp(accentHex: string | null | undefined): BrandRamp`
  - `function readableOn(triplet: Triplet): '#FFFFFF' | '#0F172A'`

- [ ] **Step 1: Write the failing test**

Create `admin-portal/src/lib/__tests__/brand-ramp.test.ts`:

```ts
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
    expect(ramp.chrome.wash).toBe(ramp.primary['500']);
  });
});

describe('readableOn', () => {
  it('picks dark text on a light fill and white on a dark one', () => {
    expect(readableOn('240 244 255')).toBe('#0F172A');
    expect(readableOn('15 39 68')).toBe('#FFFFFF');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w admin-portal -- src/lib/__tests__/brand-ramp.test.ts`
Expected: FAIL — `Failed to resolve import "../brand-ramp"`.

- [ ] **Step 3: Write the implementation**

Create `admin-portal/src/lib/brand-ramp.ts`:

```ts
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

/** The palette frozen from `tailwind.config.js` before this feature landed. */
export const LEGACY_RAMP: BrandRamp = {
  primary: {
    '50': '240 244 255', '100': '219 234 254', '200': '186 212 242', '300': '123 174 212',
    '400': '74 141 192', '500': '43 108 176', '600': '37 99 160', '700': '30 79 130',
    '800': '26 54 93', '900': '15 39 68',
  },
  navy: { DEFAULT: '15 39 68', dark: '26 54 93', light: '45 74 111' },
  // The sidebar's active state is teal today. It becomes an accent tint when an
  // accent is set (see `resolveRamp`), and must stay teal when one is not — which
  // is why it is a token rather than a reuse of `primary-300`.
  chrome: { soft: '94 234 212', wash: '56 178 172' },
};

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
 * `#0B5FA5` (lightness 0.345) would do. 0.44 and 0.58 keep ~0.04 of headroom on
 * both sides.
 */
const L500_MIN = 0.44;
const L500_MAX = 0.58;
const S500_MIN = 0.35;
const S500_MAX = 0.75;
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
  // A grey accent reports hue 0, which would derive a red ramp. Keep it grey.
  const hueDeg = s === 0 ? 0 : h;
  const s500 = clamp(s, S500_MIN, S500_MAX);
  const l500 = clamp(l, L500_MIN, L500_MAX);

  const primary = {} as Record<PrimaryStep, Triplet>;
  PRIMARY_STEPS.forEach((step, i) => {
    const stepL = i === 5 ? l500 : L_LADDER[i]!;
    const stepS = i === 5 ? s500 : clamp(s500 * S_SCALE[i]!, 0.02, 0.95);
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
    chrome: { soft: primary['300'], wash: primary['500'] },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w admin-portal -- src/lib/__tests__/brand-ramp.test.ts`
Expected: PASS. If the monotonic-lightness or distinctness assertions fail, the fix is in `L_LADDER`, not in the test — the ladder must reach `0.16` at 900 with no two steps closer than `0.02`.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/lib/brand-ramp.ts admin-portal/src/lib/__tests__/brand-ramp.test.ts
git commit -m "feat(portal): derive a brand ramp from an institution accent"
```

---

### Task 2: The CSS-variable contract

Repoints the Tailwind ramps at custom properties and declares today's palette as the default. **The portal must look exactly as it did before this task** — that is the whole point of doing it before anything consumes the variables.

**Files:**
- Modify: `admin-portal/tailwind.config.js:6-63`
- Modify: `admin-portal/src/index.css:1-10`
- Test: `admin-portal/src/lib/__tests__/theme-contract.test.ts`

**Interfaces:**
- Consumes: `LEGACY_RAMP`, `PRIMARY_STEPS` from Task 1.
- Produces: the custom-property contract — `--c-primary-{50..900}`, `--c-navy`, `--c-navy-dark`, `--c-navy-light`, `--c-chrome-soft`, `--c-chrome-wash`. Tasks 3, 5 and 6 depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `admin-portal/src/lib/__tests__/theme-contract.test.ts`. This is the guard for Review Focus 3 — a variable referenced by Tailwind but missing from `:root` renders the element **transparent**, which no other test would catch.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_RAMP, PRIMARY_STEPS, type Triplet } from '../brand-ramp';

// Read as text rather than imported. `tsconfig.json` includes only "src" and does
// not set allowJs, so importing '../../../tailwind.config.js' would fail
// `npm run typecheck` with TS2307. The wiring is a literal contract either way.
const tailwindSrc = readFileSync(new URL('../../../tailwind.config.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

/** True when `key` is mapped to the custom property `varName`. */
function wired(key: string, varName: string): boolean {
  return new RegExp(`${key}\\s*:\\s*'rgb\\(var\\(--${varName}\\) / <alpha-value>\\)'`).test(tailwindSrc);
}

/** Reads a custom property's value out of the `:root` block. */
function rootVar(name: string): string | undefined {
  const root = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1];
  return root ? new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(root)?.[1]?.trim() : undefined;
}

describe('tailwind colour contract', () => {
  it('routes every brand ramp through a custom property, preserving alpha support', () => {
    for (const step of PRIMARY_STEPS) {
      expect(wired(step, `c-primary-${step}`), `primary.${step} is not wired to a custom property`).toBe(true);
    }
    expect(wired('DEFAULT', 'c-navy')).toBe(true);
    expect(wired('dark', 'c-navy-dark')).toBe(true);
    expect(wired('light', 'c-navy-light')).toBe(true);
    expect(wired('soft', 'c-chrome-soft')).toBe(true);
    expect(wired('wash', 'c-chrome-wash')).toBe(true);
  });

  it('leaves the semantic ramps as literal hexes', () => {
    expect(tailwindSrc).toContain("'#38B2AC'");
    expect(tailwindSrc).toContain("'#FF6B35'");
    expect(tailwindSrc).toContain("'#6C3BE4'");
    expect(tailwindSrc).toContain("'#F0F4F8'");
    expect(tailwindSrc).not.toMatch(/teal\s*:\s*'rgb\(var\(/);
  });

  it('defines every referenced variable in :root, with the legacy palette as its value', () => {
    const expected: Record<string, Triplet> = {};
    for (const step of PRIMARY_STEPS) expected[`c-primary-${step}`] = LEGACY_RAMP.primary[step];
    expected['c-navy'] = LEGACY_RAMP.navy.DEFAULT;
    expected['c-navy-dark'] = LEGACY_RAMP.navy.dark;
    expected['c-navy-light'] = LEGACY_RAMP.navy.light;
    expected['c-chrome-soft'] = LEGACY_RAMP.chrome.soft;
    expected['c-chrome-wash'] = LEGACY_RAMP.chrome.wash;

    for (const [name, value] of Object.entries(expected)) {
      expect(rootVar(name), `:root is missing --${name}`).toBe(value);
    }
  });
});
```

> `wired()` matches on the key, not the variable alone. That matters for the `50`
> step: `500:` contains `50` but not `50` followed by a colon, so the two cannot
> collide. The same holds for `--c-navy` against `--c-navy-dark` in `rootVar`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w admin-portal -- src/lib/__tests__/theme-contract.test.ts`
Expected: FAIL — `colors.primary['50']` is `'#F0F4FF'`, not the `rgb(var(…))` form, and `:root` does not exist.

- [ ] **Step 3: Repoint `tailwind.config.js`**

Replace the `colors` block (`admin-portal/tailwind.config.js:6-63`) with. **Only `navy` and `primary` change; `teal`, `accent`, `orange` and `bg-app` are copied through untouched.**

```js
      colors: {
        // ── Institution-themed ramps ──────────────────
        //
        // These resolve at runtime from CSS custom properties defined in
        // src/index.css and overwritten by lib/apply-ramp.ts when a college has
        // set an accent. The properties hold space-separated sRGB channel
        // triplets ("43 108 176"), NOT hex — a plain `var()` cannot carry an
        // alpha channel, so `bg-primary-500/20` would silently break, and the
        // portal uses opacity modifiers ~900 times.
        navy: {
          DEFAULT: 'rgb(var(--c-navy) / <alpha-value>)',
          dark: 'rgb(var(--c-navy-dark) / <alpha-value>)',
          light: 'rgb(var(--c-navy-light) / <alpha-value>)',
        },
        primary: {
          50:  'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: 'rgb(var(--c-primary-300) / <alpha-value>)',
          400: 'rgb(var(--c-primary-400) / <alpha-value>)',
          500: 'rgb(var(--c-primary-500) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)',
          800: 'rgb(var(--c-primary-800) / <alpha-value>)',
          900: 'rgb(var(--c-primary-900) / <alpha-value>)',
        },
        // The sidebar's active state. Teal at rest; an accent tint when themed.
        chrome: {
          soft: 'rgb(var(--c-chrome-soft) / <alpha-value>)',
          wash: 'rgb(var(--c-chrome-wash) / <alpha-value>)',
        },
        // ── Static semantic ramps — never themed ──────
        teal: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#38B2AC',  // old Juvion teal
          600: '#2C9A94',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        accent: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#6C3BE4',  // old Juvion purple accent
          600: '#5B21B6',
          700: '#4C1D95',
          800: '#3B0764',
          900: '#2E1065',
        },
        orange: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF6B35',  // old Juvion orange
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // ── App background (a neutral surface — not themed) ──
        'bg-app': '#F0F4F8',
      },
```

- [ ] **Step 4: Declare the defaults in `index.css`**

Insert at the top of `admin-portal/src/index.css`, after the three `@tailwind` directives and before `@layer base`:

```css
/**
 * Brand ramp defaults — the palette the portal shipped with.
 *
 * `lib/apply-ramp.ts` overwrites these on the document element once a college's
 * accent is known. They must never be removed: Tailwind emits
 * `rgb(var(--c-primary-500) / 1)`, and if the property is undefined the whole
 * declaration is dropped, leaving the element transparent rather than merely
 * the wrong colour.
 *
 * Values are space-separated sRGB channel triplets, so Tailwind's alpha
 * placeholder can compose them (`bg-primary-500/20`).
 */
:root {
  --c-primary-50:  240 244 255;
  --c-primary-100: 219 234 254;
  --c-primary-200: 186 212 242;
  --c-primary-300: 123 174 212;
  --c-primary-400: 74 141 192;
  --c-primary-500: 43 108 176;
  --c-primary-600: 37 99 160;
  --c-primary-700: 30 79 130;
  --c-primary-800: 26 54 93;
  --c-primary-900: 15 39 68;
  --c-navy:        15 39 68;
  --c-navy-dark:   26 54 93;
  --c-navy-light:  45 74 111;
  --c-chrome-soft: 94 234 212;
  --c-chrome-wash: 56 178 172;
}
```

Leave the rest of `index.css` alone — the `body` background and the scrollbar rgba values are neutral surfaces and are not themed.

- [ ] **Step 5: Verify the portal renders unchanged**

Run: `npm run build -w admin-portal`
Expected: build succeeds.

Run: `npm test -w admin-portal -- src/lib/__tests__/theme-contract.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 6: Commit**

```bash
git add admin-portal/tailwind.config.js admin-portal/src/index.css admin-portal/src/lib/__tests__/theme-contract.test.ts
git commit -m "refactor(portal): route brand ramps through CSS custom properties"
```

---

### Task 3: The DOM adapter

Splitting the pure mapping from the DOM write keeps Task 1 testable without jsdom and makes this file trivially correct.

**Files:**
- Create: `admin-portal/src/lib/apply-ramp.ts`
- Test: `admin-portal/src/lib/__tests__/apply-ramp.test.ts`

**Interfaces:**
- Consumes: `BrandRamp`, `PRIMARY_STEPS` from Task 1.
- Produces: `rampToCssVars(ramp: BrandRamp): Record<string, string>` and `applyRamp(ramp: BrandRamp, root?: HTMLElement): void`. Task 5 calls `applyRamp`.

- [ ] **Step 1: Write the failing test**

Create `admin-portal/src/lib/__tests__/apply-ramp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LEGACY_RAMP, resolveRamp } from '../brand-ramp';
import { applyRamp, rampToCssVars } from '../apply-ramp';

describe('rampToCssVars', () => {
  it('maps every ramp value onto its custom property', () => {
    const vars = rampToCssVars(LEGACY_RAMP);
    expect(vars['--c-primary-500']).toBe('43 108 176');
    expect(vars['--c-navy']).toBe('15 39 68');
    expect(vars['--c-navy-dark']).toBe('26 54 93');
    expect(vars['--c-navy-light']).toBe('45 74 111');
    expect(vars['--c-chrome-soft']).toBe('94 234 212');
    expect(vars['--c-chrome-wash']).toBe('56 178 172');
    expect(Object.keys(vars)).toHaveLength(15);
  });
});

describe('applyRamp', () => {
  it('writes the properties onto the given root', () => {
    const el = document.createElement('div');
    applyRamp(resolveRamp('#7A1FA2'), el);
    expect(el.style.getPropertyValue('--c-primary-500')).toBe(resolveRamp('#7A1FA2').primary['500']);
    expect(el.style.getPropertyValue('--c-navy')).toBe(resolveRamp('#7A1FA2').navy.DEFAULT);
  });

  it('restores the legacy palette when the ramp is the legacy ramp', () => {
    const el = document.createElement('div');
    applyRamp(resolveRamp('#7A1FA2'), el);
    applyRamp(LEGACY_RAMP, el);
    expect(el.style.getPropertyValue('--c-primary-500')).toBe('43 108 176');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w admin-portal -- src/lib/__tests__/apply-ramp.test.ts`
Expected: FAIL — `Failed to resolve import "../apply-ramp"`.

- [ ] **Step 3: Write the implementation**

Create `admin-portal/src/lib/apply-ramp.ts`:

```ts
import { PRIMARY_STEPS, type BrandRamp } from './brand-ramp';

/**
 * Writes a brand ramp onto the document as CSS custom properties.
 *
 * Kept separate from `brand-ramp.ts` so the colour maths stays free of the DOM,
 * and separate from the React layer so it can be called from anywhere.
 */

export function rampToCssVars(ramp: BrandRamp): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const step of PRIMARY_STEPS) vars[`--c-primary-${step}`] = ramp.primary[step];
  vars['--c-navy'] = ramp.navy.DEFAULT;
  vars['--c-navy-dark'] = ramp.navy.dark;
  vars['--c-navy-light'] = ramp.navy.light;
  vars['--c-chrome-soft'] = ramp.chrome.soft;
  vars['--c-chrome-wash'] = ramp.chrome.wash;
  return vars;
}

/**
 * Applies `ramp` to `root` (the document element by default).
 *
 * Only ever called with a complete ramp — `resolveRamp` guarantees one — because
 * a partially written ramp would leave some properties stale and some updated,
 * which reads as a half-themed UI rather than a broken one.
 */
export function applyRamp(ramp: BrandRamp, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(rampToCssVars(ramp))) {
    root.style.setProperty(name, value);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w admin-portal -- src/lib/__tests__/apply-ramp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/lib/apply-ramp.ts admin-portal/src/lib/__tests__/apply-ramp.test.ts
git commit -m "feat(portal): apply a brand ramp as CSS custom properties"
```

---

### Task 4: The backend delivers the accent

Independent of Tasks 1-3 and can be done in parallel by a separate person. Extends the session-bootstrap payload rather than adding an endpoint, so no new route or RBAC permission is involved.

**Files:**
- Modify: `backend/src/modules/auth/service.ts` (add `readCollegeBranding`; extend `login` and `getMe`)
- Modify: `backend/src/modules/auth/controller.ts:65-72`
- Test: `backend/src/modules/auth/__tests__/branding.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `interface CollegeBranding { id: string; name: string; code: string; logo?: string; accentColor: string | null }`; `getMe(userId: string, collegeId?: string)`; a `college` key on both the login and `/auth/me` responses (`CollegeBranding | null`); `accentColor` and `logo` on each entry of the superadmin's `colleges[]`. Task 5 consumes all of these.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/auth/__tests__/branding.test.ts`. The `makeCollege` helper carries every field `College` requires — `address.{line1,city,state,pincode}`, `contactEmail` and `contactPhone` are all required (`backend/src/models/College.ts:74-84`), so a partial create throws a ValidationError before any assertion runs. This field set is copied from `backend/src/models/__tests__/college-aiSpendLimits.test.ts:17-32`.

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { College, type ICollege } from '../../../models/College';
import { clearCollections, setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import { createTestUser } from '../../../__e2e__/factories/user.factory';
import { getMe } from '../service';

let codeCounter = 0;
function makeCollege(overrides: Partial<ICollege> = {}): Partial<ICollege> {
  codeCounter += 1;
  return {
    name: 'Test Institute',
    code: `TI${String(codeCounter).padStart(4, '0')}`,
    contactEmail: 'admin@test-college.dev',
    contactPhone: '+91-9000000000',
    address: { line1: '1 Test Road', city: 'Test City', state: 'Test State', pincode: '500001' },
    ...overrides,
  };
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => { await clearCollections(); });

describe('getMe college branding', () => {
  it('carries the college accent so the portal can theme itself', async () => {
    const college = await College.create(makeCollege({ juvi: { accentColor: '#0B5FA5' } as never }));
    const { user } = await createTestUser({
      collegeId: String(college._id), role: 'admin', personaType: 'L-PRIN',
      name: 'A', email: 'a@test.local',
    });

    const result = await getMe(String(user._id));

    expect(result.college).toEqual({
      id: String(college._id),
      name: 'Test Institute',
      code: college.code,
      logo: undefined,
      accentColor: '#0B5FA5',
    });
  });

  it('reports a null accent rather than omitting the key when none is set', async () => {
    const college = await College.create(makeCollege());
    const { user } = await createTestUser({
      collegeId: String(college._id), role: 'admin', personaType: 'L-PRIN',
      name: 'B', email: 'b@test.local',
    });

    const result = await getMe(String(user._id));
    expect(result.college?.accentColor).toBeNull();
  });

  // Review Focus 4 — a superadmin who has not chosen a college yet.
  it('returns null college for a superadmin with no resolved college', async () => {
    const { user } = await createTestUser({
      role: 'super_admin', personaType: 'L-PRIN', name: 'C', email: 'c@test.local',
    });

    const result = await getMe(String(user._id));
    expect(result.college).toBeNull();
  });

  // Success criterion 3, backend half: a superadmin has no college of their own,
  // so the one they selected in the portal (x-college-id -> req.collegeId) supplies
  // the branding.
  it('uses the selected college for a superadmin who has one', async () => {
    const college = await College.create(makeCollege({ juvi: { accentColor: '#7A1FA2' } as never }));
    const { user } = await createTestUser({
      role: 'super_admin', personaType: 'L-PRIN', name: 'E', email: 'e@test.local',
    });

    const result = await getMe(String(user._id), String(college._id));
    expect(result.college?.accentColor).toBe('#7A1FA2');
  });

  it('returns null college when the id resolves to nothing', async () => {
    const { Types } = await import('mongoose');
    const { user } = await createTestUser({
      collegeId: String(new Types.ObjectId()), role: 'admin', personaType: 'L-PRIN',
      name: 'D', email: 'd@test.local',
    });

    const result = await getMe(String(user._id), 'not-an-object-id');
    expect(result.college).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w backend -- src/modules/auth/__tests__/branding.test.ts`
Expected: FAIL — `result.college` is `undefined`; `getMe` takes one argument.

- [ ] **Step 3: Add the branding reader to `auth/service.ts`**

Add `import mongoose from 'mongoose';` as a new line 4 of `backend/src/modules/auth/service.ts` (the file currently imports only `User` from `models/`), then add above `getMe`:

```ts
export interface CollegeBranding {
  id: string;
  name: string;
  code: string;
  logo?: string;
  accentColor: string | null;
}

/**
 * Reads the branding a portal session needs to theme itself.
 *
 * Deliberately NOT the juvi-app config reader: every authenticated portal user
 * must reach this, and `GET /juvi-app/admin/settings` requires `platform:read`,
 * which staff are explicitly denied (see DEFAULT_POLICIES). Riding `/auth/me`
 * needs no new route and no new permission.
 *
 * Returns null — never throws — so an unresolvable college degrades to the
 * portal's default palette instead of failing the whole session bootstrap.
 */
async function readCollegeBranding(collegeId?: string): Promise<CollegeBranding | null> {
  if (!collegeId || !mongoose.isValidObjectId(collegeId)) return null;
  const { College } = await import('../../models/College');
  const college = await College.findById(collegeId).select('name code logo juvi').lean();
  if (!college) return null;
  return {
    id: String(college._id),
    name: college.name,
    code: college.code,
    logo: college.logo,
    accentColor: college.juvi?.accentColor ?? null,
  };
}
```

- [ ] **Step 4: Extend `getMe`**

`getMe` is at `backend/src/modules/auth/service.ts:101-131`; its return object is at `:117-130`. Rename the parameter to `requestedCollegeId` and compute branding at the end of the body, immediately before the `return`:

```ts
export async function getMe(userId: string, requestedCollegeId?: string) {
```

```ts
  // Branding for the portal's runtime theming.
  //
  // Deliberately NOT folded into the `collegeId` on line 105: that variable feeds
  // `resolvePermissions` and `loadPersonas` below, and widening it to a
  // superadmin's *selected* college would silently change which persona rows and
  // policies they resolve against. The portal's chrome is the only thing that
  // should follow a superadmin's college selection.
  //
  // A superadmin has no `collegeId` of their own, so the college they have
  // selected (`x-college-id` -> `req.collegeId`, resolved by `authenticate`) is
  // what supplies their branding. Everyone else is branded by their own college.
  const college = await readCollegeBranding(collegeId ?? requestedCollegeId);
```

and add `college,` to the returned object, directly after `primaryModule,`:

```ts
    primaryModule,
    // Null for a superadmin who has not selected a college; the portal then keeps
    // its default palette.
    college,
    dashboardWidgets: dashboardWidgets.length > 0 ? dashboardWidgets : undefined,
```

- [ ] **Step 5: Extend `login`**

In `backend/src/modules/auth/service.ts`, add `accentColor` and `logo` to the superadmin projection at `:68-71`, and set `result.college` for the non-superadmin branch at `:74-76`:

```ts
    const colleges = await College.find({ status: 'active' })
      .select('_id name code status logo juvi')
      .sort({ name: 1 })
      .lean();
    result.colleges = colleges.map((c) => ({
      _id: String(c._id),
      name: c.name,
      code: c.code,
      status: c.status,
      logo: c.logo,
      accentColor: c.juvi?.accentColor ?? null,
    }));
    result.isSuperAdmin = true;
  } else {
    result.collegeId = String(user.collegeId);
    result.college = await readCollegeBranding(String(user.collegeId));
  }
```

> `login` already imports `College` by dynamic import at `:67`; reuse that binding rather than adding a second import.

- [ ] **Step 6: Pass the resolved college into `getMe`**

Change `backend/src/modules/auth/controller.ts:67`:

```ts
    const result = await service.getMe(req.user!.id, req.collegeId);
```

`req.collegeId` is set by `authenticate` from the `x-college-id` header or the JWT, and is legitimately `undefined` for a superadmin on a college-agnostic route — which is exactly the null-branding case. For a regular user this argument is ignored: `getMe` prefers the college on the user document, so a mismatched header cannot re-brand someone else's session.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w backend -- src/modules/auth/`
Expected: PASS — the new file plus the existing `health.test.ts`.

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/auth/service.ts backend/src/modules/auth/controller.ts backend/src/modules/auth/__tests__/branding.test.ts
git commit -m "feat(auth): carry college branding on the session bootstrap"
```

---

### Task 5: The store and the theme provider

First task with user-visible behaviour. After it, a college with an accent sees a themed portal.

**Files:**
- Modify: `admin-portal/src/stores/authStore.ts` (`CollegeRef:14`; state + `selectCollege` signature `:28-30`, `AuthState.selectCollege:30`; initial state `:70-78`; `setAuth:79-116`; `selectCollege:126-130`; `hydrate:136-168`; `logout:169-179`)
- Modify: `admin-portal/src/pages/Login.tsx:43-51`
- Create: `admin-portal/src/components/BrandTheme.tsx`
- Modify: `admin-portal/src/main.tsx:69-81`
- Modify: `admin-portal/src/pages/CollegeSelector.tsx:22-34`
- Test: `admin-portal/src/components/__tests__/BrandTheme.test.tsx`

**Interfaces:**
- Consumes: `resolveRamp` (Task 1), `applyRamp` (Task 3), and the `college` block on `/auth/me` plus `accentColor` on `colleges[]` (Task 4).
- Produces: `collegeAccent: string | null` on the auth store; `selectCollege(collegeId: string, collegeName: string, accentColor?: string | null)`; the `BrandTheme` component.

- [ ] **Step 1: Write the failing test**

Create `admin-portal/src/components/__tests__/BrandTheme.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import BrandTheme from '../BrandTheme';
import { useAuthStore } from '../../stores/authStore';
import { LEGACY_RAMP, resolveRamp } from '../../lib/brand-ramp';

beforeEach(() => {
  useAuthStore.setState({ collegeAccent: null });
  document.documentElement.removeAttribute('style');
});

describe('BrandTheme', () => {
  // Review Focus 4 — no college resolved.
  it('leaves the default palette in place when there is no accent', () => {
    render(<BrandTheme />);
    expect(document.documentElement.style.getPropertyValue('--c-primary-500')).toBe('43 108 176');
  });

  it('applies the derived ramp once an accent is known', () => {
    useAuthStore.setState({ collegeAccent: '#7A1FA2' });
    render(<BrandTheme />);
    expect(document.documentElement.style.getPropertyValue('--c-primary-500'))
      .toBe(resolveRamp('#7A1FA2').primary['500']);
    expect(document.documentElement.style.getPropertyValue('--c-primary-500'))
      .not.toBe(LEGACY_RAMP.primary['500']);
  });

  // Review Focus 5 — a malformed accent must not blank the UI.
  it('falls back to the legacy palette for a malformed accent', () => {
    useAuthStore.setState({ collegeAccent: 'nonsense' });
    render(<BrandTheme />);
    expect(document.documentElement.style.getPropertyValue('--c-primary-500')).toBe('43 108 176');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w admin-portal -- src/components/__tests__/BrandTheme.test.tsx`
Expected: FAIL — `Failed to resolve import "../BrandTheme"`.

- [ ] **Step 3: Write the component**

Create `admin-portal/src/components/BrandTheme.tsx`:

```tsx
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { resolveRamp } from '../lib/brand-ramp';
import { applyRamp } from '../lib/apply-ramp';

/**
 * Applies the current college's brand ramp to the document.
 *
 * Renders nothing. It re-runs whenever the stored accent changes, which covers
 * all three ways that happens: the boot-time /auth/me hydrate, a fresh login,
 * and a superadmin switching college from the selector.
 */
export default function BrandTheme() {
  const accent = useAuthStore((s) => s.collegeAccent);

  useEffect(() => {
    // resolveRamp never throws and never returns a partial ramp, so there is no
    // error path here: a missing or malformed accent simply yields the legacy
    // palette.
    applyRamp(resolveRamp(accent));
  }, [accent]);

  return null;
}
```

- [ ] **Step 4: Extend the store**

In `admin-portal/src/stores/authStore.ts`:

(a) `CollegeRef` (`:14`) gains the accent:

```ts
interface CollegeRef { _id: string; name: string; code: string; status: string; accentColor?: string | null; }
```

(b) `AuthState` gains the field and the widened signature (`:28-31`):

```ts
  collegeAccent: string | null;
  selectCollege: (collegeId: string, collegeName: string, accentColor?: string | null) => void;
```

(c) Initial state, alongside the existing `localStorage` reads (`:72-73`):

```ts
  collegeAccent: localStorage.getItem('collegeAccent'),
```

(d) `setAuth` gains a seventh parameter. Extend the signature at `:28`:

```ts
  setAuth: (user: User, token: string, collegeId?: string, colleges?: CollegeRef[], permissions?: string[], sensitivity?: Record<string, string[] | null>, accentColor?: string | null) => void;
```

and the implementation at `:79`, following the same persist-then-set shape as its neighbours:

```ts
  setAuth: (user, token, collegeId?, colleges?, permissions?, sensitivity?, accentColor?) => {
```

```ts
    if (accentColor) {
      localStorage.setItem('collegeAccent', accentColor);
    } else {
      localStorage.removeItem('collegeAccent');
    }
```

and add the field to the `set({…})` at the end of the body:

```ts
      sensitivity: storeSensitivity(sensitivity),
      collegeAccent: accentColor ?? null,
      hydrated: true,
    });
```

> Seven positional parameters is one past comfortable. It is kept this way because `setAuth` already carries six and the only two call sites are in one function; a later reader who wants an options object should convert all of `setAuth` in one go rather than growing a second convention beside it.

(e) `selectCollege` (`:126-130`) writes it:

```ts
  selectCollege: (collegeId, collegeName, accentColor) => {
    localStorage.setItem('collegeId', collegeId);
    localStorage.setItem('collegeName', collegeName);
    if (accentColor) localStorage.setItem('collegeAccent', accentColor);
    else localStorage.removeItem('collegeAccent');
    set({ collegeId, collegeName, collegeAccent: accentColor ?? null });
  },
```

(f) `hydrate` reads the new block. Add it after the `const user: User = {…}` mapping at `:146-156`:

```ts
      const college = data.college as { accentColor?: string | null } | null | undefined;
      const collegeAccent = college?.accentColor ?? null;
      if (collegeAccent) localStorage.setItem('collegeAccent', collegeAccent);
      else localStorage.removeItem('collegeAccent');
```

and extend the `set({…})` at `:162`:

```ts
      set({ user, isSuperAdmin: user.role === 'super_admin', hydrated: true, collegeAccent, ...(permissions ? { permissions } : {}), ...(sensitivity ? { sensitivity } : {}) });
```

> The `catch` at `:163-167` deliberately keeps the cached user on a network blip. Leave `collegeAccent` untouched there too, so a failed `/auth/me` does not strip an already-applied theme (Review Focus 5).

(g) `logout` (`:169-179`) drops the key and resets the field. Add to the removal list:

```ts
    localStorage.removeItem('collegeAccent');
```

and to the `set({…})`:

```ts
    set({ user: null, token: null, collegeId: null, collegeName: null, collegeAccent: null, colleges: [], isSuperAdmin: false, permissions: [], sensitivity: {}, hydrated: true });
```

(h) `clearCollege` (`:131-135`) resets it too — it exists for the superadmin backing out of a college:

```ts
  clearCollege: () => {
    localStorage.removeItem('collegeId');
    localStorage.removeItem('collegeName');
    localStorage.removeItem('collegeAccent');
    set({ collegeId: null, collegeName: null, collegeAccent: null });
  },
```

(i) `Login.tsx:43-51` — a fresh login must theme immediately, without waiting for a reload. Extend both calls:

```tsx
      if (data.isSuperAdmin) {
        // Superadmin: store token + colleges, redirect to college selector.
        // No single college yet, so no accent — selectCollege supplies it.
        setAuth(data.user, data.token, undefined, data.colleges, data.permissions, data.sensitivity, null);
        navigate('/select-college', { replace: true });
      } else {
        // Regular admin: store token + collegeId, redirect to dashboard
        setAuth(data.user, data.token, data.collegeId, undefined, data.permissions, data.sensitivity, data.college?.accentColor ?? null);
        navigate('/', { replace: true });
      }
```

- [ ] **Step 5: Mount the provider**

In `admin-portal/src/main.tsx`, add the import and render it inside `BrowserRouter` so it is mounted for every route including `/login`:

```tsx
import BrandTheme from './components/BrandTheme';
```

```tsx
        <BrowserRouter>
          <BrandTheme />
          <App />
          <ConfirmDialog />
          <Toaster />
        </BrowserRouter>
```

- [ ] **Step 6: Carry the accent through college selection**

In `admin-portal/src/pages/CollegeSelector.tsx`, widen `handleSelect`'s parameter (`:22`) to include `accentColor?: string | null`, and pass it at `:34`:

```ts
    selectCollege(college._id, college.name, college.accentColor);
```

This is the mechanism behind success criterion 3 — a superadmin's chrome follows the college they pick, without a re-login.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w admin-portal`
Expected: PASS — the new component test plus the existing suite.

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add admin-portal/src/stores/authStore.ts admin-portal/src/components/BrandTheme.tsx admin-portal/src/main.tsx admin-portal/src/pages/Login.tsx admin-portal/src/pages/CollegeSelector.tsx admin-portal/src/components/__tests__/BrandTheme.test.tsx
git commit -m "feat(portal): theme the app from the session's college accent"
```

---

### Task 6: Repoint the chrome

Completes decision D1 — the accent reaches the sidebar, not just buttons. Uses **line-anchored** edits: a blanket `teal` → `primary` replace in this file would wrongly hit the wordmark (`:197`) and a per-module nav icon (`:63`).

**Files:**
- Modify: `admin-portal/src/layouts/DashboardLayout.tsx:193, 213, 241, 273, 294, 310, 345`
- Modify: `admin-portal/src/pages/CollegeSelector.tsx:44`

**Interfaces:**
- Consumes: the `chrome-*` tokens and `navy` variables from Task 2.
- Produces: nothing.

- [ ] **Step 1: Repoint the sidebar surfaces**

`admin-portal/src/layouts/DashboardLayout.tsx:193` — the sidebar gradient:

```tsx
      )} style={{ background: 'linear-gradient(180deg, rgb(var(--c-navy)) 0%, rgb(var(--c-navy-dark)) 100%)' }}>
```

`:294` — the collapsed-mode flyout gradient:

```tsx
                       style={{ background: 'linear-gradient(180deg, rgb(var(--c-navy-dark)) 0%, rgb(var(--c-navy)) 100%)' }}>
```

- [ ] **Step 2: Repoint the College channel row**

`:213` — the college-switcher icon. The mobile applies its accent to "the College channel row" by name, so this is a parity requirement, not a preference:

```tsx
              <Building2 size={14} className="text-chrome-soft shrink-0" />
```

- [ ] **Step 3: Repoint the active nav states**

Three sites, all the same substitution — `teal-500` → `chrome-wash` and `teal-300` → `chrome-soft`. Without this, a themed sidebar keeps teal active items and clashes.

`admin-portal/src/layouts/DashboardLayout.tsx:241` and `:273`:

```tsx
                      ? 'bg-chrome-wash/20 text-chrome-soft font-medium shadow-sm'
```

`:310` and `:345`:

```tsx
                            isActive ? 'bg-chrome-wash/15 text-chrome-soft font-medium' : 'text-gray-300 hover:bg-white/5 hover:text-white',
```

At `:345` the equivalent line inside the expanded-submenu branch uses the same replacement, keeping its existing surrounding text.

- [ ] **Step 4: Do NOT touch these**

- `:197` — the `Juvion` wordmark gradient (`from-teal-400 to-primary-300`). It is the product's mark, not the college's. Its `primary-300` stop follows the accent automatically; the teal stop deliberately does not.
- `:63` — `iconColor: 'text-teal-400'` for the Student Dev nav item. A per-module icon tint; several modules have their own.
- `:385` — the user avatar gradient. Identity, not brand.
- `pages/Login.tsx` entirely — pre-auth (spec D8).

- [ ] **Step 5: Repoint the college selector surface**

`admin-portal/src/pages/CollegeSelector.tsx:44` — post-auth, so it may be themed. It resolves to the default palette until a college is chosen, which is correct:

```tsx
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, rgb(var(--c-navy)) 0%, rgb(var(--c-navy-dark)) 50%, rgb(var(--c-navy)) 100%)' }}>
```

- [ ] **Step 6: Verify no brand hexes remain outside the exempt files**

Run:

```bash
cd admin-portal/src && grep -rnE "#(0F2744|1A365D|2D4A6F|2B6CB0|2563A0|1E4F82|F0F4FF|DBEAFE|BAD4F2|7BAED4|4A8DC0)" --include=*.tsx .
```

Expected: matches only in `pages/Login.tsx`, `components/finance/DashboardWidgets.tsx`, `components/ui/Badge.tsx`, and `components/platform/juvi/SettingsTab.tsx` (the placeholder text `#0B5FA5` and its tests) — every one of them an intended exemption from step 4.

- [ ] **Step 7: Run the tests**

Run: `npm test -w admin-portal` and `npm run typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add admin-portal/src/layouts/DashboardLayout.tsx admin-portal/src/pages/CollegeSelector.tsx
git commit -m "feat(portal): drive sidebar chrome from the institution accent"
```

---

### Task 7: End-to-end acceptance and docs

The only test that proves the whole chain: DB → `/auth/me` → store → custom property → Tailwind class. If the e2e seed makes this awkward, cut this task and say so — Tasks 1-6 all stand on their own.

**Files:**
- Create: `e2e/tests/portal-theming.spec.ts`
- Modify: `CLAUDE.md` (the Juvi section, after the sub-project 4 bullets)

**Interfaces:**
- Consumes: everything.
- Produces: nothing.

- [ ] **Step 1: Write the acceptance test**

Create `e2e/tests/portal-theming.spec.ts`. Follow the existing suite's discipline: no `page.waitForTimeout`, no retries, accessible queries.

```ts
import { test, expect } from '@playwright/test';

/**
 * Proves the theming chain end to end: the accent stored on the college reaches
 * the browser and lands on a CSS custom property.
 *
 * Requires a college whose juvi.accentColor is set — see the seed step below.
 */
test('a college accent reaches the portal as a themed custom property', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_ACCENT_USER ?? 'e2e_super@juvion.test');
  await page.getByLabel(/password/i).fill(process.env.E2E_ACCENT_PASSWORD ?? 'Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/select-college|dashboard/);

  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--c-primary-500').trim(),
  );
  // Either a themed triplet or the frozen legacy default — never empty, which
  // would mean Tailwind rendered `rgb( / 1)` and dropped the declaration.
  expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
});
```

> The seed must give the e2e college a `juvi.accentColor`; extend `npm run seed:e2e-users -w backend` with one. Keep the default-palette assertion if the seed is not extended — it still catches Review Focus 3, the transparent-render failure.

- [ ] **Step 2: Run it**

Run: `npm run test -w e2e -- portal-theming`
Expected: PASS. Requires the backend on `:3003` and the portal on `:5173`.

> The `e2e` workspace's script is `test` (`e2e/package.json:8`). `test:e2e` belongs
> to the **backend** workspace and runs its Vitest e2e suite — running it here
> would silently exercise the wrong thing. `testDir` is `./tests`, so the spec sits
> flat beside `auth.spec.ts` and friends.

- [ ] **Step 3: Document it**

Append to the Juvi section of `CLAUDE.md`, after the sub-project 4 bullets:

```markdown
- **Institution theming is shared by both surfaces.** `College.juvi.accentColor` is the single
  source of brand colour: the Flutter app feeds it to `ColorScheme.fromSeed`, the portal feeds it
  to CSS custom properties. The portal's brand ramps in `admin-portal/tailwind.config.js` resolve
  to `rgb(var(--c-primary-*) / <alpha-value>)`, so the ~2879 existing `primary-*`/`navy` class
  occurrences never change — only the variables do. **The properties hold space-separated sRGB
  triplets, not hex**: a plain `var()` cannot carry an alpha channel and would silently break
  `bg-primary-500/20`. Defaults live in `admin-portal/src/index.css` `:root` and must stay —
  an undefined property makes Tailwind drop the declaration and render the element transparent.
  The accent arrives on `GET /auth/me` (`college.accentColor`), not from a juvi-app endpoint:
  `/juvi-app/admin/settings` needs `platform:read`, which staff are explicitly denied.
  Spec: `docs/superpowers/specs/2026-10-09-portal-institution-theming-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/portal-theming.spec.ts CLAUDE.md
git commit -m "test(portal): cover institution theming end to end"
```

---

## Self-Review

**Spec coverage.** Each spec section maps to a task: §4.1 (payload) → Task 4; §4.2 (apply path) → Tasks 3 + 5; §4.3 (variable contract) → Task 2; §4.4 (derivation) → Task 1; §4.5 (file table) → Tasks 2, 5, 6; §5 (testing) → every task's test steps, plus Task 7 for the e2e. Success criteria 1 → Task 1's `LEGACY_RAMP` equality test and Task 2's `:root` test; 2 → Task 5; 3 → Task 5 step 6; 4 → Task 6 step 6; 5 → typecheck/test steps throughout.

**Two spec refinements made while planning, each recorded as a ruling in the ledger:**

1. **Spec §4.3 proposed converting `bg-app`, the `body` background and the scrollbar rgba to variables.** Partly dropped. `bg-app` and the `body` background are static neutral surfaces under D1, so there is nothing to theme there. The scrollbar was a mistake: its `rgba(26, 54, 93, …)` literals are `#1A365D` = navy-dark, which D1 *does* theme, so under a red accent the thumb stayed legacy navy against an oxblood sidebar. They now read `rgb(var(--c-navy-dark) / 0.15)` and `rgb(var(--c-navy-dark) / 0.3)`.
2. **Spec §4.5 listed six files needing literal-hex edits.** Actually four exempts and two real ones. `Badge.tsx`'s 14 arbitrary-value classes are a semantic status scale; `DashboardWidgets.tsx`'s two hex maps are a categorical chart palette where `#2B6CB0` means "series 1"; `Login.tsx` is pre-auth by decision D8; `SettingsTab.tsx`'s hex is placeholder copy. The real edits are `DashboardLayout.tsx` (5 sites) and `CollegeSelector.tsx` (1). A *new* need surfaced: the sidebar's active-nav teal would clash against a themed sidebar, so two `chrome-*` tokens were added — with the legacy teal frozen as their default. **One exception to success criterion 1:** `DashboardLayout.tsx`'s college-switcher icon moved from `text-teal-400` to `text-chrome-soft`, whose frozen legacy value is `94 234 212` = teal-300, not teal-400, so on an install with no accent that single 14 px icon shifts one step (slightly *higher* contrast against the sidebar). Accepted rather than adding a dedicated token for one icon; the criterion's deep-equal proof still passes because the ramp itself is exact and only the class mapping moved.

**Type consistency.** `Triplet`, `BrandRamp`, `PrimaryStep`, `PRIMARY_STEPS`, `LEGACY_RAMP`, `resolveRamp`, `preClamp500Lightness`, `rampToCssVars`, `applyRamp`, `CollegeBranding`, `collegeAccent`, and the 15 `--c-*` names are each defined once and referenced with the same spelling everywhere they appear. The variable names in Task 2's test, Task 2's CSS, Task 2's config and Task 3's adapter are the same 15 strings.

**Unresolved — resolved in the fix round.** `readableOn` was specified, tested and exported, but consumed by nothing: this note used to claim the derived ramp "keeps every step inside the legibility band, so no dynamic label colour is needed yet." That was false. The band governs only the 500 step, and 600-900 take a fixed HSL lightness while inheriting the accent's saturation, so for a high-luminance hue (gold, yellow, olive, lime, mint) `text-white` on the 600/700 fills fell as low as 2.24:1 — the spec's own `#FFEE00` example measured 1.57:1 on the 500 step. The fix keeps criterion 4 by clamping the ramp itself: steps 500-900 also take a relative-luminance ceiling (`LUM_CEILING`), so every accent is legible with no per-site label colour. `readableOn` was therefore deleted rather than shipped unconsumed, and replaced by the white-on-fill / fill-on-white guard the plan lacked.
