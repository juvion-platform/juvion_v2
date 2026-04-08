import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admission } from '../../models/admissions/Admission';
import { AdmissionCancellation } from '../../models/admissions/AdmissionCancellation';
import { AllotmentResult } from '../../models/admissions/AllotmentResult';
import { Applicant } from '../../models/admissions/Applicant';
import { DocumentChecklist } from '../../models/admissions/DocumentChecklist';
import { AdmissionOffer } from '../../models/admissions/AdmissionOffer';
import { FeeNegotiation } from '../../models/admissions/FeeNegotiation';
import { Inquiry } from '../../models/admissions/Inquiry';
import { LeadInteraction } from '../../models/admissions/LeadInteraction';
import { SeatInventory } from '../../models/admissions/SeatInventory';
import { Waitlist } from '../../models/admissions/Waitlist';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Batch } from '../../models/academic-structure/Batch';
import { Branch } from '../../models/academic-structure/Branch';
import { Programme } from '../../models/academic-structure/Programme';
import { Regulation } from '../../models/academic-structure/Regulation';
import { Section } from '../../models/academic-structure/Section';
import { Semester } from '../../models/academic-structure/Semester';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { CurriculumMap } from '../../models/academic-ops/CurriculumMap';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { Invoice } from '../../models/finance/Invoice';
import { FeeStructure } from '../../models/finance/FeeStructure';
import { StudentFeeAccount } from '../../models/finance/StudentFeeAccount';
import { LibraryMember } from '../../models/library/LibraryMember';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Student } from '../../models/people/Student';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { HostelBlock } from '../../models/welfare/HostelBlock';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { TransportRoute } from '../../models/welfare/TransportRoute';
import { JuviAction } from '../../models/juvi/JuviAction';
import { JuviConversation } from '../../models/juvi/JuviConversation';
import { JuviMessage } from '../../models/juvi/JuviMessage';
import { JuviPersonaConfig } from '../../models/juvi/JuviPersonaConfig';
import { User } from '../../models/User';
import { createAuditLog } from '../../shared/audit';
import { WorkflowStepHandlerContext, registerWorkflowStepHandler } from '../../shared/workflow/StepHandlers';
import { convertInquiryToApplicant } from './service';
import { createCancellation as createCancellationRecord, createFeeNegotiation as createFeeNegotiationRecord, resolveFeeNegotiation as resolveFeeNegotiationRecord } from './workflow.service';

const DEFAULT_DOCUMENTS = [
  { name: 'Aadhaar Card', type: 'identity', required: true, uploaded: false, verified: false },
  { name: '10th Marks Memo', type: 'academic', required: true, uploaded: false, verified: false },
  { name: '12th Marks Memo', type: 'academic', required: true, uploaded: false, verified: false },
  { name: 'Transfer Certificate', type: 'academic', required: true, uploaded: false, verified: false },
  { name: 'Passport Photo', type: 'identity', required: true, uploaded: false, verified: false },
] as const;

registerWorkflowStepHandler('W01', 'lead_capture', async ({ instance, result }) => {
  const inquiryId = await ensureInquiryLinked(instance);
  return { result: { ...result, inquiryId } };
});

registerWorkflowStepHandler('W01', 'lead_score', async ({ instance, result }) => {
  const inquiryId = await ensureInquiryLinked(instance);
  if (!inquiryId) return;

  const leadScore = typeof result.leadScore === 'number' ? result.leadScore : undefined;
  const leadGrade = typeof result.leadGrade === 'string' ? result.leadGrade : deriveLeadGrade(leadScore);

  const update: Record<string, any> = {};
  if (leadScore !== undefined) update.leadScore = leadScore;
  if (leadGrade) update.leadGrade = leadGrade;
  if (typeof result.status === 'string') update.status = result.status;

  if (Object.keys(update).length > 0) {
    await Inquiry.findByIdAndUpdate(inquiryId, { $set: update });
  }

  await saveInstanceMetadata(instance, { inquiryId, ...(leadGrade ? { leadGrade } : {}) });

  return { result: { ...result, inquiryId, ...(leadScore !== undefined ? { leadScore } : {}), ...(leadGrade ? { leadGrade } : {}) } };
});

registerWorkflowStepHandler('W01', 'lead_dedup', async ({ instance, result }) => {
  const inquiryId = await ensureInquiryLinked(instance);
  if (!inquiryId) return;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, collegeId: instance.collegeId });
  if (!inquiry) return { result: { ...result, inquiryId } };

  const duplicateFilters: Record<string, any>[] = [];
  if (inquiry.phone) duplicateFilters.push({ phone: inquiry.phone });
  if (inquiry.email) duplicateFilters.push({ email: inquiry.email });

  const duplicates = duplicateFilters.length > 0
    ? await Inquiry.find({
      collegeId: instance.collegeId,
      _id: { $ne: inquiry._id },
      $or: duplicateFilters,
    }).sort({ createdAt: -1 }).lean()
    : [];

  const duplicateInquiryIds = duplicates.map((item) => String(item._id));
  const dedupStatus = duplicateInquiryIds.length > 0 ? 'potential_duplicate' : 'unique';
  const tags = new Set<string>(Array.isArray(inquiry.tags) ? inquiry.tags : []);
  if (duplicateInquiryIds.length > 0) {
    tags.add('duplicate_candidate');
  } else {
    tags.delete('duplicate_candidate');
  }

  await Inquiry.findByIdAndUpdate(inquiryId, {
    $set: {
      tags: [...tags],
      workflowInstanceId: instance._id,
    },
  });

  await saveInstanceMetadata(instance, compactMetadata({
    inquiryId,
    duplicateInquiryIds,
    duplicateCount: duplicateInquiryIds.length,
    dedupStatus,
  }));

  return {
    result: {
      ...result,
      inquiryId,
      duplicateInquiryIds,
      duplicateCount: duplicateInquiryIds.length,
      dedupStatus,
    },
  };
});

registerWorkflowStepHandler('W01', 'lead_nurture', async ({ instance, result, completedBy }) => {
  const inquiryId = await ensureInquiryLinked(instance);
  if (!inquiryId) return;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, collegeId: instance.collegeId });
  if (!inquiry) return { result: { ...result, inquiryId } };

  const interactionType = normalizeLeadInteractionType(result.type);
  const outcome = normalizeLeadInteractionOutcome(result.outcome);
  const completedAt = parseOptionalDate(result.completedAt) || new Date();
  const followUpDate = parseOptionalDate(result.followUpDate) || parseOptionalDate(result.scheduledAt) || addDays(3);
  const summary = typeof result.summary === 'string' && result.summary.trim().length > 0
    ? result.summary.trim()
    : 'Automated nurture follow-up sent to keep the lead warm.';
  const inferredStatus = typeof result.status === 'string'
    ? result.status
    : outcome === 'visit_scheduled'
      ? 'visit_scheduled'
      : outcome === 'interested'
        ? 'interested'
        : outcome === 'converted'
          ? 'converted'
          : inquiry.status;

  const interaction = await LeadInteraction.create({
    collegeId: instance.collegeId,
    inquiryId,
    type: interactionType,
    direction: 'outbound',
    channel: typeof result.channel === 'string' ? result.channel : 'automated',
    summary,
    outcome,
    scheduledAt: parseOptionalDate(result.scheduledAt),
    completedAt,
    durationMinutes: typeof result.durationMinutes === 'number' ? result.durationMinutes : undefined,
    performedBy: completedBy,
    aiGenerated: result.aiGenerated !== false,
    metadata: typeof result.metadata === 'object' ? result.metadata : undefined,
  });

  await Inquiry.findByIdAndUpdate(inquiryId, {
    $set: {
      status: inferredStatus,
      followUpDate,
      lastInteractionAt: completedAt,
      workflowInstanceId: instance._id,
    },
    $inc: { interactionCount: 1 },
  });

  return {
    result: {
      ...result,
      inquiryId,
      interactionId: String(interaction._id),
      status: inferredStatus,
      followUpDate: followUpDate.toISOString(),
    },
  };
});

registerWorkflowStepHandler('W01', 'lead_convert', async ({ instance, result, completedBy }) => {
  const existingApplicantId = getIdString(instance.metadata?.applicantId) || (instance.entityType === 'Applicant' ? getIdString(instance.entityId) : undefined);
  if (existingApplicantId) {
    await Applicant.findByIdAndUpdate(existingApplicantId, { $set: { workflowInstanceId: instance._id } });
    await saveInstanceEntity(instance, 'Applicant', existingApplicantId, { applicantId: existingApplicantId });
    return { result: { ...result, applicantId: existingApplicantId } };
  }

  const inquiryId = await ensureInquiryLinked(instance);
  if (!inquiryId) return;

  const applicant = await convertInquiryToApplicant(String(instance.collegeId), inquiryId, result, completedBy);
  await Applicant.findByIdAndUpdate(applicant._id, { $set: { workflowInstanceId: instance._id } });
  await Inquiry.findByIdAndUpdate(inquiryId, { $set: { workflowInstanceId: instance._id } });
  await saveInstanceEntity(instance, 'Applicant', String(applicant._id), {
    inquiryId,
    applicantId: String(applicant._id),
    applicationNumber: applicant.applicationNumber,
  });

  return {
    result: {
      ...result,
      inquiryId,
      applicantId: String(applicant._id),
      applicationNumber: applicant.applicationNumber,
    },
  };
});

registerWorkflowStepHandler('W01', 'app_submit', async ({ instance, result }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const update: Record<string, any> = {
    workflowInstanceId: instance._id,
    status: 'submitted',
  };
  if (instance.academicYearId) update.academicYearId = instance.academicYearId;
  if (typeof result.quota === 'string') update.quota = result.quota;
  if (typeof result.admissionType === 'string') update.admissionType = result.admissionType;
  if (typeof result.programmeApplied === 'string') update.programmeApplied = result.programmeApplied;
  if (typeof result.branchPreference1 === 'string') update.branchPreference1 = result.branchPreference1;

  await Applicant.findByIdAndUpdate(applicantId, { $set: update });
  return { result: { ...result, applicantId } };
});

registerWorkflowStepHandler('W01', 'doc_collection', async ({ instance, result }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const documents = Array.isArray(result.documents) && result.documents.length > 0
    ? result.documents.map(normalizeDocument)
    : DEFAULT_DOCUMENTS.map((doc) => ({ ...doc }));

  const checklistStatus = deriveChecklistStatus(documents);
  const checklist = await DocumentChecklist.findOneAndUpdate(
    { collegeId: instance.collegeId, applicantId },
    {
      $set: {
        collegeId: instance.collegeId,
        applicantId,
        documents,
        status: checklistStatus,
        ocrStatus: 'pending',
      },
    },
    { new: true, upsert: true },
  );

  await Applicant.findByIdAndUpdate(applicantId, { $set: { status: 'under_review', workflowInstanceId: instance._id } });

  return {
    result: {
      ...result,
      applicantId,
      checklistId: String(checklist._id),
      checklistStatus,
    },
  };
});

