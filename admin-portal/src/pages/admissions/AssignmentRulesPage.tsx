import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAssignmentRules, createAssignmentRule, updateAssignmentRule,
  deleteAssignmentRule, previewAssignmentRule,
  type AssignmentRuleDoc, type AssignmentRuleCondition,
  type AssignmentRuleField, type AssignmentRuleOperator,
} from '../../services/admissions';
import { listFaculty, listStaff } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, Power, PowerOff, FlaskConical, ArrowDownAZ } from 'lucide-react';
import { confirmAction } from '../../stores/confirmStore';

// ─── Constants (mirror backend enums) ────────────────────────────
const FIELDS: { value: AssignmentRuleField; label: string; type: 'string' | 'number' | 'enum'; options?: string[] }[] = [
  { value: 'source', label: 'Inquiry Source', type: 'enum', options: ['website', 'walk-in', 'referral', 'whatsapp', 'newspaper', 'social_media', 'education_fair', 'phone'] },
  { value: 'utmSource', label: 'UTM Source', type: 'string' },
  { value: 'utmMedium', label: 'UTM Medium', type: 'string' },
  { value: 'utmCampaign', label: 'UTM Campaign', type: 'string' },
  { value: 'programmeInterest', label: 'Programme Interest', type: 'string' },
  { value: 'branchInterest', label: 'Branch Interest', type: 'string' },
  { value: 'leadScore', label: 'Lead Score (0–100)', type: 'number' },
  { value: 'leadGrade', label: 'Lead Grade', type: 'enum', options: ['hot', 'warm', 'cold', 'dormant'] },
  { value: 'state', label: 'State', type: 'string' },
  { value: 'city', label: 'City', type: 'string' },
  { value: 'interStream', label: 'Intermediate Stream', type: 'enum', options: ['MPC', 'BiPC', 'MEC', 'CEC', 'other'] },
];

const OPERATORS: { value: AssignmentRuleOperator; label: string; allowedTypes: ('string' | 'number' | 'enum')[] }[] = [
  { value: 'equals', label: 'equals', allowedTypes: ['string', 'number', 'enum'] },
  { value: 'not_equals', label: 'not equals', allowedTypes: ['string', 'number', 'enum'] },
  { value: 'in', label: 'is one of', allowedTypes: ['string', 'enum'] },
  { value: 'contains', label: 'contains', allowedTypes: ['string'] },
  { value: 'gt', label: '>', allowedTypes: ['number'] },
  { value: 'gte', label: '>=', allowedTypes: ['number'] },
  { value: 'lt', label: '<', allowedTypes: ['number'] },
  { value: 'lte', label: '<=', allowedTypes: ['number'] },
];

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

interface FormState {
  name: string;
  description: string;
  conditions: AssignmentRuleCondition[];
  assignedOfficerId: string;
  clusterHeadId: string;
  priority: number;
  enabled: boolean;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  conditions: [{ field: 'source', operator: 'equals', value: '' }],
  assignedOfficerId: '',
  clusterHeadId: '',
  priority: 100,
  enabled: true,
};

