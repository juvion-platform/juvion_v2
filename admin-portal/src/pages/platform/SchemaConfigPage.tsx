import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listConfigTypes, listConfigEntries, upsertConfigEntry,
  deleteConfigEntry,
  suggestConfig, getConfigSuggestionStats,
  type ConfigSchema, type ConfigField, type ConfigEntry,
  type ConfigSuggestion, type SuggestConfigResponse,
} from '../../services/platform-config';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import SuggestionCard, { type SuggestionStatus } from '../../components/platform/SuggestionCard';
import { Settings, Plus, Pencil, Trash2, Save, Power, PowerOff, Sliders, Sparkles, AlertTriangle } from 'lucide-react';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

// ─── Form-field renderer ──────────────────────────────────────────
// One render function. All schema-driven config types use this. New
// field types are added here; everything else stays generic.

interface FieldRendererProps {
  field: ConfigField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}

function FieldRenderer({ field, value, onChange, disabled }: FieldRendererProps) {
  switch (field.type) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{value ? 'Enabled' : 'Disabled'}</span>
        </label>
      );
    case 'number':
      return (
        <input
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={field.placeholder}
          disabled={disabled}
          className={inp}
        />
      );
    case 'select':
      return (
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inp}
        >
          {!field.required && <option value="">Select…</option>}
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case 'multiselect':
      // Lightweight chip-list selector. v1 uses a checkbox grid for clarity;
      // a richer combobox lives in Phase B.
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(o.value);
            return (
              <label key={o.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer ${checked ? 'bg-primary-100 text-primary-700 border border-primary-300' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, o.value]);
                    else onChange(arr.filter((v) => v !== o.value));
                  }}
                  className="h-3.5 w-3.5"
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    case 'textarea':
      return (
        <textarea
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={5}
          className={inp}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={value == null ? '' : String(value).slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inp}
        />
      );
    case 'string':
    default:
      return (
        <input
          type="text"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={inp}
        />
      );
  }
}

function defaultValuesFor(schema: ConfigSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.default !== undefined) out[f.key] = f.default;
    else if (f.type === 'boolean') out[f.key] = false;
    else if (f.type === 'multiselect') out[f.key] = [];
    else out[f.key] = '';
  }
  return out;
}

// ─── Single-cardinality renderer ──────────────────────────────────
//
// 002-ai-assisted-config §Story 2 — the Suggest button + inline
// suggestion cards live on this editor for v1. Multi-cardinality
// suggestions are deferred (per-row UX is too complex for this wave).

interface SingleConfigEditorProps {
  schema: ConfigSchema;
  entry: ConfigEntry;
  onSave: (values: Record<string, unknown>, lineage: { aiAcceptedFields: string[]; batchId?: string }) => void;
  saving: boolean;
}

