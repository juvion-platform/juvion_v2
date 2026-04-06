import { Schema, model, Document } from 'mongoose';
export interface IIQACReport extends Document { collegeId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; reportType: string; data: Record<string, any>; submittedDate?: Date; status: string; }
const schema = new Schema<IIQACReport>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true }, reportType: { type: String, enum: ['aqar', 'ssr', 'annual_report', 'best_practices', 'feedback_analysis'], required: true }, data: Schema.Types.Mixed, submittedDate: Date, status: { type: String, enum: ['draft', 'review', 'submitted', 'accepted'], default: 'draft' } }, { timestamps: true });
schema.index({ collegeId: 1, academicYearId: 1, reportType: 1 });
export const IQACReport = model<IIQACReport>('IQACReport', schema);
