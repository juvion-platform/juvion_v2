import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Lock, ShieldAlert } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { useAuthStore } from '../../stores/authStore';
import { confirmAction } from '../../stores/confirmStore';
import {
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  COMPONENT_KEY_REGEX,
  FeeComponentTemplateDoc,
  FeeComponentTemplateCategory,
} from '../../services/fee-component-template';

// ── Shared form classes (matches the 170+ CRUD pages from prior rollout) ──
const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

// Roles allowed to see + manage the template.
const ADMIN_ROLES = new Set(['finance_officer', 'principal', 'super_admin']);

// Default year-of-study options (1..4).
const YEAR_OPTIONS = [1, 2, 3, 4];

interface FormState {
  componentKey: string;
  displayLabel: string;
  category: FeeComponentTemplateCategory;
  isRefundable: boolean;
  defaultOneTime: boolean;
  applicableToYears: number[];
  displayOrder: number | '';
}

const emptyForm: FormState = {
  componentKey: '',
  displayLabel: '',
  category: 'academic',
  isRefundable: false,
  defaultOneTime: false,
  applicableToYears: [],
  displayOrder: '',
};

export default function FeeComponentTemplatePage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const role = user?.role ?? '';
  const canManage = isSuperAdmin || ADMIN_ROLES.has(role);

  const [categoryFilter, setCategoryFilter] = useState<'' | FeeComponentTemplateCategory>('');
  const [yearFilter, setYearFilter] = useState<'' | number>('');
  const [form, setForm] = useState<FormState>(emptyForm);

  const queryKey = ['fee-component-template', categoryFilter, yearFilter];
  const { data: components = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listComponents({
        category: categoryFilter || undefined,
        applicableToYear: yearFilter === '' ? undefined : Number(yearFilter),
      }),
    enabled: canManage,
  });

  const vem = useViewEditMode<FeeComponentTemplateDoc>({
    onOpenEntity: (row) =>
      setForm({
        componentKey: row.componentKey,
        displayLabel: row.displayLabel,
        category: row.category,
        isRefundable: row.isRefundable,
        defaultOneTime: row.defaultOneTime,
        applicableToYears: row.applicableToYears ?? [],
        displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : '',
      }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createComponent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-component-template'] });
      vem.close();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateComponent>[1] }) =>
      updateComponent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-component-template'] });
      vem.close();
    },
  });
  const deleteMut = useMutation({
    mutationFn: deleteComponent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-component-template'] });
    },
  });

  // Sort by displayOrder for canonical presentation.
  const sorted = useMemo(
    () => [...components].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [components],
  );

  const isEditingDefault = vem.isEdit && vem.entity?.isDefault === true;
  const isEditingCustom = vem.isEdit && vem.entity?.isDefault === false;
  // componentKey rules:
  //   - create: required + regex
  //   - edit (default):  disabled (locked)
  //   - edit (custom):   disabled (immutable once created — per backend)
  const keyInputDisabled = vem.isView || isEditingDefault || isEditingCustom;
  const keyInvalid =
    vem.isCreate && form.componentKey.length > 0 && !COMPONENT_KEY_REGEX.test(form.componentKey);
  const canSubmit =
    vem.isCreate
      ? form.componentKey.length > 0 &&
        COMPONENT_KEY_REGEX.test(form.componentKey) &&
        form.displayLabel.trim().length > 0
      : form.displayLabel.trim().length > 0;

  function toggleYear(year: number) {
    setForm((f) => {
      const has = f.applicableToYears.includes(year);
      return {
        ...f,
        applicableToYears: has
          ? f.applicableToYears.filter((y) => y !== year)
          : [...f.applicableToYears, year].sort((a, b) => a - b),
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const displayOrder = form.displayOrder === '' ? undefined : Number(form.displayOrder);

    if (vem.isCreate) {
      createMut.mutate({
        componentKey: form.componentKey.trim(),
        displayLabel: form.displayLabel.trim(),
        category: form.category,
        isRefundable: form.isRefundable,
        defaultOneTime: form.defaultOneTime,
        applicableToYears: form.applicableToYears,
        displayOrder,
      });
      return;
    }

    if (vem.isEdit && vem.entity) {
      // For defaults, only send the two mutable fields — server will 403
      // on anything else, but we avoid the round-trip.
      if (vem.entity.isDefault) {
        updateMut.mutate({
          id: vem.entity._id,
          data: {
            displayLabel: form.displayLabel.trim(),
            displayOrder,
          },
        });
      } else {
        updateMut.mutate({
          id: vem.entity._id,
          data: {
            displayLabel: form.displayLabel.trim(),
            category: form.category,
            isRefundable: form.isRefundable,
            defaultOneTime: form.defaultOneTime,
            applicableToYears: form.applicableToYears,
            displayOrder,
          },
        });
      }
    }
  }

  async function handleDelete(row: FeeComponentTemplateDoc) {
    if (row.isDefault) return;
    const ok = await confirmAction({
      title: `Delete custom component "${row.displayLabel}"?`,
      message: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok.confirmed) return;
    deleteMut.mutate(row._id);
  }

  const columns = [
    {
      key: 'componentKey',
      label: 'Key',
      render: (r: FeeComponentTemplateDoc) => (
        <span className="font-mono text-xs text-navy-dark">{r.componentKey}</span>
      ),
    },
    {
      key: 'displayLabel',
      label: 'Label',
      render: (r: FeeComponentTemplateDoc) => (
        <span className="text-sm text-navy">{r.displayLabel}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r: FeeComponentTemplateDoc) => (
        <span className="text-xs text-gray-600">{CATEGORY_LABELS[r.category] ?? r.category}</span>
      ),
    },
    {
      key: 'isRefundable',
      label: 'Refundable',
      render: (r: FeeComponentTemplateDoc) =>
        r.isRefundable ? <Badge variant="teal">Yes</Badge> : <span className="text-xs text-gray-400">No</span>,
    },
    {
      key: 'defaultOneTime',
      label: 'One-Time',
      render: (r: FeeComponentTemplateDoc) =>
        r.defaultOneTime ? <Badge variant="info">One-Time</Badge> : <span className="text-xs text-gray-400">Recurring</span>,
    },
    {
      key: 'applicableToYears',
      label: 'Years',
      render: (r: FeeComponentTemplateDoc) => {
        const years = r.applicableToYears ?? [];
        if (years.length === 0) return <span className="text-xs text-gray-500">All</span>;
        return <span className="text-xs text-gray-700">{years.join(', ')}</span>;
      },
    },
    {
      key: 'isDefault',
      label: 'Source',
      render: (r: FeeComponentTemplateDoc) =>
        r.isDefault ? <Badge variant="default">Default</Badge> : <Badge variant="purple">Custom</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (r: FeeComponentTemplateDoc) => (
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
              handleDelete(r);
            }}
            disabled={r.isDefault}
            className="p-1 rounded hover:bg-red-50 disabled:hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
            title={r.isDefault ? 'Default components cannot be deleted' : 'Delete'}
          >
            <Trash2 size={15} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  if (!canManage) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        <ShieldAlert className="text-amber-600 mt-0.5" size={20} />
        <div>
          <h3 className="text-sm font-semibold text-amber-800">Restricted</h3>
          <p className="text-sm text-amber-700 mt-1">
            The Fee Component Template is editable by finance officers, principals, and super admins only.
          </p>
        </div>
      </div>
    );
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Fee Component Template</h2>
          <p className="text-sm text-gray-500 mt-1">
            33 canonical components ship by default. Add custom components specific to your college.
          </p>
        </div>
        <button
          onClick={vem.openForCreate}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 whitespace-nowrap"
        >
          <Plus size={16} className="text-white" /> New Custom Component
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className={lbl}>Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as '' | FeeComponentTemplateCategory)}
            className={inp + ' min-w-[14rem]'}
          >
            <option value="">All categories</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Applicable to Year</label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className={inp + ' min-w-[10rem]'}
          >
            <option value="">All years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-500">
          {sorted.length} component{sorted.length === 1 ? '' : 's'}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sorted}
        loading={isLoading}
        rowKey={(r) => r._id}
        onRowClick={vem.openForView}
        emptyState="No components match the current filters"
      />

      <Modal
        open={vem.isOpen}
        onClose={vem.close}
        title={vem.titleFor('Fee Component')}
        widthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            {/* Default lock banner (edit mode for a default component) */}
            {isEditingDefault && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-2 text-xs text-gray-600">
                <Lock size={14} className="text-gray-500 mt-0.5" />
                <div>
                  This is a default component. Only <span className="font-semibold">display label</span> and{' '}
                  <span className="font-semibold">display order</span> are editable; the rest is locked by the canonical spec.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>
                  Component Key *
                  {(isEditingDefault || isEditingCustom) && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                      <Lock size={10} /> {isEditingDefault ? 'Locked' : 'Immutable'}
                    </span>
                  )}
                </label>
                <input
                  required={vem.isCreate}
                  disabled={keyInputDisabled}
                  value={form.componentKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, componentKey: e.target.value.toLowerCase() }))
                  }
                  className={inp + (keyInvalid ? ' border-red-400 focus:ring-red-200 focus:border-red-400' : '')}
                  placeholder="e.g. coding_platform_fee"
                  aria-invalid={keyInvalid}
                />
                {keyInvalid && (
                  <p className="text-xs text-red-600 mt-1">
                    Must be lowercase snake_case — start with a letter, then letters/digits/underscores only.
                  </p>
                )}
              </div>

              <div>
                <label className={lbl}>Display Label *</label>
                <input
                  required
                  value={form.displayLabel}
                  onChange={(e) => setForm((f) => ({ ...f, displayLabel: e.target.value }))}
                  className={inp}
                  placeholder="e.g. Coding Platform Subscription"
                />
              </div>

              <div>
                <label className={lbl}>
                  Category *
                  {isEditingDefault && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                      <Lock size={10} /> Locked
                    </span>
                  )}
                </label>
                <select
                  disabled={vem.isView || isEditingDefault}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FeeComponentTemplateCategory }))}
                  className={inp}
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}>Display Order</label>
                <input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      displayOrder: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  className={inp}
                  placeholder="Auto if blank"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="fct-refundable"
                  disabled={vem.isView || isEditingDefault}
                  checked={form.isRefundable}
                  onChange={(e) => setForm((f) => ({ ...f, isRefundable: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="fct-refundable" className="text-sm text-gray-700 flex items-center gap-1">
                  Refundable
                  {isEditingDefault && <Lock size={11} className="text-gray-400" />}
                </label>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="fct-onetime"
                  disabled={vem.isView || isEditingDefault}
                  checked={form.defaultOneTime}
                  onChange={(e) => setForm((f) => ({ ...f, defaultOneTime: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="fct-onetime" className="text-sm text-gray-700 flex items-center gap-1">
                  One-Time Charge
                  {isEditingDefault && <Lock size={11} className="text-gray-400" />}
                </label>
              </div>

              <div className="col-span-2">
                <label className={lbl}>
                  Applicable to Years
                  {isEditingDefault && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                      <Lock size={10} /> Locked
                    </span>
                  )}
                </label>
                <div className="flex gap-3">
                  {YEAR_OPTIONS.map((y) => {
                    const checked = form.applicableToYears.includes(y);
                    return (
                      <label
                        key={y}
                        className={
                          'inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm cursor-pointer ' +
                          (checked
                            ? 'border-primary-400 bg-primary-50 text-primary-700'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50') +
                          (vem.isView || isEditingDefault ? ' opacity-60 cursor-not-allowed' : '')
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={vem.isView || isEditingDefault}
                          checked={checked}
                          onChange={() => toggleYear(y)}
                          className="rounded"
                        />
                        Year {y}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave all unchecked to apply to <span className="font-semibold">all years</span>.
                </p>
              </div>

              {vem.entity && (
                <div className="col-span-2 flex items-center gap-2 text-xs text-gray-500">
                  Source:
                  {vem.entity.isDefault ? (
                    <Badge variant="default">Default (canonical)</Badge>
                  ) : (
                    <Badge variant="purple">Custom</Badge>
                  )}
                </div>
              )}
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
                disabled={saving || !canSubmit}
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
