import { Schema, model, Document } from 'mongoose';
export interface IAntiRaggingComplaint extends Document { collegeId: Schema.Types.ObjectId; complainantId?: Schema.Types.ObjectId; isAnonymous: boolean; accusedIds: Schema.Types.ObjectId[]; description: string; incidentDate: Date; severity: string; status: string; committeeRemarks?: string; actionTaken?: string; encryptedComplainantIdentity?: string; witnessIds: Schema.Types.ObjectId[]; evidenceAttachments: any[]; incidentLocation?: string; assessmentPhase?: any; investigationPhase?: any; hearingPhase?: any; decision?: any; firDetails?: any; appealPhase?: any; ugcReportId?: Schema.Types.ObjectId; committeeId?: Schema.Types.ObjectId; }
const schema = new Schema<IAntiRaggingComplaint>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  complainantId: { type: Schema.Types.ObjectId, ref: 'Person' },
  isAnonymous: { type: Boolean, default: false },
  accusedIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  description: { type: String, required: true },
  incidentDate: { type: Date, required: true },
  severity: { type: String, enum: ['minor', 'major', 'severe'], required: true },
  status: { type: String, enum: ['filed', 'assessing', 'investigating', 'hearing_scheduled', 'hearing_complete', 'decision_issued', 'penalty_executing', 'appealed', 'appeal_decided', 'closed', 'referred_to_police'], default: 'filed' },
  committeeRemarks: String,
  actionTaken: String,
  encryptedComplainantIdentity: String,
  witnessIds: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
  evidenceAttachments: [{
    fileId: String,
    type: { type: String, enum: ['photo', 'video', 'document', 'audio'] },
    uploadedAt: Date,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  }],
  incidentLocation: String,
  assessmentPhase: {
    assessedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    assessedAt: Date,
    recommendation: { type: String, enum: ['investigate', 'dismiss', 'mediate'] },
    remarks: String,
    priorHistory: { count: Number, details: String },
  },
  investigationPhase: {
    investigatorIds: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
    startedAt: Date,
    completedAt: Date,
    findings: String,
    witnessStatements: [{ witnessId: { type: Schema.Types.ObjectId }, statement: String, recordedAt: Date }],
  },
  hearingPhase: {
    hearingDate: Date,
    attendees: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
    proceedings: String,
    decisionDate: Date,
  },
  decision: {
    outcome: { type: String, enum: ['guilty', 'not_guilty', 'insufficient_evidence'] },
    penalty: String,
    penaltySeverity: { type: String, enum: ['warning', 'suspension', 'expulsion', 'fir'] },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    decidedAt: Date,
  },
  firDetails: {
    firNumber: String,
    policeStation: String,
    filedDate: Date,
    filedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  },
  appealPhase: {
    appealedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    appealedAt: Date,
    grounds: String,
    reviewCommittee: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
    outcome: { type: String, enum: ['upheld', 'modified', 'overturned'] },
    decidedAt: Date,
  },
  ugcReportId: { type: Schema.Types.ObjectId },
  committeeId: { type: Schema.Types.ObjectId, ref: 'Committee' },
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const AntiRaggingComplaint = model<IAntiRaggingComplaint>('AntiRaggingComplaint', schema);
