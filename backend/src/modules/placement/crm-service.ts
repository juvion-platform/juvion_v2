import { Company } from '../../models/placement/Company';
import { CompanyEngagementLog } from '../../models/placement/CompanyEngagementLog';
import { CompanyProgrammeAffinity } from '../../models/placement/CompanyProgrammeAffinity';
import { RecruiterAccount } from '../../models/placement/RecruiterAccount';
import { RecruiterActivityLog } from '../../models/placement/RecruiterActivityLog';
import { PlacementDrive } from '../../models/placement/PlacementDrive';
import { PlacementOffer } from '../../models/placement/PlacementOffer';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ═══════════════════════════════════════════════════════════════════════════
// CRM: Company Engagement
// ═══════════════════════════════════════════════════════════════════════════

/** List engagement logs for a company, sorted by timestamp desc */
export async function listEngagementLogs(
  collegeId: string,
  companyId: string,
  page = 1,
  limit = 20,
) {
  return paginate(
    CompanyEngagementLog,
    { collegeId, companyId },
    page,
    limit,
    { timestamp: -1 },
    ['companyId', 'actorId', 'placementSeasonId'],
  );
}

/** Create an engagement log, update company lastEngagementDate, and recompute relationship health */
export async function createEngagementLog(
  collegeId: string,
  data: {
    companyId: string;
    placementSeasonId?: string;
    type: string;
    outcome?: string;
    notes: string;
    actorId: string;
  },
  performedBy: string,
) {
  const doc = await CompanyEngagementLog.create({
    ...data,
    collegeId,
    timestamp: new Date(),
  });

  // Update company lastEngagementDate
  await Company.findOneAndUpdate(
    { _id: data.companyId, collegeId },
    { lastEngagementDate: new Date() },
  );

  // Recompute relationship health
  await computeRelationshipHealth(collegeId, data.companyId);

  await createAuditLog({
    collegeId,
    entityType: 'CompanyEngagementLog',
    entityId: String(doc._id),
    entityName: `${data.type} engagement`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

/** AI placeholder: Score the pipeline for a company within a season */
export async function scorePipeline(
  collegeId: string,
  placementSeasonId: string,
  companyId: string,
  _performedBy: string,
) {
  // Count historical offers for this company
  const offers = await PlacementOffer.countDocuments({ collegeId, companyId });

  // Count engagement logs in last year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const engagements = await CompanyEngagementLog.countDocuments({
    collegeId,
    companyId,
    timestamp: { $gte: oneYearAgo },
  });

  // Compute simple score
  const score = Math.min(100, offers * 10 + engagements * 5);

  // Determine tier based on score
  let tier: 'tier_1' | 'tier_2' | 'tier_3';
  if (score >= 70) {
    tier = 'tier_1';
  } else if (score >= 40) {
    tier = 'tier_2';
  } else {
    tier = 'tier_3';
  }

  // Update company pipelineTier
  await Company.findOneAndUpdate(
    { _id: companyId, collegeId },
    { pipelineTier: tier },
  );

  // Suppress unused-variable warning — placementSeasonId reserved for future AI scoring
  void placementSeasonId;

  return { score, tier };
}

/** Get pipeline dashboard: all companies with pipelineTier, sorted by relationshipHealthScore desc */
export async function getPipelineDashboard(
  collegeId: string,
  placementSeasonId: string,
) {
  // Suppress unused-variable warning — reserved for season-scoped filtering
  void placementSeasonId;

  const companies = await Company.find({ collegeId, pipelineTier: { $ne: null } })
    .sort({ relationshipHealthScore: -1 })
    .lean();

  return companies;
}

/** Blacklist a company: set flags, create engagement log, audit */
export async function blacklistCompany(
  collegeId: string,
  companyId: string,
  data: { reason: string },
  performedBy: string,
) {
  const company = await Company.findOne({ _id: companyId, collegeId });
  if (!company) throw new AppError(404, 'Company not found');
  if (company.blacklistFlag) throw new AppError(400, 'Company is already blacklisted');

  company.blacklistFlag = true;
  company.blacklistReason = data.reason;
  company.relationshipStatus = 'blacklisted';
  await company.save();

  // Create engagement log for blacklist action
  await CompanyEngagementLog.create({
    collegeId,
    companyId,
    type: 'blacklist',
    outcome: 'negative',
    notes: `Blacklisted: ${data.reason}`,
    actorId: performedBy,
    timestamp: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'Company',
    entityId: String(company._id),
    entityName: company.name,
    action: 'update',
    changes: [
      { field: 'blacklistFlag', displayName: 'Blacklist Flag', oldValue: false, newValue: true },
      { field: 'relationshipStatus', displayName: 'Relationship Status', oldValue: company.relationshipStatus, newValue: 'blacklisted' },
    ],
    performedBy,
  });

  return company;
}

/** Reinstate a blacklisted company: clear flags, create engagement log, audit */
export async function reinstateCompany(
  collegeId: string,
  companyId: string,
  performedBy: string,
) {
  const company = await Company.findOne({ _id: companyId, collegeId });
  if (!company) throw new AppError(404, 'Company not found');
  if (!company.blacklistFlag) throw new AppError(400, 'Company is not blacklisted');

  const oldReason = company.blacklistReason;
  company.blacklistFlag = false;
  company.blacklistReason = undefined;
  company.relationshipStatus = 'active';
  await company.save();

  // Create engagement log for reinstatement
  await CompanyEngagementLog.create({
    collegeId,
    companyId,
    type: 'general',
    outcome: 'positive',
    notes: `Reinstated from blacklist. Previous reason: ${oldReason || 'N/A'}`,
    actorId: performedBy,
    timestamp: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'Company',
    entityId: String(company._id),
    entityName: company.name,
    action: 'update',
    changes: [
      { field: 'blacklistFlag', displayName: 'Blacklist Flag', oldValue: true, newValue: false },
      { field: 'relationshipStatus', displayName: 'Relationship Status', oldValue: 'blacklisted', newValue: 'active' },
    ],
    performedBy,
  });

  return company;
}

/** AI placeholder: Compute relationship health score for a company */
export async function computeRelationshipHealth(
  collegeId: string,
  companyId: string,
) {
  // Get engagement logs for last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const logs = await CompanyEngagementLog.find({
    collegeId,
    companyId,
    timestamp: { $gte: twelveMonthsAgo },
  }).lean();

  const totalLogs = logs.length;
  if (totalLogs === 0) {
    await Company.findOneAndUpdate(
      { _id: companyId, collegeId },
      { relationshipHealthScore: 0 },
    );
    return 0;
  }

  // Count positive/negative outcomes
  const positiveOutcomes = ['interested', 'positive'];
  const negativeOutcomes = ['declined', 'negative'];
  let positiveCount = 0;
  let negativeCount = 0;

  for (const log of logs) {
    if (log.outcome && positiveOutcomes.includes(log.outcome)) positiveCount++;
    if (log.outcome && negativeOutcomes.includes(log.outcome)) negativeCount++;
  }

  const totalWithOutcome = positiveCount + negativeCount;
  const positivePercent = totalWithOutcome > 0 ? positiveCount / totalWithOutcome : 0.5;

  // Recency score: days since last engagement (0-100 scale, 100=today)
  const mostRecentTimestamp = logs.reduce(
    (latest, log) => (log.timestamp > latest ? log.timestamp : latest),
    logs[0]!.timestamp,
  );
  const daysSinceLast = Math.floor(
    (Date.now() - new Date(mostRecentTimestamp).getTime()) / (1000 * 60 * 60 * 24),
  );
  const recencyScore = Math.max(0, 100 - daysSinceLast);

  // Engagement frequency: normalize to 0-100 (assume 24+ engagements/year = 100)
  const frequencyScore = Math.min(100, (totalLogs / 24) * 100);

  // Score = (positive% * 40) + (recency * 30) + (frequency * 30)
  const score = Math.round(
    positivePercent * 40 + (recencyScore / 100) * 30 + (frequencyScore / 100) * 30,
  );

  // Update company
  await Company.findOneAndUpdate(
    { _id: companyId, collegeId },
    { relationshipHealthScore: score },
  );

  return score;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRM: Programme Affinity
