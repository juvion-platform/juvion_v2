import { Schema, model, Document } from 'mongoose';
export interface IEResourceAccess extends Document { collegeId: Schema.Types.ObjectId; eResourceId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; accessDate: Date; duration?: number; }
const schema = new Schema<IEResourceAccess>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, eResourceId: { type: Schema.Types.ObjectId, ref: 'EResource', required: true }, personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, accessDate: { type: Date, default: Date.now }, duration: Number }, { timestamps: true });
schema.index({ collegeId: 1, eResourceId: 1, accessDate: -1 });
export const EResourceAccess = model<IEResourceAccess>('EResourceAccess', schema);
