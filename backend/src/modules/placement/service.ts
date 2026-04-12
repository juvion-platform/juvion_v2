import { PlacementSeason } from '../../models/placement/PlacementSeason';
import { Company } from '../../models/placement/Company';
import { JobPosting } from '../../models/placement/JobPosting';
import { PlacementRegistration } from '../../models/placement/PlacementRegistration';
import { PlacementRound } from '../../models/placement/PlacementRound';
import { RoundResult } from '../../models/placement/RoundResult';
import { PlacementOffer } from '../../models/placement/PlacementOffer';
import { InternshipPosting } from '../../models/placement/InternshipPosting';
import { InternshipApplication } from '../../models/placement/InternshipApplication';
import { PlacementTraining } from '../../models/placement/PlacementTraining';
import { TrainingAttendance } from '../../models/placement/TrainingAttendance';
import { MockInterview } from '../../models/placement/MockInterview';
import { HigherStudiesApplication } from '../../models/placement/HigherStudiesApplication';
import { EntrepreneurProfile } from '../../models/placement/EntrepreneurProfile';
import { AlumniProfile } from '../../models/placement/AlumniProfile';
import { AlumniEvent } from '../../models/placement/AlumniEvent';
import { PlacementReport } from '../../models/placement/PlacementReport';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

const STUDENT_POPULATE = { path: 'studentId', populate: { path: 'personId' } };
const FACULTY_POPULATE = { path: 'mentorId', populate: { path: 'personId' } };

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    placementSeasons, companies, jobPostings, registrations,
    rounds, offers, internships, internshipApps,
    trainings, mockInterviews, higherStudies,
    entrepreneurProfiles, alumniProfiles, alumniEvents,
    activeSeasons, offersAccepted,
  ] = await Promise.all([
    PlacementSeason.countDocuments({ collegeId }),
    Company.countDocuments({ collegeId }),
    JobPosting.countDocuments({ collegeId }),
    PlacementRegistration.countDocuments({ collegeId }),
    PlacementRound.countDocuments({ collegeId }),
    PlacementOffer.countDocuments({ collegeId }),
    InternshipPosting.countDocuments({ collegeId }),
    InternshipApplication.countDocuments({ collegeId }),
    PlacementTraining.countDocuments({ collegeId }),
    MockInterview.countDocuments({ collegeId }),
    HigherStudiesApplication.countDocuments({ collegeId }),
    EntrepreneurProfile.countDocuments({ collegeId }),
    AlumniProfile.countDocuments({ collegeId }),
    AlumniEvent.countDocuments({ collegeId }),
    PlacementSeason.countDocuments({ collegeId, status: 'active' }),
    PlacementOffer.countDocuments({ collegeId, status: 'accepted' }),
  ]);

  const [avgPkgAgg] = await PlacementOffer.aggregate([
    { $match: { collegeId, status: { $in: ['offered', 'accepted'] } } },
    { $group: { _id: null, avg: { $avg: '$packageLpa' }, max: { $max: '$packageLpa' } } },
  ]);

  return {
    placementSeasons, companies, jobPostings, registrations,
    rounds, offers, internships, internshipApps,
    trainings, mockInterviews, higherStudies,
    entrepreneurProfiles, alumniProfiles, alumniEvents,
    activeSeasons, offersAccepted,
    avgPackageLpa: avgPkgAgg?.avg || 0,
    maxPackageLpa: avgPkgAgg?.max || 0,
  };
}

// ═══ Placement Season ════════════════════════════════════

export async function listPlacementSeasons(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PlacementSeason, filter, page, limit, { createdAt: -1 }, ['academicYearId']);
}

export async function getPlacementSeason(collegeId: string, id: string) {
  const doc = await PlacementSeason.findOne({ _id: id, collegeId }).populate('academicYearId');
  if (!doc) throw new AppError(404, 'Placement season not found');
  return doc;
}

