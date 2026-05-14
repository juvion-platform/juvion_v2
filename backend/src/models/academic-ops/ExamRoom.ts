import { Schema, model, Document, Types } from 'mongoose';

/**
 * ExamRoom — physical room master data used by exam planning.
 * Strategic Gap 6 Phase A. SeatingPlan rows reference this for the
 * room metadata (capacity, layout); ExamSchedule.venue is denormalised
 * for backward compatibility but can also reference an ExamRoom.
 *
 * The columns/rows shape (`layout`) lets the seating-plan generator
 * lay out seats in a grid rather than a flat list — the standard
 * "2-per-bench × 3-rows-deep" Indian college exam-room layout.
 */
export interface IExamRoom extends Document {
  collegeId: Types.ObjectId;
  code: string;
  name: string;
  building?: string;
  floor?: number;
  capacity: number;
  /** Default for grid-based seating plan generation. */
  layout?: { rows: number; cols: number };
  /** Which exam types this room is approved for. */
  approvedFor: string[];
  status: 'active' | 'inactive' | 'maintenance';
}

const schema = new Schema<IExamRoom>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    building: { type: String, trim: true },
    floor: { type: Number },
    capacity: { type: Number, required: true, min: 1 },
    layout: {
      rows: { type: Number, min: 1 },
      cols: { type: Number, min: 1 },
    },
    approvedFor: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const ExamRoom = model<IExamRoom>('ExamRoom', schema);
