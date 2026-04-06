import { Schema, model, Document } from 'mongoose';
export interface IAccreditationCycle extends Document { collegeId: Schema.Types.ObjectId; bodyId: Schema.Types.ObjectId; cycle: number; applicationDate?: Date; visitDate?: Date; grade?: string; validFrom?: Date; validTo?: Date; status: string; }
const schema = new Schema<IAccreditationCycle>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, bodyId: { type: Schema.Types.ObjectId, ref: 'AccreditationBody', required: true }, cycle: { type: Number, required: true }, applicationDate: Date, visitDate: Date, grade: String, validFrom: Date, validTo: Date, status: { type: String, enum: ['preparing', 'applied', 'visit_scheduled', 'visited', 'accredited', 'expired'], default: 'preparing' } }, { timestamps: true });
schema.index({ collegeId: 1, bodyId: 1, cycle: 1 });
export const AccreditationCycle = model<IAccreditationCycle>('AccreditationCycle', schema);
