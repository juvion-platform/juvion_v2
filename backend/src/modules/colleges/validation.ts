import { z } from 'zod';

export const createCollegeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(1),
  }),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  logo: z.string().optional(),
  subscription: z.object({
    plan: z.enum(['basic', 'standard', 'premium', 'enterprise']).optional(),
    status: z.enum(['active', 'expired', 'trial', 'suspended']).optional(),
    expiresAt: z.string().optional(),
  }).optional(),
  settings: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export const updateCollegeSchema = createCollegeSchema.partial();

/**
 * L6 — body validator for `PATCH /api/colleges/:id/ai-spend-limits`.
 *
 * Both fields are optional (partial update). At least one must be present —
 * an empty body is rejected to avoid no-op writes that would still emit an
 * AuditLog row with `changes: []`.
 *
 * Field constraints mirror the College schema:
 *   - weeklyInr        ≥ 0
 *   - alertThresholdPct ∈ [1, 100]
 */
export const updateAiSpendLimitsSchema = z.object({
  weeklyInr: z.number().min(0).optional(),
  alertThresholdPct: z.number().min(1).max(100).optional(),
}).refine(
  (data) => data.weeklyInr !== undefined || data.alertThresholdPct !== undefined,
  { message: 'At least one of weeklyInr or alertThresholdPct must be provided' },
);
