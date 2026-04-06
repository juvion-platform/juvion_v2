import { Schema, model, Document } from 'mongoose';
export interface IAccreditationBody extends Document { collegeId: Schema.Types.ObjectId; name: string; acronym: string; website?: string; type: string; }
const schema = new Schema<IAccreditationBody>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, acronym: { type: String, required: true }, website: String, type: { type: String, enum: ['naac', 'nba', 'nirf', 'abet', 'aicte', 'ugc', 'other'], required: true } }, { timestamps: true });
schema.index({ collegeId: 1, acronym: 1 });
export const AccreditationBody = model<IAccreditationBody>('AccreditationBody', schema);
