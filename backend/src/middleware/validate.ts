import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export type ValidationSource = 'body' | 'query';

/**
 * Zod-backed request validator.
 *
 * Defaults to validating `req.body` (preserves behavior of all existing
 * callers). Pass `source: 'query'` to validate the query string instead,
 * which is useful for GET endpoints like search.
 *
 * When validating query params, the parsed (coerced) result is assigned
 * to a new `req.validatedQuery` property rather than mutating `req.query`
 * directly — Express 5 treats `req.query` as a read-only getter.
 */
export function validate(schema: ZodSchema, source: ValidationSource = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (source === 'query') {
        const parsed = schema.parse(req.query);
        (req as unknown as { validatedQuery: unknown }).validatedQuery = parsed;
      } else {
        req.body = schema.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      next(err);
    }
  };
}
