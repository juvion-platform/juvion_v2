import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSecurityIncidents, createSecurityIncident, updateSecurityIncident, deleteSecurityIncident } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function SecurityIncidentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ reportedBy:'', incidentDate:'', location:'', type:'other', description:'', severity:'low', actionTaken:'', status:'reported' });

  const { data, isLoading } = useQuery({ queryKey: ['security-incidents', page], queryFn: () => listSecurityIncidents(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createSecurityIncident, onSuccess: () => { qc.invalidateQueries({ queryKey: ['security-incidents'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSecurityIncident(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['security-incidents'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteSecurityIncident, onSuccess: () => qc.invalidateQueries({ queryKey: ['security-incidents'] }) });

  function openCreate() { setEditing(null); setForm({ reportedBy:'', incidentDate:'', location:'', type:'other', description:'', severity:'low', actionTaken:'', status:'reported' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ reportedBy: row.reportedBy?._id||row.reportedBy||'', incidentDate: row.incidentDate?.slice(0,10)||'', location: row.location||'', type: row.type||'other', description: row.description||'', severity: row.severity||'low', actionTaken: row.actionTaken||'', status: row.status||'reported' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'type', label: 'Type', render: (r: any) => <span className="font-medium text-navy">{r.type}</span> },
    { key: 'reportedBy', label: 'Reporter', render: (r: any) => r.reportedBy?.name||'\u2014' },
    { key: 'date', label: 'Date', render: (r: any) => r.incidentDate?.slice(0,10) },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={r.severity==='critical'?'danger':r.severity==='high'?'warning':'default'}>{r.severity}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='resolved'?'success':'info'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Security Incidents</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Reported By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.reportedBy} onChange={e=>setForm(fm=>({...fm,reportedBy:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Date *</label><input required type="date" value={form.incidentDate} onChange={e=>setForm(fm=>({...fm,incidentDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Location *</label><input required value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="theft">theft</option><option value="vandalism">vandalism</option><option value="trespassing">trespassing</option><option value="fire">fire</option><option value="accident">accident</option><option value="other">other</option></select></div>
            <div className="col-span-2"><label className={lbl}>Description *</label><textarea required value={form.description} onChange={e=>setForm(fm=>({...fm,description:e.target.value}))} className={inp} rows={3}/></div>
            <div><label className={lbl}>Severity</label><select value={form.severity} onChange={e=>setForm(fm=>({...fm,severity:e.target.value}))} className={inp}><option value="">None</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></div>
            <div><label className={lbl}>Action Taken</label><input value={form.actionTaken} onChange={e=>setForm(fm=>({...fm,actionTaken:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="reported">reported</option><option value="investigating">investigating</option><option value="resolved">resolved</option><option value="closed">closed</option></select></div>
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
