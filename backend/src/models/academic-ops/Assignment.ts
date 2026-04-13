import { Schema, model, Document } from 'mongoose';

export interface IAssignment extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  assessmentId?: Schema.Types.ObjectId;
  title: string;
  description: string;
  instructions?: string;
  maxMarks: number;
  dueDate: Date;
  publishedAt?: Date;
  status: string;
  coMappings?: { coCode: string; weight: number }[];
  attachments?: string[];
  createdBy: Schema.Types.ObjectId;
}

const schema = new Schema<IAssignment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'InternalAssessment' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  instructions: String,
  maxMarks: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  publishedAt: Date,
  status: { type: String, enum: ['draft', 'published', 'closed', 'graded'], default: 'draft' },
  coMappings: [{
    coCode: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 1 },
  }],
  attachments: [String],
  createdBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1 });

export const Assignment = model<IAssignment>('Assignment', schema);
