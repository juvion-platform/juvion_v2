import { SeparationRequest } from '../../models/hr/SeparationRequest';
import { ExitClearance } from '../../models/hr/ExitClearance';
import { HandoverRecord } from '../../models/hr/HandoverRecord';
import { FinalSettlement } from '../../models/hr/FinalSettlement';
import { Employee } from '../../models/hr/Employee';
import { PayStructure } from '../../models/hr/PayStructure';
import { LeaveBalance } from '../../models/hr/LeaveBalance';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ===========================================================================
// Separation Initiation (W05-L2-050 to 053)
// ===========================================================================

/** W05-L2-050: Employee submits a resignation request */
export async function initiateResignation(
  collegeId: string,
  data: { employeeId: string; requestedLastWorkingDay: Date; reason: string },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const noticePeriodDays = employee.noticePeriodDays ?? 30;
  const today = new Date();
  const noticePeriodEnd = new Date(today);
  noticePeriodEnd.setDate(noticePeriodEnd.getDate() + noticePeriodDays);

  const requestedDate = new Date(data.requestedLastWorkingDay);
  const confirmedLastWorkingDay = requestedDate > noticePeriodEnd ? requestedDate : noticePeriodEnd;

  const doc = await SeparationRequest.create({
    collegeId,
    employeeId: data.employeeId,
    separationType: 'resignation',
    requestedLastWorkingDay: requestedDate,
    confirmedLastWorkingDay,
    noticePeriodDays,
    reason: data.reason,
    status: 'submitted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(doc._id),
    entityName: `Resignation - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'submitted' },
      { field: 'separationType', displayName: 'Separation Type', oldValue: null, newValue: 'resignation' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-051: Process retirement (proactive/scheduled) */
export async function processRetirement(
  collegeId: string,
  employeeId: string,
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const doc = await SeparationRequest.create({
    collegeId,
    employeeId,
    separationType: 'retirement',
    confirmedLastWorkingDay: employee.superannuationDate ?? new Date(),
    reason: 'Superannuation / Retirement',
    isRetirementProactive: true,
    status: 'accepted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(doc._id),
    entityName: `Retirement - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'accepted' },
      { field: 'separationType', displayName: 'Separation Type', oldValue: null, newValue: 'retirement' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-052: Process termination (linked to disciplinary case) */
export async function processTermination(
  collegeId: string,
  data: { employeeId: string; disciplinaryCaseId?: string; reason: string },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const doc = await SeparationRequest.create({
    collegeId,
    employeeId: data.employeeId,
    separationType: 'termination',
    relatedDisciplinaryCaseId: data.disciplinaryCaseId,
    confirmedLastWorkingDay: new Date(),
    reason: data.reason,
    status: 'accepted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(doc._id),
    entityName: `Termination - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'accepted' },
      { field: 'separationType', displayName: 'Separation Type', oldValue: null, newValue: 'termination' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-053: Process death notification */
export async function processDeathNotification(
  collegeId: string,
  data: { employeeId: string; reason: string },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const doc = await SeparationRequest.create({
    collegeId,
    employeeId: data.employeeId,
    separationType: 'death',
    confirmedLastWorkingDay: new Date(),
    reason: data.reason,
    status: 'accepted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(doc._id),
    entityName: `Death Notification - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'accepted' },
      { field: 'separationType', displayName: 'Separation Type', oldValue: null, newValue: 'death' },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Notice & Approval (W05-L2-054 to 056)
// ===========================================================================

/** W05-L2-054: Accept a resignation */
export async function acceptResignation(
  collegeId: string,
  separationId: string,
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');
  if (sep.status !== 'submitted') throw new AppError(400, 'Only submitted resignations can be accepted');

  const oldStatus = sep.status;
  sep.status = 'accepted';
  await sep.save();

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(sep._id),
    entityName: `Separation - ${String(sep.employeeId)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'accepted' }],
    performedBy,
  });

  return sep;
}

/** W05-L2-055: Reject a resignation */
export async function rejectResignation(
  collegeId: string,
  separationId: string,
  data: { remarks: string },
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');
  if (sep.status !== 'submitted') throw new AppError(400, 'Only submitted resignations can be rejected');

  const oldStatus = sep.status;
  sep.status = 'rejected';
  await sep.save();

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(sep._id),
    entityName: `Separation - ${String(sep.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' },
      { field: 'remarks', displayName: 'Rejection Remarks', oldValue: null, newValue: data.remarks },
    ],
    performedBy,
  });

  return sep;
}

/** W05-L2-056: Waive notice period */
export async function waiveNoticePeriod(
  collegeId: string,
  separationId: string,
  data: { newLastWorkingDay: Date },
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');

  const oldLastDay = sep.confirmedLastWorkingDay;
  sep.noticePeriodWaived = true;
  sep.waiverApprovedBy = performedBy as any;
  sep.confirmedLastWorkingDay = new Date(data.newLastWorkingDay);
  await sep.save();

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(sep._id),
    entityName: `Separation - ${String(sep.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'noticePeriodWaived', displayName: 'Notice Period Waived', oldValue: false, newValue: true },
      { field: 'confirmedLastWorkingDay', displayName: 'Confirmed Last Working Day', oldValue: oldLastDay, newValue: data.newLastWorkingDay },
    ],
    performedBy,
  });

  return sep;
}

// ===========================================================================
// Clearance (W05-L2-057 to 059)
// ===========================================================================

/** W05-L2-057: Initiate clearance checklist */
export async function initiateClearance(
  collegeId: string,
  separationId: string,
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');
  if (sep.status !== 'accepted') throw new AppError(400, 'Separation must be accepted before initiating clearance');

  // Standard clearance items for all employees
  const standardDepartments = [
    'Department Handover',
    'Library Clearance',
    'Finance Clearance',
    'IT Access Revocation',
  ];

  // Check if employee is faculty (designation contains Professor or teaching type)
  const employee = await Employee.findOne({ _id: sep.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const isFaculty =
    employee.designation.toLowerCase().includes('professor') ||
    employee.employeeType === 'teaching';

  const departments = isFaculty
    ? [...standardDepartments, 'Course Reassignment', 'Advisory Role Reassignment']
    : standardDepartments;

  const items = departments.map((dept) => ({
    department: dept,
    status: 'pending' as const,
  }));

  const clearance = await ExitClearance.create({
    collegeId,
    separationRequestId: separationId,
    employeeId: String(sep.employeeId),
    items,
    overallStatus: 'in_progress',
    generatedAt: new Date(),
  });

  // Update separation request status
  const oldStatus = sep.status;
  sep.status = 'in_clearance';
  await sep.save();

  await createAuditLog({
    collegeId,
    entityType: 'ExitClearance',
    entityId: String(clearance._id),
    entityName: `Clearance - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'overallStatus', displayName: 'Overall Status', oldValue: null, newValue: 'in_progress' },
      { field: 'separationStatus', displayName: 'Separation Status', oldValue: oldStatus, newValue: 'in_clearance' },
    ],
    performedBy,
  });

  return clearance;
}

