// labs-facilities-service — sub-domains: Labs (W08-L2-024..028), Facilities (W08-L2-029..033)
import { LabEquipment } from '../../models/campus/LabEquipment';
import { LabSlotBooking } from '../../models/campus/LabSlotBooking';
import { EquipmentIssue } from '../../models/campus/EquipmentIssue';
import { LabIncident } from '../../models/campus/LabIncident';
import { LabClearance } from '../../models/campus/LabClearance';
import { FacilityUsageLog } from '../../models/campus/FacilityUsageLog';
import { EquipmentMaintenanceLog } from '../../models/campus/EquipmentMaintenanceLog';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { Lab } from '../../models/campus/Lab';
import { Room } from '../../models/campus/Room';
import { RoomBooking } from '../../models/campus/RoomBooking';
import { SecurityIncident } from '../../models/campus/SecurityIncident';
import { VisitorEntry } from '../../models/campus/VisitorEntry';
import { Asset } from '../../models/facilities/Asset';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getOrCreateConfig(collegeId: string) {
  let config = await CampusConfig.findOne({ collegeId });
  if (!config) config = await CampusConfig.create({ collegeId });
  return config;
}

// ===========================================================================
// W08-L2-024: Lab Equipment Inventory Management
// ===========================================================================

/** Register a new piece of lab equipment */
export async function registerLabEquipment(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  const lab = await Lab.findOne({ _id: data.labId, collegeId });
  if (!lab) throw new AppError(404, 'Lab not found');

  const doc = await LabEquipment.create({
    ...data,
    collegeId,
    status: 'active',
    nextCalibration: data.nextCalibration ?? undefined,
  });

  await createAuditLog({
    collegeId,
    entityType: 'LabEquipment',
    entityId: String(doc._id),
    entityName: `${doc.name} (${doc.serialNumber})`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
    ],
    performedBy,
  });

  return doc;
}

