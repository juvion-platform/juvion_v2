import { Schema, model, Document, Types } from 'mongoose';

/**
 * Evaluator — internal/external/cross-college paper evaluator master.
 * Strategic Gap 6 Phase A. Used by RevaluationRequest and answer-script
 * evaluation workflows to record who graded which paper.
 *
 * `kind` discriminates:
 *   internal       — faculty at this institution (personId points to Person/Faculty)
 *   external       — outside professional (no personId; metadata captures
 *                    institution, designation, contact)
 *   cross_college  — faculty at another institution we have an agreement with
 *
 * `subjectsApproved` lists Course/subject codes the evaluator is approved
 * to grade for. Empty = unrestricted.
 */
export interface IEvaluator extends Document {
  collegeId: Types.ObjectId;
  kind: 'internal' | 'external' | 'cross_college';
  /** Internal evaluators link to the Person collection; external are free-text. */
  personId?: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  externalInstitution?: string;
  /** Course codes the evaluator is approved to grade. Empty = all. */
  subjectsApproved: string[];
  /** Honorarium per script (₹). */
  honorariumPerScript?: number;
  status: 'active' | 'inactive' | 'suspended';
}

const schema = new Schema<IEvaluator>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ['internal', 'external', 'cross_college'], required: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person' },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    externalInstitution: { type: String, trim: true },
    subjectsApproved: { type: [String], default: [] },
    honorariumPerScript: { type: Number, min: 0 },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, status: 1, kind: 1 });
schema.index({ collegeId: 1, personId: 1 });

export const Evaluator = model<IEvaluator>('Evaluator', schema);
