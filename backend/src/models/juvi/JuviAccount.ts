import { Schema, model, Document, Types } from 'mongoose';

export type AccountKind = 'student' | 'faculty' | 'staff';
export type AccountStatus = 'onboarding' | 'active' | 'exiting' | 'deactivated' | 'alumni';
export type TransitionSource = 'bulk' | 'workflow' | 'admin' | 'system';

export const ACCOUNT_KINDS: readonly AccountKind[] = ['student', 'faculty', 'staff'];
/** 'alumni' is reserved for Release 4 and is never set in R1. */
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['onboarding', 'active', 'exiting', 'deactivated', 'alumni'];
export const TRANSITION_SOURCES: readonly TransitionSource[] = ['bulk', 'workflow', 'admin', 'system'];
/** Statuses that may hold channel memberships and sign in. */
export const ELIGIBLE_STATUSES: readonly AccountStatus[] = ['onboarding', 'active'];

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface IAccountTransition {
  from: AccountStatus | null;
  to: AccountStatus;
  source: TransitionSource;
  by: string;
  at: Date;
}

export interface IAccountSettings {
  quietHours: { start: string; end: string };
  tiers: { important: boolean; routine: boolean };
  language: 'en';
}

export interface IJuviAccount extends Document {
  collegeId: Types.ObjectId;
  personId: Types.ObjectId;
  userId: Types.ObjectId;
  kind: AccountKind;
  studentId?: Types.ObjectId;
  facultyId?: Types.ObjectId;
  staffId?: Types.ObjectId;
  status: AccountStatus;
  onboardingStep: number;
  onboardingCompletedAt?: Date;
  settings: IAccountSettings;
  lastSeenAt?: Date;
  lastReconciledAt?: Date;
  transitions: IAccountTransition[];
  provisionedAt: Date;
  provisionedBy: string;
}

const transitionSchema = new Schema<IAccountTransition>(
  {
    from: { type: String, enum: ACCOUNT_STATUSES, default: null },
    to: { type: String, enum: ACCOUNT_STATUSES, required: true },
    source: { type: String, enum: TRANSITION_SOURCES, required: true },
    by: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const schema = new Schema<IJuviAccount>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ACCOUNT_KINDS, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty' },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff' },
    status: { type: String, enum: ACCOUNT_STATUSES, required: true, default: 'onboarding' },
    onboardingStep: { type: Number, default: 0, min: 0 },
    onboardingCompletedAt: Date,
    settings: {
      quietHours: {
        start: { type: String, match: HHMM, default: '22:00' },
        end: { type: String, match: HHMM, default: '07:00' },
      },
      tiers: {
        important: { type: Boolean, default: true },
        routine: { type: Boolean, default: true },
      },
      language: { type: String, enum: ['en'], default: 'en' },
    },
    lastSeenAt: Date,
    lastReconciledAt: Date,
    transitions: { type: [transitionSchema], default: [] },
    provisionedAt: { type: Date, default: Date.now },
    provisionedBy: { type: String, required: true },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, personId: 1 }, { unique: true });
schema.index({ collegeId: 1, userId: 1 });
schema.index({ collegeId: 1, status: 1, kind: 1 });
schema.index({ collegeId: 1, studentId: 1 }, { sparse: true });
schema.index({ collegeId: 1, facultyId: 1 }, { sparse: true });

export const JuviAccount = model<IJuviAccount>('JuviAccount', schema);
