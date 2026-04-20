import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLabs, createLab, updateLab, deleteLab, listRooms } from '../../services/campus-ops';
import { listDepartments } from '../../services/academics';
import { listFaculty } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { roomId:'', name:'', departmentId:'', labInChargeId:'', capacity:'', isActive:true };

export default function LabsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['labs', page], queryFn: () => listLabs(page, 20) });
  const { data: roomsData } = useQuery({ queryKey: ['rooms-ref','all'], queryFn: () => listRooms(1, 200) });
  const { data: deptsData } = useQuery({ queryKey: ['depts-ref','all'], queryFn: () => listDepartments(1, 200) });
  const { data: facultyData } = useQuery({ queryKey: ['faculty-ref','all'], queryFn: () => listFaculty(1, 200) });
  const rooms = roomsData?.items || [];
  const depts = deptsData?.items || [];
  const faculty = facultyData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ roomId: row.roomId?._id||row.roomId||'', name: row.name||'', departmentId: row.departmentId?._id||row.departmentId||'', labInChargeId: row.labInChargeId?._id||row.labInChargeId||'', capacity: String(row.capacity??''), isActive: row.isActive!==false }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createLab, onSuccess: () => { qc.invalidateQueries({ queryKey: ['labs'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLab(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['labs'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteLab, onSuccess: () => qc.invalidateQueries({ queryKey: ['labs'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.capacity) payload.capacity = Number(form.capacity);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'room', label: 'Room', render: (r: any) => r.roomId?.roomNumber||'\u2014' },
    { key: 'dept', label: 'Department', render: (r: any) => r.departmentId?.name||'\u2014' },
    { key: 'capacity', label: 'Capacity', render: (r: any) => r.capacity||'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Labs</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Lab')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Room * {!vem.isView && <Link to="/campus-ops/rooms" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select required value={form.roomId} onChange={e=>setForm(fm=>({...fm,roomId:e.target.value}))} className={inp}><option value="">Select...</option>{rooms.map((x:any)=><option key={x._id} value={x._id}>{x.roomNumber}</option>)}</select></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Department {!vem.isView && <Link to="/academics" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select value={form.departmentId} onChange={e=>setForm(fm=>({...fm,departmentId:e.target.value}))} className={inp}><option value="">Select...</option>{depts.map((x:any)=><option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
              <div><label className={lbl}>Lab In-Charge {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select value={form.labInChargeId} onChange={e=>setForm(fm=>({...fm,labInChargeId:e.target.value}))} className={inp}><option value="">Select...</option>{faculty.map((x:any)=><option key={x._id} value={x._id}>{x.person?.name||x.employeeCode||x._id}</option>)}</select></div>
              <div><label className={lbl}>Capacity</label><input type="number" min={0} value={form.capacity} onChange={e=>setForm(fm=>({...fm,capacity:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e=>setForm(fm=>({...fm,isActive:e.target.value==='true'}))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
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
