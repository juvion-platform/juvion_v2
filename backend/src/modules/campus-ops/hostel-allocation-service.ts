/**
 * hostel-allocation-service — the propose → accept/decline/vacate lifecycle
 * for HostelAllocation. Implements T4 (admin actions) and T5 (student
 * actions) of the optional-hostel-transport-allotment feature.
 *
 * Lives alongside the legacy `hostel-service.ts` to avoid bloating that
 * file. Legacy auto-allocate code stays put; this module is the new path.
 */

import mongoose from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { HostelClearance } from '../../models/campus/HostelClearance';
import {
  recordTransition,
  checkCapacity,
  computeExpiry,
} from './allocation-lifecycle';

// ─────────────────────────────────────────────────────────────
// T4: admin-side actions
// ─────────────────────────────────────────────────────────────

export interface ProposeHostelData {
  studentId: string;
  roomId: string;
  bedId?: string;
  academicYearId: string;
  preferences?: {
    blockPreference?: string;
    floorPreference?: number;
    roomTypePreference?: string;
  };
  specialNeeds?: { accessibility?: boolean; medical?: string };
  forceWaitlist?: boolean;
}

export async function proposeHostelAllocation(
  collegeId: string,
  data: ProposeHostelData,
  performedBy: string,
) {
  // Idempotency: if a proposed/active allocation already exists for
  // (studentId, academicYearId), return it instead of creating a duplicate.
  const existing = await HostelAllocation.findOne({
    collegeId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    status: { $in: ['proposed', 'waitlisted', 'active', 'vacate_requested'] },
  });
  if (existing) return existing;

  const cap = await checkCapacity('hostel', collegeId, data.roomId);
  const { expiresAt, ttlDays } = await computeExpiry('hostel', collegeId);

  let status: 'proposed' | 'waitlisted';
  let waitlistPosition: number | undefined;

  if (cap.available > 0 && !data.forceWaitlist) {
    status = 'proposed';
  } else if (data.forceWaitlist) {
    status = 'waitlisted';
    waitlistPosition = await nextHostelWaitlistPosition(collegeId, data.roomId);
  } else {
    throw new AppError(
      409,
      `capacity_full: room has no available capacity (${cap.liveCount}/${cap.capacity}); pass forceWaitlist=true to queue`,
    );
  }

  const allocation = await HostelAllocation.create({
    collegeId,
    studentId: data.studentId,
    roomId: data.roomId,
    bedId: data.bedId,
    academicYearId: data.academicYearId,
    preferences: data.preferences,
    specialNeeds: data.specialNeeds,
    status,
    allocationMethod: 'admin_proposed',
    proposedBy: performedBy,
    proposedAt: new Date(),
    ttlDays,
    expiresAt,
    waitlistPosition,
  });

  await recordTransition({
    flow: 'hostel',
    collegeId,
    allocation,
    fromStatus: status, // no prior state — use the created state as "from"
    toStatus: status,
    action: 'propose',
    performedBy,
    notifyStudent: true,
  });

  return allocation;
}

export async function withdrawHostelProposal(
  collegeId: string,
  allocationId: string,
  performedBy: string,
  reason: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  if (!['proposed', 'waitlisted'].includes(allocation.status)) {
    throw new AppError(409, `invalid_transition: cannot withdraw an allocation in status '${allocation.status}'`);
  }
  const fromStatus = allocation.status;
  (allocation as { withdrawReason?: string }).withdrawReason = reason;
  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus, toStatus: 'withdrawn', action: 'withdraw',
    performedBy, reason, notifyStudent: true,
  });
  return allocation;
}

export async function promoteHostelWaitlist(
  collegeId: string,
  allocationId: string,
  performedBy: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  if (allocation.status !== 'waitlisted') {
    throw new AppError(409, `invalid_transition: only waitlisted allocations can be promoted (got '${allocation.status}')`);
  }
  const cap = await checkCapacity('hostel', collegeId, String(allocation.roomId));
  if (cap.available <= 0) {
    throw new AppError(409, 'capacity_full: room has no capacity to promote into');
  }
  const { expiresAt, ttlDays } = await computeExpiry('hostel', collegeId);
  (allocation as { proposedAt?: Date }).proposedAt = new Date();
  (allocation as { expiresAt?: Date }).expiresAt = expiresAt;
  (allocation as { ttlDays?: number }).ttlDays = ttlDays;
  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus: 'waitlisted', toStatus: 'proposed', action: 'waitlist_promote',
    performedBy, notifyStudent: true,
  });
  return allocation;
}

// ─────────────────────────────────────────────────────────────
// T5: student-side actions
// ─────────────────────────────────────────────────────────────

