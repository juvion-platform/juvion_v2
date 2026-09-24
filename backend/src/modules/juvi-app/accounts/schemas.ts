import { z } from 'zod';
import { HHMM } from '../../../models/juvi/JuviAccount';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const deviceSchema = z.object({
  id: z.string().min(8).max(128),
  name: z.string().min(1).max(80),
  platform: z.enum(['android', 'ios']),
  appVersion: z.string().min(1).max(32),
  osVersion: z.string().min(1).max(32),
});

export const signInSchema = z.object({
  collegeId: objectId,
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  device: deviceSchema,
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200), deviceId: z.string().min(8).max(128) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  // ≥ 8 chars, no forced character classes (PRD S01).
  newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
});

export const accountSummarySchema = z.object({
  id: z.string(),
  kind: z.enum(['student', 'faculty', 'staff']),
  status: z.enum(['onboarding', 'active', 'exiting', 'deactivated', 'alumni']),
  onboardingStep: z.number().int(),
  onboardingSteps: z.array(z.string()),
  onboardingComplete: z.boolean(),
  mustChangePassword: z.boolean(),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

export const tokensResponseSchema = z.object({
  accessToken: z.string(), accessExpiresIn: z.number().int(), refreshToken: z.string(),
});
export const signInResponseSchema = tokensResponseSchema.extend({ account: accountSummarySchema });

export const settingsSchema = z.object({
  quietHours: z.object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) }),
  tiers: z.object({ important: z.boolean(), routine: z.boolean() }),
  language: z.enum(['en']),
});
export const settingsPatchSchema = z.object({
  quietHours: settingsSchema.shape.quietHours.optional(),
  // `.strict()` makes an `urgent` key a validation error rather than a silent drop.
  tiers: z.object({ important: z.boolean().optional(), routine: z.boolean().optional() }).strict().optional(),
  language: z.enum(['en']).optional(),
}).strict();

export const onboardingAdvanceSchema = z.object({ step: z.number().int().min(0).max(10) });
export const onboardingStateSchema = z.object({ onboardingStep: z.number().int(), onboardingSteps: z.array(z.string()), onboardingComplete: z.boolean() });

export const deviceRowSchema = z.object({
  sessionId: z.string(), deviceName: z.string(), platform: z.enum(['android', 'ios']),
  appVersion: z.string(), lastActiveAt: z.string(), isCurrent: z.boolean(),
});
export const devicesResponseSchema = z.object({ items: z.array(deviceRowSchema) });
