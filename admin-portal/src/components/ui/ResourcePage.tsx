import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import DataTable from './DataTable';
import Modal from './Modal';
import Badge from './Badge';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import EntityPicker from './EntityPicker';
import { useListControls } from '../../hooks/useListControls';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'ref' | 'url';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  placeholder?: string;
  help?: string;
  /** For `ref`: how to load and label the referenced records. */
  ref?: {
    queryKey: readonly unknown[];
    fetcher: (search: string) => Promise<{ items: any[] } | any[]>;
    getLabel: (item: any) => string;
    getHint?: (item: any) => string | undefined;
  };
  /** Renders full-width in the two-column form grid. */
  wide?: boolean;
  /** Hide from the table, show only in the form. */
  hideInTable?: boolean;
  /** Hide from the form, show only in the table (computed/derived values). */
  readOnly?: boolean;
}

/**
 * A lifecycle transition exposed as a row button — several of these modules
 * model state changes as dedicated endpoints (lift a bar, void an opt-out,
 * verify a recruiter) rather than a PUT of `status`.
 */
export interface RowAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Tailwind text colour for the icon. */
  color?: string;
  tone?: 'danger' | 'primary';
  /** Only show the button when this returns true. */
  visible?: (row: any) => boolean;
  /** Prompt for a free-text reason and pass it to `run`. */
  requireReason?: boolean;
  reasonLabel?: string;
  confirmMessage?: string;
  run: (row: any, reason?: string) => Promise<any>;
}

export interface ResourceConfig {
  /** Plural human name, e.g. "Placement Drives". */
  title: string;
  /** Singular human name used in modal titles and confirms. */
  singular: string;
  /** React Query key root. */
  queryKey: string;
  fields: FieldDef[];
  /** Lifecycle buttons rendered before Edit/Delete on each row. */
  rowActions?: RowAction[];
  api: {
    list: (page: number, limit: number, search?: string) => Promise<any>;
    create?: (data: any) => Promise<any>;
    update?: (id: string, data: any) => Promise<any>;
    remove?: (id: string) => Promise<any>;
  };
  /** Extra query keys to invalidate after a write (e.g. a module's stats). */
  invalidates?: string[];
  /** Optional intro line under the page heading. */
  description?: string;
  /** Extra content rendered inside the modal, below the generated fields. */
  renderExtra?: (entity: any) => React.ReactNode;
}

const BADGE_BY_TOKEN: Record<string, string> = {
  active: 'success', approved: 'success', completed: 'success', selected: 'success',
  confirmed: 'success', issued: 'success', paid: 'success', resolved: 'success',
  pending: 'warning', in_progress: 'warning', scheduled: 'warning', applied: 'warning',
  draft: 'default', closed: 'default', archived: 'default',
  rejected: 'danger', cancelled: 'danger', failed: 'danger', overdue: 'danger',
  withdrawn: 'danger', no_show: 'danger', not_selected: 'danger',
};

function humanise(v: unknown): string {
  return String(v ?? '').replace(/_/g, ' ');
}

function displayRef(v: any): string {
  if (!v) return '—';
  if (typeof v === 'string') return v;
  return v.name ?? v.title ?? v.code ?? v.label
    ?? v.personId?.name ?? v.studentId?.personId?.name
    ?? v.companyName ?? v.employeeId ?? '—';
}

/**
 * Config-driven CRUD page.
 *
 * The audit found ~35 backend entities across Placement W04, Student Dev W09,
 * HR and People with complete APIs but no UI at all. Hand-writing 35 near
 * identical pages would multiply the very drift this pass is fixing, so they
 * share this one implementation — which also means every generated page gets
 * sorting, search, the record count, the page-size selector, the styled
 * confirm dialog and the global toasts for free.
 *
 * Pages needing bespoke behaviour still get their own file; this covers the
 * straightforward create/read/update/delete surfaces.
 */
