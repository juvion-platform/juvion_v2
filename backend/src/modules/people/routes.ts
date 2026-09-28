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
import * as studentImportCtrl from './student-import-controller';
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
  commitStudentImportSchema,
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
router.get('/students', authorize('people', 'read', { subDomain: 'students' }), ctrl.listStudents);

// ── Student bulk import ────────────────────────────────────
// people-gated facade over the shared import engine; see
// student-import-controller.ts for why this exists alongside
// /platform/bulk-imports. Static paths registered BEFORE
// /students/:id so Express doesn't swallow "import" as an :id.
router.get('/students/import/template', authorize('people', 'read', { subDomain: 'students' }), studentImportCtrl.templateHandler);
router.post(
  '/students/import/preview',
  authorize('people', 'create', { subDomain: 'students' }),
  studentImportCtrl.studentImportUpload.single('file'),
  studentImportCtrl.studentImportMulterErrorHandler,
  studentImportCtrl.previewHandler,
);
router.post(
  '/students/import/commit',
  authorize('people', 'create', { subDomain: 'students' }),
  validate(commitStudentImportSchema),
  studentImportCtrl.commitHandler,
);
// Read-only history: 'people','read' rather than 'create' — looking at what a
// past import did is not a write. Both are pinned to student jobs inside the
// controller, so this door never exposes the other four entity types.
// `/jobs` before `/jobs/:id`, and both before `/students/:id`, for the same
// static-vs-param reason as the paths above.
router.get('/students/import/jobs', authorize('people', 'read', { subDomain: 'students' }), studentImportCtrl.jobListHandler);
router.get('/students/import/jobs/:id', authorize('people', 'read', { subDomain: 'students' }), studentImportCtrl.jobDetailHandler);

router.get('/students/:id', authorize('people', 'read', { subDomain: 'students' }), ctrl.getStudent);
router.post('/students', authorize('people', 'create', { subDomain: 'students' }), validate(createStudentSchema), ctrl.createStudent);
router.put('/students/:id', authorize('people', 'update', { subDomain: 'students' }), validate(updateStudentSchema), ctrl.updateStudent);
router.delete('/students/:id', authorize('people', 'delete', { subDomain: 'students' }), ctrl.deleteStudent);

// Student photos — multipart upload + presigned-url fetch
// (multer error handler installed BETWEEN upload middleware and the
// handler so size / mime errors map cleanly to AppError(400)).
router.post(
  '/students/:id/photo',
  authorize('people', 'update', { subDomain: 'students' }),
  photoUpload.single('file'),
  multerErrorHandler,
  uploadPhotoHandler,
);
router.delete(
  '/students/:id/photo',
  authorize('people', 'update', { subDomain: 'students' }),
  deletePhotoHandler,
);
router.get(
  '/students/:id/photo-url',
  authorize('people', 'read', { subDomain: 'students' }),
  getPhotoUrlHandler,
);

// Faculty
router.get('/faculty', authorize('people', 'read', { subDomain: 'faculty' }), ctrl.listFaculty);
router.get('/faculty/:id', authorize('people', 'read', { subDomain: 'faculty' }), ctrl.getFaculty);
router.post('/faculty', authorize('people', 'create', { subDomain: 'faculty' }), validate(createFacultySchema), ctrl.createFaculty);
router.put('/faculty/:id', authorize('people', 'update', { subDomain: 'faculty' }), validate(updateFacultySchema), ctrl.updateFaculty);
router.delete('/faculty/:id', authorize('people', 'delete', { subDomain: 'faculty' }), ctrl.deleteFaculty);

