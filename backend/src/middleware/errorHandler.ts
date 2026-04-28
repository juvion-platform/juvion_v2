import { Request, Response, NextFunction } from 'express';

/**
 * Structured application error.
 *
 * `detail` is an OPTIONAL machine-readable payload that the error handler
 * surfaces in the response body. Use it when callers need structured info
 * to render UX (e.g. a 429 budget block carries `{ spent, limit, resetsAt }`
 * so the frontend banner can show "₹X of ₹Y used; resets in 3 days").
 *
 * The shape is `unknown` on purpose — the contract is per-error-site, not
 * per-class. Document the shape in the throw site's nearest comment.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: { error: string; detail?: unknown } = { error: err.message };
    if (err.detail !== undefined) body.detail = err.detail;
    return res.status(err.statusCode).json(body);
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
