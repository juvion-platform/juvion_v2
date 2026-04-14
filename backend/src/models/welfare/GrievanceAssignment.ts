import { Schema, model, Document } from 'mongoose';
export interface IGrievanceAssignment extends Document { collegeId: Schema.Types.ObjectId; grievanceId: Schema.Types.ObjectId; assignedTo: Schema.Types.ObjectId; assignedBy: string; department?: string; assignedAt: Date; acceptedAt?: Date; status: string; }
const schema = new Schema<IGrievanceAssignment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  grievanceId: { type: Schema.Types.ObjectId, ref: 'StudentGrievance', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  assignedBy: { type: String, required: true },
  department: String,
  assignedAt: { type: Date, required: true, default: Date.now },
  acceptedAt: Date,
  status: { type: String, enum: ['pending', 'accepted', 'reassigned', 'completed'], default: 'pending' },
}, { timestamps: true });
schema.index({ collegeId: 1, grievanceId: 1 });
export const GrievanceAssignment = model<IGrievanceAssignment>('GrievanceAssignment', schema);
