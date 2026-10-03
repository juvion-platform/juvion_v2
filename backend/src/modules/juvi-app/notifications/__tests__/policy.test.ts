// backend/src/modules/juvi-app/notifications/__tests__/policy.test.ts
import { describe, it, expect } from 'vitest';
import { decide, digestSendAfter, inQuietHours, nextOccurrence, DIGEST_WINDOW_MS, PolicyInput, PolicySettings } from '../policy';

const IST = 'Asia/Kolkata';
const ON: PolicySettings = { quietHours: { start: '22:00', end: '07:00' }, tiers: { important: true, routine: true } };
const at = (iso: string) => new Date(iso);
const input = (over: Partial<PolicyInput> = {}): PolicyInput => ({
  tier: 'important', settings: ON, mutedAllMatchingChannels: false, now: at('2026-10-02T12:00:00Z'), collegeTimezone: IST, ...over,
});

// 12:00Z = 17:30 IST (outside 22:00–07:00); 17:00Z = 22:30 IST (inside); 23:00Z = 04:30 IST next day (inside).
const DAY = at('2026-10-02T12:00:00Z');
const NIGHT = at('2026-10-02T17:00:00Z');
const SMALL_HOURS = at('2026-10-02T23:00:00Z');
const NEXT_7AM_IST = at('2026-10-03T01:30:00Z');

describe('decide — tier toggles, mute and quiet hours (NTF-01, NTF-02, SPC-05)', () => {
  const cases: { name: string; over: Partial<PolicyInput>; expected: ReturnType<typeof decide> }[] = [
    // Important
    { name: 'important, daytime → now', over: { now: DAY }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'important, tier off → suppressed', over: { settings: { ...ON, tiers: { important: false, routine: true } } }, expected: { status: 'suppressed', reason: 'tier_off' } },
    { name: 'important, muted → suppressed', over: { mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'muted' } },
    { name: 'important, quiet hours evening → 07:00', over: { now: NIGHT }, expected: { status: 'scheduled', sendAfter: NEXT_7AM_IST } },
    { name: 'important, quiet hours after midnight → 07:00 the same day', over: { now: SMALL_HOURS }, expected: { status: 'scheduled', sendAfter: NEXT_7AM_IST } },
    { name: 'important, tier off beats mute', over: { settings: { ...ON, tiers: { important: false, routine: true } }, mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'tier_off' } },
    { name: 'important, mute beats quiet hours', over: { now: NIGHT, mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'muted' } },
    // Routine
    { name: 'routine, daytime → now (the digest window is applied by the caller)', over: { tier: 'routine', now: DAY }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'routine, tier off → suppressed', over: { tier: 'routine', settings: { ...ON, tiers: { important: true, routine: false } } }, expected: { status: 'suppressed', reason: 'tier_off' } },
    { name: 'routine, muted → suppressed', over: { tier: 'routine', mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'muted' } },
    { name: 'routine, quiet hours → 07:00', over: { tier: 'routine', now: NIGHT }, expected: { status: 'scheduled', sendAfter: NEXT_7AM_IST } },
    // Urgent bypasses everything
    { name: 'urgent, daytime → now', over: { tier: 'urgent', now: DAY }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'urgent, both tiers off → now', over: { tier: 'urgent', settings: { ...ON, tiers: { important: false, routine: false } } }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'urgent, muted → now', over: { tier: 'urgent', mutedAllMatchingChannels: true }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'urgent, quiet hours → now', over: { tier: 'urgent', now: NIGHT }, expected: { status: 'scheduled', sendAfter: NIGHT } },
    { name: 'urgent, everything at once → now', over: { tier: 'urgent', now: NIGHT, mutedAllMatchingChannels: true, settings: { ...ON, tiers: { important: false, routine: false } } }, expected: { status: 'scheduled', sendAfter: NIGHT } },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const now = c.over.now ?? DAY;
      expect(decide(input({ now, ...c.over }))).toEqual(c.expected);
    });
  }
});

