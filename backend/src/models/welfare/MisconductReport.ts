import { Schema, model, Document } from 'mongoose';
export interface IMisconductReport extends Document { collegeId: Schema.Types.ObjectId; reportedBy: Schema.Types.ObjectId; reporterRole: string; studentId: Schema.Types.ObjectId; category: string; description: string; incidentDate: Date; evidenceAttachments: { fileId: string; type: string; uploadedAt: Date }[]; priorViolationCount: number; status: string; inquiryPhase?: { investigatorId: Schema.Types.ObjectId; startedAt: Date; completedAt?: Date; findings: string; recommendation: string }; hearingPhase?: { hearingDate: Date; attendees: Schema.Types.ObjectId[]; proceedings: string }; decision?: { outcome: string; details: string; decidedBy: Schema.Types.ObjectId; decidedAt: Date }; appealPhase?: { appealedBy: Schema.Types.ObjectId; appealedAt: Date; grounds: string; reviewCommittee: Schema.Types.ObjectId[]; outcome?: string; decidedAt?: Date }; committeeId?: Schema.Types.ObjectId; m02DisciplinaryRecordId?: Schema.Types.ObjectId; }
const schema = new Schema<IMisconductReport>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  reporterRole: { type: String, enum: ['faculty', 'warden', 'student', 'staff'], required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  category: { type: String, enum: ['academic_fraud', 'behavioral', 'property_damage', 'substance', 'violence', 'other'], required: true },
  description: { type: String, required: true },
  incidentDate: { type: Date, required: true },
  evidenceAttachments: [{ fileId: String, type: String, uploadedAt: Date }],
  priorViolationCount: { type: Number, default: 0 },
  status: { type: String, enum: ['filed', 'preliminary_inquiry', 'hearing_scheduled', 'hearing_complete', 'penalty_issued', 'penalty_executing', 'appealed', 'appeal_decided', 'closed'], default: 'filed' },
  inquiryPhase: {
    investigatorId: Schema.Types.ObjectId,
    startedAt: Date,
    completedAt: Date,
    findings: String,
    recommendation: { type: String, enum: ['dismiss', 'hearing'] },
  },
  hearingPhase: {
    hearingDate: Date,
    attendees: [Schema.Types.ObjectId],
    proceedings: String,
  },
  decision: {
    outcome: { type: String, enum: ['warning', 'fine', 'suspension', 'rustication', 'expulsion', 'exonerated'] },
    details: String,
    decidedBy: Schema.Types.ObjectId,
    decidedAt: Date,
  },
  appealPhase: {
    appealedBy: Schema.Types.ObjectId,
    appealedAt: Date,
    grounds: String,
    reviewCommittee: [Schema.Types.ObjectId],
    outcome: { type: String, enum: ['upheld', 'modified', 'overturned'] },
    decidedAt: Date,
  },
  committeeId: { type: Schema.Types.ObjectId, ref: 'Committee' },
  m02DisciplinaryRecordId: Schema.Types.ObjectId,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
schema.index({ collegeId: 1, status: 1 });
export const MisconductReport = model<IMisconductReport>('MisconductReport', schema);
