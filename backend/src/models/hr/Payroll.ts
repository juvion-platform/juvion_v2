import { Schema, model, Document } from 'mongoose';

export interface IPayroll extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; month: number; year: number; basicPay: number; hra: number; da: number; otherAllowances: number; grossPay: number; pf: number; esi: number; tds: number; otherDeductions: number; netPay: number; status: string; paidDate?: Date;
}

const schema = new Schema<IPayroll>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  basicPay: { type: Number, required: true },
  hra: { type: Number, default: 0 },
  da: { type: Number, default: 0 },
  otherAllowances: { type: Number, default: 0 },
  grossPay: { type: Number, required: true },
  pf: { type: Number, default: 0 },
  esi: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  netPay: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'processed', 'paid', 'hold'], default: 'draft' },
  paidDate: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });

export const Payroll = model<IPayroll>('Payroll', schema);
