import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCCTVs, createCCTV, updateCCTV, deleteCCTV, listBuildings } from '../../services/campus-ops';
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

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { cameraId:'', location:'', buildingId:'', ipAddress:'', type:'indoor', status:'active', installedDate:'' };

export default function CCTVPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['cctvs', page, limit, search], queryFn: () => listCCTVs(page, limit, search) });
  const { data: bldgsData } = useQuery({ queryKey: ['buildings-ref','all'], queryFn: () => listBuildings(1, 200) });
  const bldgs = bldgsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ cameraId: row.cameraId||'', location: row.location||'', buildingId: row.buildingId?._id||row.buildingId||'', ipAddress: row.ipAddress||'', type: row.type||'indoor', status: row.status||'active', installedDate: row.installedDate?.slice(0,10)||'' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createCCTV, onSuccess: () => { qc.invalidateQueries({ queryKey: ['cctvs'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCCTV(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cctvs'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCCTV, onSuccess: () => qc.invalidateQueries({ queryKey: ['cctvs'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'cameraId', label: 'ID', render: (r: any) => <span className="font-medium text-navy">{r.cameraId}</span> },
    { key: 'location', label: 'Location' },
    { key: 'building', label: 'Building', render: (r: any) => r.buildingId?.name||'\u2014' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'success':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">CCTV Cameras</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search cctv cameras…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No cctv cameras match “${search}”.` : 'No cctv cameras yet.'}
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('CCTV Camera')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Camera ID *</label><input required value={form.cameraId} onChange={e=>setForm(fm=>({...fm,cameraId:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Location *</label><input required value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Building {!vem.isView && <Link to="/campus-ops/buildings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select value={form.buildingId} onChange={e=>setForm(fm=>({...fm,buildingId:e.target.value}))} className={inp}><option value="">Select...</option>{bldgs.map((x:any)=><option key={x._id} value={x._id}>{x.name||x.code}</option>)}</select></div>
              <div><label className={lbl}>IP Address</label><input value={form.ipAddress} onChange={e=>setForm(fm=>({...fm,ipAddress:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Type</label><select value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="">None</option><option value="indoor">indoor</option><option value="outdoor">outdoor</option><option value="ptz">ptz</option><option value="dome">dome</option></select></div>
              <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="active">active</option><option value="inactive">inactive</option><option value="maintenance">maintenance</option></select></div>
              <div><label className={lbl}>Installed</label><input type="date" value={form.installedDate} onChange={e=>setForm(fm=>({...fm,installedDate:e.target.value}))} className={inp}/></div>
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
