import { Fest } from '../../models/student-dev/Fest';
import { Competition } from '../../models/student-dev/Competition';
import { Workshop } from '../../models/student-dev/Workshop';
import { SDProgramme } from '../../models/student-dev/SDProgramme';
import { EventRegistration } from '../../models/student-dev/EventRegistration';
import { NSSParticipant } from '../../models/student-dev/NSSParticipant';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ===========================================================================
// FEST CRUD + Workflow
// ===========================================================================

/** List fests with optional status filter */
export async function listFests(
  collegeId: string,
  page: number,
  limit: number,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(Fest, filter, page, limit);
}

/** Get a single fest by ID */
export async function getFest(collegeId: string, id: string) {
  const doc = await Fest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  return doc;
}

/** Propose a new fest with AI proposal scoring heuristic */
export async function proposeFest(
  collegeId: string,
  data: {
    name: string;
    type: string;
    academicYearId: string;
    startDate: Date;
    endDate: Date;
    proposedBy: string;
    description?: string;
    estimatedBudget?: number;
    estimatedAttendance?: number;
  },
  performedBy: string,
) {
  // AI placeholder: simple heuristic scoring
  let proposalScore = 20; // base score for submitting
  if (data.description && data.description.length > 0) proposalScore += 20;
  if (data.estimatedBudget && data.estimatedBudget > 0) proposalScore += 20;
  if (data.estimatedAttendance && data.estimatedAttendance > 100) proposalScore += 20;
  if (data.startDate && data.endDate) proposalScore += 20;
  proposalScore = Math.min(proposalScore, 100);

  const doc = await Fest.create({
    collegeId,
    name: data.name,
    type: data.type,
    academicYearId: data.academicYearId,
    startDate: data.startDate,
    endDate: data.endDate,
    proposedBy: data.proposedBy,
    description: data.description,
    estimatedBudget: data.estimatedBudget,
    estimatedAttendance: data.estimatedAttendance,
    status: 'proposed',
    proposalScore,
  });

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'proposed' },
      { field: 'proposalScore', displayName: 'Proposal Score', oldValue: null, newValue: String(proposalScore) },
    ],
    performedBy,
  });

  return doc;
}

/** Approve a proposed fest */
export async function approveFest(
  collegeId: string,
  festId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const doc = await Fest.findOne({ _id: festId, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  if (doc.status !== 'proposed') throw new AppError(400, 'Only proposed fests can be approved');

  doc.status = 'approved';
  doc.approvedBy = data.approvedBy as any;
  doc.approvalDate = new Date();
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'proposed', newValue: 'approved' },
    ],
    performedBy,
  });

  return doc;
}

/** Reject a proposed fest (sets status to cancelled with reason) */
export async function rejectFest(
  collegeId: string,
  festId: string,
  data: { rejectedReason: string },
  performedBy: string,
) {
  const doc = await Fest.findOne({ _id: festId, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  if (doc.status !== 'proposed') throw new AppError(400, 'Only proposed fests can be rejected');

  doc.status = 'cancelled';
  doc.rejectedReason = data.rejectedReason;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'proposed', newValue: 'cancelled' },
      { field: 'rejectedReason', displayName: 'Rejected Reason', oldValue: null, newValue: data.rejectedReason },
    ],
    performedBy,
  });

  return doc;
}

/** Update logistics for an approved/planning fest */
export async function updateFestLogistics(
  collegeId: string,
  festId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await Fest.findOne({ _id: festId, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  if (!['approved', 'planning'].includes(doc.status)) {
    throw new AppError(400, 'Logistics can only be updated for approved or planning fests');
  }

  const oldStatus = doc.status;
  Object.assign(doc, data);
  if (oldStatus === 'approved') doc.status = 'planning';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      ...(oldStatus === 'approved'
        ? [{ field: 'status', displayName: 'Status', oldValue: 'approved', newValue: 'planning' }]
        : []),
      { field: 'logistics', displayName: 'Logistics', oldValue: null, newValue: 'updated' },
    ],
    performedBy,
  });

  return doc;
}

