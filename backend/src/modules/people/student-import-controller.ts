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
  uploadAndValidate, commitImportJob,
} from '../platform/bulk-import-service';
import { getImportSchema } from '../platform/bulk-import-registry';
import { importFileUpload, importMulterErrorHandler } from '../platform/bulk-import-controller';

const ENTITY_TYPE = 'student';

export const studentImportUpload = importFileUpload;
export { importMulterErrorHandler as studentImportMulterErrorHandler };

export async function templateHandler(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const def = getImportSchema(ENTITY_TYPE);
    if (!def) throw new AppError(500, 'Student import schema is not registered.');
    res.json({
      entityType: def.entityType,
      label: def.label,
      description: def.description,
      fields: def.fields.map(({ fieldKey, label, type, required, meta }) => ({
        fieldKey, label, type, required, meta,
      })),
      sampleRow: def.sampleRow,
    });
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
    const job = await commitImportJob(req.collegeId!, jobId, req.user?.name ?? 'System');
    res.json(job);
  } catch (e) { next(e); }
}
