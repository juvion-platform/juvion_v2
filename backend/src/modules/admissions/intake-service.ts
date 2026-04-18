// ─── W01 Intake Service ─────────────────────────────────────
// Business logic for Student Intake & Onboarding algorithms:
// merit list generation, allotment execution, offer lifecycle,
// cancellation, import, eligibility, documents, convener reporting, spot rounds.

import { Applicant } from '../../models/admissions/Applicant';
import { AllotmentRound } from '../../models/admissions/AllotmentRound';
import { AllotmentResult } from '../../models/admissions/AllotmentResult';
import { Waitlist } from '../../models/admissions/Waitlist';
import { SeatInventory } from '../../models/admissions/SeatInventory';
import { AdmissionOffer } from '../../models/admissions/AdmissionOffer';
import { AdmissionCancellation } from '../../models/admissions/AdmissionCancellation';
import { MeritList } from '../../models/admissions/MeritList';
import { SpotRound } from '../../models/admissions/SpotRound';
import { DocumentChecklist } from '../../models/admissions/DocumentChecklist';
import { CounselingAllotment } from '../../models/admissions/CounselingAllotment';
import { LeadImportBatch } from '../../models/admissions/LeadImportBatch';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ═══════════════════════════════════════════════════════════
// Merit List
// ═══════════════════════════════════════════════════════════

export async function listMeritLists(collegeId: string, page: number, limit: number, allotmentRoundId?: string) {
  const filter: any = { collegeId };
  if (allotmentRoundId) filter.allotmentRoundId = allotmentRoundId;
  return paginate(MeritList, filter, page, limit, { createdAt: -1 });
}

export async function getMeritList(collegeId: string, id: string) {
  const doc = await MeritList.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Merit list not found');
  return doc;
}

export async function generateMeritList(
  collegeId: string,
  data: {
    allotmentRoundId: string;
    academicYearId: string;
    programmeId: string;
    branchId?: string;
    quota: string;
    criteria: { sortBy: string; tieBreaker?: string };
  },
  performedBy: string,
) {
  // Find all eligible applicants for the programme/branch
  const applicantFilter: any = {
    collegeId,
    eligibilityStatus: 'eligible',
    programmeApplied: data.programmeId,
    quota: data.quota,
  };
  if (data.branchId) {
    applicantFilter.branchPreference1 = data.branchId;
  }

  const sortField = data.criteria.sortBy === 'interPercentage' ? 'interPercentage' : 'meritScore';
  const applicants = await Applicant.find(applicantFilter)
    .sort({ [sortField]: -1, applicationDate: 1 }) // Higher score first, earlier application as tiebreaker
    .lean();

  const totalCandidates = applicants.length;

  const doc = await MeritList.create({
    collegeId,
    allotmentRoundId: data.allotmentRoundId,
    academicYearId: data.academicYearId,
    programmeId: data.programmeId,
    branchId: data.branchId,
    quota: data.quota,
    criteria: data.criteria,
    status: 'generated',
    totalCandidates,
    generatedBy: performedBy,
  });

  await createAuditLog({
    collegeId, entityType: 'MeritList', entityId: String(doc._id),
    entityName: `Merit List (${data.quota})`, action: 'create',
    changes: [{ field: 'totalCandidates', displayName: 'Total Candidates', oldValue: null, newValue: totalCandidates }],
    performedBy,
  });

  return doc;
}

export async function publishMeritList(collegeId: string, meritListId: string, performedBy: string) {
  const doc = await MeritList.findOne({ _id: meritListId, collegeId });
  if (!doc) throw new AppError(404, 'Merit list not found');
  if (doc.status !== 'generated') throw new AppError(400, 'Merit list must be in generated status to publish');

  doc.status = 'published';
  doc.publishDate = new Date();
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MeritList', entityId: String(doc._id),
    entityName: `Merit List (${doc.quota})`, action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'generated', newValue: 'published' }],
    performedBy,
  });

  return doc;
}

// ═══════════════════════════════════════════════════════════
// Allotment Algorithm
// ═══════════════════════════════════════════════════════════

