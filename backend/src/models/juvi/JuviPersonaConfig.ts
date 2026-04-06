import { Schema, model, Document } from 'mongoose';
export interface IJuviPersonaConfig extends Document { collegeId: Schema.Types.ObjectId; personaType: string; displayName: string; systemPrompt: string; availableModules: string[]; availableActions: string[]; maxTokensPerResponse: number; isActive: boolean; }
const schema = new Schema<IJuviPersonaConfig>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, personaType: { type: String, required: true }, displayName: { type: String, required: true }, systemPrompt: { type: String, required: true }, availableModules: [String], availableActions: [String], maxTokensPerResponse: { type: Number, default: 2000 }, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, personaType: 1 }, { unique: true });
export const JuviPersonaConfig = model<IJuviPersonaConfig>('JuviPersonaConfig', schema);
