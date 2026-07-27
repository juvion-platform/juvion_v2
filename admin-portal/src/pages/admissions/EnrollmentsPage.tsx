import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listEnrollments, createEnrollment, updateEnrollment, listApplicants , deleteEnrollment} from '../../services/admissions';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Pencil, Plus, ExternalLink , Trash2} from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import { confirmDelete } from '../../stores/confirmStore';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { applicantId: '', studentId: '', admissionDate: '', admittedBy: '', admissionType: 'fresh' };

export default function EnrollmentsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', page, limit, search],
    queryFn: () => listEnrollments(page, limit, search),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      applicantId: row.applicantId?._id || row.applicantId || '',
      studentId: row.studentId?._id || row.studentId || '',
      admissionDate: row.admissionDate?.slice(0, 10) || '',
      admittedBy: row.admittedBy || '',
      admissionType: row.admissionType || 'fresh',
    }),
    onOpenCreate: () => setForm({ ...emptyForm, admissionDate: new Date().toISOString().slice(0, 10) }),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createEnrollment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); vem.close(); },
  });

  // PUT existed server-side; the page only ever POSTed, so records opened
  // read-only with nothing but a Close button.
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateEnrollment(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); vem.close(); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteEnrollment,
    meta: { action: 'delete' },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, studentId: form.studentId || undefined };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'admissionType', label: 'Type', render: (r: any) => <Badge variant={r.admissionType === 'fresh' ? 'info' : 'warning'}>{r.admissionType}</Badge> },
    { key: 'admittedBy', label: 'Admitted By' },
    { key: 'admissionDate', label: 'Admission Date', render: (r: any) => new Date(r.admissionDate).toLocaleDateString() },
    { key: 'createdAt', label: 'Recorded', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', sortable: false, render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit">
        <Pencil size={15} className="text-amber-500" />
      </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void confirmDelete('enrollment').then((ok) => { if (ok) deleteMut.mutate(r._id); });
          }}
          className="p-1 rounded hover:bg-red-50"
          title="Delete"
        >
          <Trash2 size={15} className="text-red-500" />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Enrollments</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Enrollment
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Enrollment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Applicant *
                  {!vem.isView && <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className={inp}>
                  <option value="">Select applicant...</option>
                  {(applicantsData?.items || []).map((a: any) => (
                    <option key={a._id} value={a._id}>{a.name || a.email || a._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Student
                  {!vem.isView && <Link to="/people" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {(studentsData?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admission Date *</label>
                <input required type="date" value={form.admissionDate} onChange={e => setForm(f => ({ ...f, admissionDate: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admitted By *</label>
                <input required value={form.admittedBy} onChange={e => setForm(f => ({ ...f, admittedBy: e.target.value }))} className={inp} placeholder="Officer name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select required value={form.admissionType} onChange={e => setForm(f => ({ ...f, admissionType: e.target.value }))} className={inp}>
                  <option value="fresh">Fresh</option>
                  <option value="lateral">Lateral Entry</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Enroll'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
