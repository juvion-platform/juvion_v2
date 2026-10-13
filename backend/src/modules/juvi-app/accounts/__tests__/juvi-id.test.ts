import { describe, it, expect } from 'vitest';
import { CANONICAL_JUVI_ID, formatJuviId, mintJuviId, normaliseJuviId } from '../juvi-id';

describe('juvi-id', () => {
  it('normalises case, spaces, hyphens and stray punctuation to one canonical value', () => {
    expect(normaliseJuviId('juv 4k7p 2m9x')).toBe('JUV4K7P2M9X');
    expect(normaliseJuviId('JUV-4K7P-2M9X')).toBe('JUV4K7P2M9X');
    expect(normaliseJuviId('  juv4k7p2m9x  ')).toBe('JUV4K7P2M9X');
    expect(normaliseJuviId('j.u.v-4k7p_2m9x')).toBe('JUV4K7P2M9X');
  });

  it('leaves a roll number that cannot be a Juvi ID failing the canonical shape', () => {
    expect(normaliseJuviId('21CS1042')).toBe('21CS1042');
    expect(CANONICAL_JUVI_ID.test(normaliseJuviId('21CS1042'))).toBe(false);
  });

  it('mints JUV plus eight Crockford characters, never I, L, O or U', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = mintJuviId();
      expect(id).toMatch(/^JUV[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
      expect(CANONICAL_JUVI_ID.test(id)).toBe(true);
    }
  });

  it('formats a canonical id for display, and the display form normalises back', () => {
    expect(formatJuviId('JUV4K7P2M9X')).toBe('JUV-4K7P-2M9X');
    expect(normaliseJuviId(formatJuviId('JUV4K7P2M9X'))).toBe('JUV4K7P2M9X');
  });
});
