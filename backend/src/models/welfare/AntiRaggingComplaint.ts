import { Schema, model, Document } from 'mongoose';
export interface IAntiRaggingComplaint extends Document { collegeId: Schema.Types.ObjectId; complainantId?: Schema.Types.ObjectId; isAnonymous: boolean; accusedIds: Schema.Types.ObjectId[]; description: string; incidentDate: Date; severity: string; status: string; committeeRemarks?: string; actionTaken?: string; }
const schema = new Schema<IAntiRaggingComplaint>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  complainantId: { type: Schema.Types.ObjectId, ref: 'Person' },
  isAnonymous: { type: Boolean, default: false },
  accusedIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  description: { type: String, required: true },
  incidentDate: { type: Date, required: true },
  severity: { type: String, enum: ['minor', 'major', 'severe'], required: true },
  status: { type: String, enum: ['filed', 'investigating', 'action_taken', 'closed'], default: 'filed' },
  committeeRemarks: String,
  actionTaken: String,
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const AntiRaggingComplaint = model<IAntiRaggingComplaint>('AntiRaggingComplaint', schema);
