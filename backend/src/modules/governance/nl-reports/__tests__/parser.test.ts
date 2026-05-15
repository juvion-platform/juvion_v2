import { describe, it, expect } from 'vitest';

import { parseNlReportResponse } from '../parser';

/**
 * 003-nl-report-queries Task 3.1 — strict JSON + Zod discriminated union.
 *
 * Returns { ok, value } | { ok: false, reason }. The reason is what the
 * service writes into NlReportQuery.reason when the LLM output can't be
 * parsed at all.
 */

describe('parseNlReportResponse', () => {
  it('parses a well-formed matched response', () => {
    const raw = JSON.stringify({
      status: 'matched',
      reportCode: 'admissions-funnel',
      params: { from: '2026-08-01', to: '2026-09-30' },
      rationale: 'Maps september funnel to admissions-funnel with that month.',
    });
    const r = parseNlReportResponse(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe('matched');
      // @ts-expect-error narrowed below
      expect(r.value.reportCode).toBe('admissions-funnel');
    }
  });

  it('parses a well-formed refused response', () => {
    const raw = JSON.stringify({ status: 'refused', reason: 'No mapping available.' });
    const r = parseNlReportResponse(raw);
    expect(r.ok).toBe(true);
    if (r.ok && r.value.status === 'refused') expect(r.value.reason).toBeTruthy();
  });

  it('strips ```json fences and parses', () => {
    const raw = '```json\n{ "status": "refused", "reason": "out of scope" }\n```';
    const r = parseNlReportResponse(raw);
    expect(r.ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    const r = parseNlReportResponse('not json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/json/i);
  });

  it('rejects an unknown reportCode (allow-list enforced at the Zod layer)', () => {
    const raw = JSON.stringify({
      status: 'matched', reportCode: 'defaulter-list', params: {}, rationale: 'r',
    });
    const r = parseNlReportResponse(raw);
    expect(r.ok).toBe(false);
  });

  it('rejects a matched response missing reportCode', () => {
    const raw = JSON.stringify({ status: 'matched', params: {}, rationale: 'r' });
    const r = parseNlReportResponse(raw);
    expect(r.ok).toBe(false);
  });

  it('rejects a refused response missing reason', () => {
    const r = parseNlReportResponse(JSON.stringify({ status: 'refused' }));
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown status discriminator', () => {
    const r = parseNlReportResponse(JSON.stringify({ status: 'maybe', reason: 'x' }));
    expect(r.ok).toBe(false);
  });

  it('caps rationale/reason length (defense vs runaway prose)', () => {
    const long = 'a'.repeat(300);
    const r = parseNlReportResponse(JSON.stringify({
      status: 'matched', reportCode: 'admissions-funnel', params: {}, rationale: long,
    }));
    expect(r.ok).toBe(false);
  });
});
