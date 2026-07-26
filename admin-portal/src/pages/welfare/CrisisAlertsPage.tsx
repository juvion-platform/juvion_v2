import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCrisisAlerts, createCrisisAlert, updateCrisisAlert, deleteCrisisAlert } from '../../services/welfare';
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

const TYPES = ['mental_health', 'ragging', 'harassment', 'medical_emergency', 'substance_abuse', 'other'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const STATUSES = ['reported', 'acknowledged', 'in_progress', 'resolved', 'escalated'] as const;
const SEV_COLOR: Record<string, string> = { low: 'default', medium: 'warning', high: 'danger', critical: 'danger' };
const STATUS_COLOR: Record<string, string> = { reported: 'default', acknowledged: 'info', in_progress: 'warning', resolved: 'success', escalated: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { reportedBy: '', studentId: '', type: 'other', severity: 'medium', description: '', status: 'reported', assignedTo: '', resolution: '' };

export default function CrisisAlertsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['crisis-alerts', page, limit, search], queryFn: () => listCrisisAlerts(page, limit, undefined, search) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const students = studentsData?.items || [];
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      reportedBy: row.reportedBy?._id || row.reportedBy || '',
      studentId: row.studentId?._id || row.studentId || '',
      type: row.type || 'other',
      severity: row.severity || 'medium',
      description: row.description || '',
      status: row.status || 'reported',
      assignedTo: row.assignedTo?._id || row.assignedTo || '',
      resolution: row.resolution || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createCrisisAlert, onSuccess: () => { qc.invalidateQueries({ queryKey: ['crisis-alerts'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCrisisAlert(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['crisis-alerts'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCrisisAlert, onSuccess: () => { qc.invalidateQueries({ queryKey: ['crisis-alerts'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.studentId) delete payload.studentId;
    if (!payload.assignedTo) delete payload.assignedTo;
    if (!payload.resolution) delete payload.resolution;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={SEV_COLOR[r.severity] || 'default'}>{r.severity}</Badge> },
    { key: 'description', label: 'Description', render: (r: any) => <span className="truncate max-w-[200px] inline-block">{r.description}</span> },
    { key: 'reportedBy', label: 'Reported By', render: (r: any) => r.reportedBy?.name || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this alert?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Crisis Alerts</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search crisis alerts…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Alert
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Crisis Alert')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Reported By * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} className={inp}>
                  <option value="">Select person...</option>
                  {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Student (optional) {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Severity *</label>
                <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inp}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Description *</label><textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Assigned To</label>
                <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Resolution</label><textarea value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} className={inp} rows={2} /></div>
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
