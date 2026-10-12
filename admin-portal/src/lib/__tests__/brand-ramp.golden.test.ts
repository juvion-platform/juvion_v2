import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRIMARY_STEPS, resolveRamp } from '../brand-ramp';

/**
 * Resolved from `process.cwd()`, which is the package root under this repo's
 * documented invocation (`npm test -w admin-portal`, from the repository root).
 *
 * Not `import.meta.url`: vitest's `vmThreads` pool serves modules over a
 * dev-server URL, so `fileURLToPath(import.meta.url)` throws
 * "The URL must be of scheme file" before a single test runs.
 */
const GOLDEN_PATH = path.resolve(process.cwd(), 'src/lib/brand-ramp.golden.json');

/**
 * The accents the Dart port is pinned against.
 *
 * The extremes earn their place rather than padding the list: `#FFEE00` and
 * `#FFFFFF` exercise the relative-luminance ceiling and the achromatic branch,
 * `#7F8080` sits just above the near-grey threshold, `#0F172A` is a dark accent
 * whose own lightness sits below the 500 step's clamp band, and `null` is the
 * no-accent path the phone renders as the legacy palette.
 *
 * `#3333FF` is here for a subtler reason, and it was measured rather than
 * guessed: of the 217 accents whose HSL lightness falls in (0.58, 0.60], only
 * 23 produce a different 500 step when `L500_MAX` moves between 0.58 and 0.60 —
 * every other one is pulled to the same value by the relative-luminance ceiling,
 * which converges on its bound whatever lightness it started from. Without one
 * of those 23 in the list the fixture silently fails to cover the upper end of
 * the clamp band, and a port with a wrong `L500_MAX` passes. Blue-dominant and
 * bright enough to stay under the step-500 ceiling (0.170) is what makes it one.
 */
export const GOLDEN_ACCENTS: (string | null)[] = [
  null, '#0B5FA5', '#FFEE00', '#FFFFFF', '#7F8080', '#0F172A', '#3333FF', '#C62828', '#2E7D32', '#663399',
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
