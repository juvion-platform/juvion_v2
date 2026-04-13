import { HiringRequisition } from '../../models/hr/HiringRequisition';
import { SelectionCommittee } from '../../models/hr/SelectionCommittee';
import { AppointmentOrder } from '../../models/hr/AppointmentOrder';
import { Recruitment } from '../../models/hr/Recruitment';
import { JobApplication } from '../../models/hr/JobApplication';
import { Employee } from '../../models/hr/Employee';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ---------------------------------------------------------------------------
// Hiring Requisition — Workflow (W05-L2-001 to 003)
// ---------------------------------------------------------------------------

/** W05-L2-001: Submit a new hiring requisition */
export async function submitHiringRequisition(
  collegeId: string,
  data: {
    departmentId: string;
    positionType: 'faculty' | 'staff';
    designation: string;
    justification: string;
    justificationType: 'new' | 'replacement';
    vacatedBy?: string;
  },
  performedBy: string,
) {
  // Auto-count current headcount for the department
  const headcountAtRequest = await Employee.countDocuments({
    collegeId,
    departmentId: data.departmentId,
    status: 'active',
  });

  const doc = await HiringRequisition.create({
    collegeId,
    ...data,
    headcountAtRequest,
    status: 'submitted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(doc._id),
    entityName: `${data.positionType} - ${data.designation}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'submitted' }],
    performedBy,
  });

  return doc;
}

/** W05-L2-002: Validate requisition against sanctioned strength */
export async function validateRequisitionStrength(
  collegeId: string,
  requisitionId: string,
  performedBy: string,
) {
  const req = await HiringRequisition.findOne({ _id: requisitionId, collegeId });
  if (!req) throw new AppError(404, 'Hiring requisition not found');
  if (req.status !== 'submitted') throw new AppError(400, 'Requisition must be in submitted status to validate');

  // Stub: configurable sanctioned strength threshold
  const SANCTIONED_STRENGTH_THRESHOLD = 50;
  const currentCount = await Employee.countDocuments({
    collegeId,
    departmentId: req.departmentId,
    status: 'active',
  });

  const withinSanctioned = currentCount < SANCTIONED_STRENGTH_THRESHOLD;
  const oldStatus = req.status;

  req.withinSanctionedStrength = withinSanctioned;
  req.status = 'validated';
  await req.save();

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(req._id),
    entityName: `${req.positionType} - ${req.designation}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'validated' },
      { field: 'withinSanctionedStrength', displayName: 'Within Sanctioned Strength', oldValue: false, newValue: withinSanctioned },
    ],
    performedBy,
  });

  return req;
}

/** W05-L2-003: Approve requisition at current level */
export async function approveRequisition(
  collegeId: string,
  requisitionId: string,
  approverId: string,
  remarks: string,
  performedBy: string,
) {
  const req = await HiringRequisition.findOne({ _id: requisitionId, collegeId });
  if (!req) throw new AppError(404, 'Hiring requisition not found');
  if (req.status !== 'validated' && req.status !== 'submitted') {
    throw new AppError(400, 'Requisition must be in validated or submitted status to approve');
  }

  const currentLevel = req.currentApproverLevel;
  const step = req.approvalChain.find(s => s.level === currentLevel);

  if (step) {
    step.status = 'approved';
    step.decidedAt = new Date();
    step.remarks = remarks;
  } else {
    // No chain configured — add an ad-hoc approval step
    req.approvalChain.push({
      level: currentLevel,
      approverId,
      status: 'approved',
      decidedAt: new Date(),
      remarks,
    });
  }

  // Check if there are more levels
  const nextStep = req.approvalChain.find(s => s.level > currentLevel && s.status === 'pending');
  if (nextStep) {
    req.currentApproverLevel = nextStep.level;
  } else {
    // Final approval
    req.status = 'approved';
    req.approvedBy = approverId as any;
    req.approvedAt = new Date();
  }

  await req.save();

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(req._id),
    entityName: `${req.positionType} - ${req.designation}`,
    action: 'update',
    changes: [
      { field: 'approvalChain', displayName: 'Approval Chain', oldValue: null, newValue: `Level ${currentLevel} approved` },
      { field: 'status', displayName: 'Status', oldValue: 'validated', newValue: req.status },
    ],
    performedBy,
  });

  return req;
}

