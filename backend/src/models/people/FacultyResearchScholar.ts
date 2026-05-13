import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultyResearchScholar — research students guided by a faculty
 * member (PhD, M.Tech, M.Phil, undergrad project). Strategic Gap 1
 * Phase D.
 *
 * NAAC criterion: 3.4.2 (Number of PhDs awarded under faculty
 * guidance) — counted directly off this collection. The
 * `status: 'awarded'` rows are the NAAC-evidence subset.
 *
 * Multi-tenancy: every row carries `collegeId`. Index on
 * (collegeId, facultyId) drives the per-faculty panel.
 */

export type FacultyResearchScholarType =
  | 'phd'
  | 'mtech'
  | 'mphil'
  | 'undergrad_project';

export type FacultyResearchScholarStatus =
  | 'ongoing'
  | 'completed'
  | 'discontinued'
  | 'awarded';

export interface IFacultyResearchScholar extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  scholarName: string;
  scholarType: FacultyResearchScholarType;
  topic: string;

  registrationYear: number;
  completionYear?: number;
  status: FacultyResearchScholarStatus;

  /** Free-text co-guide name. Could become a Faculty ref in a future phase. */
  coGuide?: string;
  /** Institution where the scholar was registered. Defaults to the faculty's own institution. */
  university?: string;
  /** Shodhganga / institution-repository URL. */
  thesisLink?: string;
  notes?: string;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultyResearchScholar>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    scholarName: { type: String, required: true, trim: true },
    scholarType: {
      type: String,
      enum: ['phd', 'mtech', 'mphil', 'undergrad_project'],
      required: true,
      default: 'phd',
    },
    topic: { type: String, required: true, trim: true },

    registrationYear: { type: Number, required: true, min: 1950, max: 2100 },
    completionYear: { type: Number, min: 1950, max: 2100 },
    status: {
      type: String,
      enum: ['ongoing', 'completed', 'discontinued', 'awarded'],
      required: true,
      default: 'ongoing',
    },
    coGuide: { type: String, trim: true },
    university: { type: String, trim: true },
    thesisLink: { type: String, trim: true },
    notes: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, facultyId: 1, archivedAt: 1 });
schema.index({ collegeId: 1, status: 1, archivedAt: 1 });

export const FacultyResearchScholar = model<IFacultyResearchScholar>(
  'FacultyResearchScholar',
  schema,
);
