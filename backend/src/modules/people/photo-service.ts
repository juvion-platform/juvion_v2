/**
 * Person-entity photo upload orchestrator.
 *
 * Owns the end-to-end flow for any person-linked entity (students,
 * faculty, staff, parents):
 *   - Resolve the entity row (multi-tenant scoped to collegeId).
 *   - Defense-in-depth re-confirm Person belongs to the same college.
 *   - Validate the raw image buffer (format / dimensions / size) using
 *     `sharp.metadata()` against the actual decoded bytes — never trust
 *     the browser-supplied MIME.
 *   - Generate a 200×200 cover-fit JPEG thumbnail and an EXIF-stripped
 *     re-encode of the original.
 *   - Upload both to S3 under the locked
 *     `colleges/<cid>/<entityType>/<eid>` prefix using the shared S3
 *     client.
 *   - Persist the photo metadata onto the matching Person document.
 *   - Best-effort cleanup of S3 objects on partial failure or replace.
 *
 * Person is the single storage location for the photo regardless of
 * which entity row was the lookup hop — every supported entity type
 * has a `personId` ref and Person is the canonical identity record.
 *
 * The HTTP layer (multer + the upload route) lives in `photo-controller.ts`
 * — this module is intentionally transport-agnostic.
 *
 * Multi-tenancy: every entity query AND the follow-up Person query are
 * scoped by `collegeId`. S3 keys also embed the collegeId via
 * `entityUploadPrefix`. There is no path that lets a caller from
 * college A touch college B's data.
 *
 * Migration note: the legacy `Person.photo: String` field was unused in
 * production code (verified before the structured-shape switch), so no
 * back-compat migration was needed. Mongoose silently drops legacy
 * string values when the schema can't cast them, so any stray dev-seed
 * strings are ignored on read.
 */

import sharp from 'sharp';
import { Model } from 'mongoose';

import { Person } from '../../models/people/Person';
import type { PersonPhotoContentType } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { Parent } from '../../models/people/Parent';
import { AppError } from '../../middleware/errorHandler';
import {
  putObject,
  deleteObject,
  getPresignedUrl,
  entityUploadPrefix,
} from '../../shared/s3/s3-client';
import type { PersonEntityType } from '../../shared/s3/s3-client';

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

/**
 * Generic upload opts. The `entityType` discriminator picks which
 * collection holds the entity row whose `personId` we resolve to find
 * the canonical Person.
 */
export interface UploadEntityPhotoOpts {
  entityType: PersonEntityType;
  collegeId: string;
  entityId: string;
  buffer: Buffer;
  /** Browser-supplied MIME for sanity only — actual MIME is detected from bytes. */
  declaredMime?: string;
}

/**
 * Compat shape for the student-only API. Kept as `Omit<UploadEntityPhotoOpts, 'entityType'>`
 * with `studentId` aliased onto `entityId` via the wrapper below.
 */
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

interface ResolvedEntity {
  entityId: string;
  personId: string;
  /** May be undefined when the entity has no photo yet. */
  existingPhoto: ResolvedPhoto | null;
}

interface ResolvedPhoto {
  original: string;
  thumb: string;
  contentType: PersonPhotoContentType;
  sizeBytes: number;
  uploadedAt: Date;
}

/**
 * Bound between the entity-type discriminator and the matching Mongoose
 * model. We intentionally type the values as `Model<unknown>` so the
 * map can hold heterogeneous models — the only field we read off them
 * is `personId`, which we re-validate at runtime.
 */
const ENTITY_MODELS: Record<PersonEntityType, Model<unknown>> = {
  students: Student as unknown as Model<unknown>,
  faculty: Faculty as unknown as Model<unknown>,
  staff: Staff as unknown as Model<unknown>,
  parents: Parent as unknown as Model<unknown>,
};

// ─── Public API — generic over PersonEntityType ───────────────────────

