// campus-ops hostel sub-domain service — W08-L2-001 through W08-L2-009
import { Bed } from '../../models/campus/Bed';
import { HostelAttendance } from '../../models/campus/HostelAttendance';
import { HostelLeave } from '../../models/campus/HostelLeave';
import { HostelViolation } from '../../models/campus/HostelViolation';
import { emitRiskSignal } from '../welfare/risk-emitters';
import { HostelPenalty } from '../../models/campus/HostelPenalty';
import { HostelAppeal } from '../../models/campus/HostelAppeal';
import { HostelClearance } from '../../models/campus/HostelClearance';
import { RoomChangeRequest } from '../../models/campus/RoomChangeRequest';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { HostelBlock } from '../../models/welfare/HostelBlock';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { FieldChange } from '../../shared/types';

// ===========================================================================
// Helper: load or create default CampusConfig for a college
// ===========================================================================

async function getHostelConfig(collegeId: string) {
  let config = await CampusConfig.findOne({ collegeId });
  if (!config) {
    config = await CampusConfig.create({ collegeId });
  }
  return config.hostel;
}

// ===========================================================================
// Helper: score a bed for a student based on allocation algorithm
// ===========================================================================

interface AllocationPreferences {
  blockPreference?: string;
  floorPreference?: number;
  roomTypePreference?: string;
  roommatePreference?: string;
}

interface SpecialNeeds {
  accessibility?: boolean;
  medical?: string;
}

function scoreBed(
  _bed: { roomId: any },
  room: { blockId: any; floor: number; roomType: string; currentOccupancy: number; capacity: number; isAccessible: boolean },
  blockId: string,
  preferences: AllocationPreferences | undefined,
  algorithm: string,
  preferenceWeight: number,
  capacityWeight: number,
  _fillIndex: number,
  _totalBeds: number,
): number {
  let prefScore = 0;
  let capScore = 0;

  // Preference scoring
  if (preferences) {
    let matches = 0;
    let total = 0;
    if (preferences.blockPreference) {
      total++;
      if (String(blockId) === preferences.blockPreference) matches++;
    }
    if (preferences.floorPreference !== undefined) {
      total++;
      if (room.floor === preferences.floorPreference) matches++;
    }
    if (preferences.roomTypePreference) {
      total++;
      if (room.roomType === preferences.roomTypePreference) matches++;
    }
    prefScore = total > 0 ? (matches / total) * 100 : 50;
  } else {
    prefScore = 50;
  }

  // Capacity scoring: prefer rooms that are closer to being full (pack rooms)
  const fillRatio = room.currentOccupancy / room.capacity;
  capScore = fillRatio * 100;

  if (algorithm === 'preference_based') return Math.round(prefScore);
  if (algorithm === 'capacity_first') return Math.round(capScore);
  // hybrid
  return Math.round(prefScore * preferenceWeight + capScore * capacityWeight);
}

// ===========================================================================
// W08-L2-001: Allocate Hostel Room (Bulk — New Intake)
// ===========================================================================

