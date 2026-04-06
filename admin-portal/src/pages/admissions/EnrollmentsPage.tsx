import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listEnrollments, createEnrollment, listApplicants } from '../../services/admissions';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, ExternalLink } from 'lucide-react';

const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function EnrollmentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ applicantId: '', studentId: '', admissionDate: '', admittedBy: '', admissionType: 'fresh' });

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', page],
    queryFn: () => listEnrollments(page, 20),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({
    mutationFn: createEnrollment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); setModalOpen(false); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({ ...form, studentId: form.studentId || undefined });
  }

  const columns = [
    { key: 'admissionType', label: 'Type', render: (r: any) => <Badge variant={r.admissionType === 'fresh' ? 'info' : 'warning'}>{r.admissionType}</Badge> },
    { key: 'admittedBy', label: 'Admitted By' },
    { key: 'admissionDate', label: 'Admission Date', render: (r: any) => new Date(r.admissionDate).toLocaleDateString() },
    { key: 'createdAt', label: 'Recorded', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Enrollments</h2>
        <button onClick={() => { setForm({ applicantId: '', studentId: '', admissionDate: new Date().toISOString().slice(0, 10), admittedBy: '', admissionType: 'fresh' }); setModalOpen(true); }} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Enrollment
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Enrollment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Applicant *
                <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>
              </label>
              <select required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select applicant...</option>
                {(applicantsData?.items || []).map((a: any) => (
                  <option key={a._id} value={a._id}>{a.name || a.email || a._id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Student
                <Link to="/people" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>
              </label>
              <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">None</option>
                {(studentsData?.items || []).map((s: any) => (
                  <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admission Date *</label>
              <input required type="date" value={form.admissionDate} onChange={e => setForm(f => ({ ...f, admissionDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admitted By *</label>
              <input required value={form.admittedBy} onChange={e => setForm(f => ({ ...f, admittedBy: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Officer name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select required value={form.admissionType} onChange={e => setForm(f => ({ ...f, admissionType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="fresh">Fresh</option>
                <option value="lateral">Lateral Entry</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending ? 'Saving...' : 'Enroll'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
