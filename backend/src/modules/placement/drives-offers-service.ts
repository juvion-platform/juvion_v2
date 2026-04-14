import { PlacementSeason } from '../../models/placement/PlacementSeason';
import { PlacementDrive } from '../../models/placement/PlacementDrive';
import { DriveApplication } from '../../models/placement/DriveApplication';
import { InterviewSchedule } from '../../models/placement/InterviewSchedule';
import { PlacementOffer } from '../../models/placement/PlacementOffer';
import { PlacementBar } from '../../models/placement/PlacementBar';
import { OptOutRecord } from '../../models/placement/OptOutRecord';
import { JobPosting } from '../../models/placement/JobPosting';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ─── State Machine Constants ─────────────────────────────

const DRIVE_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['jd_published', 'cancelled'],
  jd_published: ['applications_open', 'cancelled'],
  applications_open: ['applications_closed', 'cancelled'],
  applications_closed: ['shortlist_released', 'cancelled'],
  shortlist_released: ['interviews_in_progress', 'cancelled'],
  interviews_in_progress: ['offers_released', 'cancelled'],
  offers_released: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

const OFFER_TRANSITIONS: Record<string, string[]> = {
  extended: ['accepted', 'rejected', 'lapsed', 'revoked'],
  accepted: ['reneged', 'released'],
  rejected: [],
  lapsed: [],
  revoked: [],
  reneged: [],
  released: [],
};

const SEASON_TRANSITIONS: Record<string, string[]> = {
  planning: ['pre_season'],
  pre_season: ['open'],
  open: ['active'],
  active: ['wind_down'],
  wind_down: ['closed'],
  closed: [],
};

// ═══════════════════════════════════════════════════════════
// Season Lifecycle
// ═══════════════════════════════════════════════════════════

export async function transitionSeason(
  collegeId: string,
  seasonId: string,
  newStatus: string,
  performedBy: string,
) {
  const season = await PlacementSeason.findOne({ _id: seasonId, collegeId });
  if (!season) throw new AppError(404, 'Placement season not found');

  const allowed = SEASON_TRANSITIONS[season.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(400, `Cannot transition season from '${season.status}' to '${newStatus}'`);
  }

  // Guard: pre_season -> open requires eligible batches
  if (season.status === 'pre_season' && newStatus === 'open') {
    if (!season.eligibleBatches || season.eligibleBatches.length === 0) {
      throw new AppError(400, 'Cannot open season without eligible batches configured');
    }
  }

  // Guard: wind_down -> closed requires no drives in progress
  if (season.status === 'wind_down' && newStatus === 'closed') {
    const activeDrives = await PlacementDrive.countDocuments({
      collegeId,
      placementSeasonId: seasonId,
      status: { $nin: ['closed', 'cancelled'] },
    });
    if (activeDrives > 0) {
      throw new AppError(400, `Cannot close season — ${activeDrives} drive(s) still in progress`);
    }
  }

  const oldStatus = season.status;
  season.status = newStatus;
  await season.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementSeason',
    entityId: String(season._id),
    entityName: season.name,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: newStatus }],
    performedBy,
  });

  return season;
}

