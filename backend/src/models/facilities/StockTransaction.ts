import { Schema, model, Document } from 'mongoose';
export interface IStockTransaction extends Document { collegeId: Schema.Types.ObjectId; stockItemId: Schema.Types.ObjectId; type: string; quantity: number; doneBy: Schema.Types.ObjectId; reference?: string; remarks?: string; }
const schema = new Schema<IStockTransaction>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, stockItemId: { type: Schema.Types.ObjectId, ref: 'StockItem', required: true }, type: { type: String, enum: ['in', 'out', 'adjustment', 'return'], required: true }, quantity: { type: Number, required: true }, doneBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, reference: String, remarks: String }, { timestamps: true });
schema.index({ collegeId: 1, stockItemId: 1, createdAt: -1 });
export const StockTransaction = model<IStockTransaction>('StockTransaction', schema);
