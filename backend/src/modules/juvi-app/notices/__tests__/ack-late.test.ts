import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { isLate, ackView } from '../ack-service';
import { ackRequestSchema } from '../schemas';

describe('isLate', () => {
  const deadline = new Date('2026-10-01T10:00:00.000Z');
  it('is false with no deadline, at the deadline and before it; true after it', () => {
    expect(isLate(null, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    expect(isLate(undefined, new Date())).toBe(false);
    expect(isLate(deadline, new Date('2026-10-01T09:59:59.999Z'))).toBe(false);
    expect(isLate(deadline, new Date('2026-10-01T10:00:00.000Z'))).toBe(false);
    expect(isLate(deadline, new Date('2026-10-01T10:00:00.001Z'))).toBe(true);
  });
});

describe('ackView', () => {
  it('renders the record with ISO dates and nulls for the optional fields', () => {
    const at = new Date('2026-10-01T09:00:00.000Z');
    expect(ackView({ at, late: false, method: 'hold', sessionId: new Types.ObjectId(), offline: false }))
      .toEqual({ ackAt: '2026-10-01T09:00:00.000Z', late: false, method: 'hold', offline: false, comment: null, clientAt: null });
    expect(ackView({ at, late: true, method: 'confirm', sessionId: new Types.ObjectId(), offline: true, clientAt: new Date('2026-09-30T00:00:00.000Z'), comment: 'Noted' }))
      .toMatchObject({ late: true, offline: true, comment: 'Noted', clientAt: '2026-09-30T00:00:00.000Z' });
  });
});

describe('ackRequestSchema', () => {
  it('requires a hold or confirm method and defaults offline to false', () => {
    expect(ackRequestSchema.parse({ method: 'hold' })).toEqual({ method: 'hold', offline: false });
    expect(ackRequestSchema.safeParse({ method: 'tap' }).success).toBe(false);
    expect(ackRequestSchema.safeParse({}).success).toBe(false);
  });
  it('caps the comment at 500 characters, requires an ISO clientAt, and refuses server-owned fields', () => {
    expect(ackRequestSchema.safeParse({ method: 'hold', comment: 'x'.repeat(500) }).success).toBe(true);
    expect(ackRequestSchema.safeParse({ method: 'hold', comment: 'x'.repeat(501) }).success).toBe(false);
    expect(ackRequestSchema.safeParse({ method: 'hold', clientAt: 'yesterday' }).success).toBe(false);
    expect(ackRequestSchema.safeParse({ method: 'hold', offline: true, clientAt: '2026-10-01T09:00:00+05:30' }).success).toBe(true);
    expect(ackRequestSchema.safeParse({ method: 'hold', late: false }).success).toBe(false);
    expect(ackRequestSchema.safeParse({ method: 'hold', sessionId: 'x' }).success).toBe(false);
  });
});
