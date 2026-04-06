import { Schema, model, Document } from 'mongoose';
export interface ILibraryGateEntry extends Document { collegeId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; entryTime: Date; exitTime?: Date; }
const schema = new Schema<ILibraryGateEntry>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, entryTime: { type: Date, default: Date.now }, exitTime: Date }, { timestamps: true });
schema.index({ collegeId: 1, entryTime: -1 });
export const LibraryGateEntry = model<ILibraryGateEntry>('LibraryGateEntry', schema);
