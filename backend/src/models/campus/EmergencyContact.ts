import { Schema, model, Document } from 'mongoose';
export interface IEmergencyContact extends Document { collegeId: Schema.Types.ObjectId; name: string; role: string; phone: string; alternatePhone?: string; email?: string; isActive: boolean; }
const schema = new Schema<IEmergencyContact>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, role: { type: String, enum: ['fire', 'police', 'ambulance', 'hospital', 'principal', 'security_head', 'warden', 'other'], required: true }, phone: { type: String, required: true }, alternatePhone: String, email: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
export const EmergencyContact = model<IEmergencyContact>('EmergencyContact', schema);