function SingleConfigEditor({ schema, entry, onSave, saving }: SingleConfigEditorProps) {
  const [values, setValues] = useState<Record<string, unknown>>(entry.values || {});

  // 002 — suggestion state. Suggestions are per-field, keyed by field key.
  // `statuses` tracks whether the admin accepted, rejected, or hasn't touched
  // a given suggestion; only accepted ones go to aiAcceptedFields on save.
  const [suggestionBatch, setSuggestionBatch] = useState<SuggestConfigResponse | null>(null);
  const [statuses, setStatuses] = useState<Record<string, SuggestionStatus>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Reset when the entry changes (e.g. after save round-trip).
  useEffect(() => {
    setValues(entry.values || {});
    setSuggestionBatch(null);
    setStatuses({});
    setSuggestError(null);
  }, [entry]);

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const resp = await suggestConfig(schema.type, { currentValues: values });
      setSuggestionBatch(resp);
      // Initialise statuses as 'pending' for every suggestion in the batch.
      const initial: Record<string, SuggestionStatus> = {};
      for (const s of resp.suggestions) initial[s.field] = 'pending';
      setStatuses(initial);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setSuggestError(e.response?.data?.error || e.message || 'Suggest failed');
    } finally {
      setSuggesting(false);
    }
  }

  function handleAccept(field: string) {
    const s = suggestionBatch?.suggestions.find((x) => x.field === field);
    if (!s) return;
    setValues((prev) => ({ ...prev, [field]: s.suggestedValue }));
    setStatuses((prev) => ({ ...prev, [field]: 'accepted' }));
  }

  function handleReject(field: string) {
    setStatuses((prev) => ({ ...prev, [field]: 'rejected' }));
  }

  const aiAcceptedFields = Object.entries(statuses)
    .filter(([, s]) => s === 'accepted')
    .map(([f]) => f);

  const fieldToSuggestion = useMemo(() => {
    const map: Record<string, ConfigSuggestion> = {};
    if (suggestionBatch) for (const s of suggestionBatch.suggestions) map[s.field] = s;
    return map;
  }, [suggestionBatch]);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 max-w-3xl">
      {/* Header — Suggest button + cap-reached / fallback banners */}
      <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b">
        <p className="text-sm text-gray-500">
          Press <span className="font-semibold">Suggest</span> to have the AI propose defaults you can accept per-field.
        </p>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 text-sm disabled:opacity-50"
        >
          <Sparkles size={14} />
          {suggesting ? 'Suggesting…' : 'Suggest'}
        </button>
      </div>

      {suggestError && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {suggestError}
        </div>
      )}
      {suggestionBatch?.capReached && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div>Daily AI suggestion cap reached for this college. Try again tomorrow or contact your admin to raise the cap.</div>
        </div>
      )}
      {suggestionBatch?.llmFallback && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          AI couldn't produce structured suggestions this time. You can save without them or try Suggest again.
        </div>
      )}
      {suggestionBatch?.isDuplicate && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          Showing a recent batch (generated less than a minute ago). Press Save when you're ready.
        </div>
      )}

      <div className="space-y-5">
        {schema.fields.map((f) => {
          const suggestion = fieldToSuggestion[f.key];
          const status = statuses[f.key];
          return (
            <div key={f.key}>
              <label className={lbl}>
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              <FieldRenderer
                field={f}
                value={values[f.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              />
              {f.helpText && <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>}
              {suggestion && status && (
                <SuggestionCard
                  suggestion={suggestion}
                  status={status}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end items-center gap-3 mt-6 pt-4 border-t">
        {aiAcceptedFields.length > 0 && (
          <span className="text-xs text-indigo-600">
            {aiAcceptedFields.length} AI suggestion{aiAcceptedFields.length === 1 ? '' : 's'} will be applied
          </span>
        )}
        <button
          onClick={() => onSave(values, { aiAcceptedFields, batchId: suggestionBatch?.batchId })}
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

// ─── Inline cap-counter for the Single editor header ──────────────

function SuggestUsageCounter() {
  const { data } = useQuery({
    queryKey: ['config-suggest-stats', 'today'],
    queryFn: () => getConfigSuggestionStats('today'),
    // Refresh quietly every 30s so the counter reflects the latest usage.
    refetchInterval: 30_000,
  });
  if (!data) return null;
  return (
    <span className="text-xs text-gray-500">
      AI suggestions today: <strong>{data.totalSuggested}</strong>
    </span>
  );
}

// ─── Multi-cardinality renderer ───────────────────────────────────

interface MultiConfigListProps {
  schema: ConfigSchema;
  entries: ConfigEntry[];
  onAdd: () => void;
  onEdit: (entry: ConfigEntry) => void;
  onDelete: (entry: ConfigEntry) => void;
  onToggle: (entry: ConfigEntry) => void;
}

function MultiConfigList({ schema, entries, onAdd, onEdit, onDelete, onToggle }: MultiConfigListProps) {
  // Choose the first 3 displayable fields (excluding the identifier itself)
  // for the table preview.
  const previewFields = schema.fields
    .filter((f) => f.key !== schema.identifierField)
    .slice(0, 3);

  const columns = [
    { key: 'identifier', label: schema.identifierField || 'identifier', render: (r: ConfigEntry) => (
      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.identifier}</span>
    )},
    ...previewFields.map((f) => ({
      key: f.key,
      label: f.label,
      render: (r: ConfigEntry) => {
        const v = r.values?.[f.key];
        if (v == null || v === '') return <span className="text-gray-300">—</span>;
        if (typeof v === 'boolean') return v ? '✓' : '✗';
        if (Array.isArray(v)) return v.join(', ');
        const s = String(v);
        return s.length > 40 ? s.slice(0, 40) + '…' : s;
      },
    })),
    { key: 'enabled', label: 'Status', render: (r: ConfigEntry) => (
      <Badge variant={r.enabled ? 'success' : 'default'}>{r.enabled ? 'enabled' : 'disabled'}</Badge>
    )},
    { key: 'actions', label: '', render: (r: ConfigEntry) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); onToggle(r); }} className="p-1 rounded hover:bg-gray-50" title={r.enabled ? 'Disable' : 'Enable'}>
          {r.enabled ? <PowerOff size={15} className="text-orange-500" /> : <Power size={15} className="text-green-600" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(r); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onAdd} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> Add {schema.label.replace(/s$/, '')}
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-sm text-blue-800">
          <strong>No entries yet.</strong> Click "Add" to create the first one.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          rowKey={(r: ConfigEntry) => r.identifier}
          onRowClick={(r: ConfigEntry) => onEdit(r)}
        />
      )}
    </div>
  );
}

// ─── Multi entry form (modal) ─────────────────────────────────────

interface MultiEntryFormProps {
  schema: ConfigSchema;
  initial: ConfigEntry | null;
  onSubmit: (values: Record<string, unknown>, identifier: string, enabled: boolean) => void;
  onCancel: () => void;
  saving: boolean;
}

function MultiEntryForm({ schema, initial, onSubmit, onCancel, saving }: MultiEntryFormProps) {
  const isEditing = initial !== null && !initial.isDefault;
  const idField = schema.identifierField!;

  const [values, setValues] = useState<Record<string, unknown>>(
    initial?.values || defaultValuesFor(schema),
  );
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const idValue = (values[idField] as string)?.trim();
    if (!idValue) {
      alert(`${schema.fields.find((f) => f.key === idField)?.label || idField} is required`);
      return;
    }
    onSubmit(values, idValue, enabled);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.fields.map((f) => (
        <div key={f.key}>
          <label className={lbl}>
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
          </label>
          <FieldRenderer
            field={f}
            value={values[f.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            // Identifier is immutable after creation — changing it would
            // require a delete+recreate (different unique key). Disable.
            disabled={isEditing && f.key === idField}
          />
          {f.helpText && <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2 border-t">
        <input
          id="multi-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="multi-enabled" className="text-sm">Enabled</label>
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ─── Hub view ──────────────────────────────────────────────────────

function ConfigHub({ schemas, onPick }: { schemas: ConfigSchema[]; onPick: (s: ConfigSchema) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-2">Configuration</h2>
      <p className="text-sm text-gray-500 mb-6">
        Schema-driven runtime configuration. Adding a new config type is a single backend registry entry — the form below renders automatically.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schemas.map((s) => (
          <button
            key={s.type}
            onClick={() => onPick(s)}
            className="text-left bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 hover:shadow-lg hover:border-primary-300 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600 shrink-0">
                {s.cardinality === 'single' ? <Sliders size={20} /> : <Settings size={20} />}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-navy-dark">{s.label}</div>
                <div className="text-xs text-gray-500 mt-0.5 capitalize">
                  {s.cardinality === 'single' ? 'single record per college' : `catalog · keyed by ${s.identifierField}`}
                </div>
                <p className="text-sm text-gray-600 mt-2">{s.description}</p>
                <div className="text-xs text-gray-400 mt-2">{s.fields.length} fields</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Top-level component ──────────────────────────────────────────

export default function SchemaConfigPage() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ConfigEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: typesData } = useQuery({
    queryKey: ['platform-config-types'],
    queryFn: listConfigTypes,
  });

  const activeSchema = useMemo(() => {
    if (!activeType) return null;
    return typesData?.types.find((s) => s.type === activeType) || null;
  }, [activeType, typesData]);

  const { data: entriesData } = useQuery({
    queryKey: ['platform-config-entries', activeType],
    queryFn: () => listConfigEntries(activeType!),
    enabled: !!activeType,
  });

  const upsertMut = useMutation({
    mutationFn: ({
      type, values, identifier, enabled, aiAcceptedFields, batchId,
    }: {
      type: string;
      values: Record<string, unknown>;
      identifier?: string;
      enabled?: boolean;
      aiAcceptedFields?: string[];
      batchId?: string;
    }) => upsertConfigEntry(type, { values, enabled, aiAcceptedFields, batchId }, identifier),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-config-entries', activeType] });
      // 002 — refresh the suggestion stats counter after save.
      qc.invalidateQueries({ queryKey: ['config-suggest-stats', 'today'] });
      setModalOpen(false);
      setEditingEntry(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Save failed';
      alert(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ type, identifier }: { type: string; identifier: string }) =>
      deleteConfigEntry(type, identifier),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-config-entries', activeType] }),
  });

  // ── Render hub ──
  if (!activeSchema) {
    return <ConfigHub schemas={typesData?.types || []} onPick={(s) => setActiveType(s.type)} />;
  }

  // ── Render a specific config type ──
  const entries = entriesData?.entries || [];

  function backToHub() {
    setActiveType(null);
    setEditingEntry(null);
    setModalOpen(false);
  }

  function handleSingleSave(
    values: Record<string, unknown>,
    lineage: { aiAcceptedFields: string[]; batchId?: string },
  ) {
    if (!activeSchema) return;
    upsertMut.mutate({
      type: activeSchema.type,
      values,
      aiAcceptedFields: lineage.aiAcceptedFields.length > 0 ? lineage.aiAcceptedFields : undefined,
      batchId: lineage.batchId,
    });
  }

  function handleMultiAdd() {
    setEditingEntry(null);
    setModalOpen(true);
  }
  function handleMultiEdit(entry: ConfigEntry) {
    setEditingEntry(entry);
    setModalOpen(true);
  }
  function handleMultiSubmit(values: Record<string, unknown>, identifier: string, enabled: boolean) {
    if (!activeSchema) return;
    upsertMut.mutate({ type: activeSchema.type, values, identifier, enabled });
  }
  function handleMultiToggle(entry: ConfigEntry) {
    if (!activeSchema) return;
    upsertMut.mutate({
      type: activeSchema.type,
      values: entry.values,
      identifier: entry.identifier,
      enabled: !entry.enabled,
    });
  }
  function handleMultiDelete(entry: ConfigEntry) {
    if (!activeSchema) return;
    if (!confirm(`Delete "${entry.identifier}"? This cannot be undone.`)) return;
    deleteMut.mutate({ type: activeSchema.type, identifier: entry.identifier });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={backToHub} className="text-sm text-gray-500 hover:text-primary-600">← All config</button>
      </div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">{activeSchema.label}</h2>
          <p className="text-sm text-gray-500 mt-1">{activeSchema.description}</p>
        </div>
        {activeSchema.cardinality === 'single' && <SuggestUsageCounter />}
      </div>

      {activeSchema.cardinality === 'single' && entries[0] ? (
        <SingleConfigEditor
          schema={activeSchema}
          entry={entries[0]}
          onSave={handleSingleSave}
          saving={upsertMut.isPending}
        />
      ) : (
        <MultiConfigList
          schema={activeSchema}
          entries={entries}
          onAdd={handleMultiAdd}
          onEdit={handleMultiEdit}
          onDelete={handleMultiDelete}
          onToggle={handleMultiToggle}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEntry(null); }}
        title={editingEntry ? `Edit ${activeSchema.label.replace(/s$/, '')}` : `New ${activeSchema.label.replace(/s$/, '')}`}
        widthClass="max-w-2xl"
      >
        <MultiEntryForm
          schema={activeSchema}
          initial={editingEntry}
          onSubmit={handleMultiSubmit}
          onCancel={() => { setModalOpen(false); setEditingEntry(null); }}
          saving={upsertMut.isPending}
        />
      </Modal>
    </div>
  );
}
