import { describe, it, expect } from 'vitest';
import { formatNextClassLabel } from '../next-class';

// 2026-09-22T04:30:00Z is Tuesday 10:00 in Asia/Kolkata.
const NOW = new Date('2026-09-22T04:30:00Z');
const TZ = 'Asia/Kolkata';

describe('formatNextClassLabel', () => {
  it('says Today, Tomorrow, or the weekday', () => {
    expect(formatNextClassLabel(new Date('2026-09-22T05:30:00Z'), NOW, TZ)).toBe('Next: Today 11:00');
    expect(formatNextClassLabel(new Date('2026-09-23T03:30:00Z'), NOW, TZ)).toBe('Next: Tomorrow 09:00');
    expect(formatNextClassLabel(new Date('2026-09-25T08:30:00Z'), NOW, TZ)).toBe('Next: Fri 14:00');
  });
});
