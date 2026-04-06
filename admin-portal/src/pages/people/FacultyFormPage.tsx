import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFaculty, createFaculty, updateFaculty } from '../../services/people';
import { listDepartments } from '../../services/academics';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const STATUSES = ['active', 'on_leave', 'separated'] as const;
const CONTRACT_TYPES = ['regular', 'contract', 'adjunct', 'visiting'] as const;
const GENDERS = ['male', 'female', 'other'] as const;

const emptyForm = {
  name: '', phone: '', email: '', gender: '', dob: '', aadhaar: '',
  employeeCode: '', designation: '', specialization: '', qualification: '',
  departmentId: '', contractType: 'regular', status: 'active',
  // Address
  line1: '', line2: '', city: '', state: '', pincode: '',
};

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function FacultyFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['faculty-single', id],
    queryFn: () => getFaculty(id!),
    enabled: isEdit,
  });

  const { data: departmentsData } = useQuery({ queryKey: ['departments'], queryFn: () => listDepartments(1, 200) });

  useEffect(() => {
    if (existing) {
      const p = existing.person || existing.personId || {};
      const addr = p.address || {};
      setForm({
        name: p.name || '', phone: p.phone || '', email: p.email || '', gender: p.gender || '',
        dob: p.dob ? p.dob.substring(0, 10) : '', aadhaar: p.aadhaar || '',
        employeeCode: existing.employeeCode || '', designation: existing.designation || '',
        specialization: existing.specialization || '', qualification: existing.qualification || '',
        departmentId: existing.departmentId?._id || existing.departmentId || '',
        contractType: existing.contractType || 'regular', status: existing.status || 'active',
        line1: addr.line1 || '', line2: addr.line2 || '', city: addr.city || '',
        state: addr.state || '', pincode: addr.pincode || '',
      });
    }
  }, [existing]);

  const createMut = useMutation({
    mutationFn: createFaculty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); navigate('/people/faculty'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateFaculty(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty'] }); qc.invalidateQueries({ queryKey: ['faculty-single', id] }); navigate('/people/faculty'); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    const address: any = {};
    ['line1', 'line2', 'city', 'state', 'pincode'].forEach(k => { if ((payload as any)[k]) address[k] = (payload as any)[k]; delete (payload as any)[k]; });
    if (Object.keys(address).length > 0) payload.address = address;
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
    if (isEdit) updateMut.mutate({ id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const error = createMut.error || updateMut.error;

  if (isEdit && loadingExisting) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/people/faculty')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={20} className="text-gray-500" /></button>
          <div>
            <h2 className="text-xl font-bold text-navy">{isEdit ? 'Edit Faculty' : 'New Faculty'}</h2>
            {isEdit && existing && (
              <p className="text-sm text-gray-500 mt-0.5">{(existing.person || existing.personId)?.name} &middot; {existing.employeeCode}</p>
            )}
          </div>
        </div>
        <button type="submit" form="faculty-form" disabled={saving}
          className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-white" />}
          {saving ? 'Saving...' : isEdit ? 'Update Faculty' : 'Create Faculty'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
        </div>
      )}

      <form id="faculty-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Personal Information</h3>
            <p className="text-xs text-gray-500 mt-0.5">Basic identity and contact details</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={lbl}>Name <span className="text-red-500">*</span></label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Full name" /></div>
            <div><label className={lbl}>Phone <span className="text-red-500">*</span></label><input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="10-digit mobile" /></div>
            <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Gender</label><select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}><option value="">Select...</option>{GENDERS.map(g => <option key={g} value={g} className="capitalize">{g}</option>)}</select></div>
            <div><label className={lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Aadhaar</label><input value={form.aadhaar} onChange={e => setForm(f => ({ ...f, aadhaar: e.target.value }))} className={inp} maxLength={12} placeholder="12-digit Aadhaar" /></div>
          </div>
        </section>

        {/* Address */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Address</h3>
            <p className="text-xs text-gray-500 mt-0.5">Residential address</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2"><label className={lbl}>Address Line 1</label><input value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} className={inp} placeholder="House/Flat, Street" /></div>
            <div><label className={lbl}>Address Line 2</label><input value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} className={inp} placeholder="Area, Landmark" /></div>
            <div><label className={lbl}>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Pincode</label><input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} className={inp} maxLength={6} /></div>
          </div>
        </section>

        {/* Employment Details */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Employment Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Role, qualification, and contract information</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={lbl}>Employee Code <span className="text-red-500">*</span></label><input required value={form.employeeCode} onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))} className={inp} placeholder="e.g. FAC-001" /></div>
            <div><label className={lbl}>Designation <span className="text-red-500">*</span></label><input required value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className={inp} placeholder="e.g. Associate Professor" /></div>
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Department</label><Link to="/academics/departments" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(departmentsData?.items || []).map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Qualification</label><input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} className={inp} placeholder="e.g. Ph.D, M.Tech" /></div>
            <div><label className={lbl}>Specialization</label><input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className={inp} placeholder="e.g. Data Science, AI/ML" /></div>
            <div><label className={lbl}>Contract Type</label><select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))} className={inp}>{CONTRACT_TYPES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}</select></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>{STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
          </div>
        </section>

        {/* Bottom save */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-white" />}
            {saving ? 'Saving...' : isEdit ? 'Update Faculty' : 'Create Faculty'}
          </button>
        </div>
      </form>
    </div>
  );
}
