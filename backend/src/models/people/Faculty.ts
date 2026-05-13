import { Schema, model, Document } from 'mongoose';

/**
 * Faculty — academic-side personnel record.
 *
 * The `externalIds` sub-document is the NAAC-evidence floor for
 * Strategic Gap 1 (Faculty Profile depth). It carries the 33
 * external credential identifiers a Principal needs to populate
 * for a NAAC peer-team visit. Each field is an opaque string —
 * format validation is deferred to the AI verification agent
 * (Phase E in .captain/specs/faculty-profile-depth/spec.md).
 *
 * Fields are flat-but-grouped at the doc level (no nested
 * sub-documents per group) so we can index any single ID and
 * query Faculty by, e.g., ORCID across the entire college.
 */

/** 33 external credential IDs — see spec §AC-IDs for grouping. */
export interface IFacultyExternalIds {
  // Indian regulators / portals
  aicte?: string;
  aishe?: string;
  shodhganga?: string;
  irins?: string;
  vidwan?: string;
  // International research
  orcid?: string;
  scopus?: string;
  webOfScience?: string;
  researchGate?: string;
  googleScholar?: string;
  researcherId?: string;
  clarivate?: string;
  academia?: string;
  semanticScholar?: string;
  publons?: string;
  ssrn?: string;
  elsevierReviewer?: string;
  // Editorial / review
  springerReviewer?: string;
  // MOOC / learning
  swayam?: string;
  nptel?: string;
  nptelLearner?: string;
  atal?: string;
  // Code platforms
  github?: string;
  hackerRank?: string;
  hackerEarth?: string;
  leetCode?: string;
  replit?: string;
  codeChef?: string;
  exercism?: string;
  codecademy?: string;
  // Social & web
  linkedIn?: string;
  youtube?: string;
  website?: string;
}

export interface IFaculty extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId;
  employeeCode: string;
  designation: string;
  specialization?: string;
  qualification?: string;
  departmentId?: Schema.Types.ObjectId;
  contractType: string;
  status: string;
  externalIds?: IFacultyExternalIds;
}

// Sub-schema for the 33 credential identifiers. Sub-schemas keep the
// shape declarative and let us add field-level options (e.g. trim) in
// one place. `_id: false` because these are not addressable rows.
const externalIdsSchema = new Schema<IFacultyExternalIds>(
  {
    // Indian regulators / portals
    aicte: { type: String, trim: true },
    aishe: { type: String, trim: true },
    shodhganga: { type: String, trim: true },
    irins: { type: String, trim: true },
    vidwan: { type: String, trim: true },
    // International research
    orcid: { type: String, trim: true },
    scopus: { type: String, trim: true },
    webOfScience: { type: String, trim: true },
    researchGate: { type: String, trim: true },
    googleScholar: { type: String, trim: true },
    researcherId: { type: String, trim: true },
    clarivate: { type: String, trim: true },
    academia: { type: String, trim: true },
    semanticScholar: { type: String, trim: true },
    publons: { type: String, trim: true },
    ssrn: { type: String, trim: true },
    elsevierReviewer: { type: String, trim: true },
    // Editorial / review
    springerReviewer: { type: String, trim: true },
    // MOOC / learning
    swayam: { type: String, trim: true },
    nptel: { type: String, trim: true },
    nptelLearner: { type: String, trim: true },
    atal: { type: String, trim: true },
    // Code platforms
    github: { type: String, trim: true },
    hackerRank: { type: String, trim: true },
    hackerEarth: { type: String, trim: true },
    leetCode: { type: String, trim: true },
    replit: { type: String, trim: true },
    codeChef: { type: String, trim: true },
    exercism: { type: String, trim: true },
    codecademy: { type: String, trim: true },
    // Social & web
    linkedIn: { type: String, trim: true },
    youtube: { type: String, trim: true },
    website: { type: String, trim: true },
  },
  { _id: false },
);

const schema = new Schema<IFaculty>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    employeeCode: { type: String, required: true },
    designation: { type: String, required: true },
    specialization: String,
    qualification: String,
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    contractType: { type: String, enum: ['regular', 'contract', 'adjunct', 'visiting'], default: 'regular' },
    status: { type: String, enum: ['active', 'on_leave', 'separated'], default: 'active' },
    externalIds: { type: externalIdsSchema, default: undefined },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, employeeCode: 1 }, { unique: true });

export const Faculty = model<IFaculty>('Faculty', schema);
