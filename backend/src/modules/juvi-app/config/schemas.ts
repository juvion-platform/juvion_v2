import { z } from 'zod';

const minAppVersion = z.object({ android: z.string().optional(), ios: z.string().optional() }).nullable();
const supportContact = z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional() }).nullable();

export const institutionLookupResponseSchema = z.object({
  collegeId: z.string(), name: z.string(), logoUrl: z.string().nullable(), accentColor: z.string().nullable(),
  paused: z.boolean(), pausedMessage: z.string().nullable(), minAppVersion,
});

export const configResponseSchema = z.object({
  name: z.string(), code: z.string(), logoUrl: z.string().nullable(), accentColor: z.string().nullable(),
  supportContact, quietHoursDefault: z.object({ start: z.string(), end: z.string() }), timezone: z.string(),
  featureFlags: z.object({ languageRoadmap: z.boolean() }), minAppVersion, onboardingSteps: z.array(z.string()),
});
