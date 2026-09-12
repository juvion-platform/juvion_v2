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
  uploadAndValidate, commitImportJob, getImportJob, listImportJobs,
} from '../platform/bulk-import-service';
import type { IImportJob } from '../../models/platform/ImportJob';
import { getImportSchema, serializeSchema } from '../platform/bulk-import-registry';
import { importFileUpload, importMulterErrorHandler } from '../platform/bulk-import-controller';

const ENTITY_TYPE = 'student';
/**
 * Cap on the per-row detail returned to the drawer. A 10,000-row import that
 * fails wholesale must not put 10,000 messages on the wire; the counts are
 * always exact and the job keeps the full record.
 */
const FAILED_ROW_LIMIT = 100;
/** Default page size for the drawer's "recent imports" list. */
const JOB_LIST_LIMIT = 10;

/**
 * The wire shape for one finished job, shared by `commitHandler` and
 * `jobDetailHandler`.
 *
 * Extracted so the two cannot drift: the drawer renders the commit response
 * and a re-opened job through the same code, so a field added to one and not
 * the other would silently render blank on whichever path the operator took.
 *
 * Deliberately NOT the raw `IImportJob`. That document carries every row's raw
 * input plus the full schema snapshot — megabytes on a large import — and the
 * per-row detail is capped, since a 10,000-row wholesale failure must not put
 * 10,000 messages on the wire. Counts are always exact; `truncated` tells the
 * reader when the row lists are partial rather than leaving them to infer it
 * from a suspiciously round number.
 */
function jobSummary(job: IImportJob) {
  const failed = job.results.filter((r) => r.outcome === 'error');
  const blocked = job.results.filter((r) => r.outcome === 'blocked');
  const skipped = job.results.filter((r) => r.outcome === 'skipped');
  return {
    jobId: String(job._id),
    fileName: job.fileName,
    status: job.status,
    totalRows: job.totalRows,
    successCount: job.successCount,
    failureCount: job.failureCount,
    blockedCount: job.blockedCount,
    skippedCount: job.skippedCount,
    errorSummary: job.errorSummary,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    failedRows: failed
      .slice(0, FAILED_ROW_LIMIT)
      .map((r) => ({ row: r.row, error: r.error ?? 'commit failed' })),
    blockedRows: blocked
      .slice(0, FAILED_ROW_LIMIT)
      .map((r) => ({ row: r.row, reason: r.notes?.join(' ') ?? 'blocked' })),
    skippedRows: skipped
      .slice(0, FAILED_ROW_LIMIT)
      .map((r) => ({ row: r.row, reason: r.notes?.join(' ') ?? 'skipped' })),
    truncated: failed.length > FAILED_ROW_LIMIT || blocked.length > FAILED_ROW_LIMIT || skipped.length > FAILED_ROW_LIMIT,
    // Travels with the response for the same reason the failed rows do: a
    // Registrar holds no platform:read and cannot open the job afterwards, so
    // a student left unpinned is invisible to them unless it is here.
    pinSummary: job.pinSummary
      ? {
        ...job.pinSummary,
        unpinnedRows: job.results
          .filter((r) => r.pinOutcome && r.pinOutcome.kind !== 'pinned'
            && r.pinOutcome.kind !== 'already-pinned')
          .slice(0, FAILED_ROW_LIMIT)
          .map((r) => ({
            row: r.row,
            reason: r.pinOutcome?.message ?? r.pinOutcome?.kind ?? 'not pinned',
          })),
      }
      : undefined,
  };
}

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
    // Optional multipart field. Supplying it is how a cohort is loaded ahead
    // of the year it belongs to; omitted means the college's current year.
    const { academicYearId } = req.body as { academicYearId?: string };
    const preview = await uploadAndValidate({
      collegeId: req.collegeId!,
      performedBy: req.user?.name ?? 'System',
      entityType: ENTITY_TYPE,
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      declaredMime: req.file.mimetype,
      ...(academicYearId ? { academicYearId } : {}),
    });
    res.status(201).json(preview);
  } catch (e) { next(e); }
}

export async function commitHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { jobId, selectedRowNumbers } = req.body as { jobId?: string; selectedRowNumbers?: number[] };
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

    const committed = await commitImportJob(req.collegeId!, jobId, req.user?.name ?? 'System', { selectedRowNumbers });

    // A trimmed summary, not the whole IImportJob. The document carries every
    // row's raw input and the full schema snapshot — megabytes on a large
    // import — and the drawer only needs to tell the operator what happened.
    // Per-row commit failures land on the job, and a Registrar cannot open
    // /platform/bulk-imports to read it, so the failed rows have to travel
    // with the response or they are invisible to the only persona that can
    // reach this door.
    res.json(jobSummary(committed));
  } catch (e) { next(e); }
}

/**
 * The drawer's "recent imports" list.
 *
 * Summary fields only — no per-row detail. `IImportJob.results[]` holds up to
 * IMPORT_MAX_ROWS entries, so returning whole documents for ten jobs could be
 * tens of megabytes; the row lists live on the detail endpoint, one job at a
 * time.
 *
 * Pinned to student jobs, so this door never lists the faculty / staff /
 * applicant / programme imports an admin ran through /platform/bulk-imports.
 */
export async function jobListHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { limit } = req.query as { limit?: string };
    const parsed = Number(limit);
    const jobs = await listImportJobs(req.collegeId!, {
      entityType: ENTITY_TYPE,
      limit: Number.isFinite(parsed) && parsed > 0 ? parsed : JOB_LIST_LIMIT,
    });
    res.json({
      items: jobs.map((job) => ({
        jobId: String(job._id),
        fileName: job.fileName,
        status: job.status,
        totalRows: job.totalRows,
        successCount: job.successCount,
        failureCount: job.failureCount,
        blockedCount: job.blockedCount,
        errorSummary: job.errorSummary,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    });
  } catch (e) { next(e); }
}

/**
 * One job's detail, so an operator who closed the drawer can get the failed
 * rows back. Before this existed there was no route at all: the façade had no
 * job endpoint and a Registrar holds no `platform:read`, so the per-row commit
 * errors were visible exactly once and then unreachable.
 *
 * The entityType check is the same load-bearing one `commitHandler` carries:
 * `getImportJob` scopes by collegeId, but nothing stops a caller holding only
 * `people:read` from passing the id of a faculty or applicant job. 404 rather
 * than 403 — a wrong-type job must not be confirmed to exist through this door.
 */
export async function jobDetailHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id?: string };
    if (!id) throw new AppError(400, 'Job id is required.');
    const job = await getImportJob(req.collegeId!, id);
    if (job.entityType !== ENTITY_TYPE) throw new AppError(404, 'Import job not found');
    res.json(jobSummary(job));
  } catch (e) { next(e); }
}
