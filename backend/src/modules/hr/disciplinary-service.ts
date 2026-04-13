import { DisciplinaryCase } from '../../models/hr/DisciplinaryCase';
import { DisciplinaryOutcome } from '../../models/hr/DisciplinaryOutcome';
import { Employee } from '../../models/hr/Employee';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ===========================================================================
// Helpers
// ===========================================================================

async function generateCaseNumber(collegeId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DISC-${year}-`;
  const last = await DisciplinaryCase.findOne(
    { collegeId, caseNumber: { $regex: `^${prefix}` } },
    { caseNumber: 1 },
    { sort: { caseNumber: -1 } },
  ).lean();

  let seq = 1;
  if (last) {
    const parts = last.caseNumber.split('-');
    const lastSeq = parseInt(parts[2]!, 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function addTimeline(
  doc: InstanceType<typeof DisciplinaryCase>,
  action: string,
  performedBy: string,
  remarks?: string,
) {
  doc.timeline.push({
    action,
    date: new Date(),
    remarks,
    performedBy: performedBy as any,
  });
}

// ===========================================================================
// Case Management (W05-L2-067 to W05-L2-068)
// ===========================================================================

/** W05-L2-067: Initiate a disciplinary case from internal report */
export async function initiateCaseInternal(
  collegeId: string,
  data: {
    employeeId: string;
    allegation: string;
    evidence: string[];
    investigatingAuthorityId?: string;
  },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const caseNumber = await generateCaseNumber(collegeId);

  const doc = await DisciplinaryCase.create({
    collegeId,
    employeeId: data.employeeId,
    caseNumber,
    origin: 'internal',
    allegation: data.allegation,
    evidence: data.evidence,
    investigatingAuthorityId: data.investigatingAuthorityId,
    status: 'under_investigation',
    timeline: [
      {
        action: 'Case initiated',
        date: new Date(),
        remarks: 'Internal disciplinary case opened',
        performedBy,
      },
    ],
  });

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: `${caseNumber} - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'under_investigation' },
      { field: 'origin', displayName: 'Origin', oldValue: null, newValue: 'internal' },
      { field: 'allegation', displayName: 'Allegation', oldValue: null, newValue: data.allegation },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-067: Receive a disciplinary referral from external source (e.g. ICC, ARC) */
