import { Schema, model, Document } from 'mongoose';
export interface IDietaryPreference extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; dietType: string; allergies: string[]; medicalDiet?: string; notes?: string; }
const schema = new Schema<IDietaryPreference>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  dietType: { type: String, enum: ['veg', 'non_veg', 'egg', 'vegan', 'jain'], required: true },
  allergies: [String],
  medicalDiet: String,
  notes: String,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 }, { unique: true });
export const DietaryPreference = model<IDietaryPreference>('DietaryPreference', schema);