registerWorkflowStepHandler('W01', 'doc_ocr', async ({ instance, result }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const checklist = await DocumentChecklist.findOne({ collegeId: instance.collegeId, applicantId });
  if (!checklist) return { result: { ...result, applicantId } };

  const hasFlaggedDocuments = result.hasFlaggedDocuments === true || Number(result.flaggedDocumentsCount || 0) > 0;
  const allDocumentsVerified = result.allDocumentsVerified === true || (!hasFlaggedDocuments && result.flaggedDocumentsCount === 0);

  checklist.ocrStatus = 'completed';
  checklist.ocrCompletedAt = new Date();
  if (Array.isArray(result.documents) && result.documents.length > 0) {
    checklist.documents = result.documents.map(normalizeDocument);
  }
  checklist.status = allDocumentsVerified ? 'verified' : deriveChecklistStatus(checklist.documents);
  await checklist.save();

  await Applicant.findByIdAndUpdate(applicantId, {
    $set: {
      status: allDocumentsVerified ? 'under_review' : 'under_review',
      workflowInstanceId: instance._id,
    },
  });

  return {
    result: {
      ...result,
      applicantId,
      hasFlaggedDocuments,
      allDocumentsVerified,
      flaggedDocumentsCount: Number(result.flaggedDocumentsCount || 0),
    },
  };
});

registerWorkflowStepHandler('W01', 'doc_review', async ({ instance, result }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const checklist = await DocumentChecklist.findOne({ collegeId: instance.collegeId, applicantId });
  if (!checklist) return { result: { ...result, applicantId } };

  const reviewOutcome = typeof result.reviewOutcome === 'string' ? result.reviewOutcome : 'verified';
  const update: Record<string, any> = {};

  if (reviewOutcome === 'deficient') {
    checklist.status = 'partial';
    checklist.deficiencyNotifiedAt = new Date();
    checklist.deficiencyDeadline = parseOptionalDate(result.deficiencyDeadline) || addDays(7);
  } else if (reviewOutcome === 'fraud_flagged' || result.fraudFlagged === true) {
    checklist.fraudFlagged = true;
    checklist.fraudNotes = typeof result.fraudNotes === 'string' ? result.fraudNotes : 'Flagged during document review';
    update.status = 'rejected';
  } else if (reviewOutcome === 'rejected') {
    update.status = 'rejected';
  } else {
    checklist.status = 'verified';
  }

  await checklist.save();
  if (Object.keys(update).length > 0) {
    await Applicant.findByIdAndUpdate(applicantId, { $set: update });
  }

  return { result: { ...result, applicantId, reviewOutcome } };
});

registerWorkflowStepHandler('W01', 'eligibility_check', async ({ instance, result, completedBy }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const eligibilityStatus = deriveEligibilityStatus(result);
  const applicantStatus = mapApplicantStatusFromEligibility(eligibilityStatus);
  const update: Record<string, any> = {
    workflowInstanceId: instance._id,
    eligibilityStatus,
    eligibilityVerifiedAt: new Date(),
    eligibilityVerifiedBy: completedBy,
    status: applicantStatus,
  };
  if (typeof result.notes === 'string') update.eligibilityNotes = result.notes;
  if (typeof result.meritScore === 'number') update.meritScore = result.meritScore;

  await Applicant.findByIdAndUpdate(applicantId, { $set: update });

  return {
    result: {
      ...result,
      applicantId,
      eligibilityStatus,
      isEligible: eligibilityStatus === 'eligible' || eligibilityStatus === 'conditional',
      isEdgeCase: eligibilityStatus === 'edge_case',
    },
  };
});

registerWorkflowStepHandler('W01', 'eligibility_review', async ({ instance, result, completedBy }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const finalStatus = typeof result.finalEligibilityStatus === 'string'
    ? result.finalEligibilityStatus
    : (typeof result.isEligible === 'boolean' ? (result.isEligible ? 'eligible' : 'ineligible') : 'eligible');

  await Applicant.findByIdAndUpdate(applicantId, {
    $set: {
      workflowInstanceId: instance._id,
      eligibilityStatus: finalStatus,
      eligibilityVerifiedAt: new Date(),
      eligibilityVerifiedBy: completedBy,
      eligibilityNotes: typeof result.notes === 'string' ? result.notes : undefined,
      status: mapApplicantStatusFromEligibility(finalStatus),
    },
  });

  return { result: { ...result, applicantId, finalEligibilityStatus: finalStatus } };
});

registerWorkflowStepHandler('W01', 'seat_check', async ({ instance, result }) => {
  const applicant = await getApplicantContext(instance);
  if (!applicant) return;

  const quota = normalizeQuota(result.quota || applicant.quota);
  const academicYearId = getIdString(result.academicYearId) || getIdString(instance.academicYearId) || getIdString(instance.metadata?.academicYearId);
  const programmeId = getIdString(result.programmeId) || getIdString(instance.metadata?.programmeId);
  const branchId = getIdString(result.branchId) || getIdString(instance.metadata?.branchId);

  let seatAvailable = typeof result.seatAvailable === 'boolean' ? result.seatAvailable : undefined;
  let availableSeats: number | undefined;
  let seatInventoryId = getIdString(result.seatInventoryId) || getIdString(instance.metadata?.seatInventoryId);

  if (academicYearId && programmeId && branchId) {
    const inventory = seatInventoryId
      ? await SeatInventory.findOne({ _id: seatInventoryId, collegeId: instance.collegeId })
      : await SeatInventory.findOne({ collegeId: instance.collegeId, academicYearId, programmeId, branchId });

    if (inventory) {
      seatInventoryId = String(inventory._id);
      availableSeats = getAvailableSeatsForQuota(inventory, quota, applicant.admissionType);
      if (seatAvailable === undefined) seatAvailable = availableSeats > 0;
    }
  }

  await saveInstanceMetadata(instance, compactMetadata({
    applicantId: String(applicant._id),
    academicYearId,
    programmeId,
    branchId,
    quota,
    seatInventoryId,
  }));

  return {
    result: {
      ...result,
      applicantId: String(applicant._id),
      academicYearId,
      programmeId,
      branchId,
      quota,
      seatInventoryId,
      ...(seatAvailable !== undefined ? { seatAvailable } : {}),
      ...(availableSeats !== undefined ? { availableSeats } : {}),
    },
  };
});

registerWorkflowStepHandler('W01', 'merit_rank', async ({ instance, result }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const meritScore = typeof result.meritScore === 'number' ? result.meritScore : undefined;
  const meritRank = typeof result.meritRank === 'number' ? result.meritRank : undefined;

  if (meritScore !== undefined) {
    await Applicant.findByIdAndUpdate(applicantId, { $set: { meritScore } });
  }

  await saveInstanceMetadata(instance, compactMetadata({
    ...(meritScore !== undefined ? { meritScore } : {}),
    ...(meritRank !== undefined ? { meritRank } : {}),
  }));

  return { result: { ...result, applicantId, ...(meritScore !== undefined ? { meritScore } : {}), ...(meritRank !== undefined ? { meritRank } : {}) } };
});

