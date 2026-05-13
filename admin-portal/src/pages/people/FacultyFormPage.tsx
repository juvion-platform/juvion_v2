import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFaculty, createFaculty, updateFaculty } from '../../services/people';
import { listDepartments } from '../../services/academics';
import { ArrowLeft, Save, Loader2, ExternalLink } from 'lucide-react';

const STATUSES = ['active', 'on_leave', 'separated'] as const;
const CONTRACT_TYPES = ['regular', 'contract', 'adjunct', 'visiting'] as const;
const GENDERS = ['male', 'female', 'other'] as const;

/**
 * The 33 external credential IDs from Strategic Gap 1 (Faculty Profile
 * depth) — see .captain/specs/faculty-profile-depth/spec.md §AC-IDs.
 * Grouped into 5 visual sections so the Research IDs tab stays
 * scannable. Keys match the backend `IFacultyExternalIds` field names
 * one-for-one — do NOT diverge or Zod will silently strip them.
 */
type ExternalIdKey =
  | 'aicte' | 'aishe' | 'shodhganga' | 'irins' | 'vidwan'
  | 'orcid' | 'scopus' | 'webOfScience' | 'researchGate' | 'googleScholar'
  | 'researcherId' | 'clarivate' | 'academia' | 'semanticScholar' | 'publons'
  | 'ssrn' | 'elsevierReviewer' | 'springerReviewer'
  | 'swayam' | 'nptel' | 'nptelLearner' | 'atal'
  | 'github' | 'hackerRank' | 'hackerEarth' | 'leetCode' | 'replit'
  | 'codeChef' | 'exercism' | 'codecademy'
  | 'linkedIn' | 'youtube' | 'website';

interface IdGroup {
  title: string;
  description: string;
  fields: ReadonlyArray<{ key: ExternalIdKey; label: string; placeholder?: string; helper?: string }>;
}

const EXTERNAL_ID_GROUPS: ReadonlyArray<IdGroup> = [
  {
    title: 'Indian regulators & portals',
    description: 'NAAC peer-team and AICTE compliance.',
    fields: [
      { key: 'aicte',      label: 'AICTE ID',      placeholder: 'e.g. 1-2345678910' },
      { key: 'aishe',      label: 'AISHE ID',      placeholder: 'All India Survey on Higher Ed' },
      { key: 'shodhganga', label: 'Shodhganga ID', placeholder: 'Thesis repository profile' },
      { key: 'irins',      label: 'IRINS ID',      placeholder: 'irins.org profile' },
      { key: 'vidwan',     label: 'Vidwan ID',     placeholder: 'vidwan.inflibnet.ac.in' },
    ],
  },
  {
    title: 'International research',
    description: 'Profile / author IDs across research-indexing platforms.',
    fields: [
      { key: 'orcid',            label: 'ORCID',             placeholder: '0000-0000-0000-0000' },
      { key: 'scopus',           label: 'Scopus Author ID',  placeholder: 'e.g. 57000000000' },
      { key: 'webOfScience',     label: 'Web of Science',    placeholder: 'ResearcherID / WoS ID' },
      { key: 'researchGate',     label: 'ResearchGate',      placeholder: 'Profile URL or handle' },
      { key: 'googleScholar',    label: 'Google Scholar',    placeholder: 'scholar user id' },
      { key: 'researcherId',     label: 'ResearcherID',      placeholder: 'Legacy Clarivate ID' },
      { key: 'clarivate',        label: 'Clarivate',         placeholder: 'Profile ID' },
      { key: 'academia',         label: 'Academia.edu',      placeholder: 'Profile URL' },
      { key: 'semanticScholar',  label: 'Semantic Scholar',  placeholder: 'Author ID' },
      { key: 'publons',          label: 'Publons',           placeholder: 'Publons profile' },
      { key: 'ssrn',             label: 'SSRN Author',       placeholder: 'ssrn.com/author=...' },
      { key: 'elsevierReviewer', label: 'Elsevier Reviewer', placeholder: 'Reviewer recognition ID' },
      { key: 'springerReviewer', label: 'Springer Reviewer', placeholder: 'Reviewer recognition ID' },
    ],
  },
  {
    title: 'MOOC & learning',
    description: 'Instructor and learner profiles on national MOOC platforms.',
    fields: [
      { key: 'swayam',       label: 'Swayam',         placeholder: 'Instructor profile' },
      { key: 'nptel',        label: 'NPTEL (instructor)' },
      { key: 'nptelLearner', label: 'NPTEL (learner)' },
      { key: 'atal',         label: 'ATAL',           placeholder: 'Faculty development portal' },
    ],
  },
  {
    title: 'Code platforms',
    description: 'Public developer profiles — relevant for CS faculty.',
    fields: [
      { key: 'github',       label: 'GitHub',       placeholder: 'username' },
      { key: 'hackerRank',   label: 'HackerRank',   placeholder: 'username' },
      { key: 'hackerEarth',  label: 'HackerEarth',  placeholder: 'username' },
      { key: 'leetCode',     label: 'LeetCode',     placeholder: 'username' },
      { key: 'replit',       label: 'Replit',       placeholder: 'username' },
      { key: 'codeChef',     label: 'CodeChef',     placeholder: 'username' },
      { key: 'exercism',     label: 'Exercism',     placeholder: 'username' },
      { key: 'codecademy',   label: 'Codecademy',   placeholder: 'username' },
    ],
  },
  {
    title: 'Social & web',
    description: 'Public web presence.',
    fields: [
      { key: 'linkedIn', label: 'LinkedIn', placeholder: 'Profile URL' },
      { key: 'youtube',  label: 'YouTube',  placeholder: 'Channel URL' },
      { key: 'website',  label: 'Website',  placeholder: 'https://…' },
    ],
  },
];