/** W05-L2-058: Clear or block a clearance item */
export async function clearItem(
  collegeId: string,
  clearanceId: string,
  data: { department: string; status: 'cleared' | 'blocked'; remarks?: string; blockedReason?: string },
  performedBy: string,
) {
  const clearance = await ExitClearance.findOne({ _id: clearanceId, collegeId });
  if (!clearance) throw new AppError(404, 'Exit clearance not found');

  const item = clearance.items.find((i) => i.department === data.department);
  if (!item) throw new AppError(404, `Clearance item for department "${data.department}" not found`);

  const oldStatus = item.status;
  item.status = data.status;
  if (data.remarks) item.remarks = data.remarks;
  if (data.status === 'cleared') {
    item.clearedBy = performedBy as any;
    item.clearedAt = new Date();
  }
  if (data.status === 'blocked' && data.blockedReason) {
    item.blockedReason = data.blockedReason;
  }

  // Recalculate overall status
  const allCleared = clearance.items.every((i) => i.status === 'cleared');
  const anyBlocked = clearance.items.some((i) => i.status === 'blocked');

  if (allCleared) {
    clearance.overallStatus = 'all_cleared';
    clearance.completedAt = new Date();
  } else if (anyBlocked) {
    clearance.overallStatus = 'blocked';
  } else {
    clearance.overallStatus = 'in_progress';
  }

  await clearance.save();

  await createAuditLog({
    collegeId,
    entityType: 'ExitClearance',
    entityId: String(clearance._id),
    entityName: `Clearance Item - ${data.department}`,
    action: 'update',
    changes: [
      { field: `items.${data.department}.status`, displayName: `${data.department} Status`, oldValue: oldStatus, newValue: data.status },
      { field: 'overallStatus', displayName: 'Overall Status', oldValue: clearance.overallStatus, newValue: clearance.overallStatus },
    ],
    performedBy,
  });

  return clearance;
}

