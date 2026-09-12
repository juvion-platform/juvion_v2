import { z } from 'zod';

export const alertNarrationsSchema = z.object({
  alertIds: z.array(z.string().min(1)).min(1).max(25),
});

export const outreachDraftsSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(25),
});

export const approveOutreachSchema = z.object({
  approved: z
    .array(
      z.object({
        studentId: z.string().min(1),
        subject: z.string().min(1),
        body: z.string().min(1),
        channel: z.enum(['sms', 'email', 'whatsapp', 'call', 'app']),
      }),
    )
    .min(1)
    .max(25),
});

/** POST /query (SSE) — same shape as the finance command bar, minus its dashboard filters. */
export const peopleQuerySchema = z.object({
  prompt: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});
