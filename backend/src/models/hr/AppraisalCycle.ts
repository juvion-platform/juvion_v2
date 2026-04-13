import { Schema, model, Document } from 'mongoose';

export interface IAppraisalCycle extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  selfAssessmentDeadline: Date;
  reviewerDeadline: Date;
  moderationDeadline: Date;
  applicableTo: 'faculty' | 'staff' | 'both';
  weightageTemplate?: Record<string, number>;
  status: string;
}

const schema = new Schema<IAppraisalCycle>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  selfAssessmentDeadline: { type: Date, required: true },
  reviewerDeadline: { type: Date, required: true },
  moderationDeadline: { type: Date, required: true },
  applicableTo: { type: String, enum: ['faculty', 'staff', 'both'], required: true },
  weightageTemplate: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['configured', 'open', 'self_assessment', 'review', 'moderation', 'closed'], default: 'configured' },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1 });
schema.index({ collegeId: 1, status: 1 });

export const AppraisalCycle = model<IAppraisalCycle>('AppraisalCycle', schema);
