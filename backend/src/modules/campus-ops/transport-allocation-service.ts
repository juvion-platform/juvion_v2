/**
 * transport-allocation-service — the propose → accept/decline/cancel lifecycle
 * for TransportAllocation. Implements T6 (admin) and T7 (student) of the
 * optional-hostel-transport-allotment feature.
 *
 * Mirrors hostel-allocation-service.ts. The only semantic divergences:
 *   - Terminal vacate state is 'cancelled' (not 'vacated').
 *   - On accept, sets `feeTriggered=true` in addition to creating the fee.
 *   - Uses TransportClearance instead of HostelClearance.
 *   - Capacity pool is `TransportRoute.capacity` minus live allocations.
 */

import mongoose from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { TransportRoute } from '../../models/welfare/TransportRoute';
import { TransportClearance } from '../../models/campus/TransportClearance';
import {
  recordTransition,
  checkCapacity,
  computeExpiry,
} from './allocation-lifecycle';

// ─────────────────────────────────────────────────────────────
// T6: admin-side actions
// ─────────────────────────────────────────────────────────────

export interface ProposeTransportData {
  studentId: string;
  routeId: string;
  stopName: string;
  stopId?: string;
  boardingPoint?: string;
  academicYearId: string;
  forceWaitlist?: boolean;
}

export async function proposeTransportAllocation(
  collegeId: string,
  data: ProposeTransportData,
  performedBy: string,
) {
  const existing = await TransportAllocation.findOne({
    collegeId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    status: { $in: ['proposed', 'waitlisted', 'active', 'vacate_requested'] },
  });
  if (existing) return existing;

  const cap = await checkCapacity('transport', collegeId, data.routeId, data.stopName);
  const { expiresAt, ttlDays } = await computeExpiry('transport', collegeId);

  let status: 'proposed' | 'waitlisted';
  let waitlistPosition: number | undefined;

  if (cap.available > 0 && !data.forceWaitlist) {
    status = 'proposed';
  } else if (data.forceWaitlist) {
    status = 'waitlisted';
    waitlistPosition = await nextTransportWaitlistPosition(collegeId, data.routeId);
  } else {
    throw new AppError(
      409,
      `capacity_full: route has no available capacity (${cap.liveCount}/${cap.capacity}); pass forceWaitlist=true to queue`,
    );
  }

  const allocation = await TransportAllocation.create({
    collegeId,
    studentId: data.studentId,
    routeId: data.routeId,
    stopName: data.stopName,
    stopId: data.stopId,
    boardingPoint: data.boardingPoint,
    academicYearId: data.academicYearId,
    status,
    allocationType: 'admin_proposed',
    proposedBy: performedBy,
    proposedAt: new Date(),
    ttlDays,
    expiresAt,
    waitlistPosition,
  });

  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: status, toStatus: status, action: 'propose',
    performedBy, notifyStudent: true,
  });

  return allocation;
}

export async function withdrawTransportProposal(
  collegeId: string,
  allocationId: string,
  performedBy: string,
  reason: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  if (!['proposed', 'waitlisted'].includes(allocation.status)) {
    throw new AppError(409, `invalid_transition: cannot withdraw an allocation in status '${allocation.status}'`);
  }
  const fromStatus = allocation.status;
  (allocation as { withdrawReason?: string }).withdrawReason = reason;
  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus, toStatus: 'withdrawn', action: 'withdraw',
    performedBy, reason, notifyStudent: true,
  });
  return allocation;
}

export async function promoteTransportWaitlist(
  collegeId: string,
  allocationId: string,
  performedBy: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  if (allocation.status !== 'waitlisted') {
    throw new AppError(409, `invalid_transition: only waitlisted allocations can be promoted (got '${allocation.status}')`);
  }
  const cap = await checkCapacity('transport', collegeId, String(allocation.routeId));
  if (cap.available <= 0) {
    throw new AppError(409, 'capacity_full: route has no capacity to promote into');
  }
  const { expiresAt, ttlDays } = await computeExpiry('transport', collegeId);
  (allocation as { proposedAt?: Date }).proposedAt = new Date();
  (allocation as { expiresAt?: Date }).expiresAt = expiresAt;
  (allocation as { ttlDays?: number }).ttlDays = ttlDays;
  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: 'waitlisted', toStatus: 'proposed', action: 'waitlist_promote',
    performedBy, notifyStudent: true,
  });
  return allocation;
}

// ─────────────────────────────────────────────────────────────
// T7: student-side actions
// ─────────────────────────────────────────────────────────────

