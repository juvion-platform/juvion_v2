import { Schema, model, Document } from 'mongoose';

export interface IExitProcess extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; exitType: string; lastWorkingDate: Date; reason: string; noDues: { department: string; cleared: boolean }[]; exitInterviewDone: boolean; status: string;
}

const schema = new Schema<IExitProcess>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  exitType: { type: String, enum: ['resignation', 'retirement', 'termination', 'contract_end'], required: true },
  lastWorkingDate: { type: Date, required: true },
  reason: { type: String, required: true },
  noDues: [{ department: String, cleared: { type: Boolean, default: false } }],
  exitInterviewDone: { type: Boolean, default: false },
  status: { type: String, enum: ['initiated', 'in_progress', 'completed'], default: 'initiated' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1 });

export const ExitProcess = model<IExitProcess>('ExitProcess', schema);
