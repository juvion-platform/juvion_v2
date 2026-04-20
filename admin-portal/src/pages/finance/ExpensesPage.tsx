import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listExpenses, createExpense, updateExpense, deleteExpense, listBudgets } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['submitted', 'approved', 'paid', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { submitted: 'default', approved: 'info', paid: 'success', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { budgetId: '', category: '', description: '', amount: '', vendorName: '', invoiceNumber: '', invoiceDate: '', paidDate: '', status: 'submitted' };

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['expenses', page], queryFn: () => listExpenses(page, 20) });
  const { data: budgetsData } = useQuery({ queryKey: ['budgets-lookup'], queryFn: () => listBudgets(1, 100) });

  const budgets: any[] = budgetsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      budgetId: row.budgetId?._id || row.budgetId || '',
      category: row.category || '',
      description: row.description || '',
      amount: String(row.amount || ''),
      vendorName: row.vendorName || '',
      invoiceNumber: row.invoiceNumber || '',
      invoiceDate: row.invoiceDate ? row.invoiceDate.slice(0, 10) : '',
      paidDate: row.paidDate ? row.paidDate.slice(0, 10) : '',
      status: row.status || 'submitted',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createExpense, onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateExpense(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteExpense, onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, amount: Number(form.amount) };
    if (!payload.budgetId) delete payload.budgetId;
    if (!payload.vendorName) delete payload.vendorName;
    if (!payload.invoiceNumber) delete payload.invoiceNumber;
    if (!payload.invoiceDate) delete payload.invoiceDate;
    if (!payload.paidDate) delete payload.paidDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'category', label: 'Category', render: (r: any) => <span className="font-medium text-navy">{r.category}</span> },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString()}` },
    { key: 'vendorName', label: 'Vendor', render: (r: any) => r.vendorName || '-' },
    { key: 'budgetId', label: 'Budget', render: (r: any) => r.budgetId?.category || '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this expense?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Expenses</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Expense
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Expense')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Budget {!vem.isView && <Link to="/finance/budgets" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.budgetId} onChange={e => setForm(f => ({ ...f, budgetId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {budgets.map((b: any) => (
                    <option key={b._id} value={b._id}>
                      {b.category + ' — ₹' + b.allocatedAmount.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Category *</label><input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Description *</label><input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Vendor Name</label><input value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Invoice Number</label><input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Invoice Date</label><input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Paid Date</label><input type="date" value={form.paidDate} onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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