export async function receiveDisciplinaryReferral(
  collegeId: string,
  data: {
    employeeId: string;
    referralSource: 'm06_icc' | 'm06_arc' | 'other';
    referralDetails?: string;
    allegation: string;
    evidence: string[];
  },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const caseNumber = await generateCaseNumber(collegeId);

  const doc = await DisciplinaryCase.create({
    collegeId,
    employeeId: data.employeeId,
    caseNumber,
    origin: 'external_referral',
    referralSource: data.referralSource,
    referralDetails: data.referralDetails,
    allegation: data.allegation,
    evidence: data.evidence,
    status: 'under_investigation',
    timeline: [
      {
        action: 'Referral received',
        date: new Date(),
        remarks: `External referral from ${data.referralSource}`,
        performedBy,
      },
    ],
  });

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: `${caseNumber} - ${employee.employeeId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'under_investigation' },
      { field: 'origin', displayName: 'Origin', oldValue: null, newValue: 'external_referral' },
      { field: 'referralSource', displayName: 'Referral Source', oldValue: null, newValue: data.referralSource },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-068: Update investigation findings */
export async function updateInvestigation(
  collegeId: string,
  caseId: string,
  data: { investigationFindings: string; investigatingAuthorityId?: string },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldFindings = doc.investigationFindings ?? null;
  const oldAuthorityId = doc.investigatingAuthorityId ? String(doc.investigatingAuthorityId) : null;

  doc.investigationFindings = data.investigationFindings;
  if (data.investigatingAuthorityId) {
    doc.investigatingAuthorityId = data.investigatingAuthorityId as any;
  }

  addTimeline(doc, 'Investigation updated', performedBy, 'Investigation findings recorded');
  await doc.save();

  const changes: { field: string; displayName: string; oldValue: any; newValue: any }[] = [
    { field: 'investigationFindings', displayName: 'Investigation Findings', oldValue: oldFindings, newValue: data.investigationFindings },
  ];
  if (data.investigatingAuthorityId) {
    changes.push({
      field: 'investigatingAuthorityId',
      displayName: 'Investigating Authority',
      oldValue: oldAuthorityId,
      newValue: data.investigatingAuthorityId,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

/** W05-L2-068: Close case due to insufficient evidence */
export async function closeInsufficientEvidence(
  collegeId: string,
  caseId: string,
  data: { remarks: string },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldStatus = doc.status;

  doc.status = 'insufficient_evidence';
  addTimeline(doc, 'Closed - insufficient evidence', performedBy, data.remarks);
  await doc.save();

  // Transition to closed
  doc.status = 'closed';
  addTimeline(doc, 'Case closed', performedBy, 'Case closed after insufficient evidence determination');
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Show Cause & Hearing (W05-L2-069 to W05-L2-070)
// ===========================================================================

/** W05-L2-069: Issue show cause notice */
export async function issueShowCause(
  collegeId: string,
  caseId: string,
  data: { showCauseNoticeUrl: string; responseDeadlineDays?: number },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldStatus = doc.status;
  const now = new Date();
  const deadlineDays = data.responseDeadlineDays ?? 15;
  const responseDeadline = new Date(now);
  responseDeadline.setDate(responseDeadline.getDate() + deadlineDays);

  doc.showCauseNoticeUrl = data.showCauseNoticeUrl;
  doc.showCauseIssuedAt = now;
  doc.responseDeadline = responseDeadline;
  doc.status = 'show_cause';

  addTimeline(doc, 'Show cause notice issued', performedBy, `Response deadline: ${deadlineDays} days`);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'show_cause' },
      { field: 'showCauseIssuedAt', displayName: 'Show Cause Issued At', oldValue: null, newValue: now },
      { field: 'responseDeadline', displayName: 'Response Deadline', oldValue: null, newValue: responseDeadline },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-069: Record employee response to show cause */
export async function recordResponse(
  collegeId: string,
  caseId: string,
  data: { responseText: string },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldStatus = doc.status;
  const now = new Date();

  doc.responseReceivedAt = now;
  doc.responseText = data.responseText;
  doc.status = 'awaiting_response';

  addTimeline(doc, 'Response received', performedBy, 'Employee response to show cause recorded');
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'awaiting_response' },
      { field: 'responseReceivedAt', displayName: 'Response Received At', oldValue: null, newValue: now },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-070: Record hearing details */
export async function recordHearing(
  collegeId: string,
  caseId: string,
  data: { hearingDate: Date; hearingMinutesUrl: string },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldStatus = doc.status;

  doc.hearingDate = new Date(data.hearingDate);
  doc.hearingMinutesUrl = data.hearingMinutesUrl;
  doc.status = 'hearing';

  addTimeline(doc, 'Hearing recorded', performedBy, `Hearing held on ${doc.hearingDate.toISOString().split('T')[0]}`);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'hearing' },
      { field: 'hearingDate', displayName: 'Hearing Date', oldValue: null, newValue: doc.hearingDate },
      { field: 'hearingMinutesUrl', displayName: 'Hearing Minutes URL', oldValue: null, newValue: data.hearingMinutesUrl },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Outcome & Implementation (W05-L2-071 to W05-L2-072)
// ===========================================================================

/** W05-L2-071: Decide outcome of disciplinary case */
export async function decideOutcome(
  collegeId: string,
  caseId: string,
  data: { outcome: 'warning' | 'fine' | 'suspension' | 'demotion' | 'termination' | 'exonerated'; outcomeDetails?: string },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldStatus = doc.status;
  const now = new Date();
  const appealDeadline = new Date(now);
  appealDeadline.setDate(appealDeadline.getDate() + 30);

  doc.outcome = data.outcome;
  doc.outcomeDetails = data.outcomeDetails;
  doc.status = 'decided';
  doc.appealDeadline = appealDeadline;

  addTimeline(doc, 'Outcome decided', performedBy, `Outcome: ${data.outcome}`);
  await doc.save();

  // Create DisciplinaryOutcome record (only for actionable outcomes)
  let outcomeDoc = null;
  if (data.outcome !== 'exonerated') {
    outcomeDoc = await DisciplinaryOutcome.create({
      collegeId,
      disciplinaryCaseId: doc._id,
      employeeId: doc.employeeId,
      outcomeType: data.outcome,
      details: {},
      status: 'decided',
    });

    await createAuditLog({
      collegeId,
      entityType: 'DisciplinaryOutcome',
      entityId: String(outcomeDoc._id),
      entityName: `Outcome - ${doc.caseNumber}`,
      action: 'create',
      changes: [
        { field: 'outcomeType', displayName: 'Outcome Type', oldValue: null, newValue: data.outcome },
        { field: 'status', displayName: 'Status', oldValue: null, newValue: 'decided' },
      ],
      performedBy,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'decided' },
      { field: 'outcome', displayName: 'Outcome', oldValue: null, newValue: data.outcome },
      { field: 'appealDeadline', displayName: 'Appeal Deadline', oldValue: null, newValue: appealDeadline },
    ],
    performedBy,
  });

  return { case: doc, outcome: outcomeDoc };
}

/** W05-L2-072: Implement the decided outcome */
export async function implementOutcome(
  collegeId: string,
  outcomeId: string,
  data: {
    implementedActions: { action: string; module?: string }[];
    communicationLetterUrl?: string;
  },
  performedBy: string,
) {
  const outcomeDoc = await DisciplinaryOutcome.findOne({ _id: outcomeId, collegeId });
  if (!outcomeDoc) throw new AppError(404, 'Disciplinary outcome not found');

  const oldStatus = outcomeDoc.status;
  const now = new Date();

  // Add implemented actions with completedAt timestamp
  for (const act of data.implementedActions) {
    outcomeDoc.implementedActions.push({
      action: act.action,
      module: act.module,
      completedAt: now,
    });
  }

  if (data.communicationLetterUrl) {
    outcomeDoc.communicationLetterUrl = data.communicationLetterUrl;
  }

  // Determine new status based on whether we have a communication letter
  outcomeDoc.status = data.communicationLetterUrl ? 'implemented' : 'communicated';
  await outcomeDoc.save();

  // Stub: log cross-module actions that should be triggered
  if (outcomeDoc.outcomeType === 'termination') {
    // TODO: Trigger M05.6 exit (SeparationRequest) for termination
    console.log(`[STUB] Termination outcome ${String(outcomeDoc._id)} should trigger SeparationRequest creation in M05.6`);
  }
  if (outcomeDoc.outcomeType === 'fine') {
    // TODO: Create fine entry in M04 Finance module
    console.log(`[STUB] Fine outcome ${String(outcomeDoc._id)} should create a fine record in M04 Finance`);
  }
  if (outcomeDoc.outcomeType === 'demotion') {
    // TODO: Update designation in M02 People module
    console.log(`[STUB] Demotion outcome ${String(outcomeDoc._id)} should update designation in M02 People`);
  }

  // Update parent case
  const parentCase = await DisciplinaryCase.findOne({ _id: outcomeDoc.disciplinaryCaseId, collegeId });
  if (parentCase) {
    parentCase.status = 'implemented';
    parentCase.outcomeImplementedAt = now;
    addTimeline(parentCase, 'Outcome implemented', performedBy, `Outcome type: ${outcomeDoc.outcomeType}`);
    await parentCase.save();

    await createAuditLog({
      collegeId,
      entityType: 'DisciplinaryCase',
      entityId: String(parentCase._id),
      entityName: parentCase.caseNumber,
      action: 'update',
      changes: [
        { field: 'status', displayName: 'Status', oldValue: parentCase.status, newValue: 'implemented' },
        { field: 'outcomeImplementedAt', displayName: 'Outcome Implemented At', oldValue: null, newValue: now },
      ],
      performedBy,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryOutcome',
    entityId: String(outcomeDoc._id),
    entityName: `Outcome - ${parentCase?.caseNumber ?? outcomeDoc.disciplinaryCaseId}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: outcomeDoc.status },
      { field: 'implementedActions', displayName: 'Implemented Actions', oldValue: null, newValue: data.implementedActions },
    ],
    performedBy,
  });

  return outcomeDoc;
}

