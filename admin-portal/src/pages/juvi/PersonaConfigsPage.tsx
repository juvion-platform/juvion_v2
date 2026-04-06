import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPersonaConfigs, createPersonaConfig, updatePersonaConfig, deletePersonaConfig } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function PersonaConfigsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ personaType: '', displayName: '', systemPrompt: '', availableModules: '', availableActions: '', maxTokensPerResponse: '2000', isActive: true });

  const { data, isLoading } = useQuery({ queryKey: ['juvi-persona-configs', page], queryFn: () => listPersonaConfigs(page, 20) });

  const createMut = useMutation({ mutationFn: createPersonaConfig, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-persona-configs'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePersonaConfig(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-persona-configs'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePersonaConfig, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-persona-configs'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ personaType: '', displayName: '', systemPrompt: '', availableModules: '', availableActions: '', maxTokensPerResponse: '2000', isActive: true });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      personaType: row.personaType || '',
      displayName: row.displayName || '',
      systemPrompt: row.systemPrompt || '',
      availableModules: (row.availableModules || []).join(', '),
      availableActions: (row.availableActions || []).join(', '),
      maxTokensPerResponse: row.maxTokensPerResponse != null ? String(row.maxTokensPerResponse) : '2000',
      isActive: row.isActive ?? true,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    payload.availableModules = form.availableModules ? form.availableModules.split(',').map(s => s.trim()).filter(Boolean) : [];
    payload.availableActions = form.availableActions ? form.availableActions.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (form.maxTokensPerResponse) payload.maxTokensPerResponse = Number(form.maxTokensPerResponse);
    else delete payload.maxTokensPerResponse;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'displayName', label: 'Display Name', render: (r: any) => <span className="font-medium text-navy">{r.displayName}</span> },
    { key: 'personaType', label: 'Persona Type', render: (r: any) => <Badge variant="info">{r.personaType}</Badge> },
    { key: 'availableModules', label: 'Modules', render: (r: any) => (r.availableModules || []).length > 0 ? (r.availableModules || []).slice(0, 3).join(', ') + ((r.availableModules || []).length > 3 ? '...' : '') : '—' },
    { key: 'maxTokensPerResponse', label: 'Max Tokens', render: (r: any) => r.maxTokensPerResponse ?? 2000 },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this persona config?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Persona Configs</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Persona
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Persona Config' : 'New Persona Config'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Persona Type *</label><input required value={form.personaType} onChange={e => setForm(f => ({ ...f, personaType: e.target.value }))} className={inp} placeholder="admin, faculty, student" /></div>
            <div><label className={lbl}>Display Name *</label><input required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>System Prompt *</label><textarea required rows={4} value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Available Modules (comma-separated)</label><input value={form.availableModules} onChange={e => setForm(f => ({ ...f, availableModules: e.target.value }))} className={inp} placeholder="finance, academics, hr" /></div>
            <div><label className={lbl}>Available Actions (comma-separated)</label><input value={form.availableActions} onChange={e => setForm(f => ({ ...f, availableActions: e.target.value }))} className={inp} placeholder="query, create, update" /></div>
            <div><label className={lbl}>Max Tokens Per Response</label><input type="number" min={1} value={form.maxTokensPerResponse} onChange={e => setForm(f => ({ ...f, maxTokensPerResponse: e.target.value }))} className={inp} /></div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="pcIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="pcIsActive" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
