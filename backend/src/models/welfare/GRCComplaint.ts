import { Schema, model, Document } from 'mongoose';
export interface IGRCComplaint extends Document { collegeId: Schema.Types.ObjectId; escalatedFrom?: Schema.Types.ObjectId; complainantId: Schema.Types.ObjectId; description: string; filedDate: Date; hearingDeadline: Date; decisionDeadline: Date; status: string; committeeId: Schema.Types.ObjectId; investigationPhase?: { investigatorId: Schema.Types.ObjectId; startedAt: Date; completedAt?: Date; findings: string }; hearingPhase?: { hearingDate: Date; attendees: Schema.Types.ObjectId[]; proceedings: string }; decision?: { outcome: string; decidedBy: Schema.Types.ObjectId; decidedAt: Date; remarks: string }; ombudsmanAppeal?: { filedDate: Date; referenceNumber?: string; outcome?: string }; }
const schema = new Schema<IGRCComplaint>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  escalatedFrom: { type: Schema.Types.ObjectId, ref: 'StudentGrievance' },
  complainantId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  description: { type: String, required: true },
  filedDate: { type: Date, required: true, default: Date.now },
  hearingDeadline: { type: Date, required: true },
  decisionDeadline: { type: Date, required: true },
  status: { type: String, enum: ['filed', 'investigating', 'hearing_scheduled', 'hearing_complete', 'decision_issued', 'appealed_to_ombudsman', 'closed'], default: 'filed' },
  committeeId: { type: Schema.Types.ObjectId, ref: 'Committee', required: true },
  investigationPhase: {
    investigatorId: Schema.Types.ObjectId,
    startedAt: Date,
    completedAt: Date,
    findings: String,
  },
  hearingPhase: {
    hearingDate: Date,
    attendees: [Schema.Types.ObjectId],
    proceedings: String,
  },
  decision: {
    outcome: String,
    decidedBy: Schema.Types.ObjectId,
    decidedAt: Date,
    remarks: String,
  },
  ombudsmanAppeal: {
    filedDate: Date,
    referenceNumber: String,
    outcome: String,
  },
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, hearingDeadline: 1 });
export const GRCComplaint = model<IGRCComplaint>('GRCComplaint', schema);
