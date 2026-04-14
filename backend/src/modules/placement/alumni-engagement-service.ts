import { AlumniCareer } from '../../models/placement/AlumniCareer';
import { AlumniEngagement } from '../../models/placement/AlumniEngagement';
import { MentorMatch } from '../../models/placement/MentorMatch';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ===========================================================================
// Alumni Career CRUD
// ===========================================================================

export async function listAlumniCareers(
  collegeId: string,
  page = 1,
  limit = 20,
  alumniId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (alumniId) filter.alumniId = alumniId;
  return paginate(AlumniCareer, filter, page, limit, { startDate: -1 }, ['alumniId']);
}

export async function getAlumniCareerEntry(collegeId: string, id: string) {
  const doc = await AlumniCareer.findOne({ _id: id, collegeId }).populate('alumniId');
  if (!doc) throw new AppError(404, 'Alumni career entry not found');
  return doc;
}

export async function createAlumniCareer(
  collegeId: string,
  data: {
    alumniId: string;
    companyName: string;
    jobTitle: string;
    location?: string;
    startDate: Date;
    endDate?: Date;
    isCurrent?: boolean;
    packageLpa?: number;
    source: string;
  },
  performedBy: string,
) {
  const doc = await AlumniCareer.create({
    collegeId,
    alumniId: data.alumniId,
    companyName: data.companyName,
    jobTitle: data.jobTitle,
    location: data.location,
    startDate: data.startDate,
    endDate: data.endDate,
    isCurrent: data.isCurrent ?? false,
    packageLpa: data.packageLpa,
    source: data.source,
  });

  await createAuditLog({
    collegeId,
    entityType: 'AlumniCareer',
    entityId: String(doc._id),
    entityName: `${data.jobTitle} at ${data.companyName}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateAlumniCareer(
  collegeId: string,
  id: string,
  data: Partial<{
    companyName: string;
    jobTitle: string;
    location: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    packageLpa: number;
    source: string;
  }>,
  performedBy: string,
) {
  const doc = await AlumniCareer.findOneAndUpdate(
    { _id: id, collegeId },
    data,
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Alumni career entry not found');

  await createAuditLog({
    collegeId,
    entityType: 'AlumniCareer',
    entityId: id,
    entityName: `${doc.jobTitle} at ${doc.companyName}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deleteAlumniCareer(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await AlumniCareer.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Alumni career entry not found');

  await createAuditLog({
    collegeId,
    entityType: 'AlumniCareer',
    entityId: id,
    entityName: `${doc.jobTitle} at ${doc.companyName}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Alumni Engagement
// ===========================================================================

export async function listAlumniEngagements(
  collegeId: string,
  page = 1,
  limit = 20,
  alumniId?: string,
  type?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (alumniId) filter.alumniId = alumniId;
  if (type) filter.type = type;
  if (status) filter.status = status;
  return paginate(AlumniEngagement, filter, page, limit, { sentAt: -1 }, ['alumniId']);
}

export async function getAlumniEngagement(collegeId: string, id: string) {
  const doc = await AlumniEngagement.findOne({ _id: id, collegeId }).populate('alumniId');
  if (!doc) throw new AppError(404, 'Alumni engagement not found');
  return doc;
}

export async function createAlumniEngagement(
  collegeId: string,
  data: {
    alumniId: string;
    type: string;
    metadata?: Record<string, unknown>;
  },
  performedBy: string,
) {
  const doc = await AlumniEngagement.create({
    collegeId,
    alumniId: data.alumniId,
    type: data.type,
    metadata: data.metadata,
    sentAt: new Date(),
    status: 'sent',
    reminderCount: 0,
  });

  await createAuditLog({
    collegeId,
    entityType: 'AlumniEngagement',
    entityId: String(doc._id),
    entityName: `Engagement: ${data.type}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'sent' },
      { field: 'type', displayName: 'Type', oldValue: null, newValue: data.type },
    ],
    performedBy,
  });

  return doc;
}

export async function respondToEngagement(
  collegeId: string,
  engagementId: string,
  data: { status: 'responded' | 'declined' },
  performedBy: string,
) {
  const doc = await AlumniEngagement.findOne({ _id: engagementId, collegeId });
  if (!doc) throw new AppError(404, 'Alumni engagement not found');

  const oldStatus = doc.status;
  doc.status = data.status;
  doc.respondedAt = new Date();

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'AlumniEngagement',
    entityId: String(doc._id),
    entityName: `Engagement: ${doc.type}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: data.status },
    ],
    performedBy,
  });

  return doc;
}

export async function sendEngagementReminder(
  collegeId: string,
  engagementId: string,
  performedBy: string,
) {
  const doc = await AlumniEngagement.findOne({ _id: engagementId, collegeId });
  if (!doc) throw new AppError(404, 'Alumni engagement not found');

  doc.reminderCount += 1;
  doc.lastReminderAt = new Date();

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'AlumniEngagement',
    entityId: String(doc._id),
    entityName: `Engagement: ${doc.type}`,
    action: 'update',
    changes: [
      { field: 'reminderCount', displayName: 'Reminder Count', oldValue: doc.reminderCount - 1, newValue: doc.reminderCount },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Mentor Matching
// ===========================================================================

export async function listMentorMatches(
  collegeId: string,
  page = 1,
  limit = 20,
  alumniId?: string,
  studentId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (alumniId) filter.alumniId = alumniId;
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(MentorMatch, filter, page, limit, { createdAt: -1 }, ['alumniId', 'studentId']);
}

export async function getMentorMatch(collegeId: string, id: string) {
  const doc = await MentorMatch.findOne({ _id: id, collegeId })
    .populate('alumniId')
    .populate('studentId');
  if (!doc) throw new AppError(404, 'Mentor match not found');
  return doc;
}

export async function suggestMentorMatch(
  collegeId: string,
  data: {
    alumniId: string;
    studentId: string;
    matchScore: number;
    matchReasons: string[];
  },
  performedBy: string,
) {
  const doc = await MentorMatch.create({
    collegeId,
    alumniId: data.alumniId,
    studentId: data.studentId,
    matchScore: data.matchScore,
    matchReasons: data.matchReasons,
    status: 'suggested',
  });

  await createAuditLog({
    collegeId,
    entityType: 'MentorMatch',
    entityId: String(doc._id),
    entityName: `Mentor Match (score ${data.matchScore})`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'suggested' },
      { field: 'matchScore', displayName: 'Match Score', oldValue: null, newValue: data.matchScore },
    ],
    performedBy,
  });

  return doc;
}

export async function approveMentorMatch(
  collegeId: string,
  matchId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const doc = await MentorMatch.findOne({ _id: matchId, collegeId });
  if (!doc) throw new AppError(404, 'Mentor match not found');

  if (doc.status !== 'suggested') {
    throw new AppError(400, 'Mentor match must be in suggested status to approve');
  }

  const oldStatus = doc.status;
  doc.status = 'approved_by_tpo';
  doc.approvedBy = data.approvedBy as any;

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MentorMatch',
    entityId: String(doc._id),
    entityName: `Mentor Match (score ${doc.matchScore})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved_by_tpo' },
      { field: 'approvedBy', displayName: 'Approved By', oldValue: null, newValue: data.approvedBy },
    ],
    performedBy,
  });

  return doc;
}