/** Update equipment status (active, maintenance, calibration_due, condemned) */
export async function updateEquipmentStatus(
  collegeId: string,
  equipmentId: string,
  data: { status: string; reason?: string },
  performedBy: string,
) {
  const equipment = await LabEquipment.findOne({ _id: equipmentId, collegeId });
  if (!equipment) throw new AppError(404, 'Lab equipment not found');

  // If condemning, ensure no open issues
  if (data.status === 'condemned') {
    const openIssues = await EquipmentIssue.countDocuments({
      collegeId,
      equipmentId,
      status: 'issued',
    });
    if (openIssues > 0) {
      throw new AppError(400, 'Cannot condemn equipment with open issues — return all issued items first');
    }
  }

  const oldStatus = equipment.status;
  equipment.status = data.status;
  await equipment.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabEquipment',
    entityId: String(equipment._id),
    entityName: `${equipment.name} (${equipment.serialNumber})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: data.status },
      ...(data.reason
        ? [{ field: 'reason', displayName: 'Reason', oldValue: null, newValue: data.reason }]
        : []),
    ],
    performedBy,
  });

  return equipment;
}

/** Record a maintenance / calibration event for equipment */
export async function recordEquipmentMaintenance(
  collegeId: string,
  data: {
    equipmentId: string;
    serviceType: string;
    performedByName: string;
    description?: string;
    cost?: number;
    nextServiceDue?: string;
  },
  performedBy: string,
) {
  const equipment = await LabEquipment.findOne({ _id: data.equipmentId, collegeId });
  if (!equipment) throw new AppError(404, 'Lab equipment not found');

  const doc = await EquipmentMaintenanceLog.create({
    collegeId,
    equipmentId: data.equipmentId,
    serviceDate: new Date(),
    serviceType: data.serviceType,
    performedBy: data.performedByName,
    description: data.description,
    cost: data.cost ?? 0,
    nextServiceDue: data.nextServiceDue ? new Date(data.nextServiceDue) : undefined,
  });

  // Update equipment tracking fields
  equipment.lastMaintenance = new Date();
  if (data.nextServiceDue) {
    equipment.nextCalibration = new Date(data.nextServiceDue);
  }
  // If equipment was in 'maintenance' status, transition back to 'active'
  if (equipment.status === 'maintenance') {
    equipment.status = 'active';
  }
  await equipment.save();

  await createAuditLog({
    collegeId,
    entityType: 'EquipmentMaintenanceLog',
    entityId: String(doc._id),
    entityName: `Maintenance - ${equipment.name}`,
    action: 'create',
    changes: [
      { field: 'serviceType', displayName: 'Service Type', oldValue: null, newValue: data.serviceType },
    ],
    performedBy,
  });

  return doc;
}

/** Get all equipment due for calibration within next 30 days */
export async function getEquipmentDueForCalibration(collegeId: string) {
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  const items = await LabEquipment.find({
    collegeId,
    nextCalibration: { $lte: thirtyDaysOut },
    status: { $in: ['active', 'calibration_due'] },
  })
    .populate('labId')
    .lean();

  return items;
}

// ===========================================================================
// W08-L2-025: Lab Slot Booking
// ===========================================================================

/** Request a lab slot booking — auto-approve if config says so */
export async function requestLabSlotBooking(
  collegeId: string,
  data: {
    labId: string;
    date: string;
    startTime: string;
    endTime: string;
    purpose: string;
    attendeeCount?: number;
  },
  performedBy: string,
) {
  const lab = await Lab.findOne({ _id: data.labId, collegeId });
  if (!lab) throw new AppError(404, 'Lab not found');

  // Check for time conflicts
  const bookingDate = new Date(data.date);
  const conflicts = await LabSlotBooking.find({
    collegeId,
    labId: data.labId,
    date: bookingDate,
    status: { $nin: ['cancelled'] },
    approvalStatus: { $ne: 'rejected' },
    $or: [
      { startTime: { $lt: data.endTime }, endTime: { $gt: data.startTime } },
    ],
  });
  if (conflicts.length > 0) {
    throw new AppError(409, 'Time slot conflicts with an existing booking');
  }

  // TODO: check M03 academic timetable for conflicts

  const config = await getOrCreateConfig(collegeId);
  const tier = config.labs?.bookingApprovalTier ?? 'technician';

  const approvalStatus = tier === 'auto' ? 'approved' : 'pending';

  const doc = await LabSlotBooking.create({
    collegeId,
    labId: data.labId,
    requesterId: performedBy,
    date: bookingDate,
    startTime: data.startTime,
    endTime: data.endTime,
    purpose: data.purpose,
    attendeeCount: data.attendeeCount,
    approvalStatus,
    status: 'confirmed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(doc._id),
    entityName: `Lab Booking - ${lab.name}`,
    action: 'create',
    changes: [
      { field: 'approvalStatus', displayName: 'Approval', oldValue: null, newValue: approvalStatus },
    ],
    performedBy,
  });

  return doc;
}

/** Approve a pending lab slot booking */
export async function approveLabSlotBooking(
  collegeId: string,
  bookingId: string,
  performedBy: string,
) {
  const booking = await LabSlotBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Lab slot booking not found');
  if (booking.approvalStatus !== 'pending') {
    throw new AppError(400, 'Only pending bookings can be approved');
  }

  const oldStatus = booking.approvalStatus;
  booking.approvalStatus = 'approved';
  booking.approvedBy = performedBy as any;
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(booking._id),
    entityName: `Lab Booking - ${String(booking.labId)}`,
    action: 'update',
    changes: [
      { field: 'approvalStatus', displayName: 'Approval', oldValue: oldStatus, newValue: 'approved' },
    ],
    performedBy,
  });

  return booking;
}

/** Reject a pending lab slot booking */
export async function rejectLabSlotBooking(
  collegeId: string,
  bookingId: string,
  data: { reason: string },
  performedBy: string,
) {
  const booking = await LabSlotBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Lab slot booking not found');
  if (booking.approvalStatus !== 'pending') {
    throw new AppError(400, 'Only pending bookings can be rejected');
  }

  const oldStatus = booking.approvalStatus;
  booking.approvalStatus = 'rejected';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(booking._id),
    entityName: `Lab Booking - ${String(booking.labId)}`,
    action: 'update',
    changes: [
      { field: 'approvalStatus', displayName: 'Approval', oldValue: oldStatus, newValue: 'rejected' },
      { field: 'rejectionReason', displayName: 'Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return booking;
}

/** Mark a lab slot booking as completed */
export async function completeLabSlotBooking(
  collegeId: string,
  bookingId: string,
  performedBy: string,
) {
  const booking = await LabSlotBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Lab slot booking not found');
  if (booking.status !== 'confirmed') {
    throw new AppError(400, 'Only confirmed bookings can be completed');
  }

  const oldStatus = booking.status;
  booking.status = 'completed';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(booking._id),
    entityName: `Lab Booking - ${String(booking.labId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'completed' },
    ],
    performedBy,
  });

  return booking;
}

