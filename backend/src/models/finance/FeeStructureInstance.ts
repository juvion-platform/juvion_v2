import { Schema, model, Document } from 'mongoose';

/**
 * FeeStructureInstance — the row a student gets pinned to when the
 * fee-pin-service resolves their combination of academic axes against
 * the published fee catalogue.
 *
 * ── Lookup axes (single source of truth for the matcher) ──
 *
 *   Required (must match exactly — `resolveMatchingFeeStructureInstance`
 *   uses these as the base-filter columns; misconfiguration here yields
 *   zero candidates and a soft-fail at the pin call site):
 *     - collegeId
 *     - academicYearId    (the calendar year the structure applies to)
 *     - programmeId
 *     - status: 'active'
 *
 *   Wildcardable (null/absent on the instance = match any value on the
 *   student; specific value on the instance = match only that exact
 *   value; mismatch = reject candidate). Scoring prefers EXACT > WILDCARD:
 *     - branchId          (null = any branch under the programme)
 *     - category          (null = any reservation category)
 *     - quota             (null = any quota)
 *     - yearOfStudy       (null = any year of study — backward-compatible
 *                          for FSIs that pre-date this field)
 *
 *   NOT a fee axis:
 *     - Course (subject-level entity in academic-ops/Course.ts). The fee
 *       catalogue is per-programme/year, never per-course. See the SDD
 *       discovery doc `.sdd/discovery/005-fee-mapping-architecture/`
 *       for the rationale.
 */
export interface IFeeStructureInstance extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  category?: string;
  quota?: string;
  /**
   * Optional explicit year-of-study (1–8). When set, the fee-pin
   * matcher will only pin a student whose `pinYear` argument equals
   * this value. When absent (the pre-existing shape), the instance is
   * a wildcard across years — matches whichever year is being pinned.
   * Surfacing this as a column rather than inferring it from
   * AcademicYear context is the §005 clarity fix.
   */
  yearOfStudy?: number;
  status: string;
  effectiveDate?: Date;
  totalAmount: number;
  priorVersionId?: Schema.Types.ObjectId;
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  rejectionComments?: string;
  revenueProjection?: number;
  comparisonData?: Record<string, unknown>;
}

const schema = new Schema<IFeeStructureInstance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  // Wildcardable: null/absent = match any branch under the programme.
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  // Wildcardable: null/absent = match any reservation category.
  category: { type: String },
  // Wildcardable: null/absent = match any quota. Codes come from the
  // admin-managed FeeQuota CRUD (/api/finance/fee-quotas) and are
  // matched by string-equality against `Student.quota` in fee-pin-service.
  quota: { type: String },
  // Wildcardable: null/absent = match any year of study (backward
  // compatible for FSIs that pre-date this field). When set, the
  // matcher refuses to pin a student whose target year differs.
  yearOfStudy: { type: Number, min: 1, max: 8 },
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'active', 'superseded', 'archived', 'revision_required'], required: true, default: 'draft' },
  effectiveDate: Date,
  totalAmount: { type: Number, required: true, default: 0 },
  priorVersionId: { type: Schema.Types.ObjectId, ref: 'FeeStructureInstance' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  approvedAt: Date,
  rejectionComments: String,
  revenueProjection: Number,
  comparisonData: Schema.Types.Mixed,
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, programmeId: 1, status: 1 });
// Year-of-study is the §005 axis admins will most often filter the FSI
// list by ("show me Year 2 fees"). Sparse so legacy rows without the
// field don't appear empty-keyed in the index.
schema.index({ collegeId: 1, programmeId: 1, yearOfStudy: 1 }, { sparse: true });

export const FeeStructureInstance = model<IFeeStructureInstance>('FeeStructureInstance', schema);
