import { Schema, model, Document } from 'mongoose';

export interface IImplementedAction {
  action: string;
  module?: string;
  completedAt?: Date;
}

export interface IDisciplinaryOutcome extends Document {
  collegeId: Schema.Types.ObjectId;
  disciplinaryCaseId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  outcomeType: 'warning' | 'fine' | 'suspension' | 'demotion' | 'termination';
  details: {
    fineAmount?: number;
    suspensionDays?: number;
    suspensionStartDate?: Date;
    suspensionEndDate?: Date;
    demotionToDesignation?: string;
  };
  communicationLetterUrl?: string;
  implementedActions: IImplementedAction[];
  status: 'decided' | 'communicated' | 'implemented' | 'appealed' | 'overturned';
  appealId?: Schema.Types.ObjectId;
}

const implementedActionSchema = new Schema(
  {
    action: { type: String, required: true },
    module: String,
    completedAt: Date,
  },
  { _id: false },
);

const schema = new Schema<IDisciplinaryOutcome>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    disciplinaryCaseId: { type: Schema.Types.ObjectId, ref: 'DisciplinaryCase', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    outcomeType: {
      type: String,
      enum: ['warning', 'fine', 'suspension', 'demotion', 'termination'],
      required: true,
    },
    details: {
      type: {
        fineAmount: Number,
        suspensionDays: Number,
        suspensionStartDate: Date,
        suspensionEndDate: Date,
        demotionToDesignation: String,
      },
      default: {},
    },
    communicationLetterUrl: String,
    implementedActions: [implementedActionSchema],
    status: {
      type: String,
      enum: ['decided', 'communicated', 'implemented', 'appealed', 'overturned'],
      default: 'decided',
    },
    appealId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, disciplinaryCaseId: 1 });

export const DisciplinaryOutcome = model<IDisciplinaryOutcome>('DisciplinaryOutcome', schema);
