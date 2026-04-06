import { Schema, model, Document } from 'mongoose';

export interface ICourseOutcome extends Document {
  collegeId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId; code: string; description: string; bloomLevel: string; poMappings: { poCode: string; level: number }[];
}

const schema = new Schema<ICourseOutcome>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  code: { type: String, required: true },
  description: { type: String, required: true },
  bloomLevel: { type: String, enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'], required: true },
  poMappings: [{ poCode: String, level: Number }],
}, { timestamps: true });

schema.index({ collegeId: 1, courseId: 1, code: 1 }, { unique: true });

export const CourseOutcome = model<ICourseOutcome>('CourseOutcome', schema);