export async function acceptTransportProposal(
  collegeId: string,
  allocationId: string,
  studentId: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  assertStudentOwnership(allocation, studentId);
  if (allocation.status === 'active') return allocation;
  if (allocation.status !== 'proposed') {
    throw new AppError(409, `invalid_transition: cannot accept from '${allocation.status}'`);
  }

  // Atomic ridership bump with capacity guard
  const route = await TransportRoute.findOneAndUpdate(
    {
      _id: allocation.routeId,
      collegeId,
      $expr: { $lt: ['$currentRidership', '$capacity'] },
    },
    { $inc: { currentRidership: 1 } },
    { new: true },
  );
  if (!route) {
    throw new AppError(409, 'capacity_full: route reached capacity before accept could complete');
  }

  (allocation as { respondedAt?: Date }).respondedAt = new Date();
  (allocation as { respondedBy?: mongoose.Types.ObjectId }).respondedBy = new mongoose.Types.ObjectId(studentId);
  (allocation as { feeTriggered?: boolean }).feeTriggered = true;

  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: 'proposed', toStatus: 'active', action: 'accept',
    performedBy: studentId, triggerFee: true, notifyStudent: true,
  });
  return allocation;
}

export async function declineTransportProposal(
  collegeId: string,
  allocationId: string,
  studentId: string,
  reason?: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  assertStudentOwnership(allocation, studentId);
  if (allocation.status !== 'proposed') {
    throw new AppError(409, `invalid_transition: cannot decline from '${allocation.status}'`);
  }
  (allocation as { respondedAt?: Date }).respondedAt = new Date();
  (allocation as { respondedBy?: mongoose.Types.ObjectId }).respondedBy = new mongoose.Types.ObjectId(studentId);
  (allocation as { declineReason?: string }).declineReason = reason;
  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: 'proposed', toStatus: 'declined', action: 'decline',
    performedBy: studentId, reason, notifyAdmin: true,
  });
  return allocation;
}

export async function requestCancelTransport(
  collegeId: string,
  allocationId: string,
  studentId: string,
  reason?: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  assertStudentOwnership(allocation, studentId);
  if (allocation.status !== 'active') {
    throw new AppError(409, `invalid_transition: cannot request cancel from '${allocation.status}'`);
  }
  (allocation as { vacateRequestedAt?: Date }).vacateRequestedAt = new Date();

  await TransportClearance.create({
    collegeId,
    studentId,
    allocationId: allocation._id,
    status: 'pending',
    blockingItems: reason ? [{ item: 'cancel_reason', reason }] : [],
  });

  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: 'active', toStatus: 'vacate_requested', action: 'vacate_request',
    performedBy: studentId, reason, notifyAdmin: true,
  });
  return allocation;
}

export async function approveCancelTransport(
  collegeId: string,
  allocationId: string,
  performedBy: string,
  clearanceNotes?: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  if (allocation.status !== 'vacate_requested') {
    throw new AppError(409, `invalid_transition: cannot approve cancel from '${allocation.status}'`);
  }

  await TransportRoute.findOneAndUpdate(
    { _id: allocation.routeId, collegeId },
    { $inc: { currentRidership: -1 } },
  );

  (allocation as { vacateApprovedBy?: mongoose.Types.ObjectId }).vacateApprovedBy = new mongoose.Types.ObjectId(performedBy);

  await TransportClearance.updateOne(
    { collegeId, allocationId: allocation._id, status: 'pending' },
    {
      $set: {
        status: 'cleared',
        clearedAt: new Date(),
        clearedBy: new mongoose.Types.ObjectId(performedBy),
        duesCleared: false, // fee settlement pending
      },
      ...(clearanceNotes ? { $push: { blockingItems: { item: 'notes', reason: clearanceNotes } } } : {}),
    },
  );

  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: 'vacate_requested', toStatus: 'cancelled', action: 'vacate_approve',
    performedBy, notifyStudent: true,
  });
  return allocation;
}

export async function rejectCancelTransport(
  collegeId: string,
  allocationId: string,
  performedBy: string,
  reason: string,
) {
  const allocation = await loadTransport(collegeId, allocationId);
  if (allocation.status !== 'vacate_requested') {
    throw new AppError(409, `invalid_transition: cannot reject cancel from '${allocation.status}'`);
  }
  await TransportClearance.updateOne(
    { collegeId, allocationId: allocation._id, status: 'pending' },
    {
      $set: { status: 'blocked' },
      $push: { blockingItems: { item: 'cancel_rejected', reason } },
    },
  );
  await recordTransition({
    flow: 'transport', collegeId, allocation,
    fromStatus: 'vacate_requested', toStatus: 'active', action: 'vacate_reject',
    performedBy, reason, notifyStudent: true,
  });
  return allocation;
}

// ─── helpers ─────────────────────────────────────────────────

async function loadTransport(collegeId: string, allocationId: string) {
  const allocation = await TransportAllocation.findOne({ _id: allocationId, collegeId });
  if (!allocation) throw new AppError(404, 'TransportAllocation not found');
  return allocation;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertStudentOwnership(allocation: any, studentId: string) {
  if (String(allocation.studentId) !== String(studentId)) {
    throw new AppError(403, 'You can only act on your own allocation');
  }
}

async function nextTransportWaitlistPosition(collegeId: string, routeId: string): Promise<number> {
  const last = await TransportAllocation.findOne({ collegeId, routeId, status: 'waitlisted' })
    .sort({ waitlistPosition: -1 });
  return ((last as { waitlistPosition?: number } | null)?.waitlistPosition ?? 0) + 1;
}
