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
import * as facultyDocCtrl from './faculty-document-controller';
import * as facultyTeachingCtrl from './faculty-teaching-controller';
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

// ─── Faculty credential documents (Strategic Gap 1 Phase B) ──────────
// Generic credential-evidence store: PhD certificate, PAN, experience
// certs, FDP certificates, awards, etc. — all 12 categories share this
// surface. Phase B2 ships CRUD + view-URL; Phase B3 (now) ships the
// verification workflow.
//
// Pending-queue endpoint at a non-parameterised path so it never
// collides with /faculty/:facultyId/documents/:docId routing.
router.get(
  '/faculty-document-queue',
  authorize('people', 'read'),
  facultyDocCtrl.listPendingFacultyDocumentsHandler,
);
// Bulk verify endpoints — also under a non-parameterised prefix so
// they never collide with /faculty/:facultyId/documents/:docId.
router.post(
  '/faculty-documents/bulk-approve',
  authorize('people', 'update'),
  facultyDocCtrl.bulkApproveFacultyDocumentsHandler,
);
router.post(
  '/faculty-documents/bulk-reject',
  authorize('people', 'update'),
  facultyDocCtrl.bulkRejectFacultyDocumentsHandler,
);
router.post(
  '/faculty/:facultyId/documents/:docId/approve',
  authorize('people', 'update'),
  facultyDocCtrl.approveFacultyDocumentHandler,
);
router.post(
  '/faculty/:facultyId/documents/:docId/reject',
  authorize('people', 'update'),
  facultyDocCtrl.rejectFacultyDocumentHandler,
);
router.get(
  '/faculty/:facultyId/documents/:docId/audit',
  authorize('people', 'read'),
  facultyDocCtrl.getFacultyDocumentAuditHandler,
);
router.get(
  '/faculty/:facultyId/documents',
  authorize('people', 'read'),
  facultyDocCtrl.listFacultyDocumentsHandler,
);
router.post(
  '/faculty/:facultyId/documents',
  authorize('people', 'update'),
  facultyDocCtrl.documentUpload.single('file'),
  facultyDocCtrl.documentMulterErrorHandler,
  facultyDocCtrl.uploadFacultyDocumentHandler,
);
router.get(
  '/faculty/:facultyId/documents/:docId',
  authorize('people', 'read'),
  facultyDocCtrl.getFacultyDocumentHandler,
);
router.get(
  '/faculty/:facultyId/documents/:docId/view',
  authorize('people', 'read'),
  facultyDocCtrl.getFacultyDocumentViewUrlHandler,
);
router.patch(
  '/faculty/:facultyId/documents/:docId',
  authorize('people', 'update'),
  facultyDocCtrl.updateFacultyDocumentHandler,
);
router.delete(
  '/faculty/:facultyId/documents/:docId',
  authorize('people', 'delete'),
  facultyDocCtrl.archiveFacultyDocumentHandler,
);

// ─── Faculty teaching & research sub-collections (Phase D) ───────────
// Three sub-collections per faculty member, each with identical CRUD
// shape:
//   /faculty/:facultyId/subjects   — NAAC 2.2 / 2.6 (what they teach)
//   /faculty/:facultyId/scholars   — NAAC 3.4.2 (PhDs / M.Tech guided)
//   /faculty/:facultyId/books      — NAAC 3.3 (books authored / edited)
// No verification workflow — these are institution-self-certified rows.

// Subjects taught
router.get(
  '/faculty/:facultyId/subjects',
  authorize('people', 'read'),
  facultyTeachingCtrl.subjectHandlers.list,
);
router.post(
  '/faculty/:facultyId/subjects',
  authorize('people', 'update'),
  facultyTeachingCtrl.subjectHandlers.create,
);
router.get(
  '/faculty/:facultyId/subjects/:id',
  authorize('people', 'read'),
  facultyTeachingCtrl.subjectHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/subjects/:id',
  authorize('people', 'update'),
  facultyTeachingCtrl.subjectHandlers.update,
);
router.delete(
  '/faculty/:facultyId/subjects/:id',
  authorize('people', 'delete'),
  facultyTeachingCtrl.subjectHandlers.archive,
);

