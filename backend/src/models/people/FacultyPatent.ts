import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultyPatent — IP filings (filed / published / granted /
 * abandoned). Strategic Gap 1 original Phase B (research outputs).
 *
 * NAAC criterion 3.3 also tracks patents per teacher, weighted by
 * jurisdiction (international vs national) and lifecycle stage
 * (filed vs granted). The `status` + `jurisdiction` fields produce
 * the row classification NAAC needs.
 *
 * Patent numbers are jurisdiction-formatted strings — we don't
 * validate format (varies by country) but the field exists so the
 * exported NAAC report can include it verbatim.
 */

export type FacultyPatentStatus =
  | 'filed'
  | 'published'
  | 'granted'
  | 'abandoned'
  | 'expired';

export type FacultyPatentInventorRole =
  | 'sole_inventor'
  | 'first_inventor'
  | 'co_inventor';

export interface IFacultyPatent extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  title: string;
  /** Comma-separated inventor list. */
  inventors: string;
  inventorRole: FacultyPatentInventorRole;
  /** Free-text jurisdiction ('india', 'us', 'wo' for WIPO, etc.). */
  jurisdiction: string;

  applicationNumber: string;
  /** Set only when granted. */
  patentNumber?: string;
  /** IPC / CPC classification (single string; multi-class via comma). */
  ipcClassification?: string;

  filingDate: Date;
  /** Date the patent office published the application. */
  publicationDate?: Date;
  /** Date granted (status='granted' only). */
  grantDate?: Date;

  status: FacultyPatentStatus;

  /** Defaults to the home institution when blank. */
  assignee?: string;
  abstract?: string;
  notes?: string;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultyPatent>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    title: { type: String, required: true, trim: true },
    inventors: { type: String, required: true, trim: true },
    inventorRole: {
      type: String,
      enum: ['sole_inventor', 'first_inventor', 'co_inventor'],
      required: true,
      default: 'co_inventor',
    },
    jurisdiction: { type: String, required: true, trim: true },

    applicationNumber: { type: String, required: true, trim: true },
    patentNumber: { type: String, trim: true },
    ipcClassification: { type: String, trim: true },

    filingDate: { type: Date, required: true },
    publicationDate: { type: Date },
    grantDate: { type: Date },

    status: {
      type: String,
      enum: ['filed', 'published', 'granted', 'abandoned', 'expired'],
      required: true,
      default: 'filed',
    },

    assignee: { type: String, trim: true },
    abstract: { type: String, trim: true },
    notes: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, facultyId: 1, archivedAt: 1 });
schema.index({ collegeId: 1, status: 1, jurisdiction: 1 });

export const FacultyPatent = model<IFacultyPatent>('FacultyPatent', schema);