export async function createPlacementSeason(collegeId: string, data: any, who: string) {
  const doc = await PlacementSeason.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PlacementSeason', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePlacementSeason(collegeId: string, id: string, data: any, who: string) {
  const doc = await PlacementSeason.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Placement season not found');
  await createAuditLog({ collegeId, entityType: 'PlacementSeason', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePlacementSeason(collegeId: string, id: string, who: string) {
  const doc = await PlacementSeason.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Placement season not found');
  await createAuditLog({ collegeId, entityType: 'PlacementSeason', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Company ═════════════════════════════════════════════

export async function listCompanies(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Company, filter, page, limit, { createdAt: -1 });
}

export async function getCompany(collegeId: string, id: string) {
  const doc = await Company.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Company not found');
  return doc;
}

export async function createCompany(collegeId: string, data: any, who: string) {
  const doc = await Company.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Company', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateCompany(collegeId: string, id: string, data: any, who: string) {
  const doc = await Company.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Company not found');
  await createAuditLog({ collegeId, entityType: 'Company', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteCompany(collegeId: string, id: string, who: string) {
  const doc = await Company.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Company not found');
  await createAuditLog({ collegeId, entityType: 'Company', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Job Posting ═════════════════════════════════════════

export async function listJobPostings(collegeId: string, page = 1, limit = 20, placementSeasonId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (placementSeasonId) filter.placementSeasonId = placementSeasonId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JobPosting, filter, page, limit, { createdAt: -1 }, ['placementSeasonId', 'companyId']);
}

export async function getJobPosting(collegeId: string, id: string) {
  const doc = await JobPosting.findOne({ _id: id, collegeId }).populate('placementSeasonId companyId');
  if (!doc) throw new AppError(404, 'Job posting not found');
  return doc;
}

export async function createJobPosting(collegeId: string, data: any, who: string) {
  const doc = await JobPosting.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JobPosting', entityId: String(doc._id), entityName: data.role, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateJobPosting(collegeId: string, id: string, data: any, who: string) {
  const doc = await JobPosting.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Job posting not found');
  await createAuditLog({ collegeId, entityType: 'JobPosting', entityId: id, entityName: doc.role, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteJobPosting(collegeId: string, id: string, who: string) {
  const doc = await JobPosting.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Job posting not found');
  await createAuditLog({ collegeId, entityType: 'JobPosting', entityId: id, entityName: doc.role, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Placement Registration ══════════════════════════════

export async function listPlacementRegistrations(collegeId: string, page = 1, limit = 20, jobPostingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (jobPostingId) filter.jobPostingId = jobPostingId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(PlacementRegistration, filter, page, limit, { appliedAt: -1 }, ['jobPostingId', STUDENT_POPULATE] as any);
}

export async function createPlacementRegistration(collegeId: string, data: any, who: string) {
  const doc = await PlacementRegistration.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PlacementRegistration', entityId: String(doc._id), entityName: 'Registration', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePlacementRegistration(collegeId: string, id: string, data: any, who: string) {
  const doc = await PlacementRegistration.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Registration not found');
  await createAuditLog({ collegeId, entityType: 'PlacementRegistration', entityId: id, entityName: 'Registration', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePlacementRegistration(collegeId: string, id: string, who: string) {
  const doc = await PlacementRegistration.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Registration not found');
  await createAuditLog({ collegeId, entityType: 'PlacementRegistration', entityId: id, entityName: 'Registration', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Placement Round ═════════════════════════════════════

export async function listPlacementRounds(collegeId: string, page = 1, limit = 20, jobPostingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (jobPostingId) filter.jobPostingId = jobPostingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PlacementRound, filter, page, limit, { createdAt: -1 }, ['jobPostingId']);
}

export async function createPlacementRound(collegeId: string, data: any, who: string) {
  const doc = await PlacementRound.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PlacementRound', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePlacementRound(collegeId: string, id: string, data: any, who: string) {
  const doc = await PlacementRound.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Placement round not found');
  await createAuditLog({ collegeId, entityType: 'PlacementRound', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePlacementRound(collegeId: string, id: string, who: string) {
  const doc = await PlacementRound.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Placement round not found');
  await createAuditLog({ collegeId, entityType: 'PlacementRound', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Round Result ════════════════════════════════════════

export async function listRoundResults(collegeId: string, page = 1, limit = 20, roundId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (roundId) filter.roundId = roundId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(RoundResult, filter, page, limit, { createdAt: -1 }, ['roundId', STUDENT_POPULATE] as any);
}

export async function createRoundResult(collegeId: string, data: any, who: string) {
  const doc = await RoundResult.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'RoundResult', entityId: String(doc._id), entityName: `Result ${data.result}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateRoundResult(collegeId: string, id: string, data: any, who: string) {
  const doc = await RoundResult.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Round result not found');
  await createAuditLog({ collegeId, entityType: 'RoundResult', entityId: id, entityName: `Result ${doc.result}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteRoundResult(collegeId: string, id: string, who: string) {
  const doc = await RoundResult.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Round result not found');
  await createAuditLog({ collegeId, entityType: 'RoundResult', entityId: id, entityName: `Result ${doc.result}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Placement Offer ═════════════════════════════════════

export async function listPlacementOffers(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PlacementOffer, filter, page, limit, { offerDate: -1 }, ['jobPostingId', 'companyId', STUDENT_POPULATE] as any);
}

export async function createPlacementOffer(collegeId: string, data: any, who: string) {
  const doc = await PlacementOffer.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PlacementOffer', entityId: String(doc._id), entityName: `Offer ${data.packageLpa} LPA`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePlacementOffer(collegeId: string, id: string, data: any, who: string) {
  const doc = await PlacementOffer.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Placement offer not found');
  await createAuditLog({ collegeId, entityType: 'PlacementOffer', entityId: id, entityName: `Offer ${doc.packageLpa} LPA`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePlacementOffer(collegeId: string, id: string, who: string) {
  const doc = await PlacementOffer.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Placement offer not found');
  await createAuditLog({ collegeId, entityType: 'PlacementOffer', entityId: id, entityName: `Offer ${doc.packageLpa} LPA`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Internship Posting ══════════════════════════════════

export async function listInternshipPostings(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(InternshipPosting, filter, page, limit, { createdAt: -1 }, ['companyId']);
}

export async function createInternshipPosting(collegeId: string, data: any, who: string) {
  const doc = await InternshipPosting.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'InternshipPosting', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateInternshipPosting(collegeId: string, id: string, data: any, who: string) {
  const doc = await InternshipPosting.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Internship posting not found');
  await createAuditLog({ collegeId, entityType: 'InternshipPosting', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteInternshipPosting(collegeId: string, id: string, who: string) {
  const doc = await InternshipPosting.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Internship posting not found');
  await createAuditLog({ collegeId, entityType: 'InternshipPosting', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Internship Application ══════════════════════════════

export async function listInternshipApplications(collegeId: string, page = 1, limit = 20, internshipId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (internshipId) filter.internshipId = internshipId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(InternshipApplication, filter, page, limit, { appliedAt: -1 }, ['internshipId', STUDENT_POPULATE] as any);
}

export async function createInternshipApplication(collegeId: string, data: any, who: string) {
  const doc = await InternshipApplication.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'InternshipApplication', entityId: String(doc._id), entityName: 'Application', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateInternshipApplication(collegeId: string, id: string, data: any, who: string) {
  const doc = await InternshipApplication.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Internship application not found');
  await createAuditLog({ collegeId, entityType: 'InternshipApplication', entityId: id, entityName: 'Application', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteInternshipApplication(collegeId: string, id: string, who: string) {
  const doc = await InternshipApplication.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Internship application not found');
  await createAuditLog({ collegeId, entityType: 'InternshipApplication', entityId: id, entityName: 'Application', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Placement Training ══════════════════════════════════

export async function listPlacementTrainings(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PlacementTraining, filter, page, limit, { startDate: -1 });
}

export async function createPlacementTraining(collegeId: string, data: any, who: string) {
  const doc = await PlacementTraining.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PlacementTraining', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePlacementTraining(collegeId: string, id: string, data: any, who: string) {
  const doc = await PlacementTraining.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Training not found');
  await createAuditLog({ collegeId, entityType: 'PlacementTraining', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePlacementTraining(collegeId: string, id: string, who: string) {
  const doc = await PlacementTraining.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Training not found');
  await createAuditLog({ collegeId, entityType: 'PlacementTraining', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Training Attendance ═════════════════════════════════

export async function listTrainingAttendance(collegeId: string, page = 1, limit = 20, trainingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (trainingId) filter.trainingId = trainingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(TrainingAttendance, filter, page, limit, { createdAt: -1 }, ['trainingId', STUDENT_POPULATE] as any);
}

export async function createTrainingAttendance(collegeId: string, data: any, who: string) {
  const doc = await TrainingAttendance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'TrainingAttendance', entityId: String(doc._id), entityName: 'Attendance', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateTrainingAttendance(collegeId: string, id: string, data: any, who: string) {
  const doc = await TrainingAttendance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Training attendance not found');
  await createAuditLog({ collegeId, entityType: 'TrainingAttendance', entityId: id, entityName: 'Attendance', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteTrainingAttendance(collegeId: string, id: string, who: string) {
  const doc = await TrainingAttendance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Training attendance not found');
  await createAuditLog({ collegeId, entityType: 'TrainingAttendance', entityId: id, entityName: 'Attendance', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Mock Interview ══════════════════════════════════════

export async function listMockInterviews(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(MockInterview, filter, page, limit, { date: -1 }, [STUDENT_POPULATE, 'interviewerId'] as any);
}

export async function createMockInterview(collegeId: string, data: any, who: string) {
  const doc = await MockInterview.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'MockInterview', entityId: String(doc._id), entityName: `Mock ${data.type}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMockInterview(collegeId: string, id: string, data: any, who: string) {
  const doc = await MockInterview.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Mock interview not found');
  await createAuditLog({ collegeId, entityType: 'MockInterview', entityId: id, entityName: `Mock ${doc.type}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMockInterview(collegeId: string, id: string, who: string) {
  const doc = await MockInterview.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mock interview not found');
  await createAuditLog({ collegeId, entityType: 'MockInterview', entityId: id, entityName: `Mock ${doc.type}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Higher Studies Application ══════════════════════════

export async function listHigherStudiesApplications(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(HigherStudiesApplication, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE] as any);
}

export async function createHigherStudiesApplication(collegeId: string, data: any, who: string) {
  const doc = await HigherStudiesApplication.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'HigherStudiesApplication', entityId: String(doc._id), entityName: data.examType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateHigherStudiesApplication(collegeId: string, id: string, data: any, who: string) {
  const doc = await HigherStudiesApplication.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Higher studies application not found');
  await createAuditLog({ collegeId, entityType: 'HigherStudiesApplication', entityId: id, entityName: doc.examType, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteHigherStudiesApplication(collegeId: string, id: string, who: string) {
  const doc = await HigherStudiesApplication.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Higher studies application not found');
  await createAuditLog({ collegeId, entityType: 'HigherStudiesApplication', entityId: id, entityName: doc.examType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Entrepreneur Profile ════════════════════════════════

export async function listEntrepreneurProfiles(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(EntrepreneurProfile, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, FACULTY_POPULATE] as any);
}

export async function createEntrepreneurProfile(collegeId: string, data: any, who: string) {
  const doc = await EntrepreneurProfile.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EntrepreneurProfile', entityId: String(doc._id), entityName: data.ventureIdea, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateEntrepreneurProfile(collegeId: string, id: string, data: any, who: string) {
  const doc = await EntrepreneurProfile.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Entrepreneur profile not found');
  await createAuditLog({ collegeId, entityType: 'EntrepreneurProfile', entityId: id, entityName: doc.ventureIdea, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteEntrepreneurProfile(collegeId: string, id: string, who: string) {
  const doc = await EntrepreneurProfile.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Entrepreneur profile not found');
  await createAuditLog({ collegeId, entityType: 'EntrepreneurProfile', entityId: id, entityName: doc.ventureIdea, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Alumni Profile ══════════════════════════════════════

export async function listAlumniProfiles(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AlumniProfile, filter, page, limit, { graduationYear: -1 }, ['personId']);
}

export async function createAlumniProfile(collegeId: string, data: any, who: string) {
  const doc = await AlumniProfile.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AlumniProfile', entityId: String(doc._id), entityName: `Alumni ${data.graduationYear}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAlumniProfile(collegeId: string, id: string, data: any, who: string) {
  const doc = await AlumniProfile.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Alumni profile not found');
  await createAuditLog({ collegeId, entityType: 'AlumniProfile', entityId: id, entityName: `Alumni ${doc.graduationYear}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAlumniProfile(collegeId: string, id: string, who: string) {
  const doc = await AlumniProfile.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Alumni profile not found');
  await createAuditLog({ collegeId, entityType: 'AlumniProfile', entityId: id, entityName: `Alumni ${doc.graduationYear}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Alumni Event ════════════════════════════════════════

export async function listAlumniEvents(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AlumniEvent, filter, page, limit, { date: -1 }, ['organizerId']);
}

export async function createAlumniEvent(collegeId: string, data: any, who: string) {
  const doc = await AlumniEvent.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AlumniEvent', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAlumniEvent(collegeId: string, id: string, data: any, who: string) {
  const doc = await AlumniEvent.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Alumni event not found');
  await createAuditLog({ collegeId, entityType: 'AlumniEvent', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAlumniEvent(collegeId: string, id: string, who: string) {
  const doc = await AlumniEvent.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Alumni event not found');
  await createAuditLog({ collegeId, entityType: 'AlumniEvent', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Placement Report ════════════════════════════════════

export async function listPlacementReports(collegeId: string, page = 1, limit = 20, placementSeasonId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (placementSeasonId) filter.placementSeasonId = placementSeasonId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PlacementReport, filter, page, limit, { generatedAt: -1 }, ['placementSeasonId']);
}

export async function createPlacementReport(collegeId: string, data: any, who: string) {
  const doc = await PlacementReport.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PlacementReport', entityId: String(doc._id), entityName: data.reportType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function deletePlacementReport(collegeId: string, id: string, who: string) {
  const doc = await PlacementReport.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Report not found');
  await createAuditLog({ collegeId, entityType: 'PlacementReport', entityId: id, entityName: doc.reportType, action: 'delete', changes: [], performedBy: who });
  return doc;
}
