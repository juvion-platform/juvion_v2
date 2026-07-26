import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCounseling, createCounseling, updateCounseling, listApplicants } from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Pencil, Plus, ExternalLink } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const STATUS_COLOR: Record<string, string> = { allotted: 'info', accepted: 'success', cancelled: 'danger', upgraded: 'warning' };

const emptyForm = { applicantId: '', round: '1', allotmentOrder: '', collegeCode: '', branchCode: '' };

export default function CounselingPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['counseling', page, limit, search],
    queryFn: () => listCounseling(page, limit, undefined, search),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      applicantId: row.applicantId?._id || row.applicantId || '',
      round: String(row.round ?? '1'),
      allotmentOrder: row.allotmentOrder != null ? String(row.allotmentOrder) : '',
      collegeCode: row.collegeCode || '',
      branchCode: row.branchCode || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createCounseling,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling'] }); vem.close(); },
  });

  // PUT existed server-side; the page only ever POSTed, so records opened
  // read-only with nothing but a Close button.
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateCounseling(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling'] }); vem.close(); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      applicantId: form.applicantId,
      round: Number(form.round),
      allotmentOrder: form.allotmentOrder ? Number(form.allotmentOrder) : undefined,
      collegeCode: form.collegeCode || undefined,
      branchCode: form.branchCode || undefined,
    };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'round', label: 'Round' },
    { key: 'allotmentOrder', label: 'Allotment #', render: (r: any) => r.allotmentOrder || '—' },
    { key: 'collegeCode', label: 'College Code', render: (r: any) => r.collegeCode || '—' },
    { key: 'branchCode', label: 'Branch Code', render: (r: any) => r.branchCode || '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', sortable: false, render: (r: any) => (
      <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit">
        <Pencil size={15} className="text-amber-500" />
      </button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Counseling Allotments</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> Add Allotment
        </button>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Counseling Allotment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Applicant *
                  {!vem.isView && <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className={inp}>
                  <option value="">Select applicant...</option>
                  {(applicantsData?.items || []).map((a: any) => (
                    <option key={a._id} value={a._id}>{a.name || a.email || a._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Round *</label>
                <input required type="number" min={1} value={form.round} onChange={e => setForm(f => ({ ...f, round: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Allotment Order</label>
                <input type="number" value={form.allotmentOrder} onChange={e => setForm(f => ({ ...f, allotmentOrder: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">College Code</label>
                <input value={form.collegeCode} onChange={e => setForm(f => ({ ...f, collegeCode: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Branch Code</label>
                <input value={form.branchCode} onChange={e => setForm(f => ({ ...f, branchCode: e.target.value }))} className={inp} />
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Add'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