/** Reject a requisition */
export async function rejectRequisition(
  collegeId: string,
  requisitionId: string,
  approverId: string,
  remarks: string,
  performedBy: string,
) {
  const req = await HiringRequisition.findOne({ _id: requisitionId, collegeId });
  if (!req) throw new AppError(404, 'Hiring requisition not found');
  if (req.status === 'approved' || req.status === 'rejected' || req.status === 'cancelled') {
    throw new AppError(400, `Cannot reject a requisition with status '${req.status}'`);
  }

  const oldStatus = req.status;
  const currentLevel = req.currentApproverLevel;
  const step = req.approvalChain.find(s => s.level === currentLevel);

  if (step) {
    step.status = 'rejected';
    step.decidedAt = new Date();
    step.remarks = remarks;
  } else {
    req.approvalChain.push({
      level: currentLevel,
      approverId,
      status: 'rejected',
      decidedAt: new Date(),
      remarks,
    });
  }

  req.status = 'rejected';
  await req.save();

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(req._id),
    entityName: `${req.positionType} - ${req.designation}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' },
      { field: 'approvalChain', displayName: 'Approval Chain', oldValue: null, newValue: `Level ${currentLevel} rejected: ${remarks}` },
    ],
    performedBy,
  });

  return req;
}

// ---------------------------------------------------------------------------
// Selection Committee — Workflow (W05-L2-004/005)
// ---------------------------------------------------------------------------

/** W05-L2-004: Constitute AICTE-compliant faculty selection committee */
export async function constituteFacultyCommittee(
  collegeId: string,
  data: {
    requisitionId: string;
    recruitmentId?: string;
    members: { personId: string; role: string; isExternal: boolean; isAICTENominee: boolean; isSCSTRep: boolean }[];
  },
  performedBy: string,
) {
  // Validate AICTE compliance for faculty selection
  const hasExternal = data.members.some(m => m.isExternal);
  if (!hasExternal) throw new AppError(400, 'Faculty committee must have at least 1 external member');

  const hasAICTENominee = data.members.some(m => m.isAICTENominee);
  if (!hasAICTENominee) throw new AppError(400, 'Faculty committee must have at least 1 AICTE nominee');

  const hasSCSTRep = data.members.some(m => m.isSCSTRep);
  if (!hasSCSTRep) throw new AppError(400, 'Faculty committee must have at least 1 SC/ST representative');

  const doc = await SelectionCommittee.create({
    collegeId,
    requisitionId: data.requisitionId,
    recruitmentId: data.recruitmentId,
    committeeType: 'aicte_faculty',
    members: data.members,
    status: 'constituted',
    constitutedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'SelectionCommittee',
    entityId: String(doc._id),
    entityName: `Faculty Committee for Requisition ${data.requisitionId}`,
    action: 'create',
    changes: [
      { field: 'committeeType', displayName: 'Committee Type', oldValue: null, newValue: 'aicte_faculty' },
      { field: 'members', displayName: 'Members', oldValue: null, newValue: `${data.members.length} members` },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-005: Constitute internal staff selection committee */
export async function constituteStaffCommittee(
  collegeId: string,
  data: {
    requisitionId: string;
    recruitmentId?: string;
    members: { personId: string; role: string; isExternal: boolean; isAICTENominee: boolean; isSCSTRep: boolean }[];
  },
  performedBy: string,
) {
  // Simpler validation for staff — just need at least 2 members
  if (data.members.length < 2) throw new AppError(400, 'Staff committee must have at least 2 members');

  const doc = await SelectionCommittee.create({
    collegeId,
    requisitionId: data.requisitionId,
    recruitmentId: data.recruitmentId,
    committeeType: 'internal_staff',
    members: data.members,
    status: 'constituted',
    constitutedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'SelectionCommittee',
    entityId: String(doc._id),
    entityName: `Staff Committee for Requisition ${data.requisitionId}`,
    action: 'create',
    changes: [
      { field: 'committeeType', displayName: 'Committee Type', oldValue: null, newValue: 'internal_staff' },
      { field: 'members', displayName: 'Members', oldValue: null, newValue: `${data.members.length} members` },
    ],
    performedBy,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Application Screening — Workflow (W05-L2-006)
// ---------------------------------------------------------------------------

/** W05-L2-006: Screen all pending applications for a recruitment */
export async function screenApplications(
  collegeId: string,
  recruitmentId: string,
  performedBy: string,
) {
  const recruitment = await Recruitment.findOne({ _id: recruitmentId, collegeId });
  if (!recruitment) throw new AppError(404, 'Recruitment not found');

  const applications = await JobApplication.find({
    collegeId,
    recruitmentId,
    status: 'applied',
  });

  if (applications.length === 0) throw new AppError(400, 'No pending applications to screen');

  const screened: string[] = [];
  const shortlisted: string[] = [];
  const rejected: string[] = [];

  // Shortlist top N (stub: top 50% by score, minimum 1)
  const shortlistCount = Math.max(1, Math.ceil(applications.length * 0.5));

  // Score and sort applications
  const scored = applications.map(app => {
    // Basic AI screening score computation (stub)
    let score = 50; // base score

    // Experience match bonus
    if (app.experience) {
      const expYears = app.experience;
      if (expYears >= 5) score += 30;
      else if (expYears >= 3) score += 20;
      else if (expYears >= 1) score += 10;
    }

    // Qualification details bonus
    if (app.qualificationDetails) score += 15;

    // Has resume bonus
    if (app.resumeUrl) score += 5;

    // Cap at 100
    score = Math.min(100, score);

    const rationale = `Experience: ${app.experience ?? 0}yrs, Resume: ${app.resumeUrl ? 'yes' : 'no'}, Qualifications: ${app.qualificationDetails ? 'provided' : 'missing'}`;

    return { app, score, rationale };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  for (let i = 0; i < scored.length; i++) {
    const { app, score, rationale } = scored[i]!;
    app.aiScreeningScore = score;
    app.aiScreeningRationale = rationale;

    if (i < shortlistCount) {
      app.status = 'shortlisted';
      shortlisted.push(String(app._id));
    } else {
      app.status = 'rejected';
      rejected.push(String(app._id));
    }
    screened.push(String(app._id));
    await app.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'Recruitment',
    entityId: recruitmentId,
    entityName: recruitment.position,
    action: 'update',
    changes: [
      { field: 'screening', displayName: 'Application Screening', oldValue: null, newValue: `Screened ${screened.length}, Shortlisted ${shortlisted.length}, Rejected ${rejected.length}` },
    ],
    performedBy,
  });

  return { screened: screened.length, shortlisted: shortlisted.length, rejected: rejected.length };
}

// ---------------------------------------------------------------------------
// Selection Process — Workflow (W05-L2-007/008)
// ---------------------------------------------------------------------------

/** W05-L2-007: Record interview and demo lecture scores */
export async function recordInterviewScores(
  collegeId: string,
  jobApplicationId: string,
  scores: { panelMemberId: string; score: number; remarks: string }[],
  demoLectureScore: number | undefined,
  performedBy: string,
) {
  const app = await JobApplication.findOne({ _id: jobApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Job application not found');

  app.interviewScores = scores;
  if (demoLectureScore !== undefined) {
    app.demoLectureScore = demoLectureScore;
  }
  app.status = 'interview';
  await app.save();

  await createAuditLog({
    collegeId,
    entityType: 'JobApplication',
    entityId: String(app._id),
    entityName: app.applicantName,
    action: 'update',
    changes: [
      { field: 'interviewScores', displayName: 'Interview Scores', oldValue: null, newValue: `${scores.length} panel scores recorded` },
      ...(demoLectureScore !== undefined
        ? [{ field: 'demoLectureScore', displayName: 'Demo Lecture Score', oldValue: null as unknown, newValue: demoLectureScore as unknown }]
        : []),
    ],
    performedBy,
  });

  return app;
}

/** W05-L2-008: Rank candidates for a recruitment */
export async function rankCandidates(
  collegeId: string,
  recruitmentId: string,
  performedBy: string,
) {
  const recruitment = await Recruitment.findOne({ _id: recruitmentId, collegeId });
  if (!recruitment) throw new AppError(404, 'Recruitment not found');

  const isFaculty = recruitment.positionType === 'faculty';

  // Get all interviewed applications
  const applications = await JobApplication.find({
    collegeId,
    recruitmentId,
    status: 'interview',
    interviewScores: { $exists: true, $ne: [] },
  });

  if (applications.length === 0) throw new AppError(400, 'No interviewed candidates to rank');

  // Compute composite scores
  const ranked = applications.map(app => {
    // Average interview score
    const interviewScores = app.interviewScores ?? [];
    const avgInterview = interviewScores.length > 0
      ? interviewScores.reduce((sum, s) => sum + s.score, 0) / interviewScores.length
      : 0;

    let compositeScore: number;
    if (isFaculty) {
      // Faculty: interview 60%, demo 40%
      const demoScore = app.demoLectureScore ?? 0;
      compositeScore = avgInterview * 0.6 + demoScore * 0.4;
    } else {
      // Staff: interview 100%
      compositeScore = avgInterview;
    }

    return { app, compositeScore };
  });

  // Sort by composite score descending
  ranked.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign ranks
  const rankedList: { applicationId: string; applicantName: string; rank: number; compositeScore: number }[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const item = ranked[i]!;
    item.app.overallRank = i + 1;
    await item.app.save();
    rankedList.push({
      applicationId: String(item.app._id),
      applicantName: item.app.applicantName,
      rank: i + 1,
      compositeScore: Math.round(item.compositeScore * 100) / 100,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'Recruitment',
    entityId: recruitmentId,
    entityName: recruitment.position,
    action: 'update',
    changes: [
      { field: 'ranking', displayName: 'Candidate Ranking', oldValue: null, newValue: `${rankedList.length} candidates ranked` },
    ],
    performedBy,
  });

  return rankedList;
}

// ---------------------------------------------------------------------------
// Appointment — Workflow (W05-L2-009 to 011)
// ---------------------------------------------------------------------------

/** W05-L2-009: Draft an appointment order */
export async function draftAppointmentOrder(
  collegeId: string,
  data: {
    recruitmentId: string;
    jobApplicationId: string;
    candidateName: string;
    designation: string;
    departmentId: string;
    salaryDetails: { basic: number; hra: number; da: number; totalCTC: number };
    probationMonths: number;
    noticePeriodDays: number;
    contractType: 'permanent' | 'contract' | 'adhoc';
    contractEndDate?: string;
    reportingToId?: string;
    joiningDate: string;
    acceptanceDeadline?: string;
  },
  performedBy: string,
) {
  const doc = await AppointmentOrder.create({
    collegeId,
    recruitmentId: data.recruitmentId,
    jobApplicationId: data.jobApplicationId,
    candidateName: data.candidateName,
    designation: data.designation,
    departmentId: data.departmentId,
    salaryDetails: data.salaryDetails,
    probationMonths: data.probationMonths,
    noticePeriodDays: data.noticePeriodDays,
    contractType: data.contractType,
    contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : undefined,
    reportingToId: data.reportingToId,
    joiningDate: new Date(data.joiningDate),
    acceptanceDeadline: data.acceptanceDeadline ? new Date(data.acceptanceDeadline) : undefined,
    status: 'draft',
  });

  // Link appointment order to job application
  await JobApplication.updateOne(
    { _id: data.jobApplicationId, collegeId },
    { appointmentOrderId: doc._id },
  );

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(doc._id),
    entityName: `${data.candidateName} - ${data.designation}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'draft' },
      { field: 'contractType', displayName: 'Contract Type', oldValue: null, newValue: data.contractType },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-010: Approve an appointment order */
