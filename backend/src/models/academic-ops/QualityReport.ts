import { Schema, model, Document } from 'mongoose';

export interface IQualityReport extends Document {
  collegeId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  reportType: string;
  title: string;
  generatedAt: Date;
  generatedBy: Schema.Types.ObjectId;
  data: Record<string, any>;
  status: string;
}

const schema = new Schema<IQualityReport>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  reportType: { type: String, enum: ['obe_summary', 'programme_health', 'naac_self_study'], required: true },
  title: { type: String, required: true },
  generatedAt: { type: Date, required: true, default: Date.now },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  data: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['draft', 'finalized'], required: true, default: 'draft' },
}, { timestamps: true });

schema.index({ collegeId: 1, programmeId: 1, semesterId: 1 });

export const QualityReport = model<IQualityReport>('QualityReport', schema);