// Faculty photos — multipart upload + presigned-url fetch
// (multer error handler installed BETWEEN upload middleware and the
// handler so size / mime errors map cleanly to AppError(400)).
router.post(
  '/faculty/:id/photo',
  authorize('people', 'update', { subDomain: 'faculty' }),
  photoUpload.single('file'),
  multerErrorHandler,
  facultyPhotoHandlers.upload,
);
router.delete(
  '/faculty/:id/photo',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyPhotoHandlers.remove,
);
router.get(
  '/faculty/:id/photo-url',
  authorize('people', 'read', { subDomain: 'faculty' }),
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
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyDocCtrl.listPendingFacultyDocumentsHandler,
);
// Bulk verify endpoints — also under a non-parameterised prefix so
// they never collide with /faculty/:facultyId/documents/:docId.
router.post(
  '/faculty-documents/bulk-approve',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyDocCtrl.bulkApproveFacultyDocumentsHandler,
);
router.post(
  '/faculty-documents/bulk-reject',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyDocCtrl.bulkRejectFacultyDocumentsHandler,
);
router.post(
  '/faculty/:facultyId/documents/:docId/approve',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyDocCtrl.approveFacultyDocumentHandler,
);
router.post(
  '/faculty/:facultyId/documents/:docId/reject',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyDocCtrl.rejectFacultyDocumentHandler,
);
router.get(
  '/faculty/:facultyId/documents/:docId/audit',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyDocCtrl.getFacultyDocumentAuditHandler,
);
router.get(
  '/faculty/:facultyId/documents',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyDocCtrl.listFacultyDocumentsHandler,
);
router.post(
  '/faculty/:facultyId/documents',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyDocCtrl.documentUpload.single('file'),
  facultyDocCtrl.documentMulterErrorHandler,
  facultyDocCtrl.uploadFacultyDocumentHandler,
);
router.get(
  '/faculty/:facultyId/documents/:docId',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyDocCtrl.getFacultyDocumentHandler,
);
router.get(
  '/faculty/:facultyId/documents/:docId/view',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyDocCtrl.getFacultyDocumentViewUrlHandler,
);
router.patch(
  '/faculty/:facultyId/documents/:docId',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyDocCtrl.updateFacultyDocumentHandler,
);
router.delete(
  '/faculty/:facultyId/documents/:docId',
  authorize('people', 'delete', { subDomain: 'faculty' }),
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
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.subjectHandlers.list,
);
router.post(
  '/faculty/:facultyId/subjects',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.subjectHandlers.create,
);
router.get(
  '/faculty/:facultyId/subjects/:id',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.subjectHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/subjects/:id',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.subjectHandlers.update,
);
router.delete(
  '/faculty/:facultyId/subjects/:id',
  authorize('people', 'delete', { subDomain: 'faculty' }),
  facultyTeachingCtrl.subjectHandlers.archive,
);

// Research scholars guided
router.get(
  '/faculty/:facultyId/scholars',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.scholarHandlers.list,
);
router.post(
  '/faculty/:facultyId/scholars',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.scholarHandlers.create,
);
router.get(
  '/faculty/:facultyId/scholars/:id',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.scholarHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/scholars/:id',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.scholarHandlers.update,
);
router.delete(
  '/faculty/:facultyId/scholars/:id',
  authorize('people', 'delete', { subDomain: 'faculty' }),
  facultyTeachingCtrl.scholarHandlers.archive,
);

// Books authored / edited
router.get(
  '/faculty/:facultyId/books',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.bookHandlers.list,
);
router.post(
  '/faculty/:facultyId/books',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.bookHandlers.create,
);
router.get(
  '/faculty/:facultyId/books/:id',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.bookHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/books/:id',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.bookHandlers.update,
);
router.delete(
  '/faculty/:facultyId/books/:id',
  authorize('people', 'delete', { subDomain: 'faculty' }),
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
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.publicationHandlers.list,
);
router.post(
  '/faculty/:facultyId/publications',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.publicationHandlers.create,
);
router.get(
  '/faculty/:facultyId/publications/:id',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.publicationHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/publications/:id',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.publicationHandlers.update,
);
router.delete(
  '/faculty/:facultyId/publications/:id',
  authorize('people', 'delete', { subDomain: 'faculty' }),
  facultyTeachingCtrl.publicationHandlers.archive,
);

// Patents
router.get(
  '/faculty/:facultyId/patents',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.patentHandlers.list,
);
router.post(
  '/faculty/:facultyId/patents',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.patentHandlers.create,
);
router.get(
  '/faculty/:facultyId/patents/:id',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.patentHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/patents/:id',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.patentHandlers.update,
);
router.delete(
  '/faculty/:facultyId/patents/:id',
  authorize('people', 'delete', { subDomain: 'faculty' }),
  facultyTeachingCtrl.patentHandlers.archive,
);