export async function approveAppointmentOrder(
  collegeId: string,
  appointmentOrderId: string,
  performedBy: string,
) {
  const order = await AppointmentOrder.findOne({ _id: appointmentOrderId, collegeId });
  if (!order) throw new AppError(404, 'Appointment order not found');
  if (order.status !== 'draft') throw new AppError(400, 'Only draft orders can be approved');

  const oldStatus = order.status;
  order.status = 'approved';
  await order.save();

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(order._id),
    entityName: `${order.candidateName} - ${order.designation}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' }],
    performedBy,
  });

  return order;
}

/** Issue an approved appointment order */
export async function issueAppointmentOrder(
  collegeId: string,
  appointmentOrderId: string,
  performedBy: string,
) {
  const order = await AppointmentOrder.findOne({ _id: appointmentOrderId, collegeId });
  if (!order) throw new AppError(404, 'Appointment order not found');
  if (order.status !== 'approved') throw new AppError(400, 'Only approved orders can be issued');

  const oldStatus = order.status;
  order.status = 'issued';
  order.issuedAt = new Date();
  await order.save();

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(order._id),
    entityName: `${order.candidateName} - ${order.designation}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'issued' },
      { field: 'issuedAt', displayName: 'Issued At', oldValue: null, newValue: order.issuedAt },
    ],
    performedBy,
  });

  return order;
}

