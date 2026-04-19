import mongoose from 'mongoose';
import { Student } from '../../models/people/Student';
import { ExitRequest } from '../../models/people/ExitRequest';
import { ClearanceWorkflow } from '../../models/workflow/ClearanceWorkflow';
import { ClearanceItem } from '../../models/workflow/ClearanceItem';
import { EscalationLog } from '../../models/workflow/EscalationLog';
import { ExitDocument } from '../../models/people/ExitDocument';
import { DocumentTemplate } from '../../models/people/DocumentTemplate';
import { Alumni } from '../../models/people/Alumni';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ─── Constants ──────────────────────────────────────────

const STUDENT_TRANSITIONS: Record<string, string[]> = {
  active: ['graduation_pending', 'withdrawal_pending', 'expulsion_pending', 'transfer_pending', 'year_back', 'detained', 'deceased'],
  year_back: ['active', 'withdrawal_pending'],
  detained: ['active', 'withdrawal_pending', 'expelled'],
  graduation_pending: ['graduated'],
  withdrawal_pending: ['withdrawn', 'active'],
  expulsion_pending: ['expelled', 'active'],
  transfer_pending: ['transferred', 'active'],
};

const CLEARANCE_DEPARTMENTS = [
  { department: 'finance', assigneeRole: 'accounts_officer', slaHours: 48 },
  { department: 'hostel', assigneeRole: 'hostel_warden', slaHours: 24 },
  { department: 'transport', assigneeRole: 'transport_officer', slaHours: 24 },
  { department: 'library', assigneeRole: 'librarian', slaHours: 24 },
  { department: 'lab', assigneeRole: 'lab_incharge', slaHours: 24 },
  { department: 'academic', assigneeRole: 'hod', slaHours: 48 },
  { department: 'it_platform', assigneeRole: 'it_admin', slaHours: 24 },
] as const;

const TERMINAL_STATUSES = ['graduated', 'withdrawn', 'expelled', 'transferred'];

// ─── Exit Request ───────────────────────────────────────

export async function submitExitRequest(
  collegeId: string,
  data: {
    studentId: string;
    exitType: string;
    reason: string;
    reasonCategory: string;
    reasonDetails?: string;
    requestedBy: string;
    destinationInstitution?: string;
    destinationUniversity?: string;
    disciplinaryCaseId?: string;
    dropoutRiskAlertId?: string;
    outreachExhausted?: boolean;
  },
  performedBy: string,
) {
  const student = await Student.findOne({ _id: data.studentId, collegeId });
  if (!student) throw new AppError(404, 'Student not found');

  const pendingStatus = `${data.exitType}_pending`;
  const allowed = STUDENT_TRANSITIONS[student.status];
  if (!allowed || !allowed.includes(pendingStatus)) {
    throw new AppError(400, `Cannot transition student from '${student.status}' to '${pendingStatus}'`);
  }

  const doc = await ExitRequest.create({
    collegeId,
    studentId: data.studentId,
    exitType: data.exitType,
    reason: data.reason,
    reasonCategory: data.reasonCategory,
    reasonDetails: data.reasonDetails,
    requestedBy: data.requestedBy,
    status: 'submitted',
    destinationInstitution: data.destinationInstitution,
    destinationUniversity: data.destinationUniversity,
    disciplinaryCaseId: data.disciplinaryCaseId,
    dropoutRiskAlertId: data.dropoutRiskAlertId,
    outreachExhausted: data.outreachExhausted ?? false,
  });

  student.status = pendingStatus;
  student.exitRequestId = doc._id as any;
  await student.save();

  await createAuditLog({
    collegeId, entityType: 'ExitRequest', entityId: String(doc._id),
    entityName: `${data.exitType} request`, action: 'create', changes: [], performedBy,
  });

  return doc;
}

export async function getExitRequest(collegeId: string, id: string) {
  const doc = await ExitRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exit request not found');
  return doc;
}

export async function listExitRequests(collegeId: string, page: number, limit: number, status?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(ExitRequest, filter, page, limit);
}

