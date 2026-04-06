import { Schema, model, Document } from 'mongoose';
export interface IMessMenu extends Document { collegeId: Schema.Types.ObjectId; blockId?: Schema.Types.ObjectId; day: string; meals: { type: string; items: string[] }[]; effectiveFrom: Date; effectiveTo?: Date; }
const schema = new Schema<IMessMenu>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  blockId: { type: Schema.Types.ObjectId, ref: 'HostelBlock' },
  day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], required: true },
  meals: [{ type: { type: String, enum: ['breakfast', 'lunch', 'snacks', 'dinner'] }, items: [String] }],
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, day: 1, effectiveFrom: -1 });
export const MessMenu = model<IMessMenu>('MessMenu', schema);