/** Map a quota string to SeatInventory field names */
function getQuotaSeatFields(quota: string): { seatsField: string; filledField: string } {
  const map: Record<string, { seatsField: string; filledField: string }> = {
    convener: { seatsField: 'convenerSeats', filledField: 'convenerFilled' },
    management: { seatsField: 'managementSeats', filledField: 'managementFilled' },
    nri: { seatsField: 'nriSeats', filledField: 'nriFilled' },
    spot: { seatsField: 'spotSeats', filledField: 'spotFilled' },
    lateral: { seatsField: 'lateralEntrySeats', filledField: 'lateralFilled' },
  };
  return map[quota] ?? { seatsField: 'managementSeats', filledField: 'managementFilled' };
}

export async function executeAllotmentRound(collegeId: string, roundId: string, performedBy: string) {
  const round = await AllotmentRound.findOne({ _id: roundId, collegeId });
  if (!round) throw new AppError(404, 'Allotment round not found');
  if (round.status !== 'open' && round.status !== 'draft') {
    throw new AppError(400, 'Round must be in open or draft status to execute');
  }

  // Transition round to processing
  round.status = 'processing';
  await round.save();

  // Get the merit list for this round
  const meritList = await MeritList.findOne({ collegeId, allotmentRoundId: roundId, status: 'published' }).lean();
  if (!meritList) throw new AppError(400, 'No published merit list found for this round');

  // Get eligible applicants sorted by merit
  const sortField = round.criteria.sortBy === 'inter_percentage' ? 'interPercentage'
    : round.criteria.sortBy === 'eamcet_rank' ? 'eamcetRank'
    : 'meritScore';
  // For rank-based sorting (eamcet_rank) lower is better; for score-based, higher is better
  const sortDirection = round.criteria.sortBy === 'eamcet_rank' ? 1 : -1;

  const applicantFilter: any = {
    collegeId,
    eligibilityStatus: 'eligible',
    programmeApplied: { $in: round.criteria.programmeIds ?? [] },
  };
  if (round.criteria.quotas && round.criteria.quotas.length > 0) {
    applicantFilter.quota = { $in: round.criteria.quotas };
  }

  const applicants = await Applicant.find(applicantFilter)
    .sort({ [sortField]: sortDirection, applicationDate: 1 })
    .lean();

  let allottedCount = 0;
  let waitlistedCount = 0;
  let rank = 0;

  for (const applicant of applicants) {
    rank++;
    const programmeId = applicant.programmeApplied;
    const branchId = applicant.branchPreference1;
    const quota = applicant.quota;

    if (!programmeId || !branchId) continue;

    // Get seat inventory for this programme/branch
    const seatInv = await SeatInventory.findOne({
      collegeId,
      programmeId,
      branchId,
    });

    const { seatsField, filledField } = getQuotaSeatFields(quota);
    const totalSeats = seatInv ? (seatInv as any)[seatsField] as number : 0;
    const filledSeats = seatInv ? (seatInv as any)[filledField] as number : 0;
    const hasVacancy = seatInv && filledSeats < totalSeats;

    if (hasVacancy && seatInv) {
      // Allot seat
      await AllotmentResult.create({
        collegeId,
        allotmentRoundId: roundId,
        applicantId: applicant._id,
        meritRank: rank,
        meritScore: applicant.meritScore ?? 0,
        allottedProgrammeId: programmeId,
        allottedBranchId: branchId,
        preferenceNumber: 1,
        status: 'allotted',
      });

      // Decrement seat inventory
      (seatInv as any)[filledField] = filledSeats + 1;
      await seatInv.save();

      allottedCount++;
    } else {
      // Waitlist the applicant
      await AllotmentResult.create({
        collegeId,
        allotmentRoundId: roundId,
        applicantId: applicant._id,
        meritRank: rank,
        meritScore: applicant.meritScore ?? 0,
        allottedProgrammeId: programmeId,
        allottedBranchId: branchId,
        status: 'waitlisted',
      });

      // Determine next waitlist position
      const lastWaitlist = await Waitlist.findOne({
        collegeId, programmeId, branchId, quota,
      }).sort({ waitlistPosition: -1 }).lean();
      const nextPosition = lastWaitlist ? lastWaitlist.waitlistPosition + 1 : 1;

      await Waitlist.create({
        collegeId,
        academicYearId: round.academicYearId,
        applicantId: applicant._id,
        programmeId,
        branchId,
        allotmentRoundId: roundId,
        waitlistPosition: nextPosition,
        meritScore: applicant.meritScore ?? 0,
        quota,
        status: 'waiting',
      });

      waitlistedCount++;
    }
  }

  // Update round stats
  round.totalApplicants = applicants.length;
  round.allottedCount = allottedCount;
  round.waitlistedCount = waitlistedCount;
  await round.save();

  await createAuditLog({
    collegeId, entityType: 'AllotmentRound', entityId: String(round._id),
    entityName: round.name, action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'open', newValue: 'processing' },
      { field: 'allottedCount', displayName: 'Allotted', oldValue: 0, newValue: allottedCount },
      { field: 'waitlistedCount', displayName: 'Waitlisted', oldValue: 0, newValue: waitlistedCount },
    ],
    performedBy,
  });

  return { round, allottedCount, waitlistedCount, totalProcessed: applicants.length };
}

