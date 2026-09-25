import { z } from 'zod';
import { HHMM } from '../../../models/juvi/JuviAccount';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const version = z.string().regex(/^\d+(\.\d+){0,2}$/, 'Use a version like 1.2.0');

export const settingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  pausedMessage: z.string().trim().max(300).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0B5FA5').optional(),
  supportContact: z.object({ name: z.string().trim().min(1).max(80), phone: z.string().trim().max(30).optional(), email: z.string().trim().email().optional() }).optional(),
  quietHoursDefault: z.object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) }).optional(),
  minAppVersion: z.object({ android: version.optional(), ios: version.optional() }).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  featureFlags: z.object({ languageRoadmap: z.boolean().optional() }).optional(),
}).strict();

export const createRunSchema = z.object({
  kinds: z.array(z.enum(['student', 'faculty', 'staff'])).min(1),
  programmeIds: z.array(objectId).optional(),
  batchIds: z.array(objectId).optional(),
  departmentIds: z.array(objectId).optional(),
  resetExistingPasswords: z.boolean().optional(),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const accountsQuerySchema = pageQuerySchema.extend({
  kind: z.enum(['student', 'faculty', 'staff']).optional(),
  status: z.enum(['onboarding', 'active', 'exiting', 'deactivated']).optional(),
  q: z.string().trim().max(80).optional(),
});

export const credentialsQuerySchema = z.object({
  sectionId: objectId.optional(), batchId: objectId.optional(), departmentId: objectId.optional(),
});
