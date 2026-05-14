import mongoose from 'mongoose';
import { Inquiry } from '../../models/admissions/Inquiry';
import { Applicant } from '../../models/admissions/Applicant';
import { EntranceExamScore } from '../../models/admissions/EntranceExamScore';
import { CounselingAllotment } from '../../models/admissions/CounselingAllotment';
import { AdmissionOffer } from '../../models/admissions/AdmissionOffer';
import { DocumentChecklist } from '../../models/admissions/DocumentChecklist';
import { Admission } from '../../models/admissions/Admission';
import { AssignmentRule, IAssignmentRule, IAssignmentRuleCondition } from '../../models/admissions/AssignmentRule';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

// ─── Dashboard Stats ─────────────────────────────────
export async function getDashboardStats(collegeId: string) {
  const [inquiries, applicants, submittedApplicants, offers, acceptedOffers, admissions, examScores, counseling, inquiryByStatusAgg, applicantByStatusAgg] = await Promise.all([
    Inquiry.countDocuments({ collegeId }),
    Applicant.countDocuments({ collegeId }),
    Applicant.countDocuments({ collegeId, status: 'submitted' }),
    AdmissionOffer.countDocuments({ collegeId }),
    AdmissionOffer.countDocuments({ collegeId, status: 'accepted' }),
    Admission.countDocuments({ collegeId }),
    EntranceExamScore.countDocuments({ collegeId }),
    CounselingAllotment.countDocuments({ collegeId }),
    Inquiry.aggregate([{ $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Applicant.aggregate([{ $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const inquiryByStatus: Record<string, number> = {};
  for (const r of inquiryByStatusAgg) inquiryByStatus[r._id] = r.count;

  const applicantByStatus: Record<string, number> = {};
  for (const r of applicantByStatusAgg) applicantByStatus[r._id] = r.count;

  return {
    // Flat fields for dashboard page
    inquiries, applicants, submittedApplicants, offers, acceptedOffers, admissions, examScores, counseling,
    // Structured fields for admissions hub page
    totals: { inquiries, applicants, offers, admissions },
    inquiryByStatus,
    applicantByStatus,
  };
}

// ─── Inquiries ───────────────────────────────────────────────

export async function listInquiries(collegeId: string, page: number, limit: number, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Inquiry, filter, page, limit, { createdAt: -1 });
}

export async function getInquiry(collegeId: string, id: string) {
  const doc = await Inquiry.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Inquiry not found');
  return doc;
}

export async function createInquiry(collegeId: string, data: any, performedBy: string) {
  const doc = await Inquiry.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Inquiry', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateInquiry(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Inquiry.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Inquiry not found');
  await createAuditLog({ collegeId, entityType: 'Inquiry', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteInquiry(collegeId: string, id: string, performedBy: string) {
  const doc = await Inquiry.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Inquiry not found');
  await createAuditLog({ collegeId, entityType: 'Inquiry', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Convert Inquiry → Applicant ─────────────────────────────

export async function convertInquiryToApplicant(collegeId: string, inquiryId: string, extraData: any, performedBy: string) {
  const inquiry = await Inquiry.findOne({ _id: inquiryId, collegeId });
  if (!inquiry) throw new AppError(404, 'Inquiry not found');
  if (inquiry.status === 'converted') throw new AppError(400, 'Inquiry already converted');

  // Generate application number: APP-YYYY-XXXX
  const year = new Date().getFullYear();
  const count = await Applicant.countDocuments({ collegeId }) + 1;
  const applicationNumber = `APP-${year}-${String(count).padStart(4, '0')}`;

  const applicantData = {
    collegeId,
    inquiryId: inquiry._id,
    applicationNumber,
    // Carry forward personal info
    name: inquiry.name,
    fatherName: inquiry.fatherName,
    phone: inquiry.phone,
    altPhone: inquiry.altPhone,
    email: inquiry.email,
    gender: inquiry.gender,
    dateOfBirth: inquiry.dateOfBirth,
    // Carry forward address
    city: inquiry.city,
    state: inquiry.state,
    district: inquiry.district,
    pincode: inquiry.pincode,
    // Carry forward academic
    tenthPercentage: inquiry.tenthPercentage,
    interPercentage: inquiry.interPercentage,
    interStream: inquiry.interStream,
    // Programme from inquiry interest + override
    programmeApplied: extraData.programmeApplied || inquiry.programmeInterest,
    branchPreference1: extraData.branchPreference1 || inquiry.branchInterest,
    quota: extraData.quota || 'management',
    category: extraData.category,
    status: 'submitted',

    // ─── Strategic Gap 5 — carry CRM data forward ────────────────
    // UTM attribution stays with the funnel from prospect → admission
    // so ROI reporting works end-to-end.
    utmSource: inquiry.utmSource,
    utmMedium: inquiry.utmMedium,
    utmCampaign: inquiry.utmCampaign,
    utmTerm: inquiry.utmTerm,
    utmContent: inquiry.utmContent,
    // Verification flags inherit; payment-verification stays false
    // since fee hasn't been received yet at convert time.
    emailVerified: inquiry.emailVerified,
    mobileVerified: inquiry.mobileVerified,
    // Officer hierarchy inherits — same officer keeps the prospect
    // they qualified.
    assignedOfficerId: inquiry.assignedOfficerId,
    clusterHeadId: inquiry.clusterHeadId,
  };

  const applicant = await Applicant.create(applicantData);

  // Mark inquiry as converted
  inquiry.status = 'converted';
  inquiry.convertedToApplicantId = applicant._id as any;
  await inquiry.save();

  await createAuditLog({ collegeId, entityType: 'Inquiry', entityId: inquiryId, entityName: inquiry.name, action: 'update', changes: [{ field: 'status', displayName: 'Status', oldValue: inquiry.status, newValue: 'converted' }], performedBy });
  await createAuditLog({ collegeId, entityType: 'Applicant', entityId: String(applicant._id), entityName: applicationNumber, action: 'create', changes: [], performedBy });

  return applicant;
}

// ─── Applicants ──────────────────────────────────────────────

export async function listApplicants(collegeId: string, page: number, limit: number, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Applicant, filter, page, limit, { createdAt: -1 }, ['inquiryId']);
}

export async function getApplicant(collegeId: string, id: string) {
  const doc = await Applicant.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Applicant not found');
  return doc;
}

export async function createApplicant(collegeId: string, data: any, performedBy: string) {
  // Auto-generate application number if not provided
  if (!data.applicationNumber) {
    const year = new Date().getFullYear();
    const count = await Applicant.countDocuments({ collegeId }) + 1;
    data.applicationNumber = `APP-${year}-${String(count).padStart(4, '0')}`;
  }
  const doc = await Applicant.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Applicant', entityId: String(doc._id), entityName: data.applicationNumber, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateApplicant(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Applicant.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Applicant not found');
  await createAuditLog({ collegeId, entityType: 'Applicant', entityId: id, entityName: doc.applicationNumber, action: 'update', changes: [], performedBy });
  return doc;
}

// ─── Entrance Exam Scores ────────────────────────────────────

export async function listExamScores(collegeId: string, page: number, limit: number, applicantId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (applicantId) filter.applicantId = applicantId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(EntranceExamScore, filter, page, limit, { createdAt: -1 }, ['applicantId']);
}

export async function createExamScore(collegeId: string, data: any, performedBy: string) {
  const doc = await EntranceExamScore.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EntranceExamScore', entityId: String(doc._id), entityName: `${data.examType}-${data.year}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateExamScore(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await EntranceExamScore.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Exam score not found');
  await createAuditLog({ collegeId, entityType: 'EntranceExamScore', entityId: id, entityName: `${doc.examType}`, action: 'update', changes: [], performedBy });
  return doc;
}

// ─── Counseling Allotments ───────────────────────────────────

export async function listCounselingAllotments(collegeId: string, page: number, limit: number, applicantId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (applicantId) filter.applicantId = applicantId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(CounselingAllotment, filter, page, limit, { createdAt: -1 }, ['applicantId']);
}

export async function createCounselingAllotment(collegeId: string, data: any, performedBy: string) {
  const doc = await CounselingAllotment.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CounselingAllotment', entityId: String(doc._id), entityName: `Round-${data.round}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateCounselingAllotment(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await CounselingAllotment.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Counseling allotment not found');
  await createAuditLog({ collegeId, entityType: 'CounselingAllotment', entityId: id, entityName: `Round-${doc.round}`, action: 'update', changes: [], performedBy });
  return doc;
}

// ─── Admission Offers ────────────────────────────────────────

export async function listOffers(collegeId: string, page: number, limit: number, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AdmissionOffer, filter, page, limit, { createdAt: -1 }, ['applicantId']);
}

export async function createOffer(collegeId: string, data: any, performedBy: string) {
  const doc = await AdmissionOffer.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AdmissionOffer', entityId: String(doc._id), entityName: `Offer`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateOffer(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await AdmissionOffer.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Offer not found');
  await createAuditLog({ collegeId, entityType: 'AdmissionOffer', entityId: id, entityName: `Offer`, action: 'update', changes: [], performedBy });
  return doc;
}

// ─── Document Checklists ─────────────────────────────────────

export async function listDocumentChecklists(collegeId: string, page: number, limit: number, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(DocumentChecklist, filter, page, limit, { createdAt: -1 }, ['applicantId']);
}

export async function getDocumentChecklist(collegeId: string, applicantId: string) {
  const doc = await DocumentChecklist.findOne({ applicantId, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Document checklist not found');
  return doc;
}

export async function upsertDocumentChecklist(collegeId: string, applicantId: string, data: any, performedBy: string) {
  const doc = await DocumentChecklist.findOneAndUpdate(
    { applicantId, collegeId },
    { $set: { ...data, collegeId, applicantId } },
    { new: true, upsert: true },
  );
  await createAuditLog({ collegeId, entityType: 'DocumentChecklist', entityId: String(doc._id), entityName: 'Documents', action: 'update', changes: [], performedBy });
  return doc;
}

// ─── Admissions (Final Enrollment) ───────────────────────────

export async function listAdmissions(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Admission, filter, page, limit, { admissionDate: -1 }, ['applicantId', 'studentId']);
}

export async function getAdmission(collegeId: string, id: string) {
  const doc = await Admission.findOne({ _id: id, collegeId }).populate('applicantId studentId').lean();
  if (!doc) throw new AppError(404, 'Admission not found');
  return doc;
}

export async function createAdmission(collegeId: string, data: any, performedBy: string) {
  const doc = await Admission.create({ ...data, collegeId });
  // Update applicant status to enrolled
  await Applicant.findByIdAndUpdate(data.applicantId, { status: 'enrolled' });
  await createAuditLog({ collegeId, entityType: 'Admission', entityId: String(doc._id), entityName: `Admission`, action: 'create', changes: [], performedBy });
  return doc;
}

// ─── Strategic Gap 5 — AssignmentRule CRUD + evaluator ───────────────

export async function listAssignmentRules(collegeId: string) {
  return AssignmentRule.find({ collegeId }).sort({ priority: 1, createdAt: 1 });
}

export async function getAssignmentRule(collegeId: string, id: string) {
  const doc = await AssignmentRule.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Assignment rule not found');
  return doc;
}

export async function createAssignmentRule(collegeId: string, data: any, performedBy: string) {
  const doc = await AssignmentRule.create({ ...data, collegeId, createdBy: performedBy, matchCount: 0 });
  await createAuditLog({ collegeId, entityType: 'AssignmentRule', entityId: String(doc._id), entityName: doc.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateAssignmentRule(collegeId: string, id: string, data: any, performedBy: string) {
  // Strip non-editable fields so a caller can't reset matchCount /
  // bypass tenant scoping via PATCH.
  delete data.collegeId;
  delete data.createdBy;
  delete data.matchCount;
  delete data.lastMatchedAt;
  const doc = await AssignmentRule.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Assignment rule not found');
  await createAuditLog({ collegeId, entityType: 'AssignmentRule', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteAssignmentRule(collegeId: string, id: string, performedBy: string) {
  const doc = await AssignmentRule.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Assignment rule not found');
  await createAuditLog({ collegeId, entityType: 'AssignmentRule', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

/**
 * Evaluate one rule's conditions against an inquiry-like input.
 * Returns true iff EVERY condition matches (logical AND across the
 * conditions array, same semantics as CampX's rule engine).
 */
function evaluateAssignmentRule(
  rule: IAssignmentRule,
  inquiry: Record<string, unknown>,
): boolean {
  for (const cond of rule.conditions) {
    const lhs = (inquiry as Record<string, unknown>)[cond.field];
    const op: IAssignmentRuleCondition['operator'] = cond.operator;
    const rhs = cond.value;
    switch (op) {
      case 'equals':
        if (lhs !== rhs) return false;
        break;
      case 'not_equals':
        if (lhs === rhs) return false;
        break;
      case 'in':
        if (!Array.isArray(rhs) || !rhs.includes(lhs as string)) return false;
        break;
      case 'gt':
        if (!(typeof lhs === 'number' && typeof rhs === 'number' && lhs > rhs)) return false;
        break;
      case 'gte':
        if (!(typeof lhs === 'number' && typeof rhs === 'number' && lhs >= rhs)) return false;
        break;
      case 'lt':
        if (!(typeof lhs === 'number' && typeof rhs === 'number' && lhs < rhs)) return false;
        break;
      case 'lte':
        if (!(typeof lhs === 'number' && typeof rhs === 'number' && lhs <= rhs)) return false;
        break;
      case 'contains':
        if (typeof lhs !== 'string' || typeof rhs !== 'string' || !lhs.toLowerCase().includes(rhs.toLowerCase())) return false;
        break;
    }
  }
  return true;
}

/**
 * Dry-run an inquiry payload against all enabled rules and return
 * the first match (in priority order). Used by the admin UI to
 * preview "if this inquiry came in, which rule would catch it?"
 * Does NOT mutate the inquiry — separate from the create-time
 * router hook (which is a Phase B concern; wiring it into
 * createInquiry needs a careful audit-log + transaction story).
 */
export async function previewAssignmentRule(
  collegeId: string,
  inquiry: Record<string, unknown>,
): Promise<{ rule: IAssignmentRule | null; matched: boolean }> {
  const rules = await AssignmentRule.find({ collegeId, enabled: true }).sort({ priority: 1, createdAt: 1 });
  for (const rule of rules) {
    if (evaluateAssignmentRule(rule, inquiry)) {
      return { rule, matched: true };
    }
  }
  return { rule: null, matched: false };
}