/** Close an active or completed fest */
export async function closeFest(
  collegeId: string,
  festId: string,
  data: { actualAttendance?: number; feedbackSummary?: string },
  performedBy: string,
) {
  const doc = await Fest.findOne({ _id: festId, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  if (!['active', 'completed'].includes(doc.status)) {
    throw new AppError(400, 'Only active or completed fests can be closed');
  }

  const oldStatus = doc.status;
  doc.status = 'closed';
  if (data.actualAttendance !== undefined) doc.actualAttendance = data.actualAttendance;
  if (data.feedbackSummary !== undefined) doc.feedbackSummary = data.feedbackSummary;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
    ],
    performedBy,
  });

  return doc;
}

/** Cancel a fest that is not already closed or cancelled */
export async function cancelFest(
  collegeId: string,
  festId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await Fest.findOne({ _id: festId, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  if (['closed', 'cancelled'].includes(doc.status)) {
    throw new AppError(400, 'Fest is already closed or cancelled');
  }

  const oldStatus = doc.status;
  doc.status = 'cancelled';
  doc.rejectedReason = data.reason;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
      { field: 'rejectedReason', displayName: 'Cancellation Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return doc;
}

/** Postpone a fest by updating its dates */
export async function postponeFest(
  collegeId: string,
  festId: string,
  data: { newStartDate: Date; newEndDate: Date; reason: string },
  performedBy: string,
) {
  const doc = await Fest.findOne({ _id: festId, collegeId });
  if (!doc) throw new AppError(404, 'Fest not found');
  if (['closed', 'cancelled', 'completed'].includes(doc.status)) {
    throw new AppError(400, 'Cannot postpone a closed, cancelled, or completed fest');
  }

  const oldStart = doc.startDate.toISOString();
  const oldEnd = doc.endDate.toISOString();
  doc.startDate = data.newStartDate;
  doc.endDate = data.newEndDate;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Fest',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'startDate', displayName: 'Start Date', oldValue: oldStart, newValue: new Date(data.newStartDate).toISOString() },
      { field: 'endDate', displayName: 'End Date', oldValue: oldEnd, newValue: new Date(data.newEndDate).toISOString() },
      { field: 'postponeReason', displayName: 'Postpone Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// COMPETITION CRUD + Workflow
// ===========================================================================

/** List competitions with optional status and parentType filters */
export async function listCompetitions(
  collegeId: string,
  page: number,
  limit: number,
  status?: string,
  parentType?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  if (parentType) filter.parentType = parentType;
  return paginate(Competition, filter, page, limit);
}

/** Get a single competition by ID */
export async function getCompetition(collegeId: string, id: string) {
  const doc = await Competition.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Competition not found');
  return doc;
}

/** Propose a new competition */
export async function proposeCompetition(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await Competition.create({
    ...data,
    collegeId,
    status: 'proposed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Competition',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'proposed' },
    ],
    performedBy,
  });

  return doc;
}

/** Approve a proposed competition */
export async function approveCompetition(
  collegeId: string,
  id: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const doc = await Competition.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Competition not found');
  if (doc.status !== 'proposed') throw new AppError(400, 'Only proposed competitions can be approved');

  doc.status = 'approved';
  doc.coordinatorId = data.approvedBy as any;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Competition',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'proposed', newValue: 'approved' },
    ],
    performedBy,
  });

  return doc;
}

/** Register a participant for a competition */
export async function registerForCompetition(
  collegeId: string,
  competitionId: string,
  data: { participantId: string; teamName?: string; teamMembers?: string[] },
  performedBy: string,
) {
  const comp = await Competition.findOne({ _id: competitionId, collegeId });
  if (!comp) throw new AppError(404, 'Competition not found');
  if (comp.status !== 'registration_open') {
    throw new AppError(400, 'Competition is not open for registration');
  }

  const currentCount = await EventRegistration.countDocuments({
    collegeId,
    eventId: competitionId,
    status: { $nin: ['cancelled'] },
  });

  let waitlistPosition: number | undefined;
  let status = 'registered';
  if (comp.maxParticipants && currentCount >= comp.maxParticipants) {
    const waitlistCount = await EventRegistration.countDocuments({
      collegeId,
      eventId: competitionId,
      status: 'waitlisted',
    });
    waitlistPosition = waitlistCount + 1;
    status = 'waitlisted';
  }

  const reg = await EventRegistration.create({
    collegeId,
    eventId: competitionId,
    participantId: data.participantId,
    participantType: 'student',
    teamName: data.teamName,
    teamMembers: data.teamMembers,
    status,
    waitlistPosition,
  });

  await createAuditLog({
    collegeId,
    entityType: 'EventRegistration',
    entityId: String(reg._id),
    entityName: `${comp.name} - Registration`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: status },
    ],
    performedBy,
  });

  return reg;
}

