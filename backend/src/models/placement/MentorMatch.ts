import { Schema, model, Document } from 'mongoose';

export interface IMentorMatch extends Document {
  collegeId: Schema.Types.ObjectId;
  alumniId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  matchScore: number;
  matchReasons: string[];
  status: 'suggested' | 'approved_by_tpo' | 'introduced' | 'active' | 'closed' | 'declined';
  approvedBy?: Schema.Types.ObjectId;
  introducedAt?: Date;
  lastInteractionAt?: Date;
}

const schema = new Schema<IMentorMatch>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  alumniId: { type: Schema.Types.ObjectId, ref: 'Alumni', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  matchScore: { type: Number, min: 0, max: 100, required: true },
  matchReasons: [{ type: String }],
  status: { type: String, enum: ['suggested', 'approved_by_tpo', 'introduced', 'active', 'closed', 'declined'], default: 'suggested' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  introducedAt: Date,
  lastInteractionAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, alumniId: 1 });
schema.index({ collegeId: 1, studentId: 1 });

export const MentorMatch = model<IMentorMatch>('MentorMatch', schema);
