import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBounceRecords, createBounceRecord, updateBounceRecord, deleteBounceRecord } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function BounceRecordsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    paymentTransactionId: '',
    invoiceId: '',
    reason: '',
    penaltyAmount: '0',
    bouncedAt: new Date().toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({ queryKey: ['bounce-records', page], queryFn: () => listBounceRecords(page, 20) });

  const createMut = useMutation({ mutationFn: createBounceRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['bounce-records'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBounceRecord(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['bounce-records'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteBounceRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['bounce-records'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ paymentTransactionId: '', invoiceId: '', reason: '', penaltyAmount: '0', bouncedAt: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      paymentTransactionId: row.paymentTransactionId?._id || row.paymentTransactionId || '',
      invoiceId: row.invoiceId?._id || row.invoiceId || '',
      reason: row.reason || '',
      penaltyAmount: String(row.penaltyAmount || '0'),
      bouncedAt: row.bouncedAt ? row.bouncedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      paymentTransactionId: form.paymentTransactionId,
      invoiceId: form.invoiceId,
      reason: form.reason,
      penaltyAmount: Number(form.penaltyAmount),
      bouncedAt: form.bouncedAt,
    };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'paymentTransactionId', label: 'Transaction', render: (r: any) => <span className="font-medium text-navy">{r.paymentTransactionId?.transactionRef || r.paymentTransactionId || '\u2014'}</span> },
    { key: 'invoiceId', label: 'Invoice', render: (r: any) => r.invoiceId?.invoiceNumber || r.invoiceId || '\u2014' },
    { key: 'reason', label: 'Reason', render: (r: any) => r.reason || '\u2014' },
    { key: 'penaltyAmount', label: 'Penalty', render: (r: any) => `\u20B9${Number(r.penaltyAmount).toLocaleString('en-IN')}` },
    { key: 'bouncedAt', label: 'Bounced Date', render: (r: any) => r.bouncedAt ? new Date(r.bouncedAt).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (_r: any) => <Badge variant="danger">bounced</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this bounce record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Bounce Records</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Bounce Record
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Bounce Record' : 'New Bounce Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Payment Transaction ID *</label>
              <input required value={form.paymentTransactionId} onChange={e => setForm(f => ({ ...f, paymentTransactionId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Invoice ID *</label>
              <input required value={form.invoiceId} onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Reason *</label>
              <input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} placeholder="e.g. Insufficient funds" />
            </div>
            <div>
              <label className={lbl}>Penalty Amount</label>
              <input type="number" min={0} value={form.penaltyAmount} onChange={e => setForm(f => ({ ...f, penaltyAmount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Bounced Date</label>
              <input type="date" value={form.bouncedAt} onChange={e => setForm(f => ({ ...f, bouncedAt: e.target.value }))} className={inp} />
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
