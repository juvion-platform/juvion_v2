import { Schema, model, Document } from 'mongoose';

export interface IHandoverItem {
  category: 'course' | 'mentee' | 'research' | 'admin' | 'asset' | 'lab';
  description: string;
  successorId?: Schema.Types.ObjectId;
  status: 'pending' | 'completed';
  completedAt?: Date;
}

export interface IHandoverRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  separationRequestId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  items: IHandoverItem[];
  verifiedByHOD?: boolean;
  overallStatus: 'pending' | 'in_progress' | 'completed';
  verifiedAt?: Date;
}

const handoverItemSchema = new Schema(
  {
    category: {
      type: String,
      enum: ['course', 'mentee', 'research', 'admin', 'asset', 'lab'],
      required: true,
    },
    description: { type: String, required: true },
    successorId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    completedAt: Date,
  },
  { _id: false },
);

const schema = new Schema<IHandoverRecord>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    separationRequestId: { type: Schema.Types.ObjectId, ref: 'SeparationRequest', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    items: [handoverItemSchema],
    verifiedByHOD: { type: Boolean, default: false },
    overallStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    verifiedAt: Date,
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, separationRequestId: 1 });

export const HandoverRecord = model<IHandoverRecord>('HandoverRecord', schema);