/** W05-L2-011: Process candidate acceptance */
export async function processAcceptance(
  collegeId: string,
  appointmentOrderId: string,
  performedBy: string,
) {
  const order = await AppointmentOrder.findOne({ _id: appointmentOrderId, collegeId });
  if (!order) throw new AppError(404, 'Appointment order not found');
  if (order.status !== 'issued') throw new AppError(400, 'Only issued orders can be accepted');

  const oldStatus = order.status;
  order.status = 'accepted';
  order.acceptedAt = new Date();
  await order.save();

  // Mark job application as selected
  await JobApplication.updateOne(
    { _id: order.jobApplicationId, collegeId },
    { status: 'selected' },
  );

  // Trigger onboarding
  const onboardingResult = await triggerOnboarding(collegeId, appointmentOrderId, performedBy);

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(order._id),
    entityName: `${order.candidateName} - ${order.designation}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'accepted' },
      { field: 'acceptedAt', displayName: 'Accepted At', oldValue: null, newValue: order.acceptedAt },
    ],
    performedBy,
  });

  return { order, onboarding: onboardingResult };
}

/** Process candidate decline */
export async function processDecline(
  collegeId: string,
  appointmentOrderId: string,
  performedBy: string,
) {
  const order = await AppointmentOrder.findOne({ _id: appointmentOrderId, collegeId });
  if (!order) throw new AppError(404, 'Appointment order not found');
  if (order.status !== 'issued') throw new AppError(400, 'Only issued orders can be declined');

  const oldStatus = order.status;
  order.status = 'declined';
  order.declinedAt = new Date();
  await order.save();

  // Check if there is a next-ranked candidate for the same recruitment
  const currentApp = await JobApplication.findOne({ _id: order.jobApplicationId, collegeId });
  let nextCandidate: { applicationId: string; applicantName: string; rank: number } | null = null;

  if (currentApp?.overallRank) {
    const nextApp = await JobApplication.findOne({
      collegeId,
      recruitmentId: order.recruitmentId,
      overallRank: currentApp.overallRank + 1,
      status: { $in: ['interview', 'shortlisted'] },
    });
    if (nextApp) {
      nextCandidate = {
        applicationId: String(nextApp._id),
        applicantName: nextApp.applicantName,
        rank: nextApp.overallRank ?? 0,
      };
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(order._id),
    entityName: `${order.candidateName} - ${order.designation}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'declined' },
      { field: 'declinedAt', displayName: 'Declined At', oldValue: null, newValue: order.declinedAt },
    ],
    performedBy,
  });

  return { order, nextCandidate };
}

