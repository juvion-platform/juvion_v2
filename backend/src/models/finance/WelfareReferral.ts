import { Schema, model, Document } from 'mongoose';

export interface IWelfareReferralDistressSignal {
  type: string;
  value: number;
  weight: number;
}

export interface IWelfareReferral extends Document {
  collegeId: Schema.Types.ObjectId;
  defaulterRecordId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  distressScore: number;
  distressSignals: IWelfareReferralDistressSignal[];
  referralStatus: 'referred' | 'returned';
  outcome?: 'genuine_hardship' | 'no_distress' | 'inconclusive';
  referredBy: Schema.Types.ObjectId;
  returnedAt?: Date;
  m06CaseId?: string;
}

const distressSignalSchema = new Schema<IWelfareReferralDistressSignal>({
  type: { type: String },
  value: { type: Number },
  weight: { type: Number },
}, { _id: false });

const schema = new Schema<IWelfareReferral>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  defaulterRecordId: { type: Schema.Types.ObjectId, ref: 'DefaulterRecord', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  distressScore: { type: Number, required: true },
  distressSignals: { type: [distressSignalSchema], default: [] },
  referralStatus: {
    type: String,
    enum: ['referred', 'returned'],
    default: 'referred',
  },
  outcome: {
    type: String,
    enum: ['genuine_hardship', 'no_distress', 'inconclusive'],
  },
  referredBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  returnedAt: { type: Date },
  m06CaseId: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const WelfareReferral = model<IWelfareReferral>('WelfareReferral', schema);
