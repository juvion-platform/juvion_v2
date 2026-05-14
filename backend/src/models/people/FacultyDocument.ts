import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultyDocument — generic credential-evidence store for the Faculty
 * Profile depth feature (Strategic Gap 1 Phase B). One document per
 * row; all 12 NAAC-relevant categories share this collection.
 *
 * Why one collection for everything:
 *   - Single upload pipeline (multer + S3) covers PAN, PhD certificate,
 *     experience certs, FDP certificates, award letters — every
 *     uploadable evidence on a faculty profile.
 *   - Single verification workflow (admin approves / rejects) instead
 *     of N parallel approve buttons.
 *   - The Phase E AI verification agent operates on one collection,
 *     not 12.
 *   - Soft-delete + archive policy is centralised.
 *
 * Why `category` AND `documentType`:
 *   - `category` is the closed enum used by the UI's tab grouping.
 *   - `documentType` is an open string namespaced inside each category
 *     (e.g. `category: 'education', documentType: 'phd_certificate'`).
 *     Phase B1 ships only `phd_certificate` end-to-end; B2 widens the
 *     allowed types without a model change.
 *
 * Multi-tenancy: every row carries `collegeId`; every query MUST scope
 * by it. Faculty resolution happens at the service layer (Faculty
 * row's `collegeId` must match the caller's).
 *
 * Soft delete via `archivedAt`: queries default to `archivedAt: null`
 * so the UI never sees them. S3 objects are NOT auto-deleted — keeps
 * the option to restore. A janitor sweeps very old archived rows on a
 * separate schedule (out of scope for v1).
 */

export type FacultyDocumentCategory =
  | 'identity'
  | 'education'
  | 'certification'
  | 'experience'
  | 'current_employment'
  | 'research'
  | 'training'
  | 'award'
  | 'membership'
  | 'administrative'
  | 'hr_payroll'
  | 'self_declaration';

export const FACULTY_DOCUMENT_CATEGORIES: ReadonlyArray<FacultyDocumentCategory> = [
  'identity',
  'education',
  'certification',
  'experience',
  'current_employment',
  'research',
  'training',
  'award',
  'membership',
  'administrative',
  'hr_payroll',
  'self_declaration',
];

export type FacultyDocumentVerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export type FacultyDocumentOcrStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface IFacultyDocument extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  // Categorisation
  category: FacultyDocumentCategory;
  /** Open string namespaced inside `category`. v1 ships 'phd_certificate'. */
  documentType: string;
  title: string;
  description?: string;

  // The file itself
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  pageCount?: number;

  // Issue metadata (NAAC / NBA require these for evidence reports)
  issuingAuthority?: string;
  issuedAt?: Date;
  validUntil?: Date;
  referenceNumber?: string;

  // Verification workflow (Phase C wires the approve/reject endpoints —
  // v1 just lands here as 'pending')
  verificationStatus: FacultyDocumentVerificationStatus;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verificationNotes?: string;

  // OCR pipeline (Phase E AI verification agent)
  ocrStatus?: FacultyDocumentOcrStatus;
  ocrConfidence?: number;
  ocrExtractedData?: Record<string, unknown>;

  // Soft delete
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultyDocument>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    category: {
      type: String,
      enum: FACULTY_DOCUMENT_CATEGORIES,
      required: true,
    },
    documentType: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    s3Key: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    pageCount: { type: Number },

    issuingAuthority: { type: String, trim: true },
    issuedAt: { type: Date },
    validUntil: { type: Date },
    referenceNumber: { type: String, trim: true },

    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
      default: 'pending',
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    verificationNotes: { type: String, trim: true },

    ocrStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
    },
    ocrConfidence: { type: Number },
    ocrExtractedData: { type: Schema.Types.Mixed },

    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Primary listing pattern: render a faculty's documents grouped by
// category, excluding archived rows.
schema.index({ collegeId: 1, facultyId: 1, category: 1, archivedAt: 1 });

// Admin-queue lookup: "which docs are still pending verification?"
schema.index({ collegeId: 1, verificationStatus: 1, archivedAt: 1 });

export const FacultyDocument = model<IFacultyDocument>('FacultyDocument', schema);
