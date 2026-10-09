import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_RAMP, PRIMARY_STEPS, type Triplet } from '../brand-ramp';

// Read as text rather than imported. `tsconfig.json` includes only "src" and does
// not set allowJs, so importing '../../../tailwind.config.js' would fail
// `npm run typecheck` with TS2307. The wiring is a literal contract either way.
//
// The paths are hoisted into consts deliberately: Vite's asset-URL transform
// rewrites `new URL('<string literal>', import.meta.url)` into a bundler-resolved
// asset URL and discards the base, so the literal form yields an http:// URL and
// node:fs throws ERR_INVALID_URL_SCHEME at module evaluation. Keep them runtime
// expressions — do not inline the strings back into the `new URL` calls.
const TAILWIND_CONFIG = '../../../tailwind.config.js';
const INDEX_CSS = '../../index.css';

const tailwindSrc = readFileSync(new URL(TAILWIND_CONFIG, import.meta.url), 'utf8');
const css = readFileSync(new URL(INDEX_CSS, import.meta.url), 'utf8');

/** True when `key` is mapped to the custom property `varName`. */
function wired(key: string, varName: string): boolean {
  return new RegExp(`${key}\\s*:\\s*'rgb\\(var\\(--${varName}\\) / <alpha-value>\\)'`).test(tailwindSrc);
}

/** Reads a custom property's value out of the `:root` block. */
function rootVar(name: string): string | undefined {
  const root = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1];
  return root ? new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(root)?.[1]?.trim() : undefined;
}

/**
 * Parses a named semantic colour ramp out of the config source, keyed by step.
 *
 * A step repointed at `rgb(var(...))` does not match the hex pattern, so it drops
 * out of the object and the equality fails — which is the mutation the old
 * spot-checks missed.
 */
function semanticRamp(name: string): Record<string, string> {
  const block = new RegExp(`${name}\\s*:\\s*\\{([\\s\\S]*?)\\}`).exec(tailwindSrc)?.[1] ?? '';
  const ramp: Record<string, string> = {};
  for (const [, key, hex] of block.matchAll(/(\w+)\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) ramp[key!] = hex!;
  return ramp;
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
    // Equality on the whole ramp, not a spot-check: the old form asserted a
    // handful of hexes anywhere in the file, so a mutation repointing a single
    // step (`teal-300`, say) at a custom property passed every case.
    expect(semanticRamp('teal')).toEqual({
      50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
      500: '#38B2AC', 600: '#2C9A94', 700: '#0F766E', 800: '#115E59', 900: '#134E4A',
    });
    expect(semanticRamp('accent')).toEqual({
      50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA',
      500: '#6C3BE4', 600: '#5B21B6', 700: '#4C1D95', 800: '#3B0764', 900: '#2E1065',
    });
    expect(semanticRamp('orange')).toEqual({
      50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C',
      500: '#FF6B35', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412', 900: '#7C2D12',
    });
    // `bg-app` is a single neutral surface, not a ramp — same hex as shipped.
    expect(/'bg-app'\s*:\s*'(#[0-9A-Fa-f]{6})'/.exec(tailwindSrc)?.[1]).toBe('#F0F4F8');
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