export async function getSeasonStatistics(collegeId: string, seasonId: string) {
  const season = await PlacementSeason.findOne({ _id: seasonId, collegeId });
  if (!season) throw new AppError(404, 'Placement season not found');

  const [totalDrives, totalApplications, totalOffers] = await Promise.all([
    PlacementDrive.countDocuments({ collegeId, placementSeasonId: seasonId }),
    DriveApplication.countDocuments({
      collegeId,
      driveId: { $in: await PlacementDrive.find({ collegeId, placementSeasonId: seasonId }).distinct('_id') },
    }),
    PlacementOffer.countDocuments({
      collegeId,
      driveId: { $in: await PlacementDrive.find({ collegeId, placementSeasonId: seasonId }).distinct('_id') },
    }),
  ]);

  const acceptedOffers = await PlacementOffer.find({
    collegeId,
    driveId: { $in: await PlacementDrive.find({ collegeId, placementSeasonId: seasonId }).distinct('_id') },
    status: 'accepted',
  }).lean();

  const totalPlaced = acceptedOffers.length;
  const ctcValues = acceptedOffers.map((o) => o.packageLpa).sort((a, b) => a - b);

  const avgCtc = ctcValues.length > 0 ? ctcValues.reduce((s, v) => s + v, 0) / ctcValues.length : 0;
  const maxCtc = ctcValues.length > 0 ? ctcValues[ctcValues.length - 1]! : 0;
  const medianCtc =
    ctcValues.length > 0
      ? ctcValues.length % 2 === 1
        ? ctcValues[Math.floor(ctcValues.length / 2)]!
        : (ctcValues[ctcValues.length / 2 - 1]! + ctcValues[ctcValues.length / 2]!) / 2
      : 0;

  // Eligible = all registered students minus opted-out
  const optedOut = await OptOutRecord.countDocuments({
    collegeId,
    placementSeasonId: seasonId,
    status: 'active',
  });
  // Placeholder: eligible count from registrations would come from PlacementRegistration
  // For now approximate from applications + opted-out
  const eligible = totalApplications + optedOut || 1; // avoid division by zero
  const placementRate = totalPlaced / eligible;

  return {
    totalDrives,
    totalApplications,
    totalOffers,
    totalPlaced,
    avgCtc: Math.round(avgCtc * 100) / 100,
    medianCtc: Math.round(medianCtc * 100) / 100,
    maxCtc,
    placementRate: Math.round(placementRate * 10000) / 10000,
  };
}

// ═══════════════════════════════════════════════════════════
// Drive Lifecycle
// ═══════════════════════════════════════════════════════════

export async function listDrives(
  collegeId: string,
  page = 1,
  limit = 20,
  placementSeasonId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (placementSeasonId) filter.placementSeasonId = placementSeasonId;
  if (status) filter.status = status;
  return paginate(PlacementDrive, filter, page, limit, { createdAt: -1 }, ['companyId', 'jobPostingId']);
}

export async function getDrive(collegeId: string, id: string) {
  const doc = await PlacementDrive.findOne({ _id: id, collegeId })
    .populate('companyId')
    .populate('jobPostingId');
  if (!doc) throw new AppError(404, 'Placement drive not found');
  return doc;
}

export async function createDrive(
  collegeId: string,
  data: {
    placementSeasonId: string;
    companyId: string;
    jobPostingId: string;
    type: string;
    applicationWindow: { openDate: Date; closeDate: Date };
    driveDate?: Date;
    venue?: string;
    virtualLink?: string;
  },
  performedBy: string,
) {
  const doc = await PlacementDrive.create({
    ...data,
    collegeId,
    status: 'scheduled',
  });

  await createAuditLog({
    collegeId,
    entityType: 'PlacementDrive',
    entityId: String(doc._id),
    entityName: `Drive ${String(doc._id)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function transitionDrive(
  collegeId: string,
  driveId: string,
  newStatus: string,
  performedBy: string,
) {
  const drive = await PlacementDrive.findOne({ _id: driveId, collegeId });
  if (!drive) throw new AppError(404, 'Placement drive not found');

  const allowed = DRIVE_TRANSITIONS[drive.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(400, `Cannot transition drive from '${drive.status}' to '${newStatus}'`);
  }

  const oldStatus = drive.status;
  drive.status = newStatus;
  await drive.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementDrive',
    entityId: String(drive._id),
    entityName: `Drive ${String(drive._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: newStatus }],
    performedBy,
  });

  return drive;
}

