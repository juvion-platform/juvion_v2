/**
 * allocation-lifecycle — shared state machine + transition helpers for
 * HostelAllocation and TransportAllocation, parameterized by flow.
 *
 * Why here: hostel and transport flows are semantically identical except
 * for the name of their terminal "vacated" vs "cancelled" state and which
 * capacity pool they consume. Keeping the lifecycle in one place prevents
 * hostel and transport from drifting out of sync as rules evolve.
 *
 * Design notes:
 *   - This module does NOT own transactions. Services/controllers do.
 *     `recordTransition` accepts an optional Mongoose session that it
 *     threads through all writes, so callers can wrap multiple transitions
 *     (e.g. accept + room occupancy change + fee creation) into one tx.
 *   - `checkCapacity` is intentionally not embedded inside `recordTransition`:
 *     capacity checks happen at *propose* time (before the allocation
 *     exists), whereas `recordTransition` operates on an existing allocation.
 *     Callers co-ordinate the two.
 *   - FeeLineItem creation is idempotent: a pre-existing FeeLineItem for
 *     (studentId, component, academicYearId) is reused rather than duplicated.
 *     This makes repeat-accept a safe no-op (EC-1).
 */

import mongoose, { ClientSession } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { TransportRoute } from '../../models/welfare/TransportRoute';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { AuditLog } from '../../shared/audit';
import { Notification } from '../../models/communication/Notification';
import { FeeLineItem } from '../../models/finance/FeeLineItem';
import { FeeStructure } from '../../models/finance/FeeStructure';
import { isEmailNotificationsEnabled } from '../../config/features';

export type AllocationFlow = 'hostel' | 'transport';

// ─────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────

/**
 * Flow-aware validity check. Returns true if the transition is permitted.
 * Idempotent same-state transitions (`from === to`) are always allowed so
 * callers don't have to branch on "already there."
 */
export function isValidTransition(flow: AllocationFlow, from: string, to: string): boolean {
  if (from === to) return true;

  switch (from) {
    case 'proposed':
      return ['active', 'declined', 'withdrawn', 'expired'].includes(to);

    case 'waitlisted':
      return ['proposed', 'withdrawn'].includes(to);

    case 'active':
      return to === 'vacate_requested';

    case 'vacate_requested':
      if (to === 'active') return true; // admin-reject path
      if (flow === 'hostel') return to === 'vacated';
      if (flow === 'transport') return to === 'cancelled';
      return false;

    // All other states (terminal: declined, withdrawn, expired, vacated,
    // cancelled, transferred) have no outgoing transitions.
    default:
      return false;
  }
}

