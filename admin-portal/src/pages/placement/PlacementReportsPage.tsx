import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlacementReports, createPlacementReport, deletePlacementReport, listPlacementSeasons } from '../../services/placement';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const REPORT_TYPES = ['company_wise', 'branch_wise', 'package_analysis', 'trend'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PlacementReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ placementSeasonId: '', reportType: 'company_wise' });

  const { data, isLoading } = useQuery({ queryKey: ['placement-reports', page], queryFn: () => listPlacementReports(page, 20) });
  const { data: seasons } = useQuery({ queryKey: ['placement-seasons-all'], queryFn: () => listPlacementSeasons(1, 100) });

  const createMut = useMutation({ mutationFn: createPlacementReport, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-reports'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePlacementReport, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-reports'] }); } });

  function openCreate() {
    setForm({ placementSeasonId: '', reportType: 'company_wise' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate(form);
  }

  const columns = [
    { key: 'reportType', label: 'Report Type', render: (r: any) => <Badge variant="info">{r.reportType}</Badge> },
    { key: 'placementSeasonId', label: 'Season', render: (r: any) => r.placementSeasonId?.name || '--' },
    { key: 'generatedAt', label: 'Generated', render: (r: any) => r.generatedAt ? new Date(r.generatedAt).toLocaleString() : '--' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this report?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Placement Reports</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> Generate Report</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title="Generate Report">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Season * <Link to="/placement/seasons" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.placementSeasonId} onChange={e => setForm(f => ({ ...f, placementSeasonId: e.target.value }))} className={inp}>
                <option value="">Select season</option>
                {(seasons?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Report Type *</label>
              <select required value={form.reportType} onChange={e => setForm(f => ({ ...f, reportType: e.target.value }))} className={inp}>
                {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
