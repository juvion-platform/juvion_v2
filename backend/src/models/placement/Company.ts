import { Schema, model, Document } from 'mongoose';

export interface ICompany extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; industry: string; website?: string; contactPerson: string; contactEmail: string; contactPhone: string; tier: string; isActive: boolean;
  relationshipStatus: string;
  blacklistFlag: boolean;
  blacklistReason?: string;
  mouExpiry?: Date;
  relationshipHealthScore?: number;
  size?: string;
  hq?: string;
  pipelineTier?: string;
  conversionRate?: number;
  lastEngagementDate?: Date;
}

const schema = new Schema<ICompany>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  industry: { type: String, required: true },
  website: String,
  contactPerson: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: String,
  tier: { type: String, enum: ['dream', 'super_dream', 'regular', 'mass'], default: 'regular' },
  isActive: { type: Boolean, default: true },
  relationshipStatus: { type: String, enum: ['active', 'dormant', 'blacklisted', 'new'], default: 'new' },
  blacklistFlag: { type: Boolean, default: false },
  blacklistReason: String,
  mouExpiry: Date,
  relationshipHealthScore: Number,
  size: { type: String, enum: ['startup', 'small', 'medium', 'large', 'mnc'] },
  hq: String,
  pipelineTier: { type: String, enum: ['tier_1', 'tier_2', 'tier_3'] },
  conversionRate: Number,
  lastEngagementDate: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, name: 1 });

export const Company = model<ICompany>('Company', schema);