registerWorkflowStepHandler('W01', 'allotment', async ({ instance, result }) => {
  const applicant = await getApplicantContext(instance);
  if (!applicant) return;

  const academicYearId = getIdString(result.academicYearId) || getIdString(instance.metadata?.academicYearId) || getIdString(instance.academicYearId);
  const programmeId = getIdString(result.programmeId) || getIdString(instance.metadata?.programmeId);
  const branchId = getIdString(result.branchId) || getIdString(instance.metadata?.branchId);
  const allotmentRoundId = getIdString(result.allotmentRoundId) || getIdString(instance.metadata?.allotmentRoundId);
  const seatInventoryId = getIdString(result.seatInventoryId) || getIdString(instance.metadata?.seatInventoryId);
  const quota = normalizeQuota(result.quota || instance.metadata?.quota || applicant.quota);
  const meritScore = typeof result.meritScore === 'number' ? result.meritScore : applicant.meritScore;
  const status = typeof result.status === 'string' ? result.status : 'allotted';

  let allotmentResultId: string | undefined;
  let waitlistId: string | undefined;
  let previousAllotmentStatus: string | undefined;

  if (status === 'waitlisted' && academicYearId && programmeId && branchId) {
    const waitlist = await Waitlist.create({
      collegeId: instance.collegeId,
      academicYearId,
      applicantId: applicant._id,
      programmeId,
      branchId,
      allotmentRoundId,
      waitlistPosition: typeof result.waitlistPosition === 'number' ? result.waitlistPosition : 1,
      meritScore: meritScore || 0,
      quota,
      expiresAt: parseOptionalDate(result.expiresAt),
    });
    waitlistId = String(waitlist._id);
    await Applicant.findByIdAndUpdate(applicant._id, { $set: { status: 'under_review' } });
  } else if (allotmentRoundId) {
    const existingAllotment = await AllotmentResult.findOne({
      collegeId: instance.collegeId,
      allotmentRoundId,
      applicantId: applicant._id,
    });
    previousAllotmentStatus = existingAllotment?.status;

    const allotmentResult = await AllotmentResult.findOneAndUpdate(
      { collegeId: instance.collegeId, allotmentRoundId, applicantId: applicant._id },
      {
        $set: {
          collegeId: instance.collegeId,
          allotmentRoundId,
          applicantId: applicant._id,
          meritRank: typeof result.meritRank === 'number' ? result.meritRank : Number(instance.metadata?.meritRank || 1),
          meritScore: meritScore || 0,
          allottedProgrammeId: programmeId,
          allottedBranchId: branchId,
          preferenceNumber: typeof result.preferenceNumber === 'number' ? result.preferenceNumber : undefined,
          status,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    allotmentResultId = String(allotmentResult._id);
  }

  if (seatInventoryId) {
    await syncSeatInventoryAllotment(instance, seatInventoryId, quota, previousAllotmentStatus, status);
  }

  await saveInstanceMetadata(instance, compactMetadata({
    academicYearId,
    programmeId,
    branchId,
    quota,
    seatInventoryId,
    allotmentRoundId,
    allotmentResultId,
    waitlistId,
  }));

  return {
    result: {
      ...result,
      applicantId: String(applicant._id),
      academicYearId,
      programmeId,
      branchId,
      quota,
      seatInventoryId,
      allotmentRoundId,
      allotmentResultId,
      waitlistId,
      status,
      meritScore,
    },
  };
});

registerWorkflowStepHandler('W01', 'offer_generate', async ({ instance, result }) => {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return;

  const programmeId = getIdString(result.programmeId) || getIdString(instance.metadata?.programmeId);
  const branchId = getIdString(result.branchId) || getIdString(instance.metadata?.branchId);
  const validityDate = parseOptionalDate(result.validityDate) || addDays(7);
  const feeQuoted = typeof result.feeQuoted === 'number' ? result.feeQuoted : undefined;

  if (!programmeId || feeQuoted === undefined) {
    return { result: { ...result, applicantId } };
  }

  let offer = await AdmissionOffer.findOne({ collegeId: instance.collegeId, applicantId }).sort({ createdAt: -1 });
  if (!offer) {
    offer = await AdmissionOffer.create({
      collegeId: instance.collegeId,
      applicantId,
      programmeId,
      branchId,
      feeQuoted,
      validityDate,
      status: 'offered',
      allotmentRoundId: getIdString(result.allotmentRoundId) || getIdString(instance.metadata?.allotmentRoundId),
      allotmentResultId: getIdString(result.allotmentResultId) || getIdString(instance.metadata?.allotmentResultId),
      offerLetterUrl: typeof result.offerLetterUrl === 'string' ? result.offerLetterUrl : undefined,
    });
  } else {
    offer.set('programmeId', programmeId);
    if (branchId) {
      offer.set('branchId', branchId);
    }
    offer.feeQuoted = feeQuoted;
    offer.validityDate = validityDate;
    offer.status = 'offered';
    if (getIdString(result.allotmentRoundId) || getIdString(instance.metadata?.allotmentRoundId)) {
      offer.set('allotmentRoundId', getIdString(result.allotmentRoundId) || getIdString(instance.metadata?.allotmentRoundId));
    }
    if (getIdString(result.allotmentResultId) || getIdString(instance.metadata?.allotmentResultId)) {
      offer.set('allotmentResultId', getIdString(result.allotmentResultId) || getIdString(instance.metadata?.allotmentResultId));
    }
    if (typeof result.offerLetterUrl === 'string') offer.offerLetterUrl = result.offerLetterUrl;
    await offer.save();
  }

  await Applicant.findByIdAndUpdate(applicantId, {
    $set: {
      status: 'offered',
      offerStatus: 'offered',
      offeredProgramme: programmeId,
      offeredBranch: branchId,
      feeQuoted,
      offerDate: new Date(),
      offerValidTill: validityDate,
    },
  });
  await saveInstanceMetadata(instance, compactMetadata({
    offerId: String(offer._id),
    applicantId,
    programmeId,
    branchId,
  }));

  return { result: { ...result, applicantId, offerId: String(offer._id) } };
});

registerWorkflowStepHandler('W01', 'fee_negotiation', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  if (!applicant) return;

  const applicantId = String(applicant._id);
  const offerId = getIdString(result.offerId) || getIdString(instance.metadata?.offerId);
  const offer = offerId
    ? await AdmissionOffer.findOne({ _id: offerId, collegeId: instance.collegeId, applicantId })
    : await AdmissionOffer.findOne({ collegeId: instance.collegeId, applicantId }).sort({ createdAt: -1 });

  if (!offer) {
    return { result: { ...result, applicantId } };
  }

  let negotiation = getIdString(result.negotiationId) || getIdString(instance.metadata?.negotiationId)
    ? await FeeNegotiation.findOne({
      _id: getIdString(result.negotiationId) || getIdString(instance.metadata?.negotiationId),
      collegeId: instance.collegeId,
      applicantId,
    })
    : await FeeNegotiation.findOne({ collegeId: instance.collegeId, applicantId, offerId: offer._id }).sort({ createdAt: -1 });

  if (!negotiation) {
    const requestedWaiver = typeof result.requestedWaiver === 'number'
      ? result.requestedWaiver
      : typeof result.approvedWaiver === 'number'
        ? result.approvedWaiver
        : 0;
    const created = await createFeeNegotiationRecord(String(instance.collegeId), {
      applicantId,
      offerId: String(offer._id),
      originalFee: offer.negotiatedFee || offer.feeQuoted,
      requestedWaiver,
      requestedReason: typeof result.requestedReason === 'string' && result.requestedReason.trim().length > 0
        ? result.requestedReason.trim()
        : 'Workflow negotiation request',
    }, completedBy);
    negotiation = await FeeNegotiation.findById(created._id);
  }

  const resolutionStatus = typeof result.status === 'string'
    ? result.status
    : typeof result.negotiationStatus === 'string'
      ? result.negotiationStatus
      : undefined;

  if (negotiation && (resolutionStatus === 'approved' || resolutionStatus === 'rejected' || resolutionStatus === 'counter_offered')) {
    const approvedWaiver = typeof result.approvedWaiver === 'number'
      ? result.approvedWaiver
      : resolutionStatus === 'approved'
        ? negotiation.requestedWaiver
        : 0;
    const finalFee = typeof result.finalFee === 'number'
      ? result.finalFee
      : Math.max(negotiation.originalFee - approvedWaiver, 0);

    const resolved = await resolveFeeNegotiationRecord(String(instance.collegeId), String(negotiation._id), {
      status: resolutionStatus,
      approvedWaiver,
      finalFee,
      counterOffer: typeof result.counterOffer === 'number' ? result.counterOffer : undefined,
      notes: typeof result.notes === 'string' ? result.notes : undefined,
    }, completedBy);
    negotiation = await FeeNegotiation.findById(resolved._id);
  }

  await saveInstanceMetadata(instance, compactMetadata({
    applicantId,
    offerId: String(offer._id),
    negotiationId: negotiation ? String(negotiation._id) : undefined,
  }));

  return {
    result: {
      ...result,
      applicantId,
      offerId: String(offer._id),
      negotiationId: negotiation ? String(negotiation._id) : undefined,
      negotiationStatus: negotiation?.status,
      approvalLevel: negotiation?.approvalLevel,
      approvedWaiver: negotiation?.approvedWaiver,
      finalFee: negotiation?.finalFee,
    },
  };
});

registerWorkflowStepHandler('W01', 'offer_acceptance', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  if (!applicant) return;

  const applicantId = String(applicant._id);
  const offerId = getIdString(result.offerId) || getIdString(instance.metadata?.offerId);
  const offer = offerId
    ? await AdmissionOffer.findOne({ _id: offerId, collegeId: instance.collegeId, applicantId })
    : await AdmissionOffer.findOne({ collegeId: instance.collegeId, applicantId }).sort({ createdAt: -1 });

  if (offer) {
    offer.status = 'accepted';
    offer.acceptedAt = new Date();
    await offer.save();
    await saveInstanceMetadata(instance, { offerId: String(offer._id) });
  }

  const allotmentResultId = getIdString(result.allotmentResultId) || getIdString(instance.metadata?.allotmentResultId);
  if (allotmentResultId) {
    await AllotmentResult.findOneAndUpdate(
      { _id: allotmentResultId, collegeId: instance.collegeId, applicantId },
      { $set: { status: 'accepted', acceptedAt: new Date() } },
    );
  }

  let admission = await Admission.findOne({ collegeId: instance.collegeId, applicantId });
  if (!admission) {
    admission = await Admission.create({
      collegeId: instance.collegeId,
      applicantId,
      academicYearId: getIdString(result.academicYearId) || getIdString(instance.metadata?.academicYearId) || instance.academicYearId,
      admissionDate: parseOptionalDate(result.admissionDate) || new Date(),
      admittedBy: completedBy,
      admissionType: applicant.admissionType || (typeof result.admissionType === 'string' ? result.admissionType : 'fresh'),
      workflowInstanceId: instance._id,
      provisioningStatus: 'pending',
      provisioning: buildDefaultProvisioning(),
    });
  } else {
    admission.set('workflowInstanceId', instance._id);
    admission.admittedBy = completedBy;
    admission.admissionDate = parseOptionalDate(result.admissionDate) || admission.admissionDate || new Date();
    admission.admissionType = admission.admissionType || applicant.admissionType || 'fresh';
    admission.provisioningStatus = admission.provisioningStatus || 'pending';
    admission.provisioning = admission.provisioning || buildDefaultProvisioning();
    await admission.save();
  }

  await Applicant.findByIdAndUpdate(applicantId, {
    $set: {
      status: result.paymentConfirmed === true ? 'fee_paid' : 'accepted',
      offerStatus: 'accepted',
      admissionDate: admission.admissionDate,
      admittedBy: completedBy,
    },
  });
  await saveInstanceMetadata(instance, compactMetadata({ admissionId: String(admission._id), applicantId }));

  return {
    result: {
      ...result,
      applicantId,
      offerId: offer ? String(offer._id) : offerId,
      admissionId: String(admission._id),
      allotmentResultId,
    },
  };
});

registerWorkflowStepHandler('W01', 'provision_m02', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  if (!applicant || !admission) return;

  const provisioningContext = await getProvisioningContext(instance, applicant, admission);
  const enrollmentNumber = applicant.enrollmentNumber || buildEnrollmentNumber(applicant);
  const rollNumber = buildRollNumber(provisioningContext.branch?.code, applicant, provisioningContext.admissionYear);

  let person = await findProvisionedPerson(instance, applicant, admission);
  if (!person) {
    person = await Person.create({
      collegeId: instance.collegeId,
      name: applicant.name,
      phone: applicant.phone,
      email: applicant.email,
      aadhaar: applicant.aadharNumber,
      dob: applicant.dateOfBirth,
      gender: applicant.gender,
      address: compactMetadata({
        line1: applicant.address,
        city: applicant.city,
        state: applicant.state,
        pincode: applicant.pincode,
      }),
    });
    await createAuditLog({
      collegeId: String(instance.collegeId),
      entityType: 'Person',
      entityId: String(person._id),
      entityName: applicant.name,
      action: 'create',
      changes: [],
      performedBy: completedBy,
    });
  } else {
    person.set(compactMetadata({
      name: applicant.name,
      phone: applicant.phone,
      email: applicant.email,
      aadhaar: applicant.aadharNumber,
      dob: applicant.dateOfBirth,
      gender: applicant.gender,
      address: compactMetadata({
        line1: applicant.address,
        city: applicant.city,
        state: applicant.state,
        pincode: applicant.pincode,
      }),
    }));
    await person.save();
  }

  let student = await findProvisionedStudent(instance, admission, person);
  if (!student) {
    student = await Student.create({
      collegeId: instance.collegeId,
      personId: person._id,
      admissionYear: provisioningContext.admissionYear,
      category: applicant.category,
      quota: normalizeStudentQuota(applicant.quota),
      regulationId: provisioningContext.regulation?._id,
      programmeId: provisioningContext.programme?._id,
      branchId: provisioningContext.branch?._id,
      batchId: provisioningContext.batch?._id,
      rollNumber,
      status: 'active',
    });
    await createAuditLog({
      collegeId: String(instance.collegeId),
      entityType: 'Student',
      entityId: String(student._id),
      entityName: applicant.name,
      action: 'create',
      changes: [],
      performedBy: completedBy,
    });
  } else {
    student.set(compactMetadata({
      personId: person._id,
      admissionYear: provisioningContext.admissionYear,
      category: applicant.category,
      quota: normalizeStudentQuota(applicant.quota),
      regulationId: provisioningContext.regulation?._id,
      programmeId: provisioningContext.programme?._id,
      branchId: provisioningContext.branch?._id,
      batchId: provisioningContext.batch?._id,
      rollNumber: student.rollNumber || rollNumber,
      status: 'active',
    }));
    await student.save();
  }

  if (!applicant.enrollmentNumber) {
    applicant.enrollmentNumber = enrollmentNumber;
    await applicant.save();
  }

  admission.studentId = student._id as any;
  await admission.save();

  await saveInstanceMetadata(instance, compactMetadata({
    personId: String(person._id),
    studentId: String(student._id),
    batchId: provisioningContext.batch ? String(provisioningContext.batch._id) : undefined,
    regulationId: provisioningContext.regulation ? String(provisioningContext.regulation._id) : undefined,
    rollNumber: student.rollNumber,
    enrollmentNumber,
  }));

  const provisioningResult = {
    ...result,
    personId: String(person._id),
    studentId: String(student._id),
    batchId: provisioningContext.batch ? String(provisioningContext.batch._id) : undefined,
    regulationId: provisioningContext.regulation ? String(provisioningContext.regulation._id) : undefined,
    rollNumber: student.rollNumber,
    enrollmentNumber,
    personStatus: 'completed',
    studentStatus: 'completed',
  };

  await updateProvisioningStatus(instance, {
    m02_person: 'completed',
    m02_student: 'completed',
  }, provisioningResult);

  return { result: provisioningResult };
});