// ═══════════════════════════════════════════════════════════════════════════

/** List programme affinity records for a company */
export async function listProgrammeAffinity(
  collegeId: string,
  companyId: string,
  page = 1,
  limit = 20,
) {
  return paginate(
    CompanyProgrammeAffinity,
    { collegeId, companyId },
    page,
    limit,
    { createdAt: -1 },
    ['companyId', 'programmeId', 'placementSeasonId'],
  );
}

/** Get a single programme affinity record */
export async function getProgrammeAffinity(collegeId: string, id: string) {
  const doc = await CompanyProgrammeAffinity.findOne({ _id: id, collegeId })
    .populate('companyId programmeId placementSeasonId');
  if (!doc) throw new AppError(404, 'Programme affinity record not found');
  return doc;
}

/** Create a programme affinity record */
export async function createProgrammeAffinity(
  collegeId: string,
  data: any,
  performedBy: string,
) {
  const doc = await CompanyProgrammeAffinity.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'CompanyProgrammeAffinity',
    entityId: String(doc._id),
    entityName: `Affinity ${String(doc.companyId)}-${String(doc.programmeId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

/** Update a programme affinity record */
export async function updateProgrammeAffinity(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await CompanyProgrammeAffinity.findOneAndUpdate(
    { _id: id, collegeId },
    { ...data, lastUpdated: new Date() },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Programme affinity record not found');

  await createAuditLog({
    collegeId,
    entityType: 'CompanyProgrammeAffinity',
    entityId: id,
    entityName: `Affinity ${String(doc.companyId)}-${String(doc.programmeId)}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

/** AI placeholder: Generate season analytics — drives, offers, placements grouped by company */
export async function generateSeasonAnalytics(
  collegeId: string,
  placementSeasonId: string,
  performedBy: string,
) {
  // Count drives and offers for season
  const totalDrives = await PlacementDrive.countDocuments({
    collegeId,
    placementSeasonId,
  });

  const totalOffers = await PlacementOffer.countDocuments({
    collegeId,
    driveId: {
      $in: (
        await PlacementDrive.find({ collegeId, placementSeasonId }).select('_id').lean()
      ).map((d) => d._id),
    },
  });

  // Group by company: offers count, avg CTC
  const companyStats = await PlacementOffer.aggregate([
    {
      $lookup: {
        from: 'placementdrives',
        localField: 'driveId',
        foreignField: '_id',
        as: 'drive',
      },
    },
    { $unwind: { path: '$drive', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        collegeId,
        'drive.placementSeasonId': placementSeasonId,
      },
    },
    {
      $group: {
        _id: '$companyId',
        offersCount: { $sum: 1 },
        avgCtc: { $avg: '$packageLpa' },
      },
    },
    { $sort: { offersCount: -1 } },
  ]);

  // Update CompanyProgrammeAffinity for each company-programme pair
  for (const stat of companyStats) {
    await CompanyProgrammeAffinity.updateMany(
      { collegeId, companyId: stat._id, placementSeasonId },
      {
        historicalHires: stat.offersCount,
        avgCtcLpa: Math.round((stat.avgCtc || 0) * 100) / 100,
        lastUpdated: new Date(),
      },
    );
  }

  // Top 5 companies by offers
  const topCompanies = companyStats.slice(0, 5).map((s) => ({
    companyId: s._id,
    offersCount: s.offersCount,
    avgCtc: Math.round((s.avgCtc || 0) * 100) / 100,
  }));

  await createAuditLog({
    collegeId,
    entityType: 'PlacementSeason',
    entityId: placementSeasonId,
    entityName: 'Season Analytics',
    action: 'update',
    changes: [{ field: 'analytics', displayName: 'Analytics', oldValue: null, newValue: 'generated' }],
    performedBy,
  });

  return { totalDrives, totalOffers, topCompanies };
}

// ═══════════════════════════════════════════════════════════════════════════
// Recruiter Portal
// ═══════════════════════════════════════════════════════════════════════════

/** List recruiter accounts with optional status/company filters */
export async function listRecruiterAccounts(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
  companyId?: string,
) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (companyId) filter.companyId = companyId;
  return paginate(RecruiterAccount, filter, page, limit, { createdAt: -1 }, ['personId', 'companyId']);
}

