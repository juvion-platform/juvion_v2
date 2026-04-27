/**
 * Student photo upload orchestrator (P4 of student-photo-upload).
 *
 * Owns the end-to-end flow:
 *   - Resolve student (multi-tenant scoped to collegeId).
 *   - Validate the raw image buffer (format / dimensions / size) using
 *     `sharp.metadata()` against the actual decoded bytes — never trust
 *     the browser-supplied MIME.
 *   - Generate a 200×200 cover-fit JPEG thumbnail and an EXIF-stripped
 *     re-encode of the original.
 *   - Upload both to S3 under the locked `colleges/<cid>/students/<sid>`
 *     prefix using the shared S3 client.
 *   - Persist the photo metadata onto the matching Person document.
 *   - Best-effort cleanup of S3 objects on partial failure or replace.
 *
 * The HTTP layer (multer + the upload route) lives in P5 — this module
 * is intentionally transport-agnostic.
 *
 * Multi-tenancy: every Person/Student query is scoped by `collegeId`.
 * S3 keys also embed the collegeId via `studentUploadPrefix`. There is
 * no path that lets a caller from college A touch college B's data.
 *
 * Migration note: the legacy `Person.photo: String` field was unused in
 * production code (verified before P2), so the structured-shape switch
 * in P2 didn't need a back-compat migration. Mongoose silently drops
 * legacy string values when the schema can't cast them, so any stray
 * dev-seed strings are ignored on read.
 */

import sharp from 'sharp';

import { Person } from '../../models/people/Person';
import type { PersonPhotoContentType } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { AppError } from '../../middleware/errorHandler';
import {
  putObject,
  deleteObject,
  getPresignedUrl,
  studentUploadPrefix,
} from '../../shared/s3/s3-client';

// ─── Public constants ─────────────────────────────────────────────────

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

/** 5 MiB hard cap on the original buffer. Defense-in-depth alongside multer (P5). */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Reject any single dimension above 8000 px — guards against decompression bombs. */
export const PHOTO_MAX_DIMENSION = 8000;
/** Square thumbnail edge in pixels. */
export const THUMBNAIL_SIZE = 200;
/** Default presigned-URL expiry for read paths. */
export const PRESIGN_EXPIRY_SECONDS = 3600;

// ─── Public types ─────────────────────────────────────────────────────

export interface UploadStudentPhotoOpts {
  collegeId: string;
  studentId: string;
  buffer: Buffer;
  /** Browser-supplied MIME for sanity only — actual MIME is detected from bytes. */
  declaredMime?: string;
}

export interface UploadStudentPhotoResult {
  original: string;
  thumb: string;
  contentType: AllowedImageMime;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface PresignedUrl {
  url: string;
  expiresAt: Date;
}

export interface PhotoUrls {
  original: PresignedUrl;
  thumb: PresignedUrl;
}

export type PhotoUrlVariant = 'thumb' | 'original' | 'both';

// ─── Internal types ───────────────────────────────────────────────────

type SharpFormat = 'jpeg' | 'png' | 'webp';

interface ValidatedImage {
  format: SharpFormat;
  contentType: AllowedImageMime;
  width: number;
  height: number;
}

interface ResolvedStudent {
  studentId: string;
  personId: string;
  /** May be undefined when the student has no photo yet. */
  existingPhoto: ResolvedPhoto | null;
}

interface ResolvedPhoto {
  original: string;
  thumb: string;
  contentType: PersonPhotoContentType;
  sizeBytes: number;
  uploadedAt: Date;
}

// ─── Public API ───────────────────────────────────────────────────────

export async function uploadStudentPhoto(
  opts: UploadStudentPhotoOpts,
): Promise<UploadStudentPhotoResult> {
  const { collegeId, studentId, buffer } = opts;

  // 1. Resolve student under collegeId scope. 404 covers cross-college.
  const resolved = await loadStudentScoped(collegeId, studentId);

  // 2. Validate the actual decoded image. Defense-in-depth size cap.
  if (buffer.length > PHOTO_MAX_BYTES) {
    throw new AppError(400, 'File too large (max 5 MB)');
  }
  const validated = await validateImageBuffer(buffer);

  // 3. Compute deterministic keys.
  const prefix = studentUploadPrefix(collegeId, studentId);
  const ext = formatToExt(validated.format);
  const originalKey = `${prefix}/photo/original.${ext}`;
  const thumbKey = `${prefix}/photo/thumb.jpg`;

  // 4. Build the processed buffers.
  const thumbBuffer = await generateThumbnail(buffer);
  const originalProcessed = await stripExifKeepFormat(buffer, validated.format);

  // 5. Upload original first; on thumb failure, best-effort delete original.
  const metadata = { collegeId, studentId };
  await putObject({
    key: originalKey,
    body: originalProcessed,
    contentType: validated.contentType,
    metadata,
  });

  try {
    await putObject({
      key: thumbKey,
      body: thumbBuffer,
      contentType: 'image/jpeg',
      metadata,
    });
  } catch (err) {
    await safeDelete(originalKey);
    throw err;
  }

  // 6. Persist on the Person document. On failure, best-effort delete BOTH.
  const uploadedAt = new Date();
  const sizeBytes = buffer.length;

  try {
    await Person.findOneAndUpdate(
      { _id: resolved.personId, collegeId },
      {
        $set: {
          photo: {
            original: originalKey,
            thumb: thumbKey,
            contentType: validated.contentType,
            sizeBytes,
            uploadedAt,
          },
        },
      },
    );
  } catch {
    await safeDelete(originalKey);
    await safeDelete(thumbKey);
    throw new AppError(500, 'Failed to persist photo metadata');
  }

  // 7. Replace flow: clean up any old keys that differ from the new ones.
  if (resolved.existingPhoto) {
    const oldKeys = new Set([
      resolved.existingPhoto.original,
      resolved.existingPhoto.thumb,
    ]);
    const newKeys = new Set([originalKey, thumbKey]);
    for (const oldKey of oldKeys) {
      if (!newKeys.has(oldKey)) await safeDelete(oldKey);
    }
  }

  return {
    original: originalKey,
    thumb: thumbKey,
    contentType: validated.contentType,
    sizeBytes,
    uploadedAt,
  };
}

export async function deleteStudentPhoto(
  collegeId: string,
  studentId: string,
): Promise<void> {
  const resolved = await loadStudentScoped(collegeId, studentId);
  if (!resolved.existingPhoto) return; // idempotent no-op

  await safeDelete(resolved.existingPhoto.original);
  await safeDelete(resolved.existingPhoto.thumb);

  await Person.findOneAndUpdate(
    { _id: resolved.personId, collegeId },
    { $set: { photo: null } },
  );
}

export async function getStudentPhotoUrls(
  collegeId: string,
  studentId: string,
  variant: PhotoUrlVariant = 'both',
): Promise<Partial<PhotoUrls>> {
  const resolved = await loadStudentScoped(collegeId, studentId);
  if (!resolved.existingPhoto) return {};

  const photo = resolved.existingPhoto;
  const out: Partial<PhotoUrls> = {};

  if (variant === 'original' || variant === 'both') {
    out.original = await getPresignedUrl(photo.original, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });
  }
  if (variant === 'thumb' || variant === 'both') {
    out.thumb = await getPresignedUrl(photo.thumb, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });
  }

  return out;
}