/** W05-L2-059: Get clearance status */
export async function getClearanceStatus(collegeId: string, separationId: string) {
  const clearance = await ExitClearance.findOne({ collegeId, separationRequestId: separationId })
    .populate('employeeId', 'employeeId designation')
    .lean();
  if (!clearance) throw new AppError(404, 'Exit clearance not found for this separation request');
  return clearance;
}

// ===========================================================================
// Handover (W05-L2-060 to 062)
// ===========================================================================

/** W05-L2-060: Create handover record */
export async function createHandoverRecord(
  collegeId: string,
  separationId: string,
  data: {
    items: {
      category: 'course' | 'mentee' | 'research' | 'admin' | 'asset' | 'lab';
      description: string;
      successorId?: string;
    }[];
  },
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');

  const items = data.items.map((item) => ({
    ...item,
    status: 'pending' as const,
  }));

  const doc = await HandoverRecord.create({
    collegeId,
    separationRequestId: separationId,
    employeeId: String(sep.employeeId),
    items,
    overallStatus: 'pending',
  });

  await createAuditLog({
    collegeId,
    entityType: 'HandoverRecord',
    entityId: String(doc._id),
    entityName: `Handover - ${String(sep.employeeId)}`,
    action: 'create',
    changes: [
      { field: 'overallStatus', displayName: 'Overall Status', oldValue: null, newValue: 'pending' },
      { field: 'itemCount', displayName: 'Item Count', oldValue: null, newValue: items.length },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-061: Update a handover item */
export async function updateHandoverItem(
  collegeId: string,
  handoverId: string,
  data: { category: string; status: 'pending' | 'completed'; successorId?: string; completedAt?: Date },
  performedBy: string,
) {
  const record = await HandoverRecord.findOne({ _id: handoverId, collegeId });
  if (!record) throw new AppError(404, 'Handover record not found');

  const item = record.items.find((i) => i.category === data.category);
  if (!item) throw new AppError(404, `Handover item with category "${data.category}" not found`);

  const oldStatus = item.status;
  item.status = data.status;
  if (data.successorId) item.successorId = data.successorId as any;
  if (data.status === 'completed') item.completedAt = data.completedAt ?? new Date();

  // Recalculate overall status
  const allCompleted = record.items.every((i) => i.status === 'completed');
  const anyCompleted = record.items.some((i) => i.status === 'completed');

  if (allCompleted) {
    record.overallStatus = 'completed';
  } else if (anyCompleted) {
    record.overallStatus = 'in_progress';
  } else {
    record.overallStatus = 'pending';
  }

  await record.save();

  await createAuditLog({
    collegeId,
    entityType: 'HandoverRecord',
    entityId: String(record._id),
    entityName: `Handover Item - ${data.category}`,
    action: 'update',
    changes: [
      { field: `items.${data.category}.status`, displayName: `${data.category} Status`, oldValue: oldStatus, newValue: data.status },
    ],
    performedBy,
  });

  return record;
}

/** W05-L2-062: Verify handover by HOD */
export async function verifyHandover(
  collegeId: string,
  handoverId: string,
  performedBy: string,
) {
  const record = await HandoverRecord.findOne({ _id: handoverId, collegeId });
  if (!record) throw new AppError(404, 'Handover record not found');

  const allCompleted = record.items.every((i) => i.status === 'completed');
  if (!allCompleted) throw new AppError(400, 'All handover items must be completed before verification');

  record.verifiedByHOD = true;
  record.verifiedAt = new Date();
  record.overallStatus = 'completed';
  await record.save();

  await createAuditLog({
    collegeId,
    entityType: 'HandoverRecord',
    entityId: String(record._id),
    entityName: `Handover - ${String(record.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'verifiedByHOD', displayName: 'Verified by HOD', oldValue: false, newValue: true },
      { field: 'overallStatus', displayName: 'Overall Status', oldValue: record.overallStatus, newValue: 'completed' },
    ],
    performedBy,
  });

  return record;
}

// ===========================================================================
// Settlement (W05-L2-063 to 065)
// ===========================================================================

/** W05-L2-063: Compute final settlement */
export async function computeFinalSettlement(
  collegeId: string,
  separationId: string,
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');

  const employee = await Employee.findOne({ _id: sep.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  // Get current pay structure (latest effective)
  const payStructure = await PayStructure.findOne({
    collegeId,
    employeeId: sep.employeeId,
  }).sort({ effectiveFrom: -1 });
  if (!payStructure) throw new AppError(404, 'Pay structure not found for employee');

  const basicPay = payStructure.basicPay;
  const da = payStructure.da;

  // Compute leave encashment
  const leaveBalances = await LeaveBalance.find({
    collegeId,
    employeeId: sep.employeeId,
  }).populate('leaveTypeId');

  let leaveEncashmentDays = 0;
  for (const lb of leaveBalances) {
    const leaveType = lb.leaveTypeId as any;
    if (leaveType && leaveType.encashmentAllowed && lb.balance > 0) {
      const maxEncash = leaveType.maxEncashmentDays ?? lb.balance;
      leaveEncashmentDays += Math.min(lb.balance, maxEncash);
    }
  }

  const leaveEncashmentAmount = leaveEncashmentDays * (basicPay + da) / 30;

  // Compute gratuity
  const confirmedLastDay = sep.confirmedLastWorkingDay ?? new Date();
  const joiningDate = employee.joiningDate;
  const yearsOfService =
    (confirmedLastDay.getTime() - joiningDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const gratuityYearsOfService = Math.floor(yearsOfService * 100) / 100; // 2 decimal places
  const gratuityEligible = gratuityYearsOfService >= 5;
  let gratuityAmount = gratuityEligible
    ? (basicPay + da) * 15 * gratuityYearsOfService / 26
    : 0;
  // Cap gratuity at 25 lakhs
  gratuityAmount = Math.min(gratuityAmount, 2500000);

  // Stubs for future module integration
  const pendingReimbursements = 0; // Stub for M04
  const advanceDeductions = 0;     // Stub for M04
  const dueDeductions = 0;         // Stub for M08

  const grossSettlement = leaveEncashmentAmount + gratuityAmount + pendingReimbursements;
  const netSettlement = grossSettlement - advanceDeductions - dueDeductions;

  const doc = await FinalSettlement.create({
    collegeId,
    separationRequestId: separationId,
    employeeId: String(sep.employeeId),
    leaveEncashmentDays,
    leaveEncashmentAmount: Math.round(leaveEncashmentAmount * 100) / 100,
    pendingReimbursements,
    gratuityAmount: Math.round(gratuityAmount * 100) / 100,
    gratuityEligible,
    gratuityYearsOfService,
    grossSettlement: Math.round(grossSettlement * 100) / 100,
    advanceDeductions,
    dueDeductions,
    netSettlement: Math.round(netSettlement * 100) / 100,
    computedAt: new Date(),
    status: 'computed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'FinalSettlement',
    entityId: String(doc._id),
    entityName: `Settlement - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'computed' },
      { field: 'netSettlement', displayName: 'Net Settlement', oldValue: null, newValue: doc.netSettlement },
      { field: 'gratuityEligible', displayName: 'Gratuity Eligible', oldValue: null, newValue: gratuityEligible },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-064: Approve final settlement */
export async function approveSettlement(
  collegeId: string,
  settlementId: string,
  performedBy: string,
) {
  const settlement = await FinalSettlement.findOne({ _id: settlementId, collegeId });
  if (!settlement) throw new AppError(404, 'Final settlement not found');
  if (settlement.status !== 'computed') throw new AppError(400, 'Only computed settlements can be approved');

  const oldStatus = settlement.status;
  settlement.status = 'approved';
  settlement.approvedBy = performedBy as any;
  await settlement.save();

  await createAuditLog({
    collegeId,
    entityType: 'FinalSettlement',
    entityId: String(settlement._id),
    entityName: `Settlement - ${String(settlement.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' },
    ],
    performedBy,
  });

  return settlement;
}

/** W05-L2-065: Process final settlement (disburse payment) */
export async function processSettlement(
  collegeId: string,
  settlementId: string,
  performedBy: string,
) {
  const settlement = await FinalSettlement.findOne({ _id: settlementId, collegeId });
  if (!settlement) throw new AppError(404, 'Final settlement not found');
  if (settlement.status !== 'approved') throw new AppError(400, 'Only approved settlements can be processed');

  const oldStatus = settlement.status;
  settlement.status = 'processed';
  settlement.processedAt = new Date();
  await settlement.save();

  // Stub: would push payment instruction to M04 Finance module

  await createAuditLog({
    collegeId,
    entityType: 'FinalSettlement',
    entityId: String(settlement._id),
    entityName: `Settlement - ${String(settlement.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'processed' },
      { field: 'processedAt', displayName: 'Processed At', oldValue: null, newValue: settlement.processedAt },
    ],
    performedBy,
  });

  return settlement;
}

// ===========================================================================
// Completion (W05-L2-066, W05-L2-075, W05-L2-076)
// ===========================================================================

/** W05-L2-066: Issue relieving order */
export async function issueRelievingOrder(
  collegeId: string,
  separationId: string,
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');

  const employee = await Employee.findOne({ _id: sep.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  // Stub: in production this would generate a PDF document
  const documentRef = {
    type: 'relieving_order',
    separationId: String(sep._id),
    employeeId: String(employee._id),
    employeeCode: employee.employeeId,
    designation: employee.designation,
    confirmedLastWorkingDay: sep.confirmedLastWorkingDay,
    issuedAt: new Date(),
  };

  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(sep._id),
    entityName: `Relieving Order - ${employee.employeeId}`,
    action: 'update',
    changes: [
      { field: 'relievingOrderIssued', displayName: 'Relieving Order Issued', oldValue: false, newValue: true },
    ],
    performedBy,
  });

  return documentRef;
}

/** W05-L2-075: Archive employee record */
export async function archiveEmployeeRecord(
  collegeId: string,
  separationId: string,
  performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');

  const employee = await Employee.findOne({ _id: sep.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const oldStatus = employee.status;
  employee.status = 'separated';
  await employee.save();

  // Mark separation request as completed
  sep.status = 'completed';
  await sep.save();

  await createAuditLog({
    collegeId,
    entityType: 'Employee',
    entityId: String(employee._id),
    entityName: `${employee.employeeId} - ${employee.designation}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Employee Status', oldValue: oldStatus, newValue: 'separated' },
      { field: 'separationCompleted', displayName: 'Separation Completed', oldValue: false, newValue: true },
    ],
    performedBy,
  });

  return { employee, separationRequest: sep };
}

/** W05-L2-076: Trigger replacement requisition */
export async function triggerReplacementRequisition(
  collegeId: string,
  separationId: string,
  _performedBy: string,
) {
  const sep = await SeparationRequest.findOne({ _id: separationId, collegeId });
  if (!sep) throw new AppError(404, 'Separation request not found');

  const employee = await Employee.findOne({ _id: sep.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  // Stub: in production this would create a HiringRequisition via recruitment-service
  const requisitionTemplate = {
    departmentId: String(employee.departmentId),
    positionType: employee.employeeType === 'teaching' ? 'faculty' : 'staff',
    designation: employee.designation,
    justification: `Replacement for ${employee.employeeId} - ${sep.separationType}`,
    justificationType: 'replacement' as const,
    vacatedBy: String(employee._id),
    separationRequestId: String(sep._id),
  };

  return requisitionTemplate;
}

// ===========================================================================
// Special Cases (W05-L2-077)
// ===========================================================================

/** Detect upcoming retirements within given months */
export async function detectUpcomingRetirements(collegeId: string, withinMonths: number) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + withinMonths);

  const employees = await Employee.find({
    collegeId,
    status: 'active',
    superannuationDate: { $gte: now, $lte: cutoff },
  })
    .select('employeeId designation departmentId superannuationDate')
    .sort({ superannuationDate: 1 })
    .lean();

  return employees;
}

/** Detect expiring contracts within given months */
export async function detectExpiringContracts(collegeId: string, withinMonths: number) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + withinMonths);

  const employees = await Employee.find({
    collegeId,
    status: 'active',
    contractEndDate: { $gte: now, $lte: cutoff },
  })
    .select('employeeId designation departmentId contractEndDate employeeType')
    .sort({ contractEndDate: 1 })
    .lean();

  return employees;
}

/** Process contract renewal */
export async function processContractRenewal(
  collegeId: string,
  data: { employeeId: string; newContractEndDate: Date; remarks: string },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const oldContractEnd = employee.contractEndDate;
  employee.contractEndDate = new Date(data.newContractEndDate);
  await employee.save();

  await createAuditLog({
    collegeId,
    entityType: 'Employee',
    entityId: String(employee._id),
    entityName: `${employee.employeeId} - Contract Renewal`,
    action: 'update',
    changes: [
      { field: 'contractEndDate', displayName: 'Contract End Date', oldValue: oldContractEnd, newValue: data.newContractEndDate },
      { field: 'remarks', displayName: 'Renewal Remarks', oldValue: null, newValue: data.remarks },
    ],
    performedBy,
  });

  return employee;
}

// ===========================================================================
// CRUD — SeparationRequest
// ===========================================================================

export async function listSeparationRequests(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { status?: string; separationType?: string; employeeId?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.status) query.status = filter.status;
  if (filter?.separationType) query.separationType = filter.separationType;
  if (filter?.employeeId) query.employeeId = filter.employeeId;
  return paginate(SeparationRequest, query, page, limit);
}

export async function getSeparationRequest(collegeId: string, id: string) {
  const doc = await SeparationRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Separation request not found');
  return doc;
}

export async function createSeparationRequest(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await SeparationRequest.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(doc._id),
    entityName: `Separation - ${String(doc.employeeId)}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status }],
    performedBy,
  });
  return doc;
}

export async function updateSeparationRequest(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await SeparationRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Separation request not found');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const [key, val] of Object.entries(data)) {
    const oldVal = (doc as any)[key];
    if (String(oldVal) !== String(val)) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: val });
    }
    (doc as any)[key] = val;
  }
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'SeparationRequest',
      entityId: String(doc._id),
      entityName: `Separation - ${String(doc.employeeId)}`,
      action: 'update',
      changes,
      performedBy,
    });
  }
  return doc;
}

