/**
 * Client feature flags (007).
 *
 * Build-time (Vite) flags. The guardian flag MUST be re-enabled together with its backend
 * counterpart (`FINANCE_ENFORCE_FEE_GUARDIAN`) for real-college onboarding — otherwise the
 * two layers disagree (FE blocks while the API allows, or vice-versa). Default OFF for the
 * demo so bulk-imported students can be billed/paid without a linked fee guardian.
 */
export const FINANCE_ENFORCE_FEE_GUARDIAN =
  import.meta.env.VITE_FINANCE_ENFORCE_FEE_GUARDIAN === 'true';