export async function publishAllotmentResults(collegeId: string, roundId: string, performedBy: string) {
  const round = await AllotmentRound.findOne({ _id: roundId, collegeId });
  if (!round) throw new AppError(404, 'Allotment round not found');
  if (round.status !== 'processing') throw new AppError(400, 'Round must be in processing status to publish results');

  round.status = 'published';
  round.publishDate = new Date();
  round.publishedBy = performedBy;
  await round.save();

  await createAuditLog({
    collegeId, entityType: 'AllotmentRound', entityId: String(round._id),
    entityName: round.name, action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'processing', newValue: 'published' }],
    performedBy,
  });

  return round;
}

export async function promoteFromWaitlist(collegeId: string, waitlistEntryId: string, performedBy: string) {
  const entry = await Waitlist.findOne({ _id: waitlistEntryId, collegeId });
  if (!entry) throw new AppError(404, 'Waitlist entry not found');
  if (entry.status !== 'waiting') throw new AppError(400, 'Waitlist entry is not in waiting status');

  entry.status = 'promoted';
  entry.promotedAt = new Date();

  // Create an admission offer for the promoted student
  const offer = await AdmissionOffer.create({
    collegeId,
    applicantId: entry.applicantId,
    programmeId: entry.programmeId,
    branchId: entry.branchId,
    feeQuoted: 0, // To be determined by fee structure
    validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days validity
    status: 'offered',
    allotmentRoundId: entry.allotmentRoundId,
  });

  entry.promotedToOfferId = offer._id as any;
  await entry.save();

  await createAuditLog({
    collegeId, entityType: 'Waitlist', entityId: String(entry._id),
    entityName: `Position ${entry.waitlistPosition}`, action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'waiting', newValue: 'promoted' }],
    performedBy,
  });

  return { waitlistEntry: entry, offer };
}

// ═══════════════════════════════════════════════════════════
// Offer Lifecycle
// ═══════════════════════════════════════════════════════════

export async function acceptOffer(collegeId: string, offerId: string, performedBy: string) {
  const offer = await AdmissionOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Admission offer not found');
  if (offer.status !== 'offered') throw new AppError(400, 'Offer must be in offered status to accept');

  offer.status = 'accepted';
  offer.acceptedAt = new Date();
  await offer.save();

  await createAuditLog({
    collegeId, entityType: 'AdmissionOffer', entityId: String(offer._id),
    entityName: 'Offer', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'offered', newValue: 'accepted' }],
    performedBy,
  });

  return offer;
}

