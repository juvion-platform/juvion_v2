import { Schema, model, Document } from 'mongoose';

// ─── 001-ai-lead-scoring — score rationale ────────────────────────
// Snapshot of how the most recent score was computed. Read by the UI
// (rationale card) and by audit logs. Worker writes this every time it
// completes a scoring job. See `.sdd/specs/001-ai-lead-scoring/spec.md`
// §10.1.
export interface ScoreRationale {
  ruleScore: number;
  llmScore: number | null;
  blendedScore: number;
  factors: Array<{ label: string; weight: number; source: 'rule' | 'llm' }>;
  lastInteractionInfluence?: { factor: string; shift: number };
  llmSkipped?: boolean;
  llmFallback?: boolean;
  llmCostInr?: number;
  computedAt: Date;
  modelVersion: string;
}

export interface IInquiry extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId?: Schema.Types.ObjectId;
  // Personal
  name: string; fatherName?: string; phone: string; altPhone?: string; email?: string;
  gender?: string; dateOfBirth?: Date;
  // Address
  city?: string; state?: string; district?: string; pincode?: string;
  // Academic background
  tenthPercentage?: number; interPercentage?: number; interStream?: string;
  previousCollege?: string;
  // Interest
  source: string; programmeInterest?: string; branchInterest?: string;
  // Tracking
  date: Date; status: string; leadScore?: number;
  notes?: string; followUpDate?: Date;
  assignedTo?: string;
  // W01 enhancements
  leadGrade?: string;            // 'hot' | 'warm' | 'cold' | 'dormant'
  tags?: string[];
  lastInteractionAt?: Date;
  interactionCount?: number;
  importBatchId?: Schema.Types.ObjectId;
  workflowInstanceId?: Schema.Types.ObjectId;
  // Conversion
  convertedToApplicantId?: Schema.Types.ObjectId;
  // W01 intake enhancements
  aadhaarNumber?: string;
  languagePreference?: string;

  // ─── Strategic Gap 5 — CRM depth (Phase A) ─────────────────────────
  // UTM source attribution (mirrors what marketing-attribution tools
  // pass via query params on the institution's landing pages).
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;

  // MQL/SQL classification — orthogonal to leadGrade (hot/warm/cold).
  // 'mql' = Marketing Qualified Lead (showed intent), 'sql' = Sales
  // Qualified Lead (admissions officer confirmed eligibility +
  // intent-to-apply), 'disqualified' = explicit no.
  mqlSqlClassification?: 'mql' | 'sql' | 'disqualified';

  // Verification flags — admin-gated booleans flipped after confirmation.
  emailVerified?: boolean;
  mobileVerified?: boolean;

  // Officer-tier hierarchy. `assignedOfficerId` is a Person ref —
  // canonical replacement for the legacy `assignedTo` string.
  // `clusterHeadId` captures the within-tier hierarchy (officer's
  // cluster head, not the same as department head).
  assignedOfficerId?: Schema.Types.ObjectId;
  clusterHeadId?: Schema.Types.ObjectId;

  // Which assignment rule (if any) routed this inquiry to the
  // current officer. Lets the admin trace "why did this lead land
  // with officer X?"
  assignedByRuleId?: Schema.Types.ObjectId;

  // 001-ai-lead-scoring §10.1
  scoreRationale?: ScoreRationale;
  lastScoredAt?: Date;
}