/** Cancel a lab slot booking */
export async function cancelLabSlotBooking(
  collegeId: string,
  bookingId: string,
  performedBy: string,
) {
  const booking = await LabSlotBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Lab slot booking not found');
  if (booking.status === 'cancelled' || booking.status === 'completed') {
    throw new AppError(400, 'Booking is already cancelled or completed');
  }

  const oldStatus = booking.status;
  booking.status = 'cancelled';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(booking._id),
    entityName: `Lab Booking - ${String(booking.labId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
    ],
    performedBy,
  });

  return booking;
}

// ===========================================================================
// W08-L2-026: Equipment Issue / Return
// ===========================================================================

/** Issue equipment to a student */
export async function issueEquipment(
  collegeId: string,
  data: {
    equipmentId: string;
    issuedTo: string;
    dueDate: string;
    conditionOnIssue?: string;
  },
  performedBy: string,
) {
  const equipment = await LabEquipment.findOne({ _id: data.equipmentId, collegeId });
  if (!equipment) throw new AppError(404, 'Lab equipment not found');
  if (equipment.status !== 'active') {
    throw new AppError(400, `Equipment is currently "${equipment.status}" and cannot be issued`);
  }

  // No open issues for this equipment
  const openIssue = await EquipmentIssue.findOne({
    collegeId,
    equipmentId: data.equipmentId,
    status: 'issued',
  });
  if (openIssue) {
    throw new AppError(400, 'Equipment is already issued to someone — return it first');
  }

  const doc = await EquipmentIssue.create({
    collegeId,
    equipmentId: data.equipmentId,
    issuedTo: data.issuedTo,
    issuedBy: performedBy,
    issueDate: new Date(),
    dueDate: new Date(data.dueDate),
    conditionOnIssue: data.conditionOnIssue ?? 'good',
    status: 'issued',
  });

  await createAuditLog({
    collegeId,
    entityType: 'EquipmentIssue',
    entityId: String(doc._id),
    entityName: `Issue - ${equipment.name}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'issued' },
    ],
    performedBy,
  });

  return doc;
}

/** Return previously issued equipment */
export async function returnEquipment(
  collegeId: string,
  issueId: string,
  data: { conditionOnReturn: string },
  performedBy: string,
) {
  const issue = await EquipmentIssue.findOne({ _id: issueId, collegeId });
  if (!issue) throw new AppError(404, 'Equipment issue record not found');
  if (issue.status !== 'issued') {
    throw new AppError(400, 'Only issued equipment can be returned');
  }

  const oldStatus = issue.status;
  issue.returnDate = new Date();
  issue.conditionOnReturn = data.conditionOnReturn;
  issue.status = 'returned';
  await issue.save();

  // If condition is 'damaged': flag for lab incident flow
  if (data.conditionOnReturn === 'damaged') {
    const equipment = await LabEquipment.findOne({ _id: issue.equipmentId, collegeId });
    if (equipment) {
      equipment.condition = 'poor';
      await equipment.save();
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'EquipmentIssue',
    entityId: String(issue._id),
    entityName: `Return - ${String(issue.equipmentId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'returned' },
      { field: 'conditionOnReturn', displayName: 'Condition on Return', oldValue: null, newValue: data.conditionOnReturn },
    ],
    performedBy,
  });

  return issue;
}

/** Get all overdue equipment issues */
export async function getOverdueEquipment(collegeId: string) {
  const now = new Date();
  const items = await EquipmentIssue.find({
    collegeId,
    status: 'issued',
    dueDate: { $lt: now },
  })
    .populate('equipmentId')
    .populate('issuedTo')
    .lean();

  return items;
}

// ===========================================================================
// W08-L2-027: Lab Incident
// ===========================================================================

/** Report a lab incident */
export async function reportLabIncident(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  const lab = await Lab.findOne({ _id: data.labId, collegeId });
  if (!lab) throw new AppError(404, 'Lab not found');

  const doc = await LabIncident.create({
    ...data,
    collegeId,
    status: 'reported',
    welfareSignalSent: false,
  });

  // If injury with high/critical severity, signal welfare
  const severity = data.severity as string;
  if (
    data.injuryDetails &&
    (severity === 'high' || severity === 'critical')
  ) {
    doc.welfareSignalSent = true;
    await doc.save();
    // TODO: emit welfare signal {source: 'M08.5', signalType: 'lab_incident_injury'} to M06
  }

  // If equipment damaged, update their statuses
  if (data.equipmentDamaged && Array.isArray(data.equipmentDamaged)) {
    for (const eqId of data.equipmentDamaged) {
      await LabEquipment.findOneAndUpdate(
        { _id: eqId, collegeId },
        { status: 'maintenance', condition: 'poor' },
      );
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'LabIncident',
    entityId: String(doc._id),
    entityName: `Lab Incident - ${lab.name}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'reported' },
      { field: 'severity', displayName: 'Severity', oldValue: null, newValue: severity },
    ],
    performedBy,
  });

  return doc;
}