export async function approveExitRequest(
  collegeId: string,
  requestId: string,
  data: { approvedBy: string; notes?: string },
  performedBy: string,
) {
  const doc = await ExitRequest.findOne({ _id: requestId, collegeId });
  if (!doc) throw new AppError(404, 'Exit request not found');
  if (doc.status !== 'submitted') throw new AppError(400, 'Exit request is not in submitted status');

  doc.principalApproval = {
    approved: true,
    approvedBy: data.approvedBy as any,
    approvedAt: new Date(),
    notes: data.notes,
  };
  doc.status = 'under_review';
  await doc.save();

  // Auto-initiate clearance workflow
  const workflow = await initiateClearanceWorkflow(
    collegeId,
    { studentId: String(doc.studentId), exitType: doc.exitType, initiatedBy: data.approvedBy },
    performedBy,
  );
  doc.clearanceWorkflowId = workflow._id as any;
  doc.status = 'clearance_in_progress';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'ExitRequest', entityId: requestId,
    entityName: `${doc.exitType} request`, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: 'submitted', newValue: 'clearance_in_progress' },
    ], performedBy,
  });

  return doc;
}

export async function rejectExitRequest(
  collegeId: string,
  requestId: string,
  data: { notes: string },
  performedBy: string,
) {
  const doc = await ExitRequest.findOne({ _id: requestId, collegeId });
  if (!doc) throw new AppError(404, 'Exit request not found');

  const oldStatus = doc.status;
  doc.status = 'rejected';
  doc.principalApproval = {
    approved: false,
    approvedBy: performedBy as any,
    approvedAt: new Date(),
    notes: data.notes,
  };
  await doc.save();

  // Revert student status to active
  await Student.findOneAndUpdate(
    { _id: doc.studentId, collegeId },
    { $set: { status: 'active' }, $unset: { exitRequestId: 1 } },
  );

  await createAuditLog({
    collegeId, entityType: 'ExitRequest', entityId: requestId,
    entityName: `${doc.exitType} request`, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' },
    ], performedBy,
  });

  return doc;
}

export async function cancelExitRequest(collegeId: string, requestId: string, performedBy: string) {
  const doc = await ExitRequest.findOne({ _id: requestId, collegeId });
  if (!doc) throw new AppError(404, 'Exit request not found');

  const oldStatus = doc.status;
  doc.status = 'cancelled';
  await doc.save();

  // Revert student status to active
  await Student.findOneAndUpdate(
    { _id: doc.studentId, collegeId },
    { $set: { status: 'active' }, $unset: { exitRequestId: 1 } },
  );

  await createAuditLog({
    collegeId, entityType: 'ExitRequest', entityId: requestId,
    entityName: `${doc.exitType} request`, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
    ], performedBy,
  });

  return doc;
}

export async function getExitSummary(collegeId: string, studentId: string) {
  const exitRequest = await ExitRequest.findOne({ collegeId, studentId }).sort({ createdAt: -1 }).lean();
  if (!exitRequest) throw new AppError(404, 'No exit request found for student');

  const [clearanceWorkflow, clearanceItems, documents] = await Promise.all([
    exitRequest.clearanceWorkflowId
      ? ClearanceWorkflow.findOne({ _id: exitRequest.clearanceWorkflowId, collegeId }).lean()
      : null,
    exitRequest.clearanceWorkflowId
      ? ClearanceItem.find({ clearanceWorkflowId: exitRequest.clearanceWorkflowId, collegeId }).lean()
      : [],
    ExitDocument.find({ collegeId, studentId }).lean(),
  ]);

  return { exitRequest, clearanceWorkflow, clearanceItems, documents };
}

// ─── Student Lifecycle Transitions ──────────────────────

export async function transitionStudent(
  collegeId: string,
  studentId: string,
  newStatus: string,
  performedBy: string,
) {
  const student = await Student.findOne({ _id: studentId, collegeId });
  if (!student) throw new AppError(404, 'Student not found');

  const allowed = STUDENT_TRANSITIONS[student.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(400, `Cannot transition student from '${student.status}' to '${newStatus}'`);
  }

  const oldStatus = student.status;
  student.status = newStatus;

  if (TERMINAL_STATUSES.includes(newStatus)) {
    student.exitDate = new Date();
  }

  await student.save();

  await createAuditLog({
    collegeId, entityType: 'Student', entityId: studentId,
    entityName: 'Student', action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: newStatus },
    ], performedBy,
  });

  return student;
}

