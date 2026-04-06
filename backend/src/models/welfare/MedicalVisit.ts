import { Schema, model, Document } from 'mongoose';
export interface IMedicalVisit extends Document { collegeId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; visitDate: Date; complaint: string; diagnosis?: string; prescription?: string; referredTo?: string; attendedBy: string; followUpDate?: Date; }
const schema = new Schema<IMedicalVisit>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  visitDate: { type: Date, default: Date.now },
  complaint: { type: String, required: true },
  diagnosis: String,
  prescription: String,
  referredTo: String,
  attendedBy: { type: String, required: true },
  followUpDate: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, personId: 1, visitDate: -1 });
export const MedicalVisit = model<IMedicalVisit>('MedicalVisit', schema);
