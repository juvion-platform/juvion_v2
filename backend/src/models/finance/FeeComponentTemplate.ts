import { Schema, model, Document, Types } from 'mongoose';

/**
 * FeeComponentTemplate — canonical catalog of fee components per college.
 *
 * Per plan §2.2. A college's seed of 30 default components is inserted
 * on onboarding (T2) and serves as the scaffold Finance Officers start
 * from when drafting a new FeeStructureInstance. Custom components are
 * `isDefault: false` and may be freely added/edited/deleted by the
 * college.
 */
export type FeeComponentTemplateCategory =
  | 'academic'
  | 'admission_oneoff'
  | 'lab'
  | 'infrastructure'
  | 'student_life'
  | 'regulatory'
  | 'caution'
  | 'conditional';

export interface IFeeComponentTemplate extends Document {
  collegeId: Types.ObjectId;
  componentKey: string;
  displayLabel: string;
  category: FeeComponentTemplateCategory;
  isRefundable: boolean;
  defaultOneTime: boolean;
  applicableToYears: number[];
  displayOrder: number;
  isDefault: boolean;
}

const schema = new Schema<IFeeComponentTemplate>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    componentKey: { type: String, required: true, trim: true },
    displayLabel: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        'academic',
        'admission_oneoff',
        'lab',
        'infrastructure',
        'student_life',
        'regulatory',
        'caution',
        'conditional',
      ],
      required: true,
    },
    isRefundable: { type: Boolean, required: true, default: false },
    defaultOneTime: { type: Boolean, required: true, default: false },
    applicableToYears: { type: [Number], default: [] },
    displayOrder: { type: Number, required: true, default: 0 },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

// componentKey is the stable identifier per (college). Duplicates of the
// same key within a single college are invalid; different colleges may
// independently own the same key (plan §2.2).
schema.index({ collegeId: 1, componentKey: 1 }, { unique: true });

export const FeeComponentTemplate = model<IFeeComponentTemplate>(
  'FeeComponentTemplate',
  schema,
);
