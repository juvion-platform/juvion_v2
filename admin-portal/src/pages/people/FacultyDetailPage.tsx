import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { getFaculty } from '../../services/people';
import Badge from '../../components/ui/Badge';
import {
  DetailSection, DetailField, DetailBool, formatDate, extractPerson,
} from '../../components/ui/DetailView';
import PersonPhotoBlock from '../../components/people/PersonPhotoBlock';

/**
 * Read-only view for a single Faculty member. Edit navigates to the
 * existing `/people/faculty/:id/edit` form page.
 *
 * Tabbed layout mirrors the Student detail page split. The Research
 * IDs tab is the NAAC-evidence view (Strategic Gap 1, Phase A).
 */

const STATUS_COLOR: Record<string, string> = {
  active: 'success', on_leave: 'warning', separated: 'danger',
};

/**
 * Visual grouping of the 33 external credential IDs. Keys MUST match
 * the `IFacultyExternalIds` field names one-for-one — they're rendered
 * verbatim from the API response.
 */
const EXTERNAL_ID_GROUPS: ReadonlyArray<{
  title: string;
  fields: ReadonlyArray<{ key: string; label: string }>;
}> = [
  {
    title: 'Indian regulators & portals',
    fields: [
      { key: 'aicte', label: 'AICTE' },
      { key: 'aishe', label: 'AISHE' },
      { key: 'shodhganga', label: 'Shodhganga' },
      { key: 'irins', label: 'IRINS' },
      { key: 'vidwan', label: 'Vidwan' },
    ],
  },
  {
    title: 'International research',
    fields: [
      { key: 'orcid', label: 'ORCID' },
      { key: 'scopus', label: 'Scopus' },
      { key: 'webOfScience', label: 'Web of Science' },
      { key: 'researchGate', label: 'ResearchGate' },
      { key: 'googleScholar', label: 'Google Scholar' },
      { key: 'researcherId', label: 'ResearcherID' },
      { key: 'clarivate', label: 'Clarivate' },
      { key: 'academia', label: 'Academia' },
      { key: 'semanticScholar', label: 'Semantic Scholar' },
      { key: 'publons', label: 'Publons' },
      { key: 'ssrn', label: 'SSRN' },
      { key: 'elsevierReviewer', label: 'Elsevier Reviewer' },
      { key: 'springerReviewer', label: 'Springer Reviewer' },
    ],
  },
  {
    title: 'MOOC & learning',
    fields: [
      { key: 'swayam', label: 'Swayam' },
      { key: 'nptel', label: 'NPTEL (instructor)' },
      { key: 'nptelLearner', label: 'NPTEL (learner)' },
      { key: 'atal', label: 'ATAL' },
    ],
  },
  {
    title: 'Code platforms',
    fields: [
      { key: 'github', label: 'GitHub' },
      { key: 'hackerRank', label: 'HackerRank' },
      { key: 'hackerEarth', label: 'HackerEarth' },
      { key: 'leetCode', label: 'LeetCode' },
      { key: 'replit', label: 'Replit' },
      { key: 'codeChef', label: 'CodeChef' },
      { key: 'exercism', label: 'Exercism' },
      { key: 'codecademy', label: 'Codecademy' },
    ],
  },
  {
    title: 'Social & web',
    fields: [
      { key: 'linkedIn', label: 'LinkedIn' },
      { key: 'youtube', label: 'YouTube' },
      { key: 'website', label: 'Website' },
    ],
  },
];

type DetailTabKey = 'profile' | 'employment' | 'research';
const DETAIL_TABS: ReadonlyArray<{ key: DetailTabKey; label: string }> = [
  { key: 'profile',    label: 'Profile' },
  { key: 'employment', label: 'Employment' },
  { key: 'research',   label: 'Research IDs' },
];

