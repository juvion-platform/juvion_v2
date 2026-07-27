import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAuditFindings, createAuditFinding, updateAuditFinding, deleteAuditFinding } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const AUDIT_TYPES = ['internal', 'external', 'naac', 'nba', 'iso', 'financial'] as const;
const SEVERITIES = ['observation', 'minor_nc', 'major_nc', 'critical'] as const;
const STATUSES = ['open', 'action_taken', 'verified', 'closed'] as const;
const SEVERITY_COLOR: Record<string, string> = { observation: 'default', minor_nc: 'warning', major_nc: 'danger', critical: 'danger' };
const STATUS_COLOR: Record<string, string> = { open: 'danger', action_taken: 'warning', verified: 'info', closed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  auditType: 'internal' as string, auditorName: '', auditDate: '',
  finding: '', severity: 'observation' as string, department: '',
  correctionAction: '', correctionDeadline: '', status: 'open' as string,
};

export default function AuditFindingsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['audit-findings', page, limit, search], queryFn: () => listAuditFindings(page, limit, undefined, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      auditType: row.auditType || 'internal',
      auditorName: row.auditorName || '',
      auditDate: row.auditDate?.slice(0, 10) || '',
      finding: row.finding || '',
      severity: row.severity || 'observation',
      department: row.department || '',
      correctionAction: row.correctionAction || '',
      correctionDeadline: row.correctionDeadline?.slice(0, 10) || '',
      status: row.status || 'open',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAuditFinding, onSuccess: () => { qc.invalidateQueries({ queryKey: ['audit-findings'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAuditFinding(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['audit-findings'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAuditFinding, onSuccess: () => { qc.invalidateQueries({ queryKey: ['audit-findings'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.department) delete payload.department;
    if (!form.correctionAction) delete payload.correctionAction;
    if (!form.correctionDeadline) delete payload.correctionDeadline;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'finding', label: 'Finding', render: (r: any) => <span className="font-medium text-navy">{r.finding?.length > 60 ? r.finding.slice(0, 60) + '...' : r.finding}</span> },
    { key: 'auditType', label: 'Audit Type', render: (r: any) => <Badge variant="info">{r.auditType}</Badge> },
    { key: 'auditorName', label: 'Auditor', render: (r: any) => r.auditorName },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={SEVERITY_COLOR[r.severity] || 'default'}>{r.severity}</Badge> },
    { key: 'auditDate', label: 'Audit Date', render: (r: any) => r.auditDate ? new Date(r.auditDate).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this finding?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Audit Findings</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search audit findings…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Finding
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Audit Finding')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Audit Type *</label>
                <select required value={form.auditType} onChange={e => setForm(f => ({ ...f, auditType: e.target.value }))} className={inp}>
                  {AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Auditor Name *</label>
                <input required value={form.auditorName} onChange={e => setForm(f => ({ ...f, auditorName: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Audit Date *</label>
                <input required type="date" value={form.auditDate} onChange={e => setForm(f => ({ ...f, auditDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Severity *</label>
                <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inp}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Finding *</label>
                <input required value={form.finding} onChange={e => setForm(f => ({ ...f, finding: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Department</label>
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Corrective Action</label>
                <input value={form.correctionAction} onChange={e => setForm(f => ({ ...f, correctionAction: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Correction Deadline</label>
                <input type="date" value={form.correctionDeadline} onChange={e => setForm(f => ({ ...f, correctionDeadline: e.target.value }))} className={inp} />
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
