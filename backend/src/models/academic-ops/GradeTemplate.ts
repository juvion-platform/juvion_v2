import { Schema, model, Document, Types } from 'mongoose';

/**
 * GradeTemplate — grading scheme configuration. Strategic Gap 6 Phase A.
 *
 * Mirrors the CampX GradeTemplate dimension cross-product:
 *   scheme       absolute | relative
 *   basis        marks    | percentage
 *
 * `bands` define the cutoff → grade-letter mapping. For percentage-
 * basis, `minValue` is %; for marks-basis, `minValue` is raw marks
 * out of `maxMarks`. For `relative` schemes, the bands are typically
 * a histogram-percentile mapping (top 10% → O, next 15% → A+, …),
 * and `minValue` then represents the lower-bound percentile.
 *
 * `programmeId` / `regulationId` scope the template — a programme can
 * have multiple regulations (R20, R23) each with its own grade scheme.
 * Empty `programmeId` means "default for the college".
 */
export type GradeScheme = 'absolute' | 'relative';
export type GradeBasis = 'marks' | 'percentage';

export interface IGradeBand {
  letter: string;
  minValue: number;
  gradePoint?: number;
  remark?: string;
}

export interface IGradeTemplate extends Document {
  collegeId: Types.ObjectId;
  name: string;
  scheme: GradeScheme;
  basis: GradeBasis;
  maxMarks?: number;
  bands: IGradeBand[];
  /** Optional scoping — leave empty for college-wide default. */
  programmeId?: Types.ObjectId;
  regulationId?: Types.ObjectId;
  status: 'active' | 'inactive';
  description?: string;
}

const bandSchema = new Schema<IGradeBand>(
  {
    letter: { type: String, required: true, trim: true },
    minValue: { type: Number, required: true },
    gradePoint: { type: Number, min: 0, max: 10 },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const schema = new Schema<IGradeTemplate>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    scheme: { type: String, enum: ['absolute', 'relative'], required: true },
    basis: { type: String, enum: ['marks', 'percentage'], required: true },
    maxMarks: { type: Number, min: 0 },
    bands: { type: [bandSchema], default: [] },
    programmeId: { type: Schema.Types.ObjectId, ref: 'Programme' },
    regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    description: { type: String, trim: true },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, programmeId: 1, regulationId: 1 });

export const GradeTemplate = model<IGradeTemplate>('GradeTemplate', schema);
