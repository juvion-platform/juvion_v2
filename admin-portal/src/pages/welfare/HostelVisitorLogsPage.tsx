import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listHostelVisitorLogs, createHostelVisitorLog, updateHostelVisitorLog, deleteHostelVisitorLog } from '../../services/welfare';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';
import { rangeError } from '../../lib/validation';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', visitorName: '', visitorRelation: '', visitorPhone: '', inTime: '', outTime: '', purpose: '' };

export default function HostelVisitorLogsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['hostel-visitor-logs', page, limit, search], queryFn: () => listHostelVisitorLogs(page, limit, undefined, search) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const students = studentsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      visitorName: row.visitorName || '',
      visitorRelation: row.visitorRelation || '',
      visitorPhone: row.visitorPhone || '',
      inTime: row.inTime ? row.inTime.slice(0, 16) : '',
      outTime: row.outTime ? row.outTime.slice(0, 16) : '',
      purpose: row.purpose || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createHostelVisitorLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-visitor-logs'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateHostelVisitorLog(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-visitor-logs'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteHostelVisitorLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-visitor-logs'] }); } });
  const timeError = rangeError(form.inTime, form.outTime, { startLabel: 'in-time', endLabel: 'out-time' });


  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (timeError) return;
    const payload: any = { ...form };
    if (!payload.inTime) delete payload.inTime;
    if (!payload.outTime) delete payload.outTime;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'visitorName', label: 'Visitor' },
    { key: 'visitorRelation', label: 'Relation' },
    { key: 'visitorPhone', label: 'Phone' },
    { key: 'inTime', label: 'In', render: (r: any) => r.inTime ? new Date(r.inTime).toLocaleString() : '\u2014' },
    { key: 'outTime', label: 'Out', render: (r: any) => r.outTime ? new Date(r.outTime).toLocaleString() : '\u2014' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this log?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Hostel Visitor Logs</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search hostel visitor logs…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Entry
        </button>
      </div>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Visitor Log')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Visitor Name *</label><input required value={form.visitorName} onChange={e => setForm(f => ({ ...f, visitorName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Relation *</label><input required value={form.visitorRelation} onChange={e => setForm(f => ({ ...f, visitorRelation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Phone *</label><input required value={form.visitorPhone} onChange={e => setForm(f => ({ ...f, visitorPhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>In Time</label><input type="datetime-local" value={form.inTime} onChange={e => setForm(f => ({ ...f, inTime: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Out Time</label><input type="datetime-local" value={form.outTime} onChange={e => setForm(f => ({ ...f, outTime: e.target.value }))} className={inp} /></div>
              {timeError && <p className="col-span-2 -mt-2 text-sm text-red-600" role="alert">{timeError}</p>}
              <div className="col-span-2"><label className={lbl}>Purpose *</label><input required value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={inp} /></div>
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
              <button type="submit" disabled={saving || Boolean(timeError)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
