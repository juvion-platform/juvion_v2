import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAntiRaggingComplaints, createAntiRaggingComplaint, updateAntiRaggingComplaint, deleteAntiRaggingComplaint } from '../../services/welfare';
import { listStudents, listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const SEVERITIES = ['minor', 'major', 'severe'] as const;
const STATUSES = ['filed', 'investigating', 'action_taken', 'closed'] as const;
const SEV_COLOR: Record<string, string> = { minor: 'default', major: 'warning', severe: 'danger' };
const STATUS_COLOR: Record<string, string> = { filed: 'default', investigating: 'warning', action_taken: 'info', closed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { complainantId: '', isAnonymous: false, accusedIds: [] as string[], description: '', incidentDate: '', severity: 'minor', status: 'filed', committeeRemarks: '', actionTaken: '' };

export default function AntiRaggingComplaintsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['anti-ragging-complaints', page], queryFn: () => listAntiRaggingComplaints(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const students = studentsData?.items || [];
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      complainantId: row.complainantId?._id || row.complainantId || '',
      isAnonymous: !!row.isAnonymous,
      accusedIds: (row.accusedIds || []).map((a: any) => a._id || a),
      description: row.description || '',
      incidentDate: row.incidentDate ? row.incidentDate.slice(0, 10) : '',
      severity: row.severity || 'minor',
      status: row.status || 'filed',
      committeeRemarks: row.committeeRemarks || '',
      actionTaken: row.actionTaken || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAntiRaggingComplaint, onSuccess: () => { qc.invalidateQueries({ queryKey: ['anti-ragging-complaints'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAntiRaggingComplaint(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['anti-ragging-complaints'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAntiRaggingComplaint, onSuccess: () => { qc.invalidateQueries({ queryKey: ['anti-ragging-complaints'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.complainantId) delete payload.complainantId;
    if (!payload.committeeRemarks) delete payload.committeeRemarks;
    if (!payload.actionTaken) delete payload.actionTaken;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  function toggleAccused(id: string) {
    setForm(f => ({
      ...f,
      accusedIds: f.accusedIds.includes(id) ? f.accusedIds.filter(a => a !== id) : [...f.accusedIds, id],
    }));
  }

  const columns = [
    { key: 'incidentDate', label: 'Date', render: (r: any) => r.incidentDate ? new Date(r.incidentDate).toLocaleDateString() : '\u2014' },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={SEV_COLOR[r.severity] || 'default'}>{r.severity}</Badge> },
    { key: 'description', label: 'Description', render: (r: any) => <span className="truncate max-w-[200px] inline-block">{r.description}</span> },
    { key: 'isAnonymous', label: 'Anonymous', render: (r: any) => r.isAnonymous ? 'Yes' : 'No' },
    { key: 'accusedIds', label: 'Accused', render: (r: any) => (r.accusedIds || []).map((a: any) => a.personId?.name || a.rollNumber || '?').join(', ') || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this complaint?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Anti-Ragging Complaints</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Complaint
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Complaint')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Anonymous</label>
                <select value={String(form.isAnonymous)} onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.value === 'true' }))} className={inp}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div><label className={lbl}>Complainant {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.complainantId} onChange={e => setForm(f => ({ ...f, complainantId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Incident Date *</label><input required type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Severity *</label>
                <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inp}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Description *</label><textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} /></div>
              <div className="col-span-2">
                <label className={lbl}>Accused Students {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {students.map((s: any) => (
                    <label key={s._id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                      <input type="checkbox" checked={form.accusedIds.includes(s._id)} onChange={() => toggleAccused(s._id)} className="rounded border-gray-300" />
                      {studentDisplayName(s)}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Committee Remarks</label><input value={form.committeeRemarks} onChange={e => setForm(f => ({ ...f, committeeRemarks: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Action Taken</label><textarea value={form.actionTaken} onChange={e => setForm(f => ({ ...f, actionTaken: e.target.value }))} className={inp} rows={2} /></div>
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
