import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMaintenanceSchedules, createMaintenanceSchedule, updateMaintenanceSchedule, deleteMaintenanceSchedule, listAssets } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPE_OPTS = ['preventive','corrective','predictive'] as const;
const FREQUENCY_OPTS = ['daily','weekly','monthly','quarterly','yearly'] as const;
const STATUS_OPTS = ['scheduled','overdue','completed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function MaintenanceSchedulesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ assetId:'', facilityName:'', type:'preventive', frequency:'monthly', lastDoneDate:'', nextDueDate:'', assignedTeam:'', status:'scheduled' });

  const { data, isLoading } = useQuery({ queryKey: ['maintenance-schedules', page], queryFn: () => listMaintenanceSchedules(page, 20) });
  const { data: assetsData } = useQuery({ queryKey: ['assets-ref','all'], queryFn: () => listAssets(1, 200) });
  const assets = assetsData?.items || [];

  const createMut = useMutation({ mutationFn: createMaintenanceSchedule, onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance-schedules'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMaintenanceSchedule(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance-schedules'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteMaintenanceSchedule, onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-schedules'] }) });

  function openCreate() { setEditing(null); setForm({ assetId:'', facilityName:'', type:'preventive', frequency:'monthly', lastDoneDate:'', nextDueDate:'', assignedTeam:'', status:'scheduled' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ assetId: row.assetId?._id||row.assetId||'', facilityName: row.facilityName||'', type: row.type||'preventive', frequency: row.frequency||'monthly', lastDoneDate: row.lastDoneDate?.slice(0,10)||'', nextDueDate: row.nextDueDate?.slice(0,10)||'', assignedTeam: row.assignedTeam||'', status: row.status||'scheduled' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'facilityName', label: 'Facility', render: (r: any) => <span className="font-medium text-navy">{r.facilityName}</span> },
    { key: 'type', label: 'Type' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'nextDueDate', label: 'Next Due', render: (r: any) => r.nextDueDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='completed'?'success':r.status==='overdue'?'danger':'info'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Maintenance Schedules</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Asset <Link to="/campus-ops/assets" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.assetId} onChange={e=>setForm(fm=>({...fm,assetId:e.target.value}))} className={inp}><option value="">Select...</option>{assets.map((x:any)=><option key={x._id} value={x._id}>{x.name||x.assetId}</option>)}</select></div>
            <div><label className={lbl}>Facility Name *</label><input required value={form.facilityName} onChange={e=>setForm(fm=>({...fm,facilityName:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="preventive">preventive</option><option value="corrective">corrective</option><option value="predictive">predictive</option></select></div>
            <div><label className={lbl}>Frequency *</label><select required value={form.frequency} onChange={e=>setForm(fm=>({...fm,frequency:e.target.value}))} className={inp}><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="yearly">yearly</option></select></div>
            <div><label className={lbl}>Last Done</label><input type="date" value={form.lastDoneDate} onChange={e=>setForm(fm=>({...fm,lastDoneDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Next Due</label><input type="date" value={form.nextDueDate} onChange={e=>setForm(fm=>({...fm,nextDueDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Assigned Team</label><input value={form.assignedTeam} onChange={e=>setForm(fm=>({...fm,assignedTeam:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="scheduled">scheduled</option><option value="overdue">overdue</option><option value="completed">completed</option></select></div>
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
