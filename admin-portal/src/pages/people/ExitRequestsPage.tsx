import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, XCircle } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { listExitRequests, submitExitRequest, cancelExitRequest, listStudents } from '../../services/people';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const STATUS_COLOR: Record<string, string> = {
  submitted: 'info', under_review: 'warning', clearance_in_progress: 'orange',
  completed: 'success', rejected: 'danger', cancelled: 'default',
};

const EXIT_TYPE_COLOR: Record<string, string> = {
  withdrawal: 'warning', transfer: 'info', expulsion: 'danger', dropout_formalization: 'purple',
};

const EXIT_TYPES = ['withdrawal', 'transfer', 'expulsion', 'dropout_formalization'] as const;
const REASON_CATEGORIES = ['personal', 'financial', 'academic', 'transfer', 'family', 'health', 'disciplinary', 'other'] as const;
const STATUSES = ['submitted', 'under_review', 'clearance_in_progress', 'completed', 'rejected', 'cancelled'] as const;

const emptyForm = {
  studentId: '',
  exitType: 'withdrawal' as string,
  reason: '',
  reasonCategory: 'personal' as string,
  reasonDetails: '',
  requestedBy: '',
  destinationInstitution: '',
  destinationUniversity: '',
  outreachExhausted: false,
};

export default function ExitRequestsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['exit-requests', page, filterStatus],
    queryFn: () => listExitRequests(page, 20, filterStatus || undefined),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-ref', 'all'],
    queryFn: () => listStudents(1, 200),
  });
  const studentOptions = studentsData?.items || [];

  const createMut = useMutation({
    mutationFn: (payload: typeof emptyForm) => submitExitRequest(payload.studentId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exit-requests'] }); closeModal(); },
  });

  const cancelMut = useMutation({
    mutationFn: cancelExitRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exit-requests'] }),
  });

  function closeModal() { setOpen(false); setForm(emptyForm); }

  function openCreate() { setForm(emptyForm); setOpen(true); }

  function openDetail(row: any) { setDetail(row); setDetailOpen(true); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form };
    Object.keys(payload).forEach(key => {
      if ((payload as any)[key] === '') delete (payload as any)[key];
    });
    createMut.mutate(payload);
  }

  const saving = createMut.isPending;
  const error = createMut.error;

  const columns = [
    { key: 'student', label: 'Student', render: (r: any) => {
      const student = r.studentId;
      if (!student) return '—';
      const name = student.personId?.name || student.person?.name || '';
      return name || r.studentId?._id || '—';
    }},
    { key: 'exitType', label: 'Exit Type', render: (r: any) => (
      <Badge variant={EXIT_TYPE_COLOR[r.exitType] || 'default'}>{r.exitType?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'reasonCategory', label: 'Category', render: (r: any) => (
      <span className="capitalize">{r.reasonCategory?.replace(/_/g, ' ') || '—'}</span>
    )},
    { key: 'status', label: 'Status', render: (r: any) => (
      <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'requestedAt', label: 'Requested', render: (r: any) => r.requestedAt ? new Date(r.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { key: 'reason', label: 'Reason', render: (r: any) => (
      <span className="max-w-[200px] truncate block" title={r.reason}>{r.reason || '—'}</span>
    )},
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="p-1 rounded hover:bg-blue-50" title="View details">
          <Eye size={15} className="text-blue-500" />
        </button>
        {(r.status === 'submitted' || r.status === 'under_review') && (
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Cancel this exit request?')) cancelMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Cancel">
            <XCircle size={15} className="text-red-500" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Exit Requests</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48" />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Exit Request
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={open} onClose={closeModal} title="Submit Exit Request" widthClass="max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Request Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student *</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {studentOptions.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.personId?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Exit Type *</label>
                <select required value={form.exitType} onChange={e => setForm(f => ({ ...f, exitType: e.target.value }))} className={inp}>
                  {EXIT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Reason Category *</label>
                <select required value={form.reasonCategory} onChange={e => setForm(f => ({ ...f, reasonCategory: e.target.value }))} className={inp}>
                  {REASON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Requested By (Person ID) *</label>
                <input required value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} className={inp} placeholder="Person ID" />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Reason *</label>
                <textarea required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} rows={2} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Additional Details</label>
                <textarea value={form.reasonDetails} onChange={e => setForm(f => ({ ...f, reasonDetails: e.target.value }))} className={inp} rows={2} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Transfer Details (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Destination Institution</label>
                <input value={form.destinationInstitution} onChange={e => setForm(f => ({ ...f, destinationInstitution: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Destination University</label>
                <input value={form.destinationUniversity} onChange={e => setForm(f => ({ ...f, destinationUniversity: e.target.value }))} className={inp} />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.outreachExhausted} onChange={e => setForm(f => ({ ...f, outreachExhausted: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Outreach exhausted
              </label>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Exit Request Details" widthClass="max-w-2xl">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Student:</span> <span className="font-medium">{detail.studentId?.personId?.name || detail.studentId?.person?.name || '—'}</span></div>
              <div><span className="text-gray-500">Exit Type:</span> <Badge variant={EXIT_TYPE_COLOR[detail.exitType]}>{detail.exitType?.replace(/_/g, ' ')}</Badge></div>
              <div><span className="text-gray-500">Status:</span> <Badge variant={STATUS_COLOR[detail.status]}>{detail.status?.replace(/_/g, ' ')}</Badge></div>
              <div><span className="text-gray-500">Category:</span> <span className="capitalize">{detail.reasonCategory?.replace(/_/g, ' ')}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Reason:</span> <span>{detail.reason}</span></div>
              {detail.reasonDetails && <div className="col-span-2"><span className="text-gray-500">Details:</span> <span>{detail.reasonDetails}</span></div>}
              <div><span className="text-gray-500">Requested:</span> <span>{detail.requestedAt ? new Date(detail.requestedAt).toLocaleDateString('en-IN') : '—'}</span></div>
              {detail.completedAt && <div><span className="text-gray-500">Completed:</span> <span>{new Date(detail.completedAt).toLocaleDateString('en-IN')}</span></div>}
              {detail.destinationInstitution && <div><span className="text-gray-500">Destination:</span> <span>{detail.destinationInstitution}</span></div>}
              {detail.destinationUniversity && <div><span className="text-gray-500">University:</span> <span>{detail.destinationUniversity}</span></div>}
              <div><span className="text-gray-500">Parent Consent:</span> <span>{detail.parentConsentObtained ? 'Yes' : 'No'}</span></div>
              <div><span className="text-gray-500">Outreach Exhausted:</span> <span>{detail.outreachExhausted ? 'Yes' : 'No'}</span></div>
            </div>
            {detail.principalApproval && (
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm text-navy mb-2">Principal Approval</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Approved:</span> <span>{detail.principalApproval.approved ? 'Yes' : 'No'}</span></div>
                  {detail.principalApproval.approvedAt && <div><span className="text-gray-500">Date:</span> <span>{new Date(detail.principalApproval.approvedAt).toLocaleDateString('en-IN')}</span></div>}
                  {detail.principalApproval.notes && <div className="col-span-2"><span className="text-gray-500">Notes:</span> <span>{detail.principalApproval.notes}</span></div>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
