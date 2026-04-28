import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Save, X, Loader2, AlertCircle } from 'lucide-react';
import { getParent, listStudents, updateParent } from '../../services/people';
import Badge from '../../components/ui/Badge';
import {
  DetailSection, DetailField, DetailBool, formatDate, extractPerson,
} from '../../components/ui/DetailView';
import PersonPhotoBlock from '../../components/people/PersonPhotoBlock';

/**
 * Parent detail page — read-only view with inline edit toggle.
 *
 * Parents never had a dedicated edit route (ParentsPage used a modal).
 * Rather than retrofit a separate FormPage, this single page hosts both
 * view and edit modes so the detail→edit transition stays on one screen.
 */

const GENDERS = ['male', 'female', 'other'] as const;
const RELATIONSHIPS = ['father', 'mother', 'guardian'] as const;
const COMMUNICATION_PREFERENCES = ['call', 'sms', 'whatsapp', 'email'] as const;

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

interface ParentForm {
  name: string; phone: string; alternatePhone: string; email: string;
  gender: string; dob: string; aadhaar: string; preferredLanguage: string;
  biometricEnrolled: boolean;
  relationship: string; occupation: string; employer: string;
  annualIncomeBand: string; communicationPreference: string;
  primaryContact: boolean; isFeeResponsible: boolean;
  linkedStudents: string[];
  line1: string; line2: string; city: string; state: string; pincode: string;
  emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelationship: string;
}

const emptyForm: ParentForm = {
  name: '', phone: '', alternatePhone: '', email: '', gender: '', dob: '',
  aadhaar: '', preferredLanguage: '', biometricEnrolled: false,
  relationship: 'father', occupation: '', employer: '', annualIncomeBand: '',
  communicationPreference: 'call', primaryContact: false, isFeeResponsible: false,
  linkedStudents: [],
  line1: '', line2: '', city: '', state: '', pincode: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
};

function rowToForm(row: any): ParentForm {
  const person = row.person || row.personId || {};
  const address = person.address || {};
  const emergency = person.emergencyContact || {};
  return {
    name: person.name || '',
    phone: person.phone || '',
    alternatePhone: person.alternatePhone || '',
    email: person.email || '',
    gender: person.gender || '',
    dob: person.dob ? person.dob.substring(0, 10) : '',
    aadhaar: person.aadhaar || '',
    preferredLanguage: person.preferredLanguage || '',
    biometricEnrolled: !!person.biometricEnrolled,
    relationship: row.relationship || 'father',
    linkedStudents: (row.linkedStudents || []).map(
      (s: any) => typeof s === 'string' ? s : s._id,
    ),
    primaryContact: !!row.primaryContact,
    occupation: row.occupation || '',
    employer: row.employer || '',
    annualIncomeBand: row.annualIncomeBand || '',
    isFeeResponsible: !!row.isFeeResponsible,
    communicationPreference: row.communicationPreference || 'call',
    line1: address.line1 || '',
    line2: address.line2 || '',
    city: address.city || '',
    state: address.state || '',
    pincode: address.pincode || '',
    emergencyContactName: emergency.name || '',
    emergencyContactPhone: emergency.phone || '',
    emergencyContactRelationship: emergency.relationship || '',
  };
}

function formToPayload(form: ParentForm): any {
  const payload: any = { ...form };

  const address: any = {};
  (['line1', 'line2', 'city', 'state', 'pincode'] as const).forEach((k) => {
    if (payload[k]) address[k] = payload[k];
    delete payload[k];
  });
  if (Object.keys(address).length > 0) payload.address = address;

  const emergency: any = {};
  if (payload.emergencyContactName) emergency.name = payload.emergencyContactName;
  if (payload.emergencyContactPhone) emergency.phone = payload.emergencyContactPhone;
  if (payload.emergencyContactRelationship) emergency.relationship = payload.emergencyContactRelationship;
  delete payload.emergencyContactName;
  delete payload.emergencyContactPhone;
  delete payload.emergencyContactRelationship;
  if (Object.keys(emergency).length > 0) payload.emergencyContact = emergency;

  // Drop empty strings so the server doesn't overwrite fields with "".
  Object.keys(payload).forEach((k) => {
    if (payload[k] === '') delete payload[k];
  });
  return payload;
}

