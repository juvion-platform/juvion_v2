import { Schema, model, Document } from 'mongoose';

export interface IAllotmentRound extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  roundNumber: number;
  name: string;                   // e.g. 'Management Round 1', 'Spot Round'
  type: string;                   // 'management' | 'spot' | 'lateral'
  status: string;                 // 'draft' | 'open' | 'processing' | 'published' | 'closed'
  // Criteria
  criteria: {
    sortBy: string;               // 'merit_score' | 'eamcet_rank' | 'inter_percentage'
    programmeIds?: Schema.Types.ObjectId[];
    branchIds?: Schema.Types.ObjectId[];
    quotas?: string[];
  };
  // Dates
  applicationDeadline?: Date;
  publishDate?: Date;
  acceptanceDeadline?: Date;
  // Stats
  totalApplicants: number;
  allottedCount: number;
  waitlistedCount: number;
  // Audit
  conductedBy: string;
  publishedBy?: string;
}

const schema = new Schema<IAllotmentRound>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  roundNumber: { type: Number, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['management', 'spot', 'lateral'], required: true },
  status: {
    type: String,
    enum: ['draft', 'open', 'processing', 'published', 'closed'],
    default: 'draft',
  },
  criteria: {
    sortBy: { type: String, enum: ['merit_score', 'eamcet_rank', 'inter_percentage'], default: 'merit_score' },
    programmeIds: [{ type: Schema.Types.ObjectId, ref: 'Programme' }],
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    quotas: [String],
  },
  applicationDeadline: Date,
  publishDate: Date,
  acceptanceDeadline: Date,
  totalApplicants: { type: Number, default: 0 },
  allottedCount: { type: Number, default: 0 },
  waitlistedCount: { type: Number, default: 0 },
  conductedBy: { type: String, required: true },
  publishedBy: String,
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, roundNumber: 1 }, { unique: true });

export const AllotmentRound = model<IAllotmentRound>('AllotmentRound', schema);
