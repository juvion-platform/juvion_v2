import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFinancialLedger, createFinancialLedger, updateFinancialLedger, deleteFinancialLedger } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const ENTRY_TYPES = ['income', 'expense', 'transfer', 'adjustment'] as const;
const ENTRY_COLOR: Record<string, string> = { income: 'success', expense: 'danger', transfer: 'info', adjustment: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { entryDate: '', entryType: 'income', category: '', description: '', debit: '', credit: '', referenceId: '', referenceType: '' };

export default function LedgerPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);
  const [amountError, setAmountError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['ledger', page, limit, search], queryFn: () => listFinancialLedger(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      entryDate: row.entryDate ? row.entryDate.slice(0, 10) : '',
      entryType: row.entryType || 'income',
      category: row.category || '',
      description: row.description || '',
      debit: row.debit != null ? String(row.debit) : '',
      credit: row.credit != null ? String(row.credit) : '',
      referenceId: row.referenceId || '',
      referenceType: row.referenceType || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createFinancialLedger, onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFinancialLedger(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteFinancialLedger, onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const debit = Number(form.debit || 0);
    const credit = Number(form.credit || 0);

    // A ledger line has to move money. Leaving both blank previously saved a
    // ₹0/₹0 entry that contributed nothing but still showed up in the journal.
    if (debit <= 0 && credit <= 0) {
      setAmountError('Enter a debit or a credit amount greater than zero.');
      return;
    }
    // Single-sided entries only — a line that is both a debit and a credit is
    // two entries, and silently accepting it makes the journal unbalanceable.
    if (debit > 0 && credit > 0) {
      setAmountError('An entry is either a debit or a credit, not both. Clear one of the two.');
      return;
    }
    setAmountError(null);

    const payload: any = { ...form };
    if (debit > 0) payload.debit = debit;
    else delete payload.debit;
    if (credit > 0) payload.credit = credit;
    else delete payload.credit;
    if (!payload.referenceId) delete payload.referenceId;
    if (!payload.referenceType) delete payload.referenceType;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

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
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this entry?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Financial Ledger</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search financial ledger…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Entry
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No financial ledger match “${search}”.` : 'No financial ledger yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Ledger Entry')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Entry Date *</label><input required type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Entry Type *</label>
                <select required value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))} className={inp}>
                  {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Category *</label><input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Description *</label><input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Debit</label><input type="number" min={0} step="0.01" value={form.debit} onChange={e => { setAmountError(null); setForm(f => ({ ...f, debit: e.target.value })); }} className={inp} aria-invalid={Boolean(amountError)} /></div>
              <div><label className={lbl}>Credit</label><input type="number" min={0} step="0.01" value={form.credit} onChange={e => { setAmountError(null); setForm(f => ({ ...f, credit: e.target.value })); }} className={inp} aria-invalid={Boolean(amountError)} /></div>
              {amountError && (
                <p className="col-span-2 -mt-2 text-sm text-red-600" role="alert">{amountError}</p>
              )}
              <div><label className={lbl}>Reference ID</label><input value={form.referenceId} onChange={e => setForm(f => ({ ...f, referenceId: e.target.value }))} className={inp} placeholder="Optional" /></div>
              <div><label className={lbl}>Reference Type</label><input value={form.referenceType} onChange={e => setForm(f => ({ ...f, referenceType: e.target.value }))} className={inp} placeholder="Optional" /></div>
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
