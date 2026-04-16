import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { uploadPhoto } from '../../middleware/upload';
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
router.get('/stats', authorize('admissions', 'read'), ctrl.dashboardStats);

// Inquiries
router.get('/inquiries', authorize('admissions', 'read'), ctrl.listInquiries);
router.get('/inquiries/:id', authorize('admissions', 'read'), ctrl.getInquiry);
router.post('/inquiries', authorize('admissions', 'create'), validate(createInquirySchema), ctrl.createInquiry);
router.put('/inquiries/:id', authorize('admissions', 'update'), validate(updateInquirySchema), ctrl.updateInquiry);
router.delete('/inquiries/:id', authorize('admissions', 'delete'), ctrl.deleteInquiry);
router.post('/inquiries/:id/convert', authorize('admissions', 'create'), validate(convertInquirySchema), ctrl.convertInquiry);

// Applicants
router.get('/applicants', authorize('admissions', 'read'), ctrl.listApplicants);
router.get('/applicants/:id', authorize('admissions', 'read'), ctrl.getApplicant);
router.post('/applicants', authorize('admissions', 'create'), validate(createApplicantSchema), ctrl.createApplicant);
router.put('/applicants/:id', authorize('admissions', 'update'), validate(updateApplicantSchema), ctrl.updateApplicant);
router.post('/applicants/:id/photo', authorize('admissions', 'update'), uploadPhoto, ctrl.uploadApplicantPhoto);

// Entrance Exam Scores
router.get('/exam-scores', authorize('admissions', 'read'), ctrl.listExamScores);
router.post('/exam-scores', authorize('admissions', 'create'), validate(createExamScoreSchema), ctrl.createExamScore);
router.put('/exam-scores/:id', authorize('admissions', 'update'), validate(createExamScoreSchema.partial()), ctrl.updateExamScore);

// Counseling Allotments
router.get('/counseling', authorize('admissions', 'read'), ctrl.listCounselingAllotments);
router.post('/counseling', authorize('admissions', 'create'), validate(createCounselingSchema), ctrl.createCounselingAllotment);
router.put('/counseling/:id', authorize('admissions', 'update'), validate(createCounselingSchema.partial()), ctrl.updateCounselingAllotment);

// Admission Offers
router.get('/offers', authorize('admissions', 'read'), ctrl.listOffers);
router.post('/offers', authorize('admissions', 'create'), validate(createOfferSchema), ctrl.createOffer);
router.put('/offers/:id', authorize('admissions', 'update'), validate(updateOfferSchema), ctrl.updateOffer);

// Document Checklists
router.get('/documents', authorize('admissions', 'read'), ctrl.listDocumentChecklists);
router.get('/documents/:applicantId', authorize('admissions', 'read'), ctrl.getDocumentChecklist);
router.put('/documents/:applicantId', authorize('admissions', 'update'), validate(upsertDocChecklistSchema), ctrl.upsertDocumentChecklist);

// Admissions (Final)
router.get('/enrollments', authorize('admissions', 'read'), ctrl.listAdmissions);
router.get('/enrollments/:id', authorize('admissions', 'read'), ctrl.getAdmission);
router.post('/enrollments', authorize('admissions', 'create'), validate(createAdmissionSchema), ctrl.createAdmission);

export default router;