export default function ResourcePage({ config }: { config: ResourceConfig }) {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState<Record<string, any>>(() => blankForm(config.fields));

  const { data, isLoading } = useQuery({
    queryKey: [config.queryKey, page, limit, search],
    queryFn: () => config.api.list(page, limit, search || undefined),
  });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm(rowToForm(config.fields, row)),
    onOpenCreate: () => setForm(blankForm(config.fields)),
    onClose: () => setForm(blankForm(config.fields)),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: [config.queryKey] });
    for (const k of config.invalidates ?? []) qc.invalidateQueries({ queryKey: [k] });
  }

  const createMut = useMutation({
    mutationFn: (d: any) => config.api.create!(d),
    meta: { action: 'create' },
    onSuccess: () => { invalidate(); vem.close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: any) => config.api.update!(id, d),
    meta: { action: 'update' },
    onSuccess: () => { invalidate(); vem.close(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => config.api.remove!(id),
    meta: { action: 'delete' },
    onSuccess: invalidate,
  });
  const actionMut = useMutation({
    mutationFn: ({ action, row, reason }: { action: RowAction; row: any; reason?: string }) =>
      action.run(row, reason),
    onSuccess: invalidate,
  });

  const saving = createMut.isPending || updateMut.isPending;
  const canCreate = Boolean(config.api.create);
  const canEdit = Boolean(config.api.update);

  async function runAction(action: RowAction, row: any) {
    const res = await confirmAction({
      title: `${action.label}?`,
      message: action.confirmMessage,
      tone: action.tone ?? 'primary',
      confirmLabel: action.label,
      requireReason: action.requireReason,
      reasonLabel: action.reasonLabel,
    });
    if (!res.confirmed) return;
    actionMut.mutate({ action, row, reason: res.reason });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = formToPayload(config.fields, form);
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  async function handleDelete(row: any) {
    const ok = await confirmAction({
      title: `Delete this ${config.singular.toLowerCase()}?`,
      message: 'This action cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (ok.confirmed) deleteMut.mutate(row._id);
  }

  const columns = [
    ...config.fields
      .filter((f) => !f.hideInTable)
      .slice(0, 6)
      .map((f) => ({
        key: f.name,
        label: f.label,
        sortValue: (r: any) => {
          const v = r[f.name];
          if (f.type === 'ref') return displayRef(v);
          if (f.type === 'date' || f.type === 'datetime') return v ? new Date(v).getTime() : 0;
          return v as string | number;
        },
        render: (r: any) => renderCell(f, r[f.name]),
      })),
    {
      key: '__actions',
      label: '',
      sortable: false,
      render: (r: any) => (
        <div className="flex gap-1">
          {(config.rowActions ?? [])
            .filter((a) => (a.visible ? a.visible(r) : true))
            .map((a) => (
              <button
                key={a.key}
                onClick={(e) => { e.stopPropagation(); void runAction(a, r); }}
                className="rounded p-1 hover:bg-slate-100"
                title={a.label}
              >
                <a.icon size={15} className={a.color ?? 'text-slate-500'} />
              </button>
            ))}
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit">
              <Pencil size={15} className="text-amber-500" />
            </button>
          )}
          {config.api.remove && (
            <button onClick={(e) => { e.stopPropagation(); void handleDelete(r); }} className="p-1 rounded hover:bg-red-50" title="Delete">
              <Trash2 size={15} className="text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">{config.title}</h2>
          {config.description && <p className="mt-1 text-sm text-gray-500">{config.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${config.title.toLowerCase()}…`} className="w-56" />
          {canCreate && (
            <button onClick={vem.openForCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
              <Plus size={16} className="text-white" /> New
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No ${config.title.toLowerCase()} match “${search}”.` : `No ${config.title.toLowerCase()} yet.`}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel={config.title.toLowerCase()}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor(config.singular)} widthClass="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="m-0 space-y-4 border-0 p-0">
            <div className="grid grid-cols-2 gap-4">
              {config.fields.filter((f) => !f.readOnly).map((f) => (
                <div key={f.name} className={f.wide || f.type === 'textarea' ? 'col-span-2' : ''}>
                  <label className={lbl} htmlFor={`f-${f.name}`}>
                    {f.label}{f.required && ' *'}
                  </label>
                  {renderInput(f, form, setForm, vem.isView, vem.entity)}
                  {f.help && <p className="mt-1 text-xs text-gray-500">{f.help}</p>}
                </div>
              ))}
            </div>
          </fieldset>

          {config.renderExtra?.(vem.entity)}

          <div className="flex justify-end gap-3 border-t pt-2">
            <button type="button" onClick={vem.close} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (canEdit && (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            )) : (
              <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function blankForm(fields: FieldDef[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    out[f.name] = f.type === 'boolean' ? false : '';
  }
  return out;
}

function rowToForm(fields: FieldDef[], row: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    const v = row?.[f.name];
    if (f.type === 'boolean') out[f.name] = Boolean(v);
    else if (f.type === 'ref') out[f.name] = (v && typeof v === 'object' ? v._id : v) ?? '';
    else if (f.type === 'date') out[f.name] = v ? String(v).slice(0, 10) : '';
    else if (f.type === 'datetime') out[f.name] = v ? String(v).slice(0, 16) : '';
    else out[f.name] = v ?? '';
  }
  return out;
}

function formToPayload(fields: FieldDef[], form: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    const v = form[f.name];
    if (f.type === 'boolean') { out[f.name] = Boolean(v); continue; }
    // Omit blanks so optional fields aren't sent as empty strings, which
    // Zod's .optional() rejects and Mongoose would store as ''.
    if (v === '' || v == null) continue;
    out[f.name] = f.type === 'number' ? Number(v) : v;
  }
  return out;
}

function renderCell(f: FieldDef, v: any): React.ReactNode {
  if (f.type === 'boolean') return v ? 'Yes' : 'No';
  if (f.type === 'ref') return displayRef(v);
  if (f.type === 'date') return v ? new Date(v).toLocaleDateString() : '—';
  if (f.type === 'datetime') return v ? new Date(v).toLocaleString() : '—';
  if (f.type === 'url') {
    return v
      ? <a href={v} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary-600 hover:underline">Open</a>
      : '—';
  }
  if (f.options && v) {
    return <Badge variant={(BADGE_BY_TOKEN[String(v)] ?? 'default') as any}>{humanise(v)}</Badge>;
  }
  if (v === 0) return '0';
  return v ? String(v) : '—';
}

function renderInput(
  f: FieldDef,
  form: Record<string, any>,
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  isView: boolean,
  entity: any,
): React.ReactNode {
  const set = (v: any) => setForm((s) => ({ ...s, [f.name]: v }));
  const id = `f-${f.name}`;

  if (f.type === 'ref' && f.ref) {
    return (
      <EntityPicker
        id={id}
        required={f.required}
        disabled={isView}
        queryKey={f.ref.queryKey}
        fetcher={f.ref.fetcher}
        value={form[f.name] ?? ''}
        onChange={set}
        getId={(x: any) => x._id}
        getLabel={f.ref.getLabel}
        getHint={f.ref.getHint}
        fallbackLabel={displayRef(entity?.[f.name])}
        placeholder={f.placeholder ?? `Search ${f.label.toLowerCase()}`}
      />
    );
  }

  if (f.type === 'select' || f.options) {
    return (
      <select id={id} required={f.required} value={form[f.name] ?? ''} onChange={(e) => set(e.target.value)} className={inp}>
        <option value="">Select…</option>
        {(f.options ?? []).map((o) => <option key={o} value={o}>{humanise(o)}</option>)}
      </select>
    );
  }

  if (f.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 py-2 text-sm text-gray-700">
        <input id={id} type="checkbox" checked={Boolean(form[f.name])} onChange={(e) => set(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
        Yes
      </label>
    );
  }

  if (f.type === 'textarea') {
    return <textarea id={id} required={f.required} rows={3} value={form[f.name] ?? ''} onChange={(e) => set(e.target.value)} className={inp} placeholder={f.placeholder} />;
  }

  const htmlType = f.type === 'number' ? 'number'
    : f.type === 'date' ? 'date'
    : f.type === 'datetime' ? 'datetime-local'
    : f.type === 'url' ? 'url'
    : 'text';

  return (
    <input
      id={id}
      type={htmlType}
      required={f.required}
      value={form[f.name] ?? ''}
      onChange={(e) => set(e.target.value)}
      className={inp}
      placeholder={f.placeholder}
    />
  );
}
