import { Achievement } from '../../models/student-dev/Achievement';
import { Award } from '../../models/student-dev/Award';
import { AwardInstance } from '../../models/student-dev/AwardInstance';
import { Certificate } from '../../models/student-dev/Certificate';
import { SkillCertification as _SkillCertification } from '../../models/student-dev/SkillCertification';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ─── Constants ───────────────────────────────────────────

const INTEGRATED_SOURCES = ['internal_event', 'sih', 'ncc', 'university_sports', 'kavach'] as const;

const SKILL_TAG_MAP: Record<string, string[]> = {
  hackathon: ['problem-solving', 'teamwork', 'technical'],
  coding: ['programming', 'problem-solving', 'technical'],
  quiz: ['knowledge', 'quick-thinking'],
  debate: ['communication', 'critical-thinking', 'leadership'],
  sports_match: ['teamwork', 'discipline', 'fitness'],
  cultural_performance: ['creativity', 'expression', 'teamwork'],
  workshop: ['learning', 'technical'],
  nss: ['community-service', 'empathy', 'teamwork'],
  ncc: ['discipline', 'leadership', 'fitness'],
};

// ─── Helpers ─────────────────────────────────────────────

export function extractSkillTags(eventType: string): string[] {
  return SKILL_TAG_MAP[eventType] ?? [];
}

// ─── Achievement Verification Pipeline ───────────────────