export async function checkGraduationEligibility(collegeId: string, studentId: string) {
  const student = await Student.findOne({ _id: studentId, collegeId });
  if (!student) throw new AppError(404, 'Student not found');

  const reasons: string[] = [];

  if (!student.finalCgpa || student.finalCgpa <= 0) {
    reasons.push('Final CGPA is not available or is zero');
  }
  if (student.status !== 'active' && student.status !== 'graduation_pending') {
    reasons.push(`Student status is '${student.status}', expected 'active' or 'graduation_pending'`);
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function sealStudentRecord(collegeId: string, studentId: string, performedBy: string) {
  const student = await Student.findOne({ _id: studentId, collegeId });
  if (!student) throw new AppError(404, 'Student not found');

  student.isSealed = true;
  student.sealedAt = new Date();
  student.sealedBy = performedBy;
  await student.save();

  await createAuditLog({
    collegeId, entityType: 'Student', entityId: studentId,
    entityName: 'Student', action: 'update', changes: [
      { field: 'isSealed', displayName: 'Record Sealed', oldValue: false, newValue: true },
    ], performedBy,
  });

  return student;
}

// ─── Clearance Orchestration ────────────────────────────

export async function initiateClearanceWorkflow(
  collegeId: string,
  data: { studentId: string; exitType: string; initiatedBy: string; urgency?: string },
  performedBy: string,
) {
  const workflow = await ClearanceWorkflow.create({
    collegeId,
    studentId: data.studentId,
    exitType: data.exitType,
    urgency: data.urgency || 'standard',
    status: 'initiated',
    initiatedBy: data.initiatedBy,
    totalItems: CLEARANCE_DEPARTMENTS.length,
    completedItems: 0,
  });

  const now = new Date();
  const items = CLEARANCE_DEPARTMENTS.map(dept => ({
    collegeId,
    clearanceWorkflowId: workflow._id,
    department: dept.department,
    assigneeRole: dept.assigneeRole,
    status: 'pending',
    isApplicable: true,
    slaHours: dept.slaHours,
    slaDeadline: new Date(now.getTime() + dept.slaHours * 60 * 60 * 1000),
  }));

  await ClearanceItem.insertMany(items);

  await createAuditLog({
    collegeId, entityType: 'ClearanceWorkflow', entityId: String(workflow._id),
    entityName: `Clearance for ${data.exitType}`, action: 'create', changes: [], performedBy,
  });

  return workflow;
}

export async function getClearanceWorkflow(collegeId: string, id: string) {
  const workflow = await ClearanceWorkflow.findOne({ _id: id, collegeId });
  if (!workflow) throw new AppError(404, 'Clearance workflow not found');

  const items = await ClearanceItem.find({ clearanceWorkflowId: id, collegeId }).lean();
  return { ...workflow.toObject(), items };
}

export async function listClearanceWorkflows(collegeId: string, page: number, limit: number, status?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(ClearanceWorkflow, filter, page, limit);
}

export async function completeClearanceItem(
  collegeId: string,
  itemId: string,
  data: { completedBy: string },
  performedBy: string,
) {
  const item = await ClearanceItem.findOne({ _id: itemId, collegeId });
  if (!item) throw new AppError(404, 'Clearance item not found');
  if (item.status !== 'pending' && item.status !== 'in_progress') {
    throw new AppError(400, `Clearance item is '${item.status}', cannot complete`);
  }

  item.status = 'completed';
  item.completedAt = new Date();
  item.completedBy = data.completedBy as any;
  await item.save();

  const workflow = await ClearanceWorkflow.findOne({ _id: item.clearanceWorkflowId, collegeId });
  if (workflow) {
    workflow.completedItems = (workflow.completedItems || 0) + 1;
    if (workflow.completedItems >= workflow.totalItems) {
      workflow.status = 'completed';
      workflow.completedAt = new Date();
    } else {
      workflow.status = 'in_progress';
    }
    await workflow.save();
  }

  await createAuditLog({
    collegeId, entityType: 'ClearanceItem', entityId: itemId,
    entityName: `${item.department} clearance`, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: 'pending', newValue: 'completed' },
    ], performedBy,
  });

  return item;
}

