import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInquiry, createInquiry, updateInquiry } from '../../services/admissions';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const SOURCES = ['website', 'walk-in', 'referral', 'whatsapp', 'newspaper', 'social_media', 'education_fair', 'phone'] as const;
// Strategic Gap 5 Phase A — 27-value prospect-status taxonomy. Mirrors
// the Inquiry model + Zod schema. All legacy values stay valid.
const STATUSES = [
  'new', 'enrichment_pending',
  'first_contact_attempt', 'contacted', 'no_response', 'callback_requested',
  'wrong_number', 'do_not_contact',
  'follow_up', 'follow_up_overdue', 'interested', 'sent_brochure',
  'mql', 'sql',
  'visit_scheduled', 'visit_completed', 'visited',
  'counsellor_meeting_scheduled', 'counsellor_meeting_done',
  'parent_meeting_done',
  'qualified', 'eligibility_pending', 'fee_quoted',
  'converted', 'lost', 'disqualified', 'dormant',
  'duplicate_merged',
] as const;
const INTER_STREAMS = ['MPC', 'BiPC', 'MEC', 'CEC', 'other'] as const;
const GENDERS = ['male', 'female', 'other'] as const;
const MQL_SQL = ['mql', 'sql', 'disqualified'] as const;
const LEAD_GRADES = ['hot', 'warm', 'cold', 'dormant'] as const;

const emptyForm = {
  name: '', fatherName: '', phone: '', altPhone: '', email: '',
  gender: '', dateOfBirth: '',
  city: '', state: '', district: '', pincode: '',
  tenthPercentage: '', interPercentage: '', interStream: '', previousCollege: '',
  source: 'walk-in' as string, programmeInterest: '', branchInterest: '',
  status: 'new' as string, leadScore: '', notes: '', followUpDate: '', assignedTo: '',
  // ─── Strategic Gap 5 — CRM fields ───────────────────────────────
  utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '',
  mqlSqlClassification: '' as '' | 'mql' | 'sql' | 'disqualified',
  leadGrade: '' as '' | 'hot' | 'warm' | 'cold' | 'dormant',
  emailVerified: false,
  mobileVerified: false,
};

