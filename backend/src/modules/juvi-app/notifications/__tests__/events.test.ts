import { describe, it, expect } from 'vitest';
import { validEvent, EVENT_NAMES } from '../events-service';

const at = '2026-10-02T09:00:00.000Z';

describe('validEvent (spec §7.3, NFR-11)', () => {
  it('accepts every allow-listed name with id-like, numeric and boolean props', () => {
    for (const name of EVENT_NAMES) expect(validEvent({ name, at, props: {} }), name).not.toBeNull();
    expect(validEvent({ name: 'notification.opened', at, props: { tier: 'urgent', noticeId: '6a1b2c3d4e5f6a7b8c9d0e1f', count: 3, granted: true, key: 'a.b:c-d_e' } }))
      .toEqual({ name: 'notification.opened', at: new Date(at), props: { tier: 'urgent', noticeId: '6a1b2c3d4e5f6a7b8c9d0e1f', count: 3, granted: true, key: 'a.b:c-d_e' } });
    expect(validEvent({ name: 'app.opened', at })).toEqual({ name: 'app.opened', at: new Date(at), props: {} });
  });

  it('refuses names outside the allow-list and bad timestamps', () => {
    expect(validEvent({ name: 'notice.body_viewed', at, props: {} })).toBeNull();
    expect(validEvent({ name: 'app.opened', at: 'yesterday', props: {} })).toBeNull();
    expect(validEvent({ name: 'app.opened', props: {} })).toBeNull();
    expect(validEvent('app.opened')).toBeNull();
  });

  it('refuses free text, long strings, nested values and extra fields', () => {
    expect(validEvent({ name: 'settings.changed', at, props: { note: 'I hate maths' } })).toBeNull();                  // spaces: free text
    expect(validEvent({ name: 'settings.changed', at, props: { email: 'a@b.com' } })).toBeNull();                      // @ is not id-like
    expect(validEvent({ name: 'settings.changed', at, props: { k: 'x'.repeat(65) } })).toBeNull();
    expect(validEvent({ name: 'settings.changed', at, props: { k: { nested: 1 } } })).toBeNull();
    expect(validEvent({ name: 'settings.changed', at, props: { k: null } })).toBeNull();
    expect(validEvent({ name: 'settings.changed', at, props: { 'bad key': 1 } })).toBeNull();
    expect(validEvent({ name: 'app.opened', at, props: {}, title: 'Exam' })).toBeNull();
  });

  it('caps props at 10 keys and 1 KB serialised', () => {
    const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i]));
    expect(validEvent({ name: 'app.opened', at, props: ten })).not.toBeNull();
    expect(validEvent({ name: 'app.opened', at, props: { ...ten, k10: 10 } })).toBeNull();
    const big = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`.padEnd(40, 'x'), 'y'.repeat(64)]));
    expect(Buffer.byteLength(JSON.stringify(big))).toBeGreaterThan(1024);
    expect(validEvent({ name: 'app.opened', at, props: big })).toBeNull();
  });
});
