import { Schema, model, Document } from 'mongoose';

export interface IExamRegistration extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; courseOfferingId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; examType: string; isEligible: boolean; registeredAt: Date; status: string;
}

const schema = new Schema<IExamRegistration>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  examType: { type: String, enum: ['regular', 'supplementary', 'improvement'], required: true },
  isEligible: { type: Boolean, default: true },
  registeredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['registered', 'approved', 'rejected', 'appeared', 'absent'], default: 'registered' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 });

export const ExamRegistration = model<IExamRegistration>('ExamRegistration', schema);
