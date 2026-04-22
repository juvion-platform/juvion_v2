/**
 * fee-holds-service (Task 4 — Fee Collection Analytics & Alerts)
 *
 * Pure service layer for the FinancialHold approval workflow introduced by
 * the fee-alerts cron (T5): holds are auto-raised as `pending_approval`
 * when a student advances to `stage_4`, then a Principal must click
 * Activate or Waive from the UI (T10 page, T8 routing).
 *
 * Public API:
 *   - `listHolds(collegeId, query)` — paginated list; default ordering
 *     `pending_approval` first → `active` → `released`, each group sorted
 *     by `createdAt` DESC
 *   - `activateHold(collegeId, holdId, approvedBy)` — atomic transition
 *     `pending_approval` → `active`
 *   - `waiveHold(collegeId, holdId, approvedBy, reason)` — atomic
 *     transition `pending_approval | active` → `released`
 *
 * Concurrency safety is enforced via `findOneAndUpdate` with the source
 * status in the query filter. If another request (or a retrying BullMQ
 * job) has already transitioned the hold, the mutation returns `null`
 * and this layer throws a 409 — never a silent double-write.
 *
 * Routing (Express) lives in T8; no HTTP knowledge leaks into this file.
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md §Journey 4
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.3, §1.5, §1.8
 */

import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { FieldChange } from '../../shared/types';
import { FinancialHold, IFinancialHold } from '../../models/finance/FinancialHold';

// ── Types ─────────────────────────────────────────────────────────────

export type HoldStatus = 'pending_approval' | 'active' | 'released';

export interface ListHoldsQuery {
  status?: HoldStatus;
  studentId?: string;
  limit?: number;
  offset?: number;
}

export interface ListHoldsResult {
  items: IFinancialHold[];
  total: number;
}

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Ordinal used to sort the three statuses. Kept local to this file because
 * the ordering is a *display* convention: pending first (needs action), then
 * active (currently blocking), then released (historical).
 */
const STATUS_ORDER: Record<HoldStatus, number> = {
  pending_approval: 0,
  active: 1,
  released: 2,
};

// ── Reads ─────────────────────────────────────────────────────────────

/**
 * List holds for a college with optional status / studentId filters.
 * Always filters by `collegeId` (multi-tenancy invariant).
 *
 * Default ordering (when no `status` filter is applied):
 *   pending_approval → active → released, each group sorted by `createdAt` DESC.
 *
 * Pagination: `limit` defaults to 20 and is clamped at 100; `offset`
 * defaults to 0.
 */
export async function listHolds(
  collegeId: string,
  query: ListHoldsQuery,
): Promise<ListHoldsResult> {
  // `.aggregate()` does NOT apply Mongoose's auto-cast, so we must convert
  // string IDs to ObjectIds ourselves for `$match` to compare correctly.
  // (The `.countDocuments()` call below does cast automatically, which is
  // why we keep two parallel filter objects.)
  const castFilter: Record<string, unknown> = {
    collegeId: new Types.ObjectId(collegeId),
  };
  const plainFilter: Record<string, unknown> = { collegeId };
  if (query.status) {
    castFilter.holdStatus = query.status;
    plainFilter.holdStatus = query.status;
  }
  if (query.studentId) {
    castFilter.studentId = new Types.ObjectId(query.studentId);
    plainFilter.studentId = query.studentId;
  }

  const limit = clampLimit(query.limit);
  const offset = Math.max(0, query.offset ?? 0);

  // Total is computed against the same filter (pre-pagination) so callers
  // can build pager UIs without a second round-trip.
  const total = await FinancialHold.countDocuments(plainFilter);

  // Use an aggregation pipeline to encode the custom status ordering that
  // Mongo's native sort cannot express directly. `$addFields` with a
  // `$switch` maps each status to its ordinal, then `$sort` sorts by the
  // ordinal (ASC) then `createdAt` (DESC).
  const items = await FinancialHold.aggregate<IFinancialHold>([
    { $match: castFilter },
    {
      $addFields: {
        __statusOrder: {
          $switch: {
            branches: [
              { case: { $eq: ['$holdStatus', 'pending_approval'] }, then: STATUS_ORDER.pending_approval },
              { case: { $eq: ['$holdStatus', 'active'] }, then: STATUS_ORDER.active },
              { case: { $eq: ['$holdStatus', 'released'] }, then: STATUS_ORDER.released },
            ],
            default: 99,
          },
        },
      },
    },
    { $sort: { __statusOrder: 1, createdAt: -1 } },
    { $skip: offset },
    { $limit: limit },
    { $project: { __statusOrder: 0 } },
  ]);

  return { items, total };
}

