import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, KeyRound, Users as UsersIcon, HelpCircle } from 'lucide-react';
import subDomains from '../../config/sub-domains.json';
import { listUsers, createUser, updateUser, resetUserPassword, explainUserAccess, PlatformUser, UserInput, ExplainResult } from '../../services/users';
import { listPersonas, Persona, PERSONA_ROLES } from '../../services/personas';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { useListControls } from '../../hooks/useListControls';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const MODULES = Object.keys(subDomains);
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve'];
const errText = (e: unknown) => (e as any)?.response?.data?.error || 'Request failed';

interface Form { email: string; password: string; name: string; personas: string[]; personId: string; personName: string; isActive: boolean }
const EMPTY: Form = { email: '', password: '', name: '', personas: [], personId: '', personName: '', isActive: true };

/** 010 — provision college logins; role is derived from personas server-side. */
export default function UsersPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit } = useListControls();
  const [filterRole, setFilterRole] = useState('');
  const [filterPersona, setFilterPersona] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [personSearch, setPersonSearch] = useState('');
  const [explain, setExplain] = useState<{ module: string; action: string; result?: ExplainResult }>({ module: 'people', action: 'read' });

  const { data, isLoading } = useQuery({ queryKey: ['platform-users', page, limit, filterRole, filterPersona, includeInactive], queryFn: () => listUsers(page, limit, { role: filterRole, persona: filterPersona, includeInactive }) });
  const { data: personas = [] } = useQuery({ queryKey: ['personas', false], queryFn: () => listPersonas(false) });
  const { data: personHits } = useQuery({ queryKey: ['person-search', personSearch], queryFn: () => listPersons(1, 8, personSearch), enabled: personSearch.length >= 2 });

  const vem = useViewEditMode<PlatformUser>({
    onOpenEntity: (u) => { setForm({ email: u.email, password: '', name: u.name, personas: u.personas, personId: u.personId?._id || '', personName: u.personId?.name || '', isActive: u.isActive }); setExplain({ module: 'people', action: 'read' }); },
    onOpenCreate: () => setForm(EMPTY),
    onClose: () => { setForm(EMPTY); setPersonSearch(''); },
  });

  const done = () => { qc.invalidateQueries({ queryKey: ['platform-users'] }); vem.close(); };
  const createMut = useMutation({ mutationFn: createUser, onSuccess: done, onError: (e) => toast.error('Could not create user', errText(e)) });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: Partial<UserInput> }) => updateUser(id, d), onSuccess: done, onError: (e) => toast.error('Could not update user', errText(e)) });
  const resetMut = useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password), onSuccess: () => toast.success('Password reset'), onError: (e) => toast.error('Could not reset password', errText(e)) });
  const explainMut = useMutation({ mutationFn: ({ id, module, action }: { id: string; module: string; action: string }) => explainUserAccess(id, module, action), onSuccess: (result) => setExplain((x) => ({ ...x, result })), onError: (e) => toast.error('Could not explain access', errText(e)) });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const d: UserInput = { email: form.email, name: form.name, personas: form.personas, personId: form.personId || null, isActive: form.isActive };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, d });
    else createMut.mutate({ ...d, password: form.password });
  }
  const togglePersona = (code: string) => setForm((f) => ({ ...f, personas: f.personas.includes(code) ? f.personas.filter((c) => c !== code) : [...f.personas, code] }));
  const saving = createMut.isPending || updateMut.isPending;

  async function resetPassword(u: PlatformUser) {
    const c = await confirmAction({ title: `Reset password for ${u.email}?`, requireReason: true, reasonLabel: 'New password (min 8 characters)', confirmLabel: 'Reset' });
    if (!c.confirmed) return;
    const password = c.reason;
    if (!password || password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    resetMut.mutate({ id: u._id, password });
  }

  const columns = [
    { key: 'name', label: 'Name', render: (u: PlatformUser) => <span className="font-medium text-navy">{u.name}</span> },
    { key: 'email', label: 'Email', render: (u: PlatformUser) => u.email },
    { key: 'personas', label: 'Personas', render: (u: PlatformUser) => <div className="flex gap-1 flex-wrap">{u.personas.map((p) => <Badge key={p} variant={p === u.personaType ? 'purple' : 'default'}>{p}</Badge>)}</div> },
    { key: 'role', label: 'Role', render: (u: PlatformUser) => u.role },
    { key: 'person', label: 'Linked person', render: (u: PlatformUser) => u.personId?.name || <span className="text-gray-400">&mdash;</span> },
    { key: 'status', label: 'Status', render: (u: PlatformUser) => <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'active' : 'inactive'}</Badge> },
    {
      key: 'actions', label: '', render: (u: PlatformUser) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(u); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
          <button onClick={(e) => { e.stopPropagation(); void resetPassword(u); }} className="p-1 rounded hover:bg-blue-50" title="Reset password"><KeyRound size={15} className="text-blue-500" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex p-2 rounded-lg bg-blue-50 text-blue-600"><UsersIcon size={22} /></div>
          <h2 className="text-xl font-bold text-navy">Users</h2>
        </div>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New User</button>
      </div>

      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All roles</option>
          {PERSONA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterPersona} onChange={(e) => { setFilterPersona(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All personas</option>
          {personas.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={includeInactive} onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1); }} /> Show inactive</label>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(u: PlatformUser) => u._id} onRowClick={vem.openForView} />
      <Pagination page={page} pages={data?.pages ?? 1} total={data?.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('User')} widthClass="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Email *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inp} />
            </div>
            {!vem.isEdit && !vem.isView && (
              <div>
                <label className={lbl}>Password *</label>
                <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inp} />
              </div>
            )}
            <div>
              <label className={lbl}>Role</label>
              <input disabled value={vem.entity?.role || 'derived from personas'} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Personas * <span className="font-normal text-gray-400">(first checked is the primary)</span></label>
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {personas.map((p: Persona) => (
                  <label key={p.code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.personas.includes(p.code)} onChange={() => togglePersona(p.code)} />
                    <span className="font-mono text-xs">{p.code}</span><span className="text-gray-600 truncate">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Linked person</label>
              <div className="flex gap-2 items-center">
                <input value={form.personName} readOnly placeholder="None" className={inp} />
                {form.personId && !vem.isView && <button type="button" onClick={() => setForm((f) => ({ ...f, personId: '', personName: '' }))} className="text-xs text-red-600">Unlink</button>}
              </div>
              {!vem.isView && (
                <div className="relative mt-2">
                  <input value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Search people by name / phone…" className={inp} />
                  {personSearch.length >= 2 && personHits?.items?.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow max-h-40 overflow-y-auto text-sm">
                      {personHits.items.map((p: any) => (
                        <li key={p._id}><button type="button" onClick={() => { setForm((f) => ({ ...f, personId: p._id, personName: p.name })); setPersonSearch(''); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50">{p.name} <span className="text-gray-400">{p.phone || p.email || ''}</span></button></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="user-active" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="user-active" className="text-sm text-gray-700">Active</label>
            </div>
          </fieldset>

          {vem.entity && (
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><HelpCircle size={14} /> Explain access</div>
              <div className="flex gap-2 items-center">
                <select value={explain.module} onChange={(e) => setExplain({ module: e.target.value, action: explain.action })} className={inp}>{MODULES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                <select value={explain.action} onChange={(e) => setExplain({ module: explain.module, action: e.target.value })} className={inp}>{ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                <button type="button" disabled={explainMut.isPending} onClick={() => explainMut.mutate({ id: vem.entity!._id, module: explain.module, action: explain.action })} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 whitespace-nowrap">Check</button>
              </div>
              {explain.result && (
                <div className="mt-3 text-sm space-y-1">
                  <div>Verdict: <Badge variant={explain.result.verdict === 'allow' ? 'success' : 'danger'}>{explain.result.verdict}</Badge></div>
                  {explain.result.perPersona.map((p) => (
                    <div key={p.persona} className="flex gap-2"><span className="font-mono text-xs">{p.persona}</span><span className="text-gray-600">{p.winner ? `${p.winner.effect} — ${p.winner.description || `${p.winner.module}:${p.winner.action}`}` : 'no matching policy'}</span></div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">{vem.isView ? 'Close' : 'Cancel'}</button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Pencil size={14} /> Edit</button>
            ) : (
              <button type="submit" disabled={saving || form.personas.length === 0} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
