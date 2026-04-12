import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createPlacementSeasonSchema, updatePlacementSeasonSchema,
  createCompanySchema, updateCompanySchema,
  createJobPostingSchema, updateJobPostingSchema,
  createPlacementRegistrationSchema, updatePlacementRegistrationSchema,
  createPlacementRoundSchema, updatePlacementRoundSchema,
  createRoundResultSchema, updateRoundResultSchema,
  createPlacementOfferSchema, updatePlacementOfferSchema,
  createInternshipPostingSchema, updateInternshipPostingSchema,
  createInternshipApplicationSchema, updateInternshipApplicationSchema,
  createPlacementTrainingSchema, updatePlacementTrainingSchema,
  createTrainingAttendanceSchema, updateTrainingAttendanceSchema,
  createMockInterviewSchema, updateMockInterviewSchema,
  createHigherStudiesApplicationSchema, updateHigherStudiesApplicationSchema,
  createEntrepreneurProfileSchema, updateEntrepreneurProfileSchema,
  createAlumniProfileSchema, updateAlumniProfileSchema,
  createAlumniEventSchema, updateAlumniEventSchema,
  createPlacementReportSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('placement', 'read'), ctrl.dashboardStats);

// Placement Seasons
router.get('/seasons', authorize('placement', 'read'), ctrl.listPlacementSeasons);
router.get('/seasons/:id', authorize('placement', 'read'), ctrl.getPlacementSeason);
router.post('/seasons', authorize('placement', 'create'), validate(createPlacementSeasonSchema), ctrl.createPlacementSeason);
router.put('/seasons/:id', authorize('placement', 'update'), validate(updatePlacementSeasonSchema), ctrl.updatePlacementSeason);
router.delete('/seasons/:id', authorize('placement', 'delete'), ctrl.deletePlacementSeason);

// Companies
router.get('/companies', authorize('placement', 'read'), ctrl.listCompanies);
router.get('/companies/:id', authorize('placement', 'read'), ctrl.getCompany);
router.post('/companies', authorize('placement', 'create'), validate(createCompanySchema), ctrl.createCompany);
router.put('/companies/:id', authorize('placement', 'update'), validate(updateCompanySchema), ctrl.updateCompany);
router.delete('/companies/:id', authorize('placement', 'delete'), ctrl.deleteCompany);

// Job Postings
router.get('/job-postings', authorize('placement', 'read'), ctrl.listJobPostings);
router.get('/job-postings/:id', authorize('placement', 'read'), ctrl.getJobPosting);
router.post('/job-postings', authorize('placement', 'create'), validate(createJobPostingSchema), ctrl.createJobPosting);
router.put('/job-postings/:id', authorize('placement', 'update'), validate(updateJobPostingSchema), ctrl.updateJobPosting);
router.delete('/job-postings/:id', authorize('placement', 'delete'), ctrl.deleteJobPosting);

// Registrations
router.get('/registrations', authorize('placement', 'read'), ctrl.listPlacementRegistrations);
router.post('/registrations', authorize('placement', 'create'), validate(createPlacementRegistrationSchema), ctrl.createPlacementRegistration);
router.put('/registrations/:id', authorize('placement', 'update'), validate(updatePlacementRegistrationSchema), ctrl.updatePlacementRegistration);
router.delete('/registrations/:id', authorize('placement', 'delete'), ctrl.deletePlacementRegistration);

// Rounds
router.get('/rounds', authorize('placement', 'read'), ctrl.listPlacementRounds);
router.post('/rounds', authorize('placement', 'create'), validate(createPlacementRoundSchema), ctrl.createPlacementRound);
router.put('/rounds/:id', authorize('placement', 'update'), validate(updatePlacementRoundSchema), ctrl.updatePlacementRound);
router.delete('/rounds/:id', authorize('placement', 'delete'), ctrl.deletePlacementRound);

// Round Results
router.get('/round-results', authorize('placement', 'read'), ctrl.listRoundResults);
router.post('/round-results', authorize('placement', 'create'), validate(createRoundResultSchema), ctrl.createRoundResult);
router.put('/round-results/:id', authorize('placement', 'update'), validate(updateRoundResultSchema), ctrl.updateRoundResult);
router.delete('/round-results/:id', authorize('placement', 'delete'), ctrl.deleteRoundResult);

// Offers
router.get('/offers', authorize('placement', 'read'), ctrl.listPlacementOffers);
router.post('/offers', authorize('placement', 'create'), validate(createPlacementOfferSchema), ctrl.createPlacementOffer);
router.put('/offers/:id', authorize('placement', 'update'), validate(updatePlacementOfferSchema), ctrl.updatePlacementOffer);
router.delete('/offers/:id', authorize('placement', 'delete'), ctrl.deletePlacementOffer);

