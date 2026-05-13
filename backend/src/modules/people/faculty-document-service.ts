/**
 * faculty-document-service — credential-evidence document store for
 * Faculty entities (Strategic Gap 1 Phase B).
 *
 * One generic CRUD per the spec: the same service handles PhD
 * certificates, PAN cards, experience certificates, FDP certificates,
 * award letters — every uploadable evidence type on a faculty
 * profile. The category + documentType discriminator lives in the
 * model.
 *
 * Mirrors the photo-service contract:
 *   - Transport-agnostic (multer lives in the controller).
 *   - Multi-tenant scoping via `collegeId` on every Mongo query AND
 *     via the S3 key prefix.
 *   - Defense-in-depth: re-confirms the Faculty belongs to the
 *     caller's college after lookup, so a leaked facultyId can't be
 *     used to upload into another tenant.
 *   - S3 best-effort cleanup on partial DB failures.
 *
 * v1 scope (Phase B1):
 *   - upload, list, getSignedUrl (for view), updateMetadata, archive.
 *   - Verification status defaults to 'pending' on every upload.
 *   - Approve / reject endpoints land in Phase C (.captain/specs/
 *     faculty-profile-depth/spec.md §Phase C).
 */

import { Types } from 'mongoose';

import { Faculty } from '../../models/people/Faculty';
import {
  FacultyDocument,
  IFacultyDocument,
  FacultyDocumentCategory,
  FACULTY_DOCUMENT_CATEGORIES,
} from '../../models/people/FacultyDocument';
import { AppError } from '../../middleware/errorHandler';
import {
  putObject,
  deleteObject,
  getPresignedUrl,
  entityUploadPrefix,
} from '../../shared/s3/s3-client';

// ─── Public constants ─────────────────────────────────────────────────

/**
 * MIME allowlist for credential documents. PDFs cover the bulk of
 * NAAC evidence (degree certificates, FDP certificates, etc.);
 * common image MIMEs cover scanned identity docs and award photos.
 * The MIME is the browser-declared one — there is currently no
 * decode-the-bytes verification (TODO: Phase C parity with the
 * photo-service's sharp-based check).
 */
export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIMES)[number];

/** 10 MiB hard cap on the original buffer. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Default presigned-URL TTL for view links. Short so URLs don't leak. */
export const VIEW_PRESIGN_TTL_SECONDS = 300; // 5 minutes

// ─── Public types ─────────────────────────────────────────────────────

export interface UploadDocumentOpts {
  collegeId: string;
  facultyId: string;
  category: FacultyDocumentCategory;
  documentType: string;
  title: string;
  description?: string;
  issuingAuthority?: string;
  issuedAt?: Date;
  validUntil?: Date;
  referenceNumber?: string;

  buffer: Buffer;
  /** Browser-supplied MIME — sanity-checked against the allowlist. */
  declaredMime: string;
  /** Original filename — used only to derive the S3 extension. */
  originalFilename?: string;
}

export interface UpdateDocumentMetadataOpts {
  title?: string;
  description?: string;
  issuingAuthority?: string;
  issuedAt?: Date;
  validUntil?: Date;
  referenceNumber?: string;
  category?: FacultyDocumentCategory;
  documentType?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function isAllowedMime(mime: string): mime is AllowedDocumentMime {
  return (ALLOWED_DOCUMENT_MIMES as ReadonlyArray<string>).includes(mime);
}

function extForMime(mime: AllowedDocumentMime): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}

/**
 * Resolve a faculty row scoped to the caller's college. 404 if it
 * doesn't exist OR belongs to another tenant — same outward shape so
 * we don't leak cross-tenant existence.
 */
async function loadFacultyScoped(
  collegeId: string,
  facultyId: string,
): Promise<{ facultyOid: Types.ObjectId; collegeOid: Types.ObjectId }> {
  if (!Types.ObjectId.isValid(facultyId)) {
    throw new AppError(404, 'Faculty not found');
  }
  const cid = new Types.ObjectId(collegeId);
  const fid = new Types.ObjectId(facultyId);
  const fac = await Faculty.findOne({ _id: fid, collegeId: cid }).select({ _id: 1 }).lean();
  if (!fac) throw new AppError(404, 'Faculty not found');
  return { facultyOid: fid, collegeOid: cid };
}

// ─── Reads ────────────────────────────────────────────────────────────

/**
 * List non-archived documents for a faculty. Sorted by category then
 * `createdAt desc` so newest uploads bubble to the top within each
 * group on the UI.
 */
export async function listFacultyDocuments(
  collegeId: string,
  facultyId: string,
): Promise<IFacultyDocument[]> {
  await loadFacultyScoped(collegeId, facultyId);
  return FacultyDocument.find({
    collegeId: new Types.ObjectId(collegeId),
    facultyId: new Types.ObjectId(facultyId),
    archivedAt: null,
  }).sort({ category: 1, createdAt: -1 });
}

export async function getFacultyDocument(
  collegeId: string,
  facultyId: string,
  documentId: string,
): Promise<IFacultyDocument> {
  await loadFacultyScoped(collegeId, facultyId);
  if (!Types.ObjectId.isValid(documentId)) {
    throw new AppError(404, 'Document not found');
  }
  const doc = await FacultyDocument.findOne({
    _id: new Types.ObjectId(documentId),
    collegeId: new Types.ObjectId(collegeId),
    facultyId: new Types.ObjectId(facultyId),
    archivedAt: null,
  });
  if (!doc) throw new AppError(404, 'Document not found');
  return doc;
}

