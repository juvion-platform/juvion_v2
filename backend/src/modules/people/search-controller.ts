import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/types';
import { searchPeople } from './search-service';
import type { SearchQuery } from './search-validation';

/**
 * GET /api/people/search — global people search.
 *
 * Middleware chain that wraps this controller:
 *   authenticate
 *   → authorize('people', 'read')
 *   → createUserRateLimit({ max: 60, windowMs: 60_000 })
 *   → validate(searchQuerySchema, 'query')     ← attaches req.validatedQuery
 *   → searchController
 *
 * See plan §2 for response shape contract.
 *
 * Note on includeInactive: only admin / principal / super_admin can
 * actually see inactive records. For everyone else we silently downgrade
 * the flag to false rather than 403 — spec §5.3 AC-15 preserves least
 * surprise for users who don't know the distinction.
 */

interface ReqWithValidatedQuery extends AuthRequest {
  validatedQuery?: SearchQuery;
}

const ROLES_WITH_INACTIVE_ACCESS = new Set(['admin', 'super_admin', 'principal']);

export async function searchPeopleController(
  req: ReqWithValidatedQuery,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.collegeId) {
      res.status(400).json({ error: 'College ID required' });
      return;
    }

    const params = req.validatedQuery;
    if (!params) {
      // Defensive — the validate middleware should have populated this.
      res.status(500).json({ error: 'Search params not validated' });
      return;
    }

    const requestedIncludeInactive = params.includeInactive;
    const role = req.user?.role ?? '';
    const canSeeInactive = ROLES_WITH_INACTIVE_ACCESS.has(role);
    const effectiveIncludeInactive = requestedIncludeInactive && canSeeInactive;

    // If the caller asked for inactive but isn't privileged, log at info
    // level so we can spot misuse without failing the request.
    if (requestedIncludeInactive && !canSeeInactive) {
      console.info(
        `[people-search] user=${req.user?.id ?? 'unknown'} role=${role} requested includeInactive=true; downgraded to false`,
      );
    }

    const response = await searchPeople(req.collegeId, params.q, {
      limit: params.limit,
      includeInactive: effectiveIncludeInactive,
      authScope: req.authScope,
    });

    res.json(response);
  } catch (err) {
    next(err);
  }
}
