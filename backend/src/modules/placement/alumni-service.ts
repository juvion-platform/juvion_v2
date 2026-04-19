import mongoose from 'mongoose';
import { AlumniCareerRecord } from '../../models/placement/AlumniCareerRecord';
import { AlumniProfile } from '../../models/placement/AlumniProfile';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// Keep AlumniProfile referenced so TS doesn't strip the import (used indirectly via ref population)
void AlumniProfile;

// ─── Alumni Career Records ───────────────────────────────

export async function listAlumniCareerRecords(
  collegeId: string,
  page = 1,
  limit = 20,
  careerStatus?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (careerStatus) filter.careerStatus = careerStatus;
  return paginate(AlumniCareerRecord, filter, page, limit, { lastUpdated: -1 }, ['personId', 'alumniProfileId']);
}

export async function getAlumniCareerRecord(collegeId: string, id: string) {
  const doc = await AlumniCareerRecord.findOne({ _id: id, collegeId }).populate('personId alumniProfileId');
  if (!doc) throw new AppError(404, 'Alumni career record not found');
  return doc;
}

export async function initAlumniCareerRecord(
  collegeId: string,
  data: {
    personId: string;
    alumniProfileId: string;
    currentEmployer?: string;
    currentRole?: string;
    ctcRange?: string;
    industry?: string;
    location?: string;
    careerStatus?: string;
    updateSource: string;
  },
  performedBy: string,
) {
  const existing = await AlumniCareerRecord.findOne({ collegeId, personId: data.personId });
  if (existing) throw new AppError(409, 'Alumni career record already exists for this person');

  const doc = await AlumniCareerRecord.create({
    ...data,
    collegeId,
    lastUpdated: new Date(),
    isStale: false,
  });

  await createAuditLog({
    collegeId,
    entityType: 'AlumniCareerRecord',
    entityId: String(doc._id),
    entityName: `Career ${data.currentRole || data.careerStatus || 'record'}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateAlumniCareerRecord(
  collegeId: string,
  id: string,
  data: Partial<{
    currentEmployer: string;
    currentRole: string;
    ctcRange: string;
    industry: string;
    location: string;
    careerStatus: string;
    updateSource: string;
  }>,
  performedBy: string,
) {
  const doc = await AlumniCareerRecord.findOneAndUpdate(
    { _id: id, collegeId },
    { ...data, lastUpdated: new Date(), isStale: false },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Alumni career record not found');

  await createAuditLog({
    collegeId,
    entityType: 'AlumniCareerRecord',
    entityId: id,
    entityName: `Career ${doc.currentRole || doc.careerStatus}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function batchInitFromGraduation(
  collegeId: string,
  data: {
    alumniProfiles: {
      personId: string;
      alumniProfileId: string;
      employer?: string;
      role?: string;
    }[];
  },
  performedBy: string,
) {
  const docs = data.alumniProfiles.map((p) => ({
    collegeId,
    personId: p.personId,
    alumniProfileId: p.alumniProfileId,
    currentEmployer: p.employer,
    currentRole: p.role,
    careerStatus: p.employer ? 'employed' : 'unknown',
    updateSource: 'system_seeded',
    lastUpdated: new Date(),
    isStale: false,
  }));

  const result = await AlumniCareerRecord.insertMany(docs, { ordered: false });

  await createAuditLog({
    collegeId,
    entityType: 'AlumniCareerRecord',
    entityId: 'batch',
    entityName: `Batch init ${result.length} career records`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { createdCount: result.length };
}

export async function markStaleRecords(collegeId: string, _performedBy: string) {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const result = await AlumniCareerRecord.updateMany(
    { collegeId, lastUpdated: { $lt: twoYearsAgo }, isStale: false },
    { $set: { isStale: true } },
  );

  return { markedStale: result.modifiedCount };
}

export async function getAlumniAnalytics(collegeId: string) {
  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregations actually match documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const [statusBreakdown, staleAgg, topIndustries] = await Promise.all([
    AlumniCareerRecord.aggregate([
      { $match: { collegeId: cidObj } },
      { $group: { _id: '$careerStatus', count: { $sum: 1 } } },
    ]),
    AlumniCareerRecord.countDocuments({ collegeId, isStale: true }),
    AlumniCareerRecord.aggregate([
      { $match: { collegeId: cidObj, industry: { $ne: null } } },
      { $group: { _id: '$industry', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return {
    statusBreakdown: statusBreakdown.map((s) => ({ status: s._id, count: s.count })),
    staleCount: staleAgg,
    topIndustries: topIndustries.map((i) => ({ industry: i._id, count: i.count })),
  };
}