/** Move a lab incident to investigating state */
export async function investigateLabIncident(
  collegeId: string,
  incidentId: string,
  performedBy: string,
) {
  const incident = await LabIncident.findOne({ _id: incidentId, collegeId });
  if (!incident) throw new AppError(404, 'Lab incident not found');
  if (incident.status !== 'reported') {
    throw new AppError(400, 'Only reported incidents can be moved to investigating');
  }

  const oldStatus = incident.status;
  incident.status = 'investigating';
  await incident.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabIncident',
    entityId: String(incident._id),
    entityName: `Lab Incident - ${String(incident.labId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'investigating' },
    ],
    performedBy,
  });

  return incident;
}

/** Resolve a lab incident with a resolution note */
export async function resolveLabIncident(
  collegeId: string,
  incidentId: string,
  data: { resolution: string },
  performedBy: string,
) {
  const incident = await LabIncident.findOne({ _id: incidentId, collegeId });
  if (!incident) throw new AppError(404, 'Lab incident not found');
  if (incident.status !== 'investigating' && incident.status !== 'reported') {
    throw new AppError(400, 'Incident must be in reported or investigating state to resolve');
  }

  const oldStatus = incident.status;
  incident.resolution = data.resolution;
  incident.status = 'resolved';
  await incident.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabIncident',
    entityId: String(incident._id),
    entityName: `Lab Incident - ${String(incident.labId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'resolved' },
      { field: 'resolution', displayName: 'Resolution', oldValue: null, newValue: data.resolution },
    ],
    performedBy,
  });

  return incident;
}

/** Close a resolved lab incident */
export async function closeLabIncident(
  collegeId: string,
  incidentId: string,
  performedBy: string,
) {
  const incident = await LabIncident.findOne({ _id: incidentId, collegeId });
  if (!incident) throw new AppError(404, 'Lab incident not found');
  if (incident.status !== 'resolved') {
    throw new AppError(400, 'Only resolved incidents can be closed');
  }

  const oldStatus = incident.status;
  incident.status = 'closed';
  await incident.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabIncident',
    entityId: String(incident._id),
    entityName: `Lab Incident - ${String(incident.labId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
    ],
    performedBy,
  });

  return incident;
}

// ===========================================================================
// W08-L2-028: Lab Clearance
// ===========================================================================

/** Initiate lab clearance for a student — checks outstanding equipment & fees */
export async function initiateLabClearance(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  // Check outstanding equipment issues
  const openIssues = await EquipmentIssue.find({
    collegeId,
    issuedTo: studentId,
    status: 'issued',
  }).populate('equipmentId');

  const outstandingEquipment = openIssues.map((issue) => ({
    equipmentId: issue.equipmentId,
    equipmentName: (issue.equipmentId as any)?.name ?? 'Unknown',
    issuedDate: issue.issueDate,
  }));

  const blockingItems: { item: string; reason: string }[] = [];

  if (outstandingEquipment.length > 0) {
    blockingItems.push({
      item: 'equipment',
      reason: `${outstandingEquipment.length} equipment item(s) not returned`,
    });
  }

  // TODO: check M04 for lab fees
  const feesCleared = true; // stub — assume cleared until M04 integration
  if (!feesCleared) {
    blockingItems.push({ item: 'fees', reason: 'Outstanding lab fees' });
  }

  const status = blockingItems.length === 0 ? 'cleared' : 'blocked';

  const doc = await LabClearance.create({
    collegeId,
    studentId,
    outstandingEquipment,
    feesCleared,
    status,
    blockingItems,
    ...(status === 'cleared'
      ? { clearedAt: new Date(), clearedBy: performedBy }
      : {}),
  });

  await createAuditLog({
    collegeId,
    entityType: 'LabClearance',
    entityId: String(doc._id),
    entityName: `Lab Clearance - ${studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: status },
    ],
    performedBy,
  });

  return doc;
}

/** Get lab clearance status for a student */
export async function getLabClearanceStatus(collegeId: string, studentId: string) {
  const clearance = await LabClearance.findOne({ collegeId, studentId })
    .sort({ createdAt: -1 })
    .lean();
  return clearance;
}

// ===========================================================================
// W08-L2-029: Facility Booking
// ===========================================================================

