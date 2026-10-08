import { describe, expect, it } from 'vitest';
import {
  ymd, dayEnumOf, startOfDay, addDays, diffDays, instantOf, hhmmToMinutes, overlaps,
} from '../timetable-date';

describe('ymd', () => {
  it('formats the instant in the zone, not UTC', () => {
    // 2026-10-08T18:30:00Z is already 2026-10-09 00:00 in Asia/Kolkata.
    expect(ymd(new Date('2026-10-08T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-10-09');
    expect(ymd(new Date('2026-10-08T18:30:00Z'), 'UTC')).toBe('2026-10-08');
  });
  it('never returns a slashed or partial date', () => {
    expect(ymd(new Date('2026-01-01T00:00:00Z'), 'Pacific/Auckland')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dayEnumOf', () => {
  it('maps calendar dates to lowercase day enums (2026-01-01 is a Thursday)', () => {
    expect(dayEnumOf('2026-01-01')).toBe('thursday');
    expect(dayEnumOf('2026-01-03')).toBe('saturday');
    expect(dayEnumOf('2026-01-04')).toBe('sunday');
  });
});

describe('startOfDay', () => {
  it('returns the midnight instant of the zoned date', () => {
    expect(startOfDay('2026-01-01', 'Asia/Kolkata').toISOString()).toBe('2025-12-31T18:30:00.000Z');
  });
});

describe('addDays / diffDays', () => {
  it('wraps months and compares', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-10-08', 14)).toBe('2026-10-22');
    expect(diffDays('2026-10-09', '2026-10-08')).toBe(1);
    expect(diffDays('2026-10-08', '2026-10-09')).toBe(-1);
  });
});

describe('instantOf', () => {
  it('resolves a zoned wall-clock instant', () => {
    expect(instantOf('2026-01-01', '09:00', 'Asia/Kolkata').toISOString()).toBe('2026-01-01T03:30:00.000Z');
    expect(instantOf('2026-01-01', '07:00', 'America/New_York').toISOString()).toBe('2026-01-01T12:00:00.000Z');
  });
});

describe('hhmmToMinutes / overlaps', () => {
  it('treats touching slots as non-overlapping and inverted ranges as empty', () => {
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(overlaps('09:00', '10:00', '09:30', '11:00')).toBe(true);
    expect(overlaps('09:00', '10:00', '10:00', '11:00')).toBe(false); // strict overlap
    expect(overlaps('10:00', '09:00', '09:30', '10:30')).toBe(false); // degenerate
  });
});
