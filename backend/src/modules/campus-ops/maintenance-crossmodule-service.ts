// maintenance-crossmodule-service — Maintenance (W08-L2-034..038) + Cross-Module (039..042) + CRUD
import { MaintenanceRequest } from '../../models/facilities/MaintenanceRequest';
import { MaintenanceSchedule } from '../../models/facilities/MaintenanceSchedule';
import { MaintenanceAssignment } from '../../models/facilities/MaintenanceAssignment';
import { MaintenanceWorkLog } from '../../models/facilities/MaintenanceWorkLog';
import { MaintenanceEscalation } from '../../models/facilities/MaintenanceEscalation';
import { AMCContract } from '../../models/facilities/AMCContract';
import { VendorPerformance } from '../../models/facilities/VendorPerformance';
import { Vendor } from '../../models/facilities/Vendor';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { LabEquipment } from '../../models/campus/LabEquipment';
import { EquipmentMaintenanceLog } from '../../models/campus/EquipmentMaintenanceLog';
import { HostelClearance } from '../../models/campus/HostelClearance';
import { TransportClearance } from '../../models/campus/TransportClearance';
import { LabClearance } from '../../models/campus/LabClearance';
import { LibraryClearance } from '../../models/library/LibraryClearance';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { LibraryMember } from '../../models/library/LibraryMember';
import { BookIssue } from '../../models/library/BookIssue';
import { LibraryFine } from '../../models/library/LibraryFine';
import { EquipmentIssue } from '../../models/campus/EquipmentIssue';
import { Book } from '../../models/library/Book';
import { FacilityUsageLog } from '../../models/campus/FacilityUsageLog';
import { RoomBooking } from '../../models/campus/RoomBooking';
import { HostelBlock } from '../../models/welfare/HostelBlock';
import { LibraryGateEntry } from '../../models/library/LibraryGateEntry';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getOrCreateConfig(collegeId: string) {
  let config = await CampusConfig.findOne({ collegeId });
  if (!config) config = await CampusConfig.create({ collegeId });
  return config;
}

type FC = { field: string; displayName: string; oldValue: unknown; newValue: unknown };

function applyUpdates(doc: any, data: Record<string, unknown>, fieldMap: Record<string, string>): FC[] {
  const changes: FC[] = [];
  for (const [f, dn] of Object.entries(fieldMap)) {
    if (data[f] !== undefined) {
      changes.push({ field: f, displayName: dn, oldValue: doc[f], newValue: data[f] });
      doc[f] = (f.endsWith('Date') || f === 'slaDeadline') ? new Date(data[f] as string) : data[f];
    }
  }
  return changes;
}

async function audit(
  collegeId: string, entityType: string, entityId: string,
  entityName: string, action: 'create' | 'update' | 'delete', changes: FC[], performedBy: string,
) {
  await createAuditLog({ collegeId, entityType, entityId, entityName, action, changes, performedBy });
}

const MS_PER_HOUR = 3_600_000;

// ===========================================================================
// W08-L2-034: Submit and Triage Maintenance Request
// ===========================================================================

export async function submitMaintenanceRequest(
  collegeId: string,
  data: { facilityType: string; facilityId?: string; equipmentId?: string; description: string; category: string; location: string; priority?: string; requestedBy: string },
  performedBy: string,
) {
  const isCritical = data.priority === 'critical' || data.priority === 'emergency';
  const doc = await MaintenanceRequest.create({
    collegeId, requestedBy: data.requestedBy, facilityType: data.facilityType,
    facilityId: data.facilityId, equipmentId: data.equipmentId,
    description: data.description, category: data.category, location: data.location,
    priority: data.priority ?? 'medium', maintenanceType: 'corrective',
    status: isCritical ? 'triaged' : 'submitted',
  });
  await audit(collegeId, 'MaintenanceRequest', String(doc._id), `MR-${data.category}-${data.location}`, 'create', [
    { field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status },
    { field: 'maintenanceType', displayName: 'Type', oldValue: null, newValue: 'corrective' },
  ], performedBy);
  return doc;
}