export async function autoCaptureAchievement(
  collegeId: string,
  data: { studentId: string; title: string; category: string; level: string; date: Date; source: 'internal_event'; eventId?: string; skillTags?: string[] },
  performedBy: string,
) {
  const skillTags = data.skillTags?.length ? data.skillTags : extractSkillTags(data.category);
  const doc = await Achievement.create({
    collegeId,
    studentId: data.studentId,
    title: data.title,
    category: data.category,
    level: data.level,
    date: data.date,
    source: 'internal_event',
    verificationStatus: 'auto_verified',
    skillTags,
  });
  await createAuditLog({
    collegeId,
    entityType: 'Achievement',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function claimExternalAchievement(
  collegeId: string,
  data: { studentId: string; title: string; category: string; level: string; date: Date; description?: string; source: string; evidenceFiles?: string[] },
  performedBy: string,
) {
  const isIntegrated = (INTEGRATED_SOURCES as readonly string[]).includes(data.source);
  const verificationStatus = isIntegrated ? 'auto_verified' : 'under_review';

  const skillTags = extractSkillTags(data.category);
  const doc = await Achievement.create({
    collegeId,
    studentId: data.studentId,
    title: data.title,
    category: data.category,
    level: data.level,
    date: data.date,
    description: data.description,
    source: data.source,
    evidenceFiles: data.evidenceFiles ?? [],
    verificationStatus,
    skillTags,
  });
  await createAuditLog({
    collegeId,
    entityType: 'Achievement',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function verifyAchievement(
  collegeId: string,
  achievementId: string,
  data: { reviewedBy: string },
  performedBy: string,
) {
  const doc = await Achievement.findOne({ _id: achievementId, collegeId });
  if (!doc) throw new AppError(404, 'Achievement not found');
  if (doc.verificationStatus !== 'under_review') {
    throw new AppError(400, 'Achievement is not under review');
  }
  doc.verificationStatus = 'verified';
  doc.verifiedBy = data.reviewedBy as never;
  doc.reviewedBy = data.reviewedBy as never;
  doc.reviewedAt = new Date();
  await doc.save();
  await createAuditLog({
    collegeId,
    entityType: 'Achievement',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'update',
    changes: [{ field: 'verificationStatus', displayName: 'Verification Status', oldValue: 'under_review', newValue: 'verified' }],
    performedBy,
  });
  return doc;
}

export async function rejectAchievement(
  collegeId: string,
  achievementId: string,
  data: { rejectedReason: string; reviewedBy: string },
  performedBy: string,
) {
  const doc = await Achievement.findOne({ _id: achievementId, collegeId });
  if (!doc) throw new AppError(404, 'Achievement not found');
  if (doc.verificationStatus !== 'under_review') {
    throw new AppError(400, 'Achievement is not under review');
  }
  doc.verificationStatus = 'rejected';
  doc.rejectedReason = data.rejectedReason;
  doc.reviewedBy = data.reviewedBy as never;
  doc.reviewedAt = new Date();
  await doc.save();
  await createAuditLog({
    collegeId,
    entityType: 'Achievement',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'update',
    changes: [{ field: 'verificationStatus', displayName: 'Verification Status', oldValue: 'under_review', newValue: 'rejected' }],
    performedBy,
  });
  return doc;
}

export async function syncExternalAchievements(
  collegeId: string,
  data: { source: string; achievements: { studentId: string; title: string; category: string; level: string; date: Date }[] },
  performedBy: string,
) {
  const docs = await Achievement.insertMany(
    data.achievements.map((a) => ({
      collegeId,
      studentId: a.studentId,
      title: a.title,
      category: a.category,
      level: a.level,
      date: a.date,
      source: data.source,
      verificationStatus: 'auto_verified',
      skillTags: extractSkillTags(a.category),
    })),
  );
  await createAuditLog({
    collegeId,
    entityType: 'Achievement',
    entityId: 'bulk',
    entityName: `Bulk sync from ${data.source}`,
    action: 'create',
    changes: [{ field: 'count', displayName: 'Count', oldValue: '0', newValue: String(docs.length) }],
    performedBy,
  });
  return { createdCount: docs.length };
}

export async function detectImplausibility(collegeId: string, achievementId: string) {
  const doc = await Achievement.findOne({ _id: achievementId, collegeId });
  if (!doc) throw new AppError(404, 'Achievement not found');

  const reasons: string[] = [];
  let score = 0;

  // Check: too many national-level achievements in a short window (same semester ~6 months)
  const sixMonthsAgo = new Date(doc.date);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAhead = new Date(doc.date);
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

  const nationalCount = await Achievement.countDocuments({
    collegeId,
    studentId: doc.studentId,
    level: 'national',
    date: { $gte: sixMonthsAgo, $lte: sixMonthsAhead },
  });

  if (nationalCount > 5) {
    score += 60;
    reasons.push(`Student has ${nationalCount} national-level achievements in the same semester window`);
  }

  // Check: international level with no evidence
  if (doc.level === 'international' && (!doc.evidenceFiles || doc.evidenceFiles.length === 0)) {
    score += 30;
    reasons.push('International-level achievement with no evidence files');
  }

  // Check: multiple achievements on the same date
  const sameDateCount = await Achievement.countDocuments({
    collegeId,
    studentId: doc.studentId,
    date: doc.date,
  });
  if (sameDateCount > 3) {
    score += 20;
    reasons.push(`${sameDateCount} achievements recorded on the same date`);
  }

  // Cap at 100
  score = Math.min(score, 100);

  doc.implausibilityScore = score;
  doc.implausibilityReasons = reasons;
  await doc.save();

  return { score, reasons };
}

// ─── Award CRUD ──────────────────────────────────────────

export async function listAwards(collegeId: string, page: number, limit: number, category?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (category) filter.category = category;
  return paginate(Award, filter, page, limit);
}

export async function getAward(collegeId: string, id: string) {
  const doc = await Award.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Award not found');
  return doc;
}

export async function createAward(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await Award.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'Award',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateAward(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await Award.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Award not found');
  await createAuditLog({
    collegeId,
    entityType: 'Award',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteAward(collegeId: string, id: string, performedBy: string) {
  const doc = await Award.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Award not found');
  await createAuditLog({
    collegeId,
    entityType: 'Award',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ─── Award Instance Workflow ─────────────────────────────

export async function listAwardInstances(
  collegeId: string,
  page: number,
  limit: number,
  awardId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (awardId) filter.awardId = awardId;
  if (status) filter.status = status;
  return paginate(AwardInstance, filter, page, limit);
}

export async function getAwardInstance(collegeId: string, id: string) {
  const doc = await AwardInstance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Award instance not found');
  return doc;
}

export async function nominateForAward(
  collegeId: string,
  data: { awardId: string; studentId: string; academicYearId: string; nominatedBy: string; justification?: string },
  performedBy: string,
) {
  const award = await Award.findOne({ _id: data.awardId, collegeId });
  if (!award) throw new AppError(404, 'Award not found');
  if (!award.isActive) throw new AppError(400, 'Award is not active');

  const existing = await AwardInstance.findOne({
    collegeId,
    awardId: data.awardId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
  });
  if (existing) throw new AppError(409, 'Student already nominated for this award in the given academic year');

  const doc = await AwardInstance.create({
    collegeId,
    awardId: data.awardId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    nominatedBy: data.nominatedBy,
    justification: data.justification,
    status: 'nominated',
  });
  await createAuditLog({
    collegeId,
    entityType: 'AwardInstance',
    entityId: String(doc._id),
    entityName: award.name,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function conferAward(
  collegeId: string,
  awardInstanceId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const doc = await AwardInstance.findOne({ _id: awardInstanceId, collegeId });
  if (!doc) throw new AppError(404, 'Award instance not found');
  if (!['nominated', 'shortlisted', 'approved'].includes(doc.status)) {
    throw new AppError(400, 'Award instance cannot be conferred from current status');
  }
  const oldStatus = doc.status;
  doc.status = 'conferred';
  doc.conferredDate = new Date();
  doc.approvedBy = data.approvedBy as never;
  await doc.save();
  await createAuditLog({
    collegeId,
    entityType: 'AwardInstance',
    entityId: String(doc._id),
    entityName: `AwardInstance ${String(doc._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'conferred' }],
    performedBy,
  });
  return doc;
}

// ─── Certificate ─────────────────────────────────────────

export async function listCertificates(
  collegeId: string,
  page: number,
  limit: number,
  studentId?: string,
  type?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (type) filter.type = type;
  return paginate(Certificate, filter, page, limit);
}

export async function getCertificate(collegeId: string, id: string) {
  const doc = await Certificate.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Certificate not found');
  return doc;
}

export async function generateCertificate(
  collegeId: string,
  data: { type: string; studentId: string; sourceType: string; sourceId: string; templateId?: string; generatedData: Record<string, string>; signedBy?: string },
  performedBy: string,
) {
  const now = new Date();
  const doc = await Certificate.create({
    collegeId,
    type: data.type,
    studentId: data.studentId,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    templateId: data.templateId,
    generatedData: data.generatedData,
    status: data.signedBy ? 'issued' : 'draft',
    signedBy: data.signedBy,
    signatureDate: data.signedBy ? now : undefined,
    issuedDate: data.signedBy ? now : undefined,
  });
  await createAuditLog({
    collegeId,
    entityType: 'Certificate',
    entityId: String(doc._id),
    entityName: `${data.type} certificate`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function issueCertificate(
  collegeId: string,
  certificateId: string,
  data: { signedBy: string; fileUrl?: string },
  performedBy: string,
) {
  const doc = await Certificate.findOne({ _id: certificateId, collegeId });
  if (!doc) throw new AppError(404, 'Certificate not found');
  if (doc.status !== 'draft') throw new AppError(400, 'Certificate is not in draft status');

  const now = new Date();
  doc.status = 'issued';
  doc.signedBy = data.signedBy as never;
  doc.signatureDate = now;
  doc.issuedDate = now;
  if (data.fileUrl) doc.fileUrl = data.fileUrl;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Certificate',
    entityId: String(doc._id),
    entityName: `${doc.type} certificate`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'issued' }],
    performedBy,
  });
  return doc;
}

export async function revokeCertificate(collegeId: string, certificateId: string, performedBy: string) {
  const doc = await Certificate.findOne({ _id: certificateId, collegeId });
  if (!doc) throw new AppError(404, 'Certificate not found');
  if (doc.status !== 'issued') throw new AppError(400, 'Certificate is not in issued status');

  doc.status = 'revoked';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Certificate',
    entityId: String(doc._id),
    entityName: `${doc.type} certificate`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'issued', newValue: 'revoked' }],
    performedBy,
  });
  return doc;
}
