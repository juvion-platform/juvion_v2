import { Schema, model, Document, Types } from 'mongoose';

/**
 * AssignmentRule — admin-configurable policy that routes new
 * Inquiry rows to specific admissions officers based on attributes
 * (source, score range, programme interest, geography). Strategic
 * Gap 5 Phase A.
 *
 * CampX models this as a built-in routing engine. We capture the
 * SAME rule shape so the data model floor matches; the actual
 * routing-on-create hook will be wired in Phase B (the service
 * layer needs to run this rule set on every Inquiry insert).
 *
 * Rules are evaluated in `priority` ascending — first match wins.
 * Disabled rules are skipped. If no rule matches, the inquiry
 * stays unassigned + lands in the "needs triage" admin queue.
 *
 * Multi-tenancy: every rule carries `collegeId`; the evaluator
 * filters by it before applying.
 */

export interface IAssignmentRuleCondition {
  /** Field on Inquiry the condition tests. */
  field:
    | 'source'
    | 'utmSource'
    | 'utmMedium'
    | 'utmCampaign'
    | 'programmeInterest'
    | 'branchInterest'
    | 'leadScore'
    | 'leadGrade'
    | 'state'
    | 'city'
    | 'interStream';
  operator: 'equals' | 'not_equals' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  /** RHS — string for textual ops, number for comparison ops, string[] for `in`. */
  value: string | number | string[];
}

export interface IAssignmentRule extends Document {
  collegeId: Types.ObjectId;
  /** Human-readable rule name shown in the admin UI. */
  name: string;
  description?: string;

  /** ALL conditions must match for the rule to fire (logical AND). */
  conditions: IAssignmentRuleCondition[];

  /** Target officer assignment. */
  assignedOfficerId: Types.ObjectId;
  /** Optional cluster head ref to populate alongside. */
  clusterHeadId?: Types.ObjectId;

  /** Lower priority = evaluated first. Ties broken by createdAt. */
  priority: number;
  enabled: boolean;

  /** Audit. */
  createdBy: string;
  /** Match counter — incremented every time this rule routes an inquiry. */
  matchCount: number;
  lastMatchedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const conditionSchema = new Schema<IAssignmentRuleCondition>(
  {
    field: {
      type: String,
      enum: [
        'source', 'utmSource', 'utmMedium', 'utmCampaign',
        'programmeInterest', 'branchInterest',
        'leadScore', 'leadGrade',
        'state', 'city', 'interStream',
      ],
      required: true,
    },
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'in', 'gt', 'gte', 'lt', 'lte', 'contains'],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const schema = new Schema<IAssignmentRule>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    conditions: { type: [conditionSchema], required: true, default: [] },

    assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    clusterHeadId: { type: Schema.Types.ObjectId, ref: 'Person' },

    priority: { type: Number, required: true, default: 100 },
    enabled: { type: Boolean, required: true, default: true },

    createdBy: { type: String, required: true },
    matchCount: { type: Number, required: true, default: 0 },
    lastMatchedAt: { type: Date },
  },
  { timestamps: true },
);

// Evaluator query: list ENABLED rules for this college, in priority
// order. The matcher applies them client-side (JS-side) one by one.
schema.index({ collegeId: 1, enabled: 1, priority: 1 });

export const AssignmentRule = model<IAssignmentRule>('AssignmentRule', schema);