const schema = new Schema<IInquiry>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear' },
  // Personal
  name: { type: String, required: true },
  fatherName: String,
  phone: { type: String, required: true },
  altPhone: String,
  email: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: Date,
  // Address
  city: String,
  state: String,
  district: String,
  pincode: String,
  // Academic background
  tenthPercentage: Number,
  interPercentage: Number,
  interStream: { type: String, enum: ['MPC', 'BiPC', 'MEC', 'CEC', 'other'] },
  previousCollege: String,
  // Interest
  source: { type: String, enum: ['website', 'walk-in', 'referral', 'whatsapp', 'newspaper', 'social_media', 'education_fair', 'phone'], required: true },
  programmeInterest: String,
  branchInterest: String,
  // Tracking
  date: { type: Date, default: Date.now },
  // Expanded status taxonomy — Strategic Gap 5. Mirrors CampX's
  // prospect-stage depth so the funnel-stage filters can split the
  // pipeline cleanly. The original 9 values stay valid; the new
  // values surface intermediate states (no-response, callback,
  // counsellor-meeting-scheduled, fee-quoted-pending, etc.).
  status: {
    type: String,
    enum: [
      // Top of funnel — fresh lead
      'new',
      'enrichment_pending',
      // Initial outreach
      'first_contact_attempt',
      'contacted',
      'no_response',
      'callback_requested',
      'wrong_number',
      'do_not_contact',
      // Engagement / nurturing
      'follow_up',
      'follow_up_overdue',
      'interested',
      'sent_brochure',
      'mql',           // Marketing Qualified Lead
      'sql',           // Sales Qualified Lead
      // Visit + counselling
      'visit_scheduled',
      'visit_completed',
      'visited',       // legacy alias for visit_completed
      'counsellor_meeting_scheduled',
      'counsellor_meeting_done',
      'parent_meeting_done',
      // Qualification + offer
      'qualified',
      'eligibility_pending',
      'fee_quoted',
      // Outcomes
      'converted',
      'lost',
      'disqualified',
      'dormant',
      'duplicate_merged',
    ],
    default: 'new',
  },
  leadScore: { type: Number, min: 0, max: 100 },
  notes: String,
  followUpDate: Date,
  assignedTo: String,
  // W01 enhancements
  leadGrade: { type: String, enum: ['hot', 'warm', 'cold', 'dormant'] },
  tags: [String],
  lastInteractionAt: Date,
  interactionCount: { type: Number, default: 0 },
  importBatchId: { type: Schema.Types.ObjectId, ref: 'LeadImportBatch' },
  workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance' },
  // Conversion
  convertedToApplicantId: { type: Schema.Types.ObjectId, ref: 'Applicant' },
  // W01 intake enhancements
  aadhaarNumber: String,
  languagePreference: String,

  // ─── Strategic Gap 5 — CRM depth (Phase A) ───────────────────────
  // UTM source attribution. Captured from the landing-page URL on
  // inquiry-form submit (or backfilled by the marketing team when
  // they reconcile attribution).
  utmSource: { type: String, trim: true },
  utmMedium: { type: String, trim: true },
  utmCampaign: { type: String, trim: true },
  utmTerm: { type: String, trim: true },
  utmContent: { type: String, trim: true },

  // Funnel classification. Orthogonal to `leadGrade`.
  mqlSqlClassification: {
    type: String,
    enum: ['mql', 'sql', 'disqualified'],
  },

  // Verification flags.
  emailVerified: { type: Boolean, default: false },
  mobileVerified: { type: Boolean, default: false },

  // Officer hierarchy. `assignedOfficerId` is the canonical Person
  // ref; `assignedTo` (string) is kept for backward compat — newly
  // created inquiries should write `assignedOfficerId` exclusively.
  assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'Person' },
  clusterHeadId: { type: Schema.Types.ObjectId, ref: 'Person' },
  assignedByRuleId: { type: Schema.Types.ObjectId, ref: 'AssignmentRule' },

  // ─── 001-ai-lead-scoring fields ─────────────────────────────
  scoreRationale: {
    type: {
      ruleScore: { type: Number, required: true },
      llmScore: { type: Number, default: null },
      blendedScore: { type: Number, required: true },
      factors: [{
        _id: false,
        label: String,
        weight: Number,
        source: { type: String, enum: ['rule', 'llm'] },
      }],
      lastInteractionInfluence: {
        _id: false,
        factor: String,
        shift: Number,
      },
      llmSkipped: { type: Boolean, default: false },
      llmFallback: { type: Boolean, default: false },
      llmCostInr: Number,
      computedAt: Date,
      modelVersion: String,
    },
    _id: false,
    default: undefined,
  },
  lastScoredAt: { type: Date },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, phone: 1 });
// Phase A — new indexes powering the CRM dashboard:
// "who's working what" + "show me my pipeline by status".
schema.index({ collegeId: 1, assignedOfficerId: 1, status: 1 });
// "MQLs ready for SQL hand-off" + funnel reporting.
schema.index({ collegeId: 1, mqlSqlClassification: 1 });
// UTM attribution reports: "which campaign brought how many SQLs?"
schema.index({ collegeId: 1, utmCampaign: 1 });

// 001-ai-lead-scoring §10.2 — power "sorted by score" lists,
// grade filters, and the debounce lookup on lastScoredAt.
schema.index({ collegeId: 1, leadScore: -1 });
schema.index({ collegeId: 1, leadGrade: 1, leadScore: -1 });
schema.index({ collegeId: 1, lastScoredAt: -1 });

export const Inquiry = model<IInquiry>('Inquiry', schema);
