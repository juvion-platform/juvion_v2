import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../middleware/errorHandler';

export type MobileErrorCode =
  | 'VALIDATION_FAILED' | 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'SESSION_INVALIDATED'
  | 'ACCOUNT_DEACTIVATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'GONE' | 'UPDATE_REQUIRED'
  | 'COOLDOWN' | 'INSTITUTION_PAUSED' | 'INTERNAL';

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
  400: 'VALIDATION_FAILED', 401: 'INVALID_CREDENTIALS', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 410: 'GONE', 429: 'COOLDOWN',
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
