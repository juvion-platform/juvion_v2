/**
 * 008 Phase 1 — cross-module risk signal emitters.
 *
 * The CCD engine (`ment-couns-ccd-service.ts`) scores students by combining
 * signals from several modules: the compound score multiplies by 1.5 when
 * signals span three or more source modules. That machinery has always worked;
 * nothing has ever fed it. Until now the only ingress was a human POSTing to
 * `/api/welfare/ccd/risk-signals`, so the cross-module multiplier could not
 * fire in practice.
 *
 * This module is the single service-to-service door into that engine.
 * Academics, finance and campus-ops call `emitRiskSignal` from the branches
 * where they ALREADY detect a problem — they simply never reported it anywhere.
 *
 * Two hard contracts, both load-bearing:
 *
 *   1. NEVER THROWS. A risk signal is an observation about a student, not part
 *      of the caller's transaction. An emitter failure must not roll back an
 *      attendance save, a fee escalation or a hostel violation. Every path
 *      catches and logs under `[risk-signal]`.
 *
 *   2. IDEMPOTENT per (student, signalType, day). `generateAttendanceAlerts`
 *      is re-runnable by design, and a nightly job will re-run it. Without a
 *      guard, five runs stack five identical `attendance_drop` signals and the
 *      compound score inflates on repetition rather than on evidence — which
 *      would make the score actively misleading.
 *
 * Signals are NOT routed through `shared/events.ts`: it is a bare Node
 * EventEmitter with no persistence, so a signal emitted during a restart would
 * vanish with no trace. Direct calls are boring and debuggable. Revisit when
 * volume justifies a durable queue.
 */

import { RiskSignal } from '../../models/welfare/RiskSignal';
import { ingestRiskSignal } from './ment-couns-ccd-service';

/** Mirrors the `source` enum on RiskSignal. */
export type RiskSignalSource = 'M03' | 'M04' | 'M06' | 'M08' | 'Juvi';

/** Mirrors the `signalType` enum on RiskSignal. */
export type RiskSignalType =
  | 'attendance_drop'
  | 'failing_grades'
  | 'backlog_accumulation'
  | 'fee_default'
  | 'scholarship_loss'
  | 'warden_concern'
  | 'mess_attendance_drop'
  | 'messaging_withdrawal'
  | 'sentiment_anomaly'
  | 'isolation_indicators'
  | 'grievance_filed'
  | 'counselling_active';

export interface EmitRiskSignalInput {
  studentId: string;
  source: RiskSignalSource;
  signalType: RiskSignalType;
  /** Free-form provenance — what tripped this, so a mentor can audit it. */
  triggerData?: Record<string, unknown>;
}

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * True when an active signal of the same type already exists for this student
 * inside the dedup window.
 */
async function alreadySignalled(
  collegeId: string,
  studentId: string,
  signalType: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_MS);
  const existing = await RiskSignal.findOne({
    collegeId,
    studentId,
    signalType,
    status: 'active',
    receivedAt: { $gte: since },
  })
    .select({ _id: 1 })
    .lean();
  return existing !== null;
}

/**
 * Report a risk signal from an upstream module into the CCD engine.
 *
 * Resolves to `true` when a signal was written, `false` when it was suppressed
 * as a duplicate or the emit failed. Callers are free to ignore the result —
 * nothing in the codebase should branch on it.
 */
export async function emitRiskSignal(
  collegeId: string,
  input: EmitRiskSignalInput,
): Promise<boolean> {
  try {
    if (!collegeId || !input.studentId) return false;

    if (await alreadySignalled(collegeId, input.studentId, input.signalType)) {
      return false;
    }

    // `ingestRiskSignal` owns weight lookup (SIGNAL_WEIGHTS), the first-gen
    // modifier, expiry, and the downstream `computeAndUpdateCCDAlert` call.
    // Emitters deliberately add nothing to that — one scoring path, not two.
    await ingestRiskSignal(
      collegeId,
      {
        studentId: input.studentId,
        source: input.source,
        signalType: input.signalType,
        triggerData: input.triggerData,
      },
      'system',
    );
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[risk-signal] emit failed college=${collegeId} student=${input.studentId} type=${input.signalType}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
  }
}
