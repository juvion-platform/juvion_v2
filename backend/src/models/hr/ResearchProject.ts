import { Schema, model, Document } from 'mongoose';

export interface IResearchProject extends Document {
  collegeId: Schema.Types.ObjectId;
  title: string; principalInvestigatorId: Schema.Types.ObjectId; coInvestigators: Schema.Types.ObjectId[]; fundingAgency?: string; sanctionedAmount?: number; startDate: Date; endDate?: Date; status: string;
}

const schema = new Schema<IResearchProject>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  principalInvestigatorId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  coInvestigators: [{ type: Schema.Types.ObjectId, ref: 'Faculty' }],
  fundingAgency: String,
  sanctionedAmount: Number,
  startDate: { type: Date, required: true },
  endDate: Date,
  status: { type: String, enum: ['proposed', 'sanctioned', 'ongoing', 'completed', 'terminated'], default: 'proposed' },
}, { timestamps: true });

schema.index({ collegeId: 1, principalInvestigatorId: 1 });

export const ResearchProject = model<IResearchProject>('ResearchProject', schema);
