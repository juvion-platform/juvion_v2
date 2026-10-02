import { describe, it, expect } from 'vitest';
import { buildNoticePush, NoticePushInput } from '../payload';
import { sendBackoffMs, MAX_SEND_ATTEMPTS } from '../sender';

const base: NoticePushInput = {
  deliveryId: 'd1', receipt: 'mac.1790000000', noticeId: 'n1', tier: 'important', groupKey: 'notice:n1',
  office: 'Exam Section', title: 'Hall tickets are out', confidential: false, variant: 'published', count: 1,
};

describe('buildNoticePush (spec §6.6, NFR-05)', () => {
  it('a normal notice: ids, office and title as strings, high priority, collapsed by group', () => {
    expect(buildNoticePush(base)).toEqual({
      data: {
        deliveryId: 'd1', receipt: 'mac.1790000000', kind: 'notice', noticeId: 'n1', tier: 'important', groupKey: 'notice:n1',
        office: 'Exam Section', title: 'Hall tickets are out', variant: 'published', count: '1',
      },
      priority: 'high', collapseKey: 'notice:n1',
    });
  });

  it('a confidential notice carries no title', () => {
    const { data } = buildNoticePush({ ...base, confidential: true });
    expect(data.title).toBeUndefined();
    expect(data.office).toBe('Exam Section');
  });

  it('a reminder is variant reminder; Urgent is high priority; Routine is normal', () => {
    expect(buildNoticePush({ ...base, variant: 'reminder' }).data.variant).toBe('reminder');
    expect(buildNoticePush({ ...base, tier: 'urgent' }).priority).toBe('high');
    expect(buildNoticePush({ ...base, tier: 'routine' }).priority).toBe('normal');
  });

  it('a Routine batch carries the count and no title', () => {
    const { data } = buildNoticePush({ ...base, tier: 'routine', count: 3 });
    expect(data.count).toBe('3');
    expect(data.title).toBeUndefined();
  });

  it('every value is a string', () => {
    for (const v of Object.values(buildNoticePush(base).data)) expect(typeof v).toBe('string');
  });
});

describe('sendBackoffMs (spec §5.3)', () => {
  it('is 30 s × 2^attempts, capped at ten minutes, over five attempts', () => {
    expect([1, 2, 3, 4, 5, 6].map(sendBackoffMs)).toEqual([60_000, 120_000, 240_000, 480_000, 600_000, 600_000]);
    expect(MAX_SEND_ATTEMPTS).toBe(5);
  });
});
