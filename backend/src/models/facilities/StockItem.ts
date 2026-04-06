import { Schema, model, Document } from 'mongoose';
export interface IStockItem extends Document { collegeId: Schema.Types.ObjectId; name: string; category: string; unit: string; currentStock: number; minStock: number; location: string; lastRestockedDate?: Date; }
const schema = new Schema<IStockItem>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, category: { type: String, required: true }, unit: { type: String, required: true }, currentStock: { type: Number, default: 0 }, minStock: { type: Number, default: 0 }, location: String, lastRestockedDate: Date }, { timestamps: true });
schema.index({ collegeId: 1, name: 1, category: 1 });
export const StockItem = model<IStockItem>('StockItem', schema);
