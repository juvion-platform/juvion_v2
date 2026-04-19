import type { SearchResult } from '../../services/search';

/**
 * Map a search result to the portal URL that shows it in context.
 *
 * Since per-person detail pages don't exist for every role (students and
 * faculty have edit forms; parents and alumni only have list views), we
 * navigate to the role's list page and pass `?highlight=<personId>` so the
 * list can scroll-to / visually mark that row when it implements support.
 * Until the list pages consume `highlight`, the user still lands on the
 * correct page for that role — graceful degradation.
 */
export function routeForResult(result: SearchResult): string {
  const qs = `?highlight=${encodeURIComponent(result.personId)}`;
  switch (result.role) {
    case 'student': return `/people/students${qs}`;
    case 'faculty': return `/people/faculty${qs}`;
    case 'staff':   return `/people/staff${qs}`;
    case 'parent':  return `/people/parents${qs}`;
    case 'alumni':  return `/placement/alumni-profiles${qs}`;
    default:
      // Exhaustiveness fallthrough. If a new PersonRole is added, the
      // switch's case exhaustion is enforced elsewhere via `type PersonRole`
      // in services/search.ts — this branch is a safety net at runtime.
      return `/people${qs}`;
  }
}
