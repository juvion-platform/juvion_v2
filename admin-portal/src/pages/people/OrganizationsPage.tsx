import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { createOrganization, deleteOrganization, listOrganizations, updateOrganization } from '../../services/people';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const emptyForm = {
  name: '',
  type: '',
  address: '',
  contact: '',
  contactPersonName: '',
  contactPersonEmail: '',
  contactPersonPhone: '',
  partnershipType: '',
  status: 'active',
};

const STATUS_STYLE: Record<string, string> = {
  prospect: 'warning',
  active: 'success',
  inactive: 'default',
};

export default function OrganizationsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit } = useListControls();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', page, search, limit],
    queryFn: () => listOrganizations(page, limit, search || undefined),
  });

  const createMut = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      closeModal();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateOrganization(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      closeModal();
    },
  });
  const deleteMut = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
    },
  });

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || '',
      type: row.type || '',
      address: row.address || '',
      contact: row.contact || '',
      contactPersonName: row.contactPersonName || '',
      contactPersonEmail: row.contactPersonEmail || '',
      contactPersonPhone: row.contactPersonPhone || '',
      partnershipType: row.partnershipType || '',
      status: row.status || 'active',
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(key => {
      if (payload[key] === '') delete payload[key];
    });
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const error = createMut.error || updateMut.error;

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'partnershipType', label: 'Partnership', render: (row: any) => row.partnershipType || '—' },
    { key: 'contactPersonName', label: 'Contact Person', render: (row: any) => row.contactPersonName || '—' },
    { key: 'contact', label: 'Primary Contact', render: (row: any) => row.contact || row.contactPersonPhone || '—' },
    { key: 'profileCompleteness', label: 'Profile', render: (row: any) => {
      const score = row.profileCompleteness;
      if (!score) return '—';
      return (
        <div title={score.missing?.length ? `Missing: ${score.missing.join(', ')}` : 'Profile complete'}>
          <Badge variant={score.status === 'complete' ? 'success' : score.status === 'progressing' ? 'warning' : 'default'}>
            {score.percent}% complete
          </Badge>
        </div>
      );
    } },
    { key: 'status', label: 'Status', render: (row: any) => <Badge variant={STATUS_STYLE[row.status] || 'default'}>{row.status || '—'}</Badge> },
    { key: 'actions', label: '', render: (row: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete organization?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(row._id); } }) }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Organizations</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search organizations…" className="w-56" />
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Organization
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading}
        emptyMessage={search ? `No organizations match “${search}”.` : 'No organizations yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={open} onClose={closeModal} title={editing ? 'Edit Organization' : 'New Organization'} widthClass="max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={lbl}>Organization Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Type *</label><input required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp} placeholder="e.g. Company, Vendor, University" /></div>
            <div><label className={lbl}>Partnership Type</label><input value={form.partnershipType} onChange={e => setForm(f => ({ ...f, partnershipType: e.target.value }))} className={inp} placeholder="e.g. Placement, Internship, MoU" /></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}><option value="prospect">prospect</option><option value="active">active</option><option value="inactive">inactive</option></select></div>
            <div className="md:col-span-2"><label className={lbl}>Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inp} rows={3} /></div>
            <div><label className={lbl}>Primary Contact</label><input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} className={inp} placeholder="Main phone or email" /></div>
            <div><label className={lbl}>Contact Person Name</label><input value={form.contactPersonName} onChange={e => setForm(f => ({ ...f, contactPersonName: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Contact Person Email</label><input type="email" value={form.contactPersonEmail} onChange={e => setForm(f => ({ ...f, contactPersonEmail: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Contact Person Phone</label><input value={form.contactPersonPhone} onChange={e => setForm(f => ({ ...f, contactPersonPhone: e.target.value }))} className={inp} /></div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update Organization' : 'Create Organization'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
