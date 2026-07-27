import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listExamRegistrations, createExamRegistration, updateExamRegistration, deleteExamRegistration, listSemesters, listCourseOfferings } from '../../services/academics';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const EXAM_TYPES = ['regular', 'supplementary', 'improvement'] as const;
const STATUSES = ['registered', 'approved', 'rejected', 'appeared', 'absent'] as const;
const STATUS_COLOR: Record<string, string> = { registered: 'default', approved: 'success', rejected: 'danger', appeared: 'info', absent: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', courseOfferingId: '', semesterId: '', examType: 'regular', isEligible: true, status: 'registered' };

export default function ExamRegistrationsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['exam-registrations', page, limit, search], queryFn: () => listExamRegistrations(page, limit, undefined, search) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: offeringsData } = useQuery({ queryKey: ['offerings', 1, 200], queryFn: () => listCourseOfferings(1, 200) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });
  const students = studentsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      courseOfferingId: row.courseOfferingId?._id || row.courseOfferingId || '',
      semesterId: row.semesterId?._id || row.semesterId || '',
      examType: row.examType,
      isEligible: row.isEligible ?? true,
      status: row.status || 'registered',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createExamRegistration, onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-registrations'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateExamRegistration(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-registrations'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteExamRegistration, onSuccess: () => qc.invalidateQueries({ queryKey: ['exam-registrations'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: form });
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{typeof r.studentId === 'object' ? r.studentId.personId?.name || r.studentId.rollNumber || r.studentId._id : r.studentId}</span> },
    { key: 'courseOfferingId', label: 'Course', render: (r: any) => {
      if (typeof r.courseOfferingId === 'object' && r.courseOfferingId?.courseId) {
        const c = r.courseOfferingId.courseId;
        return typeof c === 'object' ? c.code : c;
      }
      return r.courseOfferingId;
    }},
    { key: 'examType', label: 'Type', render: (r: any) => <Badge variant="info">{r.examType}</Badge> },
    { key: 'isEligible', label: 'Eligible', render: (r: any) => r.isEligible ? <Badge variant="success">Yes</Badge> : <Badge variant="danger">No</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Exam Registrations</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search exam registrations…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Registration</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Exam Registration')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Semester *</label>
                <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Course Offering *</label>
                <select required value={form.courseOfferingId} onChange={e => setForm(f => ({ ...f, courseOfferingId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {offeringsData?.items?.map((o: any) => <option key={o._id} value={o._id}>{typeof o.courseId === 'object' ? `${o.courseId.code} — ${o.courseId.name}` : o._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Exam Type *</label>
                <select required value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} className={inp}>
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isEligible} onChange={e => setForm(f => ({ ...f, isEligible: e.target.checked }))} /> Is Eligible</label></div>
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