// ---------------------------------------------------------------------------
// Onboarding Triggers — Workflow (W05-L2-012 to 016)
// ---------------------------------------------------------------------------

/** W05-L2-012/013: Trigger onboarding (stub — will wire to M02/M12) */
export async function triggerOnboarding(
  collegeId: string,
  appointmentOrderId: string,
  performedBy: string,
) {
  const order = await AppointmentOrder.findOne({ _id: appointmentOrderId, collegeId });
  if (!order) throw new AppError(404, 'Appointment order not found');

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(order._id),
    entityName: `${order.candidateName} - ${order.designation}`,
    action: 'update',
    changes: [
      { field: 'onboarding', displayName: 'Onboarding', oldValue: null, newValue: 'Triggered' },
    ],
    performedBy,
  });

  // Stub: will wire to M02 (People) and M12 (Platform) later
  return { identityCreated: true, accountProvisioned: true };
}

/** W05-L2-014: Conduct induction — marks employee induction as completed */
export async function conductInduction(
  collegeId: string,
  employeeId: string,
  performedBy: string,
) {
  const emp = await Employee.findOne({ _id: employeeId, collegeId });
  if (!emp) throw new AppError(404, 'Employee not found');

  emp.inductionCompleted = true;
  emp.inductionCompletedAt = new Date();
  await emp.save();

  await createAuditLog({
    collegeId,
    entityType: 'Employee',
    entityId: String(emp._id),
    entityName: emp.employeeId,
    action: 'update',
    changes: [
      { field: 'inductionCompleted', displayName: 'Induction Completed', oldValue: false, newValue: true },
      { field: 'inductionCompletedAt', displayName: 'Induction Completed At', oldValue: null, newValue: emp.inductionCompletedAt },
    ],
    performedBy,
  });

  return emp;
}