export async function waiveClearanceItem(
  collegeId: string,
  itemId: string,
  data: { waiverReason: string; waiverApprovedBy: string },
  performedBy: string,
) {
  const item = await ClearanceItem.findOne({ _id: itemId, collegeId });
  if (!item) throw new AppError(404, 'Clearance item not found');
  if (item.status !== 'pending' && item.status !== 'in_progress') {
    throw new AppError(400, `Clearance item is '${item.status}', cannot waive`);
  }

  const oldStatus = item.status;
  item.status = 'waived';
  item.waiverReason = data.waiverReason;
  item.waiverApprovedBy = data.waiverApprovedBy as any;
  item.completedAt = new Date();
  await item.save();

  const workflow = await ClearanceWorkflow.findOne({ _id: item.clearanceWorkflowId, collegeId });
  if (workflow) {
    workflow.completedItems = (workflow.completedItems || 0) + 1;
    if (workflow.completedItems >= workflow.totalItems) {
      // Check if any items were waived — if so, mark as completed_with_exceptions
      const waivedCount = await ClearanceItem.countDocuments({
        clearanceWorkflowId: workflow._id, collegeId, status: 'waived',
      });
      workflow.status = waivedCount > 0 ? 'completed_with_exceptions' : 'completed';
      workflow.completedAt = new Date();
    } else {
      workflow.status = 'in_progress';
    }
    await workflow.save();
  }

  await createAuditLog({
    collegeId, entityType: 'ClearanceItem', entityId: itemId,
    entityName: `${item.department} clearance`, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'waived' },
    ], performedBy,
  });

  return item;
}

export async function listPendingClearanceItems(
  collegeId: string,
  assigneeRole: string,
  page: number,
  limit: number,
) {
  const filter = { collegeId, assigneeRole, status: { $in: ['pending', 'in_progress'] } };
  return paginate(ClearanceItem, filter, page, limit);
}

export async function getClearanceDashboard(collegeId: string) {
  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregations actually match documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const [workflowsByStatus, itemsByDeptStatus] = await Promise.all([
    ClearanceWorkflow.aggregate([
      { $match: { collegeId: cidObj } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ClearanceItem.aggregate([
      { $match: { collegeId: cidObj } },
      { $group: { _id: { department: '$department', status: '$status' }, count: { $sum: 1 } } },
    ]),
  ]);

  const workflows: Record<string, number> = {};
  for (const row of workflowsByStatus) {
    workflows[row._id as string] = row.count as number;
  }

  const items: Record<string, Record<string, number>> = {};
  for (const row of itemsByDeptStatus) {
    const dept = (row._id as { department: string; status: string }).department;
    const status = (row._id as { department: string; status: string }).status;
    if (!items[dept]) items[dept] = {};
    items[dept][status] = row.count as number;
  }

  return { workflows, items };
}

export async function logEscalation(
  collegeId: string,
  data: {
    clearanceItemId: string;
    clearanceWorkflowId: string;
    level: string;
    escalatedTo: string;
    reason: string;
    slaPercentage: number;
  },
  _performedBy: string,
) {
  const doc = await EscalationLog.create({
    collegeId,
    clearanceItemId: data.clearanceItemId,
    clearanceWorkflowId: data.clearanceWorkflowId,
    level: data.level,
    escalatedTo: data.escalatedTo,
    reason: data.reason,
    slaPercentage: data.slaPercentage,
  });
  return doc;
}

// ─── Document Generation ────────────────────────────────

export async function listDocumentTemplates(collegeId: string, page: number, limit: number, type?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (type) filter.type = type;
  return paginate(DocumentTemplate, filter, page, limit);
}

export async function getDocumentTemplate(collegeId: string, id: string) {
  const doc = await DocumentTemplate.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Document template not found');
  return doc;
}

export async function createDocumentTemplate(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await DocumentTemplate.create({ ...data, collegeId });
  await createAuditLog({
    collegeId, entityType: 'DocumentTemplate', entityId: String(doc._id),
    entityName: doc.name, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function generateDocument(
  collegeId: string,
  data: {
    studentId: string;
    templateId?: string;
    type: string;
    title: string;
    exitRequestId?: string;
    metadata?: Record<string, unknown>;
  },
  performedBy: string,
) {
  const doc = await ExitDocument.create({
    collegeId,
    studentId: data.studentId,
    templateId: data.templateId,
    type: data.type,
    title: data.title,
    status: 'draft',
    generatedAt: new Date(),
    exitRequestId: data.exitRequestId,
    metadata: data.metadata,
    signatures: [],
  });

  await createAuditLog({
    collegeId, entityType: 'ExitDocument', entityId: String(doc._id),
    entityName: data.title, action: 'create', changes: [], performedBy,
  });

  return doc;
}

export async function signDocument(
  collegeId: string,
  documentId: string,
  data: { role: string; signedBy: string; signatureType?: string },
  performedBy: string,
) {
  const doc = await ExitDocument.findOne({ _id: documentId, collegeId });
  if (!doc) throw new AppError(404, 'Document not found');

  doc.signatures.push({
    role: data.role,
    signedBy: data.signedBy as any,
    signedAt: new Date(),
    signatureType: data.signatureType || 'digital',
  });

  // Check if all signature slots are filled (if template exists)
  if (doc.templateId) {
    const template = await DocumentTemplate.findById(doc.templateId);
    if (template && doc.signatures.length >= template.signatureSlots.length) {
      doc.status = 'signed';
      doc.signedAt = new Date();
    } else {
      doc.status = 'pending_signature';
    }
  } else {
    // No template — mark as signed after first signature
    doc.status = 'signed';
    doc.signedAt = new Date();
  }

  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'ExitDocument', entityId: documentId,
    entityName: doc.title, action: 'update', changes: [
      { field: 'signatures', displayName: 'Signature Added', oldValue: null, newValue: data.role },
    ], performedBy,
  });

  return doc;
}

export async function issueDocument(
  collegeId: string,
  documentId: string,
  data: { serialNumber?: string },
  performedBy: string,
) {
  const doc = await ExitDocument.findOne({ _id: documentId, collegeId });
  if (!doc) throw new AppError(404, 'Document not found');
  if (doc.status !== 'signed') throw new AppError(400, 'Document must be signed before issuing');

  doc.status = 'issued';
  doc.issuedAt = new Date();
  if (data.serialNumber) doc.serialNumber = data.serialNumber;
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'ExitDocument', entityId: documentId,
    entityName: doc.title, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: 'signed', newValue: 'issued' },
    ], performedBy,
  });

  return doc;
}

