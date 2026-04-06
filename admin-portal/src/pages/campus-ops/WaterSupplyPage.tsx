import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWaterSupplies, createWaterSupply, updateWaterSupply, deleteWaterSupply } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const SOURCE_OPTS = ['borewell','municipal','tanker','rainwater'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function WaterSupplyPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ source:'borewell', tankName:'', capacityLitres:'', currentLevel:'', location:'', lastCleaningDate:'', nextCleaningDate:'' });

  const { data, isLoading } = useQuery({ queryKey: ['water-supplies', page], queryFn: () => listWaterSupplies(page, 20) });

  const createMut = useMutation({ mutationFn: createWaterSupply, onSuccess: () => { qc.invalidateQueries({ queryKey: ['water-supplies'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateWaterSupply(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['water-supplies'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteWaterSupply, onSuccess: () => qc.invalidateQueries({ queryKey: ['water-supplies'] }) });

  function openCreate() { setEditing(null); setForm({ source:'borewell', tankName:'', capacityLitres:'', currentLevel:'', location:'', lastCleaningDate:'', nextCleaningDate:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ source: row.source||'borewell', tankName: row.tankName||'', capacityLitres: String(row.capacityLitres??''), currentLevel: String(row.currentLevel??''), location: row.location||'', lastCleaningDate: row.lastCleaningDate?.slice(0,10)||'', nextCleaningDate: row.nextCleaningDate?.slice(0,10)||'' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.capacityLitres) payload.capacityLitres = Number(form.capacityLitres);
    if(form.currentLevel) payload.currentLevel = Number(form.currentLevel);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'tankName', label: 'Tank', render: (r: any) => <span className="font-medium text-navy">{r.tankName}</span> },
    { key: 'source', label: 'Source' },
    { key: 'capacityLitres', label: 'Capacity (L)', render: (r: any) => r.capacityLitres?.toLocaleString()||'\u2014' },
    { key: 'currentLevel', label: 'Level', render: (r: any) => r.currentLevel!=null?r.currentLevel+'':'\u2014' },
    { key: 'location', label: 'Location', render: (r: any) => r.location||'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Water Supply</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Source *</label><select required value={form.source} onChange={e=>setForm(fm=>({...fm,source:e.target.value}))} className={inp}><option value="borewell">borewell</option><option value="municipal">municipal</option><option value="tanker">tanker</option><option value="rainwater">rainwater</option></select></div>
            <div><label className={lbl}>Tank Name *</label><input required value={form.tankName} onChange={e=>setForm(fm=>({...fm,tankName:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Capacity (L) *</label><input required type="number" min={0} value={form.capacityLitres} onChange={e=>setForm(fm=>({...fm,capacityLitres:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Current Level</label><input type="number" min={0} value={form.currentLevel} onChange={e=>setForm(fm=>({...fm,currentLevel:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Location</label><input value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Last Cleaning</label><input type="date" value={form.lastCleaningDate} onChange={e=>setForm(fm=>({...fm,lastCleaningDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Next Cleaning</label><input type="date" value={form.nextCleaningDate} onChange={e=>setForm(fm=>({...fm,nextCleaningDate:e.target.value}))} className={inp}/></div>
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