export async function introduceMentorMatch(
  collegeId: string,
  matchId: string,
  performedBy: string,
) {
  const doc = await MentorMatch.findOne({ _id: matchId, collegeId });
  if (!doc) throw new AppError(404, 'Mentor match not found');

  if (doc.status !== 'approved_by_tpo') {
    throw new AppError(400, 'Mentor match must be approved_by_tpo to introduce');
  }

  const oldStatus = doc.status;
  doc.status = 'introduced';
  doc.introducedAt = new Date();

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MentorMatch',
    entityId: String(doc._id),
    entityName: `Mentor Match (score ${doc.matchScore})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'introduced' },
    ],
    performedBy,
  });

  return doc;
}

export async function activateMentorMatch(
  collegeId: string,
  matchId: string,
  performedBy: string,
) {
  const doc = await MentorMatch.findOne({ _id: matchId, collegeId });
  if (!doc) throw new AppError(404, 'Mentor match not found');

  const oldStatus = doc.status;
  doc.status = 'active';

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MentorMatch',
    entityId: String(doc._id),
    entityName: `Mentor Match (score ${doc.matchScore})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'active' },
    ],
    performedBy,
  });

  return doc;
}

export async function closeMentorMatch(
  collegeId: string,
  matchId: string,
  performedBy: string,
) {
  const doc = await MentorMatch.findOne({ _id: matchId, collegeId });
  if (!doc) throw new AppError(404, 'Mentor match not found');

  const oldStatus = doc.status;
  doc.status = 'closed';

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MentorMatch',
    entityId: String(doc._id),
    entityName: `Mentor Match (score ${doc.matchScore})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
    ],
    performedBy,
  });

  return doc;
}