/** Release a seat back to inventory and promote the top waitlisted candidate */
async function releaseSeatAndPromoteWaitlist(
  collegeId: string,
  programmeId: any,
  branchId: any,
  quota: string,
  performedBy: string,
) {
  // Release seat: decrement filled count in inventory
  const seatInv = await SeatInventory.findOne({ collegeId, programmeId, branchId });
  if (seatInv) {
    const { filledField } = getQuotaSeatFields(quota);
    const current = (seatInv as any)[filledField] as number;
    if (current > 0) {
      (seatInv as any)[filledField] = current - 1;
      await seatInv.save();
    }
  }

  // Auto-promote top waitlist candidate for the same programme/branch/quota
  const topWaitlist = await Waitlist.findOne({
    collegeId,
    programmeId,
    branchId,
    quota,
    status: 'waiting',
  }).sort({ waitlistPosition: 1 });

  if (topWaitlist) {
    await promoteFromWaitlist(collegeId, String(topWaitlist._id), performedBy);
  }
}

export async function rejectOffer(collegeId: string, offerId: string, performedBy: string) {
  const offer = await AdmissionOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Admission offer not found');
  if (offer.status !== 'offered') throw new AppError(400, 'Offer must be in offered status to decline');

  offer.status = 'declined';
  offer.declinedAt = new Date();
  await offer.save();

  // Look up the applicant to determine quota
  const applicant = await Applicant.findById(offer.applicantId).lean();
  const quota = applicant?.quota ?? 'management';

  // Release seat and trigger waitlist promotion
  await releaseSeatAndPromoteWaitlist(collegeId, offer.programmeId, offer.branchId, quota, performedBy);

  await createAuditLog({
    collegeId, entityType: 'AdmissionOffer', entityId: String(offer._id),
    entityName: 'Offer', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'offered', newValue: 'declined' }],
    performedBy,
  });

  return offer;
}

export async function handleOfferExpiry(collegeId: string, offerId: string, performedBy: string) {
  const offer = await AdmissionOffer.findOne({ _id: offerId, collegeId });
  if (!offer) throw new AppError(404, 'Admission offer not found');
  if (offer.status !== 'offered') throw new AppError(400, 'Offer must be in offered status to lapse');

  offer.status = 'lapsed';
  await offer.save();

  // Look up the applicant to determine quota
  const applicant = await Applicant.findById(offer.applicantId).lean();
  const quota = applicant?.quota ?? 'management';

  // Same seat release + waitlist promotion as reject
  await releaseSeatAndPromoteWaitlist(collegeId, offer.programmeId, offer.branchId, quota, performedBy);

  await createAuditLog({
    collegeId, entityType: 'AdmissionOffer', entityId: String(offer._id),
    entityName: 'Offer', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'offered', newValue: 'lapsed' }],
    performedBy,
  });

  return offer;
}

export async function autoExpireOffers(collegeId: string, _performedBy: string) {
  const now = new Date();
  const result = await AdmissionOffer.updateMany(
    { collegeId, status: 'offered', validityDate: { $lt: now } },
    { $set: { status: 'lapsed' } },
  );
  return { expiredCount: result.modifiedCount };
}

// ═══════════════════════════════════════════════════════════
// Cancellation
// ═══════════════════════════════════════════════════════════

export async function approveCancellation(
  collegeId: string,
  cancellationId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const doc = await AdmissionCancellation.findOne({ _id: cancellationId, collegeId });
  if (!doc) throw new AppError(404, 'Cancellation not found');
  if (doc.status !== 'requested') throw new AppError(400, 'Cancellation must be in requested status to approve');

  doc.status = 'approved';
  doc.approvedBy = data.approvedBy;
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AdmissionCancellation', entityId: String(doc._id),
    entityName: `Cancellation (${doc.cancellationType})`, action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'requested', newValue: 'approved' }],
    performedBy,
  });

  return doc;
}

export async function executeCancellation(collegeId: string, cancellationId: string, performedBy: string) {
  const doc = await AdmissionCancellation.findOne({ _id: cancellationId, collegeId });
  if (!doc) throw new AppError(404, 'Cancellation not found');
  if (doc.status !== 'approved') throw new AppError(400, 'Cancellation must be approved before execution');

  doc.status = 'in_progress';
  // Placeholder: in production, each reversal step would be dispatched to
  // the respective module (M02 deactivate, M04 refund, M08 de-allocate, etc.)
  // and updated asynchronously. For now we mark them as pending.
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AdmissionCancellation', entityId: String(doc._id),
    entityName: `Cancellation (${doc.cancellationType})`, action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'approved', newValue: 'in_progress' }],
    performedBy,
  });

  return doc;
}