registerWorkflowStepHandler('W01', 'provision_m03', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  if (!applicant || !admission || !admission.studentId) return;

  const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
  if (!student) return;

  const provisioningContext = await getProvisioningContext(instance, applicant, admission);
  const entryPoint = getEntryPoint(applicant.admissionType);

  const semester = await resolveProvisioningSemester(instance, provisioningContext.academicYear?._id, entryPoint.semesterNumber);
  let section = await resolveProvisioningSection(instance, provisioningContext.branch?._id, provisioningContext.batch?._id, entryPoint.studyYear, entryPoint.semesterNumber, completedBy);

  let offeringsCreated = 0;
  let enrollmentsCreated = 0;
  let courseStatus: 'completed' | 'skipped' = 'skipped';

  if (semester && section && provisioningContext.branch && provisioningContext.regulation && provisioningContext.programme) {
    const curriculumMaps = await CurriculumMap.find({
      collegeId: instance.collegeId,
      regulationId: provisioningContext.regulation._id,
      programmeId: provisioningContext.programme._id,
      branchId: provisioningContext.branch._id,
      semester: entryPoint.semesterNumber,
    }).lean();

    if (curriculumMaps.length > 0) {
      const existingOfferings = await CourseOffering.find({
        collegeId: instance.collegeId,
        semesterId: semester._id,
        sectionId: section._id,
        courseId: { $in: curriculumMaps.map((item) => item.courseId) },
      });
      const offeringByCourseId = new Map(existingOfferings.map((item) => [String(item.courseId), item]));
      const faculty = await resolveProvisioningFaculty(instance, getIdString(provisioningContext.branch.departmentId));

      for (const item of curriculumMaps) {
        if (!offeringByCourseId.has(String(item.courseId)) && faculty) {
          const offering = await CourseOffering.create({
            collegeId: instance.collegeId,
            courseId: item.courseId,
            semesterId: semester._id,
            sectionId: section._id,
            facultyId: faculty._id,
            maxEnrollment: section.capacity,
          });
          offeringByCourseId.set(String(item.courseId), offering);
          offeringsCreated += 1;
          await createAuditLog({
            collegeId: String(instance.collegeId),
            entityType: 'CourseOffering',
            entityId: String(offering._id),
            entityName: String(offering._id),
            action: 'create',
            changes: [],
            performedBy: completedBy,
          });
        }
      }

      const availableOfferings = [...offeringByCourseId.values()];
      if (availableOfferings.length > 0) {
        const existingEnrollments = await Enrollment.find({
          collegeId: instance.collegeId,
          studentId: student._id,
          semesterId: semester._id,
          courseOfferingId: { $in: availableOfferings.map((item) => item._id) },
        }).lean();
        const enrolledOfferingIds = new Set(existingEnrollments.map((item) => String(item.courseOfferingId)));

        for (const offering of availableOfferings) {
          if (enrolledOfferingIds.has(String(offering._id))) continue;
          const enrollment = await Enrollment.create({
            collegeId: instance.collegeId,
            studentId: student._id,
            courseOfferingId: offering._id,
            semesterId: semester._id,
            status: 'enrolled',
            enrolledAt: new Date(),
          });
          await CourseOffering.updateOne({ _id: offering._id }, { $inc: { enrolledCount: 1 } });
          enrollmentsCreated += 1;
          await createAuditLog({
            collegeId: String(instance.collegeId),
            entityType: 'Enrollment',
            entityId: String(enrollment._id),
            entityName: String(enrollment._id),
            action: 'create',
            changes: [],
            performedBy: completedBy,
          });
        }

        courseStatus = availableOfferings.length === curriculumMaps.length ? 'completed' : 'skipped';
      }
    }
  }

  await saveInstanceMetadata(instance, compactMetadata({
    studentId: String(student._id),
    sectionId: section ? String(section._id) : undefined,
    semesterId: semester ? String(semester._id) : undefined,
  }));

  const provisioningResult = {
    ...result,
    studentId: String(student._id),
    sectionId: section ? String(section._id) : undefined,
    semesterId: semester ? String(semester._id) : undefined,
    offeringsCreated,
    enrollmentsCreated,
    sectionStatus: section ? 'completed' : 'skipped',
    coursesStatus: courseStatus,
  };

  await updateProvisioningStatus(instance, {
    m03_section: section ? 'completed' : 'skipped',
    m03_courses: courseStatus,
  }, provisioningResult);

  return { result: provisioningResult };
});

registerWorkflowStepHandler('W01', 'provision_m04', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  if (!applicant || !admission || !admission.studentId) return;

  const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
  if (!student) return;

  const provisioningContext = await getProvisioningContext(instance, applicant, admission);
  const entryPoint = getEntryPoint(applicant.admissionType);
  const feeStructure = await resolveFeeStructure(instance, {
    academicYearId: getIdString(admission.academicYearId) || provisioningContext.academicYearId,
    programmeId: getIdString(student.programmeId) || provisioningContext.programmeId,
    branchId: getIdString(student.branchId) || provisioningContext.branchId,
    quota: normalizeStudentQuota(student.quota || applicant.quota),
    category: applicant.category,
    year: entryPoint.studyYear,
  });

  let feeAccount = await StudentFeeAccount.findOne({ collegeId: instance.collegeId, studentId: student._id });
  if (!feeAccount) {
    feeAccount = await StudentFeeAccount.create({
      collegeId: instance.collegeId,
      studentId: student._id,
      totalDue: feeStructure?.totalAmount || 0,
      totalPaid: 0,
      totalWaived: 0,
      totalRefunded: 0,
      balance: feeStructure?.totalAmount || 0,
    });
    await createAuditLog({
      collegeId: String(instance.collegeId),
      entityType: 'StudentFeeAccount',
      entityId: String(feeAccount._id),
      entityName: 'Fee Account',
      action: 'create',
      changes: [],
      performedBy: completedBy,
    });
  } else if (feeStructure) {
    feeAccount.totalDue = feeStructure.totalAmount;
    feeAccount.balance = Math.max(feeStructure.totalAmount - feeAccount.totalPaid - feeAccount.totalWaived + feeAccount.totalRefunded, 0);
    await feeAccount.save();
  }

  let invoice: any = null;
  if (feeStructure) {
    invoice = await Invoice.findOne({
      collegeId: instance.collegeId,
      studentId: student._id,
      type: 'fee',
      status: { $in: ['draft', 'issued', 'overdue', 'paid'] },
    }).sort({ createdAt: -1 });

    if (!invoice) {
      invoice = await Invoice.create({
        collegeId: instance.collegeId,
        invoiceNumber: await generateInvoiceNumber(instance),
        studentId: student._id,
        type: 'fee',
        items: feeStructure.components.map((item) => ({ description: item.name || 'Fee Component', amount: item.amount || 0 })),
        totalAmount: feeStructure.totalAmount,
        dueDate: addDays(14),
        status: 'issued',
        issuedDate: new Date(),
      });
      await createAuditLog({
        collegeId: String(instance.collegeId),
        entityType: 'Invoice',
        entityId: String(invoice._id),
        entityName: invoice.invoiceNumber,
        action: 'create',
        changes: [],
        performedBy: completedBy,
      });
    }
  }

  await saveInstanceMetadata(instance, compactMetadata({
    studentId: String(student._id),
    feeAccountId: feeAccount ? String(feeAccount._id) : undefined,
    invoiceId: invoice ? String(invoice._id) : undefined,
    feeStructureId: feeStructure ? String(feeStructure._id) : undefined,
  }));

  const provisioningResult = {
    ...result,
    studentId: String(student._id),
    feeAccountId: feeAccount ? String(feeAccount._id) : undefined,
    invoiceId: invoice ? String(invoice._id) : undefined,
    feeStructureId: feeStructure ? String(feeStructure._id) : undefined,
    invoiceStatus: invoice ? 'completed' : 'skipped',
  };

  await updateProvisioningStatus(instance, {
    m04_invoice: invoice ? 'completed' : 'skipped',
  }, provisioningResult);

  return { result: provisioningResult };
});

