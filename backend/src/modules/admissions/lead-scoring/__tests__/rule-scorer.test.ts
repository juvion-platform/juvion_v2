import { describe, it, expect } from 'vitest';

import { computeRuleScore } from '../rule-scorer';
import type { InquiryInput, InteractionInput } from '../rule-scorer';

/**
 * 001-ai-lead-scoring — Task 2.2
 * Deterministic rule scorer. Inputs are plain objects (not Mongoose docs)
 * so the scorer is pure and easily unit-tested. Spec §3 weights.
 *
 * The score is clamped to [0, 100]. The `factors` list mirrors what
 * shows up in `scoreRationale.factors` for the rationale card UI.
 */

const baseInquiry = (overrides: Partial<InquiryInput> = {}): InquiryInput => ({
  source: 'website',
  ...overrides,
});

describe('computeRuleScore — source quality', () => {
  it('credits walk-in higher than website', () => {
    const walkIn = computeRuleScore(baseInquiry({ source: 'walk-in' }), []);
    const website = computeRuleScore(baseInquiry({ source: 'website' }), []);
    expect(walkIn.score).toBeGreaterThan(website.score);
  });

  it('produces a "Source" factor reflecting the picked source', () => {
    const r = computeRuleScore(baseInquiry({ source: 'walk-in' }), []);
    const f = r.factors.find((x) => x.label.toLowerCase().startsWith('source:'));
    expect(f).toBeDefined();
    expect(f!.source).toBe('rule');
    expect(f!.weight).toBeGreaterThan(0);
  });
});

describe('computeRuleScore — academic fit', () => {
  it('credits high interPercentage (>=80) more than middling', () => {
    const high = computeRuleScore(baseInquiry({ interPercentage: 92 }), []);
    const mid = computeRuleScore(baseInquiry({ interPercentage: 65 }), []);
    const low = computeRuleScore(baseInquiry({ interPercentage: 50 }), []);
    expect(high.score).toBeGreaterThan(mid.score);
    expect(mid.score).toBeGreaterThan(low.score);
  });

  it('treats missing interPercentage as 0 (neutral, not penalty)', () => {
    const missing = computeRuleScore(baseInquiry({}), []);
    const low = computeRuleScore(baseInquiry({ interPercentage: 40 }), []);
    expect(low.score).toBeGreaterThan(missing.score);
  });
});

describe('computeRuleScore — interest signals', () => {
  it('rewards specific programme/branch interest', () => {
    const noInterest = computeRuleScore(baseInquiry({}), []);
    const withInterest = computeRuleScore(
      baseInquiry({ programmeInterest: 'B.Tech CSE', branchInterest: 'CSE' }),
      [],
    );
    expect(withInterest.score).toBeGreaterThan(noInterest.score);
  });

  it('credits paid-traffic UTM campaigns', () => {
    const organic = computeRuleScore(baseInquiry({}), []);
    const paid = computeRuleScore(baseInquiry({ utmCampaign: 'summer-2026' }), []);
    expect(paid.score).toBeGreaterThan(organic.score);
  });
});

describe('computeRuleScore — interaction signals', () => {
  const now = new Date('2026-05-14T12:00:00Z');

  const inter = (overrides: Partial<InteractionInput> = {}): InteractionInput => ({
    type: 'phone_call',
    outcome: 'no_response',
    createdAt: now,
    ...overrides,
  });

  it('scales with interaction count', () => {
    // `now` must be pinned to the fixture date. Without it the scorer used the
    // real clock, so once wall-clock time drifted more than 30 days past
    // 2026-05-14 every interaction tripped the -20 dormancy penalty — which
    // swamped the count credit this test is actually asserting on, and the
    // test began failing on a date rather than on a code change.
    const zero = computeRuleScore(baseInquiry({}), [], now).score;
    const one = computeRuleScore(baseInquiry({}), [inter()], now).score;
    const four = computeRuleScore(baseInquiry({}), [inter(), inter(), inter(), inter()], now).score;
    expect(one).toBeGreaterThan(zero);
    expect(four).toBeGreaterThan(one);
  });

  it('credits recent interactions higher than old ones', () => {
    const fresh = inter({ createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) }); // 1h ago
    const stale = inter({ createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) }); // 20d ago
    const freshScore = computeRuleScore(baseInquiry({}), [fresh], now).score;
    const staleScore = computeRuleScore(baseInquiry({}), [stale], now).score;
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it('credits a positive last outcome (interested/visit_scheduled/converted)', () => {
    const noResponse = computeRuleScore(baseInquiry({}), [inter({ outcome: 'no_response' })], now).score;
    const positive = computeRuleScore(baseInquiry({}), [inter({ outcome: 'visit_scheduled' })], now).score;
    expect(positive).toBeGreaterThan(noResponse);
  });

  it('penalizes a negative last outcome (not_interested)', () => {
    const neutral = computeRuleScore(baseInquiry({}), [inter({ outcome: 'no_response' })], now).score;
    const negative = computeRuleScore(baseInquiry({}), [inter({ outcome: 'not_interested' })], now).score;
    expect(negative).toBeLessThan(neutral);
  });

  it('treats dormancy (last interaction >30d) as a penalty', () => {
    const recent = inter({ createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) });
    const ancient = inter({ createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) });
    const recentScore = computeRuleScore(baseInquiry({}), [recent], now).score;
    const ancientScore = computeRuleScore(baseInquiry({}), [ancient], now).score;
    expect(ancientScore).toBeLessThan(recentScore);
  });
});

describe('computeRuleScore — clamping', () => {
  it('never returns negative scores even with negative penalties', () => {
    const now = new Date('2026-05-14T12:00:00Z');
    const r = computeRuleScore(
      baseInquiry({ source: 'newspaper' }),
      [{ type: 'phone_call', outcome: 'not_interested', createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }],
      now,
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('never exceeds 100 even with all maxed positive signals', () => {
    const now = new Date('2026-05-14T12:00:00Z');
    const r = computeRuleScore(
      baseInquiry({
        source: 'walk-in',
        interPercentage: 95,
        programmeInterest: 'B.Tech CSE',
        branchInterest: 'CSE',
        utmCampaign: 'summer-2026',
      }),
      [
        { type: 'walk_in', outcome: 'visit_scheduled', createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) },
        { type: 'phone_call', outcome: 'interested', createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
        { type: 'whatsapp', outcome: 'interested', createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
        { type: 'whatsapp', outcome: 'interested', createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
        { type: 'phone_call', outcome: 'interested', createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
      ],
      now,
    );
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThan(80); // hot territory
  });
});

describe('computeRuleScore — factors array', () => {
  it('every factor has source = "rule"', () => {
    const r = computeRuleScore(baseInquiry({ interPercentage: 85, utmCampaign: 'x' }), []);
    for (const f of r.factors) expect(f.source).toBe('rule');
  });

  it('factor weights sum near (or above) the final score (modulo clamping)', () => {
    const r = computeRuleScore(baseInquiry({ source: 'walk-in', interPercentage: 70 }), []);
    const total = r.factors.reduce((acc, f) => acc + f.weight, 0);
    // Without clamping or negatives, the factors should add up to a value
    // related to the score. We assert a loose equality (within 5pp) so
    // future factor additions don't make this test brittle.
    expect(Math.abs(total - r.score)).toBeLessThanOrEqual(5);
  });
});