// Internship Postings
router.get('/internships', authorize('placement', 'read'), ctrl.listInternshipPostings);
router.post('/internships', authorize('placement', 'create'), validate(createInternshipPostingSchema), ctrl.createInternshipPosting);
router.put('/internships/:id', authorize('placement', 'update'), validate(updateInternshipPostingSchema), ctrl.updateInternshipPosting);
router.delete('/internships/:id', authorize('placement', 'delete'), ctrl.deleteInternshipPosting);

// Internship Applications
router.get('/internship-applications', authorize('placement', 'read'), ctrl.listInternshipApplications);
router.post('/internship-applications', authorize('placement', 'create'), validate(createInternshipApplicationSchema), ctrl.createInternshipApplication);
router.put('/internship-applications/:id', authorize('placement', 'update'), validate(updateInternshipApplicationSchema), ctrl.updateInternshipApplication);
router.delete('/internship-applications/:id', authorize('placement', 'delete'), ctrl.deleteInternshipApplication);

// Training
router.get('/trainings', authorize('placement', 'read'), ctrl.listPlacementTrainings);
router.post('/trainings', authorize('placement', 'create'), validate(createPlacementTrainingSchema), ctrl.createPlacementTraining);
router.put('/trainings/:id', authorize('placement', 'update'), validate(updatePlacementTrainingSchema), ctrl.updatePlacementTraining);
router.delete('/trainings/:id', authorize('placement', 'delete'), ctrl.deletePlacementTraining);

// Training Attendance
router.get('/training-attendance', authorize('placement', 'read'), ctrl.listTrainingAttendance);
router.post('/training-attendance', authorize('placement', 'create'), validate(createTrainingAttendanceSchema), ctrl.createTrainingAttendance);
router.put('/training-attendance/:id', authorize('placement', 'update'), validate(updateTrainingAttendanceSchema), ctrl.updateTrainingAttendance);
router.delete('/training-attendance/:id', authorize('placement', 'delete'), ctrl.deleteTrainingAttendance);

// Mock Interviews
router.get('/mock-interviews', authorize('placement', 'read'), ctrl.listMockInterviews);
router.post('/mock-interviews', authorize('placement', 'create'), validate(createMockInterviewSchema), ctrl.createMockInterview);
router.put('/mock-interviews/:id', authorize('placement', 'update'), validate(updateMockInterviewSchema), ctrl.updateMockInterview);
router.delete('/mock-interviews/:id', authorize('placement', 'delete'), ctrl.deleteMockInterview);

// Higher Studies
router.get('/higher-studies', authorize('placement', 'read'), ctrl.listHigherStudiesApplications);
router.post('/higher-studies', authorize('placement', 'create'), validate(createHigherStudiesApplicationSchema), ctrl.createHigherStudiesApplication);
router.put('/higher-studies/:id', authorize('placement', 'update'), validate(updateHigherStudiesApplicationSchema), ctrl.updateHigherStudiesApplication);
router.delete('/higher-studies/:id', authorize('placement', 'delete'), ctrl.deleteHigherStudiesApplication);

// Entrepreneur Profiles
router.get('/entrepreneurs', authorize('placement', 'read'), ctrl.listEntrepreneurProfiles);
router.post('/entrepreneurs', authorize('placement', 'create'), validate(createEntrepreneurProfileSchema), ctrl.createEntrepreneurProfile);
router.put('/entrepreneurs/:id', authorize('placement', 'update'), validate(updateEntrepreneurProfileSchema), ctrl.updateEntrepreneurProfile);
router.delete('/entrepreneurs/:id', authorize('placement', 'delete'), ctrl.deleteEntrepreneurProfile);

// Alumni Profiles
router.get('/alumni-profiles', authorize('placement', 'read'), ctrl.listAlumniProfiles);
router.post('/alumni-profiles', authorize('placement', 'create'), validate(createAlumniProfileSchema), ctrl.createAlumniProfile);
router.put('/alumni-profiles/:id', authorize('placement', 'update'), validate(updateAlumniProfileSchema), ctrl.updateAlumniProfile);
router.delete('/alumni-profiles/:id', authorize('placement', 'delete'), ctrl.deleteAlumniProfile);

// Alumni Events
router.get('/alumni-events', authorize('placement', 'read'), ctrl.listAlumniEvents);
router.post('/alumni-events', authorize('placement', 'create'), validate(createAlumniEventSchema), ctrl.createAlumniEvent);
router.put('/alumni-events/:id', authorize('placement', 'update'), validate(updateAlumniEventSchema), ctrl.updateAlumniEvent);
router.delete('/alumni-events/:id', authorize('placement', 'delete'), ctrl.deleteAlumniEvent);

// Placement Reports
router.get('/reports', authorize('placement', 'read'), ctrl.listPlacementReports);
router.post('/reports', authorize('placement', 'create'), validate(createPlacementReportSchema), ctrl.createPlacementReport);
router.delete('/reports/:id', authorize('placement', 'delete'), ctrl.deletePlacementReport);

export default router;
