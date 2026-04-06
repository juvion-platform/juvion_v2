import { Schema, model, Document } from 'mongoose';

export interface IOnDuty extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; fromDate: Date; toDate: Date; purpose: string; venue?: string; status: string; approvedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IOnDuty>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  purpose: { type: String, required: true },
  venue: String,
  status: { type: String, enum: ['applied', 'approved', 'rejected'], default: 'applied' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1 });

export const OnDuty = model<IOnDuty>('OnDuty', schema);
