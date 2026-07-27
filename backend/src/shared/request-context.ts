import { AsyncLocalStorage } from 'node:async_hooks';
import { NextFunction, Request, Response } from 'express';

/**
 * Request-scoped context for cross-cutting list concerns.
 *
 * Why AsyncLocalStorage rather than threading a parameter: the `?search=`
 * term has to reach `paginate()`, which sits four layers below the route
 * (route → controller → service → paginate) and is called from 216 places
 * with eight different service signatures. Threading it would mean editing
 * every controller AND every service for a concern none of them care about.
 * ALS gives all list endpoints uniform search with one middleware.
 *
 * Only additive, request-scoped, read-only hints belong here — never
 * `collegeId` or anything security-relevant. Tenancy stays an explicit
 * parameter so it can never be silently inherited from an ambient context.
 */
export interface ListRequestContext {
  search?: string;
}

const storage = new AsyncLocalStorage<ListRequestContext>();

/** Reads the current request's list hints; `{}` outside a request (jobs, tests). */
export function getListContext(): ListRequestContext {
  return storage.getStore() ?? {};
}

/** Runs `fn` with an explicit context — used by workers and unit tests. */
export function runWithListContext<T>(ctx: ListRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

const MAX_SEARCH_LEN = 128;

export function listContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.query.search ?? req.query.q;
  const search = typeof raw === 'string' ? raw.trim().slice(0, MAX_SEARCH_LEN) : '';
  storage.run({ search: search || undefined }, () => next());
}
