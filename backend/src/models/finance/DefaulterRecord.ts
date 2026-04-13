import { Schema, model, Document } from 'mongoose';

export interface IDistressSignal {
  type: string;
  value: number;
  weight: number;
}

export interface IDefaulterRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  overdueAmount: number;
  daysOverdue: number;
  escalationStage: 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'welfare_referred' | 'resolved' | 'exited_hardship' | 'exited_write_off';
  welfareReferralStatus: 'none' | 'referred' | 'returned';
  distressSignals: IDistressSignal[];
  distressScore?: number;
  resolutionDate?: Date;
  resolutionType?: string;
}

const distressSignalSchema = new Schema<IDistressSignal>({
  type: { type: String },
  value: { type: Number },
  weight: { type: Number },
}, { _id: false });

const schema = new Schema<IDefaulterRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  overdueAmount: { type: Number, required: true },
  daysOverdue: { type: Number, required: true, default: 0 },
  escalationStage: {
    type: String,
    enum: ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'welfare_referred', 'resolved', 'exited_hardship', 'exited_write_off'],
    default: 'stage_1',
  },
  welfareReferralStatus: {
    type: String,
    enum: ['none', 'referred', 'returned'],
    default: 'none',
  },
  distressSignals: { type: [distressSignalSchema], default: [] },
  distressScore: { type: Number },
  resolutionDate: { type: Date },
  resolutionType: { type: String, enum: ['payment', 'write_off', 'concession', 'other'] },
}, { timestamps: true });

schema.index({ collegeId: 1, escalationStage: 1 });
schema.index({ collegeId: 1, studentId: 1 });

export const DefaulterRecord = model<IDefaulterRecord>('DefaulterRecord', schema);
