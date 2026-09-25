import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, KeyRound, UserX } from 'lucide-react';
import { listAccounts, deactivateAccount, resetAccountPassword, revealAccountCredential, type AccountKind, type AccountStatus } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { confirmAction } from '../../../stores/confirmStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';

export default function AccountsTable() {
  const qc = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('platform', 'update'));
  const canReveal = useAuthStore((s) => s.hasPermission('platform', 'create'));
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<AccountKind | ''>('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [revealed, setRevealed] = useState<Record<string, { password: string; expiresAt: string }>>({});

  // A revealed password is only valid until the next reset/deactivation, and must not
  // follow the admin onto another page or filter of the table.
  const forget = (id: string) => setRevealed((r) => { const { [id]: _gone, ...rest } = r; return rest; });
  useEffect(() => { setRevealed({}); }, [page, q, kind, status]);

  const query = { q, kind: kind || undefined, status: status || undefined, page, limit: 20 };
  const accounts = useQuery({ queryKey: ['juvi-accounts', query], queryFn: () => listAccounts(query) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['juvi-accounts'] });

  // The global MutationCache in main.tsx would otherwise toast each of these
  // mutations a second time on top of the messages wired up below.
  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateAccount(id),
    meta: { silent: true, silentError: true },
    onSuccess: (_res, id) => { forget(id); toast.success('Account deactivated'); refresh(); },
    onError: () => toast.error('Could not deactivate'),
  });
  const reset = useMutation({
    mutationFn: (id: string) => resetAccountPassword(id),
    meta: { silent: true, silentError: true },
    onSuccess: (_res, id) => { forget(id); toast.success('Temporary password issued. Reveal it to share.'); refresh(); },
    onError: () => toast.error('Could not reset the password'),
  });
  const reveal = useMutation({
    mutationFn: (id: string) => revealAccountCredential(id),
    meta: { silent: true, silentError: true },
    onSuccess: (c, id) => setRevealed((r) => ({ ...r, [id]: { password: c.password, expiresAt: c.expiresAt } })),
    onError: () => toast.error('No live credential. Reset the password first.'),
  });

  const onDeactivate = async (id: string, name: string) => {
    const { confirmed } = await confirmAction({ title: `Deactivate ${name}?`, message: 'They are signed out everywhere and can no longer open Juvi. Their posts stay attributed to them.', confirmLabel: 'Deactivate', tone: 'danger' });
    if (confirmed) deactivate.mutate(id);
  };
  const onReset = async (id: string, name: string) => {
    const { confirmed } = await confirmAction({ title: `Reset password for ${name}?`, message: 'A new temporary password is issued, they must change it at next sign-in, and every device is signed out.', confirmLabel: 'Reset', tone: 'primary' });
    if (confirmed) reset.mutate(id);
  };

  return (
    <div className="space-y-3">
      <form role="search" className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(draft.trim()); }}>
        <input aria-label="Search accounts" maxLength={80} className={`${inp} sm:col-span-2`} placeholder="Name, roll number or employee code" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <select aria-label="Kind" className={inp} value={kind} onChange={(e) => { setKind(e.target.value as AccountKind | ''); setPage(1); }}>
          <option value="">All kinds</option><option value="student">Students</option><option value="faculty">Faculty</option><option value="staff">Staff</option>
        </select>
        <select aria-label="Status" className={inp} value={status} onChange={(e) => { setStatus(e.target.value as AccountStatus | ''); setPage(1); }}>
          <option value="">All statuses</option><option value="onboarding">Onboarding</option><option value="active">Active</option><option value="deactivated">Deactivated</option>
        </select>
      </form>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Identifier</th><th className="px-4 py-2">Kind</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Last seen</th><th className="px-4 py-2">Credential</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {accounts.data?.items.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="px-4 py-2">{a.name}<div className="text-xs text-gray-500">{a.email}</div></td>
                <td className="px-4 py-2 font-mono text-xs">{a.identifier}</td>
                <td className="px-4 py-2 capitalize">{a.kind}</td>
                <td className="px-4 py-2 capitalize">{a.status}{a.onboardingComplete ? '' : <span className="text-xs text-gray-500"> · not onboarded</span>}</td>
                <td className="px-4 py-2 whitespace-nowrap">{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString('en-IN') : 'Never opened'}</td>
                <td className="px-4 py-2">
                  {revealed[a.id] ? (
                    <div><code className="text-sm">{revealed[a.id]!.password}</code><div className="text-xs text-gray-500">until {new Date(revealed[a.id]!.expiresAt).toLocaleDateString('en-IN')}</div></div>
                  ) : a.hasLiveCredential ? (
                    <button type="button" disabled={!canReveal} onClick={() => reveal.mutate(a.id)} aria-label={`Reveal credential for ${a.name}`}
                      className="inline-flex items-center gap-1 text-primary-700 hover:underline disabled:opacity-50"><Eye size={14} /> Reveal</button>
                  ) : <span className="text-xs text-gray-500">None live</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {a.status !== 'deactivated' && (
                    <>
                      <button type="button" disabled={!canUpdate} onClick={() => onReset(a.id, a.name)} aria-label={`Reset password for ${a.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 rounded border mr-1 disabled:opacity-50"><KeyRound size={12} /> Reset</button>
                      <button type="button" disabled={!canUpdate} onClick={() => onDeactivate(a.id, a.name)} aria-label={`Deactivate ${a.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50"><UserX size={12} /> Deactivate</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {accounts.data && accounts.data.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No accounts match. Run provisioning to create some.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {accounts.data && accounts.data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border rounded disabled:opacity-50">Previous</button>
          <span>Page {accounts.data.page} of {accounts.data.pages}</span>
          <button type="button" disabled={page >= accounts.data.pages} onClick={() => setPage(page + 1)} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