export async function triageMaintenanceRequest(
  collegeId: string, requestId: string,
  data: { priority: string; assignmentRouting: string; slaDeadlineHours: number },
  performedBy: string,
) {
  const req = await MaintenanceRequest.findOne({ _id: requestId, collegeId });
  if (!req) throw new AppError(404, 'Maintenance request not found');
  const oldStatus = req.status;
  const oldPriority = req.priority;
  const config = await getOrCreateConfig(collegeId);
  const routing = data.assignmentRouting || config.maintenance?.defaultAssignmentRouting || 'in_house';
  req.status = 'triaged';
  req.priority = data.priority;
  req.slaDeadline = new Date(Date.now() + data.slaDeadlineHours * MS_PER_HOUR);
  await req.save();
  await audit(collegeId, 'MaintenanceRequest', String(req._id), `MR-${req.category}-${req.location}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'triaged' },
    { field: 'priority', displayName: 'Priority', oldValue: oldPriority, newValue: data.priority },
  ], performedBy);
  return { request: req, routing };
}

// ===========================================================================
// W08-L2-035: Assign and Execute Maintenance
// ===========================================================================

export async function createMaintenanceAssignment(
  collegeId: string,
  data: { requestId: string; assignedToType: string; assignedToId: string; assignedToName: string; slaDeadline?: string },
  performedBy: string,
) {
  const req = await MaintenanceRequest.findOne({ _id: data.requestId, collegeId });
  if (!req) throw new AppError(404, 'Maintenance request not found');
  const slaDeadline = data.slaDeadline ? new Date(data.slaDeadline) : req.slaDeadline ?? new Date();
  const oldStatus = req.status;
  req.status = 'assigned';
  await req.save();
  const assignment = await MaintenanceAssignment.create({
    collegeId, requestId: data.requestId, assignedToType: data.assignedToType,
    assignedToId: data.assignedToId, assignedToName: data.assignedToName, slaDeadline, status: 'assigned',
  });
  await audit(collegeId, 'MaintenanceAssignment', String(assignment._id), `Assignment for MR ${data.requestId}`, 'create', [
    { field: 'status', displayName: 'Status', oldValue: null, newValue: 'assigned' },
    { field: 'requestStatus', displayName: 'Request Status', oldValue: oldStatus, newValue: 'assigned' },
  ], performedBy);
  return assignment;
}

export async function startMaintenanceWork(collegeId: string, assignmentId: string, performedBy: string) {
  const asgn = await MaintenanceAssignment.findOne({ _id: assignmentId, collegeId });
  if (!asgn) throw new AppError(404, 'Maintenance assignment not found');
  const oldStatus = asgn.status;
  asgn.status = 'in_progress';
  asgn.startedAt = new Date();
  await asgn.save();
  const req = await MaintenanceRequest.findOne({ _id: asgn.requestId, collegeId });
  if (req) { req.status = 'in_progress'; await req.save(); }
  await audit(collegeId, 'MaintenanceAssignment', String(asgn._id), `Assignment ${assignmentId}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'in_progress' },
    { field: 'startedAt', displayName: 'Started At', oldValue: null, newValue: asgn.startedAt },
  ], performedBy);
  return asgn;
}

export async function addMaintenanceWorkLog(
  collegeId: string,
  data: { assignmentId: string; workDate: string; hoursSpent: number; description: string; materialsUsed?: Array<{ name: string; quantity: number; cost: number }>; cost?: number },
  performedBy: string,
) {
  const asgn = await MaintenanceAssignment.findOne({ _id: data.assignmentId, collegeId });
  if (!asgn) throw new AppError(404, 'Maintenance assignment not found');
  const matCost = (data.materialsUsed ?? []).reduce((s, m) => s + m.cost, 0);
  const doc = await MaintenanceWorkLog.create({
    collegeId, assignmentId: data.assignmentId, workDate: new Date(data.workDate),
    hoursSpent: data.hoursSpent, description: data.description,
    materialsUsed: data.materialsUsed ?? [], cost: data.cost ?? matCost, loggedBy: performedBy,
  });
  await audit(collegeId, 'MaintenanceWorkLog', String(doc._id), `WorkLog for ${data.assignmentId}`, 'create', [
    { field: 'hoursSpent', displayName: 'Hours', oldValue: null, newValue: data.hoursSpent },
    { field: 'cost', displayName: 'Cost', oldValue: null, newValue: doc.cost },
  ], performedBy);
  return doc;
}

export async function completeMaintenanceAssignment(collegeId: string, assignmentId: string, performedBy: string) {
  const asgn = await MaintenanceAssignment.findOne({ _id: assignmentId, collegeId });
  if (!asgn) throw new AppError(404, 'Maintenance assignment not found');
  const oldStatus = asgn.status;
  asgn.status = 'completed';
  asgn.completedAt = new Date();
  await asgn.save();
  const req = await MaintenanceRequest.findOne({ _id: asgn.requestId, collegeId });
  if (req) { req.status = 'completed'; await req.save(); }
  await audit(collegeId, 'MaintenanceAssignment', String(asgn._id), `Assignment ${assignmentId}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'completed' },
    { field: 'completedAt', displayName: 'Completed At', oldValue: null, newValue: asgn.completedAt },
  ], performedBy);
  return asgn;
}

export async function verifyMaintenanceWork(
  collegeId: string, requestId: string, data: { verificationStatus: string }, performedBy: string,
) {
  const req = await MaintenanceRequest.findOne({ _id: requestId, collegeId });
  if (!req) throw new AppError(404, 'Maintenance request not found');
  const oldStatus = req.status;
  req.verifiedBy = performedBy as any;
  req.verificationStatus = data.verificationStatus;
  if (data.verificationStatus === 'passed') {
    req.status = 'closed';
    req.resolvedAt = new Date();
    // TODO: record cost to M04
  } else {
    req.status = 'rework';
    const latestAsgn = await MaintenanceAssignment.findOne({ requestId, collegeId }, null, { sort: { createdAt: -1 } });
    if (latestAsgn) { latestAsgn.status = 'rework'; await latestAsgn.save(); }
  }
  await req.save();
  await audit(collegeId, 'MaintenanceRequest', String(req._id), `MR-${req.category}-${req.location}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: req.status },
    { field: 'verificationStatus', displayName: 'Verification', oldValue: null, newValue: data.verificationStatus },
  ], performedBy);
  return req;
}

// ===========================================================================
// W08-L2-036: Preventive Maintenance
// ===========================================================================