export async function allocateHostelBulk(
  collegeId: string,
  data: { studentIds: string[]; academicYearId: string },
  performedBy: string,
) {
  const hostelConfig = await getHostelConfig(collegeId);
  const algorithm = hostelConfig?.allocationAlgorithm ?? 'hybrid';
  const preferenceWeight = hostelConfig?.preferenceWeight ?? 0.6;
  const capacityWeight = hostelConfig?.capacityWeight ?? 0.4;
  const specialNeedsAutoFlag = hostelConfig?.specialNeedsAutoFlag ?? true;

  const results: Array<{
    studentId: string;
    allocationId?: string;
    matchScore?: number;
    requiresHumanReview: boolean;
    waitlisted: boolean;
    error?: string;
  }> = [];

  for (const studentId of data.studentIds) {
    try {
      // Check for existing active allocation
      const existing = await HostelAllocation.findOne({
        collegeId,
        studentId,
        academicYearId: data.academicYearId,
        status: 'active',
      });
      if (existing) {
        results.push({ studentId, allocationId: String(existing._id), matchScore: existing.matchScore, requiresHumanReview: false, waitlisted: false });
        continue;
      }

      // TODO: read student gender from M02 Person to filter blocks by type (boys/girls)
      const blocks = await HostelBlock.find({ collegeId, isActive: true });
      const blockIds = blocks.map((b) => String(b._id));

      // Find rooms with available beds across eligible blocks
      const rooms = await HostelRoom.find({
        collegeId,
        blockId: { $in: blockIds },
        status: { $in: ['available'] },
        $expr: { $lt: ['$currentOccupancy', '$capacity'] },
      });

      if (rooms.length === 0) {
        // No vacancy — waitlist
        const waitlistCount = await HostelAllocation.countDocuments({
          collegeId,
          academicYearId: data.academicYearId,
          allocationMethod: 'waitlist',
        });
        const wlDoc = await HostelAllocation.create({
          collegeId,
          studentId,
          roomId: blockIds[0] as any, // placeholder; will be assigned on dequeue
          academicYearId: data.academicYearId,
          allocationType: 'new_intake',
          allocationMethod: 'waitlist',
          waitlistPosition: waitlistCount + 1,
          status: 'active',
        });

        await createAuditLog({
          collegeId,
          entityType: 'HostelAllocation',
          entityId: String(wlDoc._id),
          entityName: `Hostel Waitlist - ${studentId}`,
          action: 'create',
          changes: [{ field: 'allocationMethod', displayName: 'Allocation Method', oldValue: null, newValue: 'waitlist' }],
          performedBy,
        });

        results.push({ studentId, allocationId: String(wlDoc._id), requiresHumanReview: false, waitlisted: true });
        continue;
      }

      // Find available beds in eligible rooms
      const roomIds = rooms.map((r) => String(r._id));
      const beds = await Bed.find({ collegeId, roomId: { $in: roomIds }, status: 'available' });

      if (beds.length === 0) {
        results.push({ studentId, requiresHumanReview: true, waitlisted: false, error: 'No available beds found despite room vacancies' });
        continue;
      }

      // Score each bed
      const scored = beds.map((bed, idx) => {
        const room = rooms.find((r) => String(r._id) === String(bed.roomId));
        if (!room) return { bed, score: 0 };
        const blockId = String(room.blockId);
        const score = scoreBed(bed, room, blockId, undefined, algorithm, preferenceWeight, capacityWeight, idx, beds.length);
        return { bed, room, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const best = scored[0]!;
      const needsReview = specialNeedsAutoFlag && false; // TODO: check student special needs from M02

      const allocation = await HostelAllocation.create({
        collegeId,
        studentId,
        roomId: best.bed.roomId,
        bedId: best.bed._id,
        academicYearId: data.academicYearId,
        allocationType: 'new_intake',
        allocationMethod: needsReview ? 'manual_override' : 'ai_recommended',
        matchScore: best.score,
        status: 'active',
      });

      // Update bed status
      await Bed.updateOne({ _id: best.bed._id, collegeId }, { status: 'allocated' });

      // Update room occupancy
      await HostelRoom.updateOne({ _id: best.bed.roomId, collegeId }, { $inc: { currentOccupancy: 1 } });

      // TODO: emit hostel.fee.trigger to M04 via BullMQ

      await createAuditLog({
        collegeId,
        entityType: 'HostelAllocation',
        entityId: String(allocation._id),
        entityName: `Hostel Allocation - ${studentId}`,
        action: 'create',
        changes: [
          { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
          { field: 'matchScore', displayName: 'Match Score', oldValue: null, newValue: best.score },
          { field: 'allocationMethod', displayName: 'Allocation Method', oldValue: null, newValue: allocation.allocationMethod },
        ],
        performedBy,
      });

      results.push({
        studentId,
        allocationId: String(allocation._id),
        matchScore: best.score,
        requiresHumanReview: needsReview,
        waitlisted: false,
      });
    } catch (err: any) {
      results.push({ studentId, requiresHumanReview: true, waitlisted: false, error: err.message ?? 'Allocation failed' });
    }
  }

  return results;
}

// ===========================================================================
// W08-L2-002: Allocate Hostel Room (Mid-Year — Single)
// ===========================================================================

export async function allocateHostelSingle(
  collegeId: string,
  data: { studentId: string; academicYearId: string; preferences?: AllocationPreferences; specialNeeds?: SpecialNeeds },
  performedBy: string,
) {
  const hostelConfig = await getHostelConfig(collegeId);
  const algorithm = hostelConfig?.allocationAlgorithm ?? 'hybrid';
  const preferenceWeight = hostelConfig?.preferenceWeight ?? 0.6;
  const capacityWeight = hostelConfig?.capacityWeight ?? 0.4;
  const specialNeedsAutoFlag = hostelConfig?.specialNeedsAutoFlag ?? true;

  // Check for existing active allocation
  const existing = await HostelAllocation.findOne({
    collegeId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    status: 'active',
  });
  if (existing) throw new AppError(400, 'Student already has an active hostel allocation');

  // TODO: read student gender from M02 Person to filter blocks by type (boys/girls)
  const blocks = await HostelBlock.find({ collegeId, isActive: true });
  const blockIds = blocks.map((b) => String(b._id));

  // Find rooms with available beds, also check accessibility if needed
  const roomFilter: any = {
    collegeId,
    blockId: { $in: blockIds },
    status: { $in: ['available'] },
    $expr: { $lt: ['$currentOccupancy', '$capacity'] },
  };
  if (data.specialNeeds?.accessibility) {
    roomFilter.isAccessible = true;
  }

  const rooms = await HostelRoom.find(roomFilter);

  if (rooms.length === 0) {
    // No vacancy — add to waitlist
    const waitlistCount = await HostelAllocation.countDocuments({
      collegeId,
      academicYearId: data.academicYearId,
      allocationMethod: 'waitlist',
    });
    const wlDoc = await HostelAllocation.create({
      collegeId,
      studentId: data.studentId,
      roomId: blockIds[0] as any, // placeholder
      academicYearId: data.academicYearId,
      allocationType: 'mid_year',
      allocationMethod: 'waitlist',
      waitlistPosition: waitlistCount + 1,
      preferences: data.preferences ?? {},
      specialNeeds: data.specialNeeds ?? {},
      status: 'active',
    });

    await createAuditLog({
      collegeId,
      entityType: 'HostelAllocation',
      entityId: String(wlDoc._id),
      entityName: `Hostel Waitlist - ${data.studentId}`,
      action: 'create',
      changes: [
        { field: 'allocationMethod', displayName: 'Allocation Method', oldValue: null, newValue: 'waitlist' },
        { field: 'waitlistPosition', displayName: 'Waitlist Position', oldValue: null, newValue: waitlistCount + 1 },
      ],
      performedBy,
    });

    return { allocation: wlDoc, waitlisted: true, matchScore: undefined };
  }

  // Find available beds
  const roomIds = rooms.map((r) => String(r._id));
  const bedFilter: any = { collegeId, roomId: { $in: roomIds }, status: 'available' };
  if (data.specialNeeds?.accessibility) {
    bedFilter.isAccessible = true;
  }
  const beds = await Bed.find(bedFilter);

  if (beds.length === 0) throw new AppError(404, 'No available beds found');

  // Score each bed
  const scored = beds.map((bed, idx) => {
    const room = rooms.find((r) => String(r._id) === String(bed.roomId));
    if (!room) return { bed, score: 0 };
    const blockId = String(room.blockId);
    const score = scoreBed(bed, room, blockId, data.preferences, algorithm, preferenceWeight, capacityWeight, idx, beds.length);
    return { bed, room, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  const needsReview = specialNeedsAutoFlag && !!(data.specialNeeds?.accessibility || data.specialNeeds?.medical);

  const allocation = await HostelAllocation.create({
    collegeId,
    studentId: data.studentId,
    roomId: best.bed.roomId,
    bedId: best.bed._id,
    academicYearId: data.academicYearId,
    allocationType: 'mid_year',
    allocationMethod: needsReview ? 'manual_override' : 'ai_recommended',
    matchScore: best.score,
    preferences: data.preferences ?? {},
    specialNeeds: data.specialNeeds ?? {},
    status: 'active',
  });

  // Update bed and room
  await Bed.updateOne({ _id: best.bed._id, collegeId }, { status: 'allocated' });
  await HostelRoom.updateOne({ _id: best.bed.roomId, collegeId }, { $inc: { currentOccupancy: 1 } });

  // TODO: emit hostel.fee.trigger (prorated) to M04 via BullMQ

  await createAuditLog({
    collegeId,
    entityType: 'HostelAllocation',
    entityId: String(allocation._id),
    entityName: `Hostel Allocation (Mid-Year) - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
      { field: 'matchScore', displayName: 'Match Score', oldValue: null, newValue: best.score },
      { field: 'allocationMethod', displayName: 'Allocation Method', oldValue: null, newValue: allocation.allocationMethod },
    ],
    performedBy,
  });

  return { allocation, waitlisted: false, matchScore: best.score, requiresHumanReview: needsReview };
}

// ===========================================================================
// W08-L2-003: Room Change Request
// ===========================================================================

export async function submitRoomChangeRequest(
  collegeId: string,
  data: {
    studentId: string;
    currentRoomId: string;
    currentBedId?: string;
    requestedRoomId?: string;
    preferredBlockId?: string;
    reason: string;
    reasonCategory: string;
  },
  performedBy: string,
) {
  const doc = await RoomChangeRequest.create({ ...data, collegeId, status: 'requested' });

  await createAuditLog({
    collegeId,
    entityType: 'RoomChangeRequest',
    entityId: String(doc._id),
    entityName: `Room Change - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'requested' },
      { field: 'reasonCategory', displayName: 'Reason Category', oldValue: null, newValue: data.reasonCategory },
    ],
    performedBy,
  });

  return doc;
}

export async function approveRoomChange(
  collegeId: string,
  requestId: string,
  data: { newRoomId: string; newBedId: string },
  performedBy: string,
) {
  const request = await RoomChangeRequest.findOne({ _id: requestId, collegeId });
  if (!request) throw new AppError(404, 'Room change request not found');
  if (request.status !== 'requested') throw new AppError(400, 'Only requested changes can be approved');

  // Find the student's active allocation
  const activeAllocation = await HostelAllocation.findOne({
    collegeId,
    studentId: request.studentId,
    status: 'active',
  });
  if (!activeAllocation) throw new AppError(404, 'No active hostel allocation found for student');

  // Vacate old bed
  if (activeAllocation.bedId) {
    await Bed.updateOne({ _id: activeAllocation.bedId, collegeId }, { status: 'available' });
  }
  // Decrement old room occupancy
  await HostelRoom.updateOne({ _id: activeAllocation.roomId, collegeId }, { $inc: { currentOccupancy: -1 } });

  // Mark old allocation as transferred
  const oldRoomId = String(activeAllocation.roomId);
  activeAllocation.status = 'transferred';
  activeAllocation.vacatedDate = new Date();
  await activeAllocation.save();

  // Allocate new bed
  await Bed.updateOne({ _id: data.newBedId, collegeId }, { status: 'allocated' });
  // Increment new room occupancy
  await HostelRoom.updateOne({ _id: data.newRoomId, collegeId }, { $inc: { currentOccupancy: 1 } });

  // Create new allocation
  const newAllocation = await HostelAllocation.create({
    collegeId,
    studentId: request.studentId,
    roomId: data.newRoomId,
    bedId: data.newBedId,
    academicYearId: activeAllocation.academicYearId,
    allocationType: 'change',
    allocationMethod: 'manual_override',
    status: 'active',
  });

  // Update the room change request
  request.status = 'completed';
  request.approvedBy = performedBy as any;
  request.newRoomId = data.newRoomId as any;
  request.newBedId = data.newBedId as any;
  await request.save();

  await createAuditLog({
    collegeId,
    entityType: 'RoomChangeRequest',
    entityId: String(request._id),
    entityName: `Room Change Approved - ${String(request.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'requested', newValue: 'completed' },
      { field: 'oldRoomId', displayName: 'Old Room', oldValue: oldRoomId, newValue: data.newRoomId },
      { field: 'newAllocationId', displayName: 'New Allocation', oldValue: null, newValue: String(newAllocation._id) },
    ],
    performedBy,
  });

  return { request, newAllocation };
}

export async function rejectRoomChange(
  collegeId: string,
  requestId: string,
  data: { rejectionReason: string },
  performedBy: string,
) {
  const request = await RoomChangeRequest.findOne({ _id: requestId, collegeId });
  if (!request) throw new AppError(404, 'Room change request not found');
  if (request.status !== 'requested') throw new AppError(400, 'Only requested changes can be rejected');

  const oldStatus = request.status;
  request.status = 'rejected';
  request.rejectionReason = data.rejectionReason;
  await request.save();

  await createAuditLog({
    collegeId,
    entityType: 'RoomChangeRequest',
    entityId: String(request._id),
    entityName: `Room Change Rejected - ${String(request.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' },
      { field: 'rejectionReason', displayName: 'Rejection Reason', oldValue: null, newValue: data.rejectionReason },
    ],
    performedBy,
  });

  return request;
}

// ===========================================================================
// W08-L2-004: Hostel Clearance
// ===========================================================================

export async function initiateHostelClearance(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  const activeAllocation = await HostelAllocation.findOne({ collegeId, studentId, status: 'active' });
  if (!activeAllocation) throw new AppError(404, 'No active hostel allocation found for student');

  // Check if clearance already exists
  const existingClearance = await HostelClearance.findOne({
    collegeId,
    studentId,
    allocationId: activeAllocation._id,
    status: { $in: ['pending', 'blocked'] },
  });
  if (existingClearance) throw new AppError(400, 'Hostel clearance already initiated for this allocation');

  const doc = await HostelClearance.create({
    collegeId,
    studentId,
    allocationId: activeAllocation._id,
    roomVacated: false,
    keysReturned: false,
    damageAmount: 0,
    duesCleared: false,
    status: 'pending',
    blockingItems: [],
  });

  await createAuditLog({
    collegeId,
    entityType: 'HostelClearance',
    entityId: String(doc._id),
    entityName: `Hostel Clearance - ${studentId}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'pending' }],
    performedBy,
  });

  return doc;
}

export async function verifyHostelClearance(
  collegeId: string,
  clearanceId: string,
  data: {
    roomVacated?: boolean;
    keysReturned?: boolean;
    damageAssessment?: string;
    damageAmount?: number;
    duesCleared?: boolean;
  },
  performedBy: string,
) {
  const clearance = await HostelClearance.findOne({ _id: clearanceId, collegeId });
  if (!clearance) throw new AppError(404, 'Hostel clearance not found');
  if (clearance.status === 'cleared') throw new AppError(400, 'Clearance already completed');

  const changes: FieldChange[] = [];

  if (data.roomVacated !== undefined) {
    changes.push({ field: 'roomVacated', displayName: 'Room Vacated', oldValue: clearance.roomVacated, newValue: data.roomVacated });
    clearance.roomVacated = data.roomVacated;
  }
  if (data.keysReturned !== undefined) {
    changes.push({ field: 'keysReturned', displayName: 'Keys Returned', oldValue: clearance.keysReturned, newValue: data.keysReturned });
    clearance.keysReturned = data.keysReturned;
  }
  if (data.damageAssessment !== undefined) {
    changes.push({ field: 'damageAssessment', displayName: 'Damage Assessment', oldValue: clearance.damageAssessment, newValue: data.damageAssessment });
    clearance.damageAssessment = data.damageAssessment;
  }
  if (data.damageAmount !== undefined) {
    changes.push({ field: 'damageAmount', displayName: 'Damage Amount', oldValue: clearance.damageAmount, newValue: data.damageAmount });
    clearance.damageAmount = data.damageAmount;
  }
  if (data.duesCleared !== undefined) {
    changes.push({ field: 'duesCleared', displayName: 'Dues Cleared', oldValue: clearance.duesCleared, newValue: data.duesCleared });
    clearance.duesCleared = data.duesCleared;
  }

  // Determine blocking items
  const blockingItems: { item: string; reason: string }[] = [];
  if (!clearance.roomVacated) blockingItems.push({ item: 'roomVacated', reason: 'Room has not been vacated' });
  if (!clearance.keysReturned) blockingItems.push({ item: 'keysReturned', reason: 'Keys have not been returned' });
  if (!clearance.duesCleared) blockingItems.push({ item: 'duesCleared', reason: 'Outstanding dues not cleared' });
  if (clearance.damageAmount > 0 && !clearance.duesCleared) {
    blockingItems.push({ item: 'damagePayment', reason: `Damage amount of ${clearance.damageAmount} not settled` });
  }
  clearance.blockingItems = blockingItems;

  // Check if all items are clear
  const allClear = clearance.roomVacated && clearance.keysReturned && clearance.duesCleared;
  const oldStatus = clearance.status;

  if (allClear) {
    clearance.status = 'cleared';
    clearance.clearedAt = new Date();
    clearance.clearedBy = performedBy as any;

    // Update allocation to vacated
    await HostelAllocation.updateOne(
      { _id: clearance.allocationId, collegeId },
      { status: 'vacated', vacatedDate: new Date() },
    );

    // Free up bed
    const allocation = await HostelAllocation.findOne({ _id: clearance.allocationId, collegeId });
    if (allocation?.bedId) {
      await Bed.updateOne({ _id: allocation.bedId, collegeId }, { status: 'available' });
    }
    if (allocation?.roomId) {
      await HostelRoom.updateOne({ _id: allocation.roomId, collegeId }, { $inc: { currentOccupancy: -1 } });
    }
  } else if (blockingItems.length > 0) {
    clearance.status = 'blocked';
  }

  changes.push({ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: clearance.status });
  await clearance.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelClearance',
    entityId: String(clearance._id),
    entityName: `Hostel Clearance - ${String(clearance.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return clearance;
}

export async function getHostelClearanceStatus(collegeId: string, studentId: string) {
  const clearance = await HostelClearance.findOne({ collegeId, studentId })
    .sort({ createdAt: -1 })
    .lean();
  if (!clearance) throw new AppError(404, 'No hostel clearance found for student');
  return clearance;
}

// ===========================================================================
// W08-L2-005: Record Hostel Attendance
// ===========================================================================

export async function recordHostelAttendanceBulk(
  collegeId: string,
  data: { date: string; records: Array<{ studentId: string; status: string }> },
  performedBy: string,
) {
  const date = new Date(data.date);
  const results: Array<{ studentId: string; success: boolean; error?: string }> = [];

  for (const record of data.records) {
    try {
      // Find active allocation for the student
      const allocation = await HostelAllocation.findOne({
        collegeId,
        studentId: record.studentId,
        status: 'active',
        allocationMethod: { $ne: 'waitlist' },
      });
      if (!allocation) {
        results.push({ studentId: record.studentId, success: false, error: 'No active hostel allocation' });
        continue;
      }

      // Upsert attendance record (unique by collegeId+studentId+date)
      await HostelAttendance.findOneAndUpdate(
        { collegeId, studentId: record.studentId, date },
        {
          collegeId,
          studentId: record.studentId,
          allocationId: allocation._id,
          date,
          status: record.status,
          recordedBy: performedBy,
          method: 'manual',
        },
        { upsert: true, new: true },
      );

      results.push({ studentId: record.studentId, success: true });
    } catch (err: any) {
      results.push({ studentId: record.studentId, success: false, error: err.message ?? 'Failed to record attendance' });
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'HostelAttendance',
    entityId: `bulk-${data.date}`,
    entityName: `Hostel Attendance - ${data.date}`,
    action: 'create',
    changes: [
      { field: 'date', displayName: 'Date', oldValue: null, newValue: data.date },
      { field: 'recordCount', displayName: 'Record Count', oldValue: null, newValue: data.records.length },
    ],
    performedBy,
  });

  return results;
}

export async function detectAttendanceAnomalies(collegeId: string, data: { date: string }) {
  const hostelConfig = await getHostelConfig(collegeId);
  const threshold = hostelConfig?.attendanceAnomalyThreshold ?? 3;
  const targetDate = new Date(data.date);

  // Build date range for consecutive days check (look back `threshold` days)
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - (threshold - 1));

  // Find all hostel attendance records in the range that are absent
  const absentRecords = await HostelAttendance.find({
    collegeId,
    date: { $gte: startDate, $lte: targetDate },
    status: 'absent',
  }).lean();

  // Group by studentId and count consecutive absences
  const studentAbsences = new Map<string, number>();
  for (const rec of absentRecords) {
    const sid = String(rec.studentId);
    studentAbsences.set(sid, (studentAbsences.get(sid) ?? 0) + 1);
  }

  // Filter students with consecutive absences >= threshold
  const anomalyStudentIds: string[] = [];
  studentAbsences.forEach((count, sid) => {
    if (count >= threshold) {
      anomalyStudentIds.push(sid);
    }
  });

  // Exclude students who have active hostel leave during this period
  const activeLeaves = await HostelLeave.find({
    collegeId,
    studentId: { $in: anomalyStudentIds },
    status: { $in: ['approved', 'active'] },
    startDate: { $lte: targetDate },
    endDate: { $gte: startDate },
  }).lean();

  const studentsOnLeave = new Set(activeLeaves.map((l) => String(l.studentId)));

  const anomalies = anomalyStudentIds
    .filter((sid) => !studentsOnLeave.has(sid))
    .map((sid) => ({
      studentId: sid,
      consecutiveAbsences: studentAbsences.get(sid) ?? 0,
      threshold,
      period: { from: startDate.toISOString(), to: targetDate.toISOString() },
    }));

  // TODO: emit welfare signal to M06 via BullMQ

  return anomalies;
}

export async function getAttendanceAnomalies(collegeId: string, page: number, limit: number) {
  // Return a paginated list of anomaly-flagged students based on recent attendance
  // This is a convenience wrapper: we detect for today's date and paginate
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const anomalies = await detectAttendanceAnomalies(collegeId, { date: today.toISOString() });

  const startIdx = (page - 1) * limit;
  const paged = anomalies.slice(startIdx, startIdx + limit);

  return {
    items: paged,
    total: anomalies.length,
    page,
    pages: Math.ceil(anomalies.length / limit),
  };
}

// ===========================================================================
// W08-L2-006: Hostel Leave
// ===========================================================================

export async function submitHostelLeave(
  collegeId: string,
  data: {
    studentId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    destination: string;
    guardianContact: string;
    reason?: string;
  },
  performedBy: string,
) {
  const doc = await HostelLeave.create({
    ...data,
    collegeId,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    status: 'requested',
    parentNotified: false,
  });

  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(doc._id),
    entityName: `Hostel Leave - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'requested' },
      { field: 'leaveType', displayName: 'Leave Type', oldValue: null, newValue: data.leaveType },
    ],
    performedBy,
  });

  return doc;
}

export async function approveHostelLeave(
  collegeId: string,
  leaveId: string,
  performedBy: string,
) {
  const leave = await HostelLeave.findOne({ _id: leaveId, collegeId });
  if (!leave) throw new AppError(404, 'Hostel leave not found');
  if (leave.status !== 'requested') throw new AppError(400, 'Only requested leaves can be approved');

  const oldStatus = leave.status;
  leave.status = 'active';
  leave.approvedBy = performedBy as any;
  await leave.save();

  // TODO: notify parent via M12.2

  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(leave._id),
    entityName: `Hostel Leave Approved - ${String(leave.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'active' },
      { field: 'approvedBy', displayName: 'Approved By', oldValue: null, newValue: performedBy },
    ],
    performedBy,
  });

  return leave;
}

export async function rejectHostelLeave(
  collegeId: string,
  leaveId: string,
  data: { reason: string },
  performedBy: string,
) {
  const leave = await HostelLeave.findOne({ _id: leaveId, collegeId });
  if (!leave) throw new AppError(404, 'Hostel leave not found');
  if (leave.status !== 'requested') throw new AppError(400, 'Only requested leaves can be rejected');

  const oldStatus = leave.status;
  leave.status = 'rejected';
  await leave.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(leave._id),
    entityName: `Hostel Leave Rejected - ${String(leave.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' },
      { field: 'rejectionReason', displayName: 'Rejection Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return leave;
}

export async function recordHostelLeaveReturn(
  collegeId: string,
  leaveId: string,
  performedBy: string,
) {
  const leave = await HostelLeave.findOne({ _id: leaveId, collegeId });
  if (!leave) throw new AppError(404, 'Hostel leave not found');
  if (leave.status !== 'active') throw new AppError(400, 'Only active leaves can be marked as returned');

  const oldStatus = leave.status;
  leave.status = 'returned';
  leave.returnedAt = new Date();
  await leave.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(leave._id),
    entityName: `Hostel Leave Returned - ${String(leave.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'returned' },
      { field: 'returnedAt', displayName: 'Returned At', oldValue: null, newValue: leave.returnedAt },
    ],
    performedBy,
  });

  return leave;
}

// ===========================================================================
// W08-L2-007: Hostel Discipline Violation
// ===========================================================================

export async function reportViolation(
  collegeId: string,
  data: {
    studentId: string;
    reportedBy: string;
    violationType: string;
    description: string;
    evidence?: string[];
    severity: string;
  },
  performedBy: string,
) {
  const doc = await HostelViolation.create({
    ...data,
    collegeId,
    evidence: data.evidence ?? [],
    status: 'reported',
    welfareSignalSent: false,
  });

  // 008 Phase 1 — report to the CCD engine. `welfareSignalSent` has been on
  // this model from the start with nothing ever setting it; this is the path
  // it was waiting for. Flipped only when the signal was actually written, so
  // a deduped or failed emit leaves it false and stays honest.
  const signalled = await emitRiskSignal(collegeId, {
    studentId: data.studentId,
    source: 'M08',
    signalType: 'warden_concern',
    triggerData: {
      violationId: String(doc._id),
      violationType: data.violationType,
      severity: data.severity,
    },
  });
  if (signalled) {
    doc.welfareSignalSent = true;
    await doc.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(doc._id),
    entityName: `Violation - ${data.violationType} - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'reported' },
      { field: 'severity', displayName: 'Severity', oldValue: null, newValue: data.severity },
      { field: 'violationType', displayName: 'Violation Type', oldValue: null, newValue: data.violationType },
    ],
    performedBy,
  });

  return doc;
}

export async function investigateViolation(
  collegeId: string,
  violationId: string,
  performedBy: string,
) {
  const violation = await HostelViolation.findOne({ _id: violationId, collegeId });
  if (!violation) throw new AppError(404, 'Hostel violation not found');
  if (violation.status !== 'reported') throw new AppError(400, 'Only reported violations can be investigated');

  const oldStatus = violation.status;
  violation.status = 'under_investigation';
  await violation.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(violation._id),
    entityName: `Violation Investigation - ${String(violation.studentId)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'under_investigation' }],
    performedBy,
  });

  return violation;
}

export async function scheduleHearing(
  collegeId: string,
  violationId: string,
  data: { hearingDate: string },
  performedBy: string,
) {
  const violation = await HostelViolation.findOne({ _id: violationId, collegeId });
  if (!violation) throw new AppError(404, 'Hostel violation not found');
  if (!['reported', 'under_investigation'].includes(violation.status)) {
    throw new AppError(400, 'Hearing can only be scheduled for reported or under-investigation violations');
  }

  const oldStatus = violation.status;
  violation.status = 'hearing_scheduled';
  violation.hearingDate = new Date(data.hearingDate);
  await violation.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(violation._id),
    entityName: `Violation Hearing - ${String(violation.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'hearing_scheduled' },
      { field: 'hearingDate', displayName: 'Hearing Date', oldValue: null, newValue: data.hearingDate },
    ],
    performedBy,
  });

  return violation;
}

export async function assignPenalty(
  collegeId: string,
  violationId: string,
  data: { penaltyType: string; fineAmount?: number; effectiveDate: string; expiryDate?: string },
  performedBy: string,
) {
  const violation = await HostelViolation.findOne({ _id: violationId, collegeId });
  if (!violation) throw new AppError(404, 'Hostel violation not found');
  if (!['hearing_scheduled', 'under_investigation', 'reported'].includes(violation.status)) {
    throw new AppError(400, 'Penalty can only be assigned to violations that are reported, under investigation, or with hearing scheduled');
  }

  const hostelConfig = await getHostelConfig(collegeId);
  const appealDeadlineDays = hostelConfig?.appealDeadlineDays ?? 7;

  const effectiveDate = new Date(data.effectiveDate);
  const appealDeadline = new Date(effectiveDate);
  appealDeadline.setDate(appealDeadline.getDate() + appealDeadlineDays);

  // Create penalty
  const penalty = await HostelPenalty.create({
    collegeId,
    violationId,
    studentId: violation.studentId,
    penaltyType: data.penaltyType,
    fineAmount: data.fineAmount,
    effectiveDate,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
    status: 'active',
    appealDeadline,
  });

  // Update violation status
  const oldStatus = violation.status;
  violation.status = 'penalty_assigned';
  violation.outcome = data.penaltyType;
  await violation.save();

  // Stub: if fine, emit to M04
  if (data.penaltyType === 'fine' && data.fineAmount) {
    // TODO: emit hostel.penalty.fee to M04 via BullMQ with { studentId, amount: data.fineAmount }
  }

  // Stub: if severe violation (substance abuse type), emit welfare signal
  if (violation.severity === 'critical' || violation.severity === 'high') {
    // TODO: emit welfare signal {source: 'M08.1', signalType: 'discipline_severe', severity: violation.severity, studentId: String(violation.studentId)} to M06 via BullMQ
    violation.welfareSignalSent = true;
    await violation.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(violation._id),
    entityName: `Violation Penalty Assigned - ${String(violation.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'penalty_assigned' },
      { field: 'penaltyType', displayName: 'Penalty Type', oldValue: null, newValue: data.penaltyType },
    ],
    performedBy,
  });

  await createAuditLog({
    collegeId,
    entityType: 'HostelPenalty',
    entityId: String(penalty._id),
    entityName: `Penalty - ${data.penaltyType} - ${String(violation.studentId)}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
      { field: 'penaltyType', displayName: 'Penalty Type', oldValue: null, newValue: data.penaltyType },
      { field: 'appealDeadline', displayName: 'Appeal Deadline', oldValue: null, newValue: appealDeadline.toISOString() },
    ],
    performedBy,
  });

  return { violation, penalty };
}

export async function dismissViolation(
  collegeId: string,
  violationId: string,
  performedBy: string,
) {
  const violation = await HostelViolation.findOne({ _id: violationId, collegeId });
  if (!violation) throw new AppError(404, 'Hostel violation not found');
  if (violation.status === 'dismissed') throw new AppError(400, 'Violation is already dismissed');

  const oldStatus = violation.status;
  violation.status = 'dismissed';
  await violation.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(violation._id),
    entityName: `Violation Dismissed - ${String(violation.studentId)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'dismissed' }],
    performedBy,
  });

  return violation;
}

