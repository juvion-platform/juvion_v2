import { Schema, model, Document } from 'mongoose';

export interface ISkillRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; skillName: string; category: string; source: string; score?: number; percentile?: number; vendor?: string; assessedAt?: Date; verificationStatus: string;
}

const schema = new Schema<ISkillRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  skillName: { type: String, required: true },
  category: { type: String, enum: ['aptitude', 'technical', 'soft_skills', 'domain'], required: true },
  source: { type: String, enum: ['assessment', 'training_assessment', 'self_reported', 'certification', 'mock_interview'], required: true },
  score: Number,
  percentile: Number,
  vendor: String,
  assessedAt: Date,
  verificationStatus: { type: String, enum: ['unverified', 'verified', 'rejected'], default: 'unverified' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, skillName: 1 });
schema.index({ collegeId: 1, category: 1 });

export const SkillRecord = model<ISkillRecord>('SkillRecord', schema);
