import { Schema, model, Document, Types } from 'mongoose';

/**
 * FeeCategory — admin-managed list of student-reservation categories per
 * college (e.g. OC, OBC, SC, ST, NRI). The `code` is the stable string used
 * for matching against `FeeStructure.category` (a free-text field that
 * `fee-pin-service` resolves by string equality against `student.category`).
 *
 * Storing the catalog separately gives admins a CRUD surface to manage the
 * codes shown in the FeeStructures form dropdown without changing the wire
 * contract that downstream services rely on (string code, not an ObjectId).
 *
 * Multi-tenancy: every row carries `collegeId`. The composite unique index
 * `(collegeId, code)` enforces "one row per (college, code)". Two colleges
 * may independently declare the same code (e.g. both having `OC`).
 */
export type FeeCategoryStatus = 'active' | 'inactive';

export interface IFeeCategory extends Document {
  collegeId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  status: FeeCategoryStatus;
}

const schema = new Schema<IFeeCategory>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      required: true,
      default: 'active',
    },
  },
  { timestamps: true },
);

// `code` is unique per college. Distinct colleges may independently declare
// the same code value.
schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const FeeCategory = model<IFeeCategory>('FeeCategory', schema);