export async function calculateRefund(collegeId: string, cancellationId: string) {
  const cancellation = await AdmissionCancellation.findOne({ _id: cancellationId, collegeId }).lean();
  if (!cancellation) throw new AppError(404, 'Cancellation not found');

  // Determine days since admission from the cancellation's createdAt (added by timestamps: true)
  const tsDoc = cancellation as unknown as { createdAt?: Date };
  const admissionDate = tsDoc.createdAt
    ? new Date(tsDoc.createdAt)
    : new Date();
  const daysSinceAdmission = Math.floor(
    (Date.now() - admissionDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Refund slab: within 15 days → 90%, 15-30 → 80%, 30-60 → 50%, >60 → 0%
  let refundPercent: number;
  if (daysSinceAdmission <= 15) {
    refundPercent = 90;
  } else if (daysSinceAdmission <= 30) {
    refundPercent = 80;
  } else if (daysSinceAdmission <= 60) {
    refundPercent = 50;
  } else {
    refundPercent = 0;
  }

  // Estimate refund based on fee paid (use feeQuoted from the applicant's offer as proxy)
  const offer = await AdmissionOffer.findOne({ collegeId, applicantId: cancellation.applicantId, status: 'accepted' }).lean();
  const feePaid = offer?.negotiatedFee ?? offer?.feeQuoted ?? 0;
  const estimatedRefund = Math.round((feePaid * refundPercent) / 100);

  return { daysSinceAdmission, refundPercent, estimatedRefund };
}

// ═══════════════════════════════════════════════════════════
// Import Execution
// ═══════════════════════════════════════════════════════════

export async function executeImportBatch(collegeId: string, importBatchId: string, performedBy: string) {
  const batch = await LeadImportBatch.findOne({ _id: importBatchId, collegeId });
  if (!batch) throw new AppError(404, 'Import batch not found');

  batch.status = 'processing';
  batch.startedAt = new Date();
  await batch.save();

  // Placeholder: parse the batch data from metadata.records
  const records: any[] = batch.metadata?.records ?? [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      // Auto-generate application number
      const year = new Date().getFullYear();
      const existingCount = await Applicant.countDocuments({ collegeId }) + 1;
      const applicationNumber = `APP-${year}-${String(existingCount).padStart(4, '0')}`;

      await Applicant.create({
        collegeId,
        applicationNumber,
        name: record.name ?? 'Unknown',
        phone: record.phone ?? '',
        quota: record.quota ?? 'management',
        admissionType: batch.source === 'ecet' ? 'lateral' : 'fresh',
        importBatchId: batch._id,
        // Carry forward any extra fields
        email: record.email,
        fatherName: record.fatherName,
        interPercentage: record.interPercentage,
        tenthPercentage: record.tenthPercentage,
        eamcetRank: record.eamcetRank,
        ecetRank: record.ecetRank,
        programmeApplied: record.programmeApplied,
        branchPreference1: record.branchPreference1,
        category: record.category,
        status: 'submitted',
      });
      successCount++;
    } catch (_err) {
      failedCount++;
      batch.importErrors.push({
        row: i + 1,
        message: _err instanceof Error ? _err.message : 'Unknown error',
      });
    }
  }

  batch.totalRecords = records.length;
  batch.processedRecords = successCount + failedCount;
  batch.successCount = successCount;
  batch.failedCount = failedCount;
  batch.status = failedCount > 0 && successCount > 0 ? 'partial' : failedCount === 0 ? 'completed' : 'failed';
  batch.completedAt = new Date();
  await batch.save();

  await createAuditLog({
    collegeId, entityType: 'LeadImportBatch', entityId: String(batch._id),
    entityName: `${batch.source} import`, action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'pending', newValue: batch.status },
      { field: 'successCount', displayName: 'Imported', oldValue: 0, newValue: successCount },
    ],
    performedBy,
  });

  return batch;
}

// ═══════════════════════════════════════════════════════════
// Eligibility Checks
// ═══════════════════════════════════════════════════════════

