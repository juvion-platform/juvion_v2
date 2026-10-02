/**
 * The push transport (notifications spec §5.3, §5.1). The sender talks only to
 * this interface; `fcm.ts` is the one file that imports firebase-admin.
 */
export type PushPriority = 'high' | 'normal';

/** An FCM data-only message: every value is a string (spec §6.6). */
export interface PushMessage {
  data: Record<string, string>;
  priority: PushPriority;
  collapseKey: string;
}

/** FCM's error codes, normalised. UNKNOWN is treated as transient. */
export type PushErrorCode = 'UNREGISTERED' | 'INVALID_ARGUMENT' | 'UNAVAILABLE' | 'INTERNAL' | 'QUOTA_EXCEEDED' | 'UNKNOWN';

export interface PushResult { token: string; ok: boolean; error?: PushErrorCode }

export interface PushTransport {
  readonly name: 'fcm' | 'fake';
  /** One result per token, in order. Never throws for a per-token failure. */
  send(tokens: string[], message: PushMessage): Promise<PushResult[]>;
}

/** A token rejected with one of these is dead: its session's `pushToken` is cleared (spec §5.3). */
export const TOKEN_ERRORS: ReadonlySet<PushErrorCode> = new Set<PushErrorCode>(['UNREGISTERED', 'INVALID_ARGUMENT']);
