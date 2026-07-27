import { describe, it, expect } from 'vitest';
import { isRangeInverted, rangeError, requiredWhenStatus } from '../validation';

describe('rangeError', () => {
  it('accepts an ordered date range', () => {
    expect(rangeError('2026-01-01', '2026-01-05')).toBeNull();
  });

  it('rejects end before start — the exam schedule bug', () => {
    expect(rangeError('14:00', '10:00', { startLabel: 'start time', endLabel: 'end time' }))
      .toBe('The end time cannot be before the start time.');
  });

  it('rejects an identical start and end by default', () => {
    expect(rangeError('10:00', '10:00')).toMatch(/must be after/);
  });

  it('allows equal bounds when the caller opts in', () => {
    expect(rangeError('2026-01-01', '2026-01-01', { allowEqual: true })).toBeNull();
  });

  it('stays silent until both bounds are supplied', () => {
    expect(rangeError('', '2026-01-05')).toBeNull();
    expect(rangeError('2026-01-01', '')).toBeNull();
  });
});

describe('isRangeInverted', () => {
  it('compares ISO dates and HH:mm lexically', () => {
    expect(isRangeInverted('2026-02-01', '2026-01-01')).toBe(true);
    expect(isRangeInverted('09:00', '17:00')).toBe(false);
  });
});

describe('requiredWhenStatus', () => {
  const FILED = ['filed', 'approved'];

  it('requires the value once the status asserts completion', () => {
    expect(requiredWhenStatus('', 'filed', FILED, 'Filed Date'))
      .toBe('Filed Date is required when status is “filed”.');
  });

  it('passes when the value is present', () => {
    expect(requiredWhenStatus('2026-01-01', 'filed', FILED, 'Filed Date')).toBeNull();
  });

  it('ignores statuses outside the list', () => {
    expect(requiredWhenStatus('', 'upcoming', FILED, 'Filed Date')).toBeNull();
  });
});
