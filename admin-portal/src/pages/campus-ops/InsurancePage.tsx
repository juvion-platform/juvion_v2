import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInsurances, createInsurance, updateInsurance, deleteInsurance } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function InsurancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ policyNumber:'', provider:'', type:'property', coverageAmount:'', premium:'', startDate:'', endDate:'', status:'active' });

  const { data, isLoading } = useQuery({ queryKey: ['insurances', page], queryFn: () => listInsurances(page, 20) });

  const createMut = useMutation({ mutationFn: createInsurance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurances'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInsurance(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurances'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteInsurance, onSuccess: () => qc.invalidateQueries({ queryKey: ['insurances'] }) });

  function openCreate() { setEditing(null); setForm({ policyNumber:'', provider:'', type:'property', coverageAmount:'', premium:'', startDate:'', endDate:'', status:'active' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ policyNumber: row.policyNumber||'', provider: row.provider||'', type: row.type||'property', coverageAmount: String(row.coverageAmount??''), premium: String(row.premium??''), startDate: row.startDate?.slice(0,10)||'', endDate: row.endDate?.slice(0,10)||'', status: row.status||'active' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.coverageAmount) payload.coverageAmount = Number(form.coverageAmount);
    if(form.premium) payload.premium = Number(form.premium);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'policyNumber', label: 'Policy #', render: (r: any) => <span className="font-medium text-navy">{r.policyNumber}</span> },
    { key: 'provider', label: 'Provider' },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'coverageAmount', label: 'Coverage', render: (r: any) => `\u20B9${(r.coverageAmount||0).toLocaleString()}` },
    { key: 'endDate', label: 'Expiry', render: (r: any) => r.endDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'success':r.status==='expired'?'danger':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Insurance Policies</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending||updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{createMut.isPending||updateMut.isPending?'Saving...':editing?'Update':'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
