import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEntrepreneurProfiles, createEntrepreneurProfile, updateEntrepreneurProfile, deleteEntrepreneurProfile } from '../../services/placement';
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

const STAGES = ['ideation', 'prototype', 'launched', 'scaled'] as const;
const INCUBATION_STATUSES = ['not_applied', 'applied', 'accepted', 'graduated'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', ventureIdea: '', stage: 'ideation', mentorId: '', incubationStatus: 'not_applied' };

export default function EntrepreneurProfilesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['entrepreneur-profiles', page, limit, search], queryFn: () => listEntrepreneurProfiles(page, limit, search) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });
  const { data: faculty } = useQuery({ queryKey: ['faculty-all'], queryFn: () => listFaculty(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      ventureIdea: row.ventureIdea || '',
      stage: row.stage || 'ideation',
      mentorId: row.mentorId?._id || row.mentorId || '',
      incubationStatus: row.incubationStatus || 'not_applied',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createEntrepreneurProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ['entrepreneur-profiles'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEntrepreneurProfile(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['entrepreneur-profiles'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteEntrepreneurProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ['entrepreneur-profiles'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.mentorId) delete payload.mentorId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const stageVariant: Record<string, string> = { ideation: 'default', prototype: 'info', launched: 'success', scaled: 'success' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '--' },
    { key: 'ventureIdea', label: 'Venture Idea', render: (r: any) => <span className="font-medium text-navy">{r.ventureIdea}</span> },
    { key: 'stage', label: 'Stage', render: (r: any) => <Badge variant={stageVariant[r.stage] || 'default'}>{r.stage}</Badge> },
    { key: 'mentorId', label: 'Mentor', render: (r: any) => r.mentorId?.personId?.name || '--' },
    { key: 'incubationStatus', label: 'Incubation', render: (r: any) => <Badge variant="info">{r.incubationStatus}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this profile?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Entrepreneur Profiles</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search entrepreneur profiles…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Profile</button>
      </div>
      </div>
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No entrepreneur profiles match “${search}”.` : 'No entrepreneur profiles yet.'}
      />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Entrepreneur Profile')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people/students" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Venture Idea *</label><input required value={form.ventureIdea} onChange={e => setForm(f => ({ ...f, ventureIdea: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Stage</label>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className={inp}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Mentor {!vem.isView && <Link to="/people/faculty" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.mentorId} onChange={e => setForm(f => ({ ...f, mentorId: e.target.value }))} className={inp}>
                  <option value="">Select mentor (optional)</option>
                  {(faculty?.items || []).map((f: any) => <option key={f._id} value={f._id}>{f.person?.name || f.employeeCode || f._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Incubation Status</label>
                <select value={form.incubationStatus} onChange={e => setForm(f => ({ ...f, incubationStatus: e.target.value }))} className={inp}>
                  {INCUBATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
