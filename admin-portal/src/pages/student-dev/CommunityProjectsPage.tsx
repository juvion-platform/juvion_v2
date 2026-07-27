import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCommunityProjects, createCommunityProject, updateCommunityProject, deleteCommunityProject } from '../../services/student-dev';
import { listStudents, listFaculty } from '../../services/people';
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

const STATUSES = ['proposed', 'approved', 'ongoing', 'completed'] as const;
const STATUS_COLOR: Record<string, string> = { proposed: 'default', approved: 'info', ongoing: 'warning', completed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { title: '', description: '', leadStudentId: '', facultyMentorId: '', startDate: '', endDate: '', beneficiaries: '', status: 'proposed' };

export default function CommunityProjectsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      title: row.title || '',
      description: row.description || '',
      leadStudentId: row.leadStudentId?._id || row.leadStudentId || '',
      facultyMentorId: row.facultyMentorId?._id || row.facultyMentorId || '',
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      beneficiaries: row.beneficiaries || '',
      status: row.status || 'proposed',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-community-projects', page, limit, search], queryFn: () => listCommunityProjects(page, limit, undefined, search) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: faculty } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });

  const createMut = useMutation({ mutationFn: createCommunityProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-community-projects'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCommunityProject(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-community-projects'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCommunityProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-community-projects'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.description) delete payload.description;
    if (!payload.facultyMentorId) delete payload.facultyMentorId;
    if (!payload.endDate) delete payload.endDate;
    if (!payload.beneficiaries) delete payload.beneficiaries;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'leadStudentId', label: 'Lead Student', render: (r: any) => r.leadStudentId?.personId?.name || r.leadStudentId?.rollNumber || '\u2014' },
    { key: 'facultyMentorId', label: 'Faculty Mentor', render: (r: any) => r.facultyMentorId?.personId?.name || r.facultyMentorId?.employeeCode || '\u2014' },
    { key: 'startDate', label: 'Start', render: (r: any) => fmtDate(r.startDate) },
    { key: 'endDate', label: 'End', render: (r: any) => fmtDate(r.endDate) },
    { key: 'beneficiaries', label: 'Beneficiaries', render: (r: any) => r.beneficiaries || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this project?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Community Projects</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search community projects…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Project
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No community projects match “${search}”.` : 'No community projects yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Community Project')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Lead Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.leadStudentId} onChange={e => setForm(f => ({ ...f, leadStudentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Faculty Mentor {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.facultyMentorId} onChange={e => setForm(f => ({ ...f, facultyMentorId: e.target.value }))} className={inp}>
                  <option value="">Select faculty</option>
                  {(faculty?.items || []).map((fac: any) => (
                    <option key={fac._id} value={fac._id}>{fac.person?.name || fac.employeeCode || fac._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>End Date</label><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Beneficiaries</label><input value={form.beneficiaries} onChange={e => setForm(f => ({ ...f, beneficiaries: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
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
