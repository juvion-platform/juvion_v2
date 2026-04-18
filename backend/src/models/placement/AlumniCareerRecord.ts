import { Schema, model, Document } from 'mongoose';

export interface IAlumniCareerRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; alumniProfileId: Schema.Types.ObjectId; currentEmployer?: string; currentRole?: string; ctcRange?: string; industry?: string; location?: string; careerStatus: string; updateSource: string; lastUpdated: Date; isStale: boolean;
}

const schema = new Schema<IAlumniCareerRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  alumniProfileId: { type: Schema.Types.ObjectId, ref: 'AlumniProfile', required: true },
  currentEmployer: String,
  currentRole: String,
  ctcRange: String,
  industry: String,
  location: String,
  careerStatus: { type: String, enum: ['employed', 'seeking', 'higher_education', 'entrepreneur', 'unknown'], default: 'unknown' },
  updateSource: { type: String, enum: ['system_seeded', 'self_report', 'tpo_entry', 'survey'], required: true },
  lastUpdated: { type: Date, default: Date.now },
  isStale: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, personId: 1 }, { unique: true });
schema.index({ collegeId: 1, careerStatus: 1 });

export const AlumniCareerRecord = model<IAlumniCareerRecord>('AlumniCareerRecord', schema);
