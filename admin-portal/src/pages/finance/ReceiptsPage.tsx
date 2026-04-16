import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listReceipts, createReceipt, updateReceipt, deleteReceipt } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CHANNELS = ['email', 'print', 'whatsapp'] as const;
const STATUSES = ['issued', 'cancelled', 'reissued'] as const;
const STATUS_COLOR: Record<string, string> = { issued: 'success', cancelled: 'danger', reissued: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ReceiptsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    receiptNumber: '',
    paymentTransactionId: '',
    studentId: '',
    amount: '',
    issuedDate: new Date().toISOString().slice(0, 10),
    channel: 'email',
    status: 'issued',
    vaultDocId: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['receipts', page], queryFn: () => listReceipts(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createReceipt, onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateReceipt(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteReceipt, onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ receiptNumber: '', paymentTransactionId: '', studentId: '', amount: '', issuedDate: new Date().toISOString().slice(0, 10), channel: 'email', status: 'issued', vaultDocId: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      receiptNumber: row.receiptNumber || '',
      paymentTransactionId: row.paymentTransactionId?._id || row.paymentTransactionId || '',
      studentId: row.studentId?._id || row.studentId || '',
      amount: String(row.amount || ''),
      issuedDate: row.issuedDate ? row.issuedDate.slice(0, 10) : '',
      channel: row.channel || 'email',
      status: row.status || 'issued',
      vaultDocId: row.vaultDocId || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      receiptNumber: form.receiptNumber,
      paymentTransactionId: form.paymentTransactionId,
      studentId: form.studentId,
      amount: Number(form.amount),
      issuedDate: form.issuedDate,
      channel: form.channel,
      status: form.status,
    };
    if (form.vaultDocId) payload.vaultDocId = form.vaultDocId;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'receiptNumber', label: 'Receipt #', render: (r: any) => <span className="font-medium text-navy">{r.receiptNumber}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString('en-IN')}` },
    { key: 'channel', label: 'Channel', render: (r: any) => <Badge variant="info">{r.channel}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'issuedDate', label: 'Issued', render: (r: any) => r.issuedDate ? new Date(r.issuedDate).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this receipt?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Receipts</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Receipt
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Receipt' : 'New Receipt'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Receipt Number *</label>
              <input required value={form.receiptNumber} onChange={e => setForm(f => ({ ...f, receiptNumber: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Payment Transaction ID *</label>
              <input required value={form.paymentTransactionId} onChange={e => setForm(f => ({ ...f, paymentTransactionId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Amount *</label>
              <input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Issued Date</label>
              <input type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Channel</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className={inp}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Vault Doc ID</label>
              <input value={form.vaultDocId} onChange={e => setForm(f => ({ ...f, vaultDocId: e.target.value }))} className={inp} />
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
