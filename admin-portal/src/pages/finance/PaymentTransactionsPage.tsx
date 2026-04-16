import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPaymentTransactions, createPaymentTransaction, updatePaymentTransaction, deletePaymentTransaction } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CHANNELS = ['gateway', 'cash', 'dd', 'neft', 'rtgs', 'upi', 'card'] as const;
const RECONCILIATION_STATUSES = ['initiated', 'received', 'matched', 'discrepancy', 'resolved', 'reversed', 'refunded'] as const;
const RECON_COLOR: Record<string, string> = { initiated: 'default', received: 'info', matched: 'success', discrepancy: 'danger', resolved: 'success', reversed: 'warning', refunded: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PaymentTransactionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    invoiceId: '',
    amount: '',
    channel: 'cash',
    paymentMode: '',
    transactionRef: '',
    reconciliationStatus: 'received',
    gatewayOrderId: '',
    ddNumber: '',
    ddBank: '',
    ddDate: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    receiptId: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['payment-transactions', page], queryFn: () => listPaymentTransactions(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createPaymentTransaction, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-transactions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePaymentTransaction(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-transactions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePaymentTransaction, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-transactions'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({
      studentId: '', invoiceId: '', amount: '', channel: 'cash', paymentMode: '',
      transactionRef: '', reconciliationStatus: 'received', gatewayOrderId: '',
      ddNumber: '', ddBank: '', ddDate: '', paymentDate: new Date().toISOString().slice(0, 10), receiptId: '',
    });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      invoiceId: row.invoiceId?._id || row.invoiceId || '',
      amount: String(row.amount || ''),
      channel: row.channel || 'cash',
      paymentMode: row.paymentMode || '',
      transactionRef: row.transactionRef || '',
      reconciliationStatus: row.reconciliationStatus || 'received',
      gatewayOrderId: row.gatewayOrderId || '',
      ddNumber: row.ddNumber || '',
      ddBank: row.ddBank || '',
      ddDate: row.ddDate ? row.ddDate.slice(0, 10) : '',
      paymentDate: row.paymentDate ? row.paymentDate.slice(0, 10) : '',
      receiptId: row.receiptId?._id || row.receiptId || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      invoiceId: form.invoiceId,
      amount: Number(form.amount),
      channel: form.channel,
      paymentMode: form.paymentMode,
      reconciliationStatus: form.reconciliationStatus,
      paymentDate: form.paymentDate,
    };
    if (form.transactionRef) payload.transactionRef = form.transactionRef;
    if (form.gatewayOrderId) payload.gatewayOrderId = form.gatewayOrderId;
    if (form.ddNumber) payload.ddNumber = form.ddNumber;
    if (form.ddBank) payload.ddBank = form.ddBank;
    if (form.ddDate) payload.ddDate = form.ddDate;
    if (form.receiptId) payload.receiptId = form.receiptId;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString('en-IN')}` },
    { key: 'channel', label: 'Channel', render: (r: any) => <Badge variant="info">{r.channel}</Badge> },
    { key: 'paymentMode', label: 'Mode' },
    { key: 'reconciliationStatus', label: 'Reconciliation', render: (r: any) => <Badge variant={RECON_COLOR[r.reconciliationStatus] || 'default'}>{r.reconciliationStatus}</Badge> },
    { key: 'paymentDate', label: 'Date', render: (r: any) => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this transaction?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Payment Transactions</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Transaction
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Payment Transaction' : 'New Payment Transaction'}>
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
              <label className={lbl}>Amount *</label>
              <input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Channel *</label>
              <select required value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className={inp}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Payment Mode *</label>
              <input required value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Reconciliation Status</label>
              <select value={form.reconciliationStatus} onChange={e => setForm(f => ({ ...f, reconciliationStatus: e.target.value }))} className={inp}>
                {RECONCILIATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Payment Date *</label>
              <input required type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Transaction Ref</label>
              <input value={form.transactionRef} onChange={e => setForm(f => ({ ...f, transactionRef: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Gateway Order ID</label>
              <input value={form.gatewayOrderId} onChange={e => setForm(f => ({ ...f, gatewayOrderId: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>DD Number</label>
              <input value={form.ddNumber} onChange={e => setForm(f => ({ ...f, ddNumber: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>DD Bank</label>
              <input value={form.ddBank} onChange={e => setForm(f => ({ ...f, ddBank: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>DD Date</label>
              <input type="date" value={form.ddDate} onChange={e => setForm(f => ({ ...f, ddDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Receipt ID</label>
              <input value={form.receiptId} onChange={e => setForm(f => ({ ...f, receiptId: e.target.value }))} className={inp} placeholder="ObjectId" />
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