describe('quiet hours in the college timezone', () => {
  it('a window that wraps past midnight', () => {
    expect(inQuietHours(at('2026-10-02T16:29:00Z'), ON.quietHours, IST)).toBe(false);   // 21:59 IST
    expect(inQuietHours(at('2026-10-02T16:30:00Z'), ON.quietHours, IST)).toBe(true);    // 22:00 IST
    expect(inQuietHours(at('2026-10-03T01:29:00Z'), ON.quietHours, IST)).toBe(true);    // 06:59 IST
    expect(inQuietHours(at('2026-10-03T01:30:00Z'), ON.quietHours, IST)).toBe(false);   // 07:00 IST
  });

  it('a window inside one day, and an empty window', () => {
    const lunch = { start: '13:00', end: '14:00' };
    expect(inQuietHours(at('2026-10-02T07:45:00Z'), lunch, IST)).toBe(true);           // 13:15 IST
    expect(inQuietHours(at('2026-10-02T08:30:00Z'), lunch, IST)).toBe(false);          // 14:00 IST
    expect(inQuietHours(at('2026-10-02T17:00:00Z'), { start: '22:00', end: '22:00' }, IST)).toBe(false);
  });

  it('the same instant is quiet in one timezone and not in another', () => {
    const instant = at('2026-10-02T23:30:00Z');                                         // 23:30 UTC, 05:00 IST, 19:30 New York (EDT)
    expect(inQuietHours(instant, ON.quietHours, 'UTC')).toBe(true);
    expect(inQuietHours(instant, ON.quietHours, IST)).toBe(true);
    expect(inQuietHours(instant, ON.quietHours, 'America/New_York')).toBe(false);
    expect(decide(input({ now: instant, collegeTimezone: 'America/New_York' }))).toEqual({ status: 'scheduled', sendAfter: instant });
    expect(decide(input({ now: at('2026-10-03T03:00:00Z'), collegeTimezone: 'America/New_York' })))   // 23:00 EDT
      .toEqual({ status: 'scheduled', sendAfter: at('2026-10-03T11:00:00Z') });                        // 07:00 EDT
  });

  it('nextOccurrence is strictly after now', () => {
    expect(nextOccurrence(at('2026-10-03T01:30:00Z'), '07:00', IST)).toEqual(at('2026-10-04T01:30:00Z'));
    expect(nextOccurrence(at('2026-10-03T01:29:00Z'), '07:00', IST)).toEqual(at('2026-10-03T01:30:00Z'));
  });
});

describe('digestSendAfter (NTF-04, spec §6.4)', () => {
  const now = DAY;
  it('opens a window 15 minutes out', () => {
    expect(digestSendAfter(now, null, now, ON, IST)).toEqual(new Date(now.getTime() + DIGEST_WINDOW_MS));
  });
  it('joins an open window', () => {
    const open = new Date(now.getTime() + 5 * 60_000);
    expect(digestSendAfter(now, open, now, ON, IST)).toEqual(open);
  });
  it('keeps a later policy time (quiet hours) instead of the window', () => {
    expect(digestSendAfter(NEXT_7AM_IST, null, now, ON, IST)).toEqual(NEXT_7AM_IST);
    expect(digestSendAfter(NEXT_7AM_IST, new Date(now.getTime() + 60_000), now, ON, IST)).toEqual(NEXT_7AM_IST);
  });

  // 16:20Z = 21:50 IST: outside quiet hours, but the window would open at 22:05 IST.
  const cases: { name: string; now: Date; open: Date | null; settings: PolicySettings; expected: Date }[] = [
    { name: '21:50 → the 22:05 window moves to 07:00', now: at('2026-10-02T16:20:00Z'), open: null, settings: ON, expected: NEXT_7AM_IST },
    { name: '21:40 → the 21:55 window stays', now: at('2026-10-02T16:10:00Z'), open: null, settings: ON, expected: at('2026-10-02T16:25:00Z') },
    { name: '21:50 joining a window open at 22:01 → 07:00', now: at('2026-10-02T16:20:00Z'), open: at('2026-10-02T16:31:00Z'), settings: ON, expected: NEXT_7AM_IST },
    { name: '21:50 with no quiet hours (start == end) → 22:05', now: at('2026-10-02T16:20:00Z'), open: null, settings: { ...ON, quietHours: { start: '00:00', end: '00:00' } }, expected: at('2026-10-02T16:35:00Z') },
  ];
  it.each(cases)('never opens a window inside quiet hours: $name', ({ now: t, open, settings, expected }) => {
    expect(digestSendAfter(t, open, t, settings, IST)).toEqual(expected);
  });
});
