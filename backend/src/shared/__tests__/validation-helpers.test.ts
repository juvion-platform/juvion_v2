import { describe, it, expect } from 'vitest';
import { createExamScheduleSchema, updateExamScheduleSchema } from '../../modules/academics/validation';
import { createPlacementSeasonSchema } from '../../modules/placement/validation';
import { createHostelVisitorLogSchema } from '../../modules/welfare/validation';
import { createRegulatoryFilingSchema, updateRegulatoryFilingSchema } from '../../modules/compliance/validation';

/**
 * The audit reported these as "silently accepted on both client and server".
 * The forms were fixed first; these assert the server half actually rejects,
 * so the rule survives a direct API call.
 */

describe('exam schedule time window', () => {
  const base = {
    semesterId: 's1', courseId: 'c1', examType: 'regular' as const,
    date: '2026-03-01', startTime: '10:00', endTime: '13:00',
  };

  it('accepts an ordered window', () => {
    expect(createExamScheduleSchema.safeParse(base).success).toBe(true);
  });

  it('rejects end before start', () => {
    const res = createExamScheduleSchema.safeParse({ ...base, startTime: '14:00', endTime: '10:00' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['endTime']);
      expect(res.error.issues[0]?.message).toMatch(/after start time/);
    }
  });

  it('rejects a zero-length window', () => {
    expect(createExamScheduleSchema.safeParse({ ...base, startTime: '10:00', endTime: '10:00' }).success).toBe(false);
  });

  it('still enforces the rule on a partial update carrying both times', () => {
    expect(updateExamScheduleSchema.safeParse({ startTime: '14:00', endTime: '10:00' }).success).toBe(false);
  });

  it('lets a partial update touching one time through', () => {
    // The other side isn't in the payload, so there is nothing to compare
    // against — the model keeps its existing value.
    expect(updateExamScheduleSchema.safeParse({ venue: 'Block A' }).success).toBe(true);
    expect(updateExamScheduleSchema.safeParse({ endTime: '10:00' }).success).toBe(true);
  });
});

describe('placement season date range', () => {
  const base = { academicYearId: 'ay1', name: '2026 Season', startDate: '2026-01-01', endDate: '2026-06-30' };

  it('accepts an ordered range', () => {
    expect(createPlacementSeasonSchema.safeParse(base).success).toBe(true);
  });

  it('rejects end before start', () => {
    const res = createPlacementSeasonSchema.safeParse({ ...base, startDate: '2026-06-30', endDate: '2026-01-01' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(['endDate']);
  });

  it('allows a single-day season', () => {
    expect(createPlacementSeasonSchema.safeParse({ ...base, startDate: '2026-01-01', endDate: '2026-01-01' }).success).toBe(true);
  });
});

describe('hostel visitor log times', () => {
  const base = {
    studentId: 's1', visitorName: 'A. Parent', visitorRelation: 'father',
    visitorPhone: '9000000000', purpose: 'Visit',
  };

  it('accepts an ordered visit', () => {
    expect(createHostelVisitorLogSchema.safeParse({ ...base, inTime: '10:00', outTime: '11:30' }).success).toBe(true);
  });

  it('rejects leaving before arriving', () => {
    const res = createHostelVisitorLogSchema.safeParse({ ...base, inTime: '18:00', outTime: '09:00' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(['outTime']);
  });

  it('allows an open visit with no out-time yet', () => {
    expect(createHostelVisitorLogSchema.safeParse({ ...base, inTime: '10:00' }).success).toBe(true);
  });
});

describe('regulatory filing filed date', () => {
  const base = { body: 'aicte' as const, filingType: 'EOA', dueDate: '2026-03-31' };

  it('allows a filed date to be absent while the filing is still upcoming', () => {
    expect(createRegulatoryFilingSchema.safeParse({ ...base, status: 'upcoming' }).success).toBe(true);
  });

  it('requires a filed date once marked filed', () => {
    const res = createRegulatoryFilingSchema.safeParse({ ...base, status: 'filed' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(['filedDate']);
  });

  it('requires it for approved too', () => {
    expect(createRegulatoryFilingSchema.safeParse({ ...base, status: 'approved' }).success).toBe(false);
  });

  it('passes once the date is supplied', () => {
    expect(createRegulatoryFilingSchema.safeParse({ ...base, status: 'filed', filedDate: '2026-03-20' }).success).toBe(true);
  });

  it('catches a status-only PATCH that would leave the record without a date', () => {
    expect(updateRegulatoryFilingSchema.safeParse({ status: 'filed' }).success).toBe(false);
  });
});
