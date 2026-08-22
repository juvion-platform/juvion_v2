/**
 * bulk-import-controller — HTTP layer for the schema-driven bulk-
 * import surface (Strategic Gap 2 Phase A).
 *
 * Routes mounted in `routes.ts` under /api/platform/bulk-imports.
 * Multer (memory storage) handles the multipart upload, mirroring
 * the photo-controller + faculty-document-controller pattern.
 *
 * Substantive logic lives in `bulk-import-service.ts`.
 */

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/authenticate';
import {
  uploadAndValidate,
  commitImportJob,
  listImportJobs,
  getImportJob,
  getImportJobSourceUrl,
  archiveImportJob,
  listEntityTypeDefinitions,
  ALLOWED_IMPORT_MIMES,
  IMPORT_FILE_MAX_BYTES,
} from './bulk-import-service';

const ALLOWED = new Set<string>(ALLOWED_IMPORT_MIMES);
const UNSUPPORTED_MESSAGE = 'Unsupported file type for bulk import';

export const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_FILE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error(UNSUPPORTED_MESSAGE));
      return;
    }
    cb(null, true);
  },
});

export function importMulterErrorHandler(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'File too large (max 10 MB)'));
    }
    return next(new AppError(400, err.message));
  }
  if (err instanceof Error && err.message === UNSUPPORTED_MESSAGE) {
    return next(new AppError(400, 'Unsupported file type. Upload a .csv file.'));
  }
  next(err);
}

function performedBy(req: AuthRequest): string {
  return req.user?.id || req.user?.name || 'system';
}

// ─── Reads ────────────────────────────────────────────────────────────

export async function listEntityTypesHandler(
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ items: listEntityTypeDefinitions() });
  } catch (err) {
    next(err);
  }
}

export async function listImportJobsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType =
      typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const items = await listImportJobs(req.collegeId!, { entityType, limit });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getImportJobHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const job = await getImportJob(req.collegeId!, id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function getImportJobSourceUrlHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const result = await getImportJobSourceUrl(req.collegeId!, id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Writes ───────────────────────────────────────────────────────────

export async function uploadImportHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded (expected multipart field "file")');
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const entityType = typeof body.entityType === 'string' ? body.entityType : '';
    if (!entityType) {
      throw new AppError(400, 'entityType is required');
    }
    const result = await uploadAndValidate({
      collegeId: req.collegeId!,
      performedBy: performedBy(req),
      entityType,
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      declaredMime: req.file.mimetype,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function commitImportJobHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { selectedRowNumbers } = req.body as { selectedRowNumbers?: number[] };
    const job = await commitImportJob(req.collegeId!, id, performedBy(req), { selectedRowNumbers });
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function archiveImportJobHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const result = await archiveImportJob(req.collegeId!, id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
