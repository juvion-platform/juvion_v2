import { describe, it, expect } from 'vitest';

import { buildNlReportPrompt, PROMPT_VERSION, ALLOWED_REPORTS } from '../prompt';

/**
 * 003-nl-report-queries Task 3.0 — prompt builder.
 */

describe('buildNlReportPrompt', () => {
  const today = new Date('2026-05-14T10:00:00Z');

  it('returns a [system, user] pair', () => {
    const msgs = buildNlReportPrompt({ today, maskedQuestion: 'what is the funnel for september' });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.role).toBe('user');
  });

  it('system pins the JSON discriminated-union output schema', () => {
    const sys = buildNlReportPrompt({ today, maskedQuestion: 'q' })[0]!.content;
    expect(sys).toMatch(/JSON/i);
    expect(sys).toMatch(/status/);
    expect(sys).toMatch(/matched/);
    expect(sys).toMatch(/refused/);
    expect(sys).toMatch(/reportCode/);
    expect(sys).toMatch(/params/);
    expect(sys).toMatch(/rationale/);
    expect(sys).toMatch(/reason/);
  });

  it('system declares the exact allow-list', () => {
    const sys = buildNlReportPrompt({ today, maskedQuestion: 'q' })[0]!.content;
    expect(sys).toContain('admissions-funnel');
    expect(sys).toContain('lead-source-performance');
    expect(sys).toContain('student-roster-snapshot');
  });

  it('system declares the exact param shapes from §10.5', () => {
    const sys = buildNlReportPrompt({ today, maskedQuestion: 'q' })[0]!.content;
    // funnel + lead-source use { from, to }
    expect(sys).toMatch(/from.*to/);
    // student-roster uses status enum
    expect(sys).toMatch(/active.*all|status/);
    // Make sure the wrong key names are NOT present (regression: spec used fromDate/toDate)
    expect(sys).not.toMatch(/fromDate|toDate|programmeId|branchId|asOfDate/);
  });

  it('user content carries the masked question and today date', () => {
    const msgs = buildNlReportPrompt({ today, maskedQuestion: 'sept funnel for {name_1}' });
    const user = msgs[1]!.content;
    expect(user).toContain('2026-05-14');
    expect(user).toContain('sept funnel for {name_1}');
  });

  it('ALLOWED_REPORTS is the canonical 3-report tuple', () => {
    expect(ALLOWED_REPORTS).toEqual(['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot']);
  });

  it('PROMPT_VERSION is stable', () => {
    expect(PROMPT_VERSION).toBe('nl-report-prompt-v1');
  });
});
