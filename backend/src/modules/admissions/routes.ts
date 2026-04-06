import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createInquirySchema, updateInquirySchema,
  createApplicantSchema, updateApplicantSchema,
  convertInquirySchema,
  createExamScoreSchema, createCounselingSchema,
  createOfferSchema, updateOfferSchema,
  upsertDocChecklistSchema, createAdmissionSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// Inquiries
router.get('/inquiries', ctrl.listInquiries);
router.get('/inquiries/:id', ctrl.getInquiry);
router.post('/inquiries', validate(createInquirySchema), ctrl.createInquiry);
router.put('/inquiries/:id', validate(updateInquirySchema), ctrl.updateInquiry);
router.delete('/inquiries/:id', ctrl.deleteInquiry);
router.post('/inquiries/:id/convert', validate(convertInquirySchema), ctrl.convertInquiry);

// Applicants
router.get('/applicants', ctrl.listApplicants);
router.get('/applicants/:id', ctrl.getApplicant);
router.post('/applicants', validate(createApplicantSchema), ctrl.createApplicant);
router.put('/applicants/:id', validate(updateApplicantSchema), ctrl.updateApplicant);

// Entrance Exam Scores
router.get('/exam-scores', ctrl.listExamScores);
router.post('/exam-scores', validate(createExamScoreSchema), ctrl.createExamScore);
router.put('/exam-scores/:id', validate(createExamScoreSchema.partial()), ctrl.updateExamScore);

// Counseling Allotments
router.get('/counseling', ctrl.listCounselingAllotments);
router.post('/counseling', validate(createCounselingSchema), ctrl.createCounselingAllotment);
router.put('/counseling/:id', validate(createCounselingSchema.partial()), ctrl.updateCounselingAllotment);

// Admission Offers
router.get('/offers', ctrl.listOffers);
router.post('/offers', validate(createOfferSchema), ctrl.createOffer);
router.put('/offers/:id', validate(updateOfferSchema), ctrl.updateOffer);

// Document Checklists
router.get('/documents', ctrl.listDocumentChecklists);
router.get('/documents/:applicantId', ctrl.getDocumentChecklist);
router.put('/documents/:applicantId', validate(upsertDocChecklistSchema), ctrl.upsertDocumentChecklist);

// Admissions (Final)
router.get('/enrollments', ctrl.listAdmissions);
router.get('/enrollments/:id', ctrl.getAdmission);
router.post('/enrollments', validate(createAdmissionSchema), ctrl.createAdmission);

export default router;