export async function deleteSeparationRequest(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await SeparationRequest.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Separation request not found');
  await createAuditLog({
    collegeId,
    entityType: 'SeparationRequest',
    entityId: String(doc._id),
    entityName: `Separation - ${String(doc.employeeId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD — ExitClearance
// ===========================================================================

export async function listExitClearances(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { overallStatus?: string; employeeId?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.overallStatus) query.overallStatus = filter.overallStatus;
  if (filter?.employeeId) query.employeeId = filter.employeeId;
  return paginate(ExitClearance, query, page, limit);
}

export async function getExitClearance(collegeId: string, id: string) {
  const doc = await ExitClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exit clearance not found');
  return doc;
}

export async function createExitClearance(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await ExitClearance.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ExitClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${String(doc.employeeId)}`,
    action: 'create',
    changes: [{ field: 'overallStatus', displayName: 'Overall Status', oldValue: null, newValue: doc.overallStatus }],
    performedBy,
  });
  return doc;
}

export async function updateExitClearance(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await ExitClearance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exit clearance not found');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const [key, val] of Object.entries(data)) {
    const oldVal = (doc as any)[key];
    if (String(oldVal) !== String(val)) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: val });
    }
    (doc as any)[key] = val;
  }
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'ExitClearance',
      entityId: String(doc._id),
      entityName: `Clearance - ${String(doc.employeeId)}`,
      action: 'update',
      changes,
      performedBy,
    });
  }
  return doc;
}

