import { Schema, model, Document } from 'mongoose';
export interface ILibraryMember extends Document { collegeId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; memberType: string; membershipId: string; maxBooks: number; currentIssued: number; finesDue: number; isActive: boolean; }
const schema = new Schema<ILibraryMember>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, memberType: { type: String, enum: ['student', 'faculty', 'staff', 'research_scholar'], required: true }, membershipId: { type: String, required: true }, maxBooks: { type: Number, required: true }, currentIssued: { type: Number, default: 0 }, finesDue: { type: Number, default: 0 }, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, membershipId: 1 }, { unique: true });
export const LibraryMember = model<ILibraryMember>('LibraryMember', schema);
