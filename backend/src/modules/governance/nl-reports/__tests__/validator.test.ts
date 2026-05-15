import { describe, it, expect } from 'vitest';

import { validateMatchedOutput } from '../validator';

/**
 * 003-nl-report-queries Task 3.2 — semantic validator.
 *
 * Allow-list is enforced upstream by the parser's Zod enum; this layer
 * adds runtime checks for param shape and date bounds per spec §10.9.
 */

const today = new Date('2026-05-14T10:00:00Z');

describe('validateMatchedOutput — admissions-funnel / lead-source-performance', () => {
  it('accepts a valid from/to range', () => {
    const r = validateMatchedOutput(
      { reportCode: 'admissions-funnel', params: { from: '2026-04-01', to: '2026-04-30' } },
      today,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.params).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  it('refuses missing from', () => {
    const r = validateMatchedOutput(
      { reportCode: 'admissions-funnel', params: { to: '2026-04-30' } },
      today,
    );
    expect(r.ok).toBe(false);
  });

  it('refuses missing to', () => {
    const r = validateMatchedOutput(
      { reportCode: 'lead-source-performance', params: { from: '2026-04-01' } },
      today,
    );
    expect(r.ok).toBe(false);
  });

  it('refuses from > to', () => {
    const r = validateMatchedOutput(
      { reportCode: 'admissions-funnel', params: { from: '2026-05-01', to: '2026-04-30' } },
      today,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/from.*to|range/i);
  });

  it('refuses dates outside the 5-year past window', () => {
    const r = validateMatchedOutput(
      { reportCode: 'admissions-funnel', params: { from: '2018-01-01', to: '2018-12-31' } },
      today,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/5/i);
  });

  it('refuses to-dates more than 1 year in the future', () => {
    const r = validateMatchedOutput(
      { reportCode: 'admissions-funnel', params: { from: '2026-04-01', to: '2030-01-01' } },
      today,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/future|1 year/i);
  });

  it('refuses malformed date strings', () => {
    const r = validateMatchedOutput(
      { reportCode: 'admissions-funnel', params: { from: 'not-a-date', to: '2026-04-30' } },
      today,
    );
    expect(r.ok).toBe(false);
  });
});

describe('validateMatchedOutput — student-roster-snapshot', () => {
  it('accepts the default-implied empty params object', () => {
    const r = validateMatchedOutput(
      { reportCode: 'student-roster-snapshot', params: {} },
      today,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.params.status).toBe('active'); // default
  });

  it('accepts status="all"', () => {
    const r = validateMatchedOutput(
      { reportCode: 'student-roster-snapshot', params: { status: 'all' } },
      today,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.params.status).toBe('all');
  });

  it('refuses an unknown status value', () => {
    const r = validateMatchedOutput(
      { reportCode: 'student-roster-snapshot', params: { status: 'pending' } },
      today,
    );
    expect(r.ok).toBe(false);
  });

  it('refuses extra params keys (defense vs LLM hallucination)', () => {
    const r = validateMatchedOutput(
      { reportCode: 'student-roster-snapshot', params: { status: 'active', programmeId: 'p1' } },
      today,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unexpected|extra|programmeId/i);
  });
});
