import { Schema, model, Document, Types } from 'mongoose';

/**
 * ExamCentreTemplate — reusable bundle that pre-allocates rooms +
 * default invigilator counts for a recurring exam pattern (e.g.
 * "B.Tech mid-1: 14 rooms, 2 invigilators each, capacity 60").
 * Strategic Gap 6 Phase A.
 *
 * The exam-scheduling flow consumes a centre template and produces
 * concrete ExamSchedule + SeatingPlan + InvigilationRoster rows for
 * each session. Templates save the operator from re-typing the room
 * roster for every exam cycle.
 */
export interface IExamCentreRoomAllocation {
  examRoomId: Types.ObjectId;
  invigilatorCount: number;
  /** Optional overrides for capacity if the room is partially used. */
  capacityOverride?: number;
}

export interface IExamCentreTemplate extends Document {
  collegeId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  rooms: IExamCentreRoomAllocation[];
  defaultDurationMinutes?: number;
  /** Which exam types this template suits. */
  applicableExamTypes: string[];
  status: 'active' | 'inactive';
}

const roomAllocSchema = new Schema<IExamCentreRoomAllocation>(
  {
    examRoomId: { type: Schema.Types.ObjectId, ref: 'ExamRoom', required: true },
    invigilatorCount: { type: Number, required: true, min: 0 },
    capacityOverride: { type: Number, min: 0 },
  },
  { _id: false },
);

const schema = new Schema<IExamCentreTemplate>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    rooms: { type: [roomAllocSchema], default: [] },
    defaultDurationMinutes: { type: Number, min: 0 },
    applicableExamTypes: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const ExamCentreTemplate = model<IExamCentreTemplate>('ExamCentreTemplate', schema);