// ── Writes ────────────────────────────────────────────────────────────

/**
 * Activate a pending hold. Atomic: the `holdStatus: 'pending_approval'`
 * guard in the filter prevents a concurrent second click from double-
 * activating, and prevents activating a hold that has already been waived.
 *
 * On success:
 *   - `holdStatus` → `'active'`
 *   - `approvedBy` set to the caller
 *   - `effectiveDate` set to now (principal's decision instant)
 *   - AuditLog entry emitted with the from→to change
 */
export async function activateHold(
  collegeId: string,
  holdId: string,
  approvedBy: string,
): Promise<IFinancialHold> {
  const now = new Date();
  const updated = await FinancialHold.findOneAndUpdate(
    { _id: holdId, collegeId, holdStatus: 'pending_approval' },
    { $set: { holdStatus: 'active', approvedBy, effectiveDate: now } },
    { new: true },
  );
  if (!updated) {
    throw new AppError(409, 'Hold is not pending approval or not found');
  }

  await emitHoldAudit(collegeId, updated, approvedBy, 'pending_approval', 'active');
  return updated;
}

/**
 * Waive a hold. Accepts either `pending_approval` (principal decides early
 * that the hold never should have landed) or `active` (post-decision
 * reversal — usually after the student pays).
 *
 * Reason is required (operational audit trail). Empty/whitespace reason
 * throws 400.
 */
export async function waiveHold(
  collegeId: string,
  holdId: string,
  approvedBy: string,
  reason: string,
): Promise<IFinancialHold> {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmed) {
    throw new AppError(400, 'Waive reason is required');
  }

  const now = new Date();

  // Load the prior status BEFORE the update so the audit log can record
  // the correct `from` value (could be pending_approval OR active).
  const prior = await FinancialHold.findOne({ _id: holdId, collegeId });
  const priorStatus = prior?.holdStatus as HoldStatus | undefined;

  const updated = await FinancialHold.findOneAndUpdate(
    {
      _id: holdId,
      collegeId,
      holdStatus: { $in: ['pending_approval', 'active'] },
    },
    {
      $set: {
        holdStatus: 'released',
        releasedBy: approvedBy,
        releaseDate: now,
        releaseReason: trimmed,
      },
    },
    { new: true },
  );
  if (!updated) {
    throw new AppError(409, 'Hold is already released or not found');
  }

  await emitHoldAudit(
    collegeId,
    updated,
    approvedBy,
    priorStatus ?? 'active',
    'released',
    trimmed,
  );
  return updated;
}

// ── Internals ─────────────────────────────────────────────────────────

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(raw));
}

async function emitHoldAudit(
  collegeId: string,
  hold: IFinancialHold,
  performedBy: string,
  from: HoldStatus,
  to: HoldStatus,
  reason?: string,
): Promise<void> {
  const changes: FieldChange[] = [
    { field: 'holdStatus', displayName: 'Hold Status', oldValue: from, newValue: to },
  ];
  if (reason) {
    changes.push({ field: 'releaseReason', displayName: 'Release Reason', oldValue: null, newValue: reason });
  }
  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: String(hold._id),
    entityName: `FinancialHold:${hold.holdType}`,
    studentId: String(hold.studentId),
    action: 'update',
    changes,
    performedBy,
  });
}