// Projects
router.get(
  '/faculty/:facultyId/projects',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.projectHandlers.list,
);
router.post(
  '/faculty/:facultyId/projects',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.projectHandlers.create,
);
router.get(
  '/faculty/:facultyId/projects/:id',
  authorize('people', 'read', { subDomain: 'faculty' }),
  facultyTeachingCtrl.projectHandlers.getOne,
);
router.patch(
  '/faculty/:facultyId/projects/:id',
  authorize('people', 'update', { subDomain: 'faculty' }),
  facultyTeachingCtrl.projectHandlers.update,
);
router.delete(
  '/faculty/:facultyId/projects/:id',
  authorize('people', 'delete', { subDomain: 'faculty' }),
  facultyTeachingCtrl.projectHandlers.archive,
);

// Staff
router.get('/staff', authorize('people', 'read', { subDomain: 'staff' }), ctrl.listStaff);
router.get('/staff/:id', authorize('people', 'read', { subDomain: 'staff' }), ctrl.getStaff);
router.post('/staff', authorize('people', 'create', { subDomain: 'staff' }), validate(createStaffSchema), ctrl.createStaff);
router.put('/staff/:id', authorize('people', 'update', { subDomain: 'staff' }), validate(updateStaffSchema), ctrl.updateStaff);
router.delete('/staff/:id', authorize('people', 'delete', { subDomain: 'staff' }), ctrl.deleteStaff);

// Staff photos — multipart upload + presigned-url fetch
router.post(
  '/staff/:id/photo',
  authorize('people', 'update', { subDomain: 'staff' }),
  photoUpload.single('file'),
  multerErrorHandler,
  staffPhotoHandlers.upload,
);
router.delete(
  '/staff/:id/photo',
  authorize('people', 'update', { subDomain: 'staff' }),
  staffPhotoHandlers.remove,
);
router.get(
  '/staff/:id/photo-url',
  authorize('people', 'read', { subDomain: 'staff' }),
  staffPhotoHandlers.getUrl,
);

// Parents
router.get('/parents', authorize('people', 'read', { subDomain: 'parents' }), ctrl.listParents);
router.get('/parents/:id', authorize('people', 'read', { subDomain: 'parents' }), ctrl.getParent);
router.post('/parents', authorize('people', 'create', { subDomain: 'parents' }), validate(createParentSchema), ctrl.createParent);
router.put('/parents/:id', authorize('people', 'update', { subDomain: 'parents' }), validate(updateParentSchema), ctrl.updateParent);
router.delete('/parents/:id', authorize('people', 'delete', { subDomain: 'parents' }), ctrl.deleteParent);

// Parent photos — multipart upload + presigned-url fetch
router.post(
  '/parents/:id/photo',
  authorize('people', 'update', { subDomain: 'parents' }),
  photoUpload.single('file'),
  multerErrorHandler,
  parentPhotoHandlers.upload,
);
router.delete(
  '/parents/:id/photo',
  authorize('people', 'update', { subDomain: 'parents' }),
  parentPhotoHandlers.remove,
);
router.get(
  '/parents/:id/photo-url',
  authorize('people', 'read', { subDomain: 'parents' }),
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
router.get('/students/:id/exit-summary', authorize('people', 'read', { subDomain: 'students' }), ctrl.getExitSummaryCtrl);
router.post('/students/:id/exit-request', authorize('people', 'create', { subDomain: 'students' }), validate(submitExitRequestSchema), ctrl.submitExitRequestCtrl);
router.get('/exit-requests', authorize('people', 'read'), ctrl.listExitRequestsCtrl);
router.get('/exit-requests/:id', authorize('people', 'read'), ctrl.getExitRequestCtrl);
router.put('/exit-requests/:id/approve', authorize('people', 'update'), validate(approveExitRequestSchema), ctrl.approveExitRequestCtrl);
router.put('/exit-requests/:id/reject', authorize('people', 'update'), validate(rejectExitRequestSchema), ctrl.rejectExitRequestCtrl);
router.put('/exit-requests/:id/cancel', authorize('people', 'update'), ctrl.cancelExitRequestCtrl);

// ── Student Lifecycle ──────────────────────────────────────
router.post('/students/:id/transition', authorize('people', 'update', { subDomain: 'students' }), validate(transitionStudentSchema), ctrl.transitionStudentCtrl);
router.post('/students/:id/check-graduation-eligibility', authorize('people', 'read', { subDomain: 'students' }), ctrl.checkGraduationEligibilityCtrl);
router.post('/students/:id/seal', authorize('people', 'update', { subDomain: 'students' }), ctrl.sealStudentRecordCtrl);

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
