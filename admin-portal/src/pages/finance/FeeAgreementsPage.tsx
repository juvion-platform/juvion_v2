import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFeeAgreements, createFeeAgreement, updateFeeAgreement, deleteFeeAgreement } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['active', 'expired', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', expired: 'default', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function FeeAgreementsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    feeStructureInstanceId: '',
    negotiatedTotal: '',
    baseTotal: '',
    waiverAmount: '0',
    approvalAuthority: '',
    concessionDetails: '',
    validityPeriodYears: '4',
    status: 'active',
  });

  const { data, isLoading } = useQuery({ queryKey: ['fee-agreements', page], queryFn: () => listFeeAgreements(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createFeeAgreement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-agreements'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeeAgreement(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-agreements'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteFeeAgreement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-agreements'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', feeStructureInstanceId: '', negotiatedTotal: '', baseTotal: '', waiverAmount: '0', approvalAuthority: '', concessionDetails: '', validityPeriodYears: '4', status: 'active' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      feeStructureInstanceId: row.feeStructureInstanceId?._id || row.feeStructureInstanceId || '',
      negotiatedTotal: String(row.negotiatedTotal || ''),
      baseTotal: String(row.baseTotal || ''),
      waiverAmount: String(row.waiverAmount || '0'),
      approvalAuthority: row.approvalAuthority || '',
      concessionDetails: row.concessionDetails || '',
      validityPeriodYears: String(row.validityPeriodYears || '4'),
      status: row.status || 'active',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      feeStructureInstanceId: form.feeStructureInstanceId,
      negotiatedTotal: Number(form.negotiatedTotal),
      baseTotal: Number(form.baseTotal),
      waiverAmount: Number(form.waiverAmount),
      approvalAuthority: form.approvalAuthority,
      validityPeriodYears: Number(form.validityPeriodYears),
      status: form.status,
    };
    if (form.concessionDetails) payload.concessionDetails = form.concessionDetails;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'approvalAuthority', label: 'Approval Authority', render: (r: any) => <span className="font-medium text-navy">{r.approvalAuthority || '\u2014'}</span> },
    { key: 'negotiatedTotal', label: 'Negotiated Total', render: (r: any) => `\u20B9${Number(r.negotiatedTotal).toLocaleString('en-IN')}` },
    { key: 'waiverAmount', label: 'Waiver', render: (r: any) => `\u20B9${Number(r.waiverAmount).toLocaleString('en-IN')}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'validityPeriodYears', label: 'Validity (yrs)', render: (r: any) => r.validityPeriodYears ?? '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this agreement?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Agreements</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Agreement
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Agreement' : 'New Agreement'}>
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
              <label className={lbl}>Fee Structure Instance *</label>
              <input required value={form.feeStructureInstanceId} onChange={e => setForm(f => ({ ...f, feeStructureInstanceId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Negotiated Total *</label>
              <input required type="number" min={0} value={form.negotiatedTotal} onChange={e => setForm(f => ({ ...f, negotiatedTotal: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Base Total *</label>
              <input required type="number" min={0} value={form.baseTotal} onChange={e => setForm(f => ({ ...f, baseTotal: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Waiver Amount</label>
              <input type="number" min={0} value={form.waiverAmount} onChange={e => setForm(f => ({ ...f, waiverAmount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Approval Authority *</label>
              <input required value={form.approvalAuthority} onChange={e => setForm(f => ({ ...f, approvalAuthority: e.target.value }))} className={inp} placeholder="e.g. Principal" />
            </div>
            <div>
              <label className={lbl}>Validity (Years)</label>
              <input type="number" min={1} value={form.validityPeriodYears} onChange={e => setForm(f => ({ ...f, validityPeriodYears: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Concession Details</label>
              <input value={form.concessionDetails} onChange={e => setForm(f => ({ ...f, concessionDetails: e.target.value }))} className={inp} />
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
