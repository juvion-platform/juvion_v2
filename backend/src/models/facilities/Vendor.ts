import { Schema, model, Document } from 'mongoose';
export interface IVendor extends Document { collegeId: Schema.Types.ObjectId; name: string; contactPerson: string; phone: string; email?: string; address?: string; category: string; gstNumber?: string; panNumber?: string; bankDetails?: Record<string, any>; rating?: number; isActive: boolean; }
const schema = new Schema<IVendor>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, contactPerson: { type: String, required: true }, phone: { type: String, required: true }, email: String, address: String, category: { type: String, required: true }, gstNumber: String, panNumber: String, bankDetails: Schema.Types.Mixed, rating: Number, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, name: 1 });
export const Vendor = model<IVendor>('Vendor', schema);
