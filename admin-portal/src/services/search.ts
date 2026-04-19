import api from './api';

/**
 * Global people search — frontend axios client.
 *
 * Backend endpoint: GET /api/people/search
 * See backend/src/modules/people/search-service.ts for the authoritative
 * response shape and RBAC scoping rules.
 */

// ── Types (mirror the backend contract) ────────────────────

export type PersonRole = 'student' | 'faculty' | 'staff' | 'parent' | 'alumni';

/**
 * A single search-result row. Intentionally narrow — the backend does NOT
 * return phone, email, DOB, aadhaar, or address in the search payload, even
 * for admin users. If you need those fields, navigate to the detail page.
 */
export interface SearchResult {
  _id: string;
  role: PersonRole;
  personId: string;
  name: string;
  photo?: string;
  /** The raw identifier value (roll number, employee code, or student name for a parent row). */
  identifier?: string;
  /** Human-readable label for the identifier field (e.g. "Roll #", "Emp Code", "Parent of"). */
  identifierLabel: string;
  /** Resolved department/programme name — null for parents. */
  department?: string;
  /** active | inactive | graduated | separated | etc. — role-dependent. */
  status?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  counts: Record<PersonRole, number>;
  totalMatched: number;
  hasMore: boolean;
}

export interface SearchParams {
  q: string;
  /** Max rows returned (1..25, default 10). */
  limit?: number;
  /**
   * If true, include separated / graduated / inactive people.
   * Server silently downgrades to false for non-admin/principal/super_admin.
   */
  includeInactive?: boolean;
  /** React Query passes one via queryFn; enables request cancellation. */
  signal?: AbortSignal;
}

/**
 * A 429 rate-limit error the UI can recognize and back off on. The axios
 * error still throws — this is a marker the caller can type-check via
 * `isRateLimitError(err)`.
 */
export interface RateLimitError extends Error {
  isRateLimited: true;
  retryAfter: number;
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { isRateLimited?: unknown }).isRateLimited === true
  );
}

// ── API ────────────────────────────────────────────────────

const BASE = '/people';

/**
 * Search for people across all roles (students, faculty, staff, parents, alumni).
 *
 * @throws {RateLimitError} when the server returns 429 (per-user rate limit hit)
 * @throws {AxiosError} for any other HTTP error
 */
export async function searchPeople(params: SearchParams): Promise<SearchResponse> {
  const { q, limit, includeInactive, signal } = params;

  try {
    const res = await api.get<SearchResponse>(`${BASE}/search`, {
      params: { q, limit, includeInactive },
      signal,
    });
    return res.data;
  } catch (err) {
    // Decorate 429 so callers can back off without matching on axios internals.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any)?.response?.status;
    if (status === 429) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retryAfter = Number((err as any)?.response?.data?.retryAfter ?? 60);
      const rateErr = new Error('Search rate limit exceeded') as RateLimitError;
      rateErr.isRateLimited = true;
      rateErr.retryAfter = Number.isFinite(retryAfter) ? retryAfter : 60;
      throw rateErr;
    }
    throw err;
  }
}
