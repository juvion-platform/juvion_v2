import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
import * as crmService from './crm-service';
import * as drivesService from './drives-offers-service';
import * as profileService from './profile-train-service';
import * as alumniService from './alumni-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Placement Season ════════════════════════════════════

export async function listPlacementSeasons(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPlacementSeasons(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function getPlacementSeason(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPlacementSeason(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPlacementSeason(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementSeason(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePlacementSeason(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePlacementSeason(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementSeason(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementSeason(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Company ═════════════════════════════════════════════

export async function listCompanies(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listCompanies(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function getCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCompany(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCompany(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCompany(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCompany(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Job Posting ═════════════════════════════════════════

export async function listJobPostings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, placementSeasonId } = req.query as any;
    res.json(await service.listJobPostings(req.collegeId!, Number(page) || 1, Number(limit) || 20, placementSeasonId, req.authScope));
  } catch (err) { next(err); }
}
export async function getJobPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getJobPosting(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createJobPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createJobPosting(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateJobPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateJobPosting(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteJobPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteJobPosting(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Placement Registration ══════════════════════════════

export async function listPlacementRegistrations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, jobPostingId } = req.query as any;
    res.json(await service.listPlacementRegistrations(req.collegeId!, Number(page) || 1, Number(limit) || 20, jobPostingId, req.authScope));
  } catch (err) { next(err); }
}
export async function createPlacementRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementRegistration(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePlacementRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePlacementRegistration(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementRegistration(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Placement Round ═════════════════════════════════════

export async function listPlacementRounds(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, jobPostingId } = req.query as any;
    res.json(await service.listPlacementRounds(req.collegeId!, Number(page) || 1, Number(limit) || 20, jobPostingId, req.authScope));
  } catch (err) { next(err); }
}
export async function createPlacementRound(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementRound(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePlacementRound(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePlacementRound(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementRound(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementRound(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Round Result ════════════════════════════════════════

export async function listRoundResults(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, roundId } = req.query as any;
    res.json(await service.listRoundResults(req.collegeId!, Number(page) || 1, Number(limit) || 20, roundId, req.authScope));
  } catch (err) { next(err); }
}
export async function createRoundResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRoundResult(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRoundResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRoundResult(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRoundResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRoundResult(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Placement Offer ═════════════════════════════════════

export async function listPlacementOffers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listPlacementOffers(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
  } catch (err) { next(err); }
}
export async function createPlacementOffer(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementOffer(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePlacementOffer(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePlacementOffer(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementOffer(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementOffer(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Internship Posting ══════════════════════════════════

export async function listInternshipPostings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listInternshipPostings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function createInternshipPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInternshipPosting(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInternshipPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInternshipPosting(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteInternshipPosting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInternshipPosting(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Internship Application ══════════════════════════════

export async function listInternshipApplications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, internshipId } = req.query as any;
    res.json(await service.listInternshipApplications(req.collegeId!, Number(page) || 1, Number(limit) || 20, internshipId, req.authScope));
  } catch (err) { next(err); }
}
export async function createInternshipApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInternshipApplication(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInternshipApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInternshipApplication(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteInternshipApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInternshipApplication(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Placement Training ══════════════════════════════════

export async function listPlacementTrainings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPlacementTrainings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function createPlacementTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementTraining(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePlacementTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePlacementTraining(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementTraining(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Training Attendance ═════════════════════════════════

export async function listTrainingAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, trainingId } = req.query as any;
    res.json(await service.listTrainingAttendance(req.collegeId!, Number(page) || 1, Number(limit) || 20, trainingId, req.authScope));
  } catch (err) { next(err); }
}
export async function createTrainingAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createTrainingAttendance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateTrainingAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateTrainingAttendance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTrainingAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteTrainingAttendance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Mock Interview ══════════════════════════════════════

export async function listMockInterviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listMockInterviews(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
  } catch (err) { next(err); }
}
export async function createMockInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMockInterview(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMockInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMockInterview(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMockInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMockInterview(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Higher Studies Application ══════════════════════════

export async function listHigherStudiesApplications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listHigherStudiesApplications(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
  } catch (err) { next(err); }
}
export async function createHigherStudiesApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createHigherStudiesApplication(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHigherStudiesApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateHigherStudiesApplication(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHigherStudiesApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteHigherStudiesApplication(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Entrepreneur Profile ════════════════════════════════

export async function listEntrepreneurProfiles(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listEntrepreneurProfiles(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function createEntrepreneurProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEntrepreneurProfile(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEntrepreneurProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEntrepreneurProfile(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEntrepreneurProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEntrepreneurProfile(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Alumni Profile ══════════════════════════════════════

export async function listAlumniProfiles(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listAlumniProfiles(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function createAlumniProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAlumniProfile(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAlumniProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAlumniProfile(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAlumniProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAlumniProfile(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Alumni Event ════════════════════════════════════════

export async function listAlumniEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listAlumniEvents(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function createAlumniEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAlumniEvent(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAlumniEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAlumniEvent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAlumniEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAlumniEvent(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Placement Report ════════════════════════════════════

export async function listPlacementReports(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, placementSeasonId } = req.query as any;
    res.json(await service.listPlacementReports(req.collegeId!, Number(page) || 1, Number(limit) || 20, placementSeasonId, req.authScope));
  } catch (err) { next(err); }
}
export async function createPlacementReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementReport(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// W04 Workflow Controllers
// ═══════════════════════════════════════════════════════════

// ─── CRM: Company Engagement ─────────────────────────────

export async function listEngagementLogsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await crmService.listEngagementLogs(req.collegeId!, req.params.id as string, +page, +limit));
  } catch (err) { next(err); }
}
export async function createEngagementLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await crmService.createEngagementLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function scorePipelineCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.scorePipeline(req.collegeId!, req.body.placementSeasonId, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function getPipelineDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.getPipelineDashboard(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function blacklistCompanyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.blacklistCompany(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function reinstateCompanyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.reinstateCompany(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function listProgrammeAffinityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await crmService.listProgrammeAffinity(req.collegeId!, req.params.id as string, +page, +limit));
  } catch (err) { next(err); }
}
export async function generateSeasonAnalyticsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.generateSeasonAnalytics(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Recruiter Portal ────────────────────────────────────

export async function listRecruiterAccountsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status, companyId } = req.query as any;
    res.json(await crmService.listRecruiterAccounts(req.collegeId!, +page, +limit, status, companyId));
  } catch (err) { next(err); }
}
export async function getRecruiterAccountCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.getRecruiterAccount(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function registerRecruiterAccountCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await crmService.registerRecruiterAccount(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function verifyRecruiterAccountCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.verifyRecruiterAccount(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deactivateRecruiterAccountCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await crmService.deactivateRecruiterAccount(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getRecruiterActivityLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await crmService.getRecruiterActivityLog(req.collegeId!, req.params.id as string, +page, +limit));
  } catch (err) { next(err); }
}

// ─── Season + Drive ──────────────────────────────────────

export async function transitionSeasonCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.transitionSeason(req.collegeId!, req.params.id as string, req.body.status, who(req))); } catch (err) { next(err); }
}
export async function getSeasonStatisticsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.getSeasonStatistics(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listDrivesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', placementSeasonId, status } = req.query as any;
    res.json(await drivesService.listDrives(req.collegeId!, +page, +limit, placementSeasonId, status));
  } catch (err) { next(err); }
}
export async function getDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.getDrive(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await drivesService.createDrive(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function transitionDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.transitionDrive(req.collegeId!, req.params.id as string, req.body.status, who(req))); } catch (err) { next(err); }
}
export async function cancelDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.cancelDrive(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function listDriveApplicationsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await drivesService.listDriveApplications(req.collegeId!, req.params.id as string, +page, +limit, status));
  } catch (err) { next(err); }
}
export async function getDriveApplicationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.getDriveApplication(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function applyToDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await drivesService.applyToDrive(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function withdrawApplicationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.withdrawApplication(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function generateShortlistCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.generateShortlist(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function releaseShortlistCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.releaseShortlist(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function listInterviewSchedulesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await drivesService.listInterviewSchedules(req.collegeId!, req.params.id as string, +page, +limit));
  } catch (err) { next(err); }
}
export async function getInterviewScheduleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.getInterviewSchedule(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function scheduleInterviewsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await drivesService.scheduleInterviews(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInterviewOutcomeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.updateInterviewOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function checkEligibilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.checkEligibility(req.collegeId!, req.body.studentId, req.body.jobPostingId)); } catch (err) { next(err); }
}
export async function checkDreamPolicyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.checkDreamPolicy(req.collegeId!, req.body.studentId, req.body.jobPostingId)); } catch (err) { next(err); }
}

// ─── Offer Workflow ──────────────────────────────────────

export async function listOffersByDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', driveId } = req.query as any;
    res.json(await drivesService.listOffersByDrive(req.collegeId!, req.params.id as string || driveId, +page, +limit));
  } catch (err) { next(err); }
}
export async function createOfferFromDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await drivesService.createOfferFromDrive(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function acceptOfferCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.acceptOffer(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function rejectOfferCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.rejectOffer(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function handleRenegeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.handleRenege(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function handleLapseCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.handleLapse(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function releaseOfferCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.releaseOffer(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Bar + Opt-Out ───────────────────────────────────────

export async function listPlacementBarsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', studentId, status } = req.query as any;
    res.json(await drivesService.listPlacementBars(req.collegeId!, +page, +limit, studentId, status));
  } catch (err) { next(err); }
}
export async function applyPlacementBarCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await drivesService.applyPlacementBar(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function liftPlacementBarCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.liftPlacementBar(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function listOptOutsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', placementSeasonId } = req.query as any;
    res.json(await drivesService.listOptOuts(req.collegeId!, +page, +limit, placementSeasonId));
  } catch (err) { next(err); }
}
export async function recordOptOutCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await drivesService.recordOptOut(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function voidOptOutCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.voidOptOut(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeDriveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await drivesService.closeDrive(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Career Profile ──────────────────────────────────────

export async function listCareerProfilesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', placementSeasonId, status } = req.query as any;
    res.json(await profileService.listCareerProfiles(req.collegeId!, +page, +limit, placementSeasonId, status));
  } catch (err) { next(err); }
}
export async function getCareerProfileCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.getCareerProfile(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function initCareerProfilesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await profileService.initCareerProfiles(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCareerProfileCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.updateCareerProfile(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function validateProfileItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.validateProfileItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function refreshAcademicDataCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.refreshAcademicData(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Readiness Scores ────────────────────────────────────

export async function listReadinessScoresCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', placementSeasonId, category } = req.query as any;
    res.json(await profileService.listReadinessScores(req.collegeId!, +page, +limit, placementSeasonId, category));
  } catch (err) { next(err); }
}
export async function getReadinessScoreCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { placementSeasonId } = req.query as any;
    res.json(await profileService.getReadinessScore(req.collegeId!, req.params.studentId as string, placementSeasonId));
  } catch (err) { next(err); }
}
export async function computeBatchReadinessCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.computeBatchReadiness(req.collegeId!, req.body.placementSeasonId, who(req))); } catch (err) { next(err); }
}

// ─── Skill Records ───────────────────────────────────────

export async function listSkillRecordsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', studentId, category } = req.query as any;
    res.json(await profileService.listSkillRecords(req.collegeId!, req.params.studentId as string || studentId, +page, +limit, category));
  } catch (err) { next(err); }
}
export async function getSkillRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.getSkillRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSkillRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await profileService.createSkillRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSkillRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.updateSkillRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSkillRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.deleteSkillRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function ingestExternalAssessmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await profileService.ingestExternalAssessment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Training Workflow ───────────────────────────────────

export async function updateTrainingSessionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.updateTrainingSession(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordTrainingAssessmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await profileService.recordTrainingAssessment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getTrainingCompletionStatsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await profileService.getTrainingCompletionStats(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ─── Alumni Career Records ───────────────────────────────

export async function listAlumniCareerRecordsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', careerStatus } = req.query as any;
    res.json(await alumniService.listAlumniCareerRecords(req.collegeId!, +page, +limit, careerStatus));
  } catch (err) { next(err); }
}
export async function getAlumniCareerRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await alumniService.getAlumniCareerRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function initAlumniCareerRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await alumniService.initAlumniCareerRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAlumniCareerRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await alumniService.updateAlumniCareerRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function batchInitAlumniCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await alumniService.batchInitFromGraduation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getAlumniAnalyticsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await alumniService.getAlumniAnalytics(req.collegeId!)); } catch (err) { next(err); }
}
