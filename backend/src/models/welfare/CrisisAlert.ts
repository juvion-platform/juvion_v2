import { Schema, model, Document } from 'mongoose';
export interface ICrisisAlert extends Document { collegeId: Schema.Types.ObjectId; reportedBy: Schema.Types.ObjectId; studentId?: Schema.Types.ObjectId; type: string; severity: string; description: string; status: string; assignedTo?: Schema.Types.ObjectId; resolution?: string; resolvedAt?: Date; signals: any[]; compoundScore: number; scoreBreakdown?: any; priority?: string; acknowledgment?: any; investigation?: any; intervention?: any; falsePositive: boolean; falsePositiveReason?: string; suppressDoubleAlert: boolean; }
const schema = new Schema<ICrisisAlert>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  type: { type: String, enum: ['mental_health', 'ragging', 'harassment', 'medical_emergency', 'substance_abuse', 'other'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['generated', 'acknowledged', 'investigating', 'intervening', 'resolved', 'false_positive', 'reported', 'in_progress', 'escalated'], default: 'reported' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person' },
  resolution: String,
  resolvedAt: Date,
  signals: [{
    signalId: { type: Schema.Types.ObjectId, ref: 'RiskSignal' },
    source: { type: String, enum: ['M03', 'M04', 'M08', 'Juvi', 'M06'] },
    signalType: String,
    weight: Number,
    receivedAt: Date,
  }],
  compoundScore: { type: Number, default: 0 },
  scoreBreakdown: {
    baseTotal: Number,
    firstGenModifier: Number,
    crossModuleMultiplier: Number,
    temporalMultiplier: Number,
    finalScore: Number,
  },
  priority: { type: String, enum: ['P1', 'P2', 'P3'] },
  acknowledgment: {
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    acknowledgedAt: Date,
    initialAssessment: String,
  },
  investigation: {
    investigatorId: { type: Schema.Types.ObjectId, ref: 'Person' },
    startedAt: Date,
    findings: String,
    completedAt: Date,
  },
  intervention: {
    type: { type: String, enum: ['mentor_outreach', 'counselling_referral', 'parent_contact', 'financial_aid', 'academic_support', 'other'] },
    description: String,
    executedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    executedAt: Date,
    outcome: String,
    followUpDate: Date,
  },
  falsePositive: { type: Boolean, default: false },
  falsePositiveReason: String,
  suppressDoubleAlert: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1, severity: 1 });
export const CrisisAlert = model<ICrisisAlert>('CrisisAlert', schema);