export async function deleteExitClearance(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await ExitClearance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exit clearance not found');
  await createAuditLog({
    collegeId,
    entityType: 'ExitClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${String(doc.employeeId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD — HandoverRecord
// ===========================================================================

export async function listHandoverRecords(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { overallStatus?: string; employeeId?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.overallStatus) query.overallStatus = filter.overallStatus;
  if (filter?.employeeId) query.employeeId = filter.employeeId;
  return paginate(HandoverRecord, query, page, limit);
}

export async function getHandoverRecord(collegeId: string, id: string) {
  const doc = await HandoverRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Handover record not found');
  return doc;
}

export async function createHandoverRecordCRUD(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await HandoverRecord.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'HandoverRecord',
    entityId: String(doc._id),
    entityName: `Handover - ${String(doc.employeeId)}`,
    action: 'create',
    changes: [{ field: 'overallStatus', displayName: 'Overall Status', oldValue: null, newValue: doc.overallStatus }],
    performedBy,
  });
  return doc;
}

export async function updateHandoverRecord(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await HandoverRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Handover record not found');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const [key, val] of Object.entries(data)) {
    const oldVal = (doc as any)[key];
    if (String(oldVal) !== String(val)) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: val });
    }
    (doc as any)[key] = val;
  }
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'HandoverRecord',
      entityId: String(doc._id),
      entityName: `Handover - ${String(doc.employeeId)}`,
      action: 'update',
      changes,
      performedBy,
    });
  }
  return doc;
}

