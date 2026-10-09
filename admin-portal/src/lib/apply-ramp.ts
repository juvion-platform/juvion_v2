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
