import mongoose, { Schema, Document } from 'mongoose';

export interface ICollege extends Document {
  name: string;
  code: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  contactEmail: string;
  contactPhone: string;
  logo?: string;
  subscription: {
    plan: string;
    status: string;
    expiresAt?: Date;
  };
  settings: Record<string, unknown>;
  status: string;
  aiSpendLimits?: {
    weeklyInr: number;
    alertThresholdPct: number;
  };
}

const collegeSchema = new Schema<ICollege>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    address: {
      line1: { type: String, required: true },
      line2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    logo: { type: String },
    subscription: {
      plan: { type: String, default: 'basic', enum: ['basic', 'standard', 'premium', 'enterprise'] },
      status: { type: String, default: 'active', enum: ['active', 'expired', 'trial', 'suspended'] },
      expiresAt: { type: Date },
    },
    settings: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'active', enum: ['active', 'inactive', 'suspended'], index: true },
    aiSpendLimits: {
      type: new Schema(
        {
          weeklyInr: { type: Number, default: 0, min: 0 },
          alertThresholdPct: { type: Number, default: 80, min: 1, max: 100 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

export const College = mongoose.model<ICollege>('College', collegeSchema);
