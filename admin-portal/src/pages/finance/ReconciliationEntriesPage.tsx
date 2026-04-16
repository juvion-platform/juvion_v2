import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listReconciliationEntries, createReconciliationEntry, updateReconciliationEntry, deleteReconciliationEntry } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['matched', 'discrepancy_flagged', 'resolved'] as const;
const STATUS_COLOR: Record<string, string> = { matched: 'success', discrepancy_flagged: 'warning', resolved: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function ReconciliationEntriesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    paymentTransactionId: '',
    bankStatementRef: '',
    matchedAmount: '',
    status: 'matched',
    discrepancyType: '',
    discrepancyAmount: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['reconciliation-entries', page], queryFn: () => listReconciliationEntries(page, 20) });

  const createMut = useMutation({ mutationFn: createReconciliationEntry, onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation-entries'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateReconciliationEntry(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation-entries'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteReconciliationEntry, onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation-entries'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ paymentTransactionId: '', bankStatementRef: '', matchedAmount: '', status: 'matched', discrepancyType: '', discrepancyAmount: '', notes: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      paymentTransactionId: row.paymentTransactionId?._id || row.paymentTransactionId || '',
      bankStatementRef: row.bankStatementRef || '',
      matchedAmount: String(row.matchedAmount || ''),
      status: row.status || 'matched',
      discrepancyType: row.discrepancyType || '',
      discrepancyAmount: String(row.discrepancyAmount || ''),
      notes: row.notes || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      paymentTransactionId: form.paymentTransactionId,
      matchedAmount: Number(form.matchedAmount),
      status: form.status,
    };
    if (form.bankStatementRef) payload.bankStatementRef = form.bankStatementRef;
    if (form.discrepancyType) payload.discrepancyType = form.discrepancyType;
    if (form.discrepancyAmount) payload.discrepancyAmount = Number(form.discrepancyAmount);
    if (form.notes) payload.notes = form.notes;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'paymentTransactionId', label: 'Transaction Ref', render: (r: any) => <span className="font-medium text-navy">{r.paymentTransactionId?.transactionRef || r.bankStatementRef || r.paymentTransactionId || '\u2014'}</span> },
    { key: 'matchedAmount', label: 'Amount', render: (r: any) => `\u20B9${Number(r.matchedAmount).toLocaleString('en-IN')}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status?.replace('_', ' ')}</Badge> },
    { key: 'bankStatementRef', label: 'Bank Ref', render: (r: any) => r.bankStatementRef || '\u2014' },
    { key: 'discrepancyType', label: 'Discrepancy', render: (r: any) => r.discrepancyType ? <Badge variant="warning">{r.discrepancyType}</Badge> : '\u2014' },
    { key: 'discrepancyAmount', label: 'Disc. Amount', render: (r: any) => r.discrepancyAmount ? `\u20B9${Number(r.discrepancyAmount).toLocaleString('en-IN')}` : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this entry?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Reconciliation Entries</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Entry
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Entry' : 'New Entry'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Payment Transaction ID *</label>
              <input required value={form.paymentTransactionId} onChange={e => setForm(f => ({ ...f, paymentTransactionId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Bank Statement Ref</label>
              <input value={form.bankStatementRef} onChange={e => setForm(f => ({ ...f, bankStatementRef: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Matched Amount *</label>
              <input required type="number" min={0} value={form.matchedAmount} onChange={e => setForm(f => ({ ...f, matchedAmount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Discrepancy Type</label>
              <input value={form.discrepancyType} onChange={e => setForm(f => ({ ...f, discrepancyType: e.target.value }))} className={inp} placeholder="e.g. amount_mismatch" />
            </div>
            <div>
              <label className={lbl}>Discrepancy Amount</label>
              <input type="number" value={form.discrepancyAmount} onChange={e => setForm(f => ({ ...f, discrepancyAmount: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
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