export async function cancelDrive(
  collegeId: string,
  driveId: string,
  data: { reason: string },
  performedBy: string,
) {
  const drive = await PlacementDrive.findOne({ _id: driveId, collegeId });
  if (!drive) throw new AppError(404, 'Placement drive not found');

  if (drive.status === 'closed' || drive.status === 'cancelled') {
    throw new AppError(400, `Drive is already '${drive.status}' and cannot be cancelled`);
  }

  const oldStatus = drive.status;
  drive.status = 'cancelled';
  await drive.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementDrive',
    entityId: String(drive._id),
    entityName: `Drive ${String(drive._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
      { field: 'cancellationReason', displayName: 'Cancellation Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return drive;
}

// ═══════════════════════════════════════════════════════════
// Drive Applications
// ═══════════════════════════════════════════════════════════

export async function listDriveApplications(
  collegeId: string,
  driveId: string,
  page = 1,
  limit = 20,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId, driveId };
  if (status) filter.status = status;
  return paginate(DriveApplication, filter, page, limit, { createdAt: -1 }, ['studentId', 'jobPostingId']);
}

export async function getDriveApplication(collegeId: string, id: string) {
  const doc = await DriveApplication.findOne({ _id: id, collegeId })
    .populate('studentId')
    .populate('jobPostingId');
  if (!doc) throw new AppError(404, 'Drive application not found');
  return doc;
}

export async function applyToDrive(
  collegeId: string,
  data: { driveId: string; jobPostingId: string; studentId: string; resumeUrl?: string },
  performedBy: string,
) {
  // Check drive is accepting applications
  const drive = await PlacementDrive.findOne({ _id: data.driveId, collegeId });
  if (!drive) throw new AppError(404, 'Placement drive not found');
  if (drive.status !== 'applications_open') {
    throw new AppError(400, 'Drive is not accepting applications at this time');
  }

  // Run eligibility check
  const eligibility = await checkEligibility(collegeId, data.studentId, data.jobPostingId);
  if (!eligibility.eligible) {
    throw new AppError(400, `Student is ineligible: ${eligibility.reasons.join('; ')}`);
  }

  // AI placeholder: matchScore
  const matchScore = Math.floor(Math.random() * 40 + 60);
  const matchConfidence: 'high' | 'medium' | 'low' =
    matchScore >= 85 ? 'high' : matchScore >= 70 ? 'medium' : 'low';

  const now = new Date();
  const doc = await DriveApplication.create({
    collegeId,
    driveId: data.driveId,
    jobPostingId: data.jobPostingId,
    studentId: data.studentId,
    resumeUrl: data.resumeUrl,
    consentTimestamp: now,
    appliedAt: now,
    matchScore,
    matchConfidence,
    status: 'applied',
  });

  // Increment drive application count
  await PlacementDrive.updateOne(
    { _id: data.driveId, collegeId },
    { $inc: { applicationCount: 1 } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'DriveApplication',
    entityId: String(doc._id),
    entityName: `Application ${String(doc._id)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function withdrawApplication(
  collegeId: string,
  applicationId: string,
  data: { reason: string },
  performedBy: string,
) {
  const app = await DriveApplication.findOne({ _id: applicationId, collegeId });
  if (!app) throw new AppError(404, 'Drive application not found');

  if (app.status !== 'applied' && app.status !== 'shortlisted') {
    throw new AppError(400, `Cannot withdraw application with status '${app.status}'`);
  }

  const oldStatus = app.status;
  app.status = 'withdrawn';
  app.withdrawalReason = data.reason;
  await app.save();

  await createAuditLog({
    collegeId,
    entityType: 'DriveApplication',
    entityId: String(app._id),
    entityName: `Application ${String(app._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'withdrawn' },
      { field: 'withdrawalReason', displayName: 'Withdrawal Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return app;
}

export async function generateShortlist(
  collegeId: string,
  driveId: string,
  performedBy: string,
) {
  const drive = await PlacementDrive.findOne({ _id: driveId, collegeId }).populate('jobPostingId');
  if (!drive) throw new AppError(404, 'Placement drive not found');

  // Get all applied applications sorted by matchScore descending
  const applications = await DriveApplication.find({
    collegeId,
    driveId,
    status: 'applied',
  }).sort({ matchScore: -1 });

  // Determine shortlist size
  const jobPosting = await JobPosting.findOne({ _id: drive.jobPostingId, collegeId });
  const maxPositions = jobPosting?.maxPositions ?? 1;
  const shortlistSize = Math.max(maxPositions * 3, 10);
  const toShortlist = applications.slice(0, shortlistSize);

  // Bulk update to shortlisted
  const shortlistedIds = toShortlist.map((a) => a._id);
  await DriveApplication.updateMany(
    { _id: { $in: shortlistedIds } },
    { $set: { status: 'shortlisted' } },
  );

  // Update drive shortlisted count
  await PlacementDrive.updateOne(
    { _id: driveId, collegeId },
    { $set: { shortlistedCount: shortlistedIds.length } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'PlacementDrive',
    entityId: String(drive._id),
    entityName: `Drive ${String(drive._id)}`,
    action: 'update',
    changes: [
      { field: 'shortlistedCount', displayName: 'Shortlisted Count', oldValue: 0, newValue: shortlistedIds.length },
    ],
    performedBy,
  });

  return { shortlistedCount: shortlistedIds.length, total: applications.length };
}

export async function releaseShortlist(
  collegeId: string,
  driveId: string,
  performedBy: string,
) {
  const drive = await PlacementDrive.findOne({ _id: driveId, collegeId });
  if (!drive) throw new AppError(404, 'Placement drive not found');

  if (drive.status !== 'applications_closed') {
    throw new AppError(400, `Cannot release shortlist — drive status is '${drive.status}', expected 'applications_closed'`);
  }

  return transitionDrive(collegeId, driveId, 'shortlist_released', performedBy);
}

// ═══════════════════════════════════════════════════════════
// Interview Scheduling
// ═══════════════════════════════════════════════════════════

export async function listInterviewSchedules(
  collegeId: string,
  driveId: string,
  page = 1,
  limit = 20,
) {
  return paginate(
    InterviewSchedule,
    { collegeId, driveId },
    page,
    limit,
    { slotStart: 1 },
    ['studentId'],
  );
}

export async function getInterviewSchedule(collegeId: string, id: string) {
  const doc = await InterviewSchedule.findOne({ _id: id, collegeId }).populate('studentId');
  if (!doc) throw new AppError(404, 'Interview schedule not found');
  return doc;
}

export async function scheduleInterviews(
  collegeId: string,
  driveId: string,
  data: {
    slots: {
      studentId: string;
      slotStart: Date;
      slotEnd: Date;
      venue?: string;
      virtualLink?: string;
      panelInfo?: string;
    }[];
  },
  performedBy: string,
) {
  const drive = await PlacementDrive.findOne({ _id: driveId, collegeId });
  if (!drive) throw new AppError(404, 'Placement drive not found');

  const schedules = await InterviewSchedule.insertMany(
    data.slots.map((slot) => ({
      collegeId,
      driveId,
      studentId: slot.studentId,
      slotStart: slot.slotStart,
      slotEnd: slot.slotEnd,
      venue: slot.venue,
      virtualLink: slot.virtualLink,
      panelInfo: slot.panelInfo,
      status: 'scheduled',
    })),
  );

  // Transition drive to interviews_in_progress if not already
  if (drive.status !== 'interviews_in_progress') {
    const allowed = DRIVE_TRANSITIONS[drive.status];
    if (allowed && allowed.includes('interviews_in_progress')) {
      drive.status = 'interviews_in_progress';
      await drive.save();
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'PlacementDrive',
    entityId: String(drive._id),
    entityName: `Drive ${String(drive._id)}`,
    action: 'update',
    changes: [
      { field: 'interviewsScheduled', displayName: 'Interviews Scheduled', oldValue: null, newValue: schedules.length },
    ],
    performedBy,
  });

  return schedules;
}

export async function updateInterviewOutcome(
  collegeId: string,
  scheduleId: string,
  data: { status: string; outcome?: string },
  performedBy: string,
) {
  const schedule = await InterviewSchedule.findOne({ _id: scheduleId, collegeId });
  if (!schedule) throw new AppError(404, 'Interview schedule not found');

  const oldStatus = schedule.status;
  const oldOutcome = schedule.outcome;
  schedule.status = data.status;
  if (data.outcome) schedule.outcome = data.outcome;
  await schedule.save();

  await createAuditLog({
    collegeId,
    entityType: 'InterviewSchedule',
    entityId: String(schedule._id),
    entityName: `Interview ${String(schedule._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: data.status },
      ...(data.outcome
        ? [{ field: 'outcome', displayName: 'Outcome', oldValue: oldOutcome ?? null, newValue: data.outcome }]
        : []),
    ],
    performedBy,
  });

  return schedule;
}

// ═══════════════════════════════════════════════════════════
// Eligibility + Dream Policy
// ═══════════════════════════════════════════════════════════

export async function checkEligibility(
  collegeId: string,
  studentId: string,
  jobPostingId: string,
): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const jobPosting = await JobPosting.findOne({ _id: jobPostingId, collegeId });
  if (!jobPosting) {
    return { eligible: false, reasons: ['Job posting not found'] };
  }

  // Placeholder: minCgpa check — real M03 cross-module read would go here
  // if (student.cgpa < jobPosting.minCgpa) reasons.push(...)

  // Placeholder: noActiveBacklogs check — skip for now

  // Placeholder: programme eligibility check — skip for now

  // Check placement bar
  const bar = await PlacementBar.findOne({ collegeId, studentId, status: 'active' });
  if (bar) {
    reasons.push(`Student has an active placement bar: ${bar.reason}`);
  }

  // Check opt-out
  const optOut = await OptOutRecord.findOne({ collegeId, studentId, status: 'active' });
  if (optOut) {
    reasons.push(`Student has opted out of placements: ${optOut.reason}`);
  }

  // Check dream policy
  const dreamResult = await checkDreamPolicy(collegeId, studentId, jobPostingId);
  if (!dreamResult.allowed) {
    reasons.push(dreamResult.reason ?? 'Dream policy blocks this application');
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function checkDreamPolicy(
  collegeId: string,
  studentId: string,
  jobPostingId: string,
): Promise<{
  allowed: boolean;
  currentOfferCtc?: number;
  driveCtc?: number;
  threshold?: number;
  reason?: string;
}> {
  // Find accepted offer for student
  const acceptedOffer = await PlacementOffer.findOne({
    collegeId,
    studentId,
    status: 'accepted',
  });

  if (!acceptedOffer) {
    return { allowed: true };
  }

  const jobPosting = await JobPosting.findOne({ _id: jobPostingId, collegeId });
  if (!jobPosting) {
    return { allowed: false, reason: 'Job posting not found' };
  }

  // Get season dream threshold
  const season = await PlacementSeason.findOne({ _id: jobPosting.placementSeasonId, collegeId });
  const threshold = season?.dreamThreshold ?? 1.5;

  const currentOfferCtc = acceptedOffer.packageLpa;
  const driveCtc = jobPosting.packageLpa;

  if (driveCtc >= threshold * currentOfferCtc) {
    return { allowed: true, currentOfferCtc, driveCtc, threshold };
  }

  return {
    allowed: false,
    currentOfferCtc,
    driveCtc,
    threshold,
    reason: `Dream policy: new CTC (${driveCtc} LPA) must be >= ${threshold}x current offer (${currentOfferCtc} LPA = ${threshold * currentOfferCtc} LPA threshold)`,
  };
}

// ═══════════════════════════════════════════════════════════
// Offer Lifecycle
// ═══════════════════════════════════════════════════════════

export async function listOffersByDrive(
  collegeId: string,
  driveId: string,
  page = 1,
  limit = 20,
) {
  return paginate(
    PlacementOffer,
    { collegeId, driveId },
    page,
    limit,
    { createdAt: -1 },
    ['studentId', 'companyId', 'jobPostingId'],
  );
}

export async function createOfferFromDrive(
  collegeId: string,
  data: {
    driveId: string;
    jobPostingId: string;
    studentId: string;
    companyId: string;
    packageLpa: number;
    role?: string;
    location?: string;
    bondTerms?: string;
    responseDeadline?: Date;
    source?: string;
  },
  performedBy: string,
) {
  const offer = await PlacementOffer.create({
    collegeId,
    driveId: data.driveId,
    jobPostingId: data.jobPostingId,
    studentId: data.studentId,
    companyId: data.companyId,
    packageLpa: data.packageLpa,
    role: data.role,
    location: data.location,
    bondTerms: data.bondTerms,
    responseDeadline: data.responseDeadline,
    source: data.source ?? 'campus',
    offerDate: new Date(),
    status: 'extended',
  });

  // Update application status to 'offered'
  await DriveApplication.updateOne(
    { collegeId, driveId: data.driveId, studentId: data.studentId },
    { $set: { status: 'offered' } },
  );

  // Increment drive offered count
  await PlacementDrive.updateOne(
    { _id: data.driveId, collegeId },
    { $inc: { offeredCount: 1 } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'PlacementOffer',
    entityId: String(offer._id),
    entityName: `Offer ${String(offer._id)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return offer;
}

export async function acceptOffer(
  collegeId: string,
  offerId: string,
  performedBy: string,
) {
  const offer = await PlacementOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Placement offer not found');

  const allowed = OFFER_TRANSITIONS[offer.status];
  if (!allowed || !allowed.includes('accepted')) {
    throw new AppError(400, `Cannot accept offer with status '${offer.status}'`);
  }

  // Dream threshold activation: if student had a previous accepted offer
  // and this is a dream offer, release the previous offer
  const previousAccepted = await PlacementOffer.findOne({
    collegeId,
    studentId: offer.studentId,
    status: 'accepted',
    _id: { $ne: offer._id },
  });

  offer.status = 'accepted';
  if (previousAccepted) {
    (offer as any).previousOfferId = previousAccepted._id;
    // Release the previous offer
    previousAccepted.status = 'released';
    await previousAccepted.save();

    await createAuditLog({
      collegeId,
      entityType: 'PlacementOffer',
      entityId: String(previousAccepted._id),
      entityName: `Offer ${String(previousAccepted._id)}`,
      action: 'update',
      changes: [
        { field: 'status', displayName: 'Status', oldValue: 'accepted', newValue: 'released' },
      ],
      performedBy,
    });
  }

  await offer.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementOffer',
    entityId: String(offer._id),
    entityName: `Offer ${String(offer._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'extended', newValue: 'accepted' },
    ],
    performedBy,
  });

  return offer;
}

export async function rejectOffer(
  collegeId: string,
  offerId: string,
  performedBy: string,
) {
  const offer = await PlacementOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Placement offer not found');

  const allowed = OFFER_TRANSITIONS[offer.status];
  if (!allowed || !allowed.includes('rejected')) {
    throw new AppError(400, `Cannot reject offer with status '${offer.status}'`);
  }

  const oldStatus = offer.status;
  offer.status = 'rejected';
  await offer.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementOffer',
    entityId: String(offer._id),
    entityName: `Offer ${String(offer._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'rejected' }],
    performedBy,
  });

  return offer;
}

export async function handleRenege(
  collegeId: string,
  offerId: string,
  performedBy: string,
) {
  const offer = await PlacementOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Placement offer not found');

  const allowed = OFFER_TRANSITIONS[offer.status];
  if (!allowed || !allowed.includes('reneged')) {
    throw new AppError(400, `Cannot mark offer as reneged with status '${offer.status}'`);
  }

  const oldStatus = offer.status;
  offer.status = 'reneged';
  await offer.save();

  // Cross-module placeholders: could flag company, trigger counselling

  await createAuditLog({
    collegeId,
    entityType: 'PlacementOffer',
    entityId: String(offer._id),
    entityName: `Offer ${String(offer._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'reneged' }],
    performedBy,
  });

  return offer;
}

export async function handleLapse(
  collegeId: string,
  offerId: string,
  performedBy: string,
) {
  const offer = await PlacementOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Placement offer not found');

  const allowed = OFFER_TRANSITIONS[offer.status];
  if (!allowed || !allowed.includes('lapsed')) {
    throw new AppError(400, `Cannot lapse offer with status '${offer.status}'`);
  }

  const oldStatus = offer.status;
  offer.status = 'lapsed';
  await offer.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementOffer',
    entityId: String(offer._id),
    entityName: `Offer ${String(offer._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'lapsed' }],
    performedBy,
  });

  return offer;
}

export async function releaseOffer(
  collegeId: string,
  offerId: string,
  data: { dreamOfferId: string },
  performedBy: string,
) {
  const offer = await PlacementOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Placement offer not found');

  const allowed = OFFER_TRANSITIONS[offer.status];
  if (!allowed || !allowed.includes('released')) {
    throw new AppError(400, `Cannot release offer with status '${offer.status}'`);
  }

  const oldStatus = offer.status;
  offer.status = 'released';
  await offer.save();

  // Set previousOfferId on the dream offer
  await PlacementOffer.updateOne(
    { _id: data.dreamOfferId, collegeId },
    { $set: { previousOfferId: offer._id } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'PlacementOffer',
    entityId: String(offer._id),
    entityName: `Offer ${String(offer._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'released' },
      { field: 'dreamOfferId', displayName: 'Dream Offer', oldValue: null, newValue: data.dreamOfferId },
    ],
    performedBy,
  });

  return offer;
}

