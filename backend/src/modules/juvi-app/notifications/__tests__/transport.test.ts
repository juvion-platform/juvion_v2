import { describe, it, expect, vi, beforeEach } from 'vitest';

const fb = vi.hoisted(() => ({
  apps: [] as { name: string }[],
  initializeApp: vi.fn((_opts: unknown, name: string) => ({ name })),
  cert: vi.fn((sa: unknown) => ({ sa })),
  sendEachForMulticast: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({ initializeApp: fb.initializeApp, cert: fb.cert, getApps: () => fb.apps }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast: fb.sendEachForMulticast }) }));

import { FakePushTransport, getPushTransport, setPushTransport, pushTransportWarning, PushMessage } from '../transport';
import { FcmPushTransport, mapFcmError, FCM_MULTICAST_MAX } from '../transport/fcm';

const SA = JSON.stringify({ project_id: 'juvi-test', client_email: 'push@juvi-test.iam.gserviceaccount.com', private_key: 'k' });
const msg: PushMessage = { data: { kind: 'notice', noticeId: 'n1', tier: 'important' }, priority: 'high', collapseKey: 'notice:n1' };

beforeEach(() => { vi.clearAllMocks(); setPushTransport(null); fb.apps = []; });

describe('FakePushTransport', () => {
  it('records every message and accepts every token unless told otherwise', async () => {
    const t = new FakePushTransport();
    t.failToken('dead', 'UNREGISTERED');
    expect(await t.send(['a', 'dead'], msg)).toEqual([{ token: 'a', ok: true }, { token: 'dead', ok: false, error: 'UNREGISTERED' }]);
    expect(t.sent).toEqual([{ tokens: ['a', 'dead'], message: msg }]);
    t.reset();
    expect(t.sent).toEqual([]);
    expect(await t.send(['dead'], msg)).toEqual([{ token: 'dead', ok: true }]);
  });
});

describe('FcmPushTransport', () => {
  it('sends one data-only multicast with the Android priority and collapse key, and maps per-token errors', async () => {
    fb.sendEachForMulticast.mockResolvedValue({
      successCount: 1, failureCount: 2,
      responses: [
        { success: true, messageId: 'm1' },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/server-unavailable' } },
      ],
    });
    const t = new FcmPushTransport(SA);
    expect(fb.initializeApp).toHaveBeenCalledWith({ credential: { sa: JSON.parse(SA) } }, 'juvi-push');
    const res = await t.send(['a', 'b', 'c'], msg);
    expect(fb.sendEachForMulticast).toHaveBeenCalledWith({ tokens: ['a', 'b', 'c'], data: msg.data, android: { priority: 'high', collapseKey: 'notice:n1' } });
    expect(res).toEqual([{ token: 'a', ok: true }, { token: 'b', ok: false, error: 'UNREGISTERED' }, { token: 'c', ok: false, error: 'UNAVAILABLE' }]);
  });

  it('reuses the named app, chunks at 500 tokens, and turns a failed call into retryable errors', async () => {
    fb.apps = [{ name: 'juvi-push' }];
    fb.sendEachForMulticast.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({ responses: tokens.map(() => ({ success: true })) }));
    const t = new FcmPushTransport(SA);
    expect(fb.initializeApp).not.toHaveBeenCalled();
    const tokens = Array.from({ length: FCM_MULTICAST_MAX + 1 }, (_, i) => `t${i}`);
    expect((await t.send(tokens, msg)).every((r) => r.ok)).toBe(true);
    expect(fb.sendEachForMulticast).toHaveBeenCalledTimes(2);

    fb.sendEachForMulticast.mockRejectedValueOnce(Object.assign(new Error('socket hang up'), { code: 'app/network-error' }));
    expect(await t.send(['x'], msg)).toEqual([{ token: 'x', ok: false, error: 'UNAVAILABLE' }]);
  });

  it('maps the FCM codes the sender cares about', () => {
    expect(mapFcmError('messaging/invalid-registration-token')).toBe('INVALID_ARGUMENT');
    expect(mapFcmError('messaging/invalid-argument')).toBe('INVALID_ARGUMENT');
    expect(mapFcmError('messaging/internal-error')).toBe('INTERNAL');
    expect(mapFcmError('messaging/quota-exceeded')).toBe('QUOTA_EXCEEDED');
    expect(mapFcmError('messaging/third-party-auth-error')).toBe('UNKNOWN');
    expect(mapFcmError(undefined)).toBe('UNKNOWN');
  });
});

describe('getPushTransport (spec §10)', () => {
  it('is the fake, with a warning, when FIREBASE_SERVICE_ACCOUNT_JSON is unset', async () => {
    expect((await getPushTransport({ NODE_ENV: 'test' })).name).toBe('fake');
    expect(pushTransportWarning({})).toMatch(/FIREBASE_SERVICE_ACCOUNT_JSON is not set/);
  });

  it('is FCM when the service account is set, and stays selected', async () => {
    const t = await getPushTransport({ FIREBASE_SERVICE_ACCOUNT_JSON: SA });
    expect(t.name).toBe('fcm');
    expect(await getPushTransport({})).toBe(t);
    expect(pushTransportWarning({ FIREBASE_SERVICE_ACCOUNT_JSON: SA })).toBeNull();
  });

  it('setPushTransport installs a test transport', async () => {
    const fake = new FakePushTransport();
    setPushTransport(fake);
    expect(await getPushTransport({ FIREBASE_SERVICE_ACCOUNT_JSON: SA })).toBe(fake);
  });
});