export default function InquiryFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['inquiry', id],
    queryFn: () => getInquiry(id!),
    enabled: isEdit,
  });

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || '',
        fatherName: existing.fatherName || '',
        phone: existing.phone || '',
        altPhone: existing.altPhone || '',
        email: existing.email || '',
        gender: existing.gender || '',
        dateOfBirth: existing.dateOfBirth ? existing.dateOfBirth.substring(0, 10) : '',
        city: existing.city || '',
        state: existing.state || '',
        district: existing.district || '',
        pincode: existing.pincode || '',
        tenthPercentage: existing.tenthPercentage?.toString() || '',
        interPercentage: existing.interPercentage?.toString() || '',
        interStream: existing.interStream || '',
        previousCollege: existing.previousCollege || '',
        source: existing.source || 'walk-in',
        programmeInterest: existing.programmeInterest || '',
        branchInterest: existing.branchInterest || '',
        status: existing.status || 'new',
        leadScore: existing.leadScore?.toString() || '',
        notes: existing.notes || '',
        followUpDate: existing.followUpDate ? existing.followUpDate.substring(0, 10) : '',
        assignedTo: existing.assignedTo || '',
        // ─── Strategic Gap 5 CRM fields ─────────────────────────────
        utmSource: existing.utmSource || '',
        utmMedium: existing.utmMedium || '',
        utmCampaign: existing.utmCampaign || '',
        utmTerm: existing.utmTerm || '',
        utmContent: existing.utmContent || '',
        mqlSqlClassification: existing.mqlSqlClassification || '',
        leadGrade: existing.leadGrade || '',
        emailVerified: !!existing.emailVerified,
        mobileVerified: !!existing.mobileVerified,
      });
    }
  }, [existing]);

  const createMut = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      qc.invalidateQueries({ queryKey: ['admissions-stats'] });
      navigate('/admissions/inquiries');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateInquiry(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      qc.invalidateQueries({ queryKey: ['inquiry', id] });
      navigate('/admissions/inquiries');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.tenthPercentage) payload.tenthPercentage = Number(payload.tenthPercentage); else delete payload.tenthPercentage;
    if (payload.interPercentage) payload.interPercentage = Number(payload.interPercentage); else delete payload.interPercentage;
    if (payload.leadScore) payload.leadScore = Number(payload.leadScore); else delete payload.leadScore;
    // Booleans need preservation — the empty-string filter below
    // would strip `false`. Re-attach after the filter.
    const emailVerified = !!payload.emailVerified;
    const mobileVerified = !!payload.mobileVerified;
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
    payload.emailVerified = emailVerified;
    payload.mobileVerified = mobileVerified;
    if (isEdit) updateMut.mutate({ id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors";
  const lbl = "block text-sm font-medium text-gray-700 mb-1";

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admissions/inquiries')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-navy">{isEdit ? 'Edit Inquiry' : 'New Inquiry'}</h2>
            {isEdit && existing && (
              <p className="text-sm text-gray-500 mt-0.5">
                {existing.name} &middot; Created {new Date(existing.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <button
          type="submit"
          form="inquiry-form"
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin text-white" /> : <Save size={16} className="text-white" />}
          {saving ? 'Saving...' : isEdit ? 'Update Inquiry' : 'Create Inquiry'}
        </button>
      </div>

      {/* Error display */}
      {(createMut.isError || updateMut.isError) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(createMut.error as any)?.response?.data?.message || (updateMut.error as any)?.response?.data?.message || 'Something went wrong. Please try again.'}
        </div>
      )}

      <form id="inquiry-form" onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1: Personal Information ─────────── */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Personal Information</h3>
            <p className="text-xs text-gray-500 mt-0.5">Basic contact and identity details</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="inquiry-name" className={lbl}>Name <span className="text-red-500">*</span></label>
              <input id="inquiry-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Full name" />
            </div>
            <div>
              <label className={lbl}>Father's Name</label>
              <input value={form.fatherName} onChange={e => setForm(f => ({ ...f, fatherName: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Gender</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {GENDERS.map(g => <option key={g} value={g} className="capitalize">{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="inquiry-phone" className={lbl}>Phone <span className="text-red-500">*</span></label>
              <input id="inquiry-phone" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="10-digit mobile" />
            </div>
            <div>
              <label className={lbl}>Alternate Phone</label>
              <input value={form.altPhone} onChange={e => setForm(f => ({ ...f, altPhone: e.target.value }))} className={inp} placeholder="Parent / guardian" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} className={inp} />
            </div>
          </div>
        </section>

        {/* ── Section 2: Address ──────────────────────── */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Address</h3>
            <p className="text-xs text-gray-500 mt-0.5">Residential address details</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>City / Town</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>District</label>
              <input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>State</label>
              <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp} placeholder="e.g. Telangana" />
            </div>
            <div>
              <label className={lbl}>Pincode</label>
              <input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} className={inp} maxLength={6} />
            </div>
          </div>
        </section>

        {/* ── Section 3: Academic Background ──────────── */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Academic Background</h3>
            <p className="text-xs text-gray-500 mt-0.5">Previous education details</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>10th Percentage</label>
              <input type="number" step="0.01" min={0} max={100} value={form.tenthPercentage} onChange={e => setForm(f => ({ ...f, tenthPercentage: e.target.value }))} className={inp} placeholder="0 – 100" />
            </div>
            <div>
              <label className={lbl}>Inter Percentage</label>
              <input type="number" step="0.01" min={0} max={100} value={form.interPercentage} onChange={e => setForm(f => ({ ...f, interPercentage: e.target.value }))} className={inp} placeholder="0 – 100" />
            </div>
            <div>
              <label className={lbl}>Inter Stream</label>
              <select value={form.interStream} onChange={e => setForm(f => ({ ...f, interStream: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {INTER_STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Previous College</label>
              <input value={form.previousCollege} onChange={e => setForm(f => ({ ...f, previousCollege: e.target.value }))} className={inp} />
            </div>
          </div>
        </section>

        {/* ── Section 4: Interest & Source ────────────── */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Interest & Source</h3>
            <p className="text-xs text-gray-500 mt-0.5">How the inquiry came in and what they're interested in</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Source <span className="text-red-500">*</span></label>
              <select required value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inp}>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Programme Interest</label>
              <input value={form.programmeInterest} onChange={e => setForm(f => ({ ...f, programmeInterest: e.target.value }))} className={inp} placeholder="e.g. B.Tech, MBA" />
            </div>
            <div>
              <label className={lbl}>Branch Interest</label>
              <input value={form.branchInterest} onChange={e => setForm(f => ({ ...f, branchInterest: e.target.value }))} className={inp} placeholder="e.g. CSE, ECE, EEE" />
            </div>
          </div>
        </section>

        {/* ── Section 5: Tracking & Follow-up ────────── */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Tracking & Follow-up</h3>
            <p className="text-xs text-gray-500 mt-0.5">Status, assignment, and follow-up scheduling</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Lead Score (0 – 100)</label>
                <input type="number" min={0} max={100} value={form.leadScore} onChange={e => setForm(f => ({ ...f, leadScore: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Follow-up Date</label>
                <input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Assigned To</label>
                <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inp} placeholder="Counselor name" />
              </div>
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} placeholder="Conversation notes, remarks, special requirements..." />
            </div>
          </div>
        </section>

        {/* ── Section 6: CRM (Strategic Gap 5) ─────────── */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">CRM & Attribution</h3>
            <p className="text-xs text-gray-500 mt-0.5">UTM marketing source, funnel classification, verification flags. Match-rate reporting depends on these.</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>MQL / SQL classification</label>
                <select value={form.mqlSqlClassification} onChange={e => setForm(f => ({ ...f, mqlSqlClassification: e.target.value as typeof form.mqlSqlClassification }))} className={inp}>
                  <option value="">— (unclassified)</option>
                  {MQL_SQL.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Orthogonal to lead grade. MQL = showed intent. SQL = officer-confirmed eligibility + intent-to-apply.</p>
              </div>
              <div>
                <label className={lbl}>Lead grade</label>
                <select value={form.leadGrade} onChange={e => setForm(f => ({ ...f, leadGrade: e.target.value as typeof form.leadGrade }))} className={inp}>
                  <option value="">—</option>
                  {LEAD_GRADES.map(v => <option key={v} value={v} className="capitalize">{v}</option>)}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Hot / warm / cold / dormant — separate from MQL/SQL.</p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.emailVerified} onChange={e => setForm(f => ({ ...f, emailVerified: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Email verified
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.mobileVerified} onChange={e => setForm(f => ({ ...f, mobileVerified: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Mobile verified
                </label>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">UTM attribution</h4>
              <p className="text-[11px] text-gray-500 mb-3">Marketing-campaign source the prospect arrived through. Auto-captured from landing-page URL on web form submits; backfilled by marketing for other channels.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>UTM source</label>
                  <input value={form.utmSource} onChange={e => setForm(f => ({ ...f, utmSource: e.target.value }))} className={inp} placeholder="e.g. google, facebook, naukri" />
                </div>
                <div>
                  <label className={lbl}>UTM medium</label>
                  <input value={form.utmMedium} onChange={e => setForm(f => ({ ...f, utmMedium: e.target.value }))} className={inp} placeholder="e.g. cpc, organic, referral" />
                </div>
                <div>
                  <label className={lbl}>UTM campaign</label>
                  <input value={form.utmCampaign} onChange={e => setForm(f => ({ ...f, utmCampaign: e.target.value }))} className={inp} placeholder="e.g. summer2025_btech" />
                </div>
                <div>
                  <label className={lbl}>UTM term</label>
                  <input value={form.utmTerm} onChange={e => setForm(f => ({ ...f, utmTerm: e.target.value }))} className={inp} placeholder="Keyword / ad-group term" />
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>UTM content</label>
                  <input value={form.utmContent} onChange={e => setForm(f => ({ ...f, utmContent: e.target.value }))} className={inp} placeholder="Ad variant / creative ID" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sticky bottom bar ──────────────────────── */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <button type="button" onClick={() => navigate('/admissions/inquiries')} className="px-5 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin text-white" /> : <Save size={16} className="text-white" />}
            {saving ? 'Saving...' : isEdit ? 'Update Inquiry' : 'Create Inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
}
