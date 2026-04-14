import { Schema, model, Document } from 'mongoose';
export interface IMentorAssignment extends Document { collegeId: Schema.Types.ObjectId; mentorId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; semesterId?: Schema.Types.ObjectId; assignedDate: Date; assignedBy: Schema.Types.ObjectId; status: string; aiSuggested: boolean; }
const schema = new Schema<IMentorAssignment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
  assignedDate: { type: Date, required: true, default: Date.now },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  status: { type: String, enum: ['active', 'transferred', 'completed'], default: 'active' },
  aiSuggested: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ collegeId: 1, mentorId: 1, status: 1 });
schema.index({ collegeId: 1, studentId: 1, status: 1 });
export const MentorAssignment = model<IMentorAssignment>('MentorAssignment', schema);