// ─── Private helpers ──────────────────────────────────────────────────

/**
 * Load the Student → Person under a strict `collegeId` filter and return
 * a normalized snapshot. Throws AppError(404) when the student doesn't
 * exist OR when it belongs to a different college.
 *
 * Two-step query is intentional: even if the student doc itself isn't
 * scoped (defensive: looking up by primary key only) the matching Person
 * lookup MUST also be scoped, so we double-bind the tenant on both
 * sides.
 */
async function loadStudentScoped(
  collegeId: string,
  studentId: string,
): Promise<ResolvedStudent> {
  const student = await Student.findOne({ _id: studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  const person = await Person.findOne({
    _id: student.personId,
    collegeId,
  }).lean();
  if (!person) throw new AppError(404, 'Student not found');

  const existingPhoto: ResolvedPhoto | null = person.photo
    ? {
        original: person.photo.original,
        thumb: person.photo.thumb,
        contentType: person.photo.contentType,
        sizeBytes: person.photo.sizeBytes,
        uploadedAt: person.photo.uploadedAt,
      }
    : null;

  return {
    studentId: String(student._id),
    personId: String(person._id),
    existingPhoto,
  };
}

/**
 * Read sharp metadata from the buffer and validate format + dimensions.
 * Throws AppError(400) for any rejection condition.
 *
 * Sharp throws when it can't recognize an image — we catch that as the
 * "not an image at all" case to keep the error message consistent.
 */
async function validateImageBuffer(buffer: Buffer): Promise<ValidatedImage> {
  let format: keyof sharp.FormatEnum | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    format = meta.format;
    width = meta.width;
    height = meta.height;
  } catch {
    throw new AppError(400, 'Unsupported image format. Use JPEG, PNG, or WebP.');
  }

  if (!format || !isSupportedFormat(format)) {
    throw new AppError(400, 'Unsupported image format. Use JPEG, PNG, or WebP.');
  }

  if (
    width === undefined ||
    height === undefined ||
    width > PHOTO_MAX_DIMENSION ||
    height > PHOTO_MAX_DIMENSION
  ) {
    throw new AppError(
      400,
      `Image too large (max ${PHOTO_MAX_DIMENSION}\u00d7${PHOTO_MAX_DIMENSION})`,
    );
  }

  return {
    format,
    contentType: formatToMime(format),
    width,
    height,
  };
}

function isSupportedFormat(
  format: keyof sharp.FormatEnum,
): format is SharpFormat {
  return format === 'jpeg' || format === 'png' || format === 'webp';
}

function formatToMime(format: SharpFormat): AllowedImageMime {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  return 'image/webp';
}

function formatToExt(format: SharpFormat): 'jpg' | 'png' | 'webp' {
  if (format === 'jpeg') return 'jpg';
  return format;
}

/**
 * Generate the 200×200 cover-fit thumbnail. `.rotate()` autorotates per
 * EXIF orientation BEFORE the resize, so a portrait phone photo lands
 * upright. `.withMetadata({ exif: {} })` strips EXIF from the output so
 * we don't leak GPS/device data via S3.
 */
async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: 'cover',
      position: 'center',
    })
    .withMetadata({ exif: {} })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Re-encode the original through sharp preserving its format but
 * stripping EXIF. Output goes to S3 in place of the raw upload.
 */
async function stripExifKeepFormat(
  buffer: Buffer,
  format: SharpFormat,
): Promise<Buffer> {
  const pipeline = sharp(buffer).rotate().withMetadata({ exif: {} });
  if (format === 'jpeg') return pipeline.jpeg().toBuffer();
  if (format === 'png') return pipeline.png().toBuffer();
  return pipeline.webp().toBuffer();
}

/**
 * Best-effort delete used by all rollback / replace paths. Swallows
 * everything — if the cleanup itself errors, we don't want to mask the
 * primary failure or fail the calling operation.
 *
 * `s3-client.deleteObject` already swallows NoSuchKey; this catch
 * handles any other transient fault (network, throttling, etc.).
 */
async function safeDelete(key: string): Promise<void> {
  try {
    await deleteObject(key);
  } catch {
    // intentionally silent
  }
}
