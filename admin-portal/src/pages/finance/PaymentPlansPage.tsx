import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPaymentPlans, createPaymentPlan, updatePaymentPlan, deletePaymentPlan } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['active', 'completed', 'defaulted', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', completed: 'info', defaulted: 'danger', cancelled: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PaymentPlansPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    invoiceId: '',
    feeAgreementId: '',
    templateId: '',
    totalAmount: '',
    status: 'active',
    installmentCount: '3',
    firstDueDate: new Date().toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({ queryKey: ['payment-plans', page], queryFn: () => listPaymentPlans(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createPaymentPlan, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-plans'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePaymentPlan(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-plans'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePaymentPlan, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-plans'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', invoiceId: '', feeAgreementId: '', templateId: '', totalAmount: '', status: 'active', installmentCount: '3', firstDueDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      invoiceId: row.invoiceId?._id || row.invoiceId || '',
      feeAgreementId: row.feeAgreementId?._id || row.feeAgreementId || '',
      templateId: row.templateId || '',
      totalAmount: String(row.totalAmount || ''),
      status: row.status || 'active',
      installmentCount: String(row.installments?.length || '3'),
      firstDueDate: row.installments?.[0]?.dueDate ? row.installments[0].dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function buildInstallments(total: number, count: number, startDate: string) {
    const perInstallment = Math.round(total / count);
    const installments = [];
    const base = new Date(startDate);
    for (let i = 0; i < count; i++) {
      const dueDate = new Date(base);
      dueDate.setMonth(dueDate.getMonth() + i);
      installments.push({
        dueDate: dueDate.toISOString(),
        amount: i === count - 1 ? total - perInstallment * (count - 1) : perInstallment,
        status: 'pending',
      });
    }
    return installments;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(form.totalAmount);
    const count = Number(form.installmentCount) || 3;
    const payload: any = {
      studentId: form.studentId,
      invoiceId: form.invoiceId,
      totalAmount: total,
      status: form.status,
      installments: buildInstallments(total, count, form.firstDueDate),
    };
    if (form.feeAgreementId) payload.feeAgreementId = form.feeAgreementId;
    if (form.templateId) payload.templateId = form.templateId;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'totalAmount', label: 'Total Amount', render: (r: any) => `\u20B9${Number(r.totalAmount).toLocaleString('en-IN')}` },
    { key: 'installments', label: 'Installments', render: (r: any) => r.installments?.length ?? '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'startDate', label: 'Start Date', render: (r: any) => r.installments?.[0]?.dueDate ? new Date(r.installments[0].dueDate).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this payment plan?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Payment Plans</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Payment Plan
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Payment Plan' : 'New Payment Plan'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Invoice ID *</label>
              <input required value={form.invoiceId} onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Total Amount *</label>
              <input required type="number" min={0} value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Number of Installments</label>
              <input type="number" min={1} max={24} value={form.installmentCount} onChange={e => setForm(f => ({ ...f, installmentCount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>First Due Date</label>
              <input type="date" value={form.firstDueDate} onChange={e => setForm(f => ({ ...f, firstDueDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fee Agreement ID</label>
              <input value={form.feeAgreementId} onChange={e => setForm(f => ({ ...f, feeAgreementId: e.target.value }))} className={inp} placeholder="ObjectId (optional)" />
            </div>
            <div>
              <label className={lbl}>Template ID</label>
              <input value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))} className={inp} />
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
