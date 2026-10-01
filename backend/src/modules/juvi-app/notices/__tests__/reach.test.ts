import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { reachBucket, sparkline, remindersView, csvCell } from '../reach-service';

describe('reachBucket', () => {
  const ack = { at: new Date(), late: false, method: 'hold' as const, sessionId: new Types.ObjectId(), offline: false };
  it('is exclusive: acknowledged, then seen, then Not on Juvi, then not seen', () => {
    expect(reachBucket({ ack, seenAt: new Date(), accountId: new Types.ObjectId() })).toBe('acknowledged');
    expect(reachBucket({ ack: null, seenAt: new Date(), accountId: new Types.ObjectId() })).toBe('seen');
    expect(reachBucket({ ack: null, seenAt: null, accountId: null })).toBe('not_on_juvi');
    expect(reachBucket({ ack: null, seenAt: null, accountId: new Types.ObjectId() })).toBe('not_seen');
  });
});

describe('sparkline', () => {
  it('is cumulative over equal buckets between start and end, clamping outliers', () => {
    const start = new Date('2026-10-01T00:00:00Z');
    const end = new Date('2026-10-01T04:00:00Z');
    const at = (h: number) => new Date(start.getTime() + h * 3_600_000);
    expect(sparkline([at(0.5), at(1.5), at(1.6), at(3.9), at(9)], start, end, 4)).toEqual([1, 3, 3, 5]);
    expect(sparkline([], start, end)).toHaveLength(24);
    expect(sparkline([at(-1)], start, start, 3)).toEqual([1, 1, 1]);
  });
});

describe('remindersView', () => {
  it('reports used, the cap of two and the last reminder time', () => {
    expect(remindersView({ reminders: [] })).toEqual({ used: 0, max: 2, lastAt: null });
    expect(remindersView({ reminders: [{ at: new Date('2026-10-01T00:00:00.000Z'), by: 'a' }, { at: new Date('2026-10-02T00:00:00.000Z'), by: 'a' }] }))
      .toEqual({ used: 2, max: 2, lastAt: '2026-10-02T00:00:00.000Z' });
  });
});

describe('csvCell', () => {
  it('quotes separators and defuses spreadsheet formulas', () => {
    expect(csvCell('Asha')).toBe('Asha');
    expect(csvCell('Rao, Asha')).toBe('"Rao, Asha"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91')).toBe("'+91");
  });
});