registerWorkflowStepHandler('W01', 'provision_m08', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  if (!applicant || !admission || !admission.studentId) return;

  const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
  const personId = getIdString(instance.metadata?.personId) || (student ? getIdString(student.personId) : undefined);
  if (!student || !personId) return;

  const person = await Person.findOne({ _id: personId, collegeId: instance.collegeId });
  const provisioningContext = await getProvisioningContext(instance, applicant, admission);
  const academicYearId = getIdString(admission.academicYearId) || provisioningContext.academicYearId;

  const libraryRequired = result.libraryRequired !== false;
  const hostelRequired = result.hostelRequired === true;
  const transportRequired = result.transportRequired === true;
  const preferredStopName = typeof result.preferredStopName === 'string' ? result.preferredStopName.trim() : undefined;

  let hostelStatus: 'completed' | 'failed' | 'skipped' = hostelRequired ? 'failed' : 'skipped';
  let hostelAllocation: any = null;
  let hostelRoom: any = null;
  if (hostelRequired && academicYearId) {
    hostelAllocation = await HostelAllocation.findOne({
      collegeId: instance.collegeId,
      studentId: student._id,
      academicYearId,
      status: 'active',
    });

    if (!hostelAllocation) {
      hostelRoom = await resolveHostelRoom(instance, applicant.gender);
      if (hostelRoom) {
        hostelAllocation = await HostelAllocation.create({
          collegeId: instance.collegeId,
          studentId: student._id,
          roomId: hostelRoom._id,
          academicYearId,
          allocatedDate: new Date(),
          status: 'active',
        });

        const nextOccupancy = Math.min((hostelRoom.occupancy || 0) + 1, hostelRoom.capacity || 0);
        hostelRoom.occupancy = nextOccupancy;
        hostelRoom.status = nextOccupancy >= (hostelRoom.capacity || 0) ? 'full' : 'available';
        await hostelRoom.save();

        await createAuditLog({
          collegeId: String(instance.collegeId),
          entityType: 'HostelAllocation',
          entityId: String(hostelAllocation._id),
          entityName: String(hostelRoom.roomNumber),
          action: 'create',
          changes: [],
          performedBy: completedBy,
        });
      }
    } else {
      hostelRoom = await HostelRoom.findOne({ _id: hostelAllocation.roomId, collegeId: instance.collegeId });
    }

    hostelStatus = hostelAllocation ? 'completed' : 'failed';
  }

  let transportStatus: 'completed' | 'failed' | 'skipped' = transportRequired ? 'failed' : 'skipped';
  let transportAllocation: any = null;
  let transportRoute: any = null;
  if (transportRequired && academicYearId) {
    transportAllocation = await TransportAllocation.findOne({
      collegeId: instance.collegeId,
      studentId: student._id,
      academicYearId,
      status: 'active',
    });

    if (!transportAllocation) {
      transportRoute = await resolveTransportRoute(instance, applicant, academicYearId, preferredStopName);
      const stopName = transportRoute ? pickTransportStopName(transportRoute, preferredStopName) : undefined;
      if (transportRoute && stopName) {
        transportAllocation = await TransportAllocation.create({
          collegeId: instance.collegeId,
          studentId: student._id,
          routeId: transportRoute._id,
          stopName,
          academicYearId,
          status: 'active',
        });

        await createAuditLog({
          collegeId: String(instance.collegeId),
          entityType: 'TransportAllocation',
          entityId: String(transportAllocation._id),
          entityName: stopName,
          action: 'create',
          changes: [],
          performedBy: completedBy,
        });
      }
    } else {
      transportRoute = await TransportRoute.findOne({ _id: transportAllocation.routeId, collegeId: instance.collegeId });
    }

    transportStatus = transportAllocation ? 'completed' : 'failed';
  }

  let libraryStatus: 'completed' | 'failed' | 'skipped' = libraryRequired ? 'failed' : 'skipped';
  let libraryMember: any = null;
  if (libraryRequired && person) {
    libraryMember = await LibraryMember.findOne({ collegeId: instance.collegeId, personId: person._id });
    if (!libraryMember) {
      libraryMember = await LibraryMember.create({
        collegeId: instance.collegeId,
        personId: person._id,
        memberType: 'student',
        membershipId: await generateLibraryMembershipId(instance),
        maxBooks: 4,
        currentIssued: 0,
        finesDue: 0,
        isActive: true,
      });

      await createAuditLog({
        collegeId: String(instance.collegeId),
        entityType: 'LibraryMember',
        entityId: String(libraryMember._id),
        entityName: libraryMember.membershipId,
        action: 'create',
        changes: [],
        performedBy: completedBy,
      });
    } else if (libraryMember.isActive !== true) {
      libraryMember.isActive = true;
      await libraryMember.save();
    }

    libraryStatus = libraryMember ? 'completed' : 'failed';
  }

  await saveInstanceMetadata(instance, compactMetadata({
    hostelAllocationId: hostelAllocation ? String(hostelAllocation._id) : undefined,
    transportAllocationId: transportAllocation ? String(transportAllocation._id) : undefined,
    libraryMemberId: libraryMember ? String(libraryMember._id) : undefined,
  }));

  const provisioningResult = {
    ...result,
    studentId: String(student._id),
    hostelAllocationId: hostelAllocation ? String(hostelAllocation._id) : undefined,
    hostelRoomId: hostelRoom ? String(hostelRoom._id) : undefined,
    hostelRoomNumber: hostelRoom?.roomNumber,
    transportAllocationId: transportAllocation ? String(transportAllocation._id) : undefined,
    transportRouteId: transportRoute ? String(transportRoute._id) : undefined,
    transportRouteName: transportRoute?.name,
    transportStopName: transportAllocation?.stopName,
    libraryMemberId: libraryMember ? String(libraryMember._id) : undefined,
    libraryMembershipId: libraryMember?.membershipId,
    hostelStatus,
    transportStatus,
    libraryStatus,
  };

  await updateProvisioningStatus(instance, {
    m08_hostel: hostelStatus,
    m08_transport: transportStatus,
    m08_library: libraryStatus,
  }, provisioningResult);

  return { result: provisioningResult };
});

registerWorkflowStepHandler('W01', 'provision_m12', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  if (!applicant || !admission || !admission.studentId) return;

  const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
  const personId = getIdString(instance.metadata?.personId) || (student ? getIdString(student.personId) : undefined);
  if (!student || !personId) return;

  const provisionedEmail = applicant.email || buildStudentEmail(applicant);
  const provisionedPassword = typeof result.initialPassword === 'string' ? result.initialPassword : 'Juvion@123';
  const hashedPassword = await bcrypt.hash(provisionedPassword, 10);

  let user = getIdString(instance.metadata?.userId)
    ? await User.findOne({ _id: getIdString(instance.metadata?.userId), collegeId: instance.collegeId })
    : null;

  if (!user) {
    user = await User.findOne({
      collegeId: instance.collegeId,
      $or: [
        { personId },
        { email: provisionedEmail },
      ],
    });
  }

  if (!user) {
    user = await User.create({
      collegeId: instance.collegeId,
      email: provisionedEmail,
      password: hashedPassword,
      name: applicant.name,
      role: 'student',
      personaType: 'student',
      personId,
      isActive: true,
    });
    await createAuditLog({
      collegeId: String(instance.collegeId),
      entityType: 'User',
      entityId: String(user._id),
      entityName: user.email,
      action: 'create',
      changes: [],
      performedBy: completedBy,
    });
  } else {
    user.set({
      email: provisionedEmail,
      name: applicant.name,
      role: 'student',
      personaType: 'student',
      personId,
      isActive: true,
    });
    if (result.resetPassword === true) {
      user.password = hashedPassword;
    }
    await user.save();
  }

  await saveInstanceMetadata(instance, {
    userId: String(user._id),
  });

  const provisioningResult = {
    ...result,
    studentId: String(student._id),
    userId: String(user._id),
    email: user.email,
    initialPassword: provisionedPassword,
    accountStatus: 'completed',
  };

  await updateProvisioningStatus(instance, {
    m12_account: 'completed',
  }, provisioningResult);

  return { result: provisioningResult };
});

registerWorkflowStepHandler('W01', 'provision_juvi', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  if (!applicant || !admission || !admission.studentId) return;

  const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
  const personId = getIdString(instance.metadata?.personId) || (student ? getIdString(student.personId) : undefined);
  if (!student || !personId) return;

  const personaType = typeof result.personaType === 'string' ? result.personaType : 'student';
  const createConversation = result.createConversation !== false;
  const createWelcomeMessage = result.createWelcomeMessage !== false;

  const personaConfig = await JuviPersonaConfig.findOne({
    collegeId: instance.collegeId,
    personaType,
    isActive: true,
  });

  let conversation: any = null;
  if (createConversation) {
    conversation = await JuviConversation.findOne({
      collegeId: instance.collegeId,
      userId: personId,
      personaType,
      status: 'active',
    }).sort({ createdAt: -1 });

    if (!conversation) {
      conversation = await JuviConversation.create({
        collegeId: instance.collegeId,
        userId: personId,
        personaType,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 0,
        status: 'active',
      });

      await createAuditLog({
        collegeId: String(instance.collegeId),
        entityType: 'JuviConversation',
        entityId: String(conversation._id),
        entityName: `${personaType} onboarding`,
        action: 'create',
        changes: [],
        performedBy: completedBy,
      });
    }
  }

  let welcomeMessage: any = null;
  if (conversation && createWelcomeMessage) {
    const existingMessage = await JuviMessage.findOne({
      collegeId: instance.collegeId,
      conversationId: conversation._id,
      role: 'assistant',
      intent: 'student_onboarding',
    }).sort({ createdAt: 1 });

    if (!existingMessage) {
      const content = buildJuviWelcomeMessage(applicant.name, personaConfig?.displayName, {
        hasHostel: result.hostelStatus === 'completed' || result.hostelAllocationId,
        hasTransport: result.transportStatus === 'completed' || result.transportAllocationId,
        hasLibrary: result.libraryStatus === 'completed' || result.libraryMemberId,
      });

      welcomeMessage = await JuviMessage.create({
        collegeId: instance.collegeId,
        conversationId: conversation._id,
        role: 'assistant',
        content,
        intent: 'student_onboarding',
        tokens: Math.ceil(content.length / 4),
      });

      await JuviAction.create({
        collegeId: instance.collegeId,
        conversationId: conversation._id,
        actionType: 'create',
        module: 'juvi',
        entity: 'StudentOnboarding',
        operation: 'bootstrapConversation',
        payload: {
          studentId: String(student._id),
          personId,
          personaType,
        },
        result: {
          conversationId: String(conversation._id),
          messageId: String(welcomeMessage._id),
        },
        status: 'executed',
        executedAt: new Date(),
      });

      conversation.lastMessageAt = new Date();
      conversation.messageCount = (conversation.messageCount || 0) + 1;
      await conversation.save();
    } else {
      welcomeMessage = existingMessage;
    }
  }

  const juviStatus: 'completed' | 'failed' | 'skipped' = createConversation
    ? (conversation ? 'completed' : 'failed')
    : 'skipped';

  await saveInstanceMetadata(instance, compactMetadata({
    juviConversationId: conversation ? String(conversation._id) : undefined,
  }));

  const provisioningResult = {
    ...result,
    studentId: String(student._id),
    juviConversationId: conversation ? String(conversation._id) : undefined,
    juviMessageId: welcomeMessage ? String(welcomeMessage._id) : undefined,
    juviPersonaType: personaType,
    juviDisplayName: personaConfig?.displayName,
    juviStatus,
  };

  await updateProvisioningStatus(instance, {
    juvi_account: juviStatus,
  }, provisioningResult);

  return { result: provisioningResult };
});

registerWorkflowStepHandler('W01', 'onboarding_complete', async ({ instance, result, completedBy }) => {
  const admission = await ensureAdmissionLinked(instance);
  if (!admission) return;

  const statuses = Object.values(admission.provisioning || {});
  const hasFailures = statuses.includes('failed');

  admission.provisioningStatus = hasFailures ? 'partial_failure' : 'completed';
  admission.provisioningCompletedAt = new Date();
  if (getIdString(result.studentId)) {
    admission.studentId = new mongoose.Types.ObjectId(String(result.studentId)) as any;
  }
  await admission.save();

  await Applicant.findByIdAndUpdate(admission.applicantId, {
    $set: {
      status: 'enrolled',
      admissionDate: admission.admissionDate,
      admittedBy: completedBy,
      enrollmentNumber: typeof result.enrollmentNumber === 'string' ? result.enrollmentNumber : undefined,
    },
  });
});

registerWorkflowStepHandler('W01', 'cancel_request', async ({ instance, result, completedBy }) => {
  const applicant = await getApplicantContext(instance);
  if (!applicant) return;

  const admission = await ensureAdmissionLinked(instance);
  let cancellation = await ensureCancellationLinked(instance);
  if (!cancellation) {
    const created = await createCancellationRecord(String(instance.collegeId), {
      applicantId: String(applicant._id),
      admissionId: admission ? String(admission._id) : undefined,
      studentId: admission?.studentId ? String(admission.studentId) : undefined,
      cancellationType: typeof result.cancellationType === 'string'
        ? result.cancellationType
        : (admission?.studentId ? 'post_enrolment' : 'pre_enrolment'),
      reason: typeof result.reason === 'string' && result.reason.trim().length > 0
        ? result.reason.trim()
        : 'Admission cancellation approved through workflow',
      reasonCategory: typeof result.reasonCategory === 'string'
        ? result.reasonCategory
        : 'student_request',
      refundAmount: typeof result.refundAmount === 'number' ? result.refundAmount : undefined,
    }, completedBy);
    cancellation = await AdmissionCancellation.findById(created._id);
  }

  if (!cancellation) return;

  cancellation.status = 'approved';
  cancellation.approvedBy = completedBy;
  cancellation.approvalLevel = typeof result.approvalLevel === 'string' ? result.approvalLevel : cancellation.approvalLevel || 'staff';
  if (typeof result.refundAmount === 'number') cancellation.refundAmount = result.refundAmount;
  if (admission?._id && !cancellation.admissionId) cancellation.admissionId = admission._id as any;
  if (admission?.studentId && !cancellation.studentId) cancellation.studentId = admission.studentId as any;
  await cancellation.save();

  await saveInstanceMetadata(instance, compactMetadata({
    applicantId: String(applicant._id),
    admissionId: admission ? String(admission._id) : undefined,
    studentId: admission?.studentId ? String(admission.studentId) : undefined,
    cancellationId: String(cancellation._id),
  }));

  return {
    result: {
      ...result,
      applicantId: String(applicant._id),
      admissionId: admission ? String(admission._id) : undefined,
      studentId: admission?.studentId ? String(admission.studentId) : undefined,
      cancellationId: String(cancellation._id),
      cancellationStatus: cancellation.status,
    },
  };
});

