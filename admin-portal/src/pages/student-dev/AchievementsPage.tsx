import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAchievements, createAchievement, updateAchievement, deleteAchievement } from '../../services/student-dev';
import { listStudents, listPersons } from '../../services/people';
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

const CATEGORIES = ['academic', 'technical', 'cultural', 'sports', 'social', 'entrepreneurship', 'other'] as const;
const LEVELS = ['college', 'university', 'state', 'national', 'international'] as const;
const LEVEL_COLOR: Record<string, string> = { college: 'default', university: 'info', state: 'warning', national: 'success', international: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', title: '', category: 'academic', level: 'college', date: '', description: '', certificateUrl: '', verifiedBy: '' };

export default function AchievementsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      title: row.title || '',
      category: row.category || 'academic',
      level: row.level || 'college',
      date: row.date ? row.date.slice(0, 10) : '',
      description: row.description || '',
      certificateUrl: row.certificateUrl || '',
      verifiedBy: row.verifiedBy?._id || row.verifiedBy || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-achievements', page, limit, search], queryFn: () => listAchievements(page, limit, undefined, undefined, search) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const createMut = useMutation({ mutationFn: createAchievement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-achievements'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAchievement(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-achievements'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAchievement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-achievements'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.description) delete payload.description;
    if (!payload.certificateUrl) delete payload.certificateUrl;
    if (!payload.verifiedBy) delete payload.verifiedBy;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant="info">{r.category}</Badge> },
    { key: 'level', label: 'Level', render: (r: any) => <Badge variant={(LEVEL_COLOR[r.level] || 'default') as any}>{r.level}</Badge> },
    { key: 'date', label: 'Date', render: (r: any) => fmtDate(r.date) },
    { key: 'verifiedBy', label: 'Verified By', render: (r: any) => r.verifiedBy?.name || '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this achievement?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Achievements</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search achievements…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Achievement
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No achievements match “${search}”.` : 'No achievements yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Achievement')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Category *</label>
                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Level *</label>
                <select required value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inp}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Verified By {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.verifiedBy} onChange={e => setForm(f => ({ ...f, verifiedBy: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p._id}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
              <div className="col-span-2"><label className={lbl}>Certificate URL</label><input value={form.certificateUrl} onChange={e => setForm(f => ({ ...f, certificateUrl: e.target.value }))} className={inp} /></div>
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
