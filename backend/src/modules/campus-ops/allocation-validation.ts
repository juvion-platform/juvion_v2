import { z } from 'zod';

/**
 * Zod schemas for the T8/T9/T10 allocation endpoints.
 */

const objectId = z.string().length(24);

export const proposeHostelSchema = z.object({
  studentId: objectId,
  roomId: objectId,
  bedId: objectId.optional(),
  academicYearId: objectId,
  preferences: z.object({
    blockPreference: z.string().optional(),
    floorPreference: z.number().optional(),
    roomTypePreference: z.string().optional(),
  }).optional(),
  specialNeeds: z.object({
    accessibility: z.boolean().optional(),
    medical: z.string().optional(),
  }).optional(),
  forceWaitlist: z.boolean().optional(),
});

export const proposeTransportSchema = z.object({
  studentId: objectId,
  routeId: objectId,
  stopName: z.string().min(1),
  stopId: objectId.optional(),
  boardingPoint: z.string().optional(),
  academicYearId: objectId,
  forceWaitlist: z.boolean().optional(),
});

export const withdrawSchema = z.object({
  reason: z.string().min(1),
});

export const declineSchema = z.object({
  reason: z.string().optional(),
});

export const vacateRequestSchema = z.object({
  reason: z.string().optional(),
});

export const approveVacateSchema = z.object({
  clearanceNotes: z.string().optional(),
});

export const rejectVacateSchema = z.object({
  reason: z.string().min(1),
});

export const promoteSchema = z.object({}).strict();

export const acceptSchema = z.object({}).strict();