/** Get a single recruiter account */
export async function getRecruiterAccount(collegeId: string, id: string) {
  const doc = await RecruiterAccount.findOne({ _id: id, collegeId })
    .populate('personId companyId verifiedBy');
  if (!doc) throw new AppError(404, 'Recruiter account not found');
  return doc;
}

/** Register a new recruiter account */
export async function registerRecruiterAccount(
  collegeId: string,
  data: {
    personId: string;
    companyId: string;
    designation: string;
    email: string;
    phone?: string;
  },
  performedBy: string,
) {
  const doc = await RecruiterAccount.create({
    ...data,
    collegeId,
    status: 'registered',
  });

  // Create activity log for registration
  await RecruiterActivityLog.create({
    collegeId,
    recruiterAccountId: doc._id,
    action: 'registration',
    timestamp: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'RecruiterAccount',
    entityId: String(doc._id),
    entityName: data.email,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'registered' }],
    performedBy,
  });

  return doc;
}

/** Verify a recruiter account (registered -> verified) */
export async function verifyRecruiterAccount(
  collegeId: string,
  accountId: string,
  data: { verifiedBy: string },
  performedBy: string,
) {
  const account = await RecruiterAccount.findOne({ _id: accountId, collegeId });
  if (!account) throw new AppError(404, 'Recruiter account not found');
  if (account.status !== 'registered') {
    throw new AppError(400, 'Only registered accounts can be verified');
  }

  account.status = 'verified';
  account.verifiedBy = data.verifiedBy as any;
  account.verifiedAt = new Date();
  await account.save();

  // Create activity log for verification
  await RecruiterActivityLog.create({
    collegeId,
    recruiterAccountId: account._id,
    action: 'verification',
    timestamp: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'RecruiterAccount',
    entityId: String(account._id),
    entityName: account.email,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'registered', newValue: 'verified' },
      { field: 'verifiedBy', displayName: 'Verified By', oldValue: null, newValue: data.verifiedBy },
    ],
    performedBy,
  });

  return account;
}

