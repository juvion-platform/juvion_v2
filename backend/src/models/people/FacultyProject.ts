import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultyProject — sponsored / funded research projects with NAAC
 * 3.1 / 3.2 metadata. Strategic Gap 1 original Phase B (research
 * outputs).
 *
 * NAAC criteria the field set explicitly serves:
 *   - 3.1.1 / 3.1.2 (Number of departments / faculty with projects)
 *   - 3.1.3        (Average sponsored research per teacher)
 *   - 3.2.1 / 3.2.2(Funding source breakdown — government / industry)
 *
 * Distinct from FacultyPatent (IP) and FacultyPublication (papers);
 * `agencyType` is the NAAC-mandated discriminator (government /
 * industry / international / non-government).
 */

export type FacultyProjectStatus =
  | 'proposed'
  | 'ongoing'
  | 'completed'
  | 'terminated';

export type FacultyProjectAgencyType =
  | 'government_national'
  | 'government_state'
  | 'industry'
  | 'international'
  | 'non_government'
  | 'internal';

export type FacultyProjectInvestigatorRole =
  | 'pi'      // Principal Investigator
  | 'co_pi'
  | 'investigator';

export interface IFacultyProject extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  title: string;
  fundingAgency: string;
  agencyType: FacultyProjectAgencyType;
  investigatorRole: FacultyProjectInvestigatorRole;
  /** Comma-separated co-investigators. */
  coInvestigators?: string;

  /** Amount in INR. NAAC weights `agencyType` × `sanctionAmount`. */
  sanctionAmount: number;
  sanctionOrderNumber?: string;
  sanctionOrderUrl?: string;

  sanctionDate?: Date;
  startDate: Date;
  endDate?: Date;
  durationMonths?: number;

  status: FacultyProjectStatus;

  abstract?: string;
  outcomes?: string;
  notes?: string;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultyProject>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    title: { type: String, required: true, trim: true },
    fundingAgency: { type: String, required: true, trim: true },
    agencyType: {
      type: String,
      enum: ['government_national', 'government_state', 'industry', 'international', 'non_government', 'internal'],
      required: true,
      default: 'government_national',
    },
    investigatorRole: {
      type: String,
      enum: ['pi', 'co_pi', 'investigator'],
      required: true,
      default: 'pi',
    },
    coInvestigators: { type: String, trim: true },

    sanctionAmount: { type: Number, required: true, min: 0 },
    sanctionOrderNumber: { type: String, trim: true },
    sanctionOrderUrl: { type: String, trim: true },

    sanctionDate: { type: Date },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    durationMonths: { type: Number, min: 0 },

    status: {
      type: String,
      enum: ['proposed', 'ongoing', 'completed', 'terminated'],
      required: true,
      default: 'ongoing',
    },

    abstract: { type: String, trim: true },
    outcomes: { type: String, trim: true },
    notes: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, facultyId: 1, archivedAt: 1 });
schema.index({ collegeId: 1, agencyType: 1, status: 1 });

export const FacultyProject = model<IFacultyProject>('FacultyProject', schema);
