/**
 * Picks the push transport from the environment (spec §10): FCM when
 * FIREBASE_SERVICE_ACCOUNT_JSON is set, otherwise the fake (logging) transport.
 * fcm.ts is loaded lazily so firebase-admin stays out of processes that never push.
 */
import { FakePushTransport } from './fake';
import { PushTransport } from './types';

export * from './types';
export { FakePushTransport } from './fake';

let current: PushTransport | null = null;

export async function getPushTransport(env: NodeJS.ProcessEnv = process.env): Promise<PushTransport> {
  if (current) return current;
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const { FcmPushTransport } = await import('./fcm');
    current = new FcmPushTransport(json);
  } else {
    current = new FakePushTransport(env.NODE_ENV !== 'test');
  }
  return current;
}

/** Tests install a FakePushTransport here; null re-selects from the environment on the next send. */
export function setPushTransport(transport: PushTransport | null): void { current = transport; }

/** The startup warning when no Firebase credentials are configured, or null. */
export function pushTransportWarning(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? null
    : 'FIREBASE_SERVICE_ACCOUNT_JSON is not set: Juvi push notifications use the fake (logging) transport and reach no phone.';
}
