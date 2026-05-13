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

// ─── Strategic Gap 3 — per-college overlay ───────────────────────────
//
// Env vars are the platform-wide default. `institution-feature-flags`
// (stored in `ConfigEntry`) can OVERRIDE those defaults per college.
// Callers that need the per-college effective view use this async
// loader; the synchronous env-only API above stays valid for code
// paths that haven't been threaded with a `collegeId` yet.
//
// We import lazily inside the function so this module stays cycle-
// free and can be imported from anywhere (including the platform
// service that owns the model).

export interface CollegeFeatures extends Features {
  readonly smsNotifications: boolean;
  readonly whatsappNotifications: boolean;
  readonly juviAiSuggestions: boolean;
  readonly parentPortal: boolean;
  readonly financeBlocksExams: boolean;
  readonly bulkImportPortal: boolean;
}

/**
 * Read the effective feature flags for a specific college. Reads the
 * DB-stored `institution-feature-flags` ConfigEntry overlay; falls
 * back to env-var defaults for any flag the college has not explicitly
 * toggled. Safe to call from any service-layer code path.
 *
 * No caching in Phase A — every call is one indexed Mongo round-trip.
 * Phase B can add a short-TTL in-memory cache if call sites get hot.
 */
export async function getCollegeFeatures(collegeId: string): Promise<CollegeFeatures> {
  // Lazy import to keep this module dependency-light and break cycles
  // (config-service imports the ConfigEntry model which Mongoose may
  // not yet have registered at this module's load time).
  const { getEffectiveSingletonValues } = await import('../modules/platform/config-service');

  let overlay: Record<string, unknown> = {};
  try {
    overlay = await getEffectiveSingletonValues(collegeId, 'institution-feature-flags');
  } catch {
    // Config registry not initialised yet (e.g. in early-boot scripts).
    // Fall through to env-only defaults.
    overlay = {};
  }

  const flag = (key: string, envFallback: boolean): boolean => {
    const v = overlay[key];
    if (typeof v === 'boolean') return v;
    return envFallback;
  };

  return {
    optionalAllotmentProposals: flag('optionalAllotmentProposals', isOptionalAllotmentEnabled()),
    emailNotifications:         flag('emailNotifications',         isEmailNotificationsEnabled()),
    smsNotifications:           flag('smsNotifications',           false),
    whatsappNotifications:      flag('whatsappNotifications',      false),
    juviAiSuggestions:          flag('juviAiSuggestions',          true),
    parentPortal:               flag('parentPortal',               false),
    financeBlocksExams:         flag('financeBlocksExams',         false),
    bulkImportPortal:           flag('bulkImportPortal',           true),
  };
}
