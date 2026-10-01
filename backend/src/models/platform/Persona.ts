import mongoose, { Schema, Document } from 'mongoose';

/**
 * 010 — Persona catalog as data.
 *
 * System rows (`collegeId: null`) are seeded from `shared/rbac/personas.ts`.
 * A college gets its own copy at onboarding (`snapshotPersonasForCollege`)
 * and evaluates against its rows only; system rows are the template. A
 * persona carries no permissions — policies point at its `code`, and the
 * engine walks `parentCode` for inheritance.
 */
export interface IPersona extends Document {
  collegeId?: mongoose.Types.ObjectId | null;
  code: string;
  label: string;
  description?: string;
  family: string;
  parentCode?: string | null;
  primaryModule: string;
  defaultRole: string;
  tier: 1 | 2 | 3;
  dashboardWidgets?: string[];
  accessibleModules?: string[];
  permissionsHint?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

const personaSchema = new Schema<IPersona>(
  {
    collegeId: { type: Schema.Types.ObjectId, default: null },
    code: { type: String, required: true, trim: true, uppercase: true },
    label: { type: String, required: true },
    description: { type: String },
    family: { type: String, required: true },
    parentCode: { type: String, default: null },
    primaryModule: { type: String, required: true },
    defaultRole: {
      type: String, required: true,
      enum: ['super_admin', 'admin', 'principal', 'hod', 'faculty', 'staff', 'student', 'parent'],
    },
    tier: { type: Number, required: true, default: 3 },
    dashboardWidgets: { type: [String], default: undefined },
    accessibleModules: { type: [String], default: undefined },
    permissionsHint: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

personaSchema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Persona = (mongoose.models['Persona'] as mongoose.Model<IPersona>)
  || mongoose.model<IPersona>('Persona', personaSchema);
