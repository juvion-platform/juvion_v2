import { Schema, model, Document } from 'mongoose';

export interface IPromotionDecision extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  fromYear: number;
  toYear?: number;
  decision: string;
  reason?: string;
  totalBacklogs: number;
  boardMeetingDate?: Date;
  approvedBy?: Schema.Types.ObjectId;
  effectiveDate?: Date;
}

const schema = new Schema<IPromotionDecision>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  fromYear: { type: Number, required: true },
  toYear: Number,
  decision: { type: String, enum: ['promoted', 'detained', 'year_back', 'graduated', 'rusticated'], required: true },
  reason: String,
  totalBacklogs: { type: Number, required: true, default: 0 },
  boardMeetingDate: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  effectiveDate: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 }, { unique: true });
schema.index({ collegeId: 1, academicYearId: 1 });

export const PromotionDecision = model<IPromotionDecision>('PromotionDecision', schema);