registerWorkflowStepHandler('W01', 'cancel_m02', async ({ instance, result }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  const cancellation = await ensureCancellationLinked(instance);

  let student: any = null;
  if (admission?.studentId) {
    student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
    if (student) {
      student.status = 'exited';
      await student.save();
    }
  }

  if (applicant) {
    await Applicant.findByIdAndUpdate(applicant._id, { $set: { status: 'withdrawn' } });
  }

  if (cancellation) {
    await updateCancellationReversal(cancellation, 'M02', 'completed');
  }

  return {
    result: {
      ...result,
      applicantId: applicant ? String(applicant._id) : undefined,
      studentId: student ? String(student._id) : undefined,
      applicantStatus: applicant ? 'withdrawn' : undefined,
      studentStatus: student ? 'exited' : undefined,
    },
  };
});

registerWorkflowStepHandler('W01', 'cancel_m04', async ({ instance, result }) => {
  const applicant = await getApplicantContext(instance);
  const admission = await ensureAdmissionLinked(instance);
  const cancellation = await ensureCancellationLinked(instance);
  if (!applicant) return;

  let feeAccount: any = null;
  let refundAmount = typeof result.refundAmount === 'number' ? result.refundAmount : (cancellation?.refundAmount || 0);
  let cancelledInvoices = 0;

  if (admission?.studentId) {
    feeAccount = await StudentFeeAccount.findOne({ collegeId: instance.collegeId, studentId: admission.studentId });
    if (feeAccount && refundAmount > 0) {
      feeAccount.totalRefunded = (feeAccount.totalRefunded || 0) + refundAmount;
      feeAccount.balance = Math.max((feeAccount.totalDue || 0) - (feeAccount.totalPaid || 0) - (feeAccount.totalWaived || 0) + (feeAccount.totalRefunded || 0), 0);
      await feeAccount.save();
    }

    const invoices = await Invoice.find({
      collegeId: instance.collegeId,
      studentId: admission.studentId,
      status: { $in: ['draft', 'issued', 'overdue'] },
    });
    cancelledInvoices = invoices.length;
    for (const invoice of invoices) {
      invoice.status = 'cancelled';
      await invoice.save();
    }
  }

  const offer = await AdmissionOffer.findOne({ collegeId: instance.collegeId, applicantId: applicant._id }).sort({ createdAt: -1 });
  if (offer && offer.status !== 'declined') {
    offer.status = 'declined';
    offer.declinedAt = new Date();
    offer.declineReason = 'Admission cancelled';
    await offer.save();
  }

  const allotmentResultId = getIdString(instance.metadata?.allotmentResultId);
  const allotmentResult = allotmentResultId
    ? await AllotmentResult.findOne({ _id: allotmentResultId, collegeId: instance.collegeId, applicantId: applicant._id })
    : await AllotmentResult.findOne({ collegeId: instance.collegeId, applicantId: applicant._id }).sort({ createdAt: -1 });
  if (allotmentResult) {
    allotmentResult.status = 'declined';
    allotmentResult.declinedAt = new Date();
    allotmentResult.declineReason = 'Admission cancelled';
    await allotmentResult.save();
  }

  const seatRelease = cancellation
    ? await releaseSeatAndPromoteWaitlist(instance, cancellation)
    : { seatReleased: false, waitlistPromotionTriggered: false };

  if (cancellation) {
    cancellation.refundStatus = refundAmount > 0 ? 'processed' : 'not_applicable';
    cancellation.refundTransactionId = refundAmount > 0
      ? (typeof result.refundTransactionId === 'string' ? result.refundTransactionId : `RFND-${Date.now()}`)
      : undefined;
    cancellation.seatReleased = seatRelease.seatReleased;
    cancellation.waitlistPromotionTriggered = seatRelease.waitlistPromotionTriggered;
    await cancellation.save();
    await updateCancellationReversal(cancellation, 'M04', 'completed');
  }

  return {
    result: {
      ...result,
      applicantId: String(applicant._id),
      feeAccountId: feeAccount ? String(feeAccount._id) : undefined,
      cancelledInvoices,
      refundAmount,
      refundStatus: cancellation?.refundStatus,
      seatReleased: seatRelease.seatReleased,
      waitlistPromotionTriggered: seatRelease.waitlistPromotionTriggered,
    },
  };
});

registerWorkflowStepHandler('W01', 'cancel_m08', async ({ instance, result }) => {
  const admission = await ensureAdmissionLinked(instance);
  const cancellation = await ensureCancellationLinked(instance);
  if (!admission?.studentId) return;

  const academicYearId = getIdString(admission.academicYearId) || getIdString(instance.metadata?.academicYearId);
  let hostelReleased = 0;
  let transportCancelled = 0;
  let libraryDeactivated = false;

  const hostelAllocations = await HostelAllocation.find({
    collegeId: instance.collegeId,
    studentId: admission.studentId,
    status: 'active',
    ...(academicYearId ? { academicYearId } : {}),
  });
  for (const allocation of hostelAllocations) {
    allocation.status = 'vacated';
    allocation.vacatedDate = new Date();
    await allocation.save();
    hostelReleased += 1;

    const room = await HostelRoom.findOne({ _id: allocation.roomId, collegeId: instance.collegeId });
    if (room) {
      room.occupancy = Math.max((room.occupancy || 0) - 1, 0);
      room.status = room.occupancy >= room.capacity ? 'full' : 'available';
      await room.save();
    }
  }

  const transportAllocations = await TransportAllocation.find({
    collegeId: instance.collegeId,
    studentId: admission.studentId,
    status: 'active',
    ...(academicYearId ? { academicYearId } : {}),
  });
  for (const allocation of transportAllocations) {
    allocation.status = 'cancelled';
    await allocation.save();
    transportCancelled += 1;
  }

  const personId = getIdString(instance.metadata?.personId);
  if (personId) {
    const libraryMember = await LibraryMember.findOne({ collegeId: instance.collegeId, personId });
    if (libraryMember) {
      libraryMember.isActive = false;
      await libraryMember.save();
      libraryDeactivated = true;
    }
  }

  if (cancellation) {
    await updateCancellationReversal(cancellation, 'M08', 'completed');
  }

  return {
    result: {
      ...result,
      studentId: String(admission.studentId),
      hostelReleased,
      transportCancelled,
      libraryDeactivated,
    },
  };
});

registerWorkflowStepHandler('W01', 'cancel_m12', async ({ instance, result }) => {
  const cancellation = await ensureCancellationLinked(instance);
  const personId = getIdString(instance.metadata?.personId);
  if (!personId) return;

  const user = await User.findOne({ collegeId: instance.collegeId, personId });
  if (user) {
    user.isActive = false;
    await user.save();
  }

  if (cancellation) {
    await updateCancellationReversal(cancellation, 'M12', 'completed');
  }

  return {
    result: {
      ...result,
      userId: user ? String(user._id) : undefined,
      accountStatus: user ? 'deactivated' : undefined,
    },
  };
});

registerWorkflowStepHandler('W01', 'cancel_juvi', async ({ instance, result }) => {
  const cancellation = await ensureCancellationLinked(instance);
  const personId = getIdString(instance.metadata?.personId);
  if (!personId) return;

  const conversations = await JuviConversation.find({
    collegeId: instance.collegeId,
    userId: personId,
    status: { $in: ['active', 'closed'] },
  });
  for (const conversation of conversations) {
    conversation.status = 'archived';
    await conversation.save();
  }

  if (cancellation) {
    await updateCancellationReversal(cancellation, 'Juvi', 'completed');
  }

  return {
    result: {
      ...result,
      juviConversationCount: conversations.length,
      juviStatus: conversations.length > 0 ? 'archived' : 'skipped',
    },
  };
});

async function ensureInquiryLinked(instance: WorkflowStepHandlerContext['instance']): Promise<string | undefined> {
  const inquiryId = getIdString(instance.metadata?.inquiryId) || (instance.entityType === 'Inquiry' ? getIdString(instance.entityId) : undefined);
  if (!inquiryId) return undefined;

  await Inquiry.findByIdAndUpdate(inquiryId, { $set: { workflowInstanceId: instance._id } });
  if (getIdString(instance.metadata?.inquiryId) !== inquiryId) {
    await saveInstanceMetadata(instance, { inquiryId });
  }
  return inquiryId;
}

async function ensureApplicantLinked(instance: WorkflowStepHandlerContext['instance']): Promise<string | undefined> {
  const applicantId = getIdString(instance.metadata?.applicantId) || (instance.entityType === 'Applicant' ? getIdString(instance.entityId) : undefined);
  if (!applicantId) return undefined;

  await Applicant.findByIdAndUpdate(applicantId, { $set: { workflowInstanceId: instance._id } });
  if (getIdString(instance.metadata?.applicantId) !== applicantId) {
    await saveInstanceMetadata(instance, { applicantId });
  }
  return applicantId;
}

async function ensureAdmissionLinked(instance: WorkflowStepHandlerContext['instance']) {
  const admissionId = getIdString(instance.metadata?.admissionId);
  if (admissionId) {
    return Admission.findOne({ _id: admissionId, collegeId: instance.collegeId });
  }

  const applicantId = getIdString(instance.metadata?.applicantId) || (instance.entityType === 'Applicant' ? getIdString(instance.entityId) : undefined);
  if (!applicantId) return null;

  const admission = await Admission.findOne({ collegeId: instance.collegeId, applicantId });
  if (admission) {
    await saveInstanceMetadata(instance, { admissionId: String(admission._id) });
  }
  return admission;
}

async function ensureCancellationLinked(instance: WorkflowStepHandlerContext['instance']) {
  const cancellationId = getIdString(instance.metadata?.cancellationId);
  if (cancellationId) {
    return AdmissionCancellation.findOne({ _id: cancellationId, collegeId: instance.collegeId });
  }

  const applicantId = getIdString(instance.metadata?.applicantId) || (instance.entityType === 'Applicant' ? getIdString(instance.entityId) : undefined);
  if (!applicantId) return null;

  const cancellation = await AdmissionCancellation.findOne({ collegeId: instance.collegeId, applicantId }).sort({ createdAt: -1 });
  if (cancellation) {
    await saveInstanceMetadata(instance, { cancellationId: String(cancellation._id) });
  }
  return cancellation;
}

async function saveInstanceEntity(
  instance: WorkflowStepHandlerContext['instance'],
  entityType: string,
  entityId: string,
  metadataPatch: Record<string, any>,
): Promise<void> {
  instance.entityType = entityType;
  instance.entityId = new mongoose.Types.ObjectId(entityId) as any;
  instance.metadata = { ...(instance.metadata || {}), ...metadataPatch };
  await instance.save();
}

