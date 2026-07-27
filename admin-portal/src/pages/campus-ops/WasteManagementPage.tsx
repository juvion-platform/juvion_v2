import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWasteManagements, createWasteManagement, updateWasteManagement, deleteWasteManagement } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { date:'', wasteType:'dry', quantityKg:'', disposalMethod:'recycle', handledBy:'', vendorName:'', cost:'' };

export default function WasteManagementPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['waste-managements', page, limit, search], queryFn: () => listWasteManagements(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ date: row.date?.slice(0,10)||'', wasteType: row.wasteType||'dry', quantityKg: String(row.quantityKg??''), disposalMethod: row.disposalMethod||'recycle', handledBy: row.handledBy||'', vendorName: row.vendorName||'', cost: String(row.cost??'') }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createWasteManagement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-managements'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateWasteManagement(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-managements'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteWasteManagement, onSuccess: () => qc.invalidateQueries({ queryKey: ['waste-managements'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.quantityKg) payload.quantityKg = Number(form.quantityKg);
    if(form.cost) payload.cost = Number(form.cost);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'date', label: 'Date', render: (r: any) => r.date?.slice(0,10) },
    { key: 'wasteType', label: 'Type', render: (r: any) => <span className='font-medium text-navy'>{r.wasteType?.replace(/_/g,' ')}</span> },
    { key: 'quantityKg', label: 'Qty (kg)' },
    { key: 'disposalMethod', label: 'Disposal', render: (r: any) => r.disposalMethod?.replace(/_/g,' ') },
    { key: 'cost', label: 'Cost', render: (r: any) => r.cost?`\u20B9${r.cost.toLocaleString()}`:'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Waste Management</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search waste management…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No waste management match “${search}”.` : 'No waste management yet.'}
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Waste Record')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e=>setForm(fm=>({...fm,date:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Waste Type *</label><select required value={form.wasteType} onChange={e=>setForm(fm=>({...fm,wasteType:e.target.value}))} className={inp}><option value="dry">dry</option><option value="wet">wet</option><option value="e_waste">e waste</option><option value="hazardous">hazardous</option><option value="biomedical">biomedical</option></select></div>
              <div><label className={lbl}>Quantity (kg) *</label><input required type="number" min={0} value={form.quantityKg} onChange={e=>setForm(fm=>({...fm,quantityKg:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Disposal *</label><select required value={form.disposalMethod} onChange={e=>setForm(fm=>({...fm,disposalMethod:e.target.value}))} className={inp}><option value="recycle">recycle</option><option value="compost">compost</option><option value="incinerate">incinerate</option><option value="landfill">landfill</option><option value="vendor_pickup">vendor pickup</option></select></div>
              <div><label className={lbl}>Handled By</label><input value={form.handledBy} onChange={e=>setForm(fm=>({...fm,handledBy:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Vendor</label><input value={form.vendorName} onChange={e=>setForm(fm=>({...fm,vendorName:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Cost</label><input type="number" min={0} value={form.cost} onChange={e=>setForm(fm=>({...fm,cost:e.target.value}))} className={inp}/></div>
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
