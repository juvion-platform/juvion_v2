/**
 * Firebase Cloud Messaging (Android). The only module that imports
 * firebase-admin (spec §5.1). One named app per process, built from the
 * service-account JSON in FIREBASE_SERVICE_ACCOUNT_JSON.
 */
import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PushErrorCode, PushMessage, PushResult, PushTransport } from './types';

const APP_NAME = 'juvi-push';
/** FCM's sendEachForMulticast limit. */
export const FCM_MULTICAST_MAX = 500;

const CODES: Record<string, PushErrorCode> = {
  'messaging/registration-token-not-registered': 'UNREGISTERED',
  'messaging/invalid-registration-token': 'INVALID_ARGUMENT',
  'messaging/invalid-argument': 'INVALID_ARGUMENT',
  'messaging/server-unavailable': 'UNAVAILABLE',
  'messaging/unavailable': 'UNAVAILABLE',
  'messaging/internal-error': 'INTERNAL',
  'messaging/quota-exceeded': 'QUOTA_EXCEEDED',
  'messaging/message-rate-exceeded': 'QUOTA_EXCEEDED',
  'messaging/device-message-rate-exceeded': 'QUOTA_EXCEEDED',
};

export function mapFcmError(code: string | undefined): PushErrorCode {
  return (code && CODES[code]) || 'UNKNOWN';
}

export class FcmPushTransport implements PushTransport {
  readonly name = 'fcm' as const;
  private readonly app: App;

  constructor(serviceAccountJson: string) {
    const existing = getApps().find((a) => a.name === APP_NAME);
    this.app = existing ?? initializeApp({ credential: cert(JSON.parse(serviceAccountJson) as ServiceAccount) }, APP_NAME);
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    const out: PushResult[] = [];
    for (let i = 0; i < tokens.length; i += FCM_MULTICAST_MAX) {
      const chunk = tokens.slice(i, i + FCM_MULTICAST_MAX);
      try {
        const res = await getMessaging(this.app).sendEachForMulticast({
          tokens: chunk,
          data: message.data,
          android: { priority: message.priority, collapseKey: message.collapseKey },
        });
        res.responses.forEach((r, j) => {
          const token = chunk[j]!;
          out.push(r.success ? { token, ok: true } : { token, ok: false, error: mapFcmError(r.error?.code) });
        });
      } catch (err) {
        // The whole call failed (network, auth): every token in the chunk is retried later.
        const code = mapFcmError((err as { code?: string } | null)?.code);
        for (const token of chunk) out.push({ token, ok: false, error: code === 'UNKNOWN' ? 'UNAVAILABLE' : code });
      }
    }
    return out;
  }
}
