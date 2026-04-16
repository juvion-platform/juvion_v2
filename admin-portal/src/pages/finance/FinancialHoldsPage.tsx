import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFinancialHolds, createFinancialHold, updateFinancialHold, deleteFinancialHold } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const HOLD_TYPES = ['exam_debarment', 'hostel_restriction', 'transcript_hold', 'full_clearance_block'] as const;
const HOLD_STATUSES = ['active', 'released'] as const;
const HOLD_STATUS_COLOR: Record<string, string> = { active: 'danger', released: 'success' };
const HOLD_TYPE_COLOR: Record<string, string> = { exam_debarment: 'danger', hostel_restriction: 'warning', transcript_hold: 'info', full_clearance_block: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function FinancialHoldsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    defaulterRecordId: '',
    holdType: 'exam_debarment',
    holdStatus: 'active',
    effectiveDate: new Date().toISOString().slice(0, 10),
    approvedBy: '',
    releaseDate: '',
    releasedBy: '',
    releaseReason: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['financial-holds', page], queryFn: () => listFinancialHolds(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createFinancialHold, onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-holds'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFinancialHold(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-holds'] }); closeModal(); } });
  const quickUpdateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFinancialHold(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-holds'] }); } });
  const deleteMut = useMutation({ mutationFn: deleteFinancialHold, onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-holds'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', defaulterRecordId: '', holdType: 'exam_debarment', holdStatus: 'active', effectiveDate: new Date().toISOString().slice(0, 10), approvedBy: '', releaseDate: '', releasedBy: '', releaseReason: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      defaulterRecordId: row.defaulterRecordId?._id || row.defaulterRecordId || '',
      holdType: row.holdType || 'exam_debarment',
      holdStatus: row.holdStatus || 'active',
      effectiveDate: row.effectiveDate ? row.effectiveDate.slice(0, 10) : '',
      approvedBy: row.approvedBy?._id || row.approvedBy || '',
      releaseDate: row.releaseDate ? row.releaseDate.slice(0, 10) : '',
      releasedBy: row.releasedBy?._id || row.releasedBy || '',
      releaseReason: row.releaseReason || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      defaulterRecordId: form.defaulterRecordId,
      holdType: form.holdType,
      holdStatus: form.holdStatus,
      effectiveDate: form.effectiveDate,
      approvedBy: form.approvedBy,
    };
    if (form.releaseDate) payload.releaseDate = form.releaseDate;
    if (form.releasedBy) payload.releasedBy = form.releasedBy;
    if (form.releaseReason) payload.releaseReason = form.releaseReason;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function quickRelease(row: any) {
    quickUpdateMut.mutate({
      id: row._id,
      data: {
        holdStatus: 'released',
        releaseDate: new Date().toISOString().slice(0, 10),
      },
    });
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'holdType', label: 'Hold Type', render: (r: any) => <Badge variant={HOLD_TYPE_COLOR[r.holdType] || 'default'}>{r.holdType?.replace(/_/g, ' ')}</Badge> },
    { key: 'holdStatus', label: 'Status', render: (r: any) => <Badge variant={HOLD_STATUS_COLOR[r.holdStatus] || 'default'}>{r.holdStatus}</Badge> },
    { key: 'effectiveDate', label: 'Effective', render: (r: any) => r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '\u2014' },
    { key: 'releaseDate', label: 'Released', render: (r: any) => r.releaseDate ? new Date(r.releaseDate).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap gap-1 justify-end">
        {r.holdStatus === 'active' && (
          <button onClick={(e) => { e.stopPropagation(); quickRelease(r); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            Release
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this hold?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Financial Holds</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Hold
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Financial Hold' : 'New Financial Hold'}>
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
              <label className={lbl}>Defaulter Record ID *</label>
              <input required value={form.defaulterRecordId} onChange={e => setForm(f => ({ ...f, defaulterRecordId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Hold Type *</label>
              <select required value={form.holdType} onChange={e => setForm(f => ({ ...f, holdType: e.target.value }))} className={inp}>
                {HOLD_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.holdStatus} onChange={e => setForm(f => ({ ...f, holdStatus: e.target.value }))} className={inp}>
                {HOLD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Effective Date *</label>
              <input required type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Approved By *</label>
              <input required value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))} className={inp} placeholder="Person ObjectId" />
            </div>
            <div>
              <label className={lbl}>Release Date</label>
              <input type="date" value={form.releaseDate} onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Released By</label>
              <input value={form.releasedBy} onChange={e => setForm(f => ({ ...f, releasedBy: e.target.value }))} className={inp} placeholder="Person ObjectId" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Release Reason</label>
              <input value={form.releaseReason} onChange={e => setForm(f => ({ ...f, releaseReason: e.target.value }))} className={inp} />
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
