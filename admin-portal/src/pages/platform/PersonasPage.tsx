import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, IdCard } from 'lucide-react';
import {
  listPersonas, createPersona, updatePersona, deletePersona,
  Persona, PersonaInput, PERSONA_MODULES, PERSONA_ROLES,
} from '../../services/personas';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';
import { DASHBOARD_WIDGETS } from '../../dashboard/registry';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const errText = (e: unknown) => (e as any)?.response?.data?.error || 'Request failed';

interface Form { code: string; label: string; description: string; parentCode: string; primaryModule: string; defaultRole: string; tier: 1 | 2 | 3; dashboardWidgets: string[]; isActive: boolean }
const EMPTY: Form = { code: '', label: '', description: '', parentCode: '', primaryModule: 'academics', defaultRole: 'staff', tier: 3, dashboardWidgets: [], isActive: true };

/** 010 — college-editable persona catalog. System rows are the read-only template. */
export default function PersonasPage() {
  const qc = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data, isLoading } = useQuery({ queryKey: ['personas', includeInactive], queryFn: () => listPersonas(includeInactive) });
  const rows = data ?? [];

  const vem = useViewEditMode<Persona>({
    onOpenEntity: (p) => setForm({ code: p.code, label: p.label, description: p.description || '', parentCode: p.parentCode || '', primaryModule: p.primaryModule, defaultRole: p.defaultRole, tier: p.tier, dashboardWidgets: p.dashboardWidgets ?? [], isActive: p.isActive }),
    onOpenCreate: () => setForm(EMPTY),
    onClose: () => setForm(EMPTY),
  });

  const done = () => { qc.invalidateQueries({ queryKey: ['personas'] }); vem.close(); };
  const createMut = useMutation({ mutationFn: createPersona, onSuccess: done, onError: (e) => toast.error('Could not create persona', errText(e)) });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: Partial<PersonaInput> }) => updatePersona(id, d), onSuccess: done, onError: (e) => toast.error('Could not update persona', errText(e)) });
  const deleteMut = useMutation({ mutationFn: deletePersona, onSuccess: () => qc.invalidateQueries({ queryKey: ['personas'] }), onError: (e) => toast.error('Could not delete persona', errText(e)) });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const d: PersonaInput = { code: form.code, label: form.label, description: form.description || undefined, parentCode: form.parentCode || null, primaryModule: form.primaryModule, defaultRole: form.defaultRole, tier: form.tier, dashboardWidgets: form.dashboardWidgets, isActive: form.isActive };
    if (vem.isEdit && vem.entity) { const { code: _c, ...rest } = d; updateMut.mutate({ id: vem.entity._id, d: rest }); }
    else createMut.mutate(d);
  }
  const saving = createMut.isPending || updateMut.isPending;
  const isSystem = (p: Persona) => !p.collegeId;

  const columns = [
    { key: 'code', label: 'Code', render: (p: Persona) => <span className="font-mono text-sm font-medium text-navy">{p.code}</span> },
    { key: 'label', label: 'Label', render: (p: Persona) => p.label },
    { key: 'parentCode', label: 'Parent', render: (p: Persona) => p.parentCode || <span className="text-gray-400">&mdash;</span> },
    { key: 'primaryModule', label: 'Home module', render: (p: Persona) => <Badge variant="info">{p.primaryModule}</Badge> },
    { key: 'defaultRole', label: 'Default role', render: (p: Persona) => p.defaultRole },
    { key: 'tier', label: 'Tier', render: (p: Persona) => `L${p.tier}` },
    { key: 'status', label: 'Status', render: (p: Persona) => <Badge variant={p.isActive ? 'success' : 'default'}>{p.isActive ? 'active' : 'inactive'}</Badge> },
    { key: 'type', label: 'Type', render: (p: Persona) => (isSystem(p) ? <Badge variant="default">System</Badge> : <Badge variant="purple">College</Badge>) },
    {
      key: 'actions', label: '', render: (p: Persona) => isSystem(p) ? null : (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(p); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
          <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: `Delete persona ${p.code}?`, tone: 'danger', confirmLabel: 'Delete' }).then((c) => { if (c.confirmed) deleteMut.mutate(p._id); }); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex p-2 rounded-lg bg-indigo-50 text-indigo-600"><IdCard size={22} /></div>
          <h2 className="text-xl font-bold text-navy">Personas</h2>
        </div>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New Persona</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Show inactive
      </label>

      <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(p: Persona) => p._id} onRowClick={vem.openForView} />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Persona')} widthClass="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Code *</label>
              <input required disabled={vem.isEdit || vem.isView} pattern="[A-Za-z0-9-]{2,40}" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ST-ACC-JR" className={inp} />
            </div>
            <div>
              <label className={lbl}>Label *</label>
              <input required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Parent persona</label>
              <select value={form.parentCode} onChange={(e) => setForm((f) => ({ ...f, parentCode: e.target.value }))} className={inp}>
                <option value="">None (root)</option>
                {rows.filter((p) => p.isActive && p.code !== form.code).map((p) => <option key={p.code} value={p.code}>{p.code} — {p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Tier</label>
              <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: +e.target.value as 1 | 2 | 3 }))} className={inp}>
                <option value={1}>L1 family</option><option value={2}>L2 operational</option><option value={3}>L3 sub-persona</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Home module *</label>
              <select required value={form.primaryModule} onChange={(e) => setForm((f) => ({ ...f, primaryModule: e.target.value }))} className={inp}>
                {PERSONA_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Default role *</label>
              <select required value={form.defaultRole} onChange={(e) => setForm((f) => ({ ...f, defaultRole: e.target.value }))} className={inp}>
                {PERSONA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <span className={lbl}>Dashboard widgets</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                {DASHBOARD_WIDGETS.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.dashboardWidgets.includes(w.id)}
                      onChange={(e) => setForm((f) => ({ ...f, dashboardWidgets: e.target.checked ? [...f.dashboardWidgets, w.id] : f.dashboardWidgets.filter((x) => x !== w.id) }))} />
                    {w.title}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty to show every widget the persona may read, home module first. Ticked widgets are shown in this order only (still filtered by permission).</p>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="persona-active" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="persona-active" className="text-sm text-gray-700">Active</label>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">{vem.isView ? 'Close' : 'Cancel'}</button>
            {vem.isView ? (
              vem.entity && !isSystem(vem.entity) && <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Pencil size={14} /> Edit</button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
