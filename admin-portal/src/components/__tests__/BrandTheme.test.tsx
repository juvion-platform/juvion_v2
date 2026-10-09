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
