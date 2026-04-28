/**
 * P5 / G3 — Thin HTTP layer for the person-entity photo endpoints.
 *
 * The handler set (`upload`, `remove`, `getUrl`) is parameterized over
 * `PersonEntityType` via `makePhotoHandlers(entityType)`. Each entity
 * type (students/faculty/staff/parents) gets its own pre-instantiated
 * triple — `studentPhotoHandlers`, `facultyPhotoHandlers`, etc. The
 * routes layer then mounts those triples under the matching URL slug.
 *
 * Original student-only exports (`uploadPhotoHandler`, `deletePhotoHandler`,
 * `getPhotoUrlHandler`) are kept as thin compat shims that point at
 * `studentPhotoHandlers` so the existing route mounts and tests keep
 * working without churn.
 *
 * The handlers stay intentionally thin: every substantive concern
 * (image decode, S3 orchestration, DB write, cross-college guard) lives
 * in `photo-service.ts` and is dispatched via `entityType`.
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
  uploadEntityPhoto,
  deleteEntityPhoto,
  getEntityPhotoUrls,
  PHOTO_MAX_BYTES,
} from './photo-service';
import type { PersonEntityType } from '../../shared/s3/s3-client';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Sentinel error message produced by the multer fileFilter. */
const UNSUPPORTED_FORMAT_MESSAGE = 'Unsupported image format';

/**
 * Configured multer instance for the upload route. Single-file (`file`
 * field) uploads only — anything else is rejected at the multer layer.
 *
 * Entity-agnostic: the same multer instance services every photo
 * upload route regardless of which entity type is on the receiving end.
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

// ─── Variant validation ───────────────────────────────────────────────

const PHOTO_VARIANTS = ['thumb', 'original', 'both'] as const;
type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

function isPhotoVariant(v: unknown): v is PhotoVariant {
  return typeof v === 'string' && (PHOTO_VARIANTS as readonly string[]).includes(v);
}

// ─── Handler factory ──────────────────────────────────────────────────

/**
 * Public shape of one entity's bundle of HTTP handlers. Mounted onto
 * routes via the per-entity exports below.
 */
export interface PhotoHandlers {
  upload: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
  remove: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
  getUrl: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}

/**
 * Build the trio of HTTP handlers (upload / remove / getUrl) bound to
 * a specific `PersonEntityType`. Each handler is a thin shell that:
 *   - Pulls `:id` from the route params.
 *   - Delegates into the generic photo-service API with `entityType`.
 *   - Lets the service handle multi-tenancy (collegeId scoping) and
 *     cross-college 404s.
 *
 * The id-required `AppError(400, …)` and variant validation messages
 * stay generic across entity types — adding the entity slug only made
 * the message noisier without giving the caller new information.
 */
function makePhotoHandlers(entityType: PersonEntityType): PhotoHandlers {
  const upload = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) throw new AppError(400, 'No file uploaded');
      const id = req.params.id as string | undefined;
      if (!id) throw new AppError(400, `${entityType} id required`);

      const result = await uploadEntityPhoto({
        entityType,
        collegeId: req.collegeId!,
        entityId: id,
        buffer: req.file.buffer,
        declaredMime: req.file.mimetype,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  const remove = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id as string | undefined;
      if (!id) throw new AppError(400, `${entityType} id required`);

      await deleteEntityPhoto(entityType, req.collegeId!, id);
      res.json({ deleted: true });
    } catch (e) {
      next(e);
    }
  };

  const getUrl = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id as string | undefined;
      if (!id) throw new AppError(400, `${entityType} id required`);

      const rawVariant = req.query.variant;
      let variant: PhotoVariant;
      if (rawVariant === undefined) {
        variant = 'both';
      } else if (isPhotoVariant(rawVariant)) {
        variant = rawVariant;
      } else {
        throw new AppError(400, "variant must be 'thumb' | 'original' | 'both'");
      }

      const urls = await getEntityPhotoUrls(entityType, req.collegeId!, id, variant);
      res.json(urls);
    } catch (e) {
      next(e);
    }
  };

  return { upload, remove, getUrl };
}

// ─── Per-entity handler bundles ───────────────────────────────────────

export const studentPhotoHandlers = makePhotoHandlers('students');
export const facultyPhotoHandlers = makePhotoHandlers('faculty');
export const staffPhotoHandlers = makePhotoHandlers('staff');
export const parentPhotoHandlers = makePhotoHandlers('parents');

// ─── Compat shims (student-only API kept until G5 frontend migration) ─
//
// Existing route mounts and the existing test suite import these
// names directly. They are aliases for `studentPhotoHandlers.*` so the
// compat surface stays stable while the rest of the controller uses
// the factory pattern.

export const uploadPhotoHandler = studentPhotoHandlers.upload;
export const deletePhotoHandler = studentPhotoHandlers.remove;
export const getPhotoUrlHandler = studentPhotoHandlers.getUrl;

// ─── Multer error → AppError remapper ─────────────────────────────────

/**
 * 4-arg express error handler. Must be installed AFTER the multer
 * `upload.single('file')` middleware on the upload route so it catches
 * errors thrown either by multer's own limits or by our fileFilter
 * sentinel before they bubble to the global error handler.
 *
 * Entity-agnostic — the same handler is reused on every entity's
 * upload route.
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