export default function ParentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<ParentForm>(emptyForm);

  const { data: p, isLoading, error } = useQuery({
    queryKey: ['parent', id],
    queryFn: () => getParent(id!),
    enabled: !!id,
  });

  // Preload all students once for the linked-students multiselect + name lookups.
  const { data: studentsData } = useQuery({
    queryKey: ['students-ref', 'all'],
    queryFn: () => listStudents(1, 200),
  });
  const studentOptions: any[] = studentsData?.items || [];
  const studentNameMap = useMemo(
    () => new Map(studentOptions.map((s) =>
      [s._id, s.person?.name || s.personId?.name || s.rollNumber || s._id],
    )),
    [studentOptions],
  );

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateParent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      qc.invalidateQueries({ queryKey: ['parent', id] });
      setEditMode(false);
    },
  });

  // Sync form state from the loaded record whenever it changes or we
  // re-enter edit mode (so Cancel reverts unsaved changes).
  useEffect(() => {
    if (p) setForm(rowToForm(p));
  }, [p]);

  function enterEdit() {
    if (p) setForm(rowToForm(p));
    setEditMode(true);
  }

  function cancelEdit() {
    if (p) setForm(rowToForm(p));
    setEditMode(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    updateMut.mutate({ id, data: formToPayload(form) });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <div className="text-gray-700 font-medium">Couldn't load parent</div>
        <Link to="/people/parents" className="inline-flex items-center gap-1 text-sm text-primary-600 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Parents
        </Link>
      </div>
    );
  }

  const person = extractPerson(p);
  const address = person.address || {};
  const emergency = person.emergencyContact || {};
  const linkedNames = (p.linkedStudents || [])
    .map((s: any) => studentNameMap.get(typeof s === 'string' ? s : s._id))
    .filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/people/parents" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Parents
          </Link>
          <h1 className="text-2xl font-bold text-navy">{person.name || 'Parent'}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            {p.relationship && (
              <Badge variant="purple">{p.relationship}</Badge>
            )}
            {p.primaryContact && <Badge variant="info">Primary contact</Badge>}
            {p.isFeeResponsible && <Badge variant="warning">Fee responsible</Badge>}
          </div>
        </div>
        {!editMode ? (
          <button
            type="button"
            onClick={enterEdit}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              type="submit"
              form="parent-edit-form"
              disabled={updateMut.isPending}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-60"
            >
              {updateMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* Profile photo — visible in both view and edit modes so the
          parent is identifiable immediately on load. */}
      {id && (
        <PersonPhotoBlock
          entityType="parents"
          entityId={id}
          personName={person.name}
        />
      )}

      {editMode ? (
        // ── Edit mode ─────────────────────────────────────
        <>
          {updateMut.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {(updateMut.error as any)?.response?.data?.error
                || (updateMut.error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ')
                || 'Something went wrong.'}
            </div>
          )}
          <form id="parent-edit-form" onSubmit={handleSubmit} className="space-y-4">
            <DetailSection title="Personal Information">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Phone *</label><input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Alternate Phone</label><input value={form.alternatePhone} onChange={e => setForm(f => ({ ...f, alternatePhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Gender</label><select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}><option value="">Select…</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label className={lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Aadhaar</label><input value={form.aadhaar} onChange={e => setForm(f => ({ ...f, aadhaar: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Preferred Language</label><input value={form.preferredLanguage} onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))} className={inp} /></div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                <input type="checkbox" checked={form.biometricEnrolled} onChange={e => setForm(f => ({ ...f, biometricEnrolled: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Biometric enrolled
              </label>
            </DetailSection>

            <DetailSection title="Relationship & Responsibility">
              <div><label className={lbl}>Relationship *</label><select required value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} className={inp}>{RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              <div><label className={lbl}>Occupation</label><input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Employer</label><input value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Annual Income Band</label><input value={form.annualIncomeBand} onChange={e => setForm(f => ({ ...f, annualIncomeBand: e.target.value }))} className={inp} placeholder="e.g. 5L–10L" /></div>
              <div><label className={lbl}>Communication Preference</label><select value={form.communicationPreference} onChange={e => setForm(f => ({ ...f, communicationPreference: e.target.value }))} className={inp}>{COMMUNICATION_PREFERENCES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                <input type="checkbox" checked={form.primaryContact} onChange={e => setForm(f => ({ ...f, primaryContact: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Primary contact
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                <input type="checkbox" checked={form.isFeeResponsible} onChange={e => setForm(f => ({ ...f, isFeeResponsible: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Fee responsible
              </label>
            </DetailSection>

            <section className="bg-white rounded-xl border shadow-sm">
              <header className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Linked Students</h3>
                <Link to="/people/students" target="_blank" className="text-xs text-primary-600 hover:underline">+ Manage</Link>
              </header>
              <div className="p-5">
                <select
                  multiple
                  value={form.linkedStudents}
                  onChange={e => setForm(f => ({
                    ...f,
                    linkedStudents: Array.from(e.target.selectedOptions).map(o => o.value),
                  }))}
                  className={`${inp} h-40`}
                >
                  {studentOptions.map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {(s.person?.name || s.personId?.name || 'Student')}
                      {s.rollNumber ? ` (${s.rollNumber})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Hold ⌘/Ctrl to select multiple.</p>
              </div>
            </section>

            <DetailSection title="Address & Emergency Contact">
              <div className="md:col-span-2"><label className={lbl}>Address Line 1</label><input value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Address Line 2</label><input value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Pincode</label><input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Contact Name</label><input value={form.emergencyContactName} onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Contact Phone</label><input value={form.emergencyContactPhone} onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Contact Relationship</label><input value={form.emergencyContactRelationship} onChange={e => setForm(f => ({ ...f, emergencyContactRelationship: e.target.value }))} className={inp} /></div>
            </DetailSection>
          </form>
        </>
      ) : (
        // ── View mode ─────────────────────────────────────
        <>
          <DetailSection title="Personal Information">
            <DetailField label="Full Name" value={person.name} />
            <DetailField label="Gender" value={person.gender} />
            <DetailField label="Date of Birth" value={formatDate(person.dob)} />
            <DetailField label="Phone" value={person.phone} />
            <DetailField label="Alternate Phone" value={person.alternatePhone} />
            <DetailField label="Email" value={person.email} />
            <DetailField label="Aadhaar" value={person.aadhaar} mono />
            <DetailField label="Preferred Language" value={person.preferredLanguage} />
            <DetailBool label="Biometric Enrolled" value={person.biometricEnrolled} />
          </DetailSection>

          <DetailSection title="Relationship & Responsibility">
            <DetailField label="Relationship" value={p.relationship} />
            <DetailField label="Occupation" value={p.occupation} />
            <DetailField label="Employer" value={p.employer} />
            <DetailField label="Annual Income Band" value={p.annualIncomeBand} />
            <DetailField label="Communication Preference" value={p.communicationPreference} />
            <DetailBool label="Primary Contact" value={p.primaryContact} />
            <DetailBool label="Fee Responsible" value={p.isFeeResponsible} />
          </DetailSection>

          <DetailSection title="Linked Students" columns={2}>
            <DetailField label={`Students (${linkedNames.length})`} wide>
              {linkedNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {linkedNames.map((n: unknown, i: number) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                      {String(n)}
                    </span>
                  ))}
                </div>
              ) : <span className="text-gray-400">No students linked</span>}
            </DetailField>
          </DetailSection>

          <DetailSection title="Address" columns={3}>
            <DetailField label="Address Line 1" value={address.line1} wide />
            <DetailField label="Address Line 2" value={address.line2} wide />
            <DetailField label="City" value={address.city} />
            <DetailField label="State" value={address.state} />
            <DetailField label="Pincode" value={address.pincode} />
          </DetailSection>

          <DetailSection title="Emergency Contact" columns={3}>
            <DetailField label="Name" value={emergency.name} />
            <DetailField label="Phone" value={emergency.phone} />
            <DetailField label="Relationship" value={emergency.relationship} />
          </DetailSection>
        </>
      )}
    </div>
  );
}
