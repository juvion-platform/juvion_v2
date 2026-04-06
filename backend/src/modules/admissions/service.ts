import mongoose from 'mongoose';
import { Inquiry } from '../../models/admissions/Inquiry';
import { Applicant } from '../../models/admissions/Applicant';
import { EntranceExamScore } from '../../models/admissions/EntranceExamScore';
import { CounselingAllotment } from '../../models/admissions/CounselingAllotment';
import { AdmissionOffer } from '../../models/admissions/AdmissionOffer';
import { DocumentChecklist } from '../../models/admissions/DocumentChecklist';
import { Admission } from '../../models/admissions/Admission';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

const toOid = (id: string) => new mongoose.Types.ObjectId(id);

// ─── Inquiries ───────────────────────────────────────────────

export async function listInquiries(collegeId: string, page: number, limit: number, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
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

export async function listApplicants(collegeId: string, page: number, limit: number, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
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

export async function listExamScores(collegeId: string, page: number, limit: number, applicantId?: string) {
  const filter: any = { collegeId };
  if (applicantId) filter.applicantId = applicantId;
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

export async function listCounselingAllotments(collegeId: string, page: number, limit: number, applicantId?: string) {
  const filter: any = { collegeId };
  if (applicantId) filter.applicantId = applicantId;
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

export async function listOffers(collegeId: string, page: number, limit: number, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
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

export async function listDocumentChecklists(collegeId: string, page: number, limit: number, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
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

export async function listAdmissions(collegeId: string, page: number, limit: number) {
  return paginate(Admission, { collegeId }, page, limit, { admissionDate: -1 }, ['applicantId', 'studentId']);
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

// ─── Dashboard Stats ─────────────────────────────────────────

export async function getDashboardStats(collegeId: string) {
  const [inquiries, applicants, offers, admissions] = await Promise.all([
    Inquiry.countDocuments({ collegeId }),
    Applicant.countDocuments({ collegeId }),
    AdmissionOffer.countDocuments({ collegeId }),
    Admission.countDocuments({ collegeId }),
  ]);

  const oid = toOid(collegeId);
  const inquiryByStatus = await Inquiry.aggregate([
    { $match: { collegeId: oid } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const applicantByStatus = await Applicant.aggregate([
    { $match: { collegeId: oid } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  // Count offers from Applicant model's offerStatus
  const offeredApplicants = await Applicant.countDocuments({ collegeId, status: { $in: ['offered', 'accepted'] } });

  // Count enrolled from Applicant model
  const enrolledApplicants = await Applicant.countDocuments({ collegeId, status: 'enrolled' });

  return {
    totals: {
      inquiries,
      applicants,
      offers: offers || offeredApplicants,
      admissions: admissions || enrolledApplicants,
    },
    inquiryByStatus: Object.fromEntries(inquiryByStatus.map(r => [r._id, r.count])),
    applicantByStatus: Object.fromEntries(applicantByStatus.map(r => [r._id, r.count])),
  };
}
