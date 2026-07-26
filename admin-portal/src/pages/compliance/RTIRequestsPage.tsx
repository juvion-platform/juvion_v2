import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRTIRequests, createRTIRequest, updateRTIRequest, deleteRTIRequest } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['received', 'processing', 'responded', 'appeal', 'closed'] as const;
const STATUS_COLOR: Record<string, string> = { received: 'default', processing: 'warning', responded: 'success', appeal: 'danger', closed: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  applicantName: '', applicationDate: '', subject: '', description: '',
  feeReceived: 0, assignedTo: '', responseDate: '', response: '',
  appealFiled: false, status: 'received' as string,
};

export default function RTIRequestsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['rti-requests', page, limit, search], queryFn: () => listRTIRequests(page, limit, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      applicantName: row.applicantName || '',
      applicationDate: row.applicationDate?.slice(0, 10) || '',
      subject: row.subject || '',
      description: row.description || '',
      feeReceived: row.feeReceived || 0,
      assignedTo: row.assignedTo?._id || row.assignedTo || '',
      responseDate: row.responseDate?.slice(0, 10) || '',
      response: row.response || '',
      appealFiled: row.appealFiled || false,
      status: row.status || 'received',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createRTIRequest, onSuccess: () => { qc.invalidateQueries({ queryKey: ['rti-requests'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRTIRequest(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rti-requests'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteRTIRequest, onSuccess: () => { qc.invalidateQueries({ queryKey: ['rti-requests'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, feeReceived: Number(form.feeReceived) };
    if (!form.description) delete payload.description;
    if (!form.assignedTo) delete payload.assignedTo;
    if (!form.responseDate) delete payload.responseDate;
    if (!form.response) delete payload.response;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'subject', label: 'Subject', render: (r: any) => <span className="font-medium text-navy">{r.subject}</span> },
    { key: 'applicantName', label: 'Applicant', render: (r: any) => r.applicantName },
    { key: 'applicationDate', label: 'Date', render: (r: any) => r.applicationDate ? new Date(r.applicationDate).toLocaleDateString() : '\u2014' },
    { key: 'feeReceived', label: 'Fee', render: (r: any) => `\u20B9${r.feeReceived || 0}` },
    { key: 'appealFiled', label: 'Appeal', render: (r: any) => r.appealFiled ? <Badge variant="danger">Yes</Badge> : <Badge variant="default">No</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this request?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">RTI Requests</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search rti requests…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New RTI Request
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('RTI Request')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Applicant Name *</label>
                <input required value={form.applicantName} onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Application Date *</label>
                <input required type="date" value={form.applicationDate} onChange={e => setForm(f => ({ ...f, applicationDate: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2"><label className={lbl}>Subject *</label>
                <input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2"><label className={lbl}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Fee Received</label>
                <input type="number" min={0} value={form.feeReceived} onChange={e => setForm(f => ({ ...f, feeReceived: Number(e.target.value) }))} className={inp} />
              </div>
              <div><label className={lbl}>Assigned To (Person ID)</label>
                <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Response Date</label>
                <input type="date" value={form.responseDate} onChange={e => setForm(f => ({ ...f, responseDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Response</label>
                <input value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} className={inp} />
              </div>
              <div><label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.appealFiled} onChange={e => setForm(f => ({ ...f, appealFiled: e.target.checked }))} className="rounded" />
                Appeal Filed
              </label></div>
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
