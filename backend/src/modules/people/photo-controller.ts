/**
 * P5 — Thin HTTP layer for the student-photo endpoints.
 *
 * Three handlers (`uploadPhotoHandler`, `deletePhotoHandler`,
 * `getPhotoUrlHandler`) plus the configured `multer` instance and a
 * multer-specific error remapper. The handlers are intentionally thin:
 * everything substantive (image decode, S3 orchestration, DB write,
 * cross-college guard, etc.) lives in `photo-service.ts` (P4).
 *
 * Multer details:
 *   - Memory storage so the buffer goes straight to sharp without ever
 *     touching disk.
 *   - `fileSize: PHOTO_MAX_BYTES` mirrors the photo-service hard cap so
 *     the user gets a clean 400 before the bytes ever reach service
 *     layer.
 *   - `fileFilter` rejects anything outside the JPEG/PNG/WebP allowlist
 *     based on the browser-supplied MIME. The photo-service runs its
 *     own decode-the-bytes check as defense-in-depth, so this is purely
 *     a UX-level fast-fail.
 *
 * Multer errors do NOT auto-convert to AppError — `multerErrorHandler`
 * remaps `MulterError` codes (`LIMIT_FILE_SIZE` → "File too large")
 * and the fileFilter sentinel ("Unsupported image format") into clean
 * `AppError(400, …)` responses. The error handler is wired AFTER
 * `upload.single('file')` on the upload route so it sees those errors
 * before they bubble to the global error handler.
 */

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/authenticate';
import {
  uploadStudentPhoto,
  deleteStudentPhoto,
  getStudentPhotoUrls,
  PHOTO_MAX_BYTES,
} from './photo-service';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Sentinel error message produced by the multer fileFilter. */
const UNSUPPORTED_FORMAT_MESSAGE = 'Unsupported image format';

/**
 * Configured multer instance for the upload route. Single-file (`file`
 * field) uploads only — anything else is rejected at the multer layer.
 */
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      cb(new Error(UNSUPPORTED_FORMAT_MESSAGE));
      return;
    }
    cb(null, true);
  },
});

// ─── Handlers ─────────────────────────────────────────────────────────

export async function uploadPhotoHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const id = req.params.id as string | undefined;
    if (!id) throw new AppError(400, 'studentId required');

    const result = await uploadStudentPhoto({
      collegeId: req.collegeId!,
      studentId: id,
      buffer: req.file.buffer,
      declaredMime: req.file.mimetype,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function deletePhotoHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string | undefined;
    if (!id) throw new AppError(400, 'studentId required');

    await deleteStudentPhoto(req.collegeId!, id);
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
}

const PHOTO_VARIANTS = ['thumb', 'original', 'both'] as const;
type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

function isPhotoVariant(v: unknown): v is PhotoVariant {
  return typeof v === 'string' && (PHOTO_VARIANTS as readonly string[]).includes(v);
}

export async function getPhotoUrlHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string | undefined;
    if (!id) throw new AppError(400, 'studentId required');

    const rawVariant = req.query.variant;
    let variant: PhotoVariant;
    if (rawVariant === undefined) {
      variant = 'both';
    } else if (isPhotoVariant(rawVariant)) {
      variant = rawVariant;
    } else {
      throw new AppError(400, "variant must be 'thumb' | 'original' | 'both'");
    }

    const urls = await getStudentPhotoUrls(req.collegeId!, id, variant);
    res.json(urls);
  } catch (e) {
    next(e);
  }
}

// ─── Multer error → AppError remapper ─────────────────────────────────

/**
 * 4-arg express error handler. Must be installed AFTER the multer
 * `upload.single('file')` middleware on the upload route so it catches
 * errors thrown either by multer's own limits or by our fileFilter
 * sentinel before they bubble to the global error handler.
 */
export function multerErrorHandler(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'File too large (max 5 MB)'));
    }
    return next(new AppError(400, err.message));
  }
  if (err instanceof Error && err.message === UNSUPPORTED_FORMAT_MESSAGE) {
    return next(
      new AppError(400, 'Unsupported image format. Use JPEG, PNG, or WebP.'),
    );
  }
  next(err);
}