export async function revokeDocument(
  collegeId: string,
  documentId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await ExitDocument.findOne({ _id: documentId, collegeId });
  if (!doc) throw new AppError(404, 'Document not found');
  if (doc.status !== 'issued') throw new AppError(400, 'Only issued documents can be revoked');

  doc.status = 'revoked';
  doc.revokedAt = new Date();
  doc.revokedReason = data.reason;
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'ExitDocument', entityId: documentId,
    entityName: doc.title, action: 'update', changes: [
      { field: 'status', displayName: 'Status', oldValue: 'issued', newValue: 'revoked' },
    ], performedBy,
  });

  return doc;
}

// ─── Alumni Creation ────────────────────────────────────

export async function createAlumniRecord(
  collegeId: string,
  data: {
    personId: string;
    studentId: string;
    programmeId: string;
    branchId: string;
    batchId?: string;
    regulationId?: string;
    graduationDate: Date;
    degreeAwarded: string;
    finalCgpa: number;
    classObtained: string;
  },
  performedBy: string,
) {
  const doc = await Alumni.create({
    collegeId,
    personId: data.personId,
    studentId: data.studentId,
    programmeId: data.programmeId,
    branchId: data.branchId,
    batchId: data.batchId,
    regulationId: data.regulationId,
    graduationDate: data.graduationDate,
    degreeAwarded: data.degreeAwarded,
    finalCgpa: data.finalCgpa,
    classObtained: data.classObtained,
  });

  // Link alumni record to student
  await Student.findOneAndUpdate(
    { _id: data.studentId, collegeId },
    { $set: { alumniId: doc._id } },
  );

  await createAuditLog({
    collegeId, entityType: 'Alumni', entityId: String(doc._id),
    entityName: data.degreeAwarded, action: 'create', changes: [], performedBy,
  });

  return doc;
}

export async function getAlumni(collegeId: string, id: string) {
  const doc = await Alumni.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Alumni record not found');
  return doc;
}

export async function listAlumni(collegeId: string, page: number, limit: number, programmeId?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (programmeId) filter.programmeId = programmeId;
  return paginate(Alumni, filter, page, limit);
}
