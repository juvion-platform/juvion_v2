/** Server-owned ordered step list. Sub-project 2 appends 'welcome_notice'. */
export const ONBOARDING_STEPS = ['identity', 'spaces', 'notifications'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