/**
 * Return a short-TTL presigned URL the operator can use to view (or
 * download) the document. Caller is expected to redirect or render in
 * an <iframe> / <embed>. URL expires in 5 min by default — refresh by
 * re-calling this endpoint.
 */
export async function getFacultyDocumentViewUrl(
  collegeId: string,
  facultyId: string,
  documentId: string,
): Promise<{ url: string; expiresAt: Date; mimeType: string; sizeBytes: number; title: string }> {
  const doc = await getFacultyDocument(collegeId, facultyId, documentId);
  const { url, expiresAt } = await getPresignedUrl(doc.s3Key, {
    expiresIn: VIEW_PRESIGN_TTL_SECONDS,
  });
  return {
    url,
    expiresAt,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    title: doc.title,
  };
}

// ─── Writes ───────────────────────────────────────────────────────────

/**
 * Upload a document file + create the metadata row. Atomic from the
 * caller's POV: if the DB write fails we delete the S3 object before
 * surfacing the error so we don't leak storage. If S3 upload fails
 * the DB row is never created.
 */
export async function uploadFacultyDocument(
  opts: UploadDocumentOpts,
  performedBy: string,
): Promise<IFacultyDocument> {
  const {
    collegeId, facultyId, category, documentType, title, description,
    issuingAuthority, issuedAt, validUntil, referenceNumber,
    buffer, declaredMime,
  } = opts;
  void performedBy; // audit logging is out of scope for v1

  // 0. Sanity.
  if (!FACULTY_DOCUMENT_CATEGORIES.includes(category)) {
    throw new AppError(400, `Invalid document category: ${category}`);
  }
  if (!title || !title.trim()) {
    throw new AppError(400, 'Document title is required');
  }
  if (buffer.length === 0) {
    throw new AppError(400, 'Empty file');
  }
  if (buffer.length > DOCUMENT_MAX_BYTES) {
    throw new AppError(400, 'File too large (max 10 MB)');
  }
  if (!isAllowedMime(declaredMime)) {
    throw new AppError(
      400,
      `Unsupported file type "${declaredMime}". Use PDF, JPEG, PNG, or WebP.`,
    );
  }

  // 1. Resolve faculty + tenancy.
  const { facultyOid, collegeOid } = await loadFacultyScoped(collegeId, facultyId);

  // 2. Generate the doc id locally so we can name the S3 key with it
  //    BEFORE inserting the row. Stable + collision-free without a
  //    separate identifier table.
  const documentOid = new Types.ObjectId();
  const ext = extForMime(declaredMime);
  const prefix = entityUploadPrefix('faculty', collegeId, facultyId);
  const s3Key = `${prefix}/documents/${String(documentOid)}.${ext}`;

  // 3. Upload to S3 first; only persist the DB row if the put succeeds.
  try {
    await putObject({
      key: s3Key,
      body: buffer,
      contentType: declaredMime,
      metadata: {
        facultyId,
        collegeId,
        category,
        documentType,
        title: title.trim(),
      },
    });
  } catch (err) {
    throw new AppError(503, `Failed to upload document to S3: ${(err as Error).message}`);
  }

  // 4. Create the row. Best-effort S3 cleanup on DB failure so we don't
  //    leak storage on transient Mongo flakes.
  try {
    const created = await FacultyDocument.create({
      _id: documentOid,
      collegeId: collegeOid,
      facultyId: facultyOid,
      category,
      documentType: documentType.trim(),
      title: title.trim(),
      description: description?.trim(),
      s3Key,
      mimeType: declaredMime,
      sizeBytes: buffer.length,
      issuingAuthority: issuingAuthority?.trim(),
      issuedAt,
      validUntil,
      referenceNumber: referenceNumber?.trim(),
      verificationStatus: 'pending',
    });
    return created;
  } catch (err) {
    await deleteObject(s3Key).catch(() => {
      /* swallow — we already have a primary error to report */
    });
    throw err;
  }
}

/**
 * Update the editable metadata on a document. Does NOT change the
 * underlying S3 object — replace the file via a separate
 * upload-new + archive-old flow.
 */
export async function updateFacultyDocumentMetadata(
  collegeId: string,
  facultyId: string,
  documentId: string,
  patch: UpdateDocumentMetadataOpts,
): Promise<IFacultyDocument> {
  const doc = await getFacultyDocument(collegeId, facultyId, documentId);
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description.trim();
  if (patch.issuingAuthority !== undefined) doc.issuingAuthority = patch.issuingAuthority.trim();
  if (patch.issuedAt !== undefined) doc.issuedAt = patch.issuedAt;
  if (patch.validUntil !== undefined) doc.validUntil = patch.validUntil;
  if (patch.referenceNumber !== undefined) doc.referenceNumber = patch.referenceNumber.trim();
  if (patch.category !== undefined) {
    if (!FACULTY_DOCUMENT_CATEGORIES.includes(patch.category)) {
      throw new AppError(400, `Invalid document category: ${patch.category}`);
    }
    doc.category = patch.category;
  }
  if (patch.documentType !== undefined) doc.documentType = patch.documentType.trim();
  await doc.save();
  return doc;
}

/**
 * Soft-delete: flip `archivedAt` and leave the S3 object in place.
 * Restore by zeroing `archivedAt` directly via service / admin tool;
 * no public restore endpoint in v1 (keeps the API surface tight).
 */
export async function archiveFacultyDocument(
  collegeId: string,
  facultyId: string,
  documentId: string,
): Promise<{ archived: true; archivedAt: Date }> {
  const doc = await getFacultyDocument(collegeId, facultyId, documentId);
  const archivedAt = new Date();
  doc.archivedAt = archivedAt;
  await doc.save();
  return { archived: true, archivedAt };
}