/** Request a facility (room) booking — approval tier varies by room type */
export async function requestFacilityBooking(
  collegeId: string,
  data: {
    roomId: string;
    date: string;
    startTime: string;
    endTime: string;
    purpose: string;
    requesterModule?: string;
    attendeeCount?: number;
  },
  performedBy: string,
) {
  const room = await Room.findOne({ _id: data.roomId, collegeId });
  if (!room) throw new AppError(404, 'Room not found');

  const bookingDate = new Date(data.date);

  // Check time conflicts
  const conflicts = await RoomBooking.find({
    collegeId,
    roomId: data.roomId,
    date: bookingDate,
    status: { $nin: ['cancelled', 'rejected', 'no_show'] },
    $or: [
      { startTime: { $lt: data.endTime }, endTime: { $gt: data.startTime } },
    ],
  });

  const config = await getOrCreateConfig(collegeId);
  const conflictResolution = config.facilities?.conflictResolution ?? 'fcfs';

  if (conflicts.length > 0) {
    if (conflictResolution === 'fcfs') {
      throw new AppError(409, 'Time slot conflicts with an existing booking');
    }
    // priority: check requesterModule priority — for now stub as rejection
    throw new AppError(409, 'Time slot conflicts with an existing booking (priority resolution pending)');
  }

  // Determine approval tier based on room type
  const tiers = config.facilities?.bookingApprovalTiers;
  const roomType = room.type as 'classroom' | 'seminar_hall' | 'auditorium' | 'conference';
  const tier = tiers?.[roomType] ?? 'self_book';

  let status: string;
  if (tier === 'self_book') {
    status = 'confirmed';
  } else {
    status = 'pending_approval';
  }

  const doc = await RoomBooking.create({
    collegeId,
    roomId: data.roomId,
    bookedBy: performedBy,
    date: bookingDate,
    startTime: data.startTime,
    endTime: data.endTime,
    purpose: data.purpose,
    requesterModule: data.requesterModule,
    attendeeCount: data.attendeeCount,
    status,
    facilityUsageLogged: false,
    noShow: false,
  });

  await createAuditLog({
    collegeId,
    entityType: 'RoomBooking',
    entityId: String(doc._id),
    entityName: `Facility Booking - ${room.roomNumber}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: status },
    ],
    performedBy,
  });

  return doc;
}

/** Approve a pending facility booking */
export async function approveFacilityBooking(
  collegeId: string,
  bookingId: string,
  performedBy: string,
) {
  const booking = await RoomBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Room booking not found');
  if (booking.status !== 'pending_approval') {
    throw new AppError(400, 'Only pending-approval bookings can be approved');
  }

  const oldStatus = booking.status;
  booking.status = 'approved';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'RoomBooking',
    entityId: String(booking._id),
    entityName: `Facility Booking - ${String(booking.roomId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' },
    ],
    performedBy,
  });

  return booking;
}

/** Reject a pending facility booking */
export async function rejectFacilityBooking(
  collegeId: string,
  bookingId: string,
  data: { reason: string },
  performedBy: string,
) {
  const booking = await RoomBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Room booking not found');
  if (booking.status !== 'pending_approval') {
    throw new AppError(400, 'Only pending-approval bookings can be rejected');
  }

  const oldStatus = booking.status;
  booking.status = 'rejected';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'RoomBooking',
    entityId: String(booking._id),
    entityName: `Facility Booking - ${String(booking.roomId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' },
      { field: 'rejectionReason', displayName: 'Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return booking;
}

/** Cancel a facility booking */
export async function cancelFacilityBooking(
  collegeId: string,
  bookingId: string,
  performedBy: string,
) {
  const booking = await RoomBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Room booking not found');
  if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
    throw new AppError(400, 'Booking cannot be cancelled in its current state');
  }

  const oldStatus = booking.status;
  booking.status = 'cancelled';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'RoomBooking',
    entityId: String(booking._id),
    entityName: `Facility Booking - ${String(booking.roomId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
    ],
    performedBy,
  });

  return booking;
}

/** Record actual usage for a facility booking */
export async function recordFacilityUsage(
  collegeId: string,
  data: {
    bookingId: string;
    actualStartTime: string;
    actualEndTime: string;
    attendeeCount: number;
    usageNotes?: string;
  },
  performedBy: string,
) {
  const booking = await RoomBooking.findOne({ _id: data.bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Room booking not found');

  const doc = await FacilityUsageLog.create({
    collegeId,
    bookingId: data.bookingId,
    roomId: booking.roomId,
    actualStartTime: new Date(data.actualStartTime),
    actualEndTime: new Date(data.actualEndTime),
    attendeeCount: data.attendeeCount,
    usageNotes: data.usageNotes,
    noShow: false,
    loggedBy: performedBy,
  });

  // Update booking
  booking.facilityUsageLogged = true;
  booking.status = 'completed';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'FacilityUsageLog',
    entityId: String(doc._id),
    entityName: `Usage - Booking ${String(booking._id)}`,
    action: 'create',
    changes: [
      { field: 'attendeeCount', displayName: 'Attendee Count', oldValue: null, newValue: data.attendeeCount },
    ],
    performedBy,
  });

  return doc;
}

