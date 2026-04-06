import { Schema, model, Document } from 'mongoose';

export interface IPayStructure extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; basicPay: number; hra: number; da: number; otherAllowances: number; pfContribution: number; effectiveFrom: Date; effectiveTo?: Date;
}

const schema = new Schema<IPayStructure>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  basicPay: { type: Number, required: true },
  hra: { type: Number, default: 0 },
  da: { type: Number, default: 0 },
  otherAllowances: { type: Number, default: 0 },
  pfContribution: { type: Number, default: 0 },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, effectiveFrom: -1 });

export const PayStructure = model<IPayStructure>('PayStructure', schema);
