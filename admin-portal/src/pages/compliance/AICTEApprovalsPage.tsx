import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAICTEApprovals, createAICTEApproval, updateAICTEApproval, deleteAICTEApproval } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['applied', 'inspection', 'approved', 'conditional', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { applied: 'info', inspection: 'warning', approved: 'success', conditional: 'warning', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { academicYearId: '', applicationId: '', approvalDate: '', eoa: '', status: 'applied' as string };

export default function AICTEApprovalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['aicte-approvals', page], queryFn: () => listAICTEApprovals(page, 20) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      applicationId: row.applicationId || '',
      approvalDate: row.approvalDate?.slice(0, 10) || '',
      eoa: row.eoa || '',
      status: row.status || 'applied',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAICTEApproval, onSuccess: () => { qc.invalidateQueries({ queryKey: ['aicte-approvals'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAICTEApproval(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['aicte-approvals'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAICTEApproval, onSuccess: () => { qc.invalidateQueries({ queryKey: ['aicte-approvals'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.applicationId) delete payload.applicationId;
    if (!form.approvalDate) delete payload.approvalDate;
    if (!form.eoa) delete payload.eoa;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'academicYear', label: 'Academic Year', render: (r: any) => <span className="font-medium text-navy">{r.academicYearId?.label || r.academicYearId || '\u2014'}</span> },
    { key: 'applicationId', label: 'Application ID', render: (r: any) => r.applicationId || '\u2014' },
    { key: 'approvalDate', label: 'Approval Date', render: (r: any) => r.approvalDate ? new Date(r.approvalDate).toLocaleDateString() : '\u2014' },
    { key: 'eoa', label: 'EOA', render: (r: any) => r.eoa || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this approval?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">AICTE Approvals</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Approval
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('AICTE Approval')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Academic Year ID *</label>
                <input required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Application ID</label>
                <input value={form.applicationId} onChange={e => setForm(f => ({ ...f, applicationId: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Approval Date</label>
                <input type="date" value={form.approvalDate} onChange={e => setForm(f => ({ ...f, approvalDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>EOA Reference</label>
                <input value={form.eoa} onChange={e => setForm(f => ({ ...f, eoa: e.target.value }))} className={inp} />
              </div>
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
