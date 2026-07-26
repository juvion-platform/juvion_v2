import { useState } from 'react';
/**
 * FeeQuotasPage — CRUD for the per-college admission-quota catalog
 * (convener, management, nri, spot, lateral, …). Mounted under
 * /finance/fee-management/fee-quotas.
 *
 * Mirrors FeeCategoriesPage shape: useViewEditMode + DataTable + Modal
 * + useMutation invalidation. Code is the stable LOWERCASE string used
 * to populate the Quota dropdown on FeeStructure + Student forms.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';

import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import {
  listFeeQuotas,
  createFeeQuota,
  updateFeeQuota,
  deleteFeeQuota,
  FeeQuotaDoc,
  FeeQuotaStatus,
} from '../../services/fee-quotas';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';

const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const STATUSES: FeeQuotaStatus[] = ['active', 'inactive'];

interface FormState {
  code: string;
  name: string;
  description: string;
  status: FeeQuotaStatus;
}

const emptyForm: FormState = {
  code: '',
  name: '',
  description: '',
  status: 'active',
};

export default function FeeQuotasPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search } = useListControls();
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['fee-quotas', page, limit, search],
    queryFn: () => listFeeQuotas(page, limit),
  });

  const vem = useViewEditMode<FeeQuotaDoc>({
    onOpenEntity: (row) =>
      setForm({
        code: row.code || '',
        name: row.name || '',
        description: row.description || '',
        status: row.status || 'active',
      }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createFeeQuota,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-quotas'] });
      qc.invalidateQueries({ queryKey: ['fee-quotas-all'] });
      vem.close();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateFeeQuota>[1] }) =>
      updateFeeQuota(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-quotas'] });
      qc.invalidateQueries({ queryKey: ['fee-quotas-all'] });
      vem.close();
    },
  });
  const deleteMut = useMutation({
    mutationFn: deleteFeeQuota,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-quotas'] });
      qc.invalidateQueries({ queryKey: ['fee-quotas-all'] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
    };
    if (vem.isEdit && vem.entity) {
      updateMut.mutate({ id: vem.entity._id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (r: FeeQuotaDoc) => (
        <span className="font-mono text-xs text-navy-dark">{r.code}</span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (r: FeeQuotaDoc) => (
        <span className="font-medium text-navy">{r.name}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (r: FeeQuotaDoc) => (
        <span className="text-xs text-gray-600">{r.description || '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: FeeQuotaDoc) =>
        r.status === 'active' ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="default">Inactive</Badge>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: FeeQuotaDoc) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              vem.openForEdit(r);
            }}
            className="p-1 rounded hover:bg-amber-50"
            title="Edit"
          >
            <Pencil size={15} className="text-amber-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              vem.openForCopy(r);
            }}
            className="p-1 rounded hover:bg-blue-50"
            title="Copy as new"
          >
            <Copy size={15} className="text-blue-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void confirmAction({ title: `Delete fee quota "${r.name}"?`, tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })
            }}
            className="p-1 rounded hover:bg-red-50"
            title="Delete"
          >
            <Trash2 size={15} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Fee Quotas</h2>
          <p className="text-sm text-gray-500 mt-1">
            Admission-quota codes used in Fee Structures and Student records
            (convener, management, nri, spot, lateral, …).
          </p>
        </div>
        <button
          onClick={vem.openForCreate}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 whitespace-nowrap"
        >
          <Plus size={16} className="text-white" /> New Fee Quota
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: FeeQuotaDoc) => r._id}
        onRowClick={vem.openForView}
        emptyState="No fee quotas yet — click 'New Fee Quota' to add one."
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Fee Quota')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Code *</label>
                <input
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))
                  }
                  className={inp}
                  placeholder="e.g. convener"
                />
              </div>
              <div>
                <label className={lbl}>Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inp}
                  placeholder="e.g. Convener Quota"
                />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Description</label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className={inp}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={lbl}>Status *</label>
                <select
                  required
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as FeeQuotaStatus }))
                  }
                  className={inp}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={vem.close}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button
                type="button"
                onClick={vem.switchToEdit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
