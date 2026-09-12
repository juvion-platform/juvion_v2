import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

import { RiskSignal } from '../../../models/welfare/RiskSignal';
import { CrisisAlert } from '../../../models/welfare/CrisisAlert';
import { RiskScoreSnapshot } from '../../../models/welfare/RiskScoreSnapshot';
import { emitRiskSignal } from '../risk-emitters';

/**
 * 008 Phase 1 — the cross-module emitter contract.
 *
 * Two properties matter more than the happy path, because both protect callers
 * that have nothing to do with welfare:
 *
 *   - it NEVER throws  — a failed signal must not roll back an attendance save
 *   - it is IDEMPOTENT — a re-run of a nightly job must not inflate the score
 */

const COLLEGE = new mongoose.Types.ObjectId();
const STUDENT = new mongoose.Types.ObjectId();

describe('emitRiskSignal', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => {
    await clearCollections();
    vi.restoreAllMocks();
  });

  it('writes a risk signal with the weight from the CCD weight table', async () => {
    const written = await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT),
      source: 'M03',
      signalType: 'attendance_drop',
      triggerData: { attendancePercent: 61 },
    });

    expect(written).toBe(true);

    const signals = await RiskSignal.find({ collegeId: COLLEGE }).lean();
    expect(signals).toHaveLength(1);
    expect(signals[0]!.source).toBe('M03');
    expect(signals[0]!.signalType).toBe('attendance_drop');
    expect(signals[0]!.computedWeight).toBe(25); // SIGNAL_WEIGHTS.attendance_drop
    expect(signals[0]!.status).toBe('active');
    expect((signals[0]!.triggerData as { attendancePercent: number }).attendancePercent).toBe(61);
  });

  it('suppresses a duplicate of the same signal type within the dedup window', async () => {
    const first = await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });
    const second = await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await RiskSignal.countDocuments({ collegeId: COLLEGE })).toBe(1);
  });

  it('does not suppress a different signal type for the same student', async () => {
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });
    const other = await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M04', signalType: 'fee_default',
    });

    expect(other).toBe(true);
    expect(await RiskSignal.countDocuments({ collegeId: COLLEGE })).toBe(2);
  });

  it('does not suppress the same signal type for a different student', async () => {
    const other = new mongoose.Types.ObjectId();
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(other), source: 'M03', signalType: 'attendance_drop',
    });

    expect(await RiskSignal.countDocuments({ collegeId: COLLEGE })).toBe(2);
  });

  it('re-emits once the earlier signal is no longer active', async () => {
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });
    // Consumed into an alert — the dedup guard only looks at active signals.
    await RiskSignal.updateMany({ collegeId: COLLEGE }, { $set: { status: 'consumed' } });

    const again = await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });

    expect(again).toBe(true);
    expect(await RiskSignal.countDocuments({ collegeId: COLLEGE })).toBe(2);
  });

  it('never throws when the write fails, and reports false', async () => {
    vi.spyOn(RiskSignal, 'create').mockRejectedValueOnce(new Error('mongo is down'));

    const result = await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });

    expect(result).toBe(false);
    expect(await RiskSignal.countDocuments({ collegeId: COLLEGE })).toBe(0);
  });

  it('never throws on a malformed student id, and reports false', async () => {
    const result = await emitRiskSignal(String(COLLEGE), {
      studentId: 'not-an-object-id', source: 'M03', signalType: 'attendance_drop',
    });
    expect(result).toBe(false);
  });

  it('returns false without writing when required ids are missing', async () => {
    expect(await emitRiskSignal('', {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    })).toBe(false);
    expect(await emitRiskSignal(String(COLLEGE), {
      studentId: '', source: 'M03', signalType: 'attendance_drop',
    })).toBe(false);
    expect(await RiskSignal.countDocuments({})).toBe(0);
  });

  it('drives the CCD engine: three modules produce a P1 compound_risk alert', async () => {
    // 25 + 25 + 25 = 75 base, x1.5 cross-module, x1.5 temporal -> capped 100.
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M04', signalType: 'fee_default',
    });
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M08', signalType: 'warden_concern',
    });

    const alerts = await CrisisAlert.find({ collegeId: COLLEGE }).lean();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.priority).toBe('P1');
    expect(alerts[0]!.compoundScore).toBe(100);
    // Compound-risk alerts are no longer miscategorised as mental health.
    expect(alerts[0]!.type).toBe('compound_risk');
    expect(alerts[0]!.scoreBreakdown?.crossModuleMultiplier).toBe(1.5);
    expect(alerts[0]!.signals).toHaveLength(3);
  });

  it('records a score snapshot on every scoring run, including sub-threshold ones', async () => {
    // A single 25-point signal scores below the P3 line, so no alert is raised
    // — but the snapshot must still land, otherwise a recovery is invisible.
    await emitRiskSignal(String(COLLEGE), {
      studentId: String(STUDENT), source: 'M03', signalType: 'attendance_drop',
    });

    expect(await CrisisAlert.countDocuments({ collegeId: COLLEGE })).toBe(0);

    const snaps = await RiskScoreSnapshot.find({ collegeId: COLLEGE }).lean();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.score).toBe(25);
    expect(snaps[0]!.priority).toBeNull();
  });
});