// ═══════════════════════════════════════════════════════════
// Placement Bar
// ═══════════════════════════════════════════════════════════

export async function listPlacementBars(
  collegeId: string,
  page = 1,
  limit = 20,
  studentId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(PlacementBar, filter, page, limit, { createdAt: -1 }, ['studentId', 'appliedBy']);
}

export async function applyPlacementBar(
  collegeId: string,
  data: { studentId: string; reason: string; barType: string; appliedBy: string },
  performedBy: string,
) {
  const doc = await PlacementBar.create({
    collegeId,
    studentId: data.studentId,
    reason: data.reason,
    barType: data.barType,
    appliedBy: data.appliedBy,
    appliedAt: new Date(),
    status: 'active',
  });

  await createAuditLog({
    collegeId,
    entityType: 'PlacementBar',
    entityId: String(doc._id),
    entityName: `Placement Bar ${String(doc._id)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function liftPlacementBar(
  collegeId: string,
  barId: string,
  data: { liftedBy: string; liftConditions?: string },
  performedBy: string,
) {
  const bar = await PlacementBar.findOne({ _id: barId, collegeId });
  if (!bar) throw new AppError(404, 'Placement bar not found');

  if (bar.status !== 'active') {
    throw new AppError(400, `Cannot lift bar with status '${bar.status}'`);
  }

  bar.status = 'lifted';
  bar.liftedBy = data.liftedBy as any;
  bar.liftedAt = new Date();
  if (data.liftConditions) bar.liftConditions = data.liftConditions;
  await bar.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementBar',
    entityId: String(bar._id),
    entityName: `Placement Bar ${String(bar._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'active', newValue: 'lifted' },
      { field: 'liftedBy', displayName: 'Lifted By', oldValue: null, newValue: data.liftedBy },
    ],
    performedBy,
  });

  return bar;
}