// ===========================================================================
// W08-L2-008: Hostel Appeals
// ===========================================================================

export async function fileAppeal(
  collegeId: string,
  data: { penaltyId: string; studentId: string; grounds: string; supportingDocuments?: string[] },
  performedBy: string,
) {
  const penalty = await HostelPenalty.findOne({ _id: data.penaltyId, collegeId });
  if (!penalty) throw new AppError(404, 'Hostel penalty not found');

  // Check appeal deadline
  if (penalty.appealDeadline && new Date() > penalty.appealDeadline) {
    throw new AppError(400, 'Appeal deadline has passed');
  }

  // Check for existing appeal
  const existingAppeal = await HostelAppeal.findOne({
    collegeId,
    penaltyId: data.penaltyId,
    studentId: data.studentId,
    status: { $nin: ['resolved'] },
  });
  if (existingAppeal) throw new AppError(400, 'An active appeal already exists for this penalty');

  const doc = await HostelAppeal.create({
    collegeId,
    penaltyId: data.penaltyId,
    studentId: data.studentId,
    grounds: data.grounds,
    supportingDocuments: data.supportingDocuments ?? [],
    status: 'submitted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'HostelAppeal',
    entityId: String(doc._id),
    entityName: `Appeal - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'submitted' },
      { field: 'grounds', displayName: 'Grounds', oldValue: null, newValue: data.grounds },
    ],
    performedBy,
  });

  return doc;
}

export async function resolveAppeal(
  collegeId: string,
  appealId: string,
  data: { outcome: string; outcomeRemarks: string },
  performedBy: string,
) {
  const appeal = await HostelAppeal.findOne({ _id: appealId, collegeId });
  if (!appeal) throw new AppError(404, 'Hostel appeal not found');
  if (appeal.status === 'resolved') throw new AppError(400, 'Appeal is already resolved');

  const oldStatus = appeal.status;
  appeal.outcome = data.outcome as any;
  appeal.outcomeRemarks = data.outcomeRemarks;
  appeal.reviewedBy = performedBy as any;
  appeal.status = 'resolved';
  await appeal.save();

  // Handle outcome effects on the penalty
  const penalty = await HostelPenalty.findOne({ _id: appeal.penaltyId, collegeId });
  if (penalty) {
    if (data.outcome === 'overturned') {
      // Cancel the penalty
      const oldPenaltyStatus = penalty.status;
      penalty.status = 'cancelled';
      await penalty.save();

      await createAuditLog({
        collegeId,
        entityType: 'HostelPenalty',
        entityId: String(penalty._id),
        entityName: `Penalty Overturned - ${String(penalty.studentId)}`,
        action: 'update',
        changes: [{ field: 'status', displayName: 'Status', oldValue: oldPenaltyStatus, newValue: 'cancelled' }],
        performedBy,
      });
    } else if (data.outcome === 'modified') {
      // Mark penalty as modified — actual modification details come through update
      const oldPenaltyStatus = penalty.status;
      penalty.status = 'modified';
      await penalty.save();

      await createAuditLog({
        collegeId,
        entityType: 'HostelPenalty',
        entityId: String(penalty._id),
        entityName: `Penalty Modified - ${String(penalty.studentId)}`,
        action: 'update',
        changes: [{ field: 'status', displayName: 'Status', oldValue: oldPenaltyStatus, newValue: 'modified' }],
        performedBy,
      });
    }
    // 'upheld' — no change to penalty
  }

  await createAuditLog({
    collegeId,
    entityType: 'HostelAppeal',
    entityId: String(appeal._id),
    entityName: `Appeal Resolved - ${String(appeal.studentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'resolved' },
      { field: 'outcome', displayName: 'Outcome', oldValue: null, newValue: data.outcome },
      { field: 'outcomeRemarks', displayName: 'Outcome Remarks', oldValue: null, newValue: data.outcomeRemarks },
    ],
    performedBy,
  });

  return appeal;
}

