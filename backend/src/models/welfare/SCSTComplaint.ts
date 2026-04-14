import { Schema, model, Document } from 'mongoose';
export interface ISCSTComplaint extends Document { collegeId: Schema.Types.ObjectId; complainantId: Schema.Types.ObjectId; respondentId: Schema.Types.ObjectId; description: string; incidentDate: Date; casteCategory: string; status: string; committeeId: Schema.Types.ObjectId; investigationPhase?: { investigatorIds: Schema.Types.ObjectId[]; startedAt: Date; completedAt?: Date; findings: string }; decision?: { outcome: string; decidedBy: Schema.Types.ObjectId; decidedAt: Date; remarks: string }; policeReferral?: { referralDate: Date; policeStation: string; firNumber?: string; referredBy: Schema.Types.ObjectId; isAtrocitiesAct: boolean }; }
const schema = new Schema<ISCSTComplaint>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  complainantId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  respondentId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  description: { type: String, required: true },
  incidentDate: { type: Date, required: true },
  casteCategory: { type: String, required: true },
  status: { type: String, enum: ['filed', 'investigating', 'decision', 'police_referred', 'closed'], default: 'filed' },
  committeeId: { type: Schema.Types.ObjectId, ref: 'Committee', required: true },
  investigationPhase: {
    investigatorIds: [Schema.Types.ObjectId],
    startedAt: Date,
    completedAt: Date,
    findings: String,
  },
  decision: {
    outcome: String,
    decidedBy: Schema.Types.ObjectId,
    decidedAt: Date,
    remarks: String,
  },
  policeReferral: {
    referralDate: Date,
    policeStation: String,
    firNumber: String,
    referredBy: Schema.Types.ObjectId,
    isAtrocitiesAct: Boolean,
  },
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const SCSTComplaint = model<ISCSTComplaint>('SCSTComplaint', schema);
