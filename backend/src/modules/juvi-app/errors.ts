import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../middleware/errorHandler';

export type MobileErrorCode =
  | 'VALIDATION_FAILED' | 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'SESSION_INVALIDATED'
  | 'ACCOUNT_DEACTIVATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'GONE' | 'UPDATE_REQUIRED'
  | 'COOLDOWN' | 'INSTITUTION_PAUSED' | 'INTERNAL'
  // Juvi notices (notices spec §7.1)
  | 'NOTICE_NOT_FOUND' | 'ALREADY_ACKNOWLEDGED' | 'NOTICE_ARCHIVED' | 'NOT_PUBLISHER'
  | 'REMINDER_LIMIT' | 'ACK_REQUIRED' | 'ACK_NOT_REQUIRED'
  // Juvi notifications (notifications spec §7.2): every receipt in the request failed verification
  | 'RECEIPT_INVALID'
  // Juvi account deletion (011): a pending public deletion request is past the point of cancellation
  | 'DELETION_NOT_CANCELLABLE';

/**
 * Mobile-facing error. `detail` keys are spread into the envelope next to
 * `code` and `message` (e.g. retryAfterSeconds, reason, minVersion).
 */
export class MobileApiError extends AppError {
  constructor(
    statusCode: number,
    public code: MobileErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(statusCode, message, detail);
    this.name = 'MobileApiError';
  }
}

export function notFound(what: string): MobileApiError {
  return new MobileApiError(404, 'NOT_FOUND', `${what} not found`);
}

const STATUS_TO_CODE: Record<number, MobileErrorCode> = {
  400: 'VALIDATION_FAILED', 401: 'INVALID_CREDENTIALS', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'DELETION_NOT_CANCELLABLE', 410: 'GONE', 429: 'COOLDOWN',
};

export function mobileErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof MobileApiError) {
    const detail = (err.detail && typeof err.detail === 'object') ? (err.detail as Record<string, unknown>) : {};
    // `detail` goes first so a detail key can never override the envelope's code or message.
    res.status(err.statusCode).json({ error: { ...detail, code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    // Paths only — never echo submitted values.
    const fields = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Some fields are invalid.', fields } });
    return;
  }
  if (err instanceof AppError) {
    const code = STATUS_TO_CODE[err.statusCode] ?? 'INTERNAL';
    res.status(err.statusCode).json({ error: { code, message: err.message } });
    return;
  }
  console.error('[juvi-app] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}
