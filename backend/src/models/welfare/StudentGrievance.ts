import { Schema, model, Document } from 'mongoose';
export interface IStudentGrievance extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; category: string; subject: string; description: string; priority: string; assignedTo?: Schema.Types.ObjectId; status: string; resolution?: string; resolvedAt?: Date; isAnonymous: boolean; encryptedIdentity?: string; aiClassification?: any; severity: string; sla?: any; handlerDepartment?: string; escalationHistory: any[]; internalNotes: any[]; duplicateOf?: Schema.Types.ObjectId; feedbackRating?: number; feedbackComment?: string; reopenCount: number; reopenHistory: any[]; }
const schema = new Schema<IStudentGrievance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  category: { type: String, enum: ['academic', 'hostel', 'mess', 'transport', 'infrastructure', 'fee', 'other', 'administrative', 'interpersonal', 'service'], required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed', 'escalated', 'reopened', 'awaiting_feedback'], default: 'open' },
  resolution: String,
  resolvedAt: Date,
  isAnonymous: { type: Boolean, default: false },
  encryptedIdentity: String,
  aiClassification: {
    suggestedCategory: String,
    suggestedSeverity: { type: String, enum: ['P1', 'P2', 'P3'] },
    confidence: Number,
    duplicateCandidates: [{ type: Schema.Types.ObjectId, ref: 'StudentGrievance' }],
    classifiedAt: Date,
  },
  severity: { type: String, enum: ['P1', 'P2', 'P3'] },
  sla: {
    deadline: Date,
    breached: { type: Boolean, default: false },
    breachedAt: Date,
    escalationLevel: { type: Number, default: 0 },
  },
  handlerDepartment: String,
  escalationHistory: [{
    from: { type: Schema.Types.ObjectId, ref: 'Person' },
    to: { type: Schema.Types.ObjectId, ref: 'Person' },
    reason: String,
    escalatedAt: Date,
    escalatedBy: String,
  }],
  internalNotes: [{
    note: String,
    by: { type: Schema.Types.ObjectId, ref: 'Person' },
    at: Date,
  }],
  duplicateOf: { type: Schema.Types.ObjectId, ref: 'StudentGrievance' },
  feedbackRating: Number,
  feedbackComment: String,
  reopenCount: { type: Number, default: 0 },
  reopenHistory: [{ reason: String, at: Date }],
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const StudentGrievance = model<IStudentGrievance>('StudentGrievance', schema);