// ═══════════════════════════════════════════════════════════
// Opt-Out
// ═══════════════════════════════════════════════════════════

export async function listOptOuts(
  collegeId: string,
  page = 1,
  limit = 20,
  placementSeasonId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (placementSeasonId) filter.placementSeasonId = placementSeasonId;
  return paginate(OptOutRecord, filter, page, limit, { createdAt: -1 }, ['studentId', 'placementSeasonId']);
}

export async function recordOptOut(
  collegeId: string,
  data: {
    studentId: string;
    placementSeasonId: string;
    reason: string;
    reasonDetail?: string;
    evidenceUrl?: string;
    recordedBy: string;
  },
  performedBy: string,
) {
  const doc = await OptOutRecord.create({
    collegeId,
    studentId: data.studentId,
    placementSeasonId: data.placementSeasonId,
    reason: data.reason,
    reasonDetail: data.reasonDetail,
    evidenceUrl: data.evidenceUrl,
    recordedBy: data.recordedBy,
    recordedAt: new Date(),
    status: 'active',
  });

  await createAuditLog({
    collegeId,
    entityType: 'OptOutRecord',
    entityId: String(doc._id),
    entityName: `OptOut ${String(doc._id)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function voidOptOut(
  collegeId: string,
  optOutId: string,
  data: { voidReason: string },
  performedBy: string,
) {
  const record = await OptOutRecord.findOne({ _id: optOutId, collegeId });
  if (!record) throw new AppError(404, 'Opt-out record not found');

  if (record.status !== 'active') {
    throw new AppError(400, `Cannot void opt-out with status '${record.status}'`);
  }

  record.status = 'voided';
  record.voidedAt = new Date();
  record.voidReason = data.voidReason;
  await record.save();

  await createAuditLog({
    collegeId,
    entityType: 'OptOutRecord',
    entityId: String(record._id),
    entityName: `OptOut ${String(record._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'active', newValue: 'voided' },
      { field: 'voidReason', displayName: 'Void Reason', oldValue: null, newValue: data.voidReason },
    ],
    performedBy,
  });

  return record;
}

