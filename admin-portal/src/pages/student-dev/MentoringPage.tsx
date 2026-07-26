import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMentoringSessions, createMentoringSession, updateMentoringSession, deleteMentoringSession } from '../../services/student-dev';
import { listStudents, listFaculty } from '../../services/people';
import { listAcademicYears } from '../../services/academics';
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

const STATUSES = ['active', 'completed'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', completed: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { mentorId: '', menteeId: '', academicYearId: '', meetingDate: '', notes: '', status: 'active' };

export default function MentoringPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      mentorId: row.mentorId?._id || row.mentorId || '',
      menteeId: row.menteeId?._id || row.menteeId || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      meetingDate: row.meetingDate ? row.meetingDate.slice(0, 10) : '',
      notes: row.notes || '',
      status: row.status || 'active',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-mentoring', page, limit, search], queryFn: () => listMentoringSessions(page, limit, undefined, search) });
  const { data: faculty } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: academicYears } = useQuery({ queryKey: ['academic-years', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const createMut = useMutation({ mutationFn: createMentoringSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-mentoring'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMentoringSession(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-mentoring'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteMentoringSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-mentoring'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.meetingDate) delete payload.meetingDate;
    if (!payload.notes) delete payload.notes;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'mentorId', label: 'Mentor', render: (r: any) => <span className="font-medium text-navy">{r.mentorId?.personId?.name || r.mentorId?.employeeCode || '\u2014'}</span> },
    { key: 'menteeId', label: 'Mentee', render: (r: any) => r.menteeId?.personId?.name || r.menteeId?.rollNumber || '\u2014' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'meetingDate', label: 'Meeting Date', render: (r: any) => fmtDate(r.meetingDate) },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this mentoring session?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Mentoring</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search mentoring…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Session
        </button>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Mentoring Session')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Mentor (Faculty) * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.mentorId} onChange={e => setForm(f => ({ ...f, mentorId: e.target.value }))} className={inp}>
                  <option value="">Select faculty</option>
                  {(faculty?.items || []).map((f: any) => (
                    <option key={f._id} value={f._id}>{f.person?.name || f.employeeCode || f._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Mentee (Student) * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.menteeId} onChange={e => setForm(f => ({ ...f, menteeId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {(academicYears?.items || []).map((ay: any) => (
                    <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Meeting Date</label><input type="date" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} rows={3} /></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                {saving ? 'Saving\u2026' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
