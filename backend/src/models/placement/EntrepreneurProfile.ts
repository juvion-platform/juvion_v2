import { Schema, model, Document } from 'mongoose';

export interface IEntrepreneurProfile extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; ventureIdea: string; stage: string; mentorId?: Schema.Types.ObjectId; incubationStatus: string;
}

const schema = new Schema<IEntrepreneurProfile>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  ventureIdea: { type: String, required: true },
  stage: { type: String, enum: ['ideation', 'prototype', 'launched', 'scaled'], default: 'ideation' },
  mentorId: { type: Schema.Types.ObjectId, ref: 'Faculty' },
  incubationStatus: { type: String, enum: ['not_applied', 'applied', 'accepted', 'graduated'], default: 'not_applied' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const EntrepreneurProfile = model<IEntrepreneurProfile>('EntrepreneurProfile', schema);