export async function triggerPreventiveMaintenance(
  collegeId: string,
  data: { scheduleId?: string; equipmentId?: string; aiTriggered?: boolean; aiConfidence?: number },
  performedBy: string,
) {
  const config = await getOrCreateConfig(collegeId);
  const pm = config.maintenance;
  let description = 'Preventive maintenance';
  let category = 'other';
  let location = 'N/A';
  let facilityType: string | undefined;
  let equipmentId: string | undefined;
  let scheduleRef: string | undefined;
  let needsSupervisorReview = false;

  if (data.scheduleId) {
    const sched = await MaintenanceSchedule.findOne({ _id: data.scheduleId, collegeId });
    if (!sched) throw new AppError(404, 'Maintenance schedule not found');
    description = `Scheduled PM: ${sched.facilityName} (${sched.frequency})`;
    location = sched.facilityName;
    category = 'other';
    equipmentId = sched.equipmentId ? String(sched.equipmentId) : undefined;
    scheduleRef = String(sched._id);
  }
  if (data.equipmentId) {
    const equip = await LabEquipment.findOne({ _id: data.equipmentId, collegeId });
    if (!equip) throw new AppError(404, 'Equipment not found');
    description = `AI-triggered PM: ${equip.name} (${equip.serialNumber})`;
    location = equip.name;
    facilityType = 'lab';
    equipmentId = data.equipmentId;
  }

  const confidence = data.aiConfidence ?? 0;
  if (data.aiTriggered && confidence < (pm?.pmConfidenceThreshold ?? 0.6)) needsSupervisorReview = true;
  const autoTriage = data.aiTriggered && confidence >= (pm?.pmAutoScheduleConfidenceThreshold ?? 0.7);

  const doc = await MaintenanceRequest.create({
    collegeId, requestedBy: performedBy, category, location, description,
    priority: 'medium', maintenanceType: 'preventive', facilityType, equipmentId,
    status: autoTriage ? 'triaged' : 'submitted',
  });
  await audit(collegeId, 'MaintenanceRequest', String(doc._id), description, 'create', [
    { field: 'maintenanceType', displayName: 'Type', oldValue: null, newValue: 'preventive' },
    { field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status },
  ], performedBy);
  return { request: doc, scheduleRef, needsSupervisorReview, autoTriaged: autoTriage };
}

export async function checkDuePreventiveMaintenance(collegeId: string) {
  return MaintenanceSchedule.find({
    collegeId, nextDueDate: { $lte: new Date() }, status: 'scheduled',
  }).lean();
}

export async function completePreventiveMaintenance(collegeId: string, requestId: string, performedBy: string) {
  const req = await MaintenanceRequest.findOne({ _id: requestId, collegeId });
  if (!req) throw new AppError(404, 'Maintenance request not found');
  const oldStatus = req.status;
  req.status = 'closed';
  req.resolvedAt = new Date();
  await req.save();

  if (req.equipmentId) {
    const sched = await MaintenanceSchedule.findOne({ collegeId, equipmentId: req.equipmentId, status: { $in: ['scheduled', 'overdue'] } });
    if (sched) {
      sched.lastPerformed = new Date();
      sched.lastDoneDate = new Date();
      const freqDays: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };
      const next = new Date();
      next.setDate(next.getDate() + (freqDays[sched.frequency] ?? 30));
      sched.nextDueDate = next;
      sched.status = 'scheduled';
      await sched.save();
    }
    const equip = await LabEquipment.findOne({ _id: req.equipmentId, collegeId });
    if (equip) {
      await EquipmentMaintenanceLog.create({
        collegeId, equipmentId: req.equipmentId, serviceDate: new Date(),
        serviceType: 'preventive', performedBy, description: req.description, cost: req.cost ?? 0,
      });
      equip.lastMaintenance = new Date();
      await equip.save();
    }
  }
  await audit(collegeId, 'MaintenanceRequest', String(req._id), `PM-${req.category}-${req.location}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
  ], performedBy);
  return req;
}

// ===========================================================================
// W08-L2-037: Maintenance Escalation
// ===========================================================================

export async function checkSLABreaches(collegeId: string) {
  const config = await getOrCreateConfig(collegeId);
  const warnPct = config.maintenance?.escalationWarningThresholdPercent ?? 80;
  const autoPct = config.maintenance?.escalationAutoThresholdPercent ?? 100;
  const active = await MaintenanceAssignment.find({ collegeId, status: { $in: ['assigned', 'in_progress'] } }).lean();
  const now = Date.now();
  const warnings: typeof active = [];
  const breaches: typeof active = [];

  for (const a of active) {
    const created = new Date((a as any).createdAt).getTime();
    const deadline = new Date(a.slaDeadline).getTime();
    const total = deadline - created;
    if (total <= 0) continue;
    const pct = ((now - created) / total) * 100;
    if (pct >= autoPct) breaches.push(a);
    else if (pct >= warnPct) warnings.push(a);
  }
  for (const b of breaches) {
    const exists = await MaintenanceEscalation.findOne({ collegeId, assignmentId: b._id, status: 'active' });
    if (!exists) {
      await MaintenanceEscalation.create({
        collegeId, requestId: b.requestId, assignmentId: b._id,
        reason: `SLA breached — exceeded ${autoPct}% of deadline`, triggerType: 'sla_breach', status: 'active',
      });
    }
  }
  return { warnings, breaches };
}

export async function createMaintenanceEscalation(
  collegeId: string, data: { requestId: string; assignmentId?: string; reason: string; triggerType: string }, performedBy: string,
) {
  const doc = await MaintenanceEscalation.create({
    collegeId, requestId: data.requestId, assignmentId: data.assignmentId,
    reason: data.reason, triggerType: data.triggerType, status: 'active',
  });
  // TODO: notify supervisor and principal for critical overdue
  await audit(collegeId, 'MaintenanceEscalation', String(doc._id), `Escalation for MR ${data.requestId}`, 'create', [
    { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
    { field: 'triggerType', displayName: 'Trigger', oldValue: null, newValue: data.triggerType },
  ], performedBy);
  return doc;
}

export async function acknowledgeEscalation(collegeId: string, escalationId: string, performedBy: string) {
  const esc = await MaintenanceEscalation.findOne({ _id: escalationId, collegeId });
  if (!esc) throw new AppError(404, 'Escalation not found');
  const old = esc.status;
  esc.status = 'acknowledged';
  esc.acknowledgedBy = performedBy as any;
  esc.acknowledgedAt = new Date();
  await esc.save();
  await audit(collegeId, 'MaintenanceEscalation', String(esc._id), `Escalation ${escalationId}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: old, newValue: 'acknowledged' },
  ], performedBy);
  return esc;
}

