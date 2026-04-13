import { Schema, model, Document } from 'mongoose';

export interface IAppraisal extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  reviewerId: Schema.Types.ObjectId;
  selfRating?: number;
  reviewerRating?: number;
  finalRating?: number;
  goals: { description: string; weightage: number; rating?: number }[];
  status: string;
  // Phase 3 — FDP/Appraisal enhancements
  appraisalCycleId?: Schema.Types.ObjectId;
  appraisalType?: 'faculty' | 'staff';
  selfAssessmentData?: Record<string, unknown>;
  aggregatedData?: Record<string, unknown>;
  aggregatedSources?: { source: string; module: string; data: unknown; weight: number }[];
  reviewerComments?: string;
  moderationAdjustment?: number;
  moderatedBy?: Schema.Types.ObjectId;
  disputeStatus?: 'none' | 'pending' | 'resolved';
  disputeText?: string;
  disputeResolvedBy?: Schema.Types.ObjectId;
  outcomeType?: 'standard_increment' | 'promotion' | 'pip' | 'no_change';
}

const aggregatedSourceSchema = new Schema({
  source: { type: String, required: true },
  module: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  weight: { type: Number, required: true },
}, { _id: false });

const schema = new Schema<IAppraisal>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  selfRating: Number,
  reviewerRating: Number,
  finalRating: Number,
  goals: [{ description: String, weightage: Number, rating: Number }],
  status: {
    type: String,
    enum: [
      'initiated', 'self_review', 'reviewer_review', 'completed',
      'self_assessment_pending', 'self_assessment_complete', 'aggregation_complete',
      'reviewer_pending', 'reviewer_complete', 'moderated', 'finalized',
      'disputed', 'dispute_resolved',
    ],
    default: 'initiated',
  },
  // Phase 3 fields
  appraisalCycleId: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle' },
  appraisalType: { type: String, enum: ['faculty', 'staff'] },
  selfAssessmentData: { type: Schema.Types.Mixed },
  aggregatedData: { type: Schema.Types.Mixed },
  aggregatedSources: [aggregatedSourceSchema],
  reviewerComments: String,
  moderationAdjustment: Number,
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  disputeStatus: { type: String, enum: ['none', 'pending', 'resolved'], default: 'none' },
  disputeText: String,
  disputeResolvedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  outcomeType: { type: String, enum: ['standard_increment', 'promotion', 'pip', 'no_change'] },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, academicYearId: 1 });

export const Appraisal = model<IAppraisal>('Appraisal', schema);
