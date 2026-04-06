import { Schema, model, Document } from 'mongoose';

export interface IElectiveAllocation extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; electiveGroup: string; courseId: Schema.Types.ObjectId; preference: number; status: string;
}

const schema = new Schema<IElectiveAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  electiveGroup: { type: String, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  preference: { type: Number, required: true },
  status: { type: String, enum: ['requested', 'allocated', 'rejected'], default: 'requested' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1, electiveGroup: 1 });

export const ElectiveAllocation = model<IElectiveAllocation>('ElectiveAllocation', schema);
