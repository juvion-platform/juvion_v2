import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listScholarshipEligibility, createScholarshipEligibility, updateScholarshipEligibility, deleteScholarshipEligibility } from '../../services/finance';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['pending', 'eligible', 'ineligible', 'expired'] as const;
const STATUS_COLOR: Record<string, string> = { pending: 'warning', eligible: 'success', ineligible: 'danger', expired: 'default' };
const VERIFICATION_METHODS = ['auto', 'manual'] as const;
const DOC_STATUSES = ['complete', 'incomplete', 'expired'] as const;
const DOC_STATUS_COLOR: Record<string, string> = { complete: 'success', incomplete: 'warning', expired: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ScholarshipEligibilityPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    schemeCode: '',
    academicYearId: '',
    status: 'pending',
    verificationMethod: 'auto',
    documentsStatus: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['scholarship-eligibility', page], queryFn: () => listScholarshipEligibility(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-lookup'], queryFn: () => listStudents(1, 100) });
  const students: any[] = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createScholarshipEligibility, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-eligibility'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateScholarshipEligibility(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-eligibility'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteScholarshipEligibility, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-eligibility'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', schemeCode: '', academicYearId: '', status: 'pending', verificationMethod: 'auto', documentsStatus: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      schemeCode: row.schemeCode || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      status: row.status || 'pending',
      verificationMethod: row.verificationMethod || 'auto',
      documentsStatus: row.documentsStatus || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      schemeCode: form.schemeCode,
      academicYearId: form.academicYearId,
      status: form.status,
      verificationMethod: form.verificationMethod,
    };
    if (form.documentsStatus) payload.documentsStatus = form.documentsStatus;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'schemeCode', label: 'Scheme Code', render: (r: any) => <span className="font-medium text-navy">{r.schemeCode}</span> },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'verificationMethod', label: 'Verification', render: (r: any) => <Badge variant="info">{r.verificationMethod}</Badge> },
    { key: 'documentsStatus', label: 'Documents', render: (r: any) => r.documentsStatus ? <Badge variant={DOC_STATUS_COLOR[r.documentsStatus] || 'default'}>{r.documentsStatus}</Badge> : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this eligibility record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Scholarship Eligibility</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Eligibility
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Eligibility' : 'New Eligibility'}>
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
              <label className={lbl}>Scheme Code *</label>
              <input required value={form.schemeCode} onChange={e => setForm(f => ({ ...f, schemeCode: e.target.value }))} className={inp} placeholder="e.g. TS-EPASS" />
            </div>
            <div>
              <label className={lbl}>Academic Year ID *</label>
              <input required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Verification Method</label>
              <select value={form.verificationMethod} onChange={e => setForm(f => ({ ...f, verificationMethod: e.target.value }))} className={inp}>
                {VERIFICATION_METHODS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Documents Status</label>
              <select value={form.documentsStatus} onChange={e => setForm(f => ({ ...f, documentsStatus: e.target.value }))} className={inp}>
                <option value="">None</option>
                {DOC_STATUSES.map(d => <option key={d} value={d}>{d}</option>)}
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
