import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listIQACReports, createIQACReport, updateIQACReport, deleteIQACReport } from '../../services/compliance';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import EntityPicker from '../../components/ui/EntityPicker';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const REPORT_TYPES = ['aqar', 'ssr', 'annual_report', 'best_practices', 'feedback_analysis'] as const;
const STATUSES = ['draft', 'review', 'submitted', 'accepted'] as const;
const STATUS_COLOR: Record<string, string> = { draft: 'default', review: 'warning', submitted: 'info', accepted: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  academicYearId: '', reportType: 'aqar' as string, submittedDate: '', status: 'draft' as string,
};

export default function IQACReportsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['iqac-reports', page, limit, search], queryFn: () => listIQACReports(page, limit, undefined, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      reportType: row.reportType || 'aqar',
      submittedDate: row.submittedDate?.slice(0, 10) || '',
      status: row.status || 'draft',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createIQACReport, onSuccess: () => { qc.invalidateQueries({ queryKey: ['iqac-reports'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateIQACReport(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['iqac-reports'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteIQACReport, onSuccess: () => { qc.invalidateQueries({ queryKey: ['iqac-reports'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.submittedDate) delete payload.submittedDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'reportType', label: 'Report Type', render: (r: any) => <Badge variant="info">{r.reportType?.toUpperCase()}</Badge> },
    { key: 'academicYear', label: 'Academic Year', render: (r: any) => <span className="font-medium text-navy">{r.academicYearId?.label || r.academicYearId || '\u2014'}</span> },
    { key: 'submittedDate', label: 'Submitted', render: (r: any) => r.submittedDate ? new Date(r.submittedDate).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this report?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">IQAC Reports</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search iqac reports…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Report
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No iqac reports match “${search}”.` : 'No iqac reports yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('IQAC Report')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl} htmlFor="iqac-year">Academic Year *</label>
                <EntityPicker
                  id="iqac-year"
                  required
                  disabled={vem.isView}
                  queryKey={['academic-years', 'picker']}
                  fetcher={(q) => listAcademicYears(1, 20, q || undefined)}
                  value={form.academicYearId}
                  onChange={(v) => setForm(f => ({ ...f, academicYearId: v }))}
                  getId={(x: any) => x._id}
                  getLabel={(y: any) => y.label || y.code || y._id}
                  getHint={(y: any) => y.startDate ? new Date(y.startDate).getFullYear().toString() : undefined}
                  fallbackLabel={vem.entity?.academicYearId?.label}
                  placeholder="Search academic year"
                />
              </div>
              <div><label className={lbl}>Report Type *</label>
                <select required value={form.reportType} onChange={e => setForm(f => ({ ...f, reportType: e.target.value }))} className={inp}>
                  {REPORT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Submitted Date</label>
                <input type="date" value={form.submittedDate} onChange={e => setForm(f => ({ ...f, submittedDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