async function saveInstanceMetadata(
  instance: WorkflowStepHandlerContext['instance'],
  metadataPatch: Record<string, any>,
): Promise<void> {
  instance.metadata = { ...(instance.metadata || {}), ...metadataPatch };
  await instance.save();
}

async function getApplicantContext(instance: WorkflowStepHandlerContext['instance']) {
  const applicantId = await ensureApplicantLinked(instance);
  if (!applicantId) return null;
  return Applicant.findOne({ _id: applicantId, collegeId: instance.collegeId });
}

async function getProvisioningContext(
  instance: WorkflowStepHandlerContext['instance'],
  applicant: any,
  admission: any,
) {
  const academicYearId = getIdString(admission.academicYearId) || getIdString(instance.metadata?.academicYearId) || getIdString(applicant.academicYearId);
  const programmeId = getIdString(instance.metadata?.programmeId);
  const branchId = getIdString(instance.metadata?.branchId);
  const batchId = getIdString(instance.metadata?.batchId);
  const regulationId = getIdString(instance.metadata?.regulationId);

  const academicYear = academicYearId
    ? await AcademicYear.findOne({ _id: academicYearId, collegeId: instance.collegeId })
    : await AcademicYear.findOne({ collegeId: instance.collegeId, isCurrent: true });
  const programme = programmeId ? await Programme.findOne({ _id: programmeId, collegeId: instance.collegeId }) : null;
  const branch = branchId ? await Branch.findOne({ _id: branchId, collegeId: instance.collegeId }) : null;
  const regulation = regulationId
    ? await Regulation.findOne({ _id: regulationId, collegeId: instance.collegeId })
    : programme?.regulationId
      ? await Regulation.findOne({ _id: programme.regulationId, collegeId: instance.collegeId })
      : null;

  const admissionYear = academicYear?.startDate?.getFullYear()
    || admission.admissionDate?.getFullYear()
    || new Date().getFullYear();

  let batch = batchId ? await Batch.findOne({ _id: batchId, collegeId: instance.collegeId }) : null;
  if (!batch && programme && regulation) {
    batch = await Batch.findOne({
      collegeId: instance.collegeId,
      programmeId: programme._id,
      admissionYear,
    });
  }
  if (!batch && programme && regulation) {
    const batchCode = `${programme.code}-${admissionYear}`;
    batch = await Batch.create({
      collegeId: instance.collegeId,
      code: batchCode,
      name: `${programme.name} ${admissionYear}`,
      admissionYear,
      programmeId: programme._id,
      regulationId: regulation._id,
      isActive: true,
    });
  }

  return {
    academicYearId: academicYear ? String(academicYear._id) : academicYearId,
    programmeId,
    branchId,
    academicYear,
    programme,
    branch,
    regulation,
    batch,
    admissionYear,
  };
}

async function findProvisionedPerson(instance: WorkflowStepHandlerContext['instance'], applicant: any, admission: any) {
  const personId = getIdString(instance.metadata?.personId);
  if (personId) {
    const person = await Person.findOne({ _id: personId, collegeId: instance.collegeId });
    if (person) return person;
  }

  if (admission.studentId) {
    const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
    if (student?.personId) {
      const person = await Person.findOne({ _id: student.personId, collegeId: instance.collegeId });
      if (person) return person;
    }
  }

  const personFilters: Record<string, string>[] = [];
  if (applicant.phone) personFilters.push({ phone: applicant.phone });
  if (applicant.email) personFilters.push({ email: applicant.email });
  if (applicant.aadharNumber) personFilters.push({ aadhaar: applicant.aadharNumber });

  if (personFilters.length === 0) return null;
  return Person.findOne({
    collegeId: instance.collegeId,
    $or: personFilters,
  });
}

async function findProvisionedStudent(instance: WorkflowStepHandlerContext['instance'], admission: any, person: any) {
  if (admission.studentId) {
    const student = await Student.findOne({ _id: admission.studentId, collegeId: instance.collegeId });
    if (student) return student;
  }
  return Student.findOne({ collegeId: instance.collegeId, personId: person._id });
}

