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
