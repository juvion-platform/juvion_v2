import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInsuranceClaims, createInsuranceClaim, updateInsuranceClaim, deleteInsuranceClaim } from '../../services/welfare';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['filed', 'processing', 'approved', 'rejected', 'settled'] as const;
const STATUS_COLOR: Record<string, string> = { filed: 'default', processing: 'warning', approved: 'success', rejected: 'danger', settled: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function InsuranceClaimsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ personId: '', insuranceProvider: '', policyNumber: '', claimAmount: '', reason: '', claimDate: '', status: 'filed', settledAmount: '' });

  const { data, isLoading } = useQuery({ queryKey: ['insurance-claims', page], queryFn: () => listInsuranceClaims(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createInsuranceClaim, onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-claims'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInsuranceClaim(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-claims'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteInsuranceClaim, onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-claims'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ personId: '', insuranceProvider: '', policyNumber: '', claimAmount: '', reason: '', claimDate: '', status: 'filed', settledAmount: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      personId: row.personId?._id || row.personId || '',
      insuranceProvider: row.insuranceProvider || '',
      policyNumber: row.policyNumber || '',
      claimAmount: String(row.claimAmount ?? ''),
      reason: row.reason || '',
      claimDate: row.claimDate ? row.claimDate.slice(0, 10) : '',
      status: row.status || 'filed',
      settledAmount: row.settledAmount != null ? String(row.settledAmount) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, claimAmount: Number(form.claimAmount) };
    if (!payload.claimDate) delete payload.claimDate;
    if (form.settledAmount) payload.settledAmount = Number(form.settledAmount);
    else delete payload.settledAmount;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'personId', label: 'Person', render: (r: any) => <span className="font-medium text-navy">{r.personId?.name || '\u2014'}</span> },
    { key: 'insuranceProvider', label: 'Provider' },
    { key: 'policyNumber', label: 'Policy #' },
    { key: 'claimAmount', label: 'Amount', render: (r: any) => `\u20B9${Number(r.claimAmount).toLocaleString()}` },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'settledAmount', label: 'Settled', render: (r: any) => r.settledAmount != null ? `\u20B9${Number(r.settledAmount).toLocaleString()}` : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this claim?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Insurance Claims</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Claim
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Claim' : 'New Claim'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Person * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp}>
                <option value="">Select person...</option>
                {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Insurance Provider *</label><input required value={form.insuranceProvider} onChange={e => setForm(f => ({ ...f, insuranceProvider: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Policy Number *</label><input required value={form.policyNumber} onChange={e => setForm(f => ({ ...f, policyNumber: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Claim Amount *</label><input required type="number" min={0} value={form.claimAmount} onChange={e => setForm(f => ({ ...f, claimAmount: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Reason *</label><input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Claim Date</label><input type="date" value={form.claimDate} onChange={e => setForm(f => ({ ...f, claimDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Settled Amount</label><input type="number" min={0} value={form.settledAmount} onChange={e => setForm(f => ({ ...f, settledAmount: e.target.value }))} className={inp} /></div>
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
