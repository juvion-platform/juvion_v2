import { describe, it, expect } from 'vitest';
import { nextOccurrence, formatNextClassLabel } from '../next-class';

// 2026-09-22T04:30:00Z is Tuesday 10:00 in Asia/Kolkata.
const NOW = new Date('2026-09-22T04:30:00Z');
const TZ = 'Asia/Kolkata';

describe('nextOccurrence', () => {
  it('picks the earliest future slot across the week', () => {
    const at = nextOccurrence([{ day: 'friday', startTime: '14:00' }, { day: 'wednesday', startTime: '09:00' }], NOW, TZ);
    expect(at?.toISOString()).toBe('2026-09-23T03:30:00.000Z');
  });
  it('a slot later today wins over tomorrow', () => {
    expect(nextOccurrence([{ day: 'tuesday', startTime: '11:00' }, { day: 'wednesday', startTime: '08:00' }], NOW, TZ)?.toISOString()).toBe('2026-09-22T05:30:00.000Z');
  });
  it('a slot earlier today rolls to next week; a slot starting now counts as now', () => {
    expect(nextOccurrence([{ day: 'tuesday', startTime: '09:00' }], NOW, TZ)?.toISOString()).toBe('2026-09-29T03:30:00.000Z');
    expect(nextOccurrence([{ day: 'tuesday', startTime: '10:00' }], NOW, TZ)?.toISOString()).toBe('2026-09-22T04:30:00.000Z');
  });
  it('ignores malformed slots and returns null when nothing is usable', () => {
    expect(nextOccurrence([{ day: 'funday', startTime: '10:00' }, { day: 'monday', startTime: 'x' }], NOW, TZ)).toBeNull();
    expect(nextOccurrence([], NOW, TZ)).toBeNull();
  });
});

describe('formatNextClassLabel', () => {
  it('says Today, Tomorrow, or the weekday', () => {
    expect(formatNextClassLabel(new Date('2026-09-22T05:30:00Z'), NOW, TZ)).toBe('Next: Today 11:00');
    expect(formatNextClassLabel(new Date('2026-09-23T03:30:00Z'), NOW, TZ)).toBe('Next: Tomorrow 09:00');
    expect(formatNextClassLabel(new Date('2026-09-25T08:30:00Z'), NOW, TZ)).toBe('Next: Fri 14:00');
  });
});
