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
