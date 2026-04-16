import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listEnrollments, createEnrollment, listApplicants, uploadApplicantPhoto } from '../../services/admissions';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, ExternalLink, Camera, Loader2, Check, AlertTriangle } from 'lucide-react';

const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function EnrollmentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ applicantId: '', studentId: '', admissionDate: '', admittedBy: '', admissionType: 'fresh' });

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', page],
    queryFn: () => listEnrollments(page, 20),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({
    mutationFn: createEnrollment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); setModalOpen(false); },
  });

  // Photo upload for selected applicant
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoMut = useMutation({
    mutationFn: (file: File) => uploadApplicantPhoto(form.applicantId, file),
    onSuccess: (data) => {
      setPhotoPreview(data.photoUrl);
      qc.invalidateQueries({ queryKey: ['applicants-all'] });
    },
  });

  // Get selected applicant's photo status
  const selectedApplicant = (applicantsData?.items || []).find((a: any) => a._id === form.applicantId);
  const hasPhoto = !!(photoPreview || selectedApplicant?.photo);

  function handleApplicantChange(applicantId: string) {
    setForm(f => ({ ...f, applicantId }));
    const applicant = (applicantsData?.items || []).find((a: any) => a._id === applicantId);
    setPhotoPreview(applicant?.photo || null);
    photoMut.reset();
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form.applicantId) return;
    setPhotoPreview(URL.createObjectURL(file));
    photoMut.mutate(file);
  }

  function openModal() {
    setForm({ applicantId: '', studentId: '', admissionDate: new Date().toISOString().slice(0, 10), admittedBy: '', admissionType: 'fresh' });
    setPhotoPreview(null);
    photoMut.reset();
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({ ...form, studentId: form.studentId || undefined });
  }

  const columns = [
    { key: 'admissionType', label: 'Type', render: (r: any) => <Badge variant={r.admissionType === 'fresh' ? 'info' : 'warning'}>{r.admissionType}</Badge> },
    { key: 'admittedBy', label: 'Admitted By' },
    { key: 'admissionDate', label: 'Admission Date', render: (r: any) => new Date(r.admissionDate).toLocaleDateString() },
    { key: 'createdAt', label: 'Recorded', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Enrollments</h2>
        <button onClick={openModal} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Enrollment
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Enrollment">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload Section */}
          {form.applicantId && (
            <div className={`p-4 rounded-lg border-2 ${hasPhoto ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoMut.isPending}
                  className="relative group w-[80px] h-[80px] rounded-full border-2 border-dashed border-gray-300 hover:border-primary-400 flex items-center justify-center overflow-hidden bg-white transition-colors flex-shrink-0"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Applicant" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-2xl font-bold text-gray-300">{selectedApplicant?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    {photoMut.isPending ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
                <div className="text-sm flex-1">
                  <div className="font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    Applicant Photo <span className="text-red-500">*</span>
                    {hasPhoto && <Check size={14} className="text-emerald-600" />}
                  </div>
                  {photoMut.isPending && <p className="text-primary-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading...</p>}
                  {photoMut.isError && <p className="text-red-600 text-xs">Upload failed: {(photoMut.error as any)?.response?.data?.error || 'Error'}</p>}
                  {!hasPhoto && !photoMut.isPending && (
                    <p className="text-amber-700 flex items-center gap-1 text-xs"><AlertTriangle size={12} /> Photo is mandatory for enrollment. Click to upload.</p>
                  )}
                  {hasPhoto && !photoMut.isPending && (
                    <p className="text-emerald-700 text-xs">Photo uploaded. Click to replace.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {createMut.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {(createMut.error as any)?.response?.data?.error || 'Enrollment failed.'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Applicant *
                <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>
              </label>
              <select required value={form.applicantId} onChange={e => handleApplicantChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select applicant...</option>
                {(applicantsData?.items || []).map((a: any) => (
                  <option key={a._id} value={a._id}>{a.name || a.email || a._id} {a.photo ? '' : '(no photo)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Student
                <Link to="/people" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>
              </label>
              <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">None</option>
                {(studentsData?.items || []).map((s: any) => (
                  <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admission Date *</label>
              <input required type="date" value={form.admissionDate} onChange={e => setForm(f => ({ ...f, admissionDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admitted By *</label>
              <input required value={form.admittedBy} onChange={e => setForm(f => ({ ...f, admittedBy: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Officer name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select required value={form.admissionType} onChange={e => setForm(f => ({ ...f, admissionType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="fresh">Fresh</option>
                <option value="lateral">Lateral Entry</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || !hasPhoto} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending ? 'Saving...' : 'Enroll'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
