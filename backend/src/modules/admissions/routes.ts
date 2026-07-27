import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createInquirySchema, updateInquirySchema,
  createApplicantSchema, updateApplicantSchema,
  convertInquirySchema,
  createExamScoreSchema, createCounselingSchema,
  createOfferSchema, updateOfferSchema,
  upsertDocChecklistSchema, createAdmissionSchema,
  createAssignmentRuleSchema, updateAssignmentRuleSchema, previewAssignmentRuleSchema,
  batchScoreSchema,
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
router.put('/enrollments/:id', authorize('admissions', 'update'), validate(createAdmissionSchema.partial()), ctrl.updateAdmission);

// ─── Strategic Gap 5 — AssignmentRule CRUD + preview ─────────────
// Static `/preview` path BEFORE the `/:id` route so it never gets
// matched as `:id="preview"`.
router.post('/assignment-rules/preview', authorize('admissions', 'read'), validate(previewAssignmentRuleSchema), ctrl.previewAssignmentRule);
router.get('/assignment-rules', authorize('admissions', 'read'), ctrl.listAssignmentRules);
router.post('/assignment-rules', authorize('admissions', 'create'), validate(createAssignmentRuleSchema), ctrl.createAssignmentRule);
router.get('/assignment-rules/:id', authorize('admissions', 'read'), ctrl.getAssignmentRule);
router.put('/assignment-rules/:id', authorize('admissions', 'update'), validate(updateAssignmentRuleSchema), ctrl.updateAssignmentRule);
router.delete('/assignment-rules/:id', authorize('admissions', 'delete'), ctrl.deleteAssignmentRule);

// ─── Strategic Gap 5 Phase B — CRM dashboard aggregations ─────────
router.get('/crm/pipeline', authorize('admissions', 'read'), ctrl.crmPipelineStats);
router.get('/crm/funnel',   authorize('admissions', 'read'), ctrl.crmFunnelStats);
router.get('/crm/officers', authorize('admissions', 'read'), ctrl.crmOfficerStats);
router.get('/crm/sources',  authorize('admissions', 'read'), ctrl.crmSourceStats);

// ─── 001-ai-lead-scoring ──────────────────────────────────────────
// Note: GET /lead-scoring/batch/:batchId is deferred — needs a persistent
// BatchRun model. For v1 the frontend polls inquiry.lastScoredAt instead.
router.post('/inquiries/:id/rescore', authorize('admissions', 'update'), ctrl.rescoreInquiry);
router.post('/lead-scoring/batch', authorize('admissions', 'update'), validate(batchScoreSchema), ctrl.batchScoreInquiries);
router.get('/lead-scoring/stats', authorize('admissions', 'read'), ctrl.leadScoringStats);

export default router;
