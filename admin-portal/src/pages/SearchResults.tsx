import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search as SearchIcon, Loader2, AlertCircle } from 'lucide-react';
import {
  searchPeople,
  type PersonRole,
  type SearchResponse,
  type SearchResult,
} from '../services/search';
import SearchResultRow from '../components/search/SearchResultRow';
import { routeForResult } from '../components/search/navigateToResult';
import { useAuthStore } from '../stores/authStore';

/**
 * /search page — the "See all N results" destination.
 *
 * Reads ?q=<string> and ?includeInactive=true from the URL. Calls the same
 * backend endpoint as the Cmd+K overlay but with a higher per-role limit
 * so the user sees the full spread.
 */

const PRIVILEGED_ROLES = new Set(['admin', 'principal', 'super_admin']);
const ROLE_ORDER: PersonRole[] = ['student', 'faculty', 'staff', 'parent', 'alumni'];
const ROLE_TITLES: Record<PersonRole, string> = {
  student: 'Students', faculty: 'Faculty', staff: 'Staff',
  parent: 'Parents', alumni: 'Alumni',
};

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role ?? '');
  const canIncludeInactive = PRIVILEGED_ROLES.has(userRole);

  const q = (params.get('q') ?? '').trim();
  const includeInactive = params.get('includeInactive') === 'true';

  const { data, isLoading, isFetching, error } = useQuery<SearchResponse>({
    queryKey: ['globalSearch', 'page', q, includeInactive],
    queryFn: ({ signal }) =>
      searchPeople({ q, limit: 25, includeInactive, signal }),
    enabled: q.length >= 2,
  });

  // Group flat results by role so each section has its own count header.
  const groupedByRole = useMemo(() => {
    if (!data) return [] as { role: PersonRole; rows: SearchResult[] }[];
    const byRole = new Map<PersonRole, SearchResult[]>();
    for (const r of data.results) {
      const arr = byRole.get(r.role) ?? [];
      arr.push(r);
      byRole.set(r.role, arr);
    }
    return ROLE_ORDER
      .filter(role => (byRole.get(role)?.length ?? 0) > 0)
      .map(role => ({ role, rows: byRole.get(role)! }));
  }, [data]);

  function toggleIncludeInactive() {
    const next = new URLSearchParams(params);
    if (includeInactive) next.delete('includeInactive');
    else next.set('includeInactive', 'true');
    setParams(next, { replace: true });
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-gray-700">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-400">Search</span>
        {q && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-700">&ldquo;{q}&rdquo;</span>
          </>
        )}
      </nav>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy flex items-center gap-2">
            <SearchIcon className="w-5 h-5 text-gray-400" />
            Search results
          </h1>
          {q.length >= 2 && data && (
            <p className="text-sm text-gray-500 mt-1">
              {data.totalMatched} {data.totalMatched === 1 ? 'match' : 'matches'} for &ldquo;{q}&rdquo;
              {data.hasMore && ' (showing first 25 per category)'}
            </p>
          )}
        </div>

        {canIncludeInactive && q.length >= 2 && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={toggleIncludeInactive}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Include inactive / separated
          </label>
        )}
      </div>

      {/* Body */}
      {q.length < 2 ? (
        <EmptyFrame
          icon={<SearchIcon className="w-8 h-8 text-gray-300" />}
          title="Type a query to start searching"
          subtitle="Enter at least 2 characters in the search bar (or press ⌘K)."
        />
      ) : isLoading ? (
        <EmptyFrame
          icon={<Loader2 className="w-8 h-8 text-gray-400 animate-spin" />}
          title="Searching…"
        />
      ) : error ? (
        <EmptyFrame
          icon={<AlertCircle className="w-8 h-8 text-red-400" />}
          title="Couldn't load search results"
          subtitle="Please try again in a moment."
        />
      ) : groupedByRole.length === 0 ? (
        <EmptyFrame
          icon={<SearchIcon className="w-8 h-8 text-gray-300" />}
          title={`No people match "${q}".`}
          subtitle="Global search covers students, faculty, staff, parents and alumni only. Try a different name, roll number or employee code — or search from the relevant module page for courses, branches and fees."
        />
      ) : (
        <div className="space-y-6">
          {isFetching && (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Updating…
            </div>
          )}
          {groupedByRole.map(({ role, rows }) => (
            <section key={role} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {ROLE_TITLES[role]}
                </h2>
                <span className="text-xs text-gray-500">
                  {data!.counts[role]} {data!.counts[role] === 1 ? 'result' : 'results'}
                </span>
              </header>
              <div>
                {rows.map((r) => (
                  <SearchResultRow
                    key={r._id}
                    result={r}
                    onClick={() => navigate(routeForResult(r))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyFrame({
  icon, title, subtitle,
}: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 py-16 px-4 flex flex-col items-center text-center">
      <div className="mb-3">{icon}</div>
      <div className="text-gray-700 font-medium">{title}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1 max-w-md">{subtitle}</div>}
    </div>
  );
}
