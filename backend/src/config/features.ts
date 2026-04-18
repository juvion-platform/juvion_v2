/**
 * Feature flags — strict, env-driven, no dependencies.
 *
 * Each flag reads the environment live on every call so tests can toggle
 * the flag mid-suite without having to re-import this module, and so a
 * running process can in principle be signaled to change behavior by
 * updating its env (though in practice flags are set at process start).
 *
 * Convention: only the literal string `'true'` enables a flag. Anything
 * else — `'True'`, `'1'`, `''`, or unset — keeps the flag disabled. This
 * avoids the class of bugs where a truthy value is accidentally treated
 * as "on" (e.g. `'false'` being truthy under bare coercion).
 */

const FLAG_ON = 'true';

/**
 * optional-hostel-transport-allotment feature:
 *   when enabled, hostel and transport allocations flow through an
 *   admin-propose → student-accept pipeline. When disabled, the legacy
 *   auto-allocate path continues to run. See
 *   .captain/specs/optional-hostel-transport-allotment/spec.md.
 */
export function isOptionalAllotmentEnabled(): boolean {
  return process.env.FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS === FLAG_ON;
}

/**
 * Email-channel notifications for allocation lifecycle events.
 *
 * When enabled, `allocation-lifecycle.recordTransition` produces an
 * additional `Notification { channel: 'email' }` record alongside the
 * standard in-app one. A downstream SMTP worker (not part of this
 * feature) is expected to consume `channel: 'email'` records from the
 * `Notification` collection and deliver them. Until that worker exists,
 * turning this flag on causes email-channel records to accumulate
 * harmlessly — they're valid `Notification` documents.
 */
export function isEmailNotificationsEnabled(): boolean {
  return process.env.FEATURE_EMAIL_NOTIFICATIONS === FLAG_ON;
}

/**
 * Typed accessor for all feature flags. Use as `features.optionalAllotmentProposals`
 * at call sites that prefer field-style access over function calls. The getter
 * ensures the value stays in sync with the live env var.
 */
export interface Features {
  readonly optionalAllotmentProposals: boolean;
  readonly emailNotifications: boolean;
}

export const features: Features = {
  get optionalAllotmentProposals(): boolean {
    return isOptionalAllotmentEnabled();
  },
  get emailNotifications(): boolean {
    return isEmailNotificationsEnabled();
  },
};