/** Deactivate a recruiter account */
export async function deactivateRecruiterAccount(
  collegeId: string,
  accountId: string,
  data: { reason: string },
  performedBy: string,
) {
  const account = await RecruiterAccount.findOne({ _id: accountId, collegeId });
  if (!account) throw new AppError(404, 'Recruiter account not found');
  if (account.status === 'deactivated') {
    throw new AppError(400, 'Account is already deactivated');
  }

  const oldStatus = account.status;
  account.status = 'deactivated';
  account.deactivationReason = data.reason;
  await account.save();

  // Create activity log for deactivation
  await RecruiterActivityLog.create({
    collegeId,
    recruiterAccountId: account._id,
    action: 'deactivation',
    metadata: { reason: data.reason },
    timestamp: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'RecruiterAccount',
    entityId: String(account._id),
    entityName: account.email,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'deactivated' },
      { field: 'deactivationReason', displayName: 'Deactivation Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return account;
}

/** Log a recruiter activity entry */
export async function logRecruiterActivity(
  collegeId: string,
  data: {
    recruiterAccountId: string;
    action: string;
    targetEntityType?: string;
    targetEntityId?: string;
    metadata?: Record<string, unknown>;
  },
  _performedBy: string,
) {
  const doc = await RecruiterActivityLog.create({
    ...data,
    collegeId,
    timestamp: new Date(),
  });

  return doc;
}

/** Get activity log for a recruiter account, sorted by timestamp desc */
export async function getRecruiterActivityLog(
  collegeId: string,
  recruiterAccountId: string,
  page = 1,
  limit = 20,
) {
  return paginate(
    RecruiterActivityLog,
    { collegeId, recruiterAccountId },
    page,
    limit,
    { timestamp: -1 },
    ['recruiterAccountId'],
  );
}