export async function resolveEscalation(collegeId: string, escalationId: string, performedBy: string) {
  const esc = await MaintenanceEscalation.findOne({ _id: escalationId, collegeId });
  if (!esc) throw new AppError(404, 'Escalation not found');
  const old = esc.status;
  esc.status = 'resolved';
  esc.resolvedAt = new Date();
  await esc.save();
  await audit(collegeId, 'MaintenanceEscalation', String(esc._id), `Escalation ${escalationId}`, 'update', [
    { field: 'status', displayName: 'Status', oldValue: old, newValue: 'resolved' },
  ], performedBy);
  return esc;
}

// ===========================================================================
// W08-L2-038: Vendor Performance
// ===========================================================================

export async function calculateVendorPerformance(
  collegeId: string, data: { vendorId: string; period: string }, performedBy: string,
) {
  const vendor = await Vendor.findOne({ _id: data.vendorId, collegeId });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  const [yStr, mStr] = data.period.split('-');
  const y = parseInt(yStr!, 10);
  const m = parseInt(mStr!, 10) - 1;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

  const assignments = await MaintenanceAssignment.find({
    collegeId, assignedToType: { $in: ['amc_vendor', 'external'] },
    assignedToId: data.vendorId, createdAt: { $gte: start, $lte: end },
  }).lean();

  const requestsAssigned = assignments.length;
  const completed = assignments.filter(a => a.status === 'completed');
  const requestsCompleted = completed.length;

  const toHrs = (a: any, field: string) => (new Date(a[field]).getTime() - new Date(a.createdAt).getTime()) / MS_PER_HOUR;
  const respTimes = assignments.filter(a => a.startedAt).map(a => toHrs(a, 'startedAt'));
  const avgResponseTimeHours = respTimes.length ? respTimes.reduce((s, v) => s + v, 0) / respTimes.length : undefined;
  const resTimes = completed.filter(a => a.completedAt).map(a => toHrs(a, 'completedAt'));
  const avgResolutionTimeHours = resTimes.length ? resTimes.reduce((s, v) => s + v, 0) / resTimes.length : undefined;

  let slaComplianceRate: number | undefined;
  if (completed.length) {
    const ok = completed.filter(a => a.completedAt && a.slaDeadline && new Date(a.completedAt) <= new Date(a.slaDeadline));
    slaComplianceRate = (ok.length / completed.length) * 100;
  }

  // Reference AMC contract (reserved for future SLA comparison)
  await AMCContract.findOne({ collegeId, vendorId: data.vendorId, status: 'active' }).lean();

  const existing = await VendorPerformance.findOne({ collegeId, vendorId: data.vendorId, period: data.period });
  const metrics = { requestsAssigned, requestsCompleted, avgResponseTimeHours, avgResolutionTimeHours, slaComplianceRate };
  let doc;
  if (existing) {
    Object.assign(existing, metrics);
    doc = await existing.save();
    await audit(collegeId, 'VendorPerformance', String(doc._id), `${vendor.name} - ${data.period}`, 'update', [
      { field: 'requestsCompleted', displayName: 'Completed', oldValue: null, newValue: requestsCompleted },
    ], performedBy);
  } else {
    doc = await VendorPerformance.create({ collegeId, vendorId: data.vendorId, period: data.period, ...metrics });
    await audit(collegeId, 'VendorPerformance', String(doc._id), `${vendor.name} - ${data.period}`, 'create', [
      { field: 'period', displayName: 'Period', oldValue: null, newValue: data.period },
    ], performedBy);
  }
  return doc;
}

export async function getVendorPerformanceSummary(collegeId: string, vendorId?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (vendorId) filter.vendorId = vendorId;
  return VendorPerformance.find(filter).sort({ period: -1 }).limit(50).lean();
}

// ===========================================================================
// W08-L2-039: Aggregate Clearance for W10
// ===========================================================================

interface ClearanceItem { subDomain: string; applicable: boolean; status: string; clearanceId?: string; blockingReasons: string[] }
interface ClearanceResponse { studentId: string; overallStatus: 'ALL_CLEAR' | 'BLOCKED' | 'PARTIAL'; items: ClearanceItem[] }

