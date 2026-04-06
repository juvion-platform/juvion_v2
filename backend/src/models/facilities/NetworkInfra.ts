import { Schema, model, Document } from 'mongoose';
export interface INetworkInfra extends Document { collegeId: Schema.Types.ObjectId; name: string; type: string; location: string; bandwidth?: string; ipRange?: string; ssid?: string; status: string; }
const schema = new Schema<INetworkInfra>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, type: { type: String, enum: ['wifi_ap', 'switch', 'router', 'firewall', 'server', 'fiber_link'], required: true }, location: { type: String, required: true }, bandwidth: String, ipRange: String, ssid: String, status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' } }, { timestamps: true });
schema.index({ collegeId: 1 });
export const NetworkInfra = model<INetworkInfra>('NetworkInfra', schema);
