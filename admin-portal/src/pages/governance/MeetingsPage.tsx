import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMeetings, createMeeting, updateMeeting, deleteMeeting, listCommittees } from '../../services/governance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { scheduled: 'info', completed: 'success', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { committeeId: '', meetingDate: '', agenda: '', minutes: '', decisions: '', nextMeetingDate: '', status: 'scheduled' };

export default function MeetingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['gov-meetings', page], queryFn: () => listMeetings(page, 20) });
  const { data: committees } = useQuery({ queryKey: ['gov-committees', 'all'], queryFn: () => listCommittees(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      committeeId: row.committeeId?._id || row.committeeId || '',
      meetingDate: row.meetingDate ? row.meetingDate.slice(0, 10) : '',
      agenda: row.agenda || '',
      minutes: row.minutes || '',
      decisions: Array.isArray(row.decisions) ? row.decisions.join('\n') : '',
      nextMeetingDate: row.nextMeetingDate ? row.nextMeetingDate.slice(0, 10) : '',
      status: row.status || 'scheduled',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createMeeting, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-meetings'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMeeting(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-meetings'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteMeeting, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-meetings'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    payload.decisions = form.decisions ? form.decisions.split('\n').filter(Boolean) : [];
    if (!payload.minutes) delete payload.minutes;
    if (!payload.nextMeetingDate) delete payload.nextMeetingDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'committeeId', label: 'Committee', render: (r: any) => <span className="font-medium text-navy">{r.committeeId?.name || '\u2014'}</span> },
    { key: 'meetingDate', label: 'Date', render: (r: any) => fmtDate(r.meetingDate) },
    { key: 'agenda', label: 'Agenda', render: (r: any) => <span className="truncate max-w-[200px] block">{r.agenda}</span> },
    { key: 'decisions', label: 'Decisions', render: (r: any) => (r.decisions?.length || 0) },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this meeting?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Committee Meetings</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Meeting
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Meeting')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Committee * {!vem.isView && <Link to="/governance/committees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.committeeId} onChange={e => setForm(f => ({ ...f, committeeId: e.target.value }))} className={inp}>
                  <option value="">Select committee</option>
                  {(committees?.items || []).map((c: any) => (
                    <option key={c._id} value={c._id}>{c.name || c._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Meeting Date *</label><input required type="date" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Agenda *</label><textarea required value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} className={inp} rows={2} /></div>
              <div className="col-span-2"><label className={lbl}>Minutes</label><textarea value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} className={inp} rows={3} /></div>
              <div className="col-span-2"><label className={lbl}>Decisions (one per line)</label><textarea value={form.decisions} onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))} className={inp} rows={3} placeholder="Enter each decision on a new line" /></div>
              <div><label className={lbl}>Next Meeting Date</label><input type="date" value={form.nextMeetingDate} onChange={e => setForm(f => ({ ...f, nextMeetingDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
