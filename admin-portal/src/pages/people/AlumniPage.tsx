import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { listAlumni, createAlumniRecord, listStudents } from '../../services/people';
import { listProgrammes, listBranches } from '../../services/academics';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const manageLink = 'text-xs text-primary-600 hover:underline';

const ENGAGEMENT_COLOR: Record<string, string> = {
  active: 'success', inactive: 'default', revoked: 'danger',
};

const CLASS_COLOR: Record<string, string> = {
  first_class_distinction: 'purple', first_class: 'success', second_class: 'warning', pass: 'default',
};

const CONVOCATION_COLOR: Record<string, string> = {
  pending: 'warning', attended: 'success', absentia: 'default', direct_collection: 'info',
};

const CLASSES = ['first_class_distinction', 'first_class', 'second_class', 'pass'] as const;

const emptyForm = {
  personId: '',
  studentId: '',
  programmeId: '',
  branchId: '',
  batchId: '',
  regulationId: '',
  graduationDate: '',
  degreeAwarded: '',
  finalCgpa: '',
  classObtained: 'first_class' as string,
};

export default function AlumniPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['alumni', page, filterProgramme],
    queryFn: () => listAlumni(page, 20, filterProgramme || undefined),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-ref', 'all'],
    queryFn: () => listStudents(1, 200),
  });
  const studentOptions = studentsData?.items || [];

  const { data: programmesData } = useQuery({
    queryKey: ['programmes-ref'],
    queryFn: () => listProgrammes(1, 100),
  });
  const programmeOptions = programmesData?.items || [];

  const { data: branchesData } = useQuery({
    queryKey: ['branches-ref'],
    queryFn: () => listBranches(1, 100),
  });
  const branchOptions = branchesData?.items || [];

  const createMut = useMutation({
    mutationFn: createAlumniRecord,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni'] }); closeModal(); },
  });

  function closeModal() { setOpen(false); setForm(emptyForm); }

  function openCreate() { setForm(emptyForm); setOpen(true); }

  function handleStudentSelect(studentId: string) {
    const student = studentOptions.find((s: any) => s._id === studentId);
    setForm(f => ({
      ...f,
      studentId,
      personId: student?.personId?._id || student?.person?._id || '',
      programmeId: student?.programmeId?._id || student?.programmeId || f.programmeId,
      branchId: student?.branchId?._id || student?.branchId || f.branchId,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      ...form,
      finalCgpa: parseFloat(form.finalCgpa),
    };
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === undefined) delete payload[key];
    });
    createMut.mutate(payload);
  }

  const saving = createMut.isPending;
  const error = createMut.error;

  const columns = [
    { key: 'person', label: 'Name', render: (r: any) => {
      const name = r.personId?.name || r.person?.name || '';
      return <span className="font-medium">{name || '—'}</span>;
    }},
    { key: 'programme', label: 'Programme', render: (r: any) => r.programmeId?.name || '—' },
    { key: 'branch', label: 'Branch', render: (r: any) => r.branchId?.name || '—' },
    { key: 'graduationDate', label: 'Graduation', render: (r: any) => r.graduationDate ? new Date(r.graduationDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—' },
    { key: 'degreeAwarded', label: 'Degree', render: (r: any) => r.degreeAwarded || '—' },
    { key: 'finalCgpa', label: 'CGPA', render: (r: any) => r.finalCgpa != null ? r.finalCgpa.toFixed(2) : '—' },
    { key: 'classObtained', label: 'Class', render: (r: any) => (
      <Badge variant={CLASS_COLOR[r.classObtained] || 'default'}>{r.classObtained?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'convocationStatus', label: 'Convocation', render: (r: any) => (
      <Badge variant={CONVOCATION_COLOR[r.convocationStatus] || 'default'}>{r.convocationStatus?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'engagementStatus', label: 'Status', render: (r: any) => (
      <Badge variant={ENGAGEMENT_COLOR[r.engagementStatus] || 'default'}>{r.engagementStatus}</Badge>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Alumni</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48" />
          </div>
          <select value={filterProgramme} onChange={e => { setFilterProgramme(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Programmes</option>
            {programmeOptions.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Alumni
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={open} onClose={closeModal} title="Add Alumni Record" widthClass="max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Student Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={lbl}>Student *</label>
                  <Link to="/people/students" target="_blank" className={manageLink}>+ Manage</Link>
                </div>
                <select required value={form.studentId} onChange={e => handleStudentSelect(e.target.value)} className={inp}>
                  <option value="">Select student...</option>
                  {studentOptions.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.personId?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Person ID *</label>
                <input required value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp} placeholder="Auto-filled from student" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={lbl}>Programme *</label>
                  <Link to="/academics/programmes" target="_blank" className={manageLink}>+ Manage</Link>
                </div>
                <select required value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select programme...</option>
                  {programmeOptions.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={lbl}>Branch *</label>
                  <Link to="/academics/branches" target="_blank" className={manageLink}>+ Manage</Link>
                </div>
                <select required value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                  <option value="">Select branch...</option>
                  {branchOptions.map((b: any) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Academic Achievement</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Graduation Date *</label>
                <input type="date" required value={form.graduationDate} onChange={e => setForm(f => ({ ...f, graduationDate: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Degree Awarded *</label>
                <input required value={form.degreeAwarded} onChange={e => setForm(f => ({ ...f, degreeAwarded: e.target.value }))} className={inp} placeholder="e.g. B.Tech" />
              </div>
              <div>
                <label className={lbl}>Final CGPA *</label>
                <input type="number" step="0.01" min="0" max="10" required value={form.finalCgpa} onChange={e => setForm(f => ({ ...f, finalCgpa: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Class Obtained *</label>
                <select required value={form.classObtained} onChange={e => setForm(f => ({ ...f, classObtained: e.target.value }))} className={inp}>
                  {CLASSES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Alumni Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