function buildEnrollmentNumber(applicant: any) {
  return `ENR-${String(applicant.applicationNumber || applicant._id).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
}

function buildRollNumber(branchCode: unknown, applicant: any, admissionYear: number) {
  const serial = String(applicant.applicationNumber || applicant._id).replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();
  const code = typeof branchCode === 'string' && branchCode.length > 0 ? branchCode.toUpperCase() : 'GEN';
  return `${code}-${String(admissionYear).slice(-2)}-${serial}`;
}

function normalizeStudentQuota(value: unknown): 'convener' | 'management' | 'nri' | undefined {
  if (value === 'convener' || value === 'management' || value === 'nri') return value;
  return undefined;
}

function getEntryPoint(admissionType?: string) {
  if (admissionType === 'lateral') {
    return { studyYear: 2, semesterNumber: 3 };
  }
  return { studyYear: 1, semesterNumber: 1 };
}

async function resolveProvisioningSemester(
  instance: WorkflowStepHandlerContext['instance'],
  academicYearId: mongoose.Types.ObjectId | string | undefined,
  semesterNumber: number,
) {
  if (academicYearId) {
    const semester = await Semester.findOne({
      collegeId: instance.collegeId,
      academicYearId,
      number: semesterNumber,
    });
    if (semester) return semester;
  }

  return Semester.findOne({
    collegeId: instance.collegeId,
    number: semesterNumber,
  }).sort({ status: -1, startDate: 1 });
}

async function resolveProvisioningSection(
  instance: WorkflowStepHandlerContext['instance'],
  branchId: mongoose.Types.ObjectId | string | undefined,
  batchId: mongoose.Types.ObjectId | string | undefined,
  studyYear: number,
  semesterNumber: number,
  completedBy: string,
) {
  const existingSectionId = getIdString(instance.metadata?.sectionId);
  if (existingSectionId) {
    const existingSection = await Section.findOne({ _id: existingSectionId, collegeId: instance.collegeId });
    if (existingSection) return existingSection;
  }

  if (!branchId || !batchId) return null;

  let section = await Section.findOne({
    collegeId: instance.collegeId,
    branchId,
    batchId,
    year: studyYear,
    semester: semesterNumber,
  }).sort({ name: 1 });

  if (!section) {
    const branch = await Branch.findOne({ _id: branchId, collegeId: instance.collegeId });
    section = await Section.create({
      collegeId: instance.collegeId,
      name: 'A',
      branchId,
      batchId,
      year: studyYear,
      semester: semesterNumber,
      capacity: branch?.intake || 60,
    });
    await createAuditLog({
      collegeId: String(instance.collegeId),
      entityType: 'Section',
      entityId: String(section._id),
      entityName: section.name,
      action: 'create',
      changes: [],
      performedBy: completedBy,
    });
  }

  return section;
}

async function resolveProvisioningFaculty(
  instance: WorkflowStepHandlerContext['instance'],
  departmentId?: string,
) {
  const departmentFaculty = departmentId
    ? await Faculty.findOne({ collegeId: instance.collegeId, departmentId, status: 'active' }).sort({ createdAt: 1 })
    : null;
  if (departmentFaculty) return departmentFaculty;
  return Faculty.findOne({ collegeId: instance.collegeId, status: 'active' }).sort({ createdAt: 1 });
}

async function resolveFeeStructure(
  instance: WorkflowStepHandlerContext['instance'],
  input: {
    academicYearId?: string;
    programmeId?: string;
    branchId?: string;
    quota?: string;
    category?: string;
    year: number;
  },
) {
  if (!input.academicYearId || !input.programmeId) return null;

  const candidates = await FeeStructure.find({
    collegeId: instance.collegeId,
    academicYearId: input.academicYearId,
    programmeId: input.programmeId,
    year: input.year,
    ...(input.branchId ? { branchId: input.branchId } : {}),
  }).sort({ createdAt: -1 });

  if (candidates.length === 0) return null;

  return candidates.find((item) => {
    if (input.branchId && getIdString(item.branchId) && getIdString(item.branchId) !== input.branchId) return false;
    if (input.category && item.category && item.category !== input.category) return false;
    if (input.quota && item.quota && item.quota !== input.quota) return false;
    return true;
  }) || candidates[0];
}

async function updateCancellationReversal(
  cancellation: any,
  module: 'M02' | 'M04' | 'M08' | 'M12' | 'Juvi',
  status: 'completed' | 'failed',
  error?: string,
) {
  const existing = Array.isArray(cancellation.reversals) ? [...cancellation.reversals] : [];
  const currentIndex = existing.findIndex((item) => item.module === module);
  const nextValue = {
    module,
    action: getCancellationAction(module),
    status,
    completedAt: status === 'completed' ? new Date() : undefined,
    error,
  };

  if (currentIndex >= 0) {
    existing[currentIndex] = { ...existing[currentIndex], ...nextValue };
  } else {
    existing.push(nextValue);
  }

  cancellation.reversals = existing;
  if (existing.every((item) => item.status === 'completed')) {
    cancellation.status = 'completed';
    cancellation.completedAt = new Date();
  } else {
    cancellation.status = 'in_progress';
  }
  await cancellation.save();
}

function getCancellationAction(module: 'M02' | 'M04' | 'M08' | 'M12' | 'Juvi') {
  switch (module) {
    case 'M02':
      return 'Deactivate student record';
    case 'M04':
      return 'Process refund';
    case 'M08':
      return 'De-allocate hostel/transport';
    case 'M12':
      return 'Deactivate user account';
    case 'Juvi':
      return 'Deactivate Juvi account';
    default:
      return 'Workflow reversal';
  }
}

async function releaseSeatAndPromoteWaitlist(
  instance: WorkflowStepHandlerContext['instance'],
  cancellation: any,
) {
  const seatInventoryId = getIdString(instance.metadata?.seatInventoryId);
  const quota = normalizeQuota(instance.metadata?.quota);
  let seatReleased = false;
  let waitlistPromotionTriggered = false;

  if (seatInventoryId) {
    const inventory = await SeatInventory.findOne({ _id: seatInventoryId, collegeId: instance.collegeId });
    if (inventory) {
      switch (quota) {
        case 'convener':
          if ((inventory.convenerFilled || 0) > 0) {
            inventory.convenerFilled -= 1;
            seatReleased = true;
          }
          break;
        case 'nri':
          if ((inventory.nriFilled || 0) > 0) {
            inventory.nriFilled -= 1;
            seatReleased = true;
          }
          break;
        case 'spot':
          if ((inventory.spotFilled || 0) > 0) {
            inventory.spotFilled -= 1;
            seatReleased = true;
          }
          break;
        case 'management':
        default:
          if ((inventory.managementFilled || 0) > 0) {
            inventory.managementFilled -= 1;
            seatReleased = true;
          }
          break;
      }
      if (seatReleased) {
        await inventory.save();
      }
    }
  }

  const academicYearId = getIdString(instance.metadata?.academicYearId);
  const programmeId = getIdString(instance.metadata?.programmeId);
  const branchId = getIdString(instance.metadata?.branchId);
  if (academicYearId && programmeId && branchId) {
    const waitlistEntry = await Waitlist.findOne({
      collegeId: instance.collegeId,
      academicYearId,
      programmeId,
      branchId,
      quota,
      status: 'waiting',
    }).sort({ waitlistPosition: 1, createdAt: 1 });

    if (waitlistEntry) {
      waitlistEntry.status = 'promoted';
      waitlistEntry.promotedAt = new Date();
      await waitlistEntry.save();
      waitlistPromotionTriggered = true;
    }
  }

  cancellation.seatReleased = seatReleased;
  cancellation.waitlistPromotionTriggered = waitlistPromotionTriggered;
  await cancellation.save();

  return { seatReleased, waitlistPromotionTriggered };
}

async function syncSeatInventoryAllotment(
  instance: WorkflowStepHandlerContext['instance'],
  seatInventoryId: string,
  quota: string,
  previousStatus?: string,
  nextStatus?: string,
) {
  if (previousStatus === nextStatus) return;

  const inventory = await SeatInventory.findOne({ _id: seatInventoryId, collegeId: instance.collegeId });
  if (!inventory) return;

  const field = getSeatFilledField(quota);
  const current = Number((inventory as any)[field] || 0);

  if (previousStatus === 'allotted' && nextStatus !== 'allotted') {
    (inventory as any)[field] = Math.max(current - 1, 0);
    await inventory.save();
    return;
  }

  if (previousStatus !== 'allotted' && nextStatus === 'allotted') {
    (inventory as any)[field] = current + 1;
    await inventory.save();
  }
}

function getSeatFilledField(quota: string) {
  switch (quota) {
    case 'convener':
      return 'convenerFilled';
    case 'nri':
      return 'nriFilled';
    case 'spot':
      return 'spotFilled';
    case 'management':
    default:
      return 'managementFilled';
  }
}

async function resolveHostelRoom(
  instance: WorkflowStepHandlerContext['instance'],
  gender?: string,
) {
  const blockType = gender === 'female' ? 'girls' : gender === 'male' ? 'boys' : undefined;
  const activeBlocks = await HostelBlock.find({
    collegeId: instance.collegeId,
    isActive: true,
    ...(blockType ? { type: blockType } : {}),
  }).sort({ name: 1 });

  const blockIds = activeBlocks.map((item) => item._id);
  if (blockIds.length === 0) return null;

  return HostelRoom.findOne({
    collegeId: instance.collegeId,
    blockId: { $in: blockIds },
    status: 'available',
    $expr: { $lt: ['$occupancy', '$capacity'] },
  }).sort({ occupancy: 1, roomNumber: 1 });
}

async function resolveTransportRoute(
  instance: WorkflowStepHandlerContext['instance'],
  applicant: any,
  academicYearId: string,
  preferredStopName?: string,
) {
  const routes = await TransportRoute.find({
    collegeId: instance.collegeId,
    isActive: true,
  }).sort({ routeNumber: 1 });

  for (const route of routes) {
    const activeAllocations = await TransportAllocation.countDocuments({
      collegeId: instance.collegeId,
      routeId: route._id,
      academicYearId,
      status: 'active',
    });
    if (activeAllocations >= (route.capacity || 0)) continue;

    if (preferredStopName && route.stops.some((stop) => sameText(stop.name, preferredStopName))) {
      return route;
    }

    const locationHints = [applicant.city, applicant.district, applicant.state]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (locationHints.some((hint) => route.name.toLowerCase().includes(hint.toLowerCase()) || route.stops.some((stop) => stop.name.toLowerCase().includes(hint.toLowerCase())))) {
      return route;
    }
  }

  for (const route of routes) {
    const activeAllocations = await TransportAllocation.countDocuments({
      collegeId: instance.collegeId,
      routeId: route._id,
      academicYearId,
      status: 'active',
    });
    if (activeAllocations < (route.capacity || 0)) return route;
  }

  return null;
}

function pickTransportStopName(route: any, preferredStopName?: string) {
  if (preferredStopName) {
    const preferredStop = route.stops?.find((stop: any) => sameText(stop.name, preferredStopName));
    if (preferredStop?.name) return preferredStop.name;
  }

  const fallbackStop = route.stops?.find((stop: any) => !sameText(stop.name, 'Juvion Campus'))
    || route.stops?.[0];
  return fallbackStop?.name;
}

async function generateLibraryMembershipId(instance: WorkflowStepHandlerContext['instance']) {
  const prefix = 'LIB-STU-';
  const latest = await LibraryMember.findOne({
    collegeId: instance.collegeId,
    membershipId: { $regex: `^${prefix}` },
  }).sort({ membershipId: -1 });

  const next = latest
    ? Number(String(latest.membershipId).slice(prefix.length)) + 1
    : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function buildJuviWelcomeMessage(
  studentName: string,
  personaDisplayName?: string,
  options?: { hasHostel?: boolean; hasTransport?: boolean; hasLibrary?: boolean },
) {
  const lines = [
    `Welcome ${studentName} to Juvion.`,
    `${personaDisplayName || 'Juvi Student Assistant'} is ready to help with academics, fees, campus services, and onboarding.`,
  ];

  if (options?.hasLibrary) {
    lines.push('Your library access has been activated.');
  }
  if (options?.hasHostel) {
    lines.push('Your hostel allocation is available in the campus services section.');
  }
  if (options?.hasTransport) {
    lines.push('Your transport route assignment is ready in the campus services section.');
  }

  lines.push('You can start by asking about your fee invoice, section, timetable, or campus facilities.');
  return lines.join(' ');
}

function sameText(left?: string, right?: string) {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function normalizeLeadInteractionType(value: unknown) {
  if (value === 'phone_call' || value === 'whatsapp' || value === 'sms' || value === 'email' || value === 'walk_in' || value === 'campus_visit' || value === 'ai_conversation') {
    return value;
  }
  return 'whatsapp';
}

function normalizeLeadInteractionOutcome(value: unknown) {
  if (value === 'interested' || value === 'callback_requested' || value === 'not_interested' || value === 'no_response' || value === 'visit_scheduled' || value === 'converted') {
    return value;
  }
  return 'interested';
}

async function generateInvoiceNumber(instance: WorkflowStepHandlerContext['instance']) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await Invoice.findOne({
    collegeId: instance.collegeId,
    invoiceNumber: { $regex: `^${prefix}` },
  }).sort({ createdAt: -1 });

  const next = latest
    ? Number(String(latest.invoiceNumber).slice(prefix.length)) + 1
    : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function buildStudentEmail(applicant: any) {
  const slug = String(applicant.applicationNumber || applicant._id)
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
  return `${slug}@student.juvion.local`;
}

async function updateProvisioningStatus(
  instance: WorkflowStepHandlerContext['instance'],
  patch: Record<string, 'pending' | 'completed' | 'failed' | 'skipped'>,
  result: Record<string, any>,
): Promise<void> {
  const admission = await ensureAdmissionLinked(instance);
  if (!admission) return;

  const current = admission.provisioning || buildDefaultProvisioning();
  admission.provisioning = { ...current, ...patch };
  admission.provisioningStatus = 'in_progress';
  if (getIdString(result.studentId)) {
    admission.studentId = new mongoose.Types.ObjectId(String(result.studentId)) as any;
  }
  await admission.save();
}

function deriveLeadGrade(leadScore?: number): string | undefined {
  if (leadScore === undefined) return undefined;
  if (leadScore >= 80) return 'hot';
  if (leadScore >= 50) return 'warm';
  return 'cold';
}

function deriveChecklistStatus(documents: any[]): 'pending' | 'partial' | 'complete' | 'verified' {
  const uploadedRequired = documents.filter((doc) => doc.required).filter((doc) => doc.uploaded);
  const verifiedRequired = documents.filter((doc) => doc.required).filter((doc) => doc.verified);
  const requiredCount = documents.filter((doc) => doc.required).length;

  if (requiredCount > 0 && verifiedRequired.length === requiredCount) return 'verified';
  if (requiredCount > 0 && uploadedRequired.length === requiredCount) return 'complete';
  if (uploadedRequired.length > 0) return 'partial';
  return 'pending';
}

function deriveEligibilityStatus(result: Record<string, any>): string {
  if (typeof result.eligibilityStatus === 'string') return result.eligibilityStatus;
  if (result.isEdgeCase === true) return 'edge_case';
  if (result.isEligible === true) return 'eligible';
  if (result.isEligible === false) return 'ineligible';
  if (result.conditionalEligibility === true) return 'conditional';
  return 'pending';
}

function normalizeQuota(value: unknown): 'convener' | 'management' | 'nri' | 'spot' {
  const quota = typeof value === 'string' ? value : 'management';
  if (quota === 'convener' || quota === 'management' || quota === 'nri' || quota === 'spot') return quota;
  return 'management';
}

function getAvailableSeatsForQuota(
  inventory: any,
  quota: 'convener' | 'management' | 'nri' | 'spot',
  admissionType?: string,
): number {
  if (admissionType === 'lateral') {
    return Math.max((inventory.lateralEntrySeats || 0) - (inventory.lateralFilled || 0), 0);
  }

  switch (quota) {
    case 'convener':
      return Math.max((inventory.convenerSeats || 0) - (inventory.convenerFilled || 0), 0);
    case 'nri':
      return Math.max((inventory.nriSeats || 0) - (inventory.nriFilled || 0), 0);
    case 'spot':
      return Math.max((inventory.spotSeats || 0) - (inventory.spotFilled || 0), 0);
    case 'management':
    default:
      return Math.max((inventory.managementSeats || 0) - (inventory.managementFilled || 0), 0);
  }
}

function buildDefaultProvisioning() {
  return {
    m02_person: 'pending',
    m02_student: 'pending',
    m03_section: 'pending',
    m03_courses: 'pending',
    m04_invoice: 'pending',
    m08_hostel: 'pending',
    m08_transport: 'pending',
    m08_library: 'pending',
    m12_account: 'pending',
    juvi_account: 'pending',
  } as const;
}

function mapApplicantStatusFromEligibility(eligibilityStatus: string): string {
  switch (eligibilityStatus) {
    case 'eligible':
    case 'conditional':
      return 'eligible';
    case 'ineligible':
      return 'ineligible';
    case 'edge_case':
      return 'under_review';
    default:
      return 'under_review';
  }
}

function normalizeDocument(document: any) {
  return {
    name: typeof document.name === 'string' ? document.name : 'Document',
    type: typeof document.type === 'string' ? document.type : 'other',
    required: document.required !== false,
    uploaded: document.uploaded === true,
    verified: document.verified === true,
    verifiedBy: typeof document.verifiedBy === 'string' ? document.verifiedBy : undefined,
    verificationDate: parseOptionalDate(document.verificationDate),
    fileUrl: typeof document.fileUrl === 'string' ? document.fileUrl : undefined,
    ocrConfidence: typeof document.ocrConfidence === 'number' ? document.ocrConfidence : undefined,
    ocrExtractedData: typeof document.ocrExtractedData === 'object' ? document.ocrExtractedData : undefined,
    ocrStatus: typeof document.ocrStatus === 'string' ? document.ocrStatus : undefined,
  };
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function compactMetadata(metadata: Record<string, any>) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function getIdString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value === 'object' && value !== null && '_id' in (value as Record<string, unknown>)) {
    return getIdString((value as Record<string, unknown>)._id);
  }
  return String(value);
}
