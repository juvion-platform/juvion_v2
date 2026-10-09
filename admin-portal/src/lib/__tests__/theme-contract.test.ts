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
