import { Schema, model, Document } from 'mongoose';
export interface IStudentGrievance extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; category: string; subject: string; description: string; priority: string; assignedTo?: Schema.Types.ObjectId; status: string; resolution?: string; resolvedAt?: Date; }
const schema = new Schema<IStudentGrievance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  category: { type: String, enum: ['academic', 'hostel', 'mess', 'transport', 'infrastructure', 'fee', 'other'], required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  resolution: String,
  resolvedAt: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const StudentGrievance = model<IStudentGrievance>('StudentGrievance', schema);
