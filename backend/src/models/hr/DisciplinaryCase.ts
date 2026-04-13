import { Schema, model, Document } from 'mongoose';

export interface ITimelineEntry {
  action: string;
  date: Date;
  remarks?: string;
  performedBy?: Schema.Types.ObjectId;
}

export interface IDisciplinaryCase extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  caseNumber: string;
  origin: 'internal' | 'external_referral';
  referralSource?: 'm06_icc' | 'm06_arc' | 'other';
  referralDetails?: string;
  allegation: string;
  evidence: string[];
  investigatingAuthorityId?: Schema.Types.ObjectId;
  investigationFindings?: string;
  showCauseNoticeUrl?: string;
  showCauseIssuedAt?: Date;
  responseDeadline?: Date;
  responseReceivedAt?: Date;
  responseText?: string;
  hearingDate?: Date;
  hearingMinutesUrl?: string;
  outcome?: 'warning' | 'fine' | 'suspension' | 'demotion' | 'termination' | 'exonerated';
  outcomeDetails?: string;
  outcomeImplementedAt?: Date;
  appealDeadline?: Date;
  status:
    | 'under_investigation'
    | 'show_cause'
    | 'awaiting_response'
    | 'hearing'
    | 'decided'
    | 'implemented'
    | 'closed'
    | 'appealed'
    | 'insufficient_evidence';
  timeline: ITimelineEntry[];
}

const timelineEntrySchema = new Schema(
  {
    action: { type: String, required: true },
    date: { type: Date, required: true },
    remarks: String,
    performedBy: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const schema = new Schema<IDisciplinaryCase>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    caseNumber: { type: String, required: true },
    origin: { type: String, enum: ['internal', 'external_referral'], required: true },
    referralSource: { type: String, enum: ['m06_icc', 'm06_arc', 'other'] },
    referralDetails: String,
    allegation: { type: String, required: true },
    evidence: [{ type: String }],
    investigatingAuthorityId: { type: Schema.Types.ObjectId, ref: 'Person' },
    investigationFindings: String,
    showCauseNoticeUrl: String,
    showCauseIssuedAt: Date,
    responseDeadline: Date,
    responseReceivedAt: Date,
    responseText: String,
    hearingDate: Date,
    hearingMinutesUrl: String,
    outcome: {
      type: String,
      enum: ['warning', 'fine', 'suspension', 'demotion', 'termination', 'exonerated'],
    },
    outcomeDetails: String,
    outcomeImplementedAt: Date,
    appealDeadline: Date,
    status: {
      type: String,
      enum: [
        'under_investigation',
        'show_cause',
        'awaiting_response',
        'hearing',
        'decided',
        'implemented',
        'closed',
        'appealed',
        'insufficient_evidence',
      ],
      default: 'under_investigation',
    },
    timeline: [timelineEntrySchema],
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, employeeId: 1 });
schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, caseNumber: 1 }, { unique: true });

export const DisciplinaryCase = model<IDisciplinaryCase>('DisciplinaryCase', schema);
