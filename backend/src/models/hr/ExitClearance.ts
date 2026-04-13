import { Schema, model, Document } from 'mongoose';

export interface IClearanceItem {
  department: string;
  authority?: Schema.Types.ObjectId;
  status: 'pending' | 'cleared' | 'blocked';
  clearedBy?: Schema.Types.ObjectId;
  clearedAt?: Date;
  remarks?: string;
  blockedReason?: string;
}

export interface IExitClearance extends Document {
  collegeId: Schema.Types.ObjectId;
  separationRequestId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  items: IClearanceItem[];
  overallStatus: 'in_progress' | 'all_cleared' | 'blocked';
  generatedAt: Date;
  completedAt?: Date;
}

const clearanceItemSchema = new Schema(
  {
    department: { type: String, required: true },
    authority: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['pending', 'cleared', 'blocked'], default: 'pending' },
    clearedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    clearedAt: Date,
    remarks: String,
    blockedReason: String,
  },
  { _id: false },
);

const schema = new Schema<IExitClearance>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    separationRequestId: { type: Schema.Types.ObjectId, ref: 'SeparationRequest', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    items: [clearanceItemSchema],
    overallStatus: {
      type: String,
      enum: ['in_progress', 'all_cleared', 'blocked'],
      default: 'in_progress',
    },
    generatedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, separationRequestId: 1 });

export const ExitClearance = model<IExitClearance>('ExitClearance', schema);