export function assertValidTransition(flow: AllocationFlow, from: string, to: string): void {
  if (!isValidTransition(flow, from, to)) {
    throw new AppError(
      409,
      `invalid_transition: ${flow} allocation cannot move from '${from}' to '${to}'`,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Expiry
// ─────────────────────────────────────────────────────────────

export async function computeExpiry(
  flow: AllocationFlow,
  collegeId: string,
): Promise<{ expiresAt: Date; ttlDays: number }> {
  const config = await CampusConfig.findOne({ collegeId }).lean();
  const ttlDays =
    (flow === 'hostel' ? config?.hostel?.proposalTtlDays : config?.transport?.proposalTtlDays) ?? 7;
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000);
  return { expiresAt, ttlDays };
}

// ─────────────────────────────────────────────────────────────
// Capacity
// ─────────────────────────────────────────────────────────────

// Statuses that "consume" a slot from the capacity pool. Anything terminal
// (vacated, cancelled, declined, etc.) doesn't count.
const LIVE_STATUSES = ['proposed', 'waitlisted', 'active', 'vacate_requested'];

export interface CapacityInfo {
  capacity: number;
  liveCount: number;
  available: number;
}

export async function checkCapacity(
  flow: AllocationFlow,
  collegeId: string,
  targetId: string,
  _stopName?: string, // reserved for future per-stop capacity; unused today
): Promise<CapacityInfo> {
  if (flow === 'hostel') {
    const room = await HostelRoom.findOne({ _id: targetId, collegeId }).lean();
    if (!room) throw new AppError(404, 'HostelRoom not found');
    const liveCount = await HostelAllocation.countDocuments({
      collegeId,
      roomId: targetId,
      status: { $in: LIVE_STATUSES },
    });
    return { capacity: room.capacity, liveCount, available: Math.max(0, room.capacity - liveCount) };
  } else {
    const route = await TransportRoute.findOne({ _id: targetId, collegeId }).lean();
    if (!route) throw new AppError(404, 'TransportRoute not found');
    const liveCount = await TransportAllocation.countDocuments({
      collegeId,
      routeId: targetId,
      status: { $in: LIVE_STATUSES },
    });
    return { capacity: route.capacity, liveCount, available: Math.max(0, route.capacity - liveCount) };
  }
}

// ─────────────────────────────────────────────────────────────
// Transition recorder
// ─────────────────────────────────────────────────────────────

/**
 * Minimal structural contract the transition recorder needs from an
 * allocation document. Fields are typed permissively enough to accept any
 * Mongoose-loaded HostelAllocation/TransportAllocation document without
 * callers having to cast — Mongoose's internal `Document._id` and
 * `bson.ObjectId` aren't literally the same TS type as `Types.ObjectId`
 * even though they're the same at runtime, so we describe what we need
 * rather than restate the full type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ObjectIdLike = any;

export interface AllocationDocLike {
  _id: ObjectIdLike;
  studentId: ObjectIdLike;
  academicYearId: ObjectIdLike;
  status: string;
  save: (opts?: { session?: ClientSession | null }) => Promise<unknown>;
}

export interface RecordTransitionParams {
  flow: AllocationFlow;
  collegeId: string;
  allocation: AllocationDocLike;
  fromStatus: string;
  toStatus: string;
  action: import('../../shared/types').AuditAction;
  performedBy: string;
  reason?: string;
  notifyStudent?: boolean;
  notifyAdmin?: boolean;
  triggerFee?: boolean;
  session?: ClientSession;
}

export async function recordTransition(params: RecordTransitionParams): Promise<void> {
  const {
    flow, collegeId, allocation, fromStatus, toStatus, action,
    performedBy, reason, notifyStudent, notifyAdmin, triggerFee, session,
  } = params;

  assertValidTransition(flow, fromStatus, toStatus);

  // Idempotent same-state transitions should still update audit trail if
  // the caller explicitly invoked them (e.g. retry-safe accept). But we
  // skip the Mongoose update since there's nothing to change.
  if (fromStatus !== toStatus) {
    allocation.status = toStatus;
    await allocation.save({ session });
  }

  // Audit log — use the semantic action name (propose/accept/expire/...)
  // now that AuditAction supports it, not a faked 'update'.
  await AuditLog.create(
    [{
      collegeId,
      entityType: flow === 'hostel' ? 'HostelAllocation' : 'TransportAllocation',
      entityId: String(allocation._id),
      entityName: `${flow}-${String(allocation._id).slice(-6)}`,
      studentId: allocation.studentId,
      action,
      changes: [{
        field: 'status',
        displayName: 'Status',
        oldValue: fromStatus,
        newValue: toStatus,
      }],
      performedBy,
      timestamp: new Date(),
    }],
    { session },
  );

  // Notifications (in-app only in v1)
  const serviceName = flow === 'hostel' ? 'Hostel' : 'Transport';
  const messageBody = buildNotificationMessage(flow, toStatus, reason);

  // Resolve sentBy — `performedBy` is usually a user id, but system sweeps
  // (the expiry worker) pass 'system'. Use a sentinel ObjectId for system.
  const sentBy = resolveSentBy(performedBy);

  const title = `${serviceName} allocation ${toStatus}`;
  const baseType = toStatus === 'expired' || toStatus === 'withdrawn' ? 'alert' : 'info';
  const emitEmailChannel = isEmailNotificationsEnabled();

  if (notifyStudent) {
    const records: Record<string, unknown>[] = [
      {
        collegeId, title, message: messageBody, type: baseType,
        targetAudience: 'individual', targetIds: [allocation.studentId],
        channel: 'app', sentBy, status: 'sent', sentAt: new Date(),
      },
    ];
    if (emitEmailChannel) {
      // Parallel email-channel record. Status is 'scheduled' — the yet-to-be-built
      // SMTP worker will transition it to 'sent' on successful delivery.
      records.push({
        collegeId, title, message: messageBody, type: baseType,
        targetAudience: 'individual', targetIds: [allocation.studentId],
        channel: 'email', sentBy, status: 'scheduled', scheduledAt: new Date(),
      });
    }
    await Notification.create(records, { session });
  }

  if (notifyAdmin) {
    const records: Record<string, unknown>[] = [
      {
        collegeId, title, message: messageBody, type: 'info',
        targetAudience: 'staff', channel: 'app',
        sentBy, status: 'sent', sentAt: new Date(),
      },
    ];
    if (emitEmailChannel) {
      records.push({
        collegeId, title, message: messageBody, type: 'info',
        targetAudience: 'staff', channel: 'email',
        sentBy, status: 'scheduled', scheduledAt: new Date(),
      });
    }
    await Notification.create(records, { session });
  }

  // Fee trigger: only on transitions that result in an active allocation
  if (triggerFee) {
    await maybeCreateFeeLineItem(flow, collegeId, allocation, session);
  }

}

// A fixed sentinel ObjectId used when a non-user actor (scheduled jobs,
// startup migrations) performs a transition. Persisting it gives the
// audit/notification models a valid ObjectId while keeping "system" semantic.
const SYSTEM_ACTOR = new mongoose.Types.ObjectId('000000000000000000000000');

function resolveSentBy(performedBy: string): mongoose.Types.ObjectId {
  if (performedBy === 'system' || !mongoose.Types.ObjectId.isValid(performedBy)) {
    return SYSTEM_ACTOR;
  }
  return new mongoose.Types.ObjectId(performedBy);
}

function buildNotificationMessage(flow: AllocationFlow, toStatus: string, reason?: string): string {
  const service = flow === 'hostel' ? 'hostel' : 'transport';
  const base = (() => {
    switch (toStatus) {
      case 'proposed': return `A ${service} allocation has been proposed for you.`;
      case 'active': return `Your ${service} allocation is now active.`;
      case 'declined': return `Your ${service} allocation proposal has been declined.`;
      case 'withdrawn': return `Your ${service} allocation proposal has been withdrawn.`;
      case 'expired': return `Your ${service} allocation proposal has expired.`;
      case 'vacate_requested': return `A vacate request has been filed for your ${service} allocation.`;
      case 'vacated': return `Your hostel allocation has been vacated.`;
      case 'cancelled': return `Your transport allocation has been cancelled.`;
      default: return `${service} allocation status: ${toStatus}.`;
    }
  })();
  return reason ? `${base} Reason: ${reason}` : base;
}

async function maybeCreateFeeLineItem(
  flow: AllocationFlow,
  collegeId: string,
  allocation: AllocationDocLike,
  session?: ClientSession,
): Promise<void> {
  const component = flow === 'hostel' ? 'hostel_fee' : 'transport_fee';

  // Idempotency guard
  const existing = await FeeLineItem.findOne({
    collegeId,
    studentId: allocation.studentId,
    component,
    academicYearId: allocation.academicYearId,
  }).session(session ?? null);
  if (existing) return;

  // Look up fee structure; if not found, create placeholder with 0 amount.
  const fs = await FeeStructure.findOne({
    collegeId,
    academicYearId: allocation.academicYearId,
    status: 'active',
  }).lean();

  let amount = 0;
  if (fs) {
    const comp = fs.components.find((c: { name: string; amount: number }) => c.name === component);
    if (comp) amount = comp.amount;
  }

  if (amount === 0) {
    console.warn(
      `[allocation-lifecycle] No '${component}' found in active FeeStructure for college=${collegeId} ` +
      `academicYear=${String(allocation.academicYearId)}; creating $0 line item for manual backfill.`,
    );
  }

  await FeeLineItem.create(
    [{
      collegeId,
      studentId: allocation.studentId,
      component,
      academicYearId: allocation.academicYearId,
      amount,
      status: 'pending',
    }],
    { session },
  );
}