/** Check in a participant for a competition */
export async function checkInCompetition(
  collegeId: string,
  competitionId: string,
  data: { participantId: string; checkedInBy: string },
  _performedBy: string,
) {
  const reg = await EventRegistration.findOne({
    collegeId,
    eventId: competitionId,
    participantId: data.participantId,
  });
  if (!reg) throw new AppError(404, 'Registration not found');

  reg.status = 'attended';
  reg.checkedInAt = new Date();
  reg.checkedInBy = data.checkedInBy as any;
  await reg.save();

  return reg;
}

/** Declare competition results */
export async function declareCompetitionResults(
  collegeId: string,
  competitionId: string,
  data: { results: { rank: number; participantId: string; teamName?: string; score?: number }[] },
  performedBy: string,
) {
  const comp = await Competition.findOne({ _id: competitionId, collegeId });
  if (!comp) throw new AppError(404, 'Competition not found');
  if (comp.status !== 'ongoing') throw new AppError(400, 'Competition must be ongoing to declare results');

  comp.results = data.results as any;
  comp.status = 'results_declared';
  await comp.save();

  // Update EventRegistration status to 'winner' for top 3
  const winnerIds = data.results
    .filter((r) => r.rank >= 1 && r.rank <= 3)
    .map((r) => r.participantId);

  if (winnerIds.length > 0) {
    await EventRegistration.updateMany(
      { collegeId, eventId: competitionId, participantId: { $in: winnerIds } },
      { $set: { status: 'winner' } },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'Competition',
    entityId: String(comp._id),
    entityName: comp.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'ongoing', newValue: 'results_declared' },
      { field: 'results', displayName: 'Results', oldValue: null, newValue: `${data.results.length} results declared` },
    ],
    performedBy,
  });

  return comp;
}

/** Close a competition after results are declared */
export async function closeCompetition(
  collegeId: string,
  competitionId: string,
  performedBy: string,
) {
  const comp = await Competition.findOne({ _id: competitionId, collegeId });
  if (!comp) throw new AppError(404, 'Competition not found');
  if (comp.status !== 'results_declared') {
    throw new AppError(400, 'Competition must have results declared before closing');
  }

  comp.status = 'closed';
  await comp.save();

  await createAuditLog({
    collegeId,
    entityType: 'Competition',
    entityId: String(comp._id),
    entityName: comp.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'results_declared', newValue: 'closed' },
    ],
    performedBy,
  });

  return comp;
}

// ===========================================================================
// WORKSHOP CRUD + Workflow
// ===========================================================================

/** List workshops with optional status filter */
export async function listWorkshops(
  collegeId: string,
  page: number,
  limit: number,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(Workshop, filter, page, limit);
}

/** Get a single workshop by ID */
export async function getWorkshop(collegeId: string, id: string) {
  const doc = await Workshop.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Workshop not found');
  return doc;
}

/** Propose a new workshop */
export async function proposeWorkshop(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await Workshop.create({
    ...data,
    collegeId,
    status: 'proposed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Workshop',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'proposed' },
    ],
    performedBy,
  });

  return doc;
}

/** Approve a proposed workshop */
export async function approveWorkshop(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await Workshop.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Workshop not found');
  if (doc.status !== 'proposed') throw new AppError(400, 'Only proposed workshops can be approved');

  doc.status = 'approved';
  if (data) Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Workshop',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'proposed', newValue: 'approved' },
    ],
    performedBy,
  });

  return doc;
}

