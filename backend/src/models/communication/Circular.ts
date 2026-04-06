import { Schema, model, Document } from 'mongoose';
export interface ICircular extends Document { collegeId: Schema.Types.ObjectId; circularNumber: string; title: string; content: string; issuedBy: Schema.Types.ObjectId; department?: string; targetAudience: string; documentUrl?: string; issuedDate: Date; expiryDate?: Date; }
const schema = new Schema<ICircular>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, circularNumber: { type: String, required: true }, title: { type: String, required: true }, content: String, issuedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, department: String, targetAudience: { type: String, enum: ['all', 'students', 'faculty', 'staff', 'parents'], required: true }, documentUrl: String, issuedDate: { type: Date, default: Date.now }, expiryDate: Date }, { timestamps: true });
schema.index({ collegeId: 1, circularNumber: 1 }, { unique: true });
export const Circular = model<ICircular>('Circular', schema);