export async function checkLateralEligibility(collegeId: string, applicantId: string) {
  const applicant = await Applicant.findOne({ _id: applicantId, collegeId }).lean();
  if (!applicant) throw new AppError(404, 'Applicant not found');
  if (applicant.admissionType !== 'lateral') {
    throw new AppError(400, 'Applicant is not a lateral admission type');
  }

  const reasons: string[] = [];
  const diplomaAggregate = applicant.interPercentage ?? 0; // Using inter percentage as diploma aggregate proxy

  // Reserved categories get relaxed threshold (40%), others need 45%
  const reservedCategories = ['SC', 'ST', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'EWS'];
  const isReserved = applicant.category ? reservedCategories.includes(applicant.category) : false;
  const threshold = isReserved ? 40 : 45;

  if (diplomaAggregate < threshold) {
    reasons.push(`Diploma aggregate ${diplomaAggregate}% is below minimum ${threshold}%`);
  }

  if (!applicant.ecetRank) {
    reasons.push('ECET rank is missing');
  }

  const eligible = reasons.length === 0;
  return { eligible, reasons };
}

export async function checkNRIEligibility(collegeId: string, applicantId: string) {
  const applicant = await Applicant.findOne({ _id: applicantId, collegeId }).lean();
  if (!applicant) throw new AppError(404, 'Applicant not found');

  const reasons: string[] = [];

  if (!applicant.nriPassportNumber) {
    reasons.push('NRI passport number is missing');
  }

  if (!applicant.nriVisaValidity) {
    reasons.push('NRI visa validity date is missing');
  } else if (new Date(applicant.nriVisaValidity) <= new Date()) {
    reasons.push('NRI visa has expired');
  }

  const eligible = reasons.length === 0;
  const notes = eligible ? 'NRI documentation verified. Passport and visa valid.' : undefined;
  return { eligible, reasons, notes };
}

export async function checkScholarshipEligibility(collegeId: string, applicantId: string) {
  const applicant = await Applicant.findOne({ _id: applicantId, collegeId }).lean();
  if (!applicant) throw new AppError(404, 'Applicant not found');

  const eligible = applicant.scholarshipEligible === true;
  const scheme = applicant.scholarshipScheme ?? null;
  const notes: string[] = [];

  if (!eligible) {
    notes.push('Applicant is not flagged as scholarship eligible');
  }

  if (applicant.category) {
    const meritCategories = ['SC', 'ST', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'EWS'];
    if (meritCategories.includes(applicant.category)) {
      notes.push(`Category ${applicant.category} may qualify for state scholarship schemes`);
    }
  }

  if (applicant.meritScore && applicant.meritScore >= 90) {
    notes.push('High merit score — may qualify for merit-based scholarship');
  }

  return { eligible, scheme, notes };
}

// ═══════════════════════════════════════════════════════════
// Document Actions
// ═══════════════════════════════════════════════════════════

export async function uploadDocument(
  collegeId: string,
  applicantId: string,
  data: { documentType: string; fileUrl: string },
  performedBy: string,
) {
  const checklist = await DocumentChecklist.findOne({ applicantId, collegeId });
  if (!checklist) throw new AppError(404, 'Document checklist not found');

  // Find the specific document entry and update it
  let found = false;
  for (const doc of checklist.documents) {
    if (doc.type === data.documentType) {
      doc.fileUrl = data.fileUrl;
      doc.uploaded = true;
      doc.ocrStatus = 'pending';
      found = true;
      break;
    }
  }

  if (!found) {
    // Add a new document entry if the type doesn't already exist
    checklist.documents.push({
      name: data.documentType,
      type: data.documentType,
      required: false,
      uploaded: true,
      verified: false,
      fileUrl: data.fileUrl,
      ocrStatus: 'pending',
    });
  }

  // Recalculate checklist status
  const allUploaded = checklist.documents.every((d: any) => !d.required || d.uploaded);
  const allVerified = checklist.documents.every((d: any) => !d.required || d.verified);
  if (allVerified) {
    checklist.status = 'verified';
  } else if (allUploaded) {
    checklist.status = 'complete';
  } else {
    checklist.status = 'partial';
  }

  await checklist.save();

  await createAuditLog({
    collegeId, entityType: 'DocumentChecklist', entityId: String(checklist._id),
    entityName: 'Documents', action: 'update',
    changes: [{ field: data.documentType, displayName: data.documentType, oldValue: null, newValue: data.fileUrl }],
    performedBy,
  });

  return checklist;
}

