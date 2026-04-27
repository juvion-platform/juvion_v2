import { Schema, model, Types } from 'mongoose';

/**
 * SituationDismissal — per-user, per-college snooze record for an
 * agent-surfaced situation card (see fee-analytics-ai-native plan §2.1
 * and Task A2).
 *
 * `situationFingerprint` is a stable hash of the candidate's `kind`
 * plus its sorted `studentIds`, so the same logical situation across
 * two cron runs collapses to one fingerprint; the `/situations`
 * endpoint suppresses any candidate with an active dismissal whose
 * `snoozedUntil > now()`.
 *
 * `reason` accepts the empty string (officer dismissed without
 * commenting) but rejects `null` — empty string is a meaningful
 * "no comment provided" sentinel; null would conflate with "field
 * was never set" which the audit log shouldn't allow.
 */

export interface ISituationDismissal {
  _id: Types.ObjectId;
  collegeId: Types.ObjectId;
  userId: Types.ObjectId;
  situationFingerprint: string;
  snoozedUntil: Date;
  reason: string;
  createdAt: Date;
}

const schema = new Schema<ISituationDismissal>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    situationFingerprint: { type: String, required: true },
    snoozedUntil: { type: Date, required: true },
    // Per spec: accept empty string ("officer didn't comment") but
    // reject `null` / `undefined`. Mongoose's `required: true` on
    // `String` treats `''` as missing, so we use a custom validator
    // that accepts the empty string but flags `null`/`undefined`.
    reason: {
      type: String,
      validate: {
        validator: (v: string | null | undefined) =>
          typeof v === 'string',
        message: '`reason` must be a string (empty string is allowed; null is not)',
      },
    },
  },
  { timestamps: true },
);

// Plan §2.2 — active-snooze lookup: filter by (college, user) and check
// `snoozedUntil > now()`. Ascending on `snoozedUntil` keeps range queries
// efficient and matches the plan's literal index spec.
schema.index({ collegeId: 1, userId: 1, snoozedUntil: 1 });

export const SituationDismissal = model<ISituationDismissal>(
  'SituationDismissal',
  schema,
);
