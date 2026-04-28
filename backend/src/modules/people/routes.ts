import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createUserRateLimit } from '../../middleware/rateLimitPerUser';
import * as ctrl from './controller';
import {
  photoUpload,
  multerErrorHandler,
  // Existing student handlers (compat shims pointing at studentPhotoHandlers).
  uploadPhotoHandler,
  deletePhotoHandler,
  getPhotoUrlHandler,
  // G3 — per-entity handler bundles for faculty/staff/parents.
  facultyPhotoHandlers,
  staffPhotoHandlers,
  parentPhotoHandlers,
} from './photo-controller';
import { searchPeopleController } from './search-controller';
import { searchQuerySchema } from './search-validation';
import {
  createPersonSchema, updatePersonSchema,
  createStudentSchema, updateStudentSchema,
  createFacultySchema, updateFacultySchema,
  createStaffSchema, updateStaffSchema,
  createParentSchema, updateParentSchema,
  createOrganizationSchema, updateOrganizationSchema,
  // W10 exit workflow schemas
  submitExitRequestSchema, approveExitRequestSchema, rejectExitRequestSchema,
  transitionStudentSchema, initiateClearanceSchema,
  completeClearanceItemSchema, waiveClearanceItemSchema, logEscalationSchema,
  createDocumentTemplateSchema_wf, generateDocumentSchema, signDocumentSchema,
  issueDocumentSchema, revokeDocumentSchema, createAlumniRecordSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Global people search — per-user rate-limited. Route is placed BEFORE
// the `/persons/:id` pattern so "search" isn't captured as an ID.
router.get(
  '/search',
  authorize('people', 'read'),
  createUserRateLimit({ max: 60, windowMs: 60_000 }),
  validate(searchQuerySchema, 'query'),
  searchPeopleController,
);

// Dashboard
router.get('/stats', authorize('people', 'read'), ctrl.dashboardStats);

// Persons
router.get('/persons', authorize('people', 'read'), ctrl.listPersons);
router.get('/persons/:id', authorize('people', 'read'), ctrl.getPerson);
router.post('/persons', authorize('people', 'create'), validate(createPersonSchema), ctrl.createPerson);
router.put('/persons/:id', authorize('people', 'update'), validate(updatePersonSchema), ctrl.updatePerson);
router.delete('/persons/:id', authorize('people', 'delete'), ctrl.deletePerson);

// Students
router.get('/students', authorize('people', 'read'), ctrl.listStudents);
router.get('/students/:id', authorize('people', 'read'), ctrl.getStudent);
router.post('/students', authorize('people', 'create'), validate(createStudentSchema), ctrl.createStudent);
router.put('/students/:id', authorize('people', 'update'), validate(updateStudentSchema), ctrl.updateStudent);
router.delete('/students/:id', authorize('people', 'delete'), ctrl.deleteStudent);

// Student photos — multipart upload + presigned-url fetch
// (multer error handler installed BETWEEN upload middleware and the
// handler so size / mime errors map cleanly to AppError(400)).
router.post(
  '/students/:id/photo',
  authorize('people', 'update'),
  photoUpload.single('file'),
  multerErrorHandler,
  uploadPhotoHandler,
);
router.delete(
  '/students/:id/photo',
  authorize('people', 'update'),
  deletePhotoHandler,
);
router.get(
  '/students/:id/photo-url',
  authorize('people', 'read'),
  getPhotoUrlHandler,
);

// Faculty
router.get('/faculty', authorize('people', 'read'), ctrl.listFaculty);
router.get('/faculty/:id', authorize('people', 'read'), ctrl.getFaculty);
router.post('/faculty', authorize('people', 'create'), validate(createFacultySchema), ctrl.createFaculty);
router.put('/faculty/:id', authorize('people', 'update'), validate(updateFacultySchema), ctrl.updateFaculty);
router.delete('/faculty/:id', authorize('people', 'delete'), ctrl.deleteFaculty);

// Faculty photos — multipart upload + presigned-url fetch
// (multer error handler installed BETWEEN upload middleware and the
// handler so size / mime errors map cleanly to AppError(400)).
router.post(
  '/faculty/:id/photo',
  authorize('people', 'update'),
  photoUpload.single('file'),
  multerErrorHandler,
  facultyPhotoHandlers.upload,
);
router.delete(
  '/faculty/:id/photo',
  authorize('people', 'update'),
  facultyPhotoHandlers.remove,
);
router.get(
  '/faculty/:id/photo-url',
  authorize('people', 'read'),
  facultyPhotoHandlers.getUrl,
);

// Staff
router.get('/staff', authorize('people', 'read'), ctrl.listStaff);
router.get('/staff/:id', authorize('people', 'read'), ctrl.getStaff);
router.post('/staff', authorize('people', 'create'), validate(createStaffSchema), ctrl.createStaff);
router.put('/staff/:id', authorize('people', 'update'), validate(updateStaffSchema), ctrl.updateStaff);
router.delete('/staff/:id', authorize('people', 'delete'), ctrl.deleteStaff);

// Staff photos — multipart upload + presigned-url fetch
router.post(
  '/staff/:id/photo',
  authorize('people', 'update'),
  photoUpload.single('file'),
  multerErrorHandler,
  staffPhotoHandlers.upload,
);
router.delete(
  '/staff/:id/photo',
  authorize('people', 'update'),
  staffPhotoHandlers.remove,
);
router.get(
  '/staff/:id/photo-url',
  authorize('people', 'read'),
  staffPhotoHandlers.getUrl,
);

// Parents
router.get('/parents', authorize('people', 'read'), ctrl.listParents);
router.get('/parents/:id', authorize('people', 'read'), ctrl.getParent);
router.post('/parents', authorize('people', 'create'), validate(createParentSchema), ctrl.createParent);
router.put('/parents/:id', authorize('people', 'update'), validate(updateParentSchema), ctrl.updateParent);
router.delete('/parents/:id', authorize('people', 'delete'), ctrl.deleteParent);

// Parent photos — multipart upload + presigned-url fetch
router.post(
  '/parents/:id/photo',
  authorize('people', 'update'),
  photoUpload.single('file'),
  multerErrorHandler,
  parentPhotoHandlers.upload,
);
router.delete(
  '/parents/:id/photo',
  authorize('people', 'update'),
  parentPhotoHandlers.remove,
);
router.get(
  '/parents/:id/photo-url',
  authorize('people', 'read'),
  parentPhotoHandlers.getUrl,
);

// Organizations
router.get('/organizations', authorize('people', 'read'), ctrl.listOrganizations);
router.get('/organizations/:id', authorize('people', 'read'), ctrl.getOrganization);
router.post('/organizations', authorize('people', 'create'), validate(createOrganizationSchema), ctrl.createOrganization);
router.put('/organizations/:id', authorize('people', 'update'), validate(updateOrganizationSchema), ctrl.updateOrganization);
router.delete('/organizations/:id', authorize('people', 'delete'), ctrl.deleteOrganization);

// ═══ W10 Exit Workflow Routes ═══════════════════════════════

// ── Exit Requests ──────────────────────────────────────────
router.get('/students/:id/exit-summary', authorize('people', 'read'), ctrl.getExitSummaryCtrl);
router.post('/students/:id/exit-request', authorize('people', 'create'), validate(submitExitRequestSchema), ctrl.submitExitRequestCtrl);
router.get('/exit-requests', authorize('people', 'read'), ctrl.listExitRequestsCtrl);
router.get('/exit-requests/:id', authorize('people', 'read'), ctrl.getExitRequestCtrl);
router.put('/exit-requests/:id/approve', authorize('people', 'update'), validate(approveExitRequestSchema), ctrl.approveExitRequestCtrl);
router.put('/exit-requests/:id/reject', authorize('people', 'update'), validate(rejectExitRequestSchema), ctrl.rejectExitRequestCtrl);
router.put('/exit-requests/:id/cancel', authorize('people', 'update'), ctrl.cancelExitRequestCtrl);

// ── Student Lifecycle ──────────────────────────────────────
router.post('/students/:id/transition', authorize('people', 'update'), validate(transitionStudentSchema), ctrl.transitionStudentCtrl);
router.post('/students/:id/check-graduation-eligibility', authorize('people', 'read'), ctrl.checkGraduationEligibilityCtrl);
router.post('/students/:id/seal', authorize('people', 'update'), ctrl.sealStudentRecordCtrl);

// ── Clearance ──────────────────────────────────────────────
router.get('/clearance-dashboard', authorize('people', 'read'), ctrl.getClearanceDashboardCtrl);
router.get('/clearance-items/pending', authorize('people', 'read'), ctrl.listPendingClearanceItemsCtrl);
router.post('/clearance-workflows', authorize('people', 'create'), validate(initiateClearanceSchema), ctrl.initiateClearanceCtrl);
router.get('/clearance-workflows', authorize('people', 'read'), ctrl.listClearanceWorkflowsCtrl);
router.get('/clearance-workflows/:id', authorize('people', 'read'), ctrl.getClearanceWorkflowCtrl);
router.put('/clearance-items/:id/complete', authorize('people', 'update'), validate(completeClearanceItemSchema), ctrl.completeClearanceItemCtrl);
router.put('/clearance-items/:id/waive', authorize('people', 'update'), validate(waiveClearanceItemSchema), ctrl.waiveClearanceItemCtrl);
router.post('/escalation-logs', authorize('people', 'create'), validate(logEscalationSchema), ctrl.logEscalationCtrl);

// ── Documents ──────────────────────────────────────────────
router.get('/document-templates', authorize('people', 'read'), ctrl.listDocumentTemplatesCtrl);
router.get('/document-templates/:id', authorize('people', 'read'), ctrl.getDocumentTemplateCtrl);
router.post('/document-templates', authorize('people', 'create'), validate(createDocumentTemplateSchema_wf), ctrl.createDocumentTemplateCtrl);
router.post('/documents/generate', authorize('people', 'create'), validate(generateDocumentSchema), ctrl.generateDocumentCtrl);
router.put('/documents/:id/sign', authorize('people', 'update'), validate(signDocumentSchema), ctrl.signDocumentCtrl);
router.post('/documents/:id/issue', authorize('people', 'update'), validate(issueDocumentSchema), ctrl.issueDocumentCtrl);
router.put('/documents/:id/revoke', authorize('people', 'update'), validate(revokeDocumentSchema), ctrl.revokeDocumentCtrl);

// ── Alumni ─────────────────────────────────────────────────
router.get('/alumni', authorize('people', 'read'), ctrl.listAlumniCtrl);
router.get('/alumni/:id', authorize('people', 'read'), ctrl.getAlumniCtrl);
router.post('/alumni', authorize('people', 'create'), validate(createAlumniRecordSchema), ctrl.createAlumniRecordCtrl);

export default router;