export async function uploadEntityPhoto(
  opts: UploadEntityPhotoOpts,
): Promise<UploadStudentPhotoResult> {
  const { entityType, collegeId, entityId, buffer } = opts;

  // 1. Resolve entity row → personId under collegeId scope. 404 covers
  //    "entity doesn't exist" AND cross-college (same outward shape so
  //    we don't leak existence of rows in other tenants).
  const resolved = await loadEntityScoped(entityType, collegeId, entityId);

  // 2. Validate the actual decoded image. Defense-in-depth size cap.
  if (buffer.length > PHOTO_MAX_BYTES) {
    throw new AppError(400, 'File too large (max 5 MB)');
  }
  const validated = await validateImageBuffer(buffer);

  // 3. Compute deterministic keys under the entity-typed prefix.
  const prefix = entityUploadPrefix(entityType, collegeId, entityId);
  const ext = formatToExt(validated.format);
  const originalKey = `${prefix}/photo/original.${ext}`;
  const thumbKey = `${prefix}/photo/thumb.jpg`;

  // 4. Build the processed buffers.
  const thumbBuffer = await generateThumbnail(buffer);
  const originalProcessed = await stripExifKeepFormat(buffer, validated.format);

  // 5. Upload original first; on thumb failure, best-effort delete original.
  const metadata = { collegeId, entityId, entityType };
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

export async function deleteEntityPhoto(
  entityType: PersonEntityType,
  collegeId: string,
  entityId: string,
): Promise<void> {
  const resolved = await loadEntityScoped(entityType, collegeId, entityId);
  if (!resolved.existingPhoto) return; // idempotent no-op

  await safeDelete(resolved.existingPhoto.original);
  await safeDelete(resolved.existingPhoto.thumb);

  await Person.findOneAndUpdate(
    { _id: resolved.personId, collegeId },
    { $set: { photo: null } },
  );
}

export async function getEntityPhotoUrls(
  entityType: PersonEntityType,
  collegeId: string,
  entityId: string,
  variant: PhotoUrlVariant = 'both',
): Promise<Partial<PhotoUrls>> {
  const resolved = await loadEntityScoped(entityType, collegeId, entityId);
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

// ─── Compat shims — student-only API (kept until v7) ──────────────────
//
// Existing call sites (photo-controller, frontend service) and the
// existing test suite target these shims. They're thin wrappers that
// forward into the generic API with `entityType = 'students'`.

export const uploadStudentPhoto = (
  opts: UploadStudentPhotoOpts,
): Promise<UploadStudentPhotoResult> =>
  uploadEntityPhoto({
    entityType: 'students',
    collegeId: opts.collegeId,
    entityId: opts.studentId,
    buffer: opts.buffer,
    ...(opts.declaredMime !== undefined && { declaredMime: opts.declaredMime }),
  });

export const deleteStudentPhoto = (
  collegeId: string,
  studentId: string,
): Promise<void> => deleteEntityPhoto('students', collegeId, studentId);

export const getStudentPhotoUrls = (
  collegeId: string,
  studentId: string,
  variant: PhotoUrlVariant = 'both',
): Promise<Partial<PhotoUrls>> =>
  getEntityPhotoUrls('students', collegeId, studentId, variant);

// ─── Private helpers ──────────────────────────────────────────────────

/**
 * Load the entity row → Person under a strict `collegeId` filter and
 * return a normalized snapshot. Throws AppError(404) when the entity
 * doesn't exist OR belongs to a different college (same outward error
 * shape so we don't leak existence across tenants).
 *
 * Two-step query is intentional: the entity-row query is scoped by
 * collegeId, AND the follow-up Person query is also scoped by
 * collegeId — so we double-bind the tenant on both sides. If the
 * `personId` ref ever points across tenants (data-corruption case),
 * the second lookup catches it.
 *
 * Person.photo is a single field shared across all entity types because
 * Person is the canonical identity record; the entity row is just the
 * lookup hop.
 */
async function loadEntityScoped(
  entityType: PersonEntityType,
  collegeId: string,
  entityId: string,
): Promise<ResolvedEntity> {
  const Model = ENTITY_MODELS[entityType];
  const row = (await Model.findOne({ _id: entityId, collegeId })
    .select('personId')
    .lean()) as { _id: unknown; personId?: unknown } | null;

  // Use the entity-type slug verbatim in the error message — keeps
  // diagnostic context for the caller without leaking tenant data.
  const notFound = (): AppError => new AppError(404, `${entityType} not found`);

  if (!row || !row.personId) throw notFound();

  const person = await Person.findOne({
    _id: row.personId,
    collegeId,
  }).lean();
  if (!person) throw notFound();

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
    entityId: String(row._id),
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
