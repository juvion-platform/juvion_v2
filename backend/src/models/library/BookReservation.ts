import { Schema, model, Document } from 'mongoose';
export interface IBookReservation extends Document { collegeId: Schema.Types.ObjectId; bookId: Schema.Types.ObjectId; reservedBy: Schema.Types.ObjectId; reservedDate: Date; expiryDate: Date; status: string; }
const schema = new Schema<IBookReservation>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true }, reservedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, reservedDate: { type: Date, default: Date.now }, expiryDate: { type: Date, required: true }, status: { type: String, enum: ['active', 'fulfilled', 'expired', 'cancelled'], default: 'active' } }, { timestamps: true });
schema.index({ collegeId: 1, bookId: 1, reservedBy: 1 });
export const BookReservation = model<IBookReservation>('BookReservation', schema);
