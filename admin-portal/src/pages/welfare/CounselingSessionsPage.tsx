import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCounselingSessions, createCounselingSession, updateCounselingSession, deleteCounselingSession } from '../../services/welfare';
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

const TYPES = ['academic', 'personal', 'career', 'crisis', 'follow_up'] as const;
const TYPE_COLOR: Record<string, string> = { academic: 'info', personal: 'warning', career: 'success', crisis: 'danger', follow_up: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', counselorId: '', sessionDate: '', type: 'academic', notes: '', followUpRequired: false, nextSessionDate: '' };

export default function CounselingSessionsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['counseling-sessions', page, limit, search], queryFn: () => listCounselingSessions(page, limit, undefined, search) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const students = studentsData?.items || [];
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      counselorId: row.counselorId?._id || row.counselorId || '',
      sessionDate: row.sessionDate ? row.sessionDate.slice(0, 10) : '',
      type: row.type || 'academic',
      notes: row.notes || '',
      followUpRequired: !!row.followUpRequired,
      nextSessionDate: row.nextSessionDate ? row.nextSessionDate.slice(0, 10) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createCounselingSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling-sessions'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCounselingSession(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling-sessions'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCounselingSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling-sessions'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.notes) delete payload.notes;
    if (!payload.nextSessionDate) delete payload.nextSessionDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'counselorId', label: 'Counselor', render: (r: any) => r.counselorId?.name || '\u2014' },
    { key: 'sessionDate', label: 'Date', render: (r: any) => r.sessionDate ? new Date(r.sessionDate).toLocaleDateString() : '\u2014' },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant={TYPE_COLOR[r.type] || 'default'}>{r.type}</Badge> },
    { key: 'followUpRequired', label: 'Follow-up', render: (r: any) => r.followUpRequired ? 'Yes' : 'No' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this session?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Counseling Sessions</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search counseling sessions…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Session
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No counseling sessions match “${search}”.` : 'No counseling sessions yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Session')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Counselor * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.counselorId} onChange={e => setForm(f => ({ ...f, counselorId: e.target.value }))} className={inp}>
                  <option value="">Select counselor...</option>
                  {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Session Date *</label><input required type="date" value={form.sessionDate} onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} rows={2} /></div>
              <div><label className={lbl}>Follow-up Required</label>
                <select value={String(form.followUpRequired)} onChange={e => setForm(f => ({ ...f, followUpRequired: e.target.value === 'true' }))} className={inp}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div><label className={lbl}>Next Session Date</label><input type="date" value={form.nextSessionDate} onChange={e => setForm(f => ({ ...f, nextSessionDate: e.target.value }))} className={inp} /></div>
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
