/**
 * Per-college LLM spend-limit gate (plan §1.5).
 *
 * The gate sits in front of every LIVE (non-cached) LLM call. Cache hits
 * (from finance-agent-summary-cache) bypass the gate by design — they cost
 * ₹0, so they should not consume budget headroom.
 *
 * Failure mode: if the gate itself errors (DB outage, network blip), it
 * MUST default-allow. A flaky gate that fails closed would surface as a
 * blanket 429 across all colleges, which is far worse UX than letting a
 * burst slip past the budget by a small margin.
 */

import { Types } from 'mongoose';

import { College } from '../../../models/College';
import { AgentAction } from '../../../models/juvi/AgentAction';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { FieldChange } from '../../../shared/types';
import {
  getCachedLimits,
  setCachedLimits,
  getCachedSpend,
  setCachedSpend,
  invalidateLimits,
  invalidateSpend,
  _ttlMsForTest,
  type CachedLimits,
} from './cache';

export interface SpendCheckResult {
  /** True → caller should NOT proceed. The gate already throws 429 in this case; flag is for callers that catch. */
  blocked: boolean;
  /** True → caller proceeds, but should attach `budgetWarning` to the response. */
  warning: boolean;
  /** INR spent in the rolling 7-day window. */
  spent: number;
  /** INR weekly budget. 0 means "no limit / bypass". */
  limit: number;
  /** Utilisation pct (`spent / limit * 100`). Always 0 when `limit === 0`. */
  pct: number;
  /** When the OLDEST cost in the current window will roll out (i.e. the window's tail). */
  resetsAt: Date;
}

const ROLLING_WINDOW_DAYS = 7;
const ROLLING_WINDOW_MS = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_ALERT_THRESHOLD_PCT = 80;

function computeResetsAt(now: Date = new Date()): Date {
  // Approximate: rolling window resets continuously, but for caller display
  // we surface "now + 7d" as the latest possible reset point (the moment
  // the current cost will fully roll out).
  return new Date(now.getTime() + ROLLING_WINDOW_MS);
}

async function loadLimits(collegeId: string): Promise<CachedLimits> {
  const cached = getCachedLimits(collegeId);
  if (cached) return cached;

  const college = await College.findById(collegeId).select('aiSpendLimits').lean();
  const limits: CachedLimits = {
    weeklyInr: college?.aiSpendLimits?.weeklyInr ?? 0,
    alertThresholdPct: college?.aiSpendLimits?.alertThresholdPct ?? DEFAULT_ALERT_THRESHOLD_PCT,
  };
  setCachedLimits(collegeId, limits);
  return limits;
}

async function loadSpend(collegeId: string): Promise<number> {
  const cached = getCachedSpend(collegeId);
  if (cached) return cached.spent;

  const since = new Date(Date.now() - ROLLING_WINDOW_MS);
  const result = await AgentAction.aggregate<{ _id: null; total: number }>([
    {
      $match: {
        collegeId: new Types.ObjectId(collegeId),
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: null, total: { $sum: '$costInr' } } },
  ]);

  const spent = result[0]?.total ?? 0;
  setCachedSpend(collegeId, { spent, fetchedAt: Date.now() });
  return spent;
}

/**
 * Pre-call gate. Throws AppError(429) when over budget; otherwise returns
 * the current state (with `warning: true` if at/over the alert threshold).
 *
 * On any DB error → default-allow (logs and returns no-warning state).
 */