/** Record a no-show for a facility booking */
export async function recordNoShow(
  collegeId: string,
  bookingId: string,
  performedBy: string,
) {
  const booking = await RoomBooking.findOne({ _id: bookingId, collegeId });
  if (!booking) throw new AppError(404, 'Room booking not found');

  const doc = await FacilityUsageLog.create({
    collegeId,
    bookingId,
    roomId: booking.roomId,
    noShow: true,
    loggedBy: performedBy,
  });

  booking.noShow = true;
  booking.status = 'no_show';
  await booking.save();

  await createAuditLog({
    collegeId,
    entityType: 'FacilityUsageLog',
    entityId: String(doc._id),
    entityName: `No-Show - Booking ${String(booking._id)}`,
    action: 'create',
    changes: [
      { field: 'noShow', displayName: 'No Show', oldValue: null, newValue: true },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W08-L2-030: Sports Equipment (via Asset model)
// ===========================================================================

/** Get availability of sports equipment (aggregated from Asset) */
export async function getSportsEquipmentAvailability(collegeId: string) {
  const results = await Asset.aggregate([
    { $match: { collegeId: { $toObjectId: collegeId }, category: 'sports' } },
    {
      $group: {
        _id: '$name',
        total: { $sum: 1 },
        available: {
          $sum: { $cond: [{ $eq: ['$status', 'in_stock'] }, 1, 0] },
        },
        inUse: {
          $sum: { $cond: [{ $eq: ['$status', 'in_use'] }, 1, 0] },
        },
        maintenance: {
          $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return results;
}

// ===========================================================================
// W08-L2-031: Campus Security Incident
// ===========================================================================

/** Report a campus security incident */
export async function reportCampusIncident(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  const doc = await SecurityIncident.create({
    ...data,
    collegeId,
    status: 'reported',
    welfareSignalSent: false,
  });

  const severity = data.severity as string;
  if (severity === 'high' || severity === 'critical') {
    doc.welfareSignalSent = true;
    await doc.save();
    // TODO: emit welfare signal {source: 'M08.5', signalType: 'campus_security_incident'} to M06
  }

  await createAuditLog({
    collegeId,
    entityType: 'SecurityIncident',
    entityId: String(doc._id),
    entityName: `Security Incident - ${doc.location}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'reported' },
      { field: 'severity', displayName: 'Severity', oldValue: null, newValue: severity },
    ],
    performedBy,
  });

  return doc;
}

/** Move a campus incident to investigating state */
export async function investigateCampusIncident(
  collegeId: string,
  incidentId: string,
  performedBy: string,
) {
  const incident = await SecurityIncident.findOne({ _id: incidentId, collegeId });
  if (!incident) throw new AppError(404, 'Security incident not found');
  if (incident.status !== 'reported') {
    throw new AppError(400, 'Only reported incidents can be moved to investigating');
  }

  const oldStatus = incident.status;
  incident.status = 'investigating';
  await incident.save();

  await createAuditLog({
    collegeId,
    entityType: 'SecurityIncident',
    entityId: String(incident._id),
    entityName: `Security Incident - ${incident.location}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'investigating' },
    ],
    performedBy,
  });

  return incident;
}

/** Resolve a campus security incident */
export async function resolveCampusIncident(
  collegeId: string,
  incidentId: string,
  data: { resolution: string },
  performedBy: string,
) {
  const incident = await SecurityIncident.findOne({ _id: incidentId, collegeId });
  if (!incident) throw new AppError(404, 'Security incident not found');
  if (incident.status !== 'investigating' && incident.status !== 'reported') {
    throw new AppError(400, 'Incident must be in reported or investigating state to resolve');
  }

  const oldStatus = incident.status;
  incident.actionTaken = data.resolution;
  incident.status = 'resolved';
  await incident.save();

  await createAuditLog({
    collegeId,
    entityType: 'SecurityIncident',
    entityId: String(incident._id),
    entityName: `Security Incident - ${incident.location}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'resolved' },
      { field: 'actionTaken', displayName: 'Resolution', oldValue: null, newValue: data.resolution },
    ],
    performedBy,
  });

  return incident;
}

// ===========================================================================
// W08-L2-032: Facility Utilization Tracking
// ===========================================================================

/** Get aggregate facility utilization metrics over a date range */
export async function getFacilityUtilization(
  collegeId: string,
  data: { startDate: string; endDate: string; roomId?: string },
) {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  const bookingMatch: Record<string, unknown> = {
    collegeId: { $toObjectId: collegeId },
    date: { $gte: start, $lte: end },
  };
  if (data.roomId) {
    bookingMatch['roomId'] = { $toObjectId: data.roomId };
  }

  const bookings = await RoomBooking.aggregate([
    { $match: bookingMatch },
    {
      $group: {
        _id: '$roomId',
        totalBookings: { $sum: 1 },
        completedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        noShows: {
          $sum: { $cond: [{ $eq: ['$noShow', true] }, 1, 0] },
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
      },
    },
  ]);

  // Calculate utilization and no-show rates
  const metrics = bookings.map((b) => {
    const effectiveBookings = b.totalBookings - b.cancelledBookings;
    return {
      roomId: b._id,
      totalBookings: b.totalBookings,
      completedBookings: b.completedBookings,
      noShows: b.noShows,
      cancelledBookings: b.cancelledBookings,
      utilizationRate: effectiveBookings > 0
        ? Math.round((b.completedBookings / effectiveBookings) * 100)
        : 0,
      noShowRate: effectiveBookings > 0
        ? Math.round((b.noShows / effectiveBookings) * 100)
        : 0,
    };
  });

  // Peak hours analysis from usage logs
  const usageMatch: Record<string, unknown> = {
    collegeId: { $toObjectId: collegeId },
    createdAt: { $gte: start, $lte: end },
    noShow: false,
  };
  if (data.roomId) {
    usageMatch['roomId'] = { $toObjectId: data.roomId };
  }

  const peakHours = await FacilityUsageLog.aggregate([
    { $match: usageMatch },
    {
      $group: {
        _id: { $hour: '$actualStartTime' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  return { metrics, peakHours };
}

/** Get utilization metrics for a specific room */
export async function getFacilityUtilizationByRoom(
  collegeId: string,
  roomId: string,
  data: { startDate: string; endDate: string },
) {
  return getFacilityUtilization(collegeId, {
    startDate: data.startDate,
    endDate: data.endDate,
    roomId,
  });
}

// ===========================================================================
// W08-L2-033: Visitor Entry — enhanced checkout
// ===========================================================================

/** Record visitor checkout (set outTime) */
export async function recordVisitorCheckout(
  collegeId: string,
  visitorId: string,
  _performedBy: string,
) {
  const visitor = await VisitorEntry.findOne({ _id: visitorId, collegeId });
  if (!visitor) throw new AppError(404, 'Visitor entry not found');
  if (visitor.outTime) throw new AppError(400, 'Visitor has already checked out');

  visitor.outTime = new Date();
  await visitor.save();

  return visitor;
}

// ===========================================================================
// CRUD: LabEquipment
// ===========================================================================

export async function listLabEquipment(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { labId?: string; status?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.labId) query['labId'] = filter.labId;
  if (filter?.status) query['status'] = filter.status;
  return paginate(LabEquipment, query, page, limit);
}

export async function getLabEquipment(collegeId: string, id: string) {
  const doc = await LabEquipment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab equipment not found');
  return doc;
}

export async function createLabEquipment(collegeId: string, data: any, performedBy: string) {
  return registerLabEquipment(collegeId, data, performedBy);
}

export async function updateLabEquipment(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await LabEquipment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab equipment not found');

  const changes = Object.keys(data).map((key) => ({
    field: key,
    displayName: key,
    oldValue: (doc as any)[key],
    newValue: data[key],
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabEquipment',
    entityId: String(doc._id),
    entityName: `${doc.name} (${doc.serialNumber})`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteLabEquipment(collegeId: string, id: string, performedBy: string) {
  const doc = await LabEquipment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab equipment not found');

  // Prevent deleting equipment with open issues
  const openIssues = await EquipmentIssue.countDocuments({
    collegeId,
    equipmentId: id,
    status: 'issued',
  });
  if (openIssues > 0) {
    throw new AppError(400, 'Cannot delete equipment with open issues');
  }

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'LabEquipment',
    entityId: String(doc._id),
    entityName: `${doc.name} (${doc.serialNumber})`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// CRUD: LabSlotBooking
// ===========================================================================

export async function listLabSlotBookings(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { labId?: string; status?: string; date?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.labId) query['labId'] = filter.labId;
  if (filter?.status) query['status'] = filter.status;
  if (filter?.date) query['date'] = new Date(filter.date);
  return paginate(LabSlotBooking, query, page, limit);
}

export async function getLabSlotBooking(collegeId: string, id: string) {
  const doc = await LabSlotBooking.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab slot booking not found');
  return doc;
}

export async function createLabSlotBookingCrud(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  return requestLabSlotBooking(collegeId, data, performedBy);
}

export async function updateLabSlotBooking(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await LabSlotBooking.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab slot booking not found');

  const changes = Object.keys(data).map((key) => ({
    field: key,
    displayName: key,
    oldValue: (doc as any)[key],
    newValue: data[key],
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(doc._id),
    entityName: `Lab Booking - ${String(doc.labId)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteLabSlotBooking(collegeId: string, id: string, performedBy: string) {
  const doc = await LabSlotBooking.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab slot booking not found');

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'LabSlotBooking',
    entityId: String(doc._id),
    entityName: `Lab Booking - ${String(doc.labId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// CRUD: EquipmentIssue
// ===========================================================================

export async function listEquipmentIssues(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { equipmentId?: string; status?: string; issuedTo?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.equipmentId) query['equipmentId'] = filter.equipmentId;
  if (filter?.status) query['status'] = filter.status;
  if (filter?.issuedTo) query['issuedTo'] = filter.issuedTo;
  return paginate(EquipmentIssue, query, page, limit);
}

export async function getEquipmentIssue(collegeId: string, id: string) {
  const doc = await EquipmentIssue.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Equipment issue not found');
  return doc;
}

export async function createEquipmentIssueCrud(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  return issueEquipment(collegeId, data, performedBy);
}

export async function updateEquipmentIssue(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await EquipmentIssue.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Equipment issue not found');

  const changes = Object.keys(data).map((key) => ({
    field: key,
    displayName: key,
    oldValue: (doc as any)[key],
    newValue: data[key],
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'EquipmentIssue',
    entityId: String(doc._id),
    entityName: `Issue - ${String(doc.equipmentId)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteEquipmentIssue(collegeId: string, id: string, performedBy: string) {
  const doc = await EquipmentIssue.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Equipment issue not found');

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'EquipmentIssue',
    entityId: String(doc._id),
    entityName: `Issue - ${String(doc.equipmentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// CRUD: LabIncident
// ===========================================================================

export async function listLabIncidents(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { labId?: string; status?: string; severity?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.labId) query['labId'] = filter.labId;
  if (filter?.status) query['status'] = filter.status;
  if (filter?.severity) query['severity'] = filter.severity;
  return paginate(LabIncident, query, page, limit);
}

export async function getLabIncident(collegeId: string, id: string) {
  const doc = await LabIncident.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab incident not found');
  return doc;
}

export async function createLabIncidentCrud(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  return reportLabIncident(collegeId, data, performedBy);
}

export async function updateLabIncident(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await LabIncident.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab incident not found');

  const changes = Object.keys(data).map((key) => ({
    field: key,
    displayName: key,
    oldValue: (doc as any)[key],
    newValue: data[key],
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabIncident',
    entityId: String(doc._id),
    entityName: `Lab Incident - ${String(doc.labId)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteLabIncident(collegeId: string, id: string, performedBy: string) {
  const doc = await LabIncident.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab incident not found');

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'LabIncident',
    entityId: String(doc._id),
    entityName: `Lab Incident - ${String(doc.labId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// CRUD: LabClearance
// ===========================================================================

export async function listLabClearances(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { studentId?: string; status?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.studentId) query['studentId'] = filter.studentId;
  if (filter?.status) query['status'] = filter.status;
  return paginate(LabClearance, query, page, limit);
}

export async function getLabClearance(collegeId: string, id: string) {
  const doc = await LabClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab clearance not found');
  return doc;
}

export async function createLabClearanceCrud(
  collegeId: string,
  data: { studentId: string },
  performedBy: string,
) {
  return initiateLabClearance(collegeId, data.studentId, performedBy);
}

export async function updateLabClearance(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await LabClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab clearance not found');

  const changes = Object.keys(data).map((key) => ({
    field: key,
    displayName: key,
    oldValue: (doc as any)[key],
    newValue: data[key],
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'LabClearance',
    entityId: String(doc._id),
    entityName: `Lab Clearance - ${String(doc.studentId)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteLabClearance(collegeId: string, id: string, performedBy: string) {
  const doc = await LabClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab clearance not found');

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'LabClearance',
    entityId: String(doc._id),
    entityName: `Lab Clearance - ${String(doc.studentId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// CRUD: FacilityUsageLog (list / get only — immutable)
// ===========================================================================

export async function listFacilityUsageLogs(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { roomId?: string; bookingId?: string; noShow?: boolean },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.roomId) query['roomId'] = filter.roomId;
  if (filter?.bookingId) query['bookingId'] = filter.bookingId;
  if (filter?.noShow !== undefined) query['noShow'] = filter.noShow;
  return paginate(FacilityUsageLog, query, page, limit);
}

export async function getFacilityUsageLog(collegeId: string, id: string) {
  const doc = await FacilityUsageLog.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Facility usage log not found');
  return doc;
}

// ===========================================================================
// CRUD: EquipmentMaintenanceLog (list / get only — immutable)
// ===========================================================================

export async function listEquipmentMaintenanceLogs(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { equipmentId?: string; serviceType?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.equipmentId) query['equipmentId'] = filter.equipmentId;
  if (filter?.serviceType) query['serviceType'] = filter.serviceType;
  return paginate(EquipmentMaintenanceLog, query, page, limit);
}

export async function getEquipmentMaintenanceLog(collegeId: string, id: string) {
  const doc = await EquipmentMaintenanceLog.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Equipment maintenance log not found');
  return doc;
}
