import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPersonaConfigs, createPersonaConfig, updatePersonaConfig, deletePersonaConfig } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import MultiSelect, { type MultiSelectOption } from '../../components/ui/MultiSelect';
import { MODULE_OPTIONS } from '../../lib/modules';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm: {
  personaType: string; displayName: string; systemPrompt: string;
  availableModules: string[]; availableActions: string; maxTokensPerResponse: string; isActive: boolean;
} = { personaType: '', displayName: '', systemPrompt: '', availableModules: [], availableActions: '', maxTokensPerResponse: '2000', isActive: true };

export default function PersonaConfigsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['juvi-persona-configs', page, limit, search], queryFn: () => listPersonaConfigs(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      personaType: row.personaType || '',
      displayName: row.displayName || '',
      systemPrompt: row.systemPrompt || '',
      availableModules: row.availableModules || [],
      availableActions: (row.availableActions || []).join(', '),
      maxTokensPerResponse: row.maxTokensPerResponse != null ? String(row.maxTokensPerResponse) : '2000',
      isActive: row.isActive ?? true,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createPersonaConfig, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-persona-configs'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePersonaConfig(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-persona-configs'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deletePersonaConfig, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-persona-configs'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    payload.availableModules = form.availableModules;
    payload.availableActions = form.availableActions ? form.availableActions.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (form.maxTokensPerResponse) payload.maxTokensPerResponse = Number(form.maxTokensPerResponse);
    else delete payload.maxTokensPerResponse;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'displayName', label: 'Display Name', render: (r: any) => <span className="font-medium text-navy">{r.displayName}</span> },
    { key: 'personaType', label: 'Persona Type', render: (r: any) => <Badge variant="info">{r.personaType}</Badge> },
    { key: 'availableModules', label: 'Modules', render: (r: any) => (r.availableModules || []).length > 0 ? (r.availableModules || []).slice(0, 3).join(', ') + ((r.availableModules || []).length > 3 ? '...' : '') : '—' },
    { key: 'maxTokensPerResponse', label: 'Max Tokens', render: (r: any) => r.maxTokensPerResponse ?? 2000 },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this persona config?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Persona Configs</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search persona configs…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Persona
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Persona Config')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Persona Type *</label><input required value={form.personaType} onChange={e => setForm(f => ({ ...f, personaType: e.target.value }))} className={inp} placeholder="admin, faculty, student" /></div>
              <div><label className={lbl}>Display Name *</label><input required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>System Prompt *</label><textarea required rows={4} value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Available Modules</label>
                {/* Was comma-separated free text: a typo like "financee" saved
                    happily and then matched nothing at runtime. */}
                <MultiSelect
                  options={MODULE_OPTIONS as unknown as MultiSelectOption[]}
                  value={form.availableModules}
                  onChange={(v) => setForm(f => ({ ...f, availableModules: v }))}
                  disabled={vem.isView}
                />
              </div>
              <div><label className={lbl}>Available Actions (comma-separated)</label><input value={form.availableActions} onChange={e => setForm(f => ({ ...f, availableActions: e.target.value }))} className={inp} placeholder="query, create, update" /></div>
              <div><label className={lbl}>Max Tokens Per Response</label><input type="number" min={1} value={form.maxTokensPerResponse} onChange={e => setForm(f => ({ ...f, maxTokensPerResponse: e.target.value }))} className={inp} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="pcIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="pcIsActive" className="text-sm text-gray-700">Active</label>
              </div>
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