// ═══════════════════════════════════════════════════════════
// Close Drive
// ═══════════════════════════════════════════════════════════

export async function closeDrive(
  collegeId: string,
  driveId: string,
  performedBy: string,
) {
  const drive = await PlacementDrive.findOne({ _id: driveId, collegeId });
  if (!drive) throw new AppError(404, 'Placement drive not found');

  if (drive.status !== 'offers_released') {
    throw new AppError(400, `Cannot close drive — status is '${drive.status}', expected 'offers_released'`);
  }

  // Compute analytics
  const applications = await DriveApplication.find({ collegeId, driveId }).lean();
  const totalApplications = applications.length;
  const conversionRate = totalApplications > 0 ? drive.offeredCount / totalApplications : 0;
  const matchScores = applications
    .map((a) => a.matchScore)
    .filter((s): s is number => s != null);
  const avgMatchScore =
    matchScores.length > 0 ? matchScores.reduce((sum, s) => sum + s, 0) / matchScores.length : 0;

  drive.status = 'closed';
  drive.analytics = {
    conversionRate: Math.round(conversionRate * 10000) / 10000,
    avgMatchScore: Math.round(avgMatchScore * 100) / 100,
  };
  await drive.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementDrive',
    entityId: String(drive._id),
    entityName: `Drive ${String(drive._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'offers_released', newValue: 'closed' },
      { field: 'analytics.conversionRate', displayName: 'Conversion Rate', oldValue: null, newValue: drive.analytics.conversionRate },
      { field: 'analytics.avgMatchScore', displayName: 'Avg Match Score', oldValue: null, newValue: drive.analytics.avgMatchScore },
    ],
    performedBy,
  });

  return drive;
}
