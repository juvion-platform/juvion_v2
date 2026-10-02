import { describe, it, expect } from 'vitest';
import {
  zonedLocalToIso, isoToZonedLocal, formatInZone, formatBytes, noticeErrorMessage, errorStatus, errorDetail,
  noticeStatus, deadlineText, countsText, pendingAsText, isNoticeAdmin, roleLabel,
} from '../notices';

const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });
const delivery = (state: 'delivering' | 'delivered' | 'failed') => ({ state, attempts: 0, lastError: null, updatedAt: null });

describe('college-timezone dates', () => {
  it('reads a datetime-local value as wall-clock time in the college zone', () => {
    expect(zonedLocalToIso('2026-10-05T17:00', 'Asia/Kolkata')).toBe('2026-10-05T11:30:00.000Z');
    expect(zonedLocalToIso('2026-07-01T09:00', 'America/New_York')).toBe('2026-07-01T13:00:00.000Z');   // EDT, UTC-4
    expect(zonedLocalToIso('2026-12-01T09:00', 'America/New_York')).toBe('2026-12-01T14:00:00.000Z');   // EST, UTC-5
    expect(() => zonedLocalToIso('5 Oct', 'Asia/Kolkata')).toThrow(/Not a date and time/);
  });

  it('round-trips an instant back to the input value, and formats it in the zone', () => {
    expect(isoToZonedLocal('2026-10-05T11:30:00.000Z', 'Asia/Kolkata')).toBe('2026-10-05T17:00');
    expect(isoToZonedLocal('2026-10-05T18:45:00.000Z', 'Asia/Kolkata')).toBe('2026-10-06T00:15');
    expect(formatInZone('2026-10-05T11:30:00.000Z', 'Asia/Kolkata')).toMatch(/5 Oct 2026/);
    expect(formatInZone('2026-10-05T11:30:00.000Z', 'Asia/Kolkata')).toMatch(/5:00/);
  });
});

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
  });
});

describe('ERP errors', () => {
  it('shows the server message verbatim and joins Zod field messages', () => {
    expect(noticeErrorMessage(httpError(403, { error: 'You can only send notices to your own department.' }))).toBe('You can only send notices to your own department.');
    expect(noticeErrorMessage(httpError(400, { error: 'Validation failed', details: [{ path: 'title', message: 'Required' }, { path: 'ackDeadline', message: 'The deadline must be in the future' }] })))
      .toBe('Required; The deadline must be in the future');
    expect(noticeErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('exposes the status and the structured detail', () => {
    const err = httpError(409, { error: 'A notice can have at most two reminders.', detail: { reminders: { used: 2, max: 2, lastAt: null } } });
    expect(errorStatus(err)).toBe(409);
    expect(errorDetail<{ reminders: { used: number } }>(err)?.reminders.used).toBe(2);
    expect(errorStatus(new Error('offline'))).toBeUndefined();
    expect(errorDetail(httpError(400, { error: 'x' }))).toBeUndefined();
  });
});

describe('list wording', () => {
  it('names delivery states first, then archive', () => {
    expect(noticeStatus({ status: 'publishing', delivery: delivery('delivering') })).toEqual({ label: 'Delivering…', variant: 'info' });
    expect(noticeStatus({ status: 'publishing', delivery: delivery('failed') })).toEqual({ label: 'Delivery failed', variant: 'danger' });
    expect(noticeStatus({ status: 'published', delivery: delivery('delivered') }).label).toBe('Published');
    expect(noticeStatus({ status: 'archived', delivery: delivery('delivered') }).label).toBe('Archived');
  });

  it('describes deadlines and counts', () => {
    expect(deadlineText({ ackRequired: false, deadline: null, deadlineState: 'none' })).toBe('No acknowledgement');
    expect(deadlineText({ ackRequired: true, deadline: null, deadlineState: 'none' })).toBe('No deadline');
    expect(deadlineText({ ackRequired: true, deadline: '2030-01-01T00:00:00.000Z', deadlineState: 'open' })).toMatch(/^Due /);
    expect(deadlineText({ ackRequired: true, deadline: '2020-01-01T00:00:00.000Z', deadlineState: 'passed' })).toMatch(/^Closed /);
    expect(countsText({ ackRequired: true, acknowledged: 3, seen: 4, counts: { audience: 10, onJuvi: 8 } })).toBe('3 / 4 / 10');
    expect(countsText({ ackRequired: false, acknowledged: 0, seen: 4, counts: { audience: 10, onJuvi: 8 } })).toBe('— / 4 / 10');
  });

  it('knows the admin roles and the role words', () => {
    expect(isNoticeAdmin('principal')).toBe(true);
    expect(isNoticeAdmin('staff')).toBe(false);
    expect(isNoticeAdmin(undefined)).toBe(false);
    expect(roleLabel('student')).toBe('All students');
    expect(roleLabel('ST-EXAM')).toBe('ST-EXAM');
  });
});

describe('pendingAsText', () => {
  it('groups members under their batch or section heading', () => {
    const text = pendingAsText('Exam timetable', [
      { name: 'Asha Rao', identifier: '24JIT0001', group: '2024 Batch · Section A', state: 'not_seen', lastSeenInApp: null },
      { name: 'Ravi Kumar', identifier: null, group: '2024 Batch · Section A', state: 'not_on_juvi', lastSeenInApp: null },
      { name: 'Meera Das', identifier: '24JIT0007', group: '2024 Batch · Section B', state: 'seen', lastSeenInApp: '2026-10-01T04:00:00.000Z' },
    ]);
    const lines = text.split('\n');
    expect(lines.slice(0, 5)).toEqual([
      'Pending for "Exam timetable": 3',
      '',
      '2024 Batch · Section A',
      '- Asha Rao (24JIT0001): Not seen',
      '- Ravi Kumar: Not on Juvi',
    ]);
    expect(lines[6]).toBe('2024 Batch · Section B');
    expect(lines[7]).toMatch(/^- Meera Das \(24JIT0007\): Seen, not acknowledged, last in the app /);
  });
});
