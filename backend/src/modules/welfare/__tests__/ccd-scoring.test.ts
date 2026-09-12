import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

import { RiskSignal } from '../../../models/welfare/RiskSignal';
import { CCDThreshold } from '../../../models/welfare/CCDThreshold';
import { computeRiskScore } from '../ment-couns-ccd-service';

/**
 * 008 Phase 1 — characterisation tests for the CCD compound scorer.
 *
 * `computeRiskScore` is the number the Student Risk board puts on screen and
 * that a mentor may repeat to a parent, and it shipped with no test at all.
 * These lock in the arithmetic BEFORE the emitters start feeding it, so a
 * later weight change has to be deliberate rather than accidental.
 *
 * The formula under test:
 *   base            = Σ computedWeight of active, unexpired signals
 *   crossModuleMult = 1.5 when signals span >= 3 distinct source modules
 *   temporalMult    = 1.5 when >= 2 signals landed inside the temporal window
 *   final           = min(100, round(base * crossModuleMult * temporalMult))
 *   priority        = P1 >= 75 | P2 >= 50 | P3 >= 35 | null
 */

const COLLEGE = new mongoose.Types.ObjectId();
const STUDENT = new mongoose.Types.ObjectId();

const DAY = 24 * 60 * 60 * 1000;
const FUTURE = new Date(Date.now() + 30 * DAY);

/** Older than the default 14-day temporal window, but not yet expired. */
const OUTSIDE_WINDOW = new Date(Date.now() - 20 * DAY);
const INSIDE_WINDOW = new Date(Date.now() - 1 * DAY);

async function seedSignal(opts: {
  source: string;
  signalType: string;
  weight: number;
  receivedAt: Date;
  status?: string;
  expiresAt?: Date;
}) {
  await RiskSignal.create({
    collegeId: COLLEGE,
    studentId: STUDENT,
    source: opts.source,
    signalType: opts.signalType,
    baseWeight: opts.weight,
    firstGenModifier: 0,
    computedWeight: opts.weight,
    receivedAt: opts.receivedAt,
    expiresAt: opts.expiresAt ?? FUTURE,
    status: opts.status ?? 'active',
  });
}

