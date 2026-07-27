import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listStudentProjects, createStudentProject, updateStudentProject, deleteStudentProject } from '../../services/student-dev';
import { listFaculty } from '../../services/people';
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

const TYPES = ['mini_project', 'major_project', 'industry_project', 'research_project'] as const;
const STATUSES = ['proposed', 'in_progress', 'completed', 'presented'] as const;
const STATUS_COLOR: Record<string, string> = { proposed: 'default', in_progress: 'warning', completed: 'success', presented: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { title: '', type: 'mini_project', teamMembers: '', guideId: '', semester: '', description: '', technologies: '', repoUrl: '', status: 'proposed', grade: '' };

export default function StudentProjectsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      title: row.title || '',
      type: row.type || 'mini_project',
      teamMembers: Array.isArray(row.teamMembers) ? row.teamMembers.map((m: any) => m?._id || m).join(', ') : '',
      guideId: row.guideId?._id || row.guideId || '',
      semester: row.semester != null ? String(row.semester) : '',
      description: row.description || '',
      technologies: Array.isArray(row.technologies) ? row.technologies.join(', ') : '',
      repoUrl: row.repoUrl || '',
      status: row.status || 'proposed',
      grade: row.grade || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-student-projects', page, limit, search], queryFn: () => listStudentProjects(page, limit, undefined, undefined, search) });
  const { data: faculty } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });

  const createMut = useMutation({ mutationFn: createStudentProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-student-projects'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateStudentProject(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-student-projects'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteStudentProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-student-projects'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      title: form.title,
      type: form.type,
      semester: Number(form.semester),
      status: form.status,
    };
    if (form.teamMembers) payload.teamMembers = form.teamMembers.split(',').map(s => s.trim()).filter(Boolean);
    if (form.guideId) payload.guideId = form.guideId;
    if (form.description) payload.description = form.description;
    if (form.technologies) payload.technologies = form.technologies.split(',').map(s => s.trim()).filter(Boolean);
    if (form.repoUrl) payload.repoUrl = form.repoUrl;
    if (form.grade) payload.grade = form.grade;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'guideId', label: 'Guide', render: (r: any) => r.guideId?.personId?.name || r.guideId?.employeeCode || '\u2014' },
    { key: 'semester', label: 'Semester', render: (r: any) => r.semester },
    { key: 'technologies', label: 'Technologies', render: (r: any) => (r.technologies || []).join(', ') || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'grade', label: 'Grade', render: (r: any) => r.grade || '\u2014' },
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
        <h2 className="text-xl font-bold text-navy">Student Projects</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student projects…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Project
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Project')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Guide (Faculty) {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.guideId} onChange={e => setForm(f => ({ ...f, guideId: e.target.value }))} className={inp}>
                  <option value="">Select faculty</option>
                  {(faculty?.items || []).map((fac: any) => (
                    <option key={fac._id} value={fac._id}>{fac.person?.name || fac.employeeCode || fac._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Semester *</label><input required type="number" min="1" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Team Members (comma-separated IDs)</label><input value={form.teamMembers} onChange={e => setForm(f => ({ ...f, teamMembers: e.target.value }))} className={inp} placeholder="student_id_1, student_id_2" /></div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
              <div className="col-span-2"><label className={lbl}>Technologies (comma-separated)</label><input value={form.technologies} onChange={e => setForm(f => ({ ...f, technologies: e.target.value }))} className={inp} placeholder="React, Node.js, MongoDB" /></div>
              <div><label className={lbl}>Repo URL</label><input value={form.repoUrl} onChange={e => setForm(f => ({ ...f, repoUrl: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Grade</label><input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className={inp} /></div>
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