/** W05-L2-015: Assign faculty course load (stub — will wire to M03 Academics) */
export async function assignFacultyCourseLoad(
  collegeId: string,
  employeeId: string,
  _courseIds: string[],
  performedBy: string,
) {
  const emp = await Employee.findOne({ _id: employeeId, collegeId });
  if (!emp) throw new AppError(404, 'Employee not found');

  await createAuditLog({
    collegeId,
    entityType: 'Employee',
    entityId: String(emp._id),
    entityName: emp.employeeId,
    action: 'update',
    changes: [
      { field: 'courseLoad', displayName: 'Course Load', oldValue: null, newValue: `${_courseIds.length} courses assigned (stub)` },
    ],
    performedBy,
  });

  // Stub: will wire to M03 later
  return { assigned: true, courseCount: _courseIds.length };
}

/** W05-L2-016: Link advisory roles (stub — will wire to M09 Student Dev) */
export async function linkAdvisoryRoles(
  collegeId: string,
  employeeId: string,
  _roleIds: string[],
  performedBy: string,
) {
  const emp = await Employee.findOne({ _id: employeeId, collegeId });
  if (!emp) throw new AppError(404, 'Employee not found');

  await createAuditLog({
    collegeId,
    entityType: 'Employee',
    entityId: String(emp._id),
    entityName: emp.employeeId,
    action: 'update',
    changes: [
      { field: 'advisoryRoles', displayName: 'Advisory Roles', oldValue: null, newValue: `${_roleIds.length} roles linked (stub)` },
    ],
    performedBy,
  });

  // Stub: will wire to M09 later
  return { linked: true, roleCount: _roleIds.length };
}

// ---------------------------------------------------------------------------
// Standard CRUD — HiringRequisition
// ---------------------------------------------------------------------------