export default function AssignmentRulesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInquiry, setPreviewInquiry] = useState<Record<string, string>>({
    source: 'website',
    utmCampaign: '',
    programmeInterest: '',
    state: '',
    leadGrade: '',
  });
  const [previewResult, setPreviewResult] = useState<{ matched: boolean; rule: AssignmentRuleDoc | null } | null>(null);

  // ─── Queries ───────────────────────────────────────────────────
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['assignment-rules'],
    queryFn: listAssignmentRules,
  });

  // Eligible assignees = faculty + staff (treat the union as "officers").
  const { data: facultyData } = useQuery({
    queryKey: ['officers-faculty'],
    queryFn: () => listFaculty(1, 200),
  });
  const { data: staffData } = useQuery({
    queryKey: ['officers-staff'],
    queryFn: () => listStaff(1, 200),
  });

  const officers: { _id: string; name: string; role: string }[] = [
    ...(facultyData?.items || []).map((f: any) => ({ _id: f.personId || f._id, name: f.name || f.fullName || 'Faculty', role: 'Faculty' })),
    ...(staffData?.items || []).map((s: any) => ({ _id: s.personId || s._id, name: s.name || s.fullName || 'Staff', role: 'Staff' })),
  ];

  const officerById = (id: string | undefined) => {
    if (!id) return null;
    return officers.find((o) => o._id === id) || null;
  };

  // ─── Mutations ─────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: createAssignmentRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignment-rules'] }); closeModal(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AssignmentRuleDoc> }) => updateAssignmentRule(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignment-rules'] }); closeModal(); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteAssignmentRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignment-rules'] }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateAssignmentRule(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignment-rules'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(rule: AssignmentRuleDoc) {
    setEditingId(rule._id);
    setForm({
      name: rule.name,
      description: rule.description || '',
      // Clone conditions to avoid mutating cached query data.
      conditions: rule.conditions.map((c) => ({ ...c })),
      assignedOfficerId: rule.assignedOfficerId,
      clusterHeadId: rule.clusterHeadId || '',
      priority: rule.priority,
      enabled: rule.enabled,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  // ─── Condition builder ops ─────────────────────────────────────
  function addCondition() {
    setForm((f) => ({ ...f, conditions: [...f.conditions, { field: 'source', operator: 'equals', value: '' }] }));
  }
  function removeCondition(idx: number) {
    setForm((f) => ({ ...f, conditions: f.conditions.filter((_, i) => i !== idx) }));
  }
  function updateCondition(idx: number, patch: Partial<AssignmentRuleCondition>) {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        // If the field changed, reset operator + value so we never end
        // up with an invalid (field, operator) combo on submit.
        if (patch.field && patch.field !== c.field) {
          next.operator = 'equals';
          next.value = '';
        }
        return next;
      }),
    }));
  }

  function coerceValue(rawValue: string, fieldType: 'string' | 'number' | 'enum', operator: AssignmentRuleOperator) {
    if (operator === 'in') {
      return rawValue.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (fieldType === 'number') {
      const n = Number(rawValue);
      return Number.isFinite(n) ? n : 0;
    }
    return rawValue;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const conditions: AssignmentRuleCondition[] = form.conditions.map((c) => {
      const def = FIELDS.find((f) => f.value === c.field);
      const type = def?.type || 'string';
      const value = typeof c.value === 'string'
        ? coerceValue(c.value, type, c.operator)
        : c.value;
      return { field: c.field, operator: c.operator, value };
    });

    const payload: Partial<AssignmentRuleDoc> = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      conditions,
      assignedOfficerId: form.assignedOfficerId,
      clusterHeadId: form.clusterHeadId || undefined,
      priority: form.priority,
      enabled: form.enabled,
    };

    if (editingId) updateMut.mutate({ id: editingId, patch: payload });
    else createMut.mutate(payload);
  }

  // ─── Preview ───────────────────────────────────────────────────
  async function runPreview() {
    // Strip empties so the rule evaluator doesn't see "" === something.
    const inquiry: Record<string, unknown> = {};
    Object.entries(previewInquiry).forEach(([k, v]) => {
      if (v !== '' && v != null) inquiry[k] = v;
    });
    // leadScore is numeric in conditions; coerce here too.
    if (typeof inquiry.leadScore === 'string') inquiry.leadScore = Number(inquiry.leadScore);
    const res = await previewAssignmentRule(inquiry);
    setPreviewResult(res);
  }

  // ─── Table columns ─────────────────────────────────────────────
  const columns = [
    { key: 'name', label: 'Name', render: (r: AssignmentRuleDoc) => (
      <div>
        <div className="font-medium text-gray-900">{r.name}</div>
        {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
      </div>
    )},
    { key: 'conditions', label: 'Conditions', render: (r: AssignmentRuleDoc) => (
      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.conditions.length} condition{r.conditions.length === 1 ? '' : 's'}</span>
    )},
    { key: 'assignedTo', label: 'Officer', render: (r: AssignmentRuleDoc) => {
      const o = officerById(r.assignedOfficerId);
      return o ? <span className="text-sm">{o.name} <span className="text-xs text-gray-400">({o.role})</span></span> : <span className="text-xs text-gray-400">unknown</span>;
    }},
    { key: 'priority', label: 'Priority', render: (r: AssignmentRuleDoc) => (
      <span className="text-sm font-mono">{r.priority}</span>
    )},
    { key: 'enabled', label: 'Status', render: (r: AssignmentRuleDoc) => (
      <Badge variant={r.enabled ? 'success' : 'default'}>{r.enabled ? 'enabled' : 'disabled'}</Badge>
    )},
    { key: 'matches', label: 'Matches', render: (r: AssignmentRuleDoc) => (
      <div className="text-sm">
        <div className="font-medium">{r.matchCount}</div>
        {r.lastMatchedAt && <div className="text-xs text-gray-400">{new Date(r.lastMatchedAt).toLocaleDateString()}</div>}
      </div>
    )},
    { key: 'actions', label: '', render: (r: AssignmentRuleDoc) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); toggleMut.mutate({ id: r._id, enabled: !r.enabled }); }} className="p-1 rounded hover:bg-gray-50" title={r.enabled ? 'Disable' : 'Enable'}>
          {r.enabled ? <PowerOff size={15} className="text-orange-500" /> : <Power size={15} className="text-green-600" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: `Delete rule "${r.name}"?`, tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  // Rules come back already sorted by priority asc from the backend,
  // but sort defensively in case the API ever changes.
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-navy">Lead Assignment Rules</h2>
          <p className="text-xs text-gray-500 mt-1">Auto-route new inquiries to officers. Rules evaluate in priority order (lowest first); first match wins.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setPreviewResult(null); setPreviewOpen(true); }} className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            <FlaskConical size={16} className="text-indigo-500" /> Preview
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Rule
          </button>
        </div>
      </div>

      {rules.length === 0 && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm text-blue-800">
          <strong>No rules yet.</strong> New inquiries will land unassigned in the admin queue. Create your first rule to start auto-routing.
        </div>
      )}

      <DataTable
        columns={columns}
        data={sortedRules}
        loading={isLoading}
        rowKey={(r: AssignmentRuleDoc) => r._id}
      />

      {/* ── Create / Edit Modal ───────────────────────────── */}
      <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit Assignment Rule' : 'New Assignment Rule'} widthClass="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Rule Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Hyderabad B.Tech leads → Officer A" />
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <input type="number" min={0} max={10000} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} className={inp} />
              <p className="text-xs text-gray-400 mt-1">Lower = evaluated first</p>
            </div>
          </div>
          <div>
            <label className={lbl}>Description</label>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inp} placeholder="What this rule is for" />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lbl}>Match Conditions (ALL must match) *</label>
              <button type="button" onClick={addCondition} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> Add condition
              </button>
            </div>
            <div className="space-y-2">
              {form.conditions.map((cond, idx) => {
                const fieldDef = FIELDS.find((f) => f.value === cond.field);
                const fieldType = fieldDef?.type || 'string';
                const operatorOptions = OPERATORS.filter((op) => op.allowedTypes.includes(fieldType));
                const isInOperator = cond.operator === 'in';
                return (
                  <div key={idx} className="flex gap-2 items-start bg-gray-50 rounded-lg p-3">
                    {/* Field */}
                    <select
                      value={cond.field}
                      onChange={(e) => updateCondition(idx, { field: e.target.value as AssignmentRuleField })}
                      className={`${inp} flex-1`}
                    >
                      {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    {/* Operator */}
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(idx, { operator: e.target.value as AssignmentRuleOperator })}
                      className={`${inp} w-32`}
                    >
                      {operatorOptions.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    {/* Value */}
                    {isInOperator ? (
                      <input
                        value={Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value)}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        className={`${inp} flex-1`}
                        placeholder="comma-separated (e.g. MPC, BiPC)"
                      />
                    ) : fieldDef?.options ? (
                      <select
                        value={Array.isArray(cond.value) ? '' : String(cond.value)}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        className={`${inp} flex-1`}
                      >
                        <option value="">Select…</option>
                        {fieldDef.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={fieldType === 'number' ? 'number' : 'text'}
                        value={Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value)}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        className={`${inp} flex-1`}
                        placeholder={fieldType === 'number' ? '0' : 'value'}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      disabled={form.conditions.length === 1}
                      className="p-2 rounded hover:bg-red-50 disabled:opacity-30"
                      title={form.conditions.length === 1 ? 'At least one condition required' : 'Remove'}
                    >
                      <Trash2 size={15} className="text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Assigned Officer *</label>
              <select required value={form.assignedOfficerId} onChange={(e) => setForm((f) => ({ ...f, assignedOfficerId: e.target.value }))} className={inp}>
                <option value="">Select officer…</option>
                {officers.map((o) => <option key={o._id} value={o._id}>{o.name} ({o.role})</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Cluster Head (optional)</label>
              <select value={form.clusterHeadId} onChange={(e) => setForm((f) => ({ ...f, clusterHeadId: e.target.value }))} className={inp}>
                <option value="">None</option>
                {officers.map((o) => <option key={o._id} value={o._id}>{o.name} ({o.role})</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="enabled" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="h-4 w-4" />
            <label htmlFor="enabled" className="text-sm">Enabled (disabled rules are skipped at evaluation time)</label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving…' : editingId ? 'Save Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Preview Modal ─────────────────────────────────── */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview Routing" widthClass="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Enter a hypothetical inquiry and see which rule would route it. Only the fields the rules test are evaluated.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Source</label>
              <select value={previewInquiry.source} onChange={(e) => setPreviewInquiry((p) => ({ ...p, source: e.target.value }))} className={inp}>
                <option value="">—</option>
                {(FIELDS.find((f) => f.value === 'source')?.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Lead Grade</label>
              <select value={previewInquiry.leadGrade} onChange={(e) => setPreviewInquiry((p) => ({ ...p, leadGrade: e.target.value }))} className={inp}>
                <option value="">—</option>
                {['hot', 'warm', 'cold', 'dormant'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Programme Interest</label>
              <input value={previewInquiry.programmeInterest} onChange={(e) => setPreviewInquiry((p) => ({ ...p, programmeInterest: e.target.value }))} className={inp} placeholder="e.g. B.Tech" />
            </div>
            <div>
              <label className={lbl}>UTM Campaign</label>
              <input value={previewInquiry.utmCampaign} onChange={(e) => setPreviewInquiry((p) => ({ ...p, utmCampaign: e.target.value }))} className={inp} placeholder="e.g. summer2025" />
            </div>
            <div>
              <label className={lbl}>State</label>
              <input value={previewInquiry.state} onChange={(e) => setPreviewInquiry((p) => ({ ...p, state: e.target.value }))} className={inp} placeholder="e.g. Telangana" />
            </div>
            <div>
              <label className={lbl}>Lead Score</label>
              <input type="number" value={previewInquiry['leadScore'] || ''} onChange={(e) => setPreviewInquiry((p) => ({ ...p, leadScore: e.target.value }))} className={inp} placeholder="0–100" />
            </div>
          </div>

          <button type="button" onClick={runPreview} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-2">
            <ArrowDownAZ size={14} className="text-white" /> Run Preview
          </button>

          {previewResult && (
            previewResult.matched && previewResult.rule ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                  ✓ Matched: {previewResult.rule.name}
                </div>
                <div className="text-sm text-green-700">
                  Would route to <strong>{officerById(previewResult.rule.assignedOfficerId)?.name || 'unknown officer'}</strong>
                  {' '}(priority {previewResult.rule.priority}).
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                No rule matched. This inquiry would land unassigned in the admin queue.
              </div>
            )
          )}

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setPreviewOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
