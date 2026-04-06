import { Schema, model, Document } from 'mongoose';
export interface IHealthRecord extends Document { collegeId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; bloodGroup?: string; allergies: string[]; chronicConditions: string[]; emergencyContact: string; emergencyPhone: string; insuranceId?: string; }
const schema = new Schema<IHealthRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
  allergies: [String],
  chronicConditions: [String],
  emergencyContact: { type: String, required: true },
  emergencyPhone: { type: String, required: true },
  insuranceId: String,
}, { timestamps: true });
schema.index({ collegeId: 1, personId: 1 }, { unique: true });
export const HealthRecord = model<IHealthRecord>('HealthRecord', schema);