/** Register a participant for a workshop */
export async function registerForWorkshop(
  collegeId: string,
  workshopId: string,
  data: { participantId: string },
  performedBy: string,
) {
  const workshop = await Workshop.findOne({ _id: workshopId, collegeId });
  if (!workshop) throw new AppError(404, 'Workshop not found');
  if (!['registration_open', 'approved'].includes(workshop.status)) {
    throw new AppError(400, 'Workshop is not open for registration');
  }

  if (workshop.maxCapacity) {
    const currentCount = await EventRegistration.countDocuments({
      collegeId,
      eventId: workshopId,
      status: { $nin: ['cancelled'] },
    });
    if (currentCount >= workshop.maxCapacity) {
      throw new AppError(400, 'Workshop is at full capacity');
    }
  }

  const reg = await EventRegistration.create({
    collegeId,
    eventId: workshopId,
    participantId: data.participantId,
    participantType: 'student',
    status: 'registered',
  });

  await createAuditLog({
    collegeId,
    entityType: 'EventRegistration',
    entityId: String(reg._id),
    entityName: `${workshop.name} - Registration`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'registered' },
    ],
    performedBy,
  });

  return reg;
}

/** Check in a participant for a workshop */
export async function checkInWorkshop(
  collegeId: string,
  workshopId: string,
  data: { participantId: string; checkedInBy: string },
  _performedBy: string,
) {
  const reg = await EventRegistration.findOne({
    collegeId,
    eventId: workshopId,
    participantId: data.participantId,
  });
  if (!reg) throw new AppError(404, 'Registration not found');

  reg.status = 'attended';
  reg.checkedInAt = new Date();
  reg.checkedInBy = data.checkedInBy as any;
  await reg.save();

  return reg;
}

/** Complete a workshop */
export async function completeWorkshop(
  collegeId: string,
  workshopId: string,
  performedBy: string,
) {
  const doc = await Workshop.findOne({ _id: workshopId, collegeId });
  if (!doc) throw new AppError(404, 'Workshop not found');
  if (!['approved', 'registration_open', 'ongoing'].includes(doc.status)) {
    throw new AppError(400, 'Workshop cannot be completed in its current status');
  }

  const oldStatus = doc.status;
  doc.status = 'completed';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Workshop',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'completed' },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// PROGRAMME (NCC/NSS) + Calendar
// ===========================================================================

/** List SD programmes with optional type filter */
export async function listSDProgrammes(
  collegeId: string,
  page: number,
  limit: number,
  type?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (type) filter.type = type;
  return paginate(SDProgramme, filter, page, limit);
}

/** Get a single SD programme by ID */
export async function getSDProgramme(collegeId: string, id: string) {
  const doc = await SDProgramme.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Programme not found');
  return doc;
}

/** Create a new SD programme */
export async function createSDProgramme(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await SDProgramme.create({
    ...data,
    collegeId,
    status: 'enrollment_open',
    enrolledCount: 0,
  });

  await createAuditLog({
    collegeId,
    entityType: 'SDProgramme',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'enrollment_open' },
    ],
    performedBy,
  });

  return doc;
}

/** Enroll a student in a programme */
export async function enrollInProgramme(
  collegeId: string,
  programmeId: string,
  data: { studentId: string },
  performedBy: string,
) {
  const programme = await SDProgramme.findOne({ _id: programmeId, collegeId });
  if (!programme) throw new AppError(404, 'Programme not found');
  if (programme.status !== 'enrollment_open') {
    throw new AppError(400, 'Programme is not open for enrollment');
  }
  if (programme.capacity && programme.enrolledCount >= programme.capacity) {
    throw new AppError(400, 'Programme is at full capacity');
  }

  // Create NSSParticipant as enrollment record
  // Use a placeholder activityId (the programme itself) since activityId is required
  const participant = await NSSParticipant.create({
    collegeId,
    activityId: programmeId,
    studentId: data.studentId,
    programmeId,
    hoursContributed: 0,
    cumulativeHours: 0,
    enrollmentDate: new Date(),
  });

  // Increment enrolledCount
  programme.enrolledCount += 1;
  await programme.save();

  await createAuditLog({
    collegeId,
    entityType: 'NSSParticipant',
    entityId: String(participant._id),
    entityName: `${programme.name} - Enrollment`,
    action: 'create',
    changes: [
      { field: 'enrolledCount', displayName: 'Enrolled Count', oldValue: String(programme.enrolledCount - 1), newValue: String(programme.enrolledCount) },
    ],
    performedBy,
  });

  return participant;
}

