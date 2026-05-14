import { describe, it, expect } from 'vitest';

import { deriveLeadGrade } from '../grade';

/**
 * 001-ai-lead-scoring — Task 2.1
 * Four-grade thresholds per spec §3 and GATE 3 B-1 resolution:
 *   ≥80 hot, 60–79 warm, 40–59 cold, <40 dormant.
 *
 * This REPLACES the old 3-grade helper that lived in workflow.handlers.ts.
 */

describe('deriveLeadGrade', () => {
  it('returns "hot" for scores >= 80', () => {
    expect(deriveLeadGrade(80)).toBe('hot');
    expect(deriveLeadGrade(95)).toBe('hot');
    expect(deriveLeadGrade(100)).toBe('hot');
  });

  it('returns "warm" for scores 60..79', () => {
    expect(deriveLeadGrade(60)).toBe('warm');
    expect(deriveLeadGrade(70)).toBe('warm');
    expect(deriveLeadGrade(79)).toBe('warm');
  });

  it('returns "cold" for scores 40..59', () => {
    expect(deriveLeadGrade(40)).toBe('cold');
    expect(deriveLeadGrade(50)).toBe('cold');
    expect(deriveLeadGrade(59)).toBe('cold');
  });

  it('returns "dormant" for scores < 40', () => {
    expect(deriveLeadGrade(0)).toBe('dormant');
    expect(deriveLeadGrade(20)).toBe('dormant');
    expect(deriveLeadGrade(39)).toBe('dormant');
  });

  it('returns undefined when score is undefined', () => {
    expect(deriveLeadGrade(undefined)).toBeUndefined();
  });

  it('clamps out-of-range inputs sensibly (defensive)', () => {
    expect(deriveLeadGrade(150)).toBe('hot');
    expect(deriveLeadGrade(-10)).toBe('dormant');
  });
});
