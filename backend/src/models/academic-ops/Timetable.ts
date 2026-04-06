import { Schema, model, Document } from 'mongoose';

export interface ITimetable extends Document {
  collegeId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId; sectionId: Schema.Types.ObjectId; version: number; status: string; effectiveFrom: Date;
}

const schema = new Schema<ITimetable>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  effectiveFrom: { type: Date, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, semesterId: 1, sectionId: 1 });

export const Timetable = model<ITimetable>('Timetable', schema);
