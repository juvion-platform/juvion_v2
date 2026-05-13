/**
 * faculty-document-controller — HTTP layer for the FacultyDocument
 * credential-evidence store (Strategic Gap 1 Phase B).
 *
 * Routes served (mounted under /api/people in routes.ts):
 *   GET    /faculty/:facultyId/documents
 *   POST   /faculty/:facultyId/documents          (multipart: 'file' + metadata fields)
 *   GET    /faculty/:facultyId/documents/:docId
 *   GET    /faculty/:facultyId/documents/:docId/view   → { url, expiresAt, ... }
 *   PATCH  /faculty/:facultyId/documents/:docId
 *   DELETE /faculty/:facultyId/documents/:docId        → soft archive
 *
 * The multer middleware + multerErrorHandler mirror the photo-controller
 * pattern. Anything substantive lives in `faculty-document-service.ts`.
 */

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/authenticate';
import {
  ALLOWED_DOCUMENT_MIMES,
  DOCUMENT_MAX_BYTES,
  uploadFacultyDocument,
  listFacultyDocuments,
  getFacultyDocument,
  getFacultyDocumentViewUrl,
  updateFacultyDocumentMetadata,
  archiveFacultyDocument,
  type UpdateDocumentMetadataOpts,
} from './faculty-document-service';
import type { FacultyDocumentCategory } from '../../models/people/FacultyDocument';

const ALLOWED_MIMES = new Set<string>(ALLOWED_DOCUMENT_MIMES);
const UNSUPPORTED_FORMAT_MESSAGE = 'Unsupported document format';

/**
 * Multer instance configured for the document-upload route. Memory
 * storage so the buffer goes straight to S3 without ever touching
 * disk. `fileFilter` runs the MIME allowlist; the size limit mirrors
 * the service-layer cap as defense-in-depth so a too-large file fails
 * fast before any bytes are processed.
 */
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      cb(new Error(UNSUPPORTED_FORMAT_MESSAGE));
      return;
    }
    cb(null, true);
  },
});

/**
 * Multer-error → AppError translator. Wired AFTER `upload.single('file')`
 * on the upload route so it sees those errors before they bubble.
 * Same shape as the photo-controller's `multerErrorHandler`.
 */
export function documentMulterErrorHandler(
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
  if (err instanceof Error && err.message === UNSUPPORTED_FORMAT_MESSAGE) {
    return next(
      new AppError(400, 'Unsupported document format. Use PDF, JPEG, PNG, or WebP.'),
    );
  }
  next(err);
}

// ─── Helpers ──────────────────────────────────────────────────────────

function performedBy(req: AuthRequest): string {
  return req.user?.id || req.user?.name || 'system';
}

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

// ─── Reads ────────────────────────────────────────────────────────────

export async function listFacultyDocumentsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { facultyId } = req.params as { facultyId: string };
    const items = await listFacultyDocuments(req.collegeId!, facultyId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getFacultyDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { facultyId, docId } = req.params as { facultyId: string; docId: string };
    const doc = await getFacultyDocument(req.collegeId!, facultyId, docId);
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function getFacultyDocumentViewUrlHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { facultyId, docId } = req.params as { facultyId: string; docId: string };
    const result = await getFacultyDocumentViewUrl(req.collegeId!, facultyId, docId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Writes ───────────────────────────────────────────────────────────

export async function uploadFacultyDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { facultyId } = req.params as { facultyId: string };
    if (!req.file) {
      throw new AppError(400, 'No file uploaded (expected multipart field "file")');
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const category = body.category as FacultyDocumentCategory | undefined;
    const documentType = body.documentType as string | undefined;
    const title = body.title as string | undefined;
    if (!category) throw new AppError(400, 'category is required');
    if (!documentType) throw new AppError(400, 'documentType is required');
    if (!title) throw new AppError(400, 'title is required');

    const doc = await uploadFacultyDocument(
      {
        collegeId: req.collegeId!,
        facultyId,
        category,
        documentType,
        title,
        description: body.description as string | undefined,
        issuingAuthority: body.issuingAuthority as string | undefined,
        issuedAt: parseDate(body.issuedAt),
        validUntil: parseDate(body.validUntil),
        referenceNumber: body.referenceNumber as string | undefined,
        buffer: req.file.buffer,
        declaredMime: req.file.mimetype,
        originalFilename: req.file.originalname,
      },
      performedBy(req),
    );
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateFacultyDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { facultyId, docId } = req.params as { facultyId: string; docId: string };
    const body = (req.body || {}) as Record<string, unknown>;
    const patch: UpdateDocumentMetadataOpts = {};
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.issuingAuthority === 'string') patch.issuingAuthority = body.issuingAuthority;
    if (body.issuedAt !== undefined) {
      const d = parseDate(body.issuedAt);
      if (d) patch.issuedAt = d;
    }
    if (body.validUntil !== undefined) {
      const d = parseDate(body.validUntil);
      if (d) patch.validUntil = d;
    }
    if (typeof body.referenceNumber === 'string') patch.referenceNumber = body.referenceNumber;
    if (typeof body.category === 'string') patch.category = body.category as FacultyDocumentCategory;
    if (typeof body.documentType === 'string') patch.documentType = body.documentType;
    const doc = await updateFacultyDocumentMetadata(
      req.collegeId!,
      facultyId,
      docId,
      patch,
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function archiveFacultyDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { facultyId, docId } = req.params as { facultyId: string; docId: string };
    const result = await archiveFacultyDocument(req.collegeId!, facultyId, docId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
