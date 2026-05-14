import { Schema, model, Document, Types } from 'mongoose';

/**
 * Staff — the operational entity for non-faculty staff at the college.
 *
 * `staffType` historically was a free-form bucket. Strategic Gap 7
 * adds:
 *   personaCode      — canonical L1/L2/L3 persona from `shared/rbac/
 *                      personas.ts`. The User.personaType is derived
 *                      from this for JWT purposes. Optional in
 *                      Phase A so existing rows stay valid.
 *   clusterHeadOfPersonIds
 *                    — when this staff is a cluster head (e.g.
 *                      ST-ADM-AO-CH), this lists the Person ids of
 *                      direct reports. Used by CRM aggregations to
 *                      compute cluster-level KPIs and by push events
 *                      to escalate target misses.
 */

export interface IStaff extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId;
  employeeCode: string;
  designation: string;
  departmentId?: Schema.Types.ObjectId;
  staffType: string;
  /** Canonical persona code (e.g. 'ST-ADM-TC'). Strategic Gap 7. */
  personaCode?: string;
  /** Direct-report person ids for cluster-head sub-personas. Strategic Gap 7. */
  clusterHeadOfPersonIds?: Types.ObjectId[];
  status: string;
}

const schema = new Schema<IStaff>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  employeeCode: { type: String, required: true },
  designation: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  staffType: { type: String, required: true },
  personaCode: { type: String, trim: true },
  clusterHeadOfPersonIds: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
  status: { type: String, enum: ['active', 'on_leave', 'separated'], default: 'active' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeCode: 1 }, { unique: true });
// Cluster-head lookups: "who owns this person?". Strategic Gap 7.
schema.index({ collegeId: 1, clusterHeadOfPersonIds: 1 });
// Sub-persona enumeration for admin filters.
schema.index({ collegeId: 1, personaCode: 1 });

export const Staff = model<IStaff>('Staff', schema);
