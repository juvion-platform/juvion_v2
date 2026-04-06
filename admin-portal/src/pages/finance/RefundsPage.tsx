import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRefunds, createRefund, updateRefund, deleteRefund, listPayments } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const REFUND_MODES = ['cash', 'cheque', 'online', 'neft'] as const;
const STATUSES = ['requested', 'approved', 'processed', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { requested: 'default', approved: 'info', processed: 'success', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function RefundsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', paymentId: '', amount: '', reason: '', refundMode: 'cash', status: 'requested', processedDate: '' });

  const { data, isLoading } = useQuery({ queryKey: ['refunds', page], queryFn: () => listRefunds(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const { data: paymentsData } = useQuery({ queryKey: ['payments-lookup'], queryFn: () => listPayments(1, 100) });

  const students: any[] = studentsData?.items || [];
  const payments: any[] = paymentsData?.items || [];

  const createMut = useMutation({ mutationFn: createRefund, onSuccess: () => { qc.invalidateQueries({ queryKey: ['refunds'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRefund(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['refunds'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteRefund, onSuccess: () => { qc.invalidateQueries({ queryKey: ['refunds'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', paymentId: '', amount: '', reason: '', refundMode: 'cash', status: 'requested', processedDate: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      paymentId: row.paymentId?._id || row.paymentId || '',
      amount: String(row.amount || ''),
      reason: row.reason || '',
      refundMode: row.refundMode || 'cash',
      status: row.status || 'requested',
      processedDate: row.processedDate ? row.processedDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, amount: Number(form.amount) };
    if (!payload.paymentId) delete payload.paymentId;
    if (!payload.processedDate) delete payload.processedDate;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentLabel(s: any) {
    return s.name || [s.firstName, s.lastName].filter(Boolean).join(' ') || s.rollNumber || s._id;
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.name || r.studentId?.firstName || '—'}</span> },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString()}` },
    { key: 'reason', label: 'Reason' },
    { key: 'refundMode', label: 'Mode', render: (r: any) => <Badge variant="info">{r.refundMode}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this refund?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Refunds</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Refund
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Refund' : 'New Refund'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Payment</label>
              <select value={form.paymentId} onChange={e => setForm(f => ({ ...f, paymentId: e.target.value }))} className={inp}>
                <option value="">None</option>
                {payments.map((p: any) => <option key={p._id} value={p._id}>{p.receiptNumber + ' — ₹' + p.amount}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Refund Mode *</label>
              <select required value={form.refundMode} onChange={e => setForm(f => ({ ...f, refundMode: e.target.value }))} className={inp}>
                {REFUND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Reason *</label><input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Processed Date</label><input type="date" value={form.processedDate} onChange={e => setForm(f => ({ ...f, processedDate: e.target.value }))} className={inp} /></div>
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
