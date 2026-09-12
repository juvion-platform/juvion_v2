import { describe, it, expect } from 'vitest';
import {
  systemPrefix,
  buildAlertNarrationMessages,
  buildOutreachDraftMessages,
  determineTone,
} from '../prompts';

/**
 * The prompt layer is where the "no number comes from a model" rule is
 * actually enforced, so it gets tested like the contract it is rather than
 * treated as string formatting.
 */

const SYS = { today: new Date('2026-09-01T00:00:00Z') };

describe('systemPrefix', () => {
  it('carries the four defences the welfare context needs', () => {
    const p = systemPrefix(SYS);
    expect(p).toMatch(/Never claim to have taken an action/i);
    expect(p).toMatch(/Never invent, recalculate or contradict a number/i);
    // Specific to student welfare: attendance records are not a diagnosis.
    expect(p).toMatch(/Never speculate about a medical or psychological diagnosis/i);
    expect(p).toMatch(/Never output PII tokens/i);
  });

  it('names the college and the requester role when given them', () => {
    const p = systemPrefix({ ...SYS, collegeName: 'Juvion Institute', role: 'Dean of Students' });
    expect(p).toContain('Juvion Institute');
    expect(p).toContain('Dean of Students');
  });

  it('falls back to neutral wording rather than a wrong specific', () => {
    const p = systemPrefix(SYS);
    expect(p).toContain('the college');
    expect(p).toContain('Student Welfare Officer');
    expect(p).toContain('2026-09-01');
  });
});

describe('buildAlertNarrationMessages', () => {
  const alert = {
    alertId: 'a1', studentId: 's1', priority: 'P1', score: 82,
    signals: [{ what: 'attendance dropped', from: 'academics', weight: 25, daysAgo: 3 }],
    distinctModules: 3, crossModuleMultiplier: 1.5, temporalMultiplier: 1.5, daysOpen: 2,
  };

  it('returns a [system, user] pair', () => {
    const m = buildAlertNarrationMessages({ sys: SYS, alert });
    expect(m).toHaveLength(2);
    expect(m[0]!.role).toBe('system');
    expect(m[1]!.role).toBe('user');
  });

  it('forbids recommending an action or speculating on causes', () => {
    const user = buildAlertNarrationMessages({ sys: SYS, alert })[1]!.content;
    expect(user).toMatch(/do NOT recommend an action/i);
    expect(user).toMatch(/do NOT speculate/i);
  });

  it('passes the computed values through verbatim for the model to phrase', () => {
    const user = buildAlertNarrationMessages({ sys: SYS, alert })[1]!.content;
    expect(user).toContain('"score":82');
    expect(user).toContain('"crossModuleMultiplier":1.5');
  });
});

describe('buildOutreachDraftMessages', () => {
  const ctx = { studentName: 'A Student', guardian: { name: '{guardian_name_1}' } };

  it('demands a bare JSON object', () => {
    const m = buildOutreachDraftMessages({ sys: SYS, language: 'te', tone: 'supportive', context: ctx });
    expect(m[0]!.content).toMatch(/Return ONLY a single JSON object, no prose, no markdown fences/);
  });

  it('escalates the instruction on the strict retry', () => {
    const normal = buildOutreachDraftMessages({ sys: SYS, language: 'en', tone: 'direct', context: ctx });
    const strict = buildOutreachDraftMessages({ sys: SYS, language: 'en', tone: 'direct', context: ctx, strict: true });
    expect(normal[0]!.content).not.toMatch(/previous attempt returned invalid JSON/i);
    expect(strict[0]!.content).toMatch(/previous attempt returned invalid JSON/i);
  });

  it('carries the requested language and tone into the instruction', () => {
    const user = buildOutreachDraftMessages({ sys: SYS, language: 'te', tone: 'urgent', context: ctx })[1]!.content;
    expect(user).toContain('in te');
    expect(user).toContain('a urgent tone');
  });

  it('bars threats and consequences — this message goes to a worried parent', () => {
    const user = buildOutreachDraftMessages({ sys: SYS, language: 'en', tone: 'urgent', context: ctx })[1]!.content;
    expect(user).toMatch(/do not demand, threaten, or mention consequences/i);
  });

  it('instructs the model to use masked tokens verbatim', () => {
    const user = buildOutreachDraftMessages({ sys: SYS, language: 'en', tone: 'supportive', context: ctx })[1]!.content;
    expect(user).toMatch(/Use the masked tokens verbatim/i);
    expect(user).toContain('{guardian_name_1}');
  });
});

describe('determineTone', () => {
  it('is deterministic, not a model decision', () => {
    const a = determineTone({ priority: 'P1', priorOutreachCount: 0 });
    const b = determineTone({ priority: 'P1', priorOutreachCount: 0 });
    expect(a).toBe(b);
  });

  it.each([
    { priority: 'P1', priorOutreachCount: 0, expected: 'urgent' },
    { priority: 'P2', priorOutreachCount: 3, expected: 'direct' },
    { priority: 'P3', priorOutreachCount: 0, expected: 'supportive' },
    { priority: 'P2', priorOutreachCount: 0, expected: 'supportive' },
  ])('$priority with $priorOutreachCount prior contacts -> $expected', ({ priority, priorOutreachCount, expected }) => {
    expect(determineTone({ priority, priorOutreachCount })).toBe(expected);
  });

  it('prioritises severity over repetition — a P1 is urgent on first contact', () => {
    expect(determineTone({ priority: 'P1', priorOutreachCount: 5 })).toBe('urgent');
  });
});
