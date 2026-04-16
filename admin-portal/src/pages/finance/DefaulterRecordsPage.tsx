import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDefaulterRecords, createDefaulterRecord, updateDefaulterRecord, deleteDefaulterRecord } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const ESCALATION_STAGES = ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'welfare_referred', 'resolved', 'exited_hardship', 'exited_write_off'] as const;
const WELFARE_STATUSES = ['none', 'referred', 'returned'] as const;
const RESOLUTION_TYPES = ['payment', 'write_off', 'concession', 'other'] as const;
const STAGE_COLOR: Record<string, string> = {
  stage_1: 'warning', stage_2: 'warning', stage_3: 'danger', stage_4: 'danger',
  welfare_referred: 'info', resolved: 'success', exited_hardship: 'default', exited_write_off: 'default',
};
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function DefaulterRecordsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    invoiceId: '',
    overdueAmount: '',
    daysOverdue: '',
    escalationStage: 'stage_1',
    welfareReferralStatus: 'none',
    distressScore: '',
    resolutionDate: '',
    resolutionType: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['defaulter-records', page], queryFn: () => listDefaulterRecords(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createDefaulterRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['defaulter-records'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateDefaulterRecord(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['defaulter-records'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteDefaulterRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['defaulter-records'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', invoiceId: '', overdueAmount: '', daysOverdue: '', escalationStage: 'stage_1', welfareReferralStatus: 'none', distressScore: '', resolutionDate: '', resolutionType: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      invoiceId: row.invoiceId?._id || row.invoiceId || '',
      overdueAmount: String(row.overdueAmount || ''),
      daysOverdue: String(row.daysOverdue || ''),
      escalationStage: row.escalationStage || 'stage_1',
      welfareReferralStatus: row.welfareReferralStatus || 'none',
      distressScore: row.distressScore != null ? String(row.distressScore) : '',
      resolutionDate: row.resolutionDate ? row.resolutionDate.slice(0, 10) : '',
      resolutionType: row.resolutionType || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      invoiceId: form.invoiceId,
      overdueAmount: Number(form.overdueAmount),
      daysOverdue: Number(form.daysOverdue),
      escalationStage: form.escalationStage,
      welfareReferralStatus: form.welfareReferralStatus,
    };
    if (form.distressScore) payload.distressScore = Number(form.distressScore);
    if (form.resolutionDate) payload.resolutionDate = form.resolutionDate;
    if (form.resolutionType) payload.resolutionType = form.resolutionType;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'overdueAmount', label: 'Overdue', render: (r: any) => `₹${Number(r.overdueAmount).toLocaleString('en-IN')}` },
    { key: 'daysOverdue', label: 'Days Overdue', render: (r: any) => <span className={r.daysOverdue > 90 ? 'text-red-600 font-semibold' : ''}>{r.daysOverdue}</span> },
    { key: 'escalationStage', label: 'Stage', render: (r: any) => <Badge variant={STAGE_COLOR[r.escalationStage] || 'default'}>{r.escalationStage?.replace(/_/g, ' ')}</Badge> },
    { key: 'welfareReferralStatus', label: 'Welfare', render: (r: any) => <Badge variant={r.welfareReferralStatus === 'referred' ? 'info' : 'default'}>{r.welfareReferralStatus}</Badge> },
    { key: 'distressScore', label: 'Distress', render: (r: any) => r.distressScore != null ? r.distressScore : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this defaulter record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Defaulter Records</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Defaulter Record
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Defaulter Record' : 'New Defaulter Record'}>
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
              <label className={lbl}>Overdue Amount *</label>
              <input required type="number" min={0} value={form.overdueAmount} onChange={e => setForm(f => ({ ...f, overdueAmount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Days Overdue *</label>
              <input required type="number" min={0} value={form.daysOverdue} onChange={e => setForm(f => ({ ...f, daysOverdue: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Escalation Stage *</label>
              <select required value={form.escalationStage} onChange={e => setForm(f => ({ ...f, escalationStage: e.target.value }))} className={inp}>
                {ESCALATION_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Welfare Referral</label>
              <select value={form.welfareReferralStatus} onChange={e => setForm(f => ({ ...f, welfareReferralStatus: e.target.value }))} className={inp}>
                {WELFARE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Distress Score</label>
              <input type="number" min={0} max={100} value={form.distressScore} onChange={e => setForm(f => ({ ...f, distressScore: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Resolution Date</label>
              <input type="date" value={form.resolutionDate} onChange={e => setForm(f => ({ ...f, resolutionDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Resolution Type</label>
              <select value={form.resolutionType} onChange={e => setForm(f => ({ ...f, resolutionType: e.target.value }))} className={inp}>
                <option value="">None</option>
                {RESOLUTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
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
