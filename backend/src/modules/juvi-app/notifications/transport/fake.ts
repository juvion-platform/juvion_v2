import { PushErrorCode, PushMessage, PushResult, PushTransport } from './types';

/**
 * The transport used when FIREBASE_SERVICE_ACCOUNT_JSON is unset (spec §10) and in
 * tests. It records every message and can be told to fail particular tokens. Its
 * log line carries the kind, ids and priority only, never the title.
 */
export class FakePushTransport implements PushTransport {
  readonly name = 'fake' as const;
  readonly sent: { tokens: string[]; message: PushMessage }[] = [];
  private readonly failures = new Map<string, PushErrorCode>();

  constructor(private readonly log = false) {}

  /** Every later send to `token` fails with `code`. */
  failToken(token: string, code: PushErrorCode): void { this.failures.set(token, code); }

  reset(): void {
    this.sent.length = 0;
    this.failures.clear();
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    this.sent.push({ tokens: [...tokens], message });
    if (this.log) console.log(`[juvi-push:fake] ${tokens.length} device(s): ${message.data.kind ?? 'notice'} ${message.data.noticeId ?? ''} (${message.priority})`);
    return tokens.map((token) => {
      const error = this.failures.get(token);
      return error ? { token, ok: false, error } : { token, ok: true };
    });
  }
}