export async function listHiringRequisitions(
  collegeId: string,
  page = 1,
  limit = 20,
  filter: Record<string, unknown> = {},
) {
  return paginate(HiringRequisition, { collegeId, ...filter }, page, limit);
}

export async function getHiringRequisition(collegeId: string, id: string) {
  const doc = await HiringRequisition.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hiring requisition not found');
  return doc;
}

export async function createHiringRequisition(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await HiringRequisition.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(doc._id),
    entityName: `${doc.positionType} - ${doc.designation}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status }],
    performedBy,
  });

  return doc;
}

export async function updateHiringRequisition(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await HiringRequisition.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hiring requisition not found');

  const changes = Object.entries(data).map(([field, newValue]) => ({
    field,
    displayName: field.charAt(0).toUpperCase() + field.slice(1),
    oldValue: (doc as any)[field],
    newValue,
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(doc._id),
    entityName: `${doc.positionType} - ${doc.designation}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteHiringRequisition(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await HiringRequisition.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hiring requisition not found');

  await HiringRequisition.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'HiringRequisition',
    entityId: String(doc._id),
    entityName: `${doc.positionType} - ${doc.designation}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Standard CRUD — SelectionCommittee
// ---------------------------------------------------------------------------

export async function listSelectionCommittees(
  collegeId: string,
  page = 1,
  limit = 20,
  filter: Record<string, unknown> = {},
) {
  return paginate(SelectionCommittee, { collegeId, ...filter }, page, limit);
}

export async function getSelectionCommittee(collegeId: string, id: string) {
  const doc = await SelectionCommittee.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Selection committee not found');
  return doc;
}

export async function createSelectionCommittee(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await SelectionCommittee.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'SelectionCommittee',
    entityId: String(doc._id),
    entityName: `${doc.committeeType} committee`,
    action: 'create',
    changes: [{ field: 'committeeType', displayName: 'Committee Type', oldValue: null, newValue: doc.committeeType }],
    performedBy,
  });

  return doc;
}

export async function updateSelectionCommittee(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await SelectionCommittee.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Selection committee not found');

  const changes = Object.entries(data).map(([field, newValue]) => ({
    field,
    displayName: field.charAt(0).toUpperCase() + field.slice(1),
    oldValue: (doc as any)[field],
    newValue,
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'SelectionCommittee',
    entityId: String(doc._id),
    entityName: `${doc.committeeType} committee`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteSelectionCommittee(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await SelectionCommittee.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Selection committee not found');

  await SelectionCommittee.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'SelectionCommittee',
    entityId: String(doc._id),
    entityName: `${doc.committeeType} committee`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Standard CRUD — AppointmentOrder
// ---------------------------------------------------------------------------

export async function listAppointmentOrders(
  collegeId: string,
  page = 1,
  limit = 20,
  filter: Record<string, unknown> = {},
) {
  return paginate(AppointmentOrder, { collegeId, ...filter }, page, limit);
}

export async function getAppointmentOrder(collegeId: string, id: string) {
  const doc = await AppointmentOrder.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Appointment order not found');
  return doc;
}

export async function createAppointmentOrder(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await AppointmentOrder.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(doc._id),
    entityName: `${doc.candidateName} - ${doc.designation}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status }],
    performedBy,
  });

  return doc;
}

export async function updateAppointmentOrder(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await AppointmentOrder.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Appointment order not found');

  const changes = Object.entries(data).map(([field, newValue]) => ({
    field,
    displayName: field.charAt(0).toUpperCase() + field.slice(1),
    oldValue: (doc as any)[field],
    newValue,
  }));

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(doc._id),
    entityName: `${doc.candidateName} - ${doc.designation}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

export async function deleteAppointmentOrder(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await AppointmentOrder.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Appointment order not found');

  await AppointmentOrder.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'AppointmentOrder',
    entityId: String(doc._id),
    entityName: `${doc.candidateName} - ${doc.designation}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}
