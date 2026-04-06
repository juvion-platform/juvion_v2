import { Schema, model, Document } from 'mongoose';
export interface IGoverningBodyMember extends Document { collegeId: Schema.Types.ObjectId; personId?: Schema.Types.ObjectId; externalName?: string; designation: string; role: string; appointedDate: Date; tenure?: number; isActive: boolean; }
const schema = new Schema<IGoverningBodyMember>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, personId: { type: Schema.Types.ObjectId, ref: 'Person' }, externalName: String, designation: { type: String, required: true }, role: { type: String, enum: ['chairperson', 'secretary', 'member', 'nominee', 'invitee'], required: true }, appointedDate: { type: Date, required: true }, tenure: Number, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, role: 1 });
export const GoverningBodyMember = model<IGoverningBodyMember>('GoverningBodyMember', schema);
