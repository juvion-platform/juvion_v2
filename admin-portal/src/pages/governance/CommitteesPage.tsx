import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCommittees, createCommittee, updateCommittee, deleteCommittee } from '../../services/governance';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPES = ['statutory', 'academic', 'administrative', 'disciplinary', 'grievance', 'anti_ragging', 'icc', 'iqac', 'other'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function CommitteesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', type: 'statutory', purpose: '', chairpersonId: '', formedDate: '', isActive: true });

  const { data, isLoading } = useQuery({ queryKey: ['gov-committees', page], queryFn: () => listCommittees(page, 20) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const createMut = useMutation({ mutationFn: createCommittee, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-committees'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCommittee(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-committees'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCommittee, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-committees'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', type: 'statutory', purpose: '', chairpersonId: '', formedDate: '', isActive: true });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || '',
      type: row.type || 'statutory',
      purpose: row.purpose || '',
      chairpersonId: row.chairpersonId?._id || row.chairpersonId || '',
      formedDate: row.formedDate ? row.formedDate.slice(0, 10) : '',
      isActive: row.isActive !== false,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.chairpersonId) delete payload.chairpersonId;
    if (!payload.purpose) delete payload.purpose;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'chairpersonId', label: 'Chairperson', render: (r: any) => r.chairpersonId?.name || '\u2014' },
    { key: 'formedDate', label: 'Formed', render: (r: any) => fmtDate(r.formedDate) },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this committee?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Committees</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Committee
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Committee' : 'New Committee'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Purpose</label><textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={inp} rows={2} /></div>
            <div>
              <label className={lbl}>Chairperson <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select value={form.chairpersonId} onChange={e => setForm(f => ({ ...f, chairpersonId: e.target.value }))} className={inp}>
                <option value="">Select person</option>
                {(persons?.items || []).map((p: any) => (
                  <option key={p._id} value={p._id}>{p.name || p._id}</option>
                ))}
              </select>
            </div>
            <div><label className={lbl}>Formed Date *</label><input required type="date" value={form.formedDate} onChange={e => setForm(f => ({ ...f, formedDate: e.target.value }))} className={inp} /></div>
            <div>
              <label className={lbl}>Active</label>
              <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} className={inp}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
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
