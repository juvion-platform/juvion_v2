import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInsurances, createInsurance, updateInsurance, deleteInsurance } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { policyNumber:'', provider:'', type:'property', coverageAmount:'', premium:'', startDate:'', endDate:'', status:'active' };

export default function InsurancePage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['insurances', page, limit, search], queryFn: () => listInsurances(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ policyNumber: row.policyNumber||'', provider: row.provider||'', type: row.type||'property', coverageAmount: String(row.coverageAmount??''), premium: String(row.premium??''), startDate: row.startDate?.slice(0,10)||'', endDate: row.endDate?.slice(0,10)||'', status: row.status||'active' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createInsurance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurances'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInsurance(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurances'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteInsurance, onSuccess: () => qc.invalidateQueries({ queryKey: ['insurances'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.coverageAmount) payload.coverageAmount = Number(form.coverageAmount);
    if(form.premium) payload.premium = Number(form.premium);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'policyNumber', label: 'Policy #', render: (r: any) => <span className="font-medium text-navy">{r.policyNumber}</span> },
    { key: 'provider', label: 'Provider' },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'coverageAmount', label: 'Coverage', render: (r: any) => `\u20B9${(r.coverageAmount||0).toLocaleString()}` },
    { key: 'endDate', label: 'Expiry', render: (r: any) => r.endDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'success':r.status==='expired'?'danger':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Insurance Policies</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search insurance policies…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}/>

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Insurance Policy')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Policy # *</label><input required value={form.policyNumber} onChange={e=>setForm(fm=>({...fm,policyNumber:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Provider *</label><input required value={form.provider} onChange={e=>setForm(fm=>({...fm,provider:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="property">property</option><option value="vehicle">vehicle</option><option value="equipment">equipment</option><option value="liability">liability</option><option value="fire">fire</option><option value="student_group">student group</option></select></div>
              <div><label className={lbl}>Coverage *</label><input required type="number" min={0} value={form.coverageAmount} onChange={e=>setForm(fm=>({...fm,coverageAmount:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Premium *</label><input required type="number" min={0} value={form.premium} onChange={e=>setForm(fm=>({...fm,premium:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e=>setForm(fm=>({...fm,startDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>End Date *</label><input required type="date" value={form.endDate} onChange={e=>setForm(fm=>({...fm,endDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="active">active</option><option value="expired">expired</option><option value="claimed">claimed</option><option value="cancelled">cancelled</option></select></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">{vem.isView ? 'Close' : 'Cancel'}</button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Pencil size={14} /> Edit</button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
