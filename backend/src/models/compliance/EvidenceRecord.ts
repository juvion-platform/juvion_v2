import { Schema, model, Document } from 'mongoose';

export interface IEvidenceRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  accreditationCycleId?: Schema.Types.ObjectId;
  criterionCode: string;
  evidenceType: string;
  title: string;
  description?: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId?: Schema.Types.ObjectId;
  data: Record<string, any>;
  semesterId?: Schema.Types.ObjectId;
  status: string;
  uploadedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IEvidenceRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  accreditationCycleId: { type: Schema.Types.ObjectId, ref: 'AccreditationCycle' },
  criterionCode: { type: String, required: true },
  evidenceType: { type: String, enum: ['co_attainment', 'po_attainment', 'pass_rate', 'faculty_metrics', 'attendance', 'feedback', 'other'], required: true },
  title: { type: String, required: true },
  description: String,
  sourceModule: { type: String, required: true },
  sourceEntityType: { type: String, required: true },
  sourceEntityId: Schema.Types.ObjectId,
  data: { type: Schema.Types.Mixed, required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
  status: { type: String, enum: ['draft', 'submitted', 'accepted', 'rejected'], required: true, default: 'draft' },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, criterionCode: 1 });
schema.index({ collegeId: 1, accreditationCycleId: 1 });

export const EvidenceRecord = model<IEvidenceRecord>('EvidenceRecord', schema);
