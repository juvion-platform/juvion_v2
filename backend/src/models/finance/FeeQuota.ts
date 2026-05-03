import { Schema, model, Document, Types } from 'mongoose';

/**
 * FeeQuota — admin-managed list of admission-quota codes per college
 * (e.g. convener, management, nri, spot, lateral). The `code` is the
 * stable string used for matching against `Student.quota` and
 * `FeeStructureInstance.quota`. The fee-pin-service resolver matches
 * by string equality (`student.quota === fsi.quota`), so the wire
 * contract MUST stay a string code, not an ObjectId.
 *
 * Mirrors `FeeCategory` exactly — a parallel CRUD surface so admins
 * can extend the catalog without touching the model. Multi-tenancy:
 * every row carries `collegeId`. The composite unique index
 * `(collegeId, code)` enforces "one row per (college, code)". Two
 * colleges may independently declare the same code (e.g. both
 * having `convener`).
 */
export type FeeQuotaStatus = 'active' | 'inactive';

export interface IFeeQuota extends Document {
  collegeId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  status: FeeQuotaStatus;
}

const schema = new Schema<IFeeQuota>(
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

// `code` is unique per college. Distinct colleges may independently
// declare the same code value.
schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const FeeQuota = model<IFeeQuota>('FeeQuota', schema);