export async function assertWithinSpendLimit(collegeId: string): Promise<SpendCheckResult> {
  const resetsAt = computeResetsAt();
  let limits: CachedLimits;

  try {
    limits = await loadLimits(collegeId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[llm-budget] limits load failed; default-allow:', err);
    return { blocked: false, warning: false, spent: 0, limit: 0, pct: 0, resetsAt };
  }

  if (limits.weeklyInr === 0) {
    return { blocked: false, warning: false, spent: 0, limit: 0, pct: 0, resetsAt };
  }

  let spent: number;
  try {
    spent = await loadSpend(collegeId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[llm-budget] spend load failed; default-allow:', err);
    return { blocked: false, warning: false, spent: 0, limit: 0, pct: 0, resetsAt };
  }

  const pct = (spent / limits.weeklyInr) * 100;

  if (pct >= 100) {
    // eslint-disable-next-line no-console
    console.warn(`[llm-budget:blocked] college=${collegeId} spent=${spent} limit=${limits.weeklyInr} pct=${pct.toFixed(1)}`);
    // Detail shape: `{ spent: number, limit: number, pct: number, resetsAt: string }`.
    // The errorHandler surfaces this in the 429 body so the frontend banner
    // can hydrate without a follow-up request. Plan §1.5 + L4 AC #6.
    throw new AppError(429, 'Weekly LLM budget exceeded', {
      spent,
      limit: limits.weeklyInr,
      pct,
      resetsAt: resetsAt.toISOString(),
    });
  }

  const warning = pct >= limits.alertThresholdPct;
  if (warning) {
    // eslint-disable-next-line no-console
    console.warn(`[llm-budget:warn] college=${collegeId} spent=${spent} limit=${limits.weeklyInr} pct=${pct.toFixed(1)}`);
  }

  return {
    blocked: false,
    warning,
    spent,
    limit: limits.weeklyInr,
    pct,
    resetsAt,
  };
}

/** Read-only spend lookup for admin / banner hydration. */
export async function getCurrentSpend(collegeId: string): Promise<{ spent: number; cachedUntil: Date }> {
  const spent = await loadSpend(collegeId);
  return { spent, cachedUntil: new Date(Date.now() + _ttlMsForTest()) };
}

/**
 * Admin-driven update of `College.aiSpendLimits`.
 *
 * Side effects:
 *   1. Persists new values to Mongo
 *   2. Invalidates BOTH cache layers for the college (limits + spend)
 *   3. Emits an AuditLog entry with field-level from→to deltas
 *   4. Returns `{ aiSpendLimits, currentSpend }` so the caller can hydrate
 *      the admin UI in one round-trip
 */
export async function updateSpendLimits(
  collegeId: string,
  updates: { weeklyInr?: number; alertThresholdPct?: number },
  userId: string,
): Promise<{
  aiSpendLimits: { weeklyInr: number; alertThresholdPct: number };
  currentSpend: { spent: number; limit: number; pct: number };
}> {
  const college = await College.findById(collegeId);
  if (!college) throw new AppError(404, 'College not found');

  const before = {
    weeklyInr: college.aiSpendLimits?.weeklyInr ?? 0,
    alertThresholdPct: college.aiSpendLimits?.alertThresholdPct ?? DEFAULT_ALERT_THRESHOLD_PCT,
  };

  const after = {
    weeklyInr: updates.weeklyInr ?? before.weeklyInr,
    alertThresholdPct: updates.alertThresholdPct ?? before.alertThresholdPct,
  };

  // Validation (defensive — Mongoose schema already enforces, but we want
  // a clean 400 before the .save() round-trip).
  if (after.weeklyInr < 0) throw new AppError(400, 'weeklyInr must be ≥ 0');
  if (after.alertThresholdPct < 1 || after.alertThresholdPct > 100) {
    throw new AppError(400, 'alertThresholdPct must be between 1 and 100');
  }

  college.set('aiSpendLimits', after);
  await college.save();

  invalidateLimits(collegeId);
  invalidateSpend(collegeId);

  const changes: FieldChange[] = [];
  if (updates.weeklyInr !== undefined && before.weeklyInr !== after.weeklyInr) {
    changes.push({
      field: 'aiSpendLimits.weeklyInr',
      displayName: 'Weekly Budget (INR)',
      oldValue: before.weeklyInr,
      newValue: after.weeklyInr,
    });
  }
  if (updates.alertThresholdPct !== undefined && before.alertThresholdPct !== after.alertThresholdPct) {
    changes.push({
      field: 'aiSpendLimits.alertThresholdPct',
      displayName: 'Alert Threshold (%)',
      oldValue: before.alertThresholdPct,
      newValue: after.alertThresholdPct,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'College',
    entityId: collegeId,
    entityName: college.name,
    action: 'update',
    changes,
    performedBy: userId,
  });

  // Re-aggregate spend from scratch (cache was just invalidated).
  const spent = await loadSpend(collegeId);
  const pct = after.weeklyInr === 0 ? 0 : (spent / after.weeklyInr) * 100;

  return {
    aiSpendLimits: after,
    currentSpend: { spent, limit: after.weeklyInr, pct },
  };
}
