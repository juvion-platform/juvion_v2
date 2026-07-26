import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAssets, createAsset, updateAsset, deleteAsset } from '../../services/campus-ops';
import { listDepartments } from '../../services/academics';
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

const emptyForm = { assetId:'', name:'', category:'furniture', departmentId:'', location:'', purchaseDate:'', purchaseCost:'', currentValue:'', vendor:'', warrantyExpiry:'', status:'in_stock' };

export default function AssetsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['assets', page, limit, search], queryFn: () => listAssets(page, limit, search) });
  const { data: deptsData } = useQuery({ queryKey: ['depts-ref','all'], queryFn: () => listDepartments(1, 200) });
  const depts = deptsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ assetId: row.assetId||'', name: row.name||'', category: row.category||'furniture', departmentId: row.departmentId?._id||row.departmentId||'', location: row.location||'', purchaseDate: row.purchaseDate?.slice(0,10)||'', purchaseCost: String(row.purchaseCost??''), currentValue: String(row.currentValue??''), vendor: row.vendor||'', warrantyExpiry: row.warrantyExpiry?.slice(0,10)||'', status: row.status||'in_stock' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAsset, onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAsset(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAsset, onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.purchaseCost) payload.purchaseCost = Number(form.purchaseCost);
    if(form.currentValue) payload.currentValue = Number(form.currentValue);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'assetId', label: 'Asset ID' },
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'category', label: 'Category', render: (r: any) => r.category?.replace(/_/g,' ') },
    { key: 'dept', label: 'Department', render: (r: any) => r.departmentId?.name||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='in_use'?'success':r.status==='disposed'?'danger':'warning'}>{r.status?.replace(/_/g,' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Assets</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search assets…" className="w-56" />
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Asset')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Asset ID *</label><input required value={form.assetId} onChange={e=>setForm(fm=>({...fm,assetId:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Category *</label><select required value={form.category} onChange={e=>setForm(fm=>({...fm,category:e.target.value}))} className={inp}><option value="furniture">furniture</option><option value="electronics">electronics</option><option value="it_equipment">it equipment</option><option value="lab_equipment">lab equipment</option><option value="vehicle">vehicle</option><option value="sports">sports</option><option value="other">other</option></select></div>
              <div><label className={lbl}>Department {!vem.isView && <Link to="/academics" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select value={form.departmentId} onChange={e=>setForm(fm=>({...fm,departmentId:e.target.value}))} className={inp}><option value="">Select...</option>{depts.map((x:any)=><option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
              <div><label className={lbl}>Location</label><input value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Purchase Date</label><input type="date" value={form.purchaseDate} onChange={e=>setForm(fm=>({...fm,purchaseDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Purchase Cost</label><input type="number" min={0} value={form.purchaseCost} onChange={e=>setForm(fm=>({...fm,purchaseCost:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Current Value</label><input type="number" min={0} value={form.currentValue} onChange={e=>setForm(fm=>({...fm,currentValue:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Vendor</label><input value={form.vendor} onChange={e=>setForm(fm=>({...fm,vendor:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Warranty Expiry</label><input type="date" value={form.warrantyExpiry} onChange={e=>setForm(fm=>({...fm,warrantyExpiry:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="in_use">in use</option><option value="in_stock">in stock</option><option value="maintenance">maintenance</option><option value="disposed">disposed</option><option value="lost">lost</option></select></div>
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