export async function aggregateClearanceStatus(collegeId: string, studentId: string): Promise<ClearanceResponse> {
  const items: ClearanceItem[] = [];

  // Hostel
  const hAlloc = await HostelAllocation.findOne({ collegeId, studentId, status: 'active' }).lean();
  const hItem: ClearanceItem = { subDomain: 'hostel', applicable: !!hAlloc, status: 'not_applicable', blockingReasons: [] };
  if (hAlloc) {
    const hc = await HostelClearance.findOne({ collegeId, studentId }).lean();
    if (hc) {
      hItem.status = hc.status; hItem.clearanceId = String(hc._id);
      if (hc.status === 'blocked' && hc.blockingItems) hItem.blockingReasons = hc.blockingItems.map(b => `${b.item}: ${b.reason}`);
    } else { hItem.status = 'pending'; hItem.blockingReasons = ['Hostel clearance not initiated']; }
  }
  items.push(hItem);

  // Transport
  const tAlloc = await TransportAllocation.findOne({ collegeId, studentId, status: 'active' }).lean();
  const tItem: ClearanceItem = { subDomain: 'transport', applicable: !!tAlloc, status: 'not_applicable', blockingReasons: [] };
  if (tAlloc) {
    const tc = await TransportClearance.findOne({ collegeId, studentId }).lean();
    if (tc) {
      tItem.status = tc.status; tItem.clearanceId = String(tc._id);
      if (tc.status === 'blocked' && tc.blockingItems) tItem.blockingReasons = tc.blockingItems.map(b => `${b.item}: ${b.reason}`);
    } else { tItem.status = 'pending'; tItem.blockingReasons = ['Transport clearance not initiated']; }
  }
  items.push(tItem);

  // Library (always applicable)
  const lItem: ClearanceItem = { subDomain: 'library', applicable: true, status: 'pending', blockingReasons: [] };
  const lc = await LibraryClearance.findOne({ collegeId, personId: studentId }).lean();
  if (lc) {
    lItem.status = lc.status; lItem.clearanceId = String(lc._id);
    if (lc.status === 'blocked' && lc.blockingItems) lItem.blockingReasons = lc.blockingItems.map(b => `${b.item}: ${b.reason}`);
  }
  const unreturned = await BookIssue.countDocuments({ collegeId, issuedTo: studentId, status: { $in: ['issued', 'overdue'] } });
  if (unreturned > 0) { lItem.blockingReasons.push(`${unreturned} unreturned book(s)`); lItem.status = 'blocked'; }
  const lm = await LibraryMember.findOne({ collegeId, personId: studentId, isActive: true }).lean();
  if (lm) {
    const fines = await LibraryFine.countDocuments({ collegeId, memberId: lm._id, status: 'pending' });
    if (fines > 0) { lItem.blockingReasons.push(`${fines} unpaid library fine(s)`); lItem.status = 'blocked'; }
  }
  if (!lItem.blockingReasons.length && !lc) lItem.status = 'cleared';
  items.push(lItem);

  // Labs (always applicable)
  const labItem: ClearanceItem = { subDomain: 'labs', applicable: true, status: 'pending', blockingReasons: [] };
  const labClr = await LabClearance.findOne({ collegeId, studentId }).lean();
  if (labClr) {
    labItem.status = labClr.status; labItem.clearanceId = String(labClr._id);
    if (labClr.status === 'blocked' && labClr.blockingItems) labItem.blockingReasons = labClr.blockingItems.map(b => `${b.item}: ${b.reason}`);
  }
  const outEquip = await EquipmentIssue.countDocuments({ collegeId, issuedTo: studentId, status: { $in: ['issued', 'overdue'] } });
  if (outEquip > 0) { labItem.blockingReasons.push(`${outEquip} unreturned equipment item(s)`); labItem.status = 'blocked'; }
  if (!labItem.blockingReasons.length && !labClr) labItem.status = 'cleared';
  items.push(labItem);

  // Aggregate
  const applicable = items.filter(i => i.applicable);
  const allCleared = applicable.every(i => i.status === 'cleared' || i.status === 'not_applicable');
  const anyBlocked = applicable.some(i => i.status === 'blocked');
  const overallStatus = allCleared ? 'ALL_CLEAR' : anyBlocked ? 'BLOCKED' : 'PARTIAL';
  return { studentId, overallStatus, items };
}

// ===========================================================================
// W08-L2-040: Provision Infrastructure at Enrollment
// ===========================================================================

export async function provisionInfrastructure(
  collegeId: string,
  data: { studentId: string; isHosteler: boolean; usesTransport: boolean; preferences?: Record<string, unknown> },
  performedBy: string,
) {
  const r: Record<string, { status: string; message: string }> = {};
  if (data.isHosteler) {
    // TODO: call hostel-service allocateHostelSingle
    r.hostel = { status: 'pending', message: 'Hostel allocation queued' };
  } else { r.hostel = { status: 'not_applicable', message: 'Day scholar' }; }

  if (data.usesTransport) {
    // TODO: call mess-transport-service allocateTransportSingle
    r.transport = { status: 'pending', message: 'Transport allocation queued' };
  } else { r.transport = { status: 'not_applicable', message: 'No transport' }; }

  const existing = await LibraryMember.findOne({ collegeId, personId: data.studentId });
  if (existing) {
    r.library = { status: 'already_exists', message: 'Library membership active' };
  } else {
    const mid = `LIB-${Date.now()}-${data.studentId.slice(-6)}`;
    await LibraryMember.create({ collegeId, personId: data.studentId, memberType: 'student', membershipId: mid, maxBooks: 5, currentIssued: 0, finesDue: 0, isActive: true });
    r.library = { status: 'created', message: `Membership ${mid}` };
  }
  r.labs = { status: 'implicit', message: 'Lab access implicit via enrollment' };

  await audit(collegeId, 'InfrastructureProvisioning', data.studentId, `Provision ${data.studentId}`, 'create', [
    { field: 'hostel', displayName: 'Hostel', oldValue: null, newValue: r.hostel.status },
    { field: 'transport', displayName: 'Transport', oldValue: null, newValue: r.transport.status },
    { field: 'library', displayName: 'Library', oldValue: null, newValue: r.library.status },
  ], performedBy);
  return { studentId: data.studentId, provisions: r };
}