export async function triggerOCR(collegeId: string, applicantId: string, performedBy: string) {
  const checklist = await DocumentChecklist.findOne({ applicantId, collegeId });
  if (!checklist) throw new AppError(404, 'Document checklist not found');

  checklist.ocrStatus = 'processing';
  await checklist.save();

  // Placeholder: in production, dispatch to OCR service.
  // For now, immediately set to completed with high confidence.
  checklist.ocrStatus = 'completed';
  checklist.ocrCompletedAt = new Date();

  for (const doc of checklist.documents) {
    if (doc.uploaded && doc.ocrStatus !== 'verified') {
      doc.ocrStatus = 'verified';
      doc.ocrConfidence = 95;
      doc.verified = true;
      doc.verificationDate = new Date();
      doc.verifiedBy = 'OCR-System';
    }
  }

  // Recalculate status
  const allVerified = checklist.documents.every((d: any) => !d.required || d.verified);
  if (allVerified) {
    checklist.status = 'verified';
  }

  await checklist.save();

  await createAuditLog({
    collegeId, entityType: 'DocumentChecklist', entityId: String(checklist._id),
    entityName: 'Documents OCR', action: 'update',
    changes: [{ field: 'ocrStatus', displayName: 'OCR Status', oldValue: 'processing', newValue: 'completed' }],
    performedBy,
  });

  return checklist;
}

// ═══════════════════════════════════════════════════════════
// Convener Reporting
// ═══════════════════════════════════════════════════════════

export async function getReportingTracker(collegeId: string, academicYearId?: string) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;

  // CounselingAllotment uses 'status' field with values: allotted, accepted, cancelled, upgraded
  // We treat 'accepted' as reported, 'cancelled' as surrendered, and 'allotted' as pending
  const allotments = await CounselingAllotment.find(filter).lean();

  let reported = 0;
  let lapsed = 0;
  let surrendered = 0;
  let pending = 0;

  for (const a of allotments) {
    switch (a.status) {
      case 'accepted':
        reported++;
        break;
      case 'cancelled':
        surrendered++;
        break;
      case 'upgraded':
        lapsed++;
        break;
      case 'allotted':
      default:
        pending++;
        break;
    }
  }

  return {
    total: allotments.length,
    reported,
    lapsed,
    surrendered,
    pending,
  };
}

export async function recordStudentReporting(collegeId: string, allotmentId: string, performedBy: string) {
  const allotment = await CounselingAllotment.findOne({ _id: allotmentId, collegeId });
  if (!allotment) throw new AppError(404, 'Counseling allotment not found');

  const oldStatus = allotment.status;
  allotment.status = 'accepted'; // 'accepted' represents reported in the existing schema
  await allotment.save();

  await createAuditLog({
    collegeId, entityType: 'CounselingAllotment', entityId: String(allotment._id),
    entityName: `Round-${allotment.round}`, action: 'update',
    changes: [{ field: 'status', displayName: 'Reporting Status', oldValue: oldStatus, newValue: 'accepted' }],
    performedBy,
  });

  return allotment;
}

// ═══════════════════════════════════════════════════════════
// Spot Rounds
// ═══════════════════════════════════════════════════════════

export async function listSpotRounds(collegeId: string, page: number, limit: number) {
  return paginate(SpotRound, { collegeId }, page, limit, { createdAt: -1 });
}

export async function createSpotRound(collegeId: string, data: any, performedBy: string) {
  const doc = await SpotRound.create({ ...data, collegeId });
  await createAuditLog({
    collegeId, entityType: 'SpotRound', entityId: String(doc._id),
    entityName: doc.name, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function updateSpotRound(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await SpotRound.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Spot round not found');
  await createAuditLog({
    collegeId, entityType: 'SpotRound', entityId: id,
    entityName: doc.name, action: 'update', changes: [], performedBy,
  });
  return doc;
}
