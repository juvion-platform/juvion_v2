import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listVehicles, createVehicle, updateVehicle, deleteVehicle } from '../../services/campus-ops';
import { listStaff } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const TYPES = ['bus','van','car','ambulance','utility'] as const;
const FUEL = ['diesel','petrol','electric','cng'] as const;
const STATUSES = ['active','maintenance','retired'] as const;
const SC: Record<string,string> = { active:'success', maintenance:'warning', retired:'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { vehicleNumber:'', type:'bus', make:'', vehicleModel:'', capacity:'', fuelType:'diesel', driverId:'', insuranceExpiry:'', fitnessExpiry:'', status:'active' };

export default function VehiclesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['vehicles', page, limit, search], queryFn: () => listVehicles(page, limit, search) });
  const { data: staffData } = useQuery({ queryKey: ['staff','all'], queryFn: () => listStaff(1, 200) });
  const staff = staffData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (r) => setForm({ vehicleNumber:r.vehicleNumber||'', type:r.type||'bus', make:r.make||'', vehicleModel:r.vehicleModel||'', capacity:String(r.capacity??''), fuelType:r.fuelType||'diesel', driverId:r.driverId?._id||r.driverId||'', insuranceExpiry:r.insuranceExpiry?.slice(0,10)||'', fitnessExpiry:r.fitnessExpiry?.slice(0,10)||'', status:r.status||'active' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createVehicle, onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateVehicle(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteVehicle, onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p: any = { ...form };
    if(form.capacity) p.capacity = Number(form.capacity); else delete p.capacity;
    Object.keys(p).forEach(k => { if(p[k]==='') delete p[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: p });
    else createMut.mutate(p);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key:'vehicleNumber', label:'Vehicle #', render:(r:any)=><span className="font-medium text-navy">{r.vehicleNumber}</span> },
    { key:'type', label:'Type' }, { key:'make', label:'Make', render:(r:any)=>r.make||'\u2014' },
    { key:'fuelType', label:'Fuel', render:(r:any)=>r.fuelType||'\u2014' },
    { key:'status', label:'Status', render:(r:any)=><Badge variant={SC[r.status]||'default'}>{r.status}</Badge> },
    { key:'actions', label:'', render:(r:any)=>(<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Vehicles</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search vehicles…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New Vehicle</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No vehicles match “${search}”.` : 'No vehicles yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Vehicle')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Vehicle Number *</label><input required value={form.vehicleNumber} onChange={e=>setForm(f=>({...f,vehicleNumber:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className={inp}>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Make</label><input value={form.make} onChange={e=>setForm(f=>({...f,make:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Model</label><input value={form.vehicleModel} onChange={e=>setForm(f=>({...f,vehicleModel:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Capacity</label><input type="number" min={0} value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Fuel Type</label><select value={form.fuelType} onChange={e=>setForm(f=>({...f,fuelType:e.target.value}))} className={inp}>{FUEL.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Driver {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select value={form.driverId} onChange={e=>setForm(f=>({...f,driverId:e.target.value}))} className={inp}><option value="">None</option>{staff.map((s:any)=><option key={s._id} value={s._id}>{s.person?.name||s.employeeCode||s._id}</option>)}</select></div>
              <div><label className={lbl}>Insurance Expiry</label><input type="date" value={form.insuranceExpiry} onChange={e=>setForm(f=>({...f,insuranceExpiry:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Fitness Expiry</label><input type="date" value={form.fitnessExpiry} onChange={e=>setForm(f=>({...f,fitnessExpiry:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className={inp}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
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