// ===========================================================================
// W08-L2-041: Compliance Evidence for M10 (NAAC)
// ===========================================================================

export async function getComplianceEvidence(collegeId: string, data: { criterion?: string }) {
  const evidence: Record<string, unknown> = {};
  if (!data.criterion || data.criterion === 'criterion_iv') {
    const blocks = await HostelBlock.find({ collegeId, isActive: true }).lean();
    const cap = blocks.reduce((s, b) => s + (b.totalCapacity ?? 0), 0);
    const occ = blocks.reduce((s, b) => s + (b.currentOccupancy ?? 0), 0);
    const titles = await Book.countDocuments({ collegeId });
    const copies = await Book.aggregate([{ $match: { collegeId: { $exists: true } } }, { $group: { _id: null, s: { $sum: '$totalCopies' } } }]);
    const circ = await BookIssue.countDocuments({ collegeId });
    const eqTotal = await LabEquipment.countDocuments({ collegeId });
    const eqActive = await LabEquipment.countDocuments({ collegeId, status: 'active' });
    const uLogs = await FacilityUsageLog.countDocuments({ collegeId });
    const noShow = await FacilityUsageLog.countDocuments({ collegeId, noShow: true });
    const mrTotal = await MaintenanceRequest.countDocuments({ collegeId });
    const mrDone = await MaintenanceRequest.countDocuments({ collegeId, status: { $in: ['closed', 'verified', 'completed'] } });

    evidence.criterion_iv = {
      hostel: { totalBlocks: blocks.length, totalCapacity: cap, currentOccupancy: occ, occupancyRate: cap > 0 ? (occ / cap) * 100 : 0 },
      library: { totalTitles: titles, totalCopies: copies[0]?.s ?? 0, totalCirculations: circ },
      labEquipment: { total: eqTotal, active: eqActive, utilizationPercent: eqTotal > 0 ? (eqActive / eqTotal) * 100 : 0 },
      facilityUtilization: { totalBookings: uLogs, noShows: noShow, utilizationRate: uLogs > 0 ? ((uLogs - noShow) / uLogs) * 100 : 0 },
      maintenance: { totalRequests: mrTotal, completedRequests: mrDone, completionRate: mrTotal > 0 ? (mrDone / mrTotal) * 100 : 0 },
    };
  }
  return evidence;
}

// ===========================================================================
// W08-L2-042: Governance Metrics for M11
// ===========================================================================

export async function getGovernanceMetrics(collegeId: string, data: { category?: string; startDate?: string; endDate?: string }) {
  const metrics: Record<string, unknown> = {};
  const df: Record<string, unknown> = {};
  if (data.startDate) df.$gte = new Date(data.startDate);
  if (data.endDate) df.$lte = new Date(data.endDate);
  const hasDF = Object.keys(df).length > 0;
  const inc = (n: string) => !data.category || data.category === n;

  if (inc('facility_utilization')) {
    const bf: Record<string, unknown> = { collegeId };
    if (hasDF) bf.date = df;
    const total = await RoomBooking.countDocuments(bf);
    const done = await RoomBooking.countDocuments({ ...bf, status: 'completed' });
    const ns = await RoomBooking.countDocuments({ ...bf, noShow: true });
    const uf: Record<string, unknown> = { collegeId };
    if (hasDF) uf.createdAt = df;
    const ul = await FacilityUsageLog.countDocuments(uf);
    metrics.facility_utilization = { totalBookings: total, completedBookings: done, noShowBookings: ns, usageLogsRecorded: ul, utilizationRate: total > 0 ? (done / total) * 100 : 0 };
  }

  if (inc('maintenance_health')) {
    const mf: Record<string, unknown> = { collegeId };
    if (hasDF) mf.createdAt = df;
    const open = await MaintenanceRequest.countDocuments({ collegeId, status: { $in: ['submitted', 'triaged', 'assigned', 'in_progress'] } });
    const closed = await MaintenanceRequest.countDocuments({ ...mf, status: { $in: ['closed', 'verified'] } });
    const tot = await MaintenanceRequest.countDocuments(mf);
    const started = await MaintenanceAssignment.find({ collegeId, startedAt: { $exists: true }, ...(hasDF ? { createdAt: df } : {}) }).lean();
    let avgResp = 0;
    if (started.length) {
      avgResp = started.reduce((s, a) => s + (new Date(a.startedAt!).getTime() - new Date((a as any).createdAt).getTime()) / MS_PER_HOUR, 0) / started.length;
    }
    const ago7 = new Date(); ago7.setDate(ago7.getDate() - 7);
    const backlog = await MaintenanceRequest.countDocuments({ collegeId, status: { $in: ['submitted', 'triaged', 'assigned', 'in_progress'] }, createdAt: { $lte: ago7 } });
    const perf = await VendorPerformance.find({ collegeId }).sort({ period: -1 }).limit(10).lean();
    const sla = perf.length ? perf.reduce((s, r) => s + (r.slaComplianceRate ?? 0), 0) / perf.length : null;
    metrics.maintenance_health = { openRequests: open, closedRequests: closed, totalRequests: tot, avgResponseHours: Math.round(avgResp * 100) / 100, backlog, vendorSlaCompliance: sla };
  }

  if (inc('hostel_occupancy')) {
    const bl = await HostelBlock.find({ collegeId, isActive: true }).lean();
    const cap = bl.reduce((s, b) => s + (b.totalCapacity ?? 0), 0);
    const occ = bl.reduce((s, b) => s + (b.currentOccupancy ?? 0), 0);
    const aa = await HostelAllocation.countDocuments({ collegeId, status: 'active' });
    metrics.hostel_occupancy = { totalBlocks: bl.length, totalCapacity: cap, currentOccupancy: occ, activeAllocations: aa, occupancyRate: cap > 0 ? (occ / cap) * 100 : 0 };
  }

  if (inc('library_activity')) {
    const isf: Record<string, unknown> = { collegeId };
    if (hasDF) isf.issuedDate = df;
    const ti = await BookIssue.countDocuments(isf);
    const ai = await BookIssue.countDocuments({ collegeId, status: { $in: ['issued', 'overdue'] } });
    const oi = await BookIssue.countDocuments({ collegeId, status: 'overdue' });
    const gf: Record<string, unknown> = { collegeId };
    if (hasDF) gf.entryTime = df;
    const ge = await LibraryGateEntry.countDocuments(gf);
    metrics.library_activity = { totalIssues: ti, activeIssues: ai, overdueIssues: oi, gateEntries: ge };
  }
  return metrics;
}