export async function acceptHostelProposal(
  collegeId: string,
  allocationId: string,
  studentId: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  assertStudentOwnership(allocation, studentId);
  // Idempotent: if already active, return current state without double-triggering fees
  if (allocation.status === 'active') return allocation;
  if (allocation.status !== 'proposed') {
    throw new AppError(409, `invalid_transition: cannot accept from '${allocation.status}'`);
  }

  // Atomic occupancy bump with capacity guard
  const room = await HostelRoom.findOneAndUpdate(
    {
      _id: allocation.roomId,
      collegeId,
      $expr: { $lt: ['$currentOccupancy', '$capacity'] },
    },
    { $inc: { currentOccupancy: 1 } },
    { new: true },
  );
  if (!room) {
    throw new AppError(409, 'capacity_full: room reached capacity before accept could complete');
  }

  (allocation as { respondedAt?: Date }).respondedAt = new Date();
  (allocation as { respondedBy?: mongoose.Types.ObjectId }).respondedBy = new mongoose.Types.ObjectId(studentId);

  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus: 'proposed', toStatus: 'active', action: 'accept',
    performedBy: studentId, triggerFee: true, notifyStudent: true,
  });
  return allocation;
}

export async function declineHostelProposal(
  collegeId: string,
  allocationId: string,
  studentId: string,
  reason?: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  assertStudentOwnership(allocation, studentId);
  if (allocation.status !== 'proposed') {
    throw new AppError(409, `invalid_transition: cannot decline from '${allocation.status}'`);
  }
  (allocation as { respondedAt?: Date }).respondedAt = new Date();
  (allocation as { respondedBy?: mongoose.Types.ObjectId }).respondedBy = new mongoose.Types.ObjectId(studentId);
  (allocation as { declineReason?: string }).declineReason = reason;
  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus: 'proposed', toStatus: 'declined', action: 'decline',
    performedBy: studentId, reason, notifyAdmin: true,
  });
  return allocation;
}

export async function requestVacateHostel(
  collegeId: string,
  allocationId: string,
  studentId: string,
  reason?: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  assertStudentOwnership(allocation, studentId);
  if (allocation.status !== 'active') {
    throw new AppError(409, `invalid_transition: cannot request vacate from '${allocation.status}'`);
  }
  (allocation as { vacateRequestedAt?: Date }).vacateRequestedAt = new Date();

  await HostelClearance.create({
    collegeId,
    studentId,
    allocationId: allocation._id,
    status: 'pending',
    blockingItems: reason ? [{ item: 'vacate_reason', reason }] : [],
  });

  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus: 'active', toStatus: 'vacate_requested', action: 'vacate_request',
    performedBy: studentId, reason, notifyAdmin: true,
  });
  return allocation;
}

export async function approveVacateHostel(
  collegeId: string,
  allocationId: string,
  performedBy: string,
  clearanceNotes?: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  if (allocation.status !== 'vacate_requested') {
    throw new AppError(409, `invalid_transition: cannot approve vacate from '${allocation.status}'`);
  }

  // Decrement room occupancy
  await HostelRoom.findOneAndUpdate(
    { _id: allocation.roomId, collegeId },
    { $inc: { currentOccupancy: -1 } },
  );

  (allocation as { vacatedDate?: Date }).vacatedDate = new Date();
  (allocation as { vacateApprovedBy?: mongoose.Types.ObjectId }).vacateApprovedBy = new mongoose.Types.ObjectId(performedBy);

  // Mark the clearance record cleared (fee settlement is a separate finance concern — v1 scope)
  await HostelClearance.updateOne(
    { collegeId, allocationId: allocation._id, status: 'pending' },
    {
      $set: {
        status: 'cleared',
        clearedAt: new Date(),
        clearedBy: new mongoose.Types.ObjectId(performedBy),
        duesCleared: false, // flags "fee settlement needed" per spec §5.3 AC-14
        damageAssessment: clearanceNotes,
      },
    },
  );

  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus: 'vacate_requested', toStatus: 'vacated', action: 'vacate_approve',
    performedBy, notifyStudent: true,
  });
  return allocation;
}

export async function rejectVacateHostel(
  collegeId: string,
  allocationId: string,
  performedBy: string,
  reason: string,
) {
  const allocation = await loadHostel(collegeId, allocationId);
  if (allocation.status !== 'vacate_requested') {
    throw new AppError(409, `invalid_transition: cannot reject vacate from '${allocation.status}'`);
  }

  await HostelClearance.updateOne(
    { collegeId, allocationId: allocation._id, status: 'pending' },
    {
      $set: { status: 'blocked' },
      $push: { blockingItems: { item: 'vacate_rejected', reason } },
    },
  );

  await recordTransition({
    flow: 'hostel', collegeId, allocation,
    fromStatus: 'vacate_requested', toStatus: 'active', action: 'vacate_reject',
    performedBy, reason, notifyStudent: true,
  });
  return allocation;
}

// ─── helpers ─────────────────────────────────────────────────

async function loadHostel(collegeId: string, allocationId: string) {
  const allocation = await HostelAllocation.findOne({ _id: allocationId, collegeId });
  if (!allocation) throw new AppError(404, 'HostelAllocation not found');
  return allocation;
}

function assertStudentOwnership(
  allocation: { studentId: mongoose.Types.ObjectId | unknown },
  studentId: string,
) {
  if (String(allocation.studentId) !== String(studentId)) {
    throw new AppError(403, 'You can only act on your own allocation');
  }
}

async function nextHostelWaitlistPosition(collegeId: string, roomId: string): Promise<number> {
  const last = await HostelAllocation.findOne({ collegeId, roomId, status: 'waitlisted' })
    .sort({ waitlistPosition: -1 });
  return ((last as { waitlistPosition?: number } | null)?.waitlistPosition ?? 0) + 1;
}