/** W05-L2-072: Close case after all outcomes are implemented */
export async function closeCaseAfterImplementation(
  collegeId: string,
  caseId: string,
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const oldStatus = doc.status;
  doc.status = 'closed';
  addTimeline(doc, 'Case closed', performedBy, 'Case closed after full implementation');
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Appeal (W05-L2-073 to W05-L2-074)
// ===========================================================================

/** W05-L2-073: Submit an appeal against disciplinary outcome */
export async function submitAppeal(
  collegeId: string,
  caseId: string,
  data: { appealText: string },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  // Verify within appeal deadline
  if (doc.appealDeadline && new Date() > doc.appealDeadline) {
    throw new AppError(400, 'Appeal deadline has passed');
  }

  const oldStatus = doc.status;
  doc.status = 'appealed';
  addTimeline(doc, 'Appeal submitted', performedBy, data.appealText);
  await doc.save();

  // Update DisciplinaryOutcome status to appealed
  const outcomeDoc = await DisciplinaryOutcome.findOne({
    collegeId,
    disciplinaryCaseId: doc._id,
    status: { $nin: ['overturned'] },
  });
  if (outcomeDoc) {
    const oldOutcomeStatus = outcomeDoc.status;
    outcomeDoc.status = 'appealed';
    await outcomeDoc.save();

    await createAuditLog({
      collegeId,
      entityType: 'DisciplinaryOutcome',
      entityId: String(outcomeDoc._id),
      entityName: `Outcome - ${doc.caseNumber}`,
      action: 'update',
      changes: [
        { field: 'status', displayName: 'Status', oldValue: oldOutcomeStatus, newValue: 'appealed' },
      ],
      performedBy,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'appealed' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-074: Resolve an appeal */
export async function resolveAppeal(
  collegeId: string,
  caseId: string,
  data: {
    resolution: 'upheld' | 'modified' | 'overturned';
    revisedOutcome?: 'warning' | 'fine' | 'suspension' | 'demotion' | 'termination';
    revisedDetails?: string;
  },
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: caseId, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');
  if (doc.status !== 'appealed') throw new AppError(400, 'Case is not in appealed status');

  const existingOutcome = await DisciplinaryOutcome.findOne({
    collegeId,
    disciplinaryCaseId: doc._id,
    status: 'appealed',
  });

  if (data.resolution === 'upheld') {
    // Original outcome stands — revert to implemented
    doc.status = 'implemented';
    addTimeline(doc, 'Appeal upheld', performedBy, 'Original outcome stands');

    if (existingOutcome) {
      existingOutcome.status = 'implemented';
      await existingOutcome.save();
    }
  } else if (data.resolution === 'modified') {
    // Update outcome with revised details
    doc.status = 'decided';
    if (data.revisedOutcome) doc.outcome = data.revisedOutcome;
    if (data.revisedDetails) doc.outcomeDetails = data.revisedDetails;
    addTimeline(doc, 'Appeal resolved - modified', performedBy, `Revised outcome: ${data.revisedOutcome ?? doc.outcome}`);

    // Overwrite existing outcome and create a new one
    if (existingOutcome) {
      existingOutcome.status = 'overturned';
      await existingOutcome.save();
    }

    if (data.revisedOutcome) {
      const newOutcome = await DisciplinaryOutcome.create({
        collegeId,
        disciplinaryCaseId: doc._id,
        employeeId: doc.employeeId,
        outcomeType: data.revisedOutcome,
        details: {},
        status: 'decided',
      });

      await createAuditLog({
        collegeId,
        entityType: 'DisciplinaryOutcome',
        entityId: String(newOutcome._id),
        entityName: `Revised Outcome - ${doc.caseNumber}`,
        action: 'create',
        changes: [
          { field: 'outcomeType', displayName: 'Outcome Type', oldValue: null, newValue: data.revisedOutcome },
          { field: 'status', displayName: 'Status', oldValue: null, newValue: 'decided' },
        ],
        performedBy,
      });
    }
  } else {
    // Overturned — exonerate
    doc.status = 'closed';
    doc.outcome = 'exonerated';
    addTimeline(doc, 'Appeal resolved - overturned', performedBy, 'Outcome overturned, employee exonerated');

    if (existingOutcome) {
      existingOutcome.status = 'overturned';
      await existingOutcome.save();

      await createAuditLog({
        collegeId,
        entityType: 'DisciplinaryOutcome',
        entityId: String(existingOutcome._id),
        entityName: `Outcome - ${doc.caseNumber}`,
        action: 'update',
        changes: [
          { field: 'status', displayName: 'Status', oldValue: 'appealed', newValue: 'overturned' },
        ],
        performedBy,
      });
    }
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'appealed', newValue: doc.status },
      { field: 'appealResolution', displayName: 'Appeal Resolution', oldValue: null, newValue: data.resolution },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Timeline Monitoring (W05-L2-074)
// ===========================================================================

/** Detect overdue disciplinary cases */
export async function detectOverdueCases(collegeId: string) {
  const now = new Date();

  const overdueShowCause = await DisciplinaryCase.find({
    collegeId,
    status: 'show_cause',
    responseDeadline: { $lt: now },
  }).lean();

  const overdueAppeal = await DisciplinaryCase.find({
    collegeId,
    status: 'decided',
    appealDeadline: { $lt: now },
  }).lean();

  return {
    overdueShowCauseResponse: overdueShowCause.map((c) => ({
      caseId: String(c._id),
      caseNumber: c.caseNumber,
      employeeId: String(c.employeeId),
      responseDeadline: c.responseDeadline,
      daysPastDeadline: Math.floor((now.getTime() - (c.responseDeadline?.getTime() ?? now.getTime())) / (1000 * 60 * 60 * 24)),
    })),
    overdueAppealDeadline: overdueAppeal.map((c) => ({
      caseId: String(c._id),
      caseNumber: c.caseNumber,
      employeeId: String(c.employeeId),
      appealDeadline: c.appealDeadline,
      daysPastDeadline: Math.floor((now.getTime() - (c.appealDeadline?.getTime() ?? now.getTime())) / (1000 * 60 * 60 * 24)),
    })),
  };
}

// ===========================================================================
// CRUD — DisciplinaryCase
// ===========================================================================

export async function listDisciplinaryCases(
  collegeId: string,
  page = 1,
  limit = 20,
  filters?: { status?: string; employeeId?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.status) filter.status = filters.status;
  if (filters?.employeeId) filter.employeeId = filters.employeeId;
  return paginate(DisciplinaryCase, filter, page, limit);
}

export async function getDisciplinaryCase(collegeId: string, id: string) {
  const doc = await DisciplinaryCase.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');
  return doc;
}

export async function createDisciplinaryCase(
  collegeId: string,
  data: Partial<Record<string, unknown>>,
  performedBy: string,
) {
  const doc = await DisciplinaryCase.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'create',
    changes: [
      { field: 'caseNumber', displayName: 'Case Number', oldValue: null, newValue: doc.caseNumber },
      { field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status },
    ],
    performedBy,
  });

  return doc;
}

export async function updateDisciplinaryCase(
  collegeId: string,
  id: string,
  data: Partial<Record<string, unknown>>,
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  const changes: { field: string; displayName: string; oldValue: any; newValue: any }[] = [];
  for (const [key, value] of Object.entries(data)) {
    const oldVal = (doc as any)[key];
    if (oldVal !== value) {
      changes.push({
        field: key,
        displayName: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        oldValue: oldVal ?? null,
        newValue: value,
      });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'DisciplinaryCase',
      entityId: String(doc._id),
      entityName: doc.caseNumber,
      action: 'update',
      changes,
      performedBy,
    });
  }

  return doc;
}

export async function deleteDisciplinaryCase(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await DisciplinaryCase.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary case not found');

  await DisciplinaryCase.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryCase',
    entityId: String(doc._id),
    entityName: doc.caseNumber,
    action: 'delete',
    changes: [
      { field: 'caseNumber', displayName: 'Case Number', oldValue: doc.caseNumber, newValue: null },
    ],
    performedBy,
  });

  return { success: true };
}

// ===========================================================================
// CRUD — DisciplinaryOutcome
// ===========================================================================

export async function listDisciplinaryOutcomes(
  collegeId: string,
  page = 1,
  limit = 20,
  filters?: { disciplinaryCaseId?: string; employeeId?: string; status?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.disciplinaryCaseId) filter.disciplinaryCaseId = filters.disciplinaryCaseId;
  if (filters?.employeeId) filter.employeeId = filters.employeeId;
  if (filters?.status) filter.status = filters.status;
  return paginate(DisciplinaryOutcome, filter, page, limit);
}

export async function getDisciplinaryOutcome(collegeId: string, id: string) {
  const doc = await DisciplinaryOutcome.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary outcome not found');
  return doc;
}

export async function createDisciplinaryOutcome(
  collegeId: string,
  data: Partial<Record<string, unknown>>,
  performedBy: string,
) {
  const doc = await DisciplinaryOutcome.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryOutcome',
    entityId: String(doc._id),
    entityName: `Outcome - ${String(doc.disciplinaryCaseId)}`,
    action: 'create',
    changes: [
      { field: 'outcomeType', displayName: 'Outcome Type', oldValue: null, newValue: doc.outcomeType },
      { field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status },
    ],
    performedBy,
  });

  return doc;
}