// ===========================================================================
// CRUD — MaintenanceAssignment
// ===========================================================================

export async function listMaintenanceAssignments(collegeId: string, page: number, limit: number, filters?: { requestId?: string; status?: string }) {
  const f: Record<string, unknown> = { collegeId };
  if (filters?.requestId) f.requestId = filters.requestId;
  if (filters?.status) f.status = filters.status;
  return paginate(MaintenanceAssignment, f, page, limit);
}

export async function getMaintenanceAssignment(collegeId: string, id: string) {
  const doc = await MaintenanceAssignment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance assignment not found');
  return doc;
}

export async function updateMaintenanceAssignment(
  collegeId: string, id: string,
  data: Partial<{ assignedToType: string; assignedToId: string; assignedToName: string; slaDeadline: string; status: string; remarks: string }>,
  performedBy: string,
) {
  const doc = await MaintenanceAssignment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance assignment not found');
  const changes = applyUpdates(doc, data as Record<string, unknown>, { assignedToType: 'Assigned To Type', assignedToId: 'Assigned To', assignedToName: 'Name', slaDeadline: 'SLA Deadline', status: 'Status', remarks: 'Remarks' });
  await doc.save();
  await audit(collegeId, 'MaintenanceAssignment', String(doc._id), `Assignment ${id}`, 'update', changes, performedBy);
  return doc;
}

export async function deleteMaintenanceAssignment(collegeId: string, id: string, performedBy: string) {
  const doc = await MaintenanceAssignment.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance assignment not found');
  await audit(collegeId, 'MaintenanceAssignment', String(doc._id), `Assignment ${id}`, 'delete', [], performedBy);
  return doc;
}

// ===========================================================================
// CRUD — MaintenanceWorkLog (list/get only — immutable)
// ===========================================================================

export async function listMaintenanceWorkLogs(collegeId: string, page: number, limit: number, filters?: { assignmentId?: string }) {
  const f: Record<string, unknown> = { collegeId };
  if (filters?.assignmentId) f.assignmentId = filters.assignmentId;
  return paginate(MaintenanceWorkLog, f, page, limit);
}

export async function getMaintenanceWorkLog(collegeId: string, id: string) {
  const doc = await MaintenanceWorkLog.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance work log not found');
  return doc;
}

// ===========================================================================
// CRUD — MaintenanceEscalation
// ===========================================================================

export async function listMaintenanceEscalations(collegeId: string, page: number, limit: number, filters?: { requestId?: string; status?: string }) {
  const f: Record<string, unknown> = { collegeId };
  if (filters?.requestId) f.requestId = filters.requestId;
  if (filters?.status) f.status = filters.status;
  return paginate(MaintenanceEscalation, f, page, limit);
}

export async function getMaintenanceEscalation(collegeId: string, id: string) {
  const doc = await MaintenanceEscalation.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance escalation not found');
  return doc;
}

export async function updateMaintenanceEscalation(
  collegeId: string, id: string, data: Partial<{ reason: string; escalationLevel: number; status: string }>, performedBy: string,
) {
  const doc = await MaintenanceEscalation.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance escalation not found');
  const changes = applyUpdates(doc, data as Record<string, unknown>, { reason: 'Reason', escalationLevel: 'Level', status: 'Status' });
  await doc.save();
  await audit(collegeId, 'MaintenanceEscalation', String(doc._id), `Escalation ${id}`, 'update', changes, performedBy);
  return doc;
}

export async function deleteMaintenanceEscalation(collegeId: string, id: string, performedBy: string) {
  const doc = await MaintenanceEscalation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance escalation not found');
  await audit(collegeId, 'MaintenanceEscalation', String(doc._id), `Escalation ${id}`, 'delete', [], performedBy);
  return doc;
}

// ===========================================================================
// CRUD — AMCContract
// ===========================================================================

export async function listAMCContracts(collegeId: string, page: number, limit: number, filters?: { vendorId?: string; status?: string; facilityType?: string }) {
  const f: Record<string, unknown> = { collegeId };
  if (filters?.vendorId) f.vendorId = filters.vendorId;
  if (filters?.status) f.status = filters.status;
  if (filters?.facilityType) f.facilityType = filters.facilityType;
  return paginate(AMCContract, f, page, limit);
}

