import mongoose, { Schema, Document } from 'mongoose';

export interface IPolicy extends Document {
  collegeId?: mongoose.Types.ObjectId;
  role: string;
  personaType?: string;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  scope?: {
    departmentOnly?: boolean;
    selfOnly?: boolean;
    subDomain?: string;
  };
  priority: number;
  description?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

const policySchema = new Schema<IPolicy>(
  {
    collegeId: { type: Schema.Types.ObjectId, index: true },
    role: { type: String, required: true },
    personaType: { type: String, default: null },
    module: { type: String, required: true },
    action: { type: String, required: true },
    effect: { type: String, required: true, enum: ['allow', 'deny'] },
    scope: {
      departmentOnly: { type: Boolean },
      selfOnly: { type: Boolean },
      subDomain: { type: String },
    },
    priority: { type: Number, required: true, default: 500 },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

policySchema.index({ collegeId: 1, role: 1, module: 1, isActive: 1 });
policySchema.index({ collegeId: 1, isActive: 1 });

export const Policy = (mongoose.models['RbacPolicy'] as mongoose.Model<IPolicy>) || mongoose.model<IPolicy>('RbacPolicy', policySchema);