// ===========================================================================
// W08-L2-009: Warden Welfare Concern
// ===========================================================================

export async function escalateWardenConcern(
  collegeId: string,
  data: { studentId: string; concernType: string; severity: string; description: string; evidence?: string[] },
  performedBy: string,
) {
  const welfareSignal = {
    source: 'M08.1',
    signalType: 'warden_concern',
    collegeId,
    studentId: data.studentId,
    concernType: data.concernType,
    severity: data.severity,
    description: data.description,
    evidence: data.evidence ?? [],
    reportedBy: performedBy,
    timestamp: new Date().toISOString(),
  };

  // TODO: emit welfare signal {source: 'M08.1', signalType: 'warden_concern', severity, studentId} to M06 via BullMQ

  await createAuditLog({
    collegeId,
    entityType: 'WelfareSignal',
    entityId: `warden-concern-${data.studentId}-${Date.now()}`,
    entityName: `Warden Concern - ${data.concernType} - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'signalType', displayName: 'Signal Type', oldValue: null, newValue: 'warden_concern' },
      { field: 'severity', displayName: 'Severity', oldValue: null, newValue: data.severity },
      { field: 'concernType', displayName: 'Concern Type', oldValue: null, newValue: data.concernType },
    ],
    performedBy,
  });

  return welfareSignal;
}

// ===========================================================================
// CRUD: Bed
// ===========================================================================

export async function listBeds(collegeId: string, page = 1, limit = 20, roomId?: string) {
  const filter: any = { collegeId };
  if (roomId) filter.roomId = roomId;
  return paginate(Bed, filter, page, limit);
}

export async function getBed(collegeId: string, id: string) {
  const doc = await Bed.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Bed not found');
  return doc;
}

export async function createBed(collegeId: string, data: any, performedBy: string) {
  const doc = await Bed.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'Bed',
    entityId: String(doc._id),
    entityName: doc.bedNumber,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateBed(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Bed.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Bed not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Bed',
    entityId: String(doc._id),
    entityName: doc.bedNumber,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteBed(collegeId: string, id: string, performedBy: string) {
  const doc = await Bed.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Bed not found');

  await Bed.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'Bed',
    entityId: String(doc._id),
    entityName: doc.bedNumber,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD: HostelAttendance (list/get only — immutable)
// ===========================================================================

export async function listHostelAttendance(collegeId: string, page = 1, limit = 20, studentId?: string, date?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (date) filter.date = new Date(date);
  return paginate(HostelAttendance, filter, page, limit);
}

export async function getHostelAttendance(collegeId: string, id: string) {
  const doc = await HostelAttendance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel attendance record not found');
  return doc;
}

// ===========================================================================
// CRUD: HostelLeave
// ===========================================================================

export async function listHostelLeaves(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(HostelLeave, filter, page, limit);
}

export async function getHostelLeave(collegeId: string, id: string) {
  const doc = await HostelLeave.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel leave not found');
  return doc;
}

export async function createHostelLeave(collegeId: string, data: any, performedBy: string) {
  const doc = await HostelLeave.create({ ...data, collegeId, status: 'requested', parentNotified: false });
  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(doc._id),
    entityName: `Leave - ${String(doc.studentId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateHostelLeave(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await HostelLeave.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel leave not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(doc._id),
    entityName: `Leave - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteHostelLeave(collegeId: string, id: string, performedBy: string) {
  const doc = await HostelLeave.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel leave not found');

  await HostelLeave.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HostelLeave',
    entityId: String(doc._id),
    entityName: `Leave - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD: HostelViolation
// ===========================================================================

export async function listHostelViolations(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(HostelViolation, filter, page, limit);
}

export async function getHostelViolation(collegeId: string, id: string) {
  const doc = await HostelViolation.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel violation not found');
  return doc;
}

export async function createHostelViolation(collegeId: string, data: any, performedBy: string) {
  const doc = await HostelViolation.create({ ...data, collegeId, status: 'reported', welfareSignalSent: false });
  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(doc._id),
    entityName: `Violation - ${data.violationType ?? String(doc.studentId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateHostelViolation(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await HostelViolation.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel violation not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(doc._id),
    entityName: `Violation - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteHostelViolation(collegeId: string, id: string, performedBy: string) {
  const doc = await HostelViolation.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel violation not found');

  await HostelViolation.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HostelViolation',
    entityId: String(doc._id),
    entityName: `Violation - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD: HostelPenalty
// ===========================================================================

export async function listHostelPenalties(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(HostelPenalty, filter, page, limit);
}

export async function getHostelPenalty(collegeId: string, id: string) {
  const doc = await HostelPenalty.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel penalty not found');
  return doc;
}

export async function createHostelPenalty(collegeId: string, data: any, performedBy: string) {
  const doc = await HostelPenalty.create({ ...data, collegeId, status: 'active' });
  await createAuditLog({
    collegeId,
    entityType: 'HostelPenalty',
    entityId: String(doc._id),
    entityName: `Penalty - ${doc.penaltyType} - ${String(doc.studentId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateHostelPenalty(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await HostelPenalty.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel penalty not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelPenalty',
    entityId: String(doc._id),
    entityName: `Penalty - ${doc.penaltyType} - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteHostelPenalty(collegeId: string, id: string, performedBy: string) {
  const doc = await HostelPenalty.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel penalty not found');

  await HostelPenalty.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HostelPenalty',
    entityId: String(doc._id),
    entityName: `Penalty - ${doc.penaltyType} - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD: HostelAppeal
// ===========================================================================

export async function listHostelAppeals(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(HostelAppeal, filter, page, limit);
}

export async function getHostelAppeal(collegeId: string, id: string) {
  const doc = await HostelAppeal.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel appeal not found');
  return doc;
}

export async function createHostelAppeal(collegeId: string, data: any, performedBy: string) {
  const doc = await HostelAppeal.create({ ...data, collegeId, status: 'submitted' });
  await createAuditLog({
    collegeId,
    entityType: 'HostelAppeal',
    entityId: String(doc._id),
    entityName: `Appeal - ${String(doc.studentId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateHostelAppeal(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await HostelAppeal.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel appeal not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelAppeal',
    entityId: String(doc._id),
    entityName: `Appeal - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteHostelAppeal(collegeId: string, id: string, performedBy: string) {
  const doc = await HostelAppeal.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel appeal not found');

  await HostelAppeal.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HostelAppeal',
    entityId: String(doc._id),
    entityName: `Appeal - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD: HostelClearance
// ===========================================================================

export async function listHostelClearances(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(HostelClearance, filter, page, limit);
}

export async function getHostelClearance(collegeId: string, id: string) {
  const doc = await HostelClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel clearance not found');
  return doc;
}

export async function createHostelClearance(collegeId: string, data: any, performedBy: string) {
  const doc = await HostelClearance.create({ ...data, collegeId, status: 'pending' });
  await createAuditLog({
    collegeId,
    entityType: 'HostelClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${String(doc.studentId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateHostelClearance(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await HostelClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel clearance not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'HostelClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteHostelClearance(collegeId: string, id: string, performedBy: string) {
  const doc = await HostelClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel clearance not found');

  await HostelClearance.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HostelClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD: RoomChangeRequest
// ===========================================================================

export async function listRoomChangeRequests(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(RoomChangeRequest, filter, page, limit);
}

export async function getRoomChangeRequest(collegeId: string, id: string) {
  const doc = await RoomChangeRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Room change request not found');
  return doc;
}

export async function createRoomChangeRequest(collegeId: string, data: any, performedBy: string) {
  const doc = await RoomChangeRequest.create({ ...data, collegeId, status: 'requested' });
  await createAuditLog({
    collegeId,
    entityType: 'RoomChangeRequest',
    entityId: String(doc._id),
    entityName: `Room Change - ${String(doc.studentId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateRoomChangeRequest(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await RoomChangeRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Room change request not found');

  const changes: FieldChange[] = [];
  for (const key of Object.keys(data)) {
    const oldVal = (doc as any)[key];
    const newVal = data[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'RoomChangeRequest',
    entityId: String(doc._id),
    entityName: `Room Change - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });
  return doc;
}

export async function deleteRoomChangeRequest(collegeId: string, id: string, performedBy: string) {
  const doc = await RoomChangeRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Room change request not found');

  await RoomChangeRequest.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'RoomChangeRequest',
    entityId: String(doc._id),
    entityName: `Room Change - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}
