import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCounseling, createCounseling } from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = { allotted: 'info', accepted: 'success', cancelled: 'danger', upgraded: 'warning' };

export default function CounselingPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ applicantId: '', round: '1', allotmentOrder: '', collegeCode: '', branchCode: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['counseling', page],
    queryFn: () => listCounseling(page, 20),
  });

  const createMut = useMutation({
    mutationFn: createCounseling,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling'] }); setModalOpen(false); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      applicantId: form.applicantId,
      round: Number(form.round),
      allotmentOrder: form.allotmentOrder ? Number(form.allotmentOrder) : undefined,
      collegeCode: form.collegeCode || undefined,
      branchCode: form.branchCode || undefined,
    });
  }

  const columns = [
    { key: 'round', label: 'Round' },
    { key: 'allotmentOrder', label: 'Allotment #', render: (r: any) => r.allotmentOrder || '—' },
    { key: 'collegeCode', label: 'College Code', render: (r: any) => r.collegeCode || '—' },
    { key: 'branchCode', label: 'Branch Code', render: (r: any) => r.branchCode || '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Counseling Allotments</h2>
        <button onClick={() => { setForm({ applicantId: '', round: '1', allotmentOrder: '', collegeCode: '', branchCode: '' }); setModalOpen(true); }} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> Add Allotment
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Counseling Allotment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Applicant ID *</label>
              <input required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Round *</label>
              <input required type="number" min={1} value={form.round} onChange={e => setForm(f => ({ ...f, round: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Allotment Order</label>
              <input type="number" value={form.allotmentOrder} onChange={e => setForm(f => ({ ...f, allotmentOrder: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">College Code</label>
              <input value={form.collegeCode} onChange={e => setForm(f => ({ ...f, collegeCode: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Branch Code</label>
              <input value={form.branchCode} onChange={e => setForm(f => ({ ...f, branchCode: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