export default function FacultyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DetailTabKey>('profile');
  const { data: f, isLoading, error } = useQuery({
    queryKey: ['faculty', id],
    queryFn: () => getFaculty(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !f) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <div className="text-gray-700 font-medium">Couldn't load faculty record</div>
        <Link to="/people/faculty" className="inline-flex items-center gap-1 text-sm text-primary-600 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Faculty
        </Link>
      </div>
    );
  }

  const person = extractPerson(f);
  const address = person.address || {};
  const emergency = person.emergencyContact || {};
  const departmentName = f.departmentId?.name ?? f.department?.name;
  const externalIds = (f.externalIds || {}) as Record<string, string | undefined>;
  // Count populated IDs so we can show a badge on the Research tab —
  // gives operators a quick "is this faculty NAAC-ready?" signal.
  const populatedIdCount = EXTERNAL_ID_GROUPS.reduce((acc, g) => {
    return acc + g.fields.filter((field) => (externalIds[field.key] ?? '').toString().trim().length > 0).length;
  }, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{person.name || 'Faculty'}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            {f.employeeCode && <span className="font-mono">{f.employeeCode}</span>}
            {f.employeeCode && f.status && <span>·</span>}
            {f.status && (
              <Badge variant={STATUS_COLOR[f.status] || 'default'}>{f.status.replace(/_/g, ' ')}</Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/people/faculty/${id}/edit`)}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>

      {/* Profile photo — above the tabs so the faculty member is
          identifiable regardless of which tab is active. */}
      {id && (
        <PersonPhotoBlock
          entityType="faculty"
          entityId={id}
          personName={person.name}
        />
      )}

      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b border-gray-200 -mx-2 px-2">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Faculty detail sections">
          {DETAIL_TABS.map((t) => {
            const isActive = tab === t.key;
            const showCount = t.key === 'research' && populatedIdCount > 0;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${t.key}`}
                id={`tab-${t.key}`}
                onClick={() => setTab(t.key)}
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

      {/* ── Profile tab ──────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile" className="space-y-4">
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
        </div>
      )}

      {/* ── Employment tab ───────────────────────────────────────── */}
      {tab === 'employment' && (
        <div role="tabpanel" id="tabpanel-employment" aria-labelledby="tab-employment" className="space-y-4">
          <DetailSection title="Employment">
            <DetailField label="Employee Code" value={f.employeeCode} mono />
            <DetailField label="Designation" value={f.designation} />
            <DetailField label="Department" value={departmentName} />
            <DetailField label="Qualification" value={f.qualification} />
            <DetailField label="Specialization" value={f.specialization} />
            <DetailField label="Contract Type" value={f.contractType} />
            <DetailField label="Status">
              <Badge variant={STATUS_COLOR[f.status] || 'default'}>
                {f.status?.replace(/_/g, ' ') || '—'}
              </Badge>
            </DetailField>
          </DetailSection>
        </div>
      )}

      {/* ── Research IDs tab ─────────────────────────────────────── */}
      {tab === 'research' && (
        <div role="tabpanel" id="tabpanel-research" aria-labelledby="tab-research" className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">
              NAAC-evidence credential IDs ({populatedIdCount} / 33 populated)
            </p>
            <p className="text-xs text-blue-800 mt-1">
              Strategic Gap 1, Phase A. The next phases add the 34 sub-collections
              (publications, patents, projects, fellowships, …) with their NAAC-shaped
              fields and verification workflow.
            </p>
          </div>
          {populatedIdCount === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No external IDs have been added yet. Click <span className="font-medium">Edit</span> above
              and switch to the Research IDs tab to populate them.
            </div>
          ) : (
            EXTERNAL_ID_GROUPS.map((group) => {
              // Only render groups that have at least one populated ID —
              // keeps the detail page tight for partly-filled profiles.
              const populated = group.fields.filter((field) => (externalIds[field.key] ?? '').toString().trim().length > 0);
              if (populated.length === 0) return null;
              return (
                <DetailSection key={group.title} title={group.title} columns={3}>
                  {populated.map((field) => (
                    <DetailField
                      key={field.key}
                      label={field.label}
                      value={externalIds[field.key]}
                      mono
                    />
                  ))}
                </DetailSection>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
