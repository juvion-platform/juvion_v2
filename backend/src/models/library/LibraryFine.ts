import { Schema, model, Document } from 'mongoose';
export interface ILibraryFine extends Document { collegeId: Schema.Types.ObjectId; memberId: Schema.Types.ObjectId; bookIssueId: Schema.Types.ObjectId; amount: number; reason: string; paidAmount: number; status: string; }
const schema = new Schema<ILibraryFine>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, memberId: { type: Schema.Types.ObjectId, ref: 'LibraryMember', required: true }, bookIssueId: { type: Schema.Types.ObjectId, ref: 'BookIssue', required: true }, amount: { type: Number, required: true }, reason: { type: String, enum: ['overdue', 'lost', 'damaged'], required: true }, paidAmount: { type: Number, default: 0 }, status: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' } }, { timestamps: true });
schema.index({ collegeId: 1, memberId: 1 });
export const LibraryFine = model<ILibraryFine>('LibraryFine', schema);
