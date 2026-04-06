import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAffiliationStatuses, createAffiliationStatus, updateAffiliationStatus, deleteAffiliationStatus } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['active', 'expired', 'renewal_pending', 'revoked'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', expired: 'danger', renewal_pending: 'warning', revoked: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function AffiliationStatusesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    universityName: '', affiliationNumber: '', validFrom: '', validTo: '', status: 'active' as string,
  });

  const { data, isLoading } = useQuery({ queryKey: ['affiliation-statuses', page], queryFn: () => listAffiliationStatuses(page, 20) });

  const createMut = useMutation({ mutationFn: createAffiliationStatus, onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliation-statuses'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAffiliationStatus(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliation-statuses'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteAffiliationStatus, onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliation-statuses'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ universityName: '', affiliationNumber: '', validFrom: '', validTo: '', status: 'active' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      universityName: row.universityName || '',
      affiliationNumber: row.affiliationNumber || '',
      validFrom: row.validFrom?.slice(0, 10) || '',
      validTo: row.validTo?.slice(0, 10) || '',
      status: row.status || 'active',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.affiliationNumber) delete payload.affiliationNumber;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'universityName', label: 'University', render: (r: any) => <span className="font-medium text-navy">{r.universityName}</span> },
    { key: 'affiliationNumber', label: 'Affiliation #', render: (r: any) => r.affiliationNumber || '\u2014' },
    { key: 'validFrom', label: 'Valid From', render: (r: any) => r.validFrom ? new Date(r.validFrom).toLocaleDateString() : '\u2014' },
    { key: 'validTo', label: 'Valid To', render: (r: any) => r.validTo ? new Date(r.validTo).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this affiliation?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Affiliation Statuses</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Affiliation
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Affiliation Status' : 'New Affiliation Status'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={lbl}>University Name *</label>
              <input required value={form.universityName} onChange={e => setForm(f => ({ ...f, universityName: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Affiliation Number</label>
              <input value={form.affiliationNumber} onChange={e => setForm(f => ({ ...f, affiliationNumber: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Valid From *</label>
              <input required type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Valid To *</label>
              <input required type="date" value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} className={inp} />
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
