import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Placement Season ════════════════════════════════════

export async function listPlacementSeasons(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPlacementSeasons(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
  try { res.json(await service.listCompanies(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
    res.json(await service.listJobPostings(req.collegeId!, Number(page) || 1, Number(limit) || 20, placementSeasonId));
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
    res.json(await service.listPlacementRegistrations(req.collegeId!, Number(page) || 1, Number(limit) || 20, jobPostingId));
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
    res.json(await service.listPlacementRounds(req.collegeId!, Number(page) || 1, Number(limit) || 20, jobPostingId));
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
    res.json(await service.listRoundResults(req.collegeId!, Number(page) || 1, Number(limit) || 20, roundId));
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
    res.json(await service.listPlacementOffers(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
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
  try { res.json(await service.listInternshipPostings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
    res.json(await service.listInternshipApplications(req.collegeId!, Number(page) || 1, Number(limit) || 20, internshipId));
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
  try { res.json(await service.listPlacementTrainings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
    res.json(await service.listTrainingAttendance(req.collegeId!, Number(page) || 1, Number(limit) || 20, trainingId));
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
    res.json(await service.listMockInterviews(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
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
    res.json(await service.listHigherStudiesApplications(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
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
  try { res.json(await service.listEntrepreneurProfiles(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
  try { res.json(await service.listAlumniProfiles(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
  try { res.json(await service.listAlumniEvents(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
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
    res.json(await service.listPlacementReports(req.collegeId!, Number(page) || 1, Number(limit) || 20, placementSeasonId));
  } catch (err) { next(err); }
}
export async function createPlacementReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPlacementReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePlacementReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePlacementReport(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
