import { Schema, model, Document } from 'mongoose';

export interface IMeritList extends Document {
  collegeId: Schema.Types.ObjectId;
  allotmentRoundId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  quota: string;
  criteria: { sortBy: string; tieBreaker?: string };
  version: number;
  publishDate?: Date;
  status: string;
  totalCandidates: number;
  generatedBy: Schema.Types.ObjectId;
}

const schema = new Schema<IMeritList>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  allotmentRoundId: { type: Schema.Types.ObjectId, ref: 'AllotmentRound', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  quota: { type: String, enum: ['management', 'convener', 'nri', 'lateral'], required: true },
  criteria: {
    sortBy: { type: String, required: true },
    tieBreaker: String,
  },
  version: { type: Number, default: 1 },
  publishDate: Date,
  status: { type: String, enum: ['draft', 'generated', 'published', 'superseded'], default: 'draft' },
  totalCandidates: { type: Number, default: 0 },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, allotmentRoundId: 1 });

export const MeritList = model<IMeritList>('MeritList', schema);