// Research scholars guided
router.get(
  '/faculty/:facultyId/scholars',
  authorize('people', 'read'),
  facultyTeachingCtrl.scholarHandlers.list,
);
router.post(
  '/faculty/:facultyId/scholars',
  authorize('people', 'update'),
  facultyTeachingCtrl.scholarHandlers.create,
);
router.get(
  '/faculty/:facultyId/scholars/:id',
  authorize('people', 'read'),
  facultyTeachingCtrl.scholarHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/scholars/:id',
  authorize('people', 'update'),
  facultyTeachingCtrl.scholarHandlers.update,
);
router.delete(
  '/faculty/:facultyId/scholars/:id',
  authorize('people', 'delete'),
  facultyTeachingCtrl.scholarHandlers.archive,
);

// Books authored / edited
router.get(
  '/faculty/:facultyId/books',
  authorize('people', 'read'),
  facultyTeachingCtrl.bookHandlers.list,
);
router.post(
  '/faculty/:facultyId/books',
  authorize('people', 'update'),
  facultyTeachingCtrl.bookHandlers.create,
);
router.get(
  '/faculty/:facultyId/books/:id',
  authorize('people', 'read'),
  facultyTeachingCtrl.bookHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/books/:id',
  authorize('people', 'update'),
  facultyTeachingCtrl.bookHandlers.update,
);
router.delete(
  '/faculty/:facultyId/books/:id',
  authorize('people', 'delete'),
  facultyTeachingCtrl.bookHandlers.archive,
);

// ─── Faculty research outputs (Phase B — original spec) ──────────────
// Three NAAC-shaped collections under each faculty member:
//   /faculty/:facultyId/publications  — papers, conference + journal
//   /faculty/:facultyId/patents       — IP filings
//   /faculty/:facultyId/projects      — sponsored research
// Same 5-route CRUD shape per entity. NAAC criteria 3.1–3.4.

// Publications
router.get(
  '/faculty/:facultyId/publications',
  authorize('people', 'read'),
  facultyTeachingCtrl.publicationHandlers.list,
);
router.post(
  '/faculty/:facultyId/publications',
  authorize('people', 'update'),
  facultyTeachingCtrl.publicationHandlers.create,
);
router.get(
  '/faculty/:facultyId/publications/:id',
  authorize('people', 'read'),
  facultyTeachingCtrl.publicationHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/publications/:id',
  authorize('people', 'update'),
  facultyTeachingCtrl.publicationHandlers.update,
);
router.delete(
  '/faculty/:facultyId/publications/:id',
  authorize('people', 'delete'),
  facultyTeachingCtrl.publicationHandlers.archive,
);

// Patents
router.get(
  '/faculty/:facultyId/patents',
  authorize('people', 'read'),
  facultyTeachingCtrl.patentHandlers.list,
);
router.post(
  '/faculty/:facultyId/patents',
  authorize('people', 'update'),
  facultyTeachingCtrl.patentHandlers.create,
);
router.get(
  '/faculty/:facultyId/patents/:id',
  authorize('people', 'read'),
  facultyTeachingCtrl.patentHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/patents/:id',
  authorize('people', 'update'),
  facultyTeachingCtrl.patentHandlers.update,
);
router.delete(
  '/faculty/:facultyId/patents/:id',
  authorize('people', 'delete'),
  facultyTeachingCtrl.patentHandlers.archive,
);

// Projects
router.get(
  '/faculty/:facultyId/projects',
  authorize('people', 'read'),
  facultyTeachingCtrl.projectHandlers.list,
);
router.post(
  '/faculty/:facultyId/projects',
  authorize('people', 'update'),
  facultyTeachingCtrl.projectHandlers.create,
);
router.get(
  '/faculty/:facultyId/projects/:id',
  authorize('people', 'read'),
  facultyTeachingCtrl.projectHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/projects/:id',
  authorize('people', 'update'),
  facultyTeachingCtrl.projectHandlers.update,
);
router.delete(
  '/faculty/:facultyId/projects/:id',
  authorize('people', 'delete'),
  facultyTeachingCtrl.projectHandlers.archive,
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

// ─── Strategic Gap 7 — Persona catalog ─────────────────────────
// Read-only; any authenticated user can fetch the canonical persona
// list (UIs use it to render dropdowns). Source of truth is
// shared/rbac/personas.ts.
router.get('/personas', authorize('people', 'read'), ctrl.listPersonas);

export default router;
