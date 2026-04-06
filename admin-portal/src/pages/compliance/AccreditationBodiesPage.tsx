import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAccreditationBodies, createAccreditationBody, updateAccreditationBody, deleteAccreditationBody } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TYPES = ['naac', 'nba', 'nirf', 'abet', 'aicte', 'ugc', 'other'] as const;
const TYPE_COLOR: Record<string, string> = { naac: 'info', nba: 'success', nirf: 'warning', abet: 'danger', aicte: 'info', ugc: 'default', other: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function AccreditationBodiesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', acronym: '', website: '', type: 'naac' as string });

  const { data, isLoading } = useQuery({ queryKey: ['accreditation-bodies', page], queryFn: () => listAccreditationBodies(page, 20) });

  const createMut = useMutation({ mutationFn: createAccreditationBody, onSuccess: () => { qc.invalidateQueries({ queryKey: ['accreditation-bodies'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAccreditationBody(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['accreditation-bodies'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteAccreditationBody, onSuccess: () => { qc.invalidateQueries({ queryKey: ['accreditation-bodies'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', acronym: '', website: '', type: 'naac' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ name: row.name || '', acronym: row.acronym || '', website: row.website || '', type: row.type || 'naac' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.website) delete payload.website;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'acronym', label: 'Acronym', render: (r: any) => <span className="font-semibold">{r.acronym}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant={TYPE_COLOR[r.type] || 'default'}>{r.type?.toUpperCase()}</Badge> },
    { key: 'website', label: 'Website', render: (r: any) => r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-primary-600 underline text-xs">{r.website}</a> : <span className="text-gray-400">&mdash;</span> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this body?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Accreditation Bodies</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Body
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Accreditation Body' : 'New Accreditation Body'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Acronym *</label>
              <input required value={form.acronym} onChange={e => setForm(f => ({ ...f, acronym: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inp} placeholder="https://..." />
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
