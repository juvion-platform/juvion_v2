import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInsights, createInsight, updateInsight, deleteInsight } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import MultiSelect, { type MultiSelectOption } from '../../components/ui/MultiSelect';
import { listPersonas, type PersonaDescriptor } from '../../services/people';
import { MODULE_OPTIONS } from '../../lib/modules';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const TYPES = ['anomaly', 'trend', 'prediction', 'recommendation', 'alert'] as const;
const SEVERITIES = ['info', 'warning', 'critical'] as const;
const STATUSES = ['new', 'seen', 'acted_upon', 'dismissed', 'expired'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm: {
  type: string; module: string; title: string; description: string; severity: string;
  targetPersonas: string[]; isActionable: boolean; actionSuggestion: string; status: string;
} = { type: 'recommendation', module: '', title: '', description: '', severity: 'info', targetPersonas: [], isActionable: false, actionSuggestion: '', status: 'new' };

export default function InsightsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['juvi-insights', page, limit, search], queryFn: () => listInsights(page, limit, undefined, undefined, search) });

  const { data: personas } = useQuery({ queryKey: ['personas', 'catalog'], queryFn: listPersonas });
  const personaOptions: MultiSelectOption[] = (personas?.all ?? []).map((p: PersonaDescriptor) => ({
    value: p.code,
    label: p.label,
    hint: p.code,
  }));

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      type: row.type || 'recommendation',
      module: row.module || '',
      title: row.title || '',
      description: row.description || '',
      severity: row.severity || 'info',
      targetPersonas: row.targetPersonas || [],
      isActionable: row.isActionable ?? false,
      actionSuggestion: row.actionSuggestion || '',
      status: row.status || 'new',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createInsight, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-insights'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInsight(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-insights'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteInsight, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-insights'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    payload.targetPersonas = form.targetPersonas;
    if (!payload.description) delete payload.description;
    if (!payload.actionSuggestion) delete payload.actionSuggestion;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const severityVariant: Record<string, string> = { info: 'info', warning: 'warning', critical: 'danger' };
  const statusVariant: Record<string, string> = { new: 'info', seen: 'default', acted_upon: 'success', dismissed: 'warning', expired: 'default' };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'module', label: 'Module', render: (r: any) => r.module || '—' },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={severityVariant[r.severity] || 'default'}>{r.severity}</Badge> },
    { key: 'isActionable', label: 'Actionable', render: (r: any) => r.isActionable ? 'Yes' : 'No' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'generatedAt', label: 'Generated', render: (r: any) => r.generatedAt ? new Date(r.generatedAt).toLocaleString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this insight?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Insights</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search insights…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Insight
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Insight')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Module *</label>
                {/* Free text here produced insights scoped to modules that
                    don't exist. Constrained to the canonical slugs. */}
                <select required value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className={inp}>
                  <option value="">Select module...</option>
                  {MODULE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Severity</label>
                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inp}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} /></div>
              <div className="col-span-2">
                <label className={lbl}>Target Personas</label>
                {/* Sourced from the live persona catalog (GET /people/personas)
                    so codes always match backend/src/shared/rbac/personas.ts.
                    Free text let a typo target nobody. */}
                <MultiSelect
                  options={personaOptions}
                  value={form.targetPersonas}
                  onChange={(v) => setForm(f => ({ ...f, targetPersonas: v }))}
                  disabled={vem.isView}
                  emptyMessage="Loading persona catalog…"
                />
              </div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="insightActionable" checked={form.isActionable} onChange={e => setForm(f => ({ ...f, isActionable: e.target.checked }))} className="rounded" />
                <label htmlFor="insightActionable" className="text-sm text-gray-700">Actionable</label>
              </div>
              <div><label className={lbl}>Action Suggestion</label><input value={form.actionSuggestion} onChange={e => setForm(f => ({ ...f, actionSuggestion: e.target.value }))} className={inp} /></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
