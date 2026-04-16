import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { listClearanceWorkflows, getClearanceWorkflow, initiateClearance, listStudents } from '../../services/people';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const STATUS_COLOR: Record<string, string> = {
  initiated: 'info', in_progress: 'warning', completed: 'success',
  completed_with_exceptions: 'orange', cancelled: 'default',
};

const EXIT_TYPE_COLOR: Record<string, string> = {
  graduation: 'success', withdrawal: 'warning', expulsion: 'danger', dropout: 'purple', transfer: 'info',
};

const STATUSES = ['initiated', 'in_progress', 'completed', 'completed_with_exceptions', 'cancelled'] as const;
const EXIT_TYPES = ['graduation', 'withdrawal', 'expulsion', 'dropout', 'transfer'] as const;
const URGENCIES = ['standard', 'urgent'] as const;

const emptyForm = {
  studentId: '',
  exitType: 'graduation' as string,
  initiatedBy: '',
  urgency: 'standard' as string,
};

export default function ClearancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['clearance-workflows', page, filterStatus],
    queryFn: () => listClearanceWorkflows(page, 20, filterStatus || undefined),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-ref', 'all'],
    queryFn: () => listStudents(1, 200),
  });
  const studentOptions = studentsData?.items || [];

  const createMut = useMutation({
    mutationFn: initiateClearance,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clearance-workflows'] }); closeModal(); },
  });

  function closeModal() { setOpen(false); setForm(emptyForm); }

  function openCreate() { setForm(emptyForm); setOpen(true); }

  async function openDetail(row: any) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const full = await getClearanceWorkflow(row._id);
      setDetail(full);
    } catch {
      setDetail(row);
    } finally {
      setDetailLoading(false);
    }
  }

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
      return student.personId?.name || student.person?.name || '—';
    }},
    { key: 'exitType', label: 'Exit Type', render: (r: any) => (
      <Badge variant={EXIT_TYPE_COLOR[r.exitType] || 'default'}>{r.exitType?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'status', label: 'Status', render: (r: any) => (
      <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'urgency', label: 'Urgency', render: (r: any) => (
      <Badge variant={r.urgency === 'urgent' ? 'danger' : 'default'}>{r.urgency}</Badge>
    )},
    { key: 'progress', label: 'Progress', render: (r: any) => {
      const total = r.totalItems || 0;
      const completed = r.completedItems || 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-200 rounded-full h-2">
            <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-500">{completed}/{total}</span>
        </div>
      );
    }},
    { key: 'initiatedAt', label: 'Initiated', render: (r: any) => r.initiatedAt ? new Date(r.initiatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="p-1 rounded hover:bg-blue-50" title="View details">
          <Eye size={15} className="text-blue-500" />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Clearance Workflows</h2>
        <div className="flex gap-3">
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Initiate Clearance
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
      <Modal open={open} onClose={closeModal} title="Initiate Clearance Workflow" widthClass="max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className={lbl}>Initiated By (Person ID) *</label>
              <input required value={form.initiatedBy} onChange={e => setForm(f => ({ ...f, initiatedBy: e.target.value }))} className={inp} placeholder="Person ID" />
            </div>
            <div>
              <label className={lbl}>Urgency</label>
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} className={inp}>
                {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Initiating...' : 'Initiate Clearance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setDetail(null); }} title="Clearance Workflow Details" widthClass="max-w-3xl">
        {detailLoading && <div className="text-center py-8 text-gray-400">Loading...</div>}
        {!detailLoading && detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Student:</span> <span className="font-medium">{detail.studentId?.personId?.name || detail.studentId?.person?.name || '—'}</span></div>
              <div><span className="text-gray-500">Exit Type:</span> <Badge variant={EXIT_TYPE_COLOR[detail.exitType]}>{detail.exitType?.replace(/_/g, ' ')}</Badge></div>
              <div><span className="text-gray-500">Status:</span> <Badge variant={STATUS_COLOR[detail.status]}>{detail.status?.replace(/_/g, ' ')}</Badge></div>
              <div><span className="text-gray-500">Urgency:</span> <Badge variant={detail.urgency === 'urgent' ? 'danger' : 'default'}>{detail.urgency}</Badge></div>
              <div><span className="text-gray-500">Progress:</span> <span>{detail.completedItems || 0} / {detail.totalItems || 0} items</span></div>
              <div><span className="text-gray-500">Initiated:</span> <span>{detail.initiatedAt ? new Date(detail.initiatedAt).toLocaleDateString('en-IN') : '—'}</span></div>
              {detail.completedAt && <div><span className="text-gray-500">Completed:</span> <span>{new Date(detail.completedAt).toLocaleDateString('en-IN')}</span></div>}
            </div>

            {detail.items && detail.items.length > 0 && (
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm text-navy mb-2">Clearance Items</h4>
                <div className="space-y-2">
                  {detail.items.map((item: any, i: number) => (
                    <div key={item._id || i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <span className="font-medium">{item.department || item.assigneeRole || 'Item'}</span>
                        {item.description && <span className="text-gray-500 ml-2">{item.description}</span>}
                      </div>
                      <Badge variant={item.status === 'completed' ? 'success' : item.status === 'waived' ? 'purple' : item.status === 'in_progress' ? 'warning' : 'default'}>
                        {item.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
