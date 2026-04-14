import { Schema, model, Document } from 'mongoose';
export interface IICCComplaint extends Document { collegeId: Schema.Types.ObjectId; complainantId: Schema.Types.ObjectId; encryptedComplainantIdentity?: string; respondentId: Schema.Types.ObjectId; respondentType: string; description: string; incidentDate: Date; filedDate: Date; deadlineDate: Date; status: string; committeeId: Schema.Types.ObjectId; assessmentPhase?: { assessedBy: Schema.Types.ObjectId; assessedAt: Date; recommendation: string; remarks: string }; inquiryPhase?: { startedAt: Date; completedAt?: Date; findings: string; evidence: { fileId: string; type: string; uploadedAt: Date }[] }; hearingPhase?: { hearingDate: Date; attendees: Schema.Types.ObjectId[]; proceedings: string }; recommendation?: { action: string; decidedBy: Schema.Types.ObjectId; decidedAt: Date }; appealPhase?: { appealedBy: Schema.Types.ObjectId; appealedAt: Date; grounds: string; reviewCommittee: Schema.Types.ObjectId[]; outcome?: string; decidedAt?: Date }; confidentialityLevel: string; }
const schema = new Schema<IICCComplaint>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  complainantId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  encryptedComplainantIdentity: String,
  respondentId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  respondentType: { type: String, enum: ['student', 'faculty', 'staff'], required: true },
  description: { type: String, required: true },
  incidentDate: { type: Date, required: true },
  filedDate: { type: Date, required: true, default: Date.now },
  deadlineDate: { type: Date, required: true },
  status: { type: String, enum: ['filed', 'preliminary_assessment', 'inquiry', 'hearing', 'recommendation_issued', 'appealed', 'closed'], default: 'filed' },
  committeeId: { type: Schema.Types.ObjectId, ref: 'Committee', required: true },
  assessmentPhase: {
    assessedBy: Schema.Types.ObjectId,
    assessedAt: Date,
    recommendation: { type: String, enum: ['inquiry', 'dismiss', 'conciliate'] },
    remarks: String,
  },
  inquiryPhase: {
    startedAt: Date,
    completedAt: Date,
    findings: String,
    evidence: [{ fileId: String, type: String, uploadedAt: Date }],
  },
  hearingPhase: {
    hearingDate: Date,
    attendees: [Schema.Types.ObjectId],
    proceedings: String,
  },
  recommendation: {
    action: String,
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
  confidentialityLevel: { type: String, default: 'icc_only' },
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, deadlineDate: 1 });
export const ICCComplaint = model<IICCComplaint>('ICCComplaint', schema);
