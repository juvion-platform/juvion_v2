/**
 * Server-owned ordered step list. Notices (sub-project 2) appended 'first_notice' (index 3):
 * the welcome notice from GET /onboarding/first-notice, acknowledged for real.
 * Apps that do not know a step render it as a generic card (notices spec US-5.3).
 */
export const ONBOARDING_STEPS = ['identity', 'spaces', 'notifications', 'first_notice'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
