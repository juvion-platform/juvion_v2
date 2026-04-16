import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listScholarshipClaims, createScholarshipClaim, updateScholarshipClaim, deleteScholarshipClaim } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['submitted', 'under_review', 'approved', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { submitted: 'info', under_review: 'warning', approved: 'success', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ScholarshipClaimsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    scholarshipEligibilityId: '',
    studentId: '',
    schemeCode: '',
    academicYearId: '',
    claimAmount: '',
    portalReference: '',
    status: 'submitted',
    rejectionReason: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['scholarship-claims', page], queryFn: () => listScholarshipClaims(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createScholarshipClaim, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-claims'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateScholarshipClaim(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-claims'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteScholarshipClaim, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-claims'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ scholarshipEligibilityId: '', studentId: '', schemeCode: '', academicYearId: '', claimAmount: '', portalReference: '', status: 'submitted', rejectionReason: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      scholarshipEligibilityId: row.scholarshipEligibilityId?._id || row.scholarshipEligibilityId || '',
      studentId: row.studentId?._id || row.studentId || '',
      schemeCode: row.schemeCode || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      claimAmount: String(row.claimAmount || ''),
      portalReference: row.portalReference || '',
      status: row.status || 'submitted',
      rejectionReason: row.rejectionReason || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      scholarshipEligibilityId: form.scholarshipEligibilityId,
      studentId: form.studentId,
      schemeCode: form.schemeCode,
      academicYearId: form.academicYearId,
      claimAmount: Number(form.claimAmount),
      status: form.status,
    };
    if (form.portalReference) payload.portalReference = form.portalReference;
    if (form.rejectionReason) payload.rejectionReason = form.rejectionReason;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'schemeCode', label: 'Scheme Code', render: (r: any) => <span className="font-medium text-navy">{r.schemeCode}</span> },
    { key: 'claimAmount', label: 'Claim Amount', render: (r: any) => `\u20B9${Number(r.claimAmount).toLocaleString('en-IN')}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status?.replace('_', ' ')}</Badge> },
    { key: 'submittedAt', label: 'Submitted', render: (r: any) => r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '\u2014' },
    { key: 'portalReference', label: 'Portal Ref', render: (r: any) => r.portalReference || '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this claim?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Scholarship Claims</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Claim
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Claim' : 'New Claim'}>
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
              <label className={lbl}>Eligibility ID *</label>
              <input required value={form.scholarshipEligibilityId} onChange={e => setForm(f => ({ ...f, scholarshipEligibilityId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Scheme Code *</label>
              <input required value={form.schemeCode} onChange={e => setForm(f => ({ ...f, schemeCode: e.target.value }))} className={inp} placeholder="e.g. TS-EPASS" />
            </div>
            <div>
              <label className={lbl}>Academic Year ID *</label>
              <input required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Claim Amount *</label>
              <input required type="number" min={0} value={form.claimAmount} onChange={e => setForm(f => ({ ...f, claimAmount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Portal Reference</label>
              <input value={form.portalReference} onChange={e => setForm(f => ({ ...f, portalReference: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Rejection Reason</label>
              <input value={form.rejectionReason} onChange={e => setForm(f => ({ ...f, rejectionReason: e.target.value }))} className={inp} />
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
