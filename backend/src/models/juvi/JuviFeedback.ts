import { Schema, model, Document } from 'mongoose';
export interface IJuviFeedback extends Document { collegeId: Schema.Types.ObjectId; messageId: Schema.Types.ObjectId; userId: Schema.Types.ObjectId; rating: number; feedback?: string; }
const schema = new Schema<IJuviFeedback>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, messageId: { type: Schema.Types.ObjectId, ref: 'JuviMessage', required: true }, userId: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, rating: { type: Number, min: -1, max: 1, required: true }, feedback: String }, { timestamps: true });
schema.index({ collegeId: 1, messageId: 1, userId: 1 }, { unique: true });
export const JuviFeedback = model<IJuviFeedback>('JuviFeedback', schema);