export async function updateDisciplinaryOutcome(
  collegeId: string,
  id: string,
  data: Partial<Record<string, unknown>>,
  performedBy: string,
) {
  const doc = await DisciplinaryOutcome.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary outcome not found');

  const changes: { field: string; displayName: string; oldValue: any; newValue: any }[] = [];
  for (const [key, value] of Object.entries(data)) {
    const oldVal = (doc as any)[key];
    if (oldVal !== value) {
      changes.push({
        field: key,
        displayName: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        oldValue: oldVal ?? null,
        newValue: value,
      });
    }
  }

  Object.assign(doc, data);
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'DisciplinaryOutcome',
      entityId: String(doc._id),
      entityName: `Outcome - ${String(doc.disciplinaryCaseId)}`,
      action: 'update',
      changes,
      performedBy,
    });
  }

  return doc;
}

export async function deleteDisciplinaryOutcome(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await DisciplinaryOutcome.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Disciplinary outcome not found');

  await DisciplinaryOutcome.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'DisciplinaryOutcome',
    entityId: String(doc._id),
    entityName: `Outcome - ${String(doc.disciplinaryCaseId)}`,
    action: 'delete',
    changes: [
      { field: 'outcomeType', displayName: 'Outcome Type', oldValue: doc.outcomeType, newValue: null },
    ],
    performedBy,
  });

  return { success: true };
}