export async function deleteHandoverRecord(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await HandoverRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Handover record not found');
  await createAuditLog({
    collegeId,
    entityType: 'HandoverRecord',
    entityId: String(doc._id),
    entityName: `Handover - ${String(doc.employeeId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ===========================================================================
// CRUD — FinalSettlement
// ===========================================================================

export async function listFinalSettlements(
  collegeId: string,
  page: number,
  limit: number,
  filter?: { status?: string; employeeId?: string },
) {
  const query: Record<string, unknown> = { collegeId };
  if (filter?.status) query.status = filter.status;
  if (filter?.employeeId) query.employeeId = filter.employeeId;
  return paginate(FinalSettlement, query, page, limit);
}

export async function getFinalSettlement(collegeId: string, id: string) {
  const doc = await FinalSettlement.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Final settlement not found');
  return doc;
}

export async function createFinalSettlement(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await FinalSettlement.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'FinalSettlement',
    entityId: String(doc._id),
    entityName: `Settlement - ${String(doc.employeeId)}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status }],
    performedBy,
  });
  return doc;
}

export async function updateFinalSettlement(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await FinalSettlement.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Final settlement not found');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const [key, val] of Object.entries(data)) {
    const oldVal = (doc as any)[key];
    if (String(oldVal) !== String(val)) {
      changes.push({ field: key, displayName: key, oldValue: oldVal, newValue: val });
    }
    (doc as any)[key] = val;
  }
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'FinalSettlement',
      entityId: String(doc._id),
      entityName: `Settlement - ${String(doc.employeeId)}`,
      action: 'update',
      changes,
      performedBy,
    });
  }
  return doc;
}

export async function deleteFinalSettlement(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await FinalSettlement.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Final settlement not found');
  await createAuditLog({
    collegeId,
    entityType: 'FinalSettlement',
    entityId: String(doc._id),
    entityName: `Settlement - ${String(doc.employeeId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}
