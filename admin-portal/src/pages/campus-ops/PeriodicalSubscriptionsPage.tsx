import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPeriodicalSubscriptions, createPeriodicalSubscription, updatePeriodicalSubscription, deletePeriodicalSubscription } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function PeriodicalSubscriptionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title:'', type:'journal', publisher:'', frequency:'monthly', issn:'', startDate:'', endDate:'', cost:'', isActive:true });

  const { data, isLoading } = useQuery({ queryKey: ['periodical-subscriptions', page], queryFn: () => listPeriodicalSubscriptions(page, 20) });

  const createMut = useMutation({ mutationFn: createPeriodicalSubscription, onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodical-subscriptions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePeriodicalSubscription(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodical-subscriptions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePeriodicalSubscription, onSuccess: () => qc.invalidateQueries({ queryKey: ['periodical-subscriptions'] }) });

  function openCreate() { setEditing(null); setForm({ title:'', type:'journal', publisher:'', frequency:'monthly', issn:'', startDate:'', endDate:'', cost:'', isActive:true }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ title: row.title||'', type: row.type||'journal', publisher: row.publisher||'', frequency: row.frequency||'monthly', issn: row.issn||'', startDate: row.startDate?.slice(0,10)||'', endDate: row.endDate?.slice(0,10)||'', cost: String(row.cost??''), isActive: row.isActive!==false }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.cost) payload.cost = Number(form.cost);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type' },
    { key: 'publisher', label: 'Publisher', render: (r: any) => r.publisher||'\u2014' },
    { key: 'frequency', label: 'Frequency', render: (r: any) => r.frequency||'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Periodical Subscriptions</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e=>setForm(fm=>({...fm,title:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="journal">journal</option><option value="magazine">magazine</option><option value="newspaper">newspaper</option></select></div>
            <div><label className={lbl}>Publisher</label><input value={form.publisher} onChange={e=>setForm(fm=>({...fm,publisher:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Frequency</label><select value={form.frequency} onChange={e=>setForm(fm=>({...fm,frequency:e.target.value}))} className={inp}><option value="">None</option><option value="daily">daily</option><option value="weekly">weekly</option><option value="fortnightly">fortnightly</option><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="annually">annually</option></select></div>
            <div><label className={lbl}>ISSN</label><input value={form.issn} onChange={e=>setForm(fm=>({...fm,issn:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Start Date</label><input type="date" value={form.startDate} onChange={e=>setForm(fm=>({...fm,startDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>End Date</label><input type="date" value={form.endDate} onChange={e=>setForm(fm=>({...fm,endDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Cost</label><input type="number" min={0} value={form.cost} onChange={e=>setForm(fm=>({...fm,cost:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e=>setForm(fm=>({...fm,isActive:e.target.value==='true'}))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
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
