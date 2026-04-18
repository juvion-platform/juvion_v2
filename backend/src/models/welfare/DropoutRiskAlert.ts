import { Schema, model, Document } from 'mongoose';

export interface IDropoutRiskAlert extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  riskScore: number;
  signals: Array<{
    source: string;
    signalType: string;
    description: string;
    weight: number;
    dataRef?: string;
  }>;
  status: 'active' | 'under_outreach' | 'resolved_retained' | 'resolved_exited' | 'false_positive';
  assignedTo?: Schema.Types.ObjectId;
  mentorId?: Schema.Types.ObjectId;
  outreachAttempts: Array<{
    date: Date;
    method: string;
    contactedBy: Schema.Types.ObjectId;
    outcome: string;
    notes?: string;
  }>;
  resolvedAt?: Date;
  resolvedBy?: Schema.Types.ObjectId;
  resolution?: string;
}

const schema = new Schema<IDropoutRiskAlert>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  riskScore: { type: Number, min: 0, max: 100, required: true },
  signals: [{
    source: { type: String, required: true },
    signalType: { type: String, required: true },
    description: { type: String, required: true },
    weight: { type: Number, required: true },
    dataRef: String,
  }],
  status: { type: String, enum: ['active', 'under_outreach', 'resolved_retained', 'resolved_exited', 'false_positive'], default: 'active' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person' },
  mentorId: { type: Schema.Types.ObjectId, ref: 'Person' },
  outreachAttempts: [{
    date: { type: Date, required: true },
    method: { type: String, required: true },
    contactedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    outcome: { type: String, required: true },
    notes: String,
  }],
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  resolution: String,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });
schema.index({ collegeId: 1, status: 1, riskScore: -1 });

export const DropoutRiskAlert = model<IDropoutRiskAlert>('DropoutRiskAlert', schema);