/** Log hours for a student in a programme activity */
export async function logProgrammeHours(
  collegeId: string,
  programmeId: string,
  data: { studentId: string; activityId: string; hours: number },
  performedBy: string,
) {
  // Find or update the participant record for this specific activity
  let participant = await NSSParticipant.findOne({
    collegeId,
    programmeId,
    studentId: data.studentId,
    activityId: data.activityId,
  });

  if (participant) {
    // Update existing activity record
    const oldHours = participant.hoursContributed;
    participant.hoursContributed += data.hours;
    participant.cumulativeHours += data.hours;
    await participant.save();

    await createAuditLog({
      collegeId,
      entityType: 'NSSParticipant',
      entityId: String(participant._id),
      entityName: `Programme Hours Log`,
      action: 'update',
      changes: [
        { field: 'hoursContributed', displayName: 'Hours Contributed', oldValue: String(oldHours), newValue: String(participant.hoursContributed) },
        { field: 'cumulativeHours', displayName: 'Cumulative Hours', oldValue: String(participant.cumulativeHours - data.hours), newValue: String(participant.cumulativeHours) },
      ],
      performedBy,
    });
  } else {
    // Create new activity record; also update cumulative hours across programme
    const existingRecords = await NSSParticipant.find({
      collegeId,
      programmeId,
      studentId: data.studentId,
    });
    const totalHoursSoFar = existingRecords.reduce((sum, r) => sum + r.hoursContributed, 0);

    participant = await NSSParticipant.create({
      collegeId,
      activityId: data.activityId,
      studentId: data.studentId,
      programmeId,
      hoursContributed: data.hours,
      cumulativeHours: totalHoursSoFar + data.hours,
    });

    // Update cumulative hours on all records for this student+programme
    await NSSParticipant.updateMany(
      { collegeId, programmeId, studentId: data.studentId },
      { $set: { cumulativeHours: totalHoursSoFar + data.hours } },
    );

    await createAuditLog({
      collegeId,
      entityType: 'NSSParticipant',
      entityId: String(participant._id),
      entityName: `Programme Hours Log`,
      action: 'create',
      changes: [
        { field: 'hoursContributed', displayName: 'Hours', oldValue: null, newValue: String(data.hours) },
        { field: 'cumulativeHours', displayName: 'Cumulative Hours', oldValue: String(totalHoursSoFar), newValue: String(totalHoursSoFar + data.hours) },
      ],
      performedBy,
    });
  }

  return participant;
}

/** Get unified event calendar for a date range */
export async function getEventCalendar(
  collegeId: string,
  data: { startDate: Date; endDate: Date },
) {
  const dateFilter = {
    $gte: new Date(data.startDate),
    $lte: new Date(data.endDate),
  };

  const [fests, competitions, workshops] = await Promise.all([
    Fest.find({
      collegeId,
      startDate: { $lte: new Date(data.endDate) },
      endDate: { $gte: new Date(data.startDate) },
      status: { $nin: ['cancelled'] },
    }).lean(),
    Competition.find({
      collegeId,
      startDate: { $lte: new Date(data.endDate) },
      endDate: { $gte: new Date(data.startDate) },
      status: { $nin: ['cancelled'] },
    }).lean(),
    Workshop.find({
      collegeId,
      date: dateFilter,
      status: { $nin: ['cancelled'] },
    }).lean(),
  ]);

  // Merge and sort by start date
  const events = [
    ...fests.map((f) => ({
      id: String(f._id),
      type: 'fest' as const,
      name: f.name,
      startDate: f.startDate,
      endDate: f.endDate,
      status: f.status,
    })),
    ...competitions.map((c) => ({
      id: String(c._id),
      type: 'competition' as const,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
    })),
    ...workshops.map((w) => ({
      id: String(w._id),
      type: 'workshop' as const,
      name: w.name,
      startDate: w.date,
      endDate: w.date,
      status: w.status,
    })),
  ];

  events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return events;
}
