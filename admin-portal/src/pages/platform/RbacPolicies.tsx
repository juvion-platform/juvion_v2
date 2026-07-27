import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRbacPolicies,
  createRbacPolicy,
  updateRbacPolicy,
  deleteRbacPolicy,
  RbacPolicy,
  RbacPolicyInput,
} from '../../services/rbacPolicies';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';

const ROLES = ['super_admin', 'admin', 'principal', 'hod', 'faculty', 'staff', 'student', 'parent', '*'] as const;
const MODULES = ['admissions', 'people', 'academics', 'finance', 'hr', 'welfare', 'placement', 'campus', 'student-dev', 'compliance', 'governance', 'platform', 'juvi', '*'] as const;
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', '*'] as const;

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

interface PolicyForm {
  role: string;
  personaType: string;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  priority: number;
  description: string;
  departmentOnly: boolean;
  selfOnly: boolean;
  subDomain: string;
  isActive: boolean;
}

const EMPTY_FORM: PolicyForm = {
  role: 'admin',
  personaType: '',
  module: 'admissions',
  action: 'read',
  effect: 'allow',
  priority: 100,
  description: '',
  departmentOnly: false,
  selfOnly: false,
  subDomain: '',
  isActive: true,
};

function isSystemDefault(p: RbacPolicy): boolean {
  return !p.collegeId && p.createdBy === 'seed';
}

export default function RbacPolicies() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search } = useListControls();
  const [filterRole, setFilterRole] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['rbac-policies', page, filterRole, filterModule, limit, search],
    queryFn: () => listRbacPolicies(page, 50, filterRole || undefined, filterModule || undefined),
  });

  const vem = useViewEditMode<RbacPolicy>({
    onOpenEntity: (row) => setForm({
      role: row.role,
      personaType: row.personaType || '',
      module: row.module,
      action: row.action,
      effect: row.effect,
      priority: row.priority,
      description: row.description || '',
      departmentOnly: row.scope?.departmentOnly || false,
      selfOnly: row.scope?.selfOnly || false,
      subDomain: row.scope?.subDomain || '',
      isActive: row.isActive,
    }),
    onOpenCreate: () => setForm(EMPTY_FORM),
    onClose: () => setForm(EMPTY_FORM),
  });

  const createMut = useMutation({
    mutationFn: createRbacPolicy,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-policies'] }); vem.close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Partial<RbacPolicyInput> }) => updateRbacPolicy(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-policies'] }); vem.close(); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteRbacPolicy,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-policies'] }); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: RbacPolicyInput = {
      role: form.role,
      personaType: form.personaType || null,
      module: form.module,
      action: form.action,
      effect: form.effect,
      priority: form.priority,
      description: form.description || undefined,
      isActive: form.isActive,
      scope: {
        departmentOnly: form.departmentOnly,
        selfOnly: form.selfOnly,
        subDomain: form.subDomain || undefined,
      },
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
      key: 'role',
      label: 'Role',
      render: (r: RbacPolicy) => <span className="font-medium text-navy">{r.role}</span>,
    },
    {
      key: 'personaType',
      label: 'PersonaType',
      render: (r: RbacPolicy) => r.personaType || <span className="text-gray-400">&mdash;</span>,
    },
    {
      key: 'module',
      label: 'Module',
      render: (r: RbacPolicy) => <Badge variant="info">{r.module}</Badge>,
    },
    {
      key: 'action',
      label: 'Action',
      render: (r: RbacPolicy) => r.action,
    },
    {
      key: 'effect',
      label: 'Effect',
      render: (r: RbacPolicy) => (
        <Badge variant={r.effect === 'allow' ? 'success' : 'danger'}>{r.effect}</Badge>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      render: (r: RbacPolicy) => {
        const badges: React.ReactNode[] = [];
        if (r.scope?.departmentOnly) badges.push(<Badge key="dept" variant="teal">dept-only</Badge>);
        if (r.scope?.selfOnly) badges.push(<Badge key="self" variant="orange">self-only</Badge>);
        if (r.scope?.subDomain) badges.push(<Badge key="sub" variant="purple">{r.scope.subDomain}</Badge>);
        return badges.length > 0 ? <div className="flex gap-1 flex-wrap">{badges}</div> : <span className="text-gray-400">&mdash;</span>;
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: RbacPolicy) => r.priority,
    },
    {
      key: 'type',
      label: 'Type',
      render: (r: RbacPolicy) =>
        isSystemDefault(r)
          ? <Badge variant="default">Default</Badge>
          : <Badge variant="purple">Override</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (r: RbacPolicy) => {
        if (isSystemDefault(r)) return null;
        return (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }}
              className="p-1 rounded hover:bg-amber-50"
              title="Edit"
            >
              <Pencil size={15} className="text-amber-500" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void confirmAction({ title: 'Delete this policy override?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })
              }}
              className="p-1 rounded hover:bg-red-50"
              title="Delete"
            >
              <Trash2 size={15} className="text-red-500" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex p-2 rounded-lg bg-purple-50 text-purple-600">
            <Shield size={22} />
          </div>
          <h2 className="text-xl font-bold text-navy">RBAC Policies</h2>
        </div>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> Create Override
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filterModule}
          onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
        >
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: RbacPolicy) => r._id}
        onRowClick={vem.openForView}
      />

      {/* Pagination */}
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {/* Create/Edit Modal */}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('RBAC Policy')} widthClass="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Role */}
              <div>
                <label className={lbl}>Role *</label>
                <select required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* PersonaType */}
              <div>
                <label className={lbl}>Persona Type</label>
                <input value={form.personaType} onChange={e => setForm(f => ({ ...f, personaType: e.target.value }))} placeholder="e.g. teaching_faculty" className={inp} />
              </div>

              {/* Module */}
              <div>
                <label className={lbl}>Module *</label>
                <select required value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className={inp}>
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Action */}
              <div>
                <label className={lbl}>Action *</label>
                <select required value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} className={inp}>
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Effect */}
              <div>
                <label className={lbl}>Effect *</label>
                <select required value={form.effect} onChange={e => setForm(f => ({ ...f, effect: e.target.value as 'allow' | 'deny' }))} className={inp}>
                  <option value="allow">allow</option>
                  <option value="deny">deny</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className={lbl}>Priority *</label>
                <input type="number" required min={1} max={999} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} className={inp} />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className={lbl}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className={inp} />
              </div>
            </div>

            {/* Scope */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-medium text-gray-700 px-1">Scope</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="departmentOnly" checked={form.departmentOnly} onChange={e => setForm(f => ({ ...f, departmentOnly: e.target.checked }))} />
                  <label htmlFor="departmentOnly" className="text-sm text-gray-700">Department only</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="selfOnly" checked={form.selfOnly} onChange={e => setForm(f => ({ ...f, selfOnly: e.target.checked }))} />
                  <label htmlFor="selfOnly" className="text-sm text-gray-700">Self only</label>
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Sub-domain</label>
                  <input value={form.subDomain} onChange={e => setForm(f => ({ ...f, subDomain: e.target.value }))} placeholder="e.g. fee-collection" className={inp} />
                </div>
              </div>
            </fieldset>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
            </div>
          </fieldset>

          {/* Footer */}
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