type FormTabKey = 'profile' | 'academic' | 'research';
const FORM_TABS: ReadonlyArray<{ key: FormTabKey; label: string }> = [
  { key: 'profile',  label: 'Profile' },
  { key: 'academic', label: 'Employment' },
  { key: 'research', label: 'Research IDs' },
];

type ExternalIdsForm = Record<ExternalIdKey, string>;
const EMPTY_EXTERNAL_IDS: ExternalIdsForm = Object.fromEntries(
  EXTERNAL_ID_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, ''])),
) as ExternalIdsForm;

const emptyForm = {
  name: '', phone: '', alternatePhone: '', email: '', gender: '', dob: '', aadhaar: '', preferredLanguage: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', biometricEnrolled: false,
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
  const [externalIds, setExternalIds] = useState<ExternalIdsForm>(EMPTY_EXTERNAL_IDS);
  const [formTab, setFormTab] = useState<FormTabKey>('profile');
  const [validationError, setValidationError] = useState('');

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
      const emergency = p.emergencyContact || {};
      setForm({
        name: p.name || '', phone: p.phone || '', alternatePhone: p.alternatePhone || '', email: p.email || '', gender: p.gender || '',
        dob: p.dob ? p.dob.substring(0, 10) : '', aadhaar: p.aadhaar || '',
        preferredLanguage: p.preferredLanguage || '',
        emergencyContactName: emergency.name || '',
        emergencyContactPhone: emergency.phone || '',
        emergencyContactRelationship: emergency.relationship || '',
        biometricEnrolled: !!p.biometricEnrolled,
        employeeCode: existing.employeeCode || '', designation: existing.designation || '',
        specialization: existing.specialization || '', qualification: existing.qualification || '',
        departmentId: existing.departmentId?._id || existing.departmentId || '',
        contractType: existing.contractType || 'regular', status: existing.status || 'active',
        line1: addr.line1 || '', line2: addr.line2 || '', city: addr.city || '',
        state: addr.state || '', pincode: addr.pincode || '',
      });
      // Hydrate external IDs — `existing.externalIds` may be undefined
      // for legacy records. Treat each missing field as empty string so
      // controlled inputs don't flip uncontrolled-controlled.
      const ex = (existing.externalIds || {}) as Partial<ExternalIdsForm>;
      const hydrated: ExternalIdsForm = { ...EMPTY_EXTERNAL_IDS };
      for (const key of Object.keys(EMPTY_EXTERNAL_IDS) as ExternalIdKey[]) {
        hydrated[key] = ex[key] ?? '';
      }
      setExternalIds(hydrated);
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

  /** Count of populated external IDs — drives the dot on the tab. */
  const populatedIdCount = Object.values(externalIds).filter((v) => v.trim().length > 0).length;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    // Tab-aware required-field check. Inactive-tab inputs are unmounted,
    // so HTML5 `required` won't fire for them. Same pattern as the
    // StudentFormPage tab split.
    if (!form.name) {
      setFormTab('profile');
      setValidationError('Name is required.');
      return;
    }
    if (!form.phone) {
      setFormTab('profile');
      setValidationError('Phone is required.');
      return;
    }
    if (!form.employeeCode) {
      setFormTab('academic');
      setValidationError('Employee Code is required.');
      return;
    }
    if (!form.designation) {
      setFormTab('academic');
      setValidationError('Designation is required.');
      return;
    }

    const payload: any = { ...form };
    const address: any = {};
    ['line1', 'line2', 'city', 'state', 'pincode'].forEach(k => { if ((payload as any)[k]) address[k] = (payload as any)[k]; delete (payload as any)[k]; });
    if (Object.keys(address).length > 0) payload.address = address;
    const emergencyContact: any = {};
    if (payload.emergencyContactName) emergencyContact.name = payload.emergencyContactName;
    if (payload.emergencyContactPhone) emergencyContact.phone = payload.emergencyContactPhone;
    if (payload.emergencyContactRelationship) emergencyContact.relationship = payload.emergencyContactRelationship;
    delete payload.emergencyContactName;
    delete payload.emergencyContactPhone;
    delete payload.emergencyContactRelationship;
    if (Object.keys(emergencyContact).length > 0) payload.emergencyContact = emergencyContact;
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });

    // Send `externalIds` only if at least one field is populated;
    // otherwise omit so the backend's "if undefined" branch doesn't
    // overwrite existing values with an empty bag.
    const trimmedIds: Partial<ExternalIdsForm> = {};
    for (const [k, v] of Object.entries(externalIds)) {
      const trimmed = v.trim();
      if (trimmed) trimmedIds[k as ExternalIdKey] = trimmed;
    }
    if (Object.keys(trimmedIds).length > 0) {
      payload.externalIds = trimmedIds;
    } else if (isEdit && populatedIdCount === 0) {
      // Operator explicitly cleared all IDs — send empty object to
      // null out the bag.
      payload.externalIds = {};
    }

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

      {(validationError || error) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {validationError || (error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
        </div>
      )}

      {/* Tabs nav. Mirrors StudentFormPage shape. The Research IDs
          tab shows a count badge when any of the 33 NAAC credential
          fields are populated. */}
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b border-gray-200 -mx-2 px-2 mb-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Faculty form sections">
          {FORM_TABS.map((t) => {
            const isActive = formTab === t.key;
            const showCount = t.key === 'research' && populatedIdCount > 0;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`form-tabpanel-${t.key}`}
                id={`form-tab-${t.key}`}
                onClick={() => setFormTab(t.key)}
                className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {t.label}
                {showCount && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700"
                    aria-label={`${populatedIdCount} of 33 IDs populated`}
                  >
                    {populatedIdCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <form id="faculty-form" onSubmit={handleSubmit} className="space-y-6">
        {/* ── Profile tab ─────────────────────────────────────────── */}
        {formTab === 'profile' && (
          <div role="tabpanel" id="form-tabpanel-profile" aria-labelledby="form-tab-profile" className="space-y-6">
            <section className="bg-white rounded-xl border shadow-sm">
              <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
                <h3 className="font-semibold text-navy-dark">Personal Information</h3>
                <p className="text-xs text-gray-500 mt-0.5">Basic identity and contact details</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={lbl}>Name <span className="text-red-500">*</span></label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Full name" /></div>
                <div><label className={lbl}>Phone <span className="text-red-500">*</span></label><input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="10-digit mobile" /></div>
                <div><label className={lbl}>Alternate Phone</label><input value={form.alternatePhone} onChange={e => setForm(f => ({ ...f, alternatePhone: e.target.value }))} className={inp} placeholder="Backup contact number" /></div>
                <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Gender</label><select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}><option value="">Select...</option>{GENDERS.map(g => <option key={g} value={g} className="capitalize">{g}</option>)}</select></div>
                <div><label className={lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Aadhaar</label><input value={form.aadhaar} onChange={e => setForm(f => ({ ...f, aadhaar: e.target.value }))} className={inp} maxLength={12} placeholder="12-digit Aadhaar" /></div>
                <div><label className={lbl}>Preferred Language</label><input value={form.preferredLanguage} onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))} className={inp} placeholder="e.g. English, Telugu" /></div>
                <div><label className={lbl}>Emergency Contact Name</label><input value={form.emergencyContactName} onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))} className={inp} placeholder="Primary emergency contact" /></div>
                <div><label className={lbl}>Emergency Contact Phone</label><input value={form.emergencyContactPhone} onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} className={inp} placeholder="Emergency phone number" /></div>
                <div><label className={lbl}>Emergency Contact Relationship</label><input value={form.emergencyContactRelationship} onChange={e => setForm(f => ({ ...f, emergencyContactRelationship: e.target.value }))} className={inp} placeholder="e.g. Spouse, Parent" /></div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                  <input type="checkbox" checked={form.biometricEnrolled} onChange={e => setForm(f => ({ ...f, biometricEnrolled: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Biometric enrolled
                </label>
              </div>
            </section>

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
          </div>
        )}

        {/* ── Employment tab ───────────────────────────────────────── */}
        {formTab === 'academic' && (
          <div role="tabpanel" id="form-tabpanel-academic" aria-labelledby="form-tab-academic" className="space-y-6">
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
          </div>
        )}

        {/* ── Research IDs tab ─────────────────────────────────────── */}
        {formTab === 'research' && (
          <div role="tabpanel" id="form-tabpanel-research" aria-labelledby="form-tab-research" className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">NAAC-evidence credential IDs ({populatedIdCount} / 33 populated)</p>
              <p className="text-xs text-blue-800 mt-1">
                Every ID is optional. Phase A captures the data-model floor; an
                AI verification agent (Phase E) will later cross-reference public
                sources like ORCID and Scopus to auto-approve external claims.
              </p>
            </div>
            {EXTERNAL_ID_GROUPS.map((group) => (
              <section key={group.title} className="bg-white rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
                  <h3 className="font-semibold text-navy-dark">{group.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.fields.map((field) => (
                    <div key={field.key}>
                      <label className={lbl}>
                        {field.label}
                      </label>
                      <input
                        value={externalIds[field.key]}
                        onChange={(e) =>
                          setExternalIds((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className={inp}
                        placeholder={field.placeholder}
                      />
                      {field.helper && <p className="text-xs text-gray-400 mt-1">{field.helper}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <p className="text-xs text-gray-400 px-1">
              <ExternalLink size={11} className="inline -mt-0.5 mr-1" />
              Future phases will cover 34 NAAC-shaped sub-collections (publications,
              patents, projects, fellowships, …) on this tab too. See
              <code className="mx-1 px-1 bg-gray-100 rounded">.captain/specs/faculty-profile-depth/</code>
              for the full plan.
            </p>
          </div>
        )}

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
