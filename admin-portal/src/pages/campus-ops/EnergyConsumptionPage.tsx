import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEnergyConsumptions, createEnergyConsumption, updateEnergyConsumption, deleteEnergyConsumption, listBuildings } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';


const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function EnergyConsumptionPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ buildingId:'', month:'', year:'', electricityUnits:'', electricityCost:'', waterUnits:'', waterCost:'', solarGenerated:'' });

  const { data, isLoading } = useQuery({ queryKey: ['energy-consumptions', page], queryFn: () => listEnergyConsumptions(page, 20) });
  const { data: bldgsData } = useQuery({ queryKey: ['buildings-ref','all'], queryFn: () => listBuildings(1, 200) });
  const bldgs = bldgsData?.items || [];

  const createMut = useMutation({ mutationFn: createEnergyConsumption, onSuccess: () => { qc.invalidateQueries({ queryKey: ['energy-consumptions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEnergyConsumption(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['energy-consumptions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteEnergyConsumption, onSuccess: () => qc.invalidateQueries({ queryKey: ['energy-consumptions'] }) });

  function openCreate() { setEditing(null); setForm({ buildingId:'', month:'', year:'', electricityUnits:'', electricityCost:'', waterUnits:'', waterCost:'', solarGenerated:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ buildingId: row.buildingId?._id||row.buildingId||'', month: String(row.month??''), year: String(row.year??''), electricityUnits: String(row.electricityUnits??''), electricityCost: String(row.electricityCost??''), waterUnits: String(row.waterUnits??''), waterCost: String(row.waterCost??''), solarGenerated: String(row.solarGenerated??'') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.month) payload.month = Number(form.month);
    if(form.year) payload.year = Number(form.year);
    if(form.electricityUnits) payload.electricityUnits = Number(form.electricityUnits);
    if(form.electricityCost) payload.electricityCost = Number(form.electricityCost);
    if(form.waterUnits) payload.waterUnits = Number(form.waterUnits);
    if(form.waterCost) payload.waterCost = Number(form.waterCost);
    if(form.solarGenerated) payload.solarGenerated = Number(form.solarGenerated);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'building', label: 'Building', render: (r: any) => r.buildingId?.name||'All' },
    { key: 'period', label: 'Period', render: (r: any) => `${r.month}/${r.year}` },
    { key: 'electricity', label: 'Electricity', render: (r: any) => `${r.electricityUnits||0} units` },
    { key: 'elecCost', label: 'Elec. Cost', render: (r: any) => `\u20B9${(r.electricityCost||0).toLocaleString()}` },
    { key: 'water', label: 'Water', render: (r: any) => `${r.waterUnits||0} units` },
    { key: 'solar', label: 'Solar', render: (r: any) => `${r.solarGenerated||0} units` },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Energy Consumption</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Building <Link to="/campus-ops/buildings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.buildingId} onChange={e=>setForm(fm=>({...fm,buildingId:e.target.value}))} className={inp}><option value="">Select...</option>{bldgs.map((x:any)=><option key={x._id} value={x._id}>{x.name||x.code}</option>)}</select></div>
            <div><label className={lbl}>Month *</label><input required type="number" min={0} value={form.month} onChange={e=>setForm(fm=>({...fm,month:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Year *</label><input required type="number" min={0} value={form.year} onChange={e=>setForm(fm=>({...fm,year:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Electricity (units)</label><input type="number" min={0} value={form.electricityUnits} onChange={e=>setForm(fm=>({...fm,electricityUnits:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Electricity Cost</label><input type="number" min={0} value={form.electricityCost} onChange={e=>setForm(fm=>({...fm,electricityCost:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Water (units)</label><input type="number" min={0} value={form.waterUnits} onChange={e=>setForm(fm=>({...fm,waterUnits:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Water Cost</label><input type="number" min={0} value={form.waterCost} onChange={e=>setForm(fm=>({...fm,waterCost:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Solar Generated</label><input type="number" min={0} value={form.solarGenerated} onChange={e=>setForm(fm=>({...fm,solarGenerated:e.target.value}))} className={inp}/></div>
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
