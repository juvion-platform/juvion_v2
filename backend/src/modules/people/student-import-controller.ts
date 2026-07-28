/**
 * People-gated facade over the shared bulk-import engine, scoped to students.
 *
 * Exists because only admin and principal hold platform:create (see
 * shared/rbac/defaults.ts), so a Registrar — who owns student data — gets a
 * 403 from /platform/bulk-imports. These routes are authorize('people', ...)
 * and delegate to the same service, so there is still one import engine.
 *
 * The multer instance (`studentImportUpload`) and its error mapper are
 * REUSED from the platform door's bulk-import-controller rather than
 * re-declared here, so both doors enforce the identical 10 MB cap and
 * CSV-only fileFilter — inventing a second multer config would let the two
 * doors drift out of sync.
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import {
  uploadAndValidate, commitImportJob, getImportJob,
} from '../platform/bulk-import-service';
import { getImportSchema, serializeSchema } from '../platform/bulk-import-registry';
import { importFileUpload, importMulterErrorHandler } from '../platform/bulk-import-controller';

const ENTITY_TYPE = 'student';
/**
 * Cap on the per-row detail returned to the drawer. A 10,000-row import that
 * fails wholesale must not put 10,000 messages on the wire; the counts are
 * always exact and the job keeps the full record.
 */
const FAILED_ROW_LIMIT = 100;

export const studentImportUpload = importFileUpload;
export { importMulterErrorHandler as studentImportMulterErrorHandler };

export async function templateHandler(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const def = getImportSchema(ENTITY_TYPE);
    if (!def) throw new AppError(500, 'Student import schema is not registered.');
    // Reuse the registry's own serializer instead of hand-rolling the same
    // field-mapping here — keeps this response byte-for-byte identical to
    // /platform/bulk-imports' schema listing, with one source of truth for
    // "what does a schema look like over the wire".
    res.json(serializeSchema(def));
  } catch (e) { next(e); }
}

export async function previewHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded. Attach a .csv as "file".');
    const preview = await uploadAndValidate({
      collegeId: req.collegeId!,
      performedBy: req.user?.name ?? 'System',
      entityType: ENTITY_TYPE,
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      declaredMime: req.file.mimetype,
    });
    res.status(201).json(preview);
  } catch (e) { next(e); }
}

export async function commitHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.body as { jobId?: string };
    if (!jobId) throw new AppError(400, 'jobId is required.');

    // previewHandler pins entityType to the constant; this handler must too.
    // commitImportJob -> getImportJob scopes by collegeId and archivedAt and
    // then dispatches on job.entityType, so without this a caller holding
    // people:create and nothing else could commit a pending faculty / staff /
    // applicant / programme job an admin left in preview_ready — writing
    // through createFaculty or createProgramme on a route gated for people.
    // That inverts the entire justification for this facade.
    //
    // getImportJob is also the college check: it 404s a job belonging to
    // another tenant, so loading here rather than trusting the id is
    // load-bearing twice over. 404 rather than 403 — a wrong-type job should
    // not be confirmed to exist through this door.
    const job = await getImportJob(req.collegeId!, jobId);
    if (job.entityType !== ENTITY_TYPE) throw new AppError(404, 'Import job not found');

    const committed = await commitImportJob(req.collegeId!, jobId, req.user?.name ?? 'System');

    // A trimmed summary, not the whole IImportJob. The document carries every
    // row's raw input and the full schema snapshot — megabytes on a large
    // import — and the drawer only needs to tell the operator what happened.
    // Per-row commit failures land on the job, and a Registrar cannot open
    // /platform/bulk-imports to read it, so the failed rows have to travel
    // with the response or they are invisible to the only persona that can
    // reach this door.
    res.json({
      jobId: String(committed._id),
      status: committed.status,
      totalRows: committed.totalRows,
      successCount: committed.successCount,
      failureCount: committed.failureCount,
      blockedCount: committed.blockedCount,
      errorSummary: committed.errorSummary,
      failedRows: committed.results
        .filter((r) => r.outcome === 'error')
        .slice(0, FAILED_ROW_LIMIT)
        .map((r) => ({ row: r.row, error: r.error ?? 'commit failed' })),
      blockedRows: committed.results
        .filter((r) => r.outcome === 'blocked')
        .slice(0, FAILED_ROW_LIMIT)
        .map((r) => ({ row: r.row, reason: r.notes?.join(' ') ?? 'blocked' })),
    });
  } catch (e) { next(e); }
}