describe('computeRiskScore (CCD compound scorer)', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('returns a zero score and no priority when the student has no signals', async () => {
    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.score).toBe(0);
    expect(r.priority).toBeNull();
    expect(r.breakdown.crossModuleMultiplier).toBe(1);
    expect(r.breakdown.temporalMultiplier).toBe(1);
  });

  it('sums weights with no multipliers for a single signal', async () => {
    await seedSignal({ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: INSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.breakdown.baseTotal).toBe(25);
    expect(r.breakdown.crossModuleMultiplier).toBe(1);
    expect(r.breakdown.temporalMultiplier).toBe(1);
    expect(r.score).toBe(25);
    expect(r.priority).toBeNull(); // below the P3 line of 35
  });

  it('applies the 1.5x cross-module multiplier at exactly three distinct modules', async () => {
    // All outside the temporal window so the temporal multiplier stays 1
    // and the cross-module effect is isolated.
    await seedSignal({ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: OUTSIDE_WINDOW });
    await seedSignal({ source: 'M04', signalType: 'fee_default', weight: 25, receivedAt: OUTSIDE_WINDOW });
    await seedSignal({ source: 'M08', signalType: 'warden_concern', weight: 25, receivedAt: OUTSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.breakdown.baseTotal).toBe(75);
    expect(r.breakdown.crossModuleMultiplier).toBe(1.5);
    expect(r.breakdown.temporalMultiplier).toBe(1);
    expect(r.score).toBe(100); // 112.5, capped
    expect(r.priority).toBe('P1');
  });

  it('does NOT apply the cross-module multiplier at two distinct modules', async () => {
    await seedSignal({ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: OUTSIDE_WINDOW });
    await seedSignal({ source: 'M04', signalType: 'fee_default', weight: 25, receivedAt: OUTSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.breakdown.crossModuleMultiplier).toBe(1);
    expect(r.score).toBe(50);
    expect(r.priority).toBe('P2');
  });

  it('applies the 1.5x temporal multiplier at two signals inside the window', async () => {
    // Same module both times, so the cross-module multiplier stays 1.
    await seedSignal({ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: INSIDE_WINDOW });
    await seedSignal({ source: 'M03', signalType: 'backlog_accumulation', weight: 25, receivedAt: INSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.breakdown.baseTotal).toBe(50);
    expect(r.breakdown.crossModuleMultiplier).toBe(1);
    expect(r.breakdown.temporalMultiplier).toBe(1.5);
    expect(r.score).toBe(75);
    expect(r.priority).toBe('P1');
  });

  it('honours a per-college temporal window from CCDThreshold', async () => {
    // A 30-day window pulls the "outside" signals back in, so two signals that
    // score 50 under the default 14-day window score 75 here.
    await CCDThreshold.create({
      collegeId: COLLEGE, name: 'P1', priority: 'P1',
      scoreThreshold: 75, temporalWindowDays: 30, isActive: true,
    });
    await seedSignal({ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: OUTSIDE_WINDOW });
    await seedSignal({ source: 'M03', signalType: 'backlog_accumulation', weight: 25, receivedAt: OUTSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.breakdown.temporalMultiplier).toBe(1.5);
    expect(r.score).toBe(75);
  });

  it('caps the final score at 100', async () => {
    await seedSignal({ source: 'M03', signalType: 'failing_grades', weight: 40, receivedAt: INSIDE_WINDOW });
    await seedSignal({ source: 'M04', signalType: 'fee_default', weight: 25, receivedAt: INSIDE_WINDOW });
    await seedSignal({ source: 'M08', signalType: 'warden_concern', weight: 25, receivedAt: INSIDE_WINDOW });
    await seedSignal({ source: 'M06', signalType: 'counselling_active', weight: 10, receivedAt: INSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.breakdown.baseTotal).toBe(100);
    expect(r.score).toBe(100);
    expect(r.priority).toBe('P1');
  });

  it('ignores expired, decayed and consumed signals', async () => {
    await seedSignal({
      source: 'M03', signalType: 'attendance_drop', weight: 25,
      receivedAt: INSIDE_WINDOW, expiresAt: new Date(Date.now() - DAY), // expired
    });
    await seedSignal({
      source: 'M04', signalType: 'fee_default', weight: 25,
      receivedAt: INSIDE_WINDOW, status: 'decayed',
    });
    await seedSignal({
      source: 'M08', signalType: 'warden_concern', weight: 25,
      receivedAt: INSIDE_WINDOW, status: 'suppressed',
    });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.score).toBe(0);
    expect(r.priority).toBeNull();
  });

  it('scopes strictly by college — another college\'s signals never leak in', async () => {
    const OTHER = new mongoose.Types.ObjectId();
    await RiskSignal.create({
      collegeId: OTHER,
      studentId: STUDENT,
      source: 'M03', signalType: 'failing_grades',
      baseWeight: 40, firstGenModifier: 0, computedWeight: 40,
      receivedAt: INSIDE_WINDOW, expiresAt: FUTURE, status: 'active',
    });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.score).toBe(0);
  });

  it.each([
    { weight: 40, expected: 'P3' },  // >= 35
    { weight: 50, expected: 'P2' },  // >= 50
    { weight: 75, expected: 'P1' },  // >= 75
  ])('buckets a $weight-point score as $expected', async ({ weight, expected }) => {
    await seedSignal({ source: 'M03', signalType: 'failing_grades', weight, receivedAt: INSIDE_WINDOW });

    const r = await computeRiskScore(String(COLLEGE), String(STUDENT));
    expect(r.score).toBe(weight);
    expect(r.priority).toBe(expected);
  });
});
