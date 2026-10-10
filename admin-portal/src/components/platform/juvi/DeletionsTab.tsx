import { useQuery } from '@tanstack/react-query';
import { listPendingDeletions } from '../../../services/juvi-app';

const DAY_MS = 86_400_000;

/**
 * An age in days and whether it has outlived the grace period — the whole detection rule
 * (011 Story 4 AC5). `now` is a parameter so the deadline boundary can be pinned exactly.
 *
 * The boundary is `>=`, matching the sweep: it deletes when
 * `deletionRequestedAt <= now - graceDays` (`deletion-sweep-worker.ts:41`), which is the same
 * statement as `age >= graceDays`. Off by a millisecond here and this table tells an operator
 * the sweep is healthy while a request sits past its deadline, or the reverse.
 */
export function deletionAge(requestedAt: string, graceDays: number, now: number = Date.now()): { days: number; overdue: boolean } {
  const ms = now - Date.parse(requestedAt);
  return { days: Math.floor(ms / DAY_MS), overdue: ms >= graceDays * DAY_MS };
}

/**
 * 011 Story 4 AC5 — the detection control for the sweep's operational dependency.
 *
 * Age is the rule, not the claim: a request claimed by an executor that then died carries a
 * non-null `claimedAt` while still being stalled, so keying on "not yet claimed" would show this
 * list as healthy exactly when it is not. `claimedAt` is displayed for that reason and nothing
 * more.
 */
export default function DeletionsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['juvi-pending-deletions'],
    queryFn: listPendingDeletions,
    refetchInterval: 60_000,
  });

  const now = Date.now();
  const rows = data ? data.items.map((r) => ({ ...r, ...deletionAge(r.requestedAt, data.graceDays, now) })) : [];
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-navy">Pending deletions</h3>
        <p className="text-sm text-gray-500 mt-1">
          {data
            ? `A deletion runs automatically ${data.graceDays} days after the request. Anything older than that below has outlived the sweep — that is the signal that it has stopped.`
            : 'A deletion runs a fixed number of days after the request; anything older than that has outlived the sweep.'}
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {isError && <p className="text-sm text-red-700">Could not load pending deletions.</p>}

      {data && rows.length === 0 && (
        <div className="bg-white border rounded-xl px-4 py-8 text-center text-sm text-gray-500">
          No deletions are pending. An account appears here as soon as someone asks for its deletion, and stays until the scheduled sweep removes it.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <p className="text-sm text-gray-500">
            {overdue > 0
              ? `${overdue} of ${rows.length} past the grace period — the sweep has not run.`
              : `${rows.length} within the grace period. Nothing has been overdue yet.`}
          </p>
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Requested</th>
                  <th className="px-4 py-2">Age</th>
                  <th className="px-4 py-2">Requested via</th>
                  <th className="px-4 py-2">Sweep claim</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(r.requestedAt).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">{r.days === 1 ? '1 day' : `${r.days} days`}</td>
                    <td className="px-4 py-2">{r.requestedVia === 'public_web' ? 'Public web form' : 'In the app'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.claimedAt ? new Date(r.claimedAt).toLocaleString('en-IN') : <span className="text-gray-500">Never claimed</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.overdue ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Past grace</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Within grace</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">
            This list carries no names, roll numbers or emails — account ids and timestamps only.
          </p>
        </>
      )}
    </div>
  );
}
