import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
router.get('/stats', ctrl.dashboardStats);

// Placement Seasons
router.get('/seasons', ctrl.listPlacementSeasons);
router.get('/seasons/:id', ctrl.getPlacementSeason);
router.post('/seasons', validate(createPlacementSeasonSchema), ctrl.createPlacementSeason);
router.put('/seasons/:id', validate(updatePlacementSeasonSchema), ctrl.updatePlacementSeason);
router.delete('/seasons/:id', ctrl.deletePlacementSeason);

// Companies
router.get('/companies', ctrl.listCompanies);
router.get('/companies/:id', ctrl.getCompany);
router.post('/companies', validate(createCompanySchema), ctrl.createCompany);
router.put('/companies/:id', validate(updateCompanySchema), ctrl.updateCompany);
router.delete('/companies/:id', ctrl.deleteCompany);

// Job Postings
router.get('/job-postings', ctrl.listJobPostings);
router.get('/job-postings/:id', ctrl.getJobPosting);
router.post('/job-postings', validate(createJobPostingSchema), ctrl.createJobPosting);
router.put('/job-postings/:id', validate(updateJobPostingSchema), ctrl.updateJobPosting);
router.delete('/job-postings/:id', ctrl.deleteJobPosting);

// Registrations
router.get('/registrations', ctrl.listPlacementRegistrations);
router.post('/registrations', validate(createPlacementRegistrationSchema), ctrl.createPlacementRegistration);
router.put('/registrations/:id', validate(updatePlacementRegistrationSchema), ctrl.updatePlacementRegistration);
router.delete('/registrations/:id', ctrl.deletePlacementRegistration);

// Rounds
router.get('/rounds', ctrl.listPlacementRounds);
router.post('/rounds', validate(createPlacementRoundSchema), ctrl.createPlacementRound);
router.put('/rounds/:id', validate(updatePlacementRoundSchema), ctrl.updatePlacementRound);
router.delete('/rounds/:id', ctrl.deletePlacementRound);

// Round Results
router.get('/round-results', ctrl.listRoundResults);
router.post('/round-results', validate(createRoundResultSchema), ctrl.createRoundResult);
router.put('/round-results/:id', validate(updateRoundResultSchema), ctrl.updateRoundResult);
router.delete('/round-results/:id', ctrl.deleteRoundResult);

// Offers
router.get('/offers', ctrl.listPlacementOffers);
router.post('/offers', validate(createPlacementOfferSchema), ctrl.createPlacementOffer);
router.put('/offers/:id', validate(updatePlacementOfferSchema), ctrl.updatePlacementOffer);
router.delete('/offers/:id', ctrl.deletePlacementOffer);

// Internship Postings
router.get('/internships', ctrl.listInternshipPostings);
router.post('/internships', validate(createInternshipPostingSchema), ctrl.createInternshipPosting);
router.put('/internships/:id', validate(updateInternshipPostingSchema), ctrl.updateInternshipPosting);
router.delete('/internships/:id', ctrl.deleteInternshipPosting);

// Internship Applications
router.get('/internship-applications', ctrl.listInternshipApplications);
router.post('/internship-applications', validate(createInternshipApplicationSchema), ctrl.createInternshipApplication);
router.put('/internship-applications/:id', validate(updateInternshipApplicationSchema), ctrl.updateInternshipApplication);
router.delete('/internship-applications/:id', ctrl.deleteInternshipApplication);

// Training
router.get('/trainings', ctrl.listPlacementTrainings);
router.post('/trainings', validate(createPlacementTrainingSchema), ctrl.createPlacementTraining);
router.put('/trainings/:id', validate(updatePlacementTrainingSchema), ctrl.updatePlacementTraining);
router.delete('/trainings/:id', ctrl.deletePlacementTraining);

// Training Attendance
router.get('/training-attendance', ctrl.listTrainingAttendance);
router.post('/training-attendance', validate(createTrainingAttendanceSchema), ctrl.createTrainingAttendance);
router.put('/training-attendance/:id', validate(updateTrainingAttendanceSchema), ctrl.updateTrainingAttendance);
router.delete('/training-attendance/:id', ctrl.deleteTrainingAttendance);

// Mock Interviews
router.get('/mock-interviews', ctrl.listMockInterviews);
router.post('/mock-interviews', validate(createMockInterviewSchema), ctrl.createMockInterview);
router.put('/mock-interviews/:id', validate(updateMockInterviewSchema), ctrl.updateMockInterview);
router.delete('/mock-interviews/:id', ctrl.deleteMockInterview);

// Higher Studies
router.get('/higher-studies', ctrl.listHigherStudiesApplications);
router.post('/higher-studies', validate(createHigherStudiesApplicationSchema), ctrl.createHigherStudiesApplication);
router.put('/higher-studies/:id', validate(updateHigherStudiesApplicationSchema), ctrl.updateHigherStudiesApplication);
router.delete('/higher-studies/:id', ctrl.deleteHigherStudiesApplication);

// Entrepreneur Profiles
router.get('/entrepreneurs', ctrl.listEntrepreneurProfiles);
router.post('/entrepreneurs', validate(createEntrepreneurProfileSchema), ctrl.createEntrepreneurProfile);
router.put('/entrepreneurs/:id', validate(updateEntrepreneurProfileSchema), ctrl.updateEntrepreneurProfile);
router.delete('/entrepreneurs/:id', ctrl.deleteEntrepreneurProfile);

// Alumni Profiles
router.get('/alumni-profiles', ctrl.listAlumniProfiles);
router.post('/alumni-profiles', validate(createAlumniProfileSchema), ctrl.createAlumniProfile);
router.put('/alumni-profiles/:id', validate(updateAlumniProfileSchema), ctrl.updateAlumniProfile);
router.delete('/alumni-profiles/:id', ctrl.deleteAlumniProfile);

// Alumni Events
router.get('/alumni-events', ctrl.listAlumniEvents);
router.post('/alumni-events', validate(createAlumniEventSchema), ctrl.createAlumniEvent);
router.put('/alumni-events/:id', validate(updateAlumniEventSchema), ctrl.updateAlumniEvent);
router.delete('/alumni-events/:id', ctrl.deleteAlumniEvent);

// Placement Reports
router.get('/reports', ctrl.listPlacementReports);
router.post('/reports', validate(createPlacementReportSchema), ctrl.createPlacementReport);
router.delete('/reports/:id', ctrl.deletePlacementReport);

export default router;