export async function getAMCContract(collegeId: string, id: string) {
  const doc = await AMCContract.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'AMC contract not found');
  return doc;
}

export async function createAMCContractRecord(
  collegeId: string,
  data: { vendorId: string; contractNumber: string; facilityType: string; facilityIds?: string[]; startDate: string; endDate: string; slaMetrics?: { responseTimeHours?: number; resolutionTimeHours?: number; uptimePercent?: number }; annualCost?: number; status?: string },
  performedBy: string,
) {
  const doc = await AMCContract.create({
    collegeId, vendorId: data.vendorId, contractNumber: data.contractNumber,
    facilityType: data.facilityType, facilityIds: data.facilityIds,
    startDate: new Date(data.startDate), endDate: new Date(data.endDate),
    slaMetrics: data.slaMetrics, annualCost: data.annualCost, status: data.status ?? 'draft',
  });
  await audit(collegeId, 'AMCContract', String(doc._id), `AMC-${data.contractNumber}`, 'create', [
    { field: 'contractNumber', displayName: 'Contract #', oldValue: null, newValue: data.contractNumber },
    { field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status },
  ], performedBy);
  return doc;
}

export async function updateAMCContract(
  collegeId: string, id: string,
  data: Partial<{ facilityType: string; facilityIds: string[]; startDate: string; endDate: string; slaMetrics: { responseTimeHours?: number; resolutionTimeHours?: number; uptimePercent?: number }; annualCost: number; status: string; terminationReason: string }>,
  performedBy: string,
) {
  const doc = await AMCContract.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'AMC contract not found');
  const changes = applyUpdates(doc, data as Record<string, unknown>, {
    facilityType: 'Facility Type', facilityIds: 'Facility IDs', startDate: 'Start Date', endDate: 'End Date',
    slaMetrics: 'SLA Metrics', annualCost: 'Annual Cost', status: 'Status', terminationReason: 'Termination Reason',
  });
  await doc.save();
  await audit(collegeId, 'AMCContract', String(doc._id), `AMC-${doc.contractNumber}`, 'update', changes, performedBy);
  return doc;
}

export async function deleteAMCContract(collegeId: string, id: string, performedBy: string) {
  const doc = await AMCContract.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'AMC contract not found');
  await audit(collegeId, 'AMCContract', String(doc._id), `AMC-${doc.contractNumber}`, 'delete', [], performedBy);
  return doc;
}

// ===========================================================================
// CRUD — VendorPerformance
// ===========================================================================

export async function listVendorPerformances(collegeId: string, page: number, limit: number, filters?: { vendorId?: string; period?: string }) {
  const f: Record<string, unknown> = { collegeId };
  if (filters?.vendorId) f.vendorId = filters.vendorId;
  if (filters?.period) f.period = filters.period;
  return paginate(VendorPerformance, f, page, limit);
}

export async function getVendorPerformance(collegeId: string, id: string) {
  const doc = await VendorPerformance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Vendor performance record not found');
  return doc;
}

export async function createVendorPerformanceRecord(
  collegeId: string,
  data: { vendorId: string; period: string; requestsAssigned?: number; requestsCompleted?: number; avgResponseTimeHours?: number; avgResolutionTimeHours?: number; slaComplianceRate?: number; customerSatisfactionScore?: number; remarks?: string },
  performedBy: string,
) {
  const doc = await VendorPerformance.create({
    collegeId, vendorId: data.vendorId, period: data.period,
    requestsAssigned: data.requestsAssigned ?? 0, requestsCompleted: data.requestsCompleted ?? 0,
    avgResponseTimeHours: data.avgResponseTimeHours, avgResolutionTimeHours: data.avgResolutionTimeHours,
    slaComplianceRate: data.slaComplianceRate, customerSatisfactionScore: data.customerSatisfactionScore, remarks: data.remarks,
  });
  await audit(collegeId, 'VendorPerformance', String(doc._id), `VP-${data.vendorId}-${data.period}`, 'create', [
    { field: 'period', displayName: 'Period', oldValue: null, newValue: data.period },
  ], performedBy);
  return doc;
}

export async function updateVendorPerformanceRecord(
  collegeId: string, id: string,
  data: Partial<{ requestsAssigned: number; requestsCompleted: number; avgResponseTimeHours: number; avgResolutionTimeHours: number; slaComplianceRate: number; customerSatisfactionScore: number; remarks: string }>,
  performedBy: string,
) {
  const doc = await VendorPerformance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Vendor performance record not found');
  const changes = applyUpdates(doc, data as Record<string, unknown>, {
    requestsAssigned: 'Assigned', requestsCompleted: 'Completed', avgResponseTimeHours: 'Avg Response (hrs)',
    avgResolutionTimeHours: 'Avg Resolution (hrs)', slaComplianceRate: 'SLA %', customerSatisfactionScore: 'CSAT', remarks: 'Remarks',
  });
  await doc.save();
  await audit(collegeId, 'VendorPerformance', String(doc._id), `VP-${doc.vendorId}-${doc.period}`, 'update', changes, performedBy);
  return doc;
}

export async function deleteVendorPerformanceRecord(collegeId: string, id: string, performedBy: string) {
  const doc = await VendorPerformance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Vendor performance record not found');
  await audit(collegeId, 'VendorPerformance', String(doc._id), `VP-${doc.vendorId}-${doc.period}`, 'delete', [], performedBy);
  return doc;
}
