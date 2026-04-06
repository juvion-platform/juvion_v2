import { Schema, model, Document } from 'mongoose';

export interface IStudentFeeAccount extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; totalDue: number; totalPaid: number; totalWaived: number; totalRefunded: number; balance: number; lastPaymentDate?: Date;
}

const schema = new Schema<IStudentFeeAccount>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  totalDue: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalWaived: { type: Number, default: 0 },
  totalRefunded: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  lastPaymentDate: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 }, { unique: true });

export const StudentFeeAccount = model<IStudentFeeAccount>('StudentFeeAccount', schema);
