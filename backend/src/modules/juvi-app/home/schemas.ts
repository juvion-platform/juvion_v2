/**
 * §7.1–§7.3 wire schemas for the Today / Teaching / me-academics endpoints.
 * Hand mirror of the service types in ./service (Task 14) and ./readers
 * (Task 13) — keep field names in lockstep. Objects are never null
 * (Foundation rulings R57/R61): an absent block is `.optional()` (omitted),
 * a nullable value is a scalar with `.nullable()`.
 */
import { z } from 'zod';

export const dayClassSchema = z.object({
  offeringId: z.string(),
  courseCode: z.string(),
  title: z.string(),
  section: z.string(),
  /** College-timezone HH:MM. */
  start: z.string(),
  end: z.string(),
  slotType: z.string(),
  status: z.enum(['cancelled', 'rescheduled', 'scheduled']),
  room: z.string().optional(),
  faculty: z.string().optional(),
  channelId: z.string().optional(),
  /** Faculty viewers only: enrolled head-count on the offering. */
  registered: z.number().int().optional(),
  /** Present when status is rescheduled: the original date + start (§7.1). */
  movedFrom: z.object({ date: z.string(), start: z.string() }).optional(),
});

export const dayViewSchema = z.object({
  date: z.string(),
  /** Title of the published holiday covering this date. */
  holiday: z.string().optional(),
  classes: z.array(dayClassSchema),
});

export const todaySchema = z.object({
  asOf: z.string(),
  today: dayViewSchema,
  tomorrow: dayViewSchema,
  glance: z.object({
    attendance: z.object({
      available: z.boolean(),
      /** Omitted when no attendance has been recorded (held = 0 → null upstream). */
      overallPct: z.number().optional(),
      threshold: z.number(),
      belowThreshold: z.boolean(),
    }),
    dues: z.object({
      available: z.boolean(),
      totalOutstanding: z.number().int(), // integer paise (R1)
      /** Omitted when there are no open invoices. Amount is integer paise (R1); the date is a college-tz-midnight ISO instant, not 'YYYY-MM-DD' (R15). */
      nextDue: z.object({ amount: z.number().int(), date: z.string() }).optional(),
    }),
    /** First scheduled assessment within 14 days (Assumption A5); omitted when none. */
    nextAssessment: z.object({
      offeringId: z.string(),
      courseCode: z.string(),
      title: z.string(),
      at: z.string(),
      channelId: z.string().optional(),
    }).optional(),
  }),
});

export const teachingSchema = z.object({
  asOf: z.string(),
  today: dayViewSchema,
  tomorrow: dayViewSchema,
  /** Next day with classes, scanning strictly after the date, ≤ 14 days; omitted when none. */
  nextTeachingDay: dayViewSchema.optional(),
  faculty: z.object({ kind: z.enum(['regular', 'hod', 'adjunct']) }),
});

export const dueInvoiceItemSchema = z.object({
  number: z.string(),
  type: z.string(),
  outstanding: z.number().int(), // integer paise (R1)
  nextDue: z.object({ amount: z.number().int(), date: z.string() }), // amount: integer paise (R1); date: college-tz-midnight ISO instant (R15)
  overdue: z.boolean(),
});

export const studentDuesSchema = z.object({
  available: z.boolean(),
  totalOutstanding: z.number().int(), // integer paise (R1)
  invoices: z.array(dueInvoiceItemSchema),
  lastPayment: z.object({ amount: z.number().int(), date: z.string() }).optional(),
  /** Present only when the college's juvi.paymentPortalUrl is configured (Task 9). */
  payUrl: z.string().optional(),
});

export const studentAcademicsSchema = z.object({
  attendance: z.object({
    available: z.boolean(),
    threshold: z.number(),
    showHeadroom: z.boolean(),
    /** §7.3 nests the overall; pct is a nullable scalar (Foundation R57/R61), null exactly when held is 0 (R13). */
    overall: z.object({ held: z.number(), attended: z.number(), pct: z.number().nullable() }),
    courses: z.array(z.object({
      offeringId: z.string(),
      courseCode: z.string(),
      title: z.string(),
      held: z.number(),
      attended: z.number(),
      pct: z.number().nullable(),
      headroom: z.number(),
      channelId: z.string().optional(), // R42: no per-course threshold — §7.3 names it once, at the attendance top level
    })),
  }),
  dues: studentDuesSchema,
});

export const coursesTaughtItemSchema = z.object({
  offeringId: z.string(),
  courseCode: z.string(),
  title: z.string(),
  section: z.string(),
  channelId: z.string().optional(),
});

// There is deliberately no `meAcademicsSchema` union here: `/me/academics` is
// registered in document.ts as `z.union([StudentAcademics, FacultyCourses])`
// over the two *registered* arms, because a union of these raw schemas would
// inline both arms instead of emitting the `$ref`s the contract test pins.
