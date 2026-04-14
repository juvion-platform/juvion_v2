import { Schema, model, Document } from 'mongoose';

export interface IFacultyWorkload extends Document {
  collegeId: Schema.Types.ObjectId;
  facultyId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  courseOfferings: {
    courseOfferingId: Schema.Types.ObjectId;
    credits: number;
    contactHours: number;
  }[];
  totalCredits: number;
  totalContactHours: number;
  maxCredits: number;
  maxContactHours: number;
  status: string;
  approvedOverload: boolean;
  approvedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IFacultyWorkload>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  courseOfferings: [{
    courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    credits: { type: Number, required: true },
    contactHours: { type: Number, required: true },
  }],
  totalCredits: { type: Number, default: 0 },
  totalContactHours: { type: Number, default: 0 },
  maxCredits: { type: Number, default: 24 },
  maxContactHours: { type: Number, default: 20 },
  status: { type: String, enum: ['under_limit', 'at_limit', 'overloaded'], default: 'under_limit' },
  approvedOverload: { type: Boolean, default: false },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, facultyId: 1, semesterId: 1 }, { unique: true });

export const FacultyWorkload = model<IFacultyWorkload>('FacultyWorkload', schema);
