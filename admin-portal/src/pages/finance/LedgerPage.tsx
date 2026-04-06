import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFinancialLedger, createFinancialLedger, updateFinancialLedger, deleteFinancialLedger } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const ENTRY_TYPES = ['income', 'expense', 'transfer', 'adjustment'] as const;
const ENTRY_COLOR: Record<string, string> = { income: 'success', expense: 'danger', transfer: 'info', adjustment: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function LedgerPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ entryDate: '', entryType: 'income', category: '', description: '', debit: '', credit: '', referenceId: '', referenceType: '' });

  const { data, isLoading } = useQuery({ queryKey: ['ledger', page], queryFn: () => listFinancialLedger(page, 20) });

  const createMut = useMutation({ mutationFn: createFinancialLedger, onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFinancialLedger(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteFinancialLedger, onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ entryDate: '', entryType: 'income', category: '', description: '', debit: '', credit: '', referenceId: '', referenceType: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      entryDate: row.entryDate ? row.entryDate.slice(0, 10) : '',
      entryType: row.entryType || 'income',
      category: row.category || '',
      description: row.description || '',
      debit: row.debit != null ? String(row.debit) : '',
      credit: row.credit != null ? String(row.credit) : '',
      referenceId: row.referenceId || '',
      referenceType: row.referenceType || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.debit) payload.debit = Number(form.debit);
    else delete payload.debit;
    if (form.credit) payload.credit = Number(form.credit);
    else delete payload.credit;
    if (!payload.referenceId) delete payload.referenceId;
    if (!payload.referenceType) delete payload.referenceType;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'entryDate', label: 'Date', render: (r: any) => r.entryDate ? new Date(r.entryDate).toLocaleDateString() : '-' },
    { key: 'entryType', label: 'Type', render: (r: any) => <Badge variant={ENTRY_COLOR[r.entryType] || 'default'}>{r.entryType}</Badge> },
    { key: 'category', label: 'Category', render: (r: any) => <span className="font-medium text-navy">{r.category}</span> },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit', render: (r: any) => r.debit ? `₹${Number(r.debit).toLocaleString()}` : '-' },
    { key: 'credit', label: 'Credit', render: (r: any) => r.credit ? `₹${Number(r.credit).toLocaleString()}` : '-' },
    { key: 'balance', label: 'Balance', render: (r: any) => r.balance != null ? `₹${Number(r.balance).toLocaleString()}` : '-' },
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
        <h2 className="text-xl font-bold text-navy">Financial Ledger</h2>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Ledger Entry' : 'New Ledger Entry'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Entry Date *</label><input required type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Entry Type *</label>
              <select required value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))} className={inp}>
                {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Category *</label><input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Description *</label><input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Debit</label><input type="number" min={0} value={form.debit} onChange={e => setForm(f => ({ ...f, debit: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Credit</label><input type="number" min={0} value={form.credit} onChange={e => setForm(f => ({ ...f, credit: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Reference ID</label><input value={form.referenceId} onChange={e => setForm(f => ({ ...f, referenceId: e.target.value }))} className={inp} placeholder="Optional" /></div>
            <div><label className={lbl}>Reference Type</label><input value={form.referenceType} onChange={e => setForm(f => ({ ...f, referenceType: e.target.value }))} className={inp} placeholder="Optional" /></div>
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
