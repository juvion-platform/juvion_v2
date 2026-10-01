import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Users, GraduationCap, IndianRupee, TrendingUp, UserPlus, BookOpen, Heart, Building2,
  BookOpenCheck, Banknote, Briefcase, ShieldCheck, Landmark, Megaphone, Lightbulb,
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import PendingProposalsWidget from '../components/PendingProposalsWidget';
import { useAuthStore } from '../stores/authStore';

import { getStats as getPeopleStats } from '../services/people';
import { getStats as getAdmissionsStats } from '../services/admissions';
import { getStats as getAcademicsStats } from '../services/academics';
import { getFinanceStats } from '../services/finance';
import { getHRStats } from '../services/hr';
import { getWelfareStats } from '../services/welfare';
import { getPlacementStats } from '../services/placement';
import { getCampusOpsStats } from '../services/campus-ops';
import { getStudentDevStats } from '../services/student-dev';
import { getComplianceStats } from '../services/compliance';
import { getGovernanceStats } from '../services/governance';
import { getPlatformStats } from '../services/platform';

/**
 * 010 — dashboard as a registry. Each widget declares the permission it needs
 * and fetches its own stats, so a widget the user cannot read never renders
 * and never fires a request.
 */
export interface DashboardWidget {
  id: string;
  module: string | null; // null = ungated
  subDomain?: string;
  title: string;
  /** 'kpi' widgets render inside the top StatCard grid; 'card' widgets in the module grid. */
  kind: 'kpi' | 'card' | 'banner';
  Component: () => React.ReactElement | null;
}

const v = (val: unknown): string | number => (val !== undefined && val !== null ? val as string | number : '—');

function Num({ value, loading }: { value: unknown; loading?: boolean }) {
  if (loading) return <span className="inline-block h-3.5 w-8 animate-pulse rounded bg-slate-200/70 align-middle" aria-hidden="true" />;
  return <>{v(value)}</>;
}

function useStats(key: string, fn: () => Promise<any>) {
  const collegeId = useAuthStore((s) => s.collegeId);
  return useQuery({ queryKey: [`dashboard-${key}`, collegeId], queryFn: fn });
}

function ModuleCard({ to, icon: Icon, title, rows, loading }: { to: string; icon: LucideIcon; title: string; rows: [string, unknown][]; loading: boolean }) {
  return (
    <Link to={to} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
      <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
        <Icon size={18} className="text-primary-500" /> {title}
      </h3>
      <div className="space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between"><span className="text-gray-500">{label}</span><span className="font-medium"><Num value={value} loading={loading} /></span></div>
        ))}
      </div>
    </Link>
  );
}

// Literal class strings: Tailwind only emits classes it can see in source.
const TONES = {
  amber: { link: 'border-amber-200 hover:border-amber-300', label: 'text-amber-600', icon: 'bg-amber-50 text-amber-600' },
  rose: { link: 'border-rose-200 hover:border-rose-300', label: 'text-rose-600', icon: 'bg-rose-50 text-rose-600' },
  emerald: { link: 'border-emerald-200 hover:border-emerald-300', label: 'text-emerald-600', icon: 'bg-emerald-50 text-emerald-600' },
} as const;

function AttentionCard({ to, tone, label, value, desc, icon: Icon }: { to: string; tone: keyof typeof TONES; label: string; value: unknown; desc: string; icon: LucideIcon }) {
  const t = TONES[tone];
  return (
    <Link to={to} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-all ${t.link}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-xs font-medium uppercase tracking-wide ${t.label}`}>{label}</div>
          <div className="mt-2 text-3xl font-bold text-navy">{v(value)}</div>
          <div className="mt-1 text-sm text-gray-500">{desc}</div>
        </div>
        <div className={`rounded-xl p-3 ${t.icon}`}><Icon size={22} /></div>
      </div>
    </Link>
  );
}

// ── KPI widgets (top row) ──────────────────────────────────────────────
function PeopleKpi() {
  const { data, isLoading } = useStats('people', getPeopleStats);
  return (
    <>
      <StatCard label="Total Students" value={v(data?.activeStudents)} loading={isLoading} icon={Users} color="bg-primary-50 text-primary-500" to="/people/students" />
      <StatCard label="Active Faculty" value={v(data?.activeFaculty)} loading={isLoading} icon={GraduationCap} color="bg-teal-50 text-teal-600" to="/people/faculty" />
    </>
  );
}
function FinanceKpi() {
  const { data, isLoading } = useStats('finance', getFinanceStats);
  return <StatCard label="Total Payments" value={v(data?.payments)} loading={isLoading} icon={IndianRupee} color="bg-orange-50 text-orange-500" to="/finance/payments" />;
}
function PlacementKpi() {
  const { data, isLoading } = useStats('placement', getPlacementStats);
  return <StatCard label="Placement Offers" value={v(data?.offersAccepted)} loading={isLoading} icon={TrendingUp} color="bg-accent-50 text-accent-500" to="/placement/offers" />;
}
function AdmissionsKpi() {
  const { data, isLoading } = useStats('admissions', getAdmissionsStats);
  return <StatCard label="New Admissions" value={v(data?.admissions)} loading={isLoading} icon={UserPlus} color="bg-primary-100 text-primary-700" to="/admissions/enrollments" />;
}
function AcademicsKpi() {
  const { data, isLoading } = useStats('academics', getAcademicsStats);
  return <StatCard label="Active Courses" value={v(data?.courseOfferings)} loading={isLoading} icon={BookOpen} color="bg-teal-100 text-teal-700" to="/academics/offerings" />;
}
function WelfareKpi() {
  const { data, isLoading } = useStats('welfare', getWelfareStats);
  return <StatCard label="Hostel Blocks" value={v(data?.hostelBlocks)} loading={isLoading} icon={Heart} color="bg-accent-100 text-accent-600" to="/welfare/hostel-blocks" />;
}
function CampusKpi() {
  const { data, isLoading } = useStats('campus-ops', getCampusOpsStats);
  return <StatCard label="Buildings" value={v(data?.buildings)} loading={isLoading} icon={Building2} color="bg-orange-100 text-orange-600" to="/campus/buildings" />;
}

// ── Banner widgets ─────────────────────────────────────────────────────
function OnboardingBanner() {
  const { data } = useStats('people', getPeopleStats);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <AttentionCard to="/people/students?needsAttention=true" tone="amber" label="Onboarding Attention" value={data?.onboardingNeedsAttention} desc="Students blocked or incomplete in onboarding" icon={UserPlus} />
      <AttentionCard to="/people/students?needsAttention=true" tone="rose" label="Missing Fee Guardian" value={data?.missingFeeResponsibleGuardians} desc="Students without a fee responsible guardian" icon={Users} />
      <AttentionCard to="/people/students?onboardingStatus=completed" tone="emerald" label="Onboarding Complete" value={data?.onboardingCompleted} desc="Students fully ready after admissions" icon={GraduationCap} />
    </div>
  );
}

// ── Module cards ───────────────────────────────────────────────────────
function AcademicsCard() { const { data, isLoading } = useStats('academics', getAcademicsStats); return <ModuleCard to="/academics" icon={BookOpenCheck} title="Academics" loading={isLoading} rows={[['Departments', data?.departments], ['Programmes', data?.programmes], ['Courses', data?.courses], ['Course Offerings', data?.courseOfferings]]} />; }
function AdmissionsCard() { const { data, isLoading } = useStats('admissions', getAdmissionsStats); return <ModuleCard to="/admissions" icon={UserPlus} title="Admissions" loading={isLoading} rows={[['Inquiries', data?.inquiries], ['Applicants', data?.applicants], ['Offers', data?.offers], ['Enrolled', data?.admissions]]} />; }
function FinanceCard() { const { data, isLoading } = useStats('finance', getFinanceStats); return <ModuleCard to="/finance" icon={Banknote} title="Finance" loading={isLoading} rows={[['Fee Structures', data?.feeStructures], ['Payments', data?.payments], ['Scholarships', data?.scholarships], ['Budgets', data?.budgets]]} />; }
function HrCard() { const { data, isLoading } = useStats('hr', getHRStats); return <ModuleCard to="/hr" icon={Briefcase} title="HR" loading={isLoading} rows={[['Employees', data?.employees], ['Leave Applications', data?.leaveApplications], ['Payroll Records', data?.payrolls], ['Trainings', data?.trainings]]} />; }
function PlacementCard() { const { data, isLoading } = useStats('placement', getPlacementStats); return <ModuleCard to="/placement" icon={TrendingUp} title="Placement" loading={isLoading} rows={[['Companies', data?.companies], ['Job Postings', data?.jobPostings], ['Offers Accepted', data?.offersAccepted], ['Internships', data?.internships]]} />; }
function WelfareCard() { const { data, isLoading } = useStats('welfare', getWelfareStats); return <ModuleCard to="/welfare" icon={Heart} title="Welfare" loading={isLoading} rows={[['Hostel Blocks', data?.hostelBlocks], ['Transport Routes', data?.transportRoutes], ['Counseling Sessions', data?.counselingSessions], ['Grievances', data?.studentGrievances]]} />; }
function CampusCard() { const { data, isLoading } = useStats('campus-ops', getCampusOpsStats); return <ModuleCard to="/campus" icon={Building2} title="Campus Ops" loading={isLoading} rows={[['Buildings', data?.buildings], ['Rooms', data?.rooms], ['Assets', data?.assets], ['Maintenance Requests', data?.maintenanceRequests]]} />; }
function StudentDevCard() { const { data, isLoading } = useStats('student-dev', getStudentDevStats); return <ModuleCard to="/student-dev" icon={Lightbulb} title="Student Development" loading={isLoading} rows={[['Clubs', data?.clubs], ['Events', data?.events], ['Achievements', data?.achievements], ['Projects', data?.studentProjects]]} />; }
function GovernanceCard() { const { data, isLoading } = useStats('governance', getGovernanceStats); return <ModuleCard to="/governance" icon={Landmark} title="Governance" loading={isLoading} rows={[['Committees', data?.committees], ['Policies', data?.policies], ['Board Members', data?.boardMembers], ['Strategic Goals', data?.goals]]} />; }
function ComplianceCard() { const { data, isLoading } = useStats('compliance', getComplianceStats); return <ModuleCard to="/compliance" icon={ShieldCheck} title="Compliance" loading={isLoading} rows={[['Accreditation Bodies', data?.accreditationBodies], ['Compliance Criteria', data?.complianceCriteria], ['Regulatory Filings', data?.regulatoryFilings], ['IQAC Reports', data?.iqacReports]]} />; }
function PlatformCard() { const { data, isLoading } = useStats('platform', getPlatformStats); return <ModuleCard to="/platform" icon={Megaphone} title="Platform" loading={isLoading} rows={[['Announcements', data?.announcements], ['Circulars', data?.circulars], ['Notifications', data?.notifications], ['Surveys', data?.feedbackSurveys]]} />; }

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'pending-proposals', module: 'campus', title: 'Pending proposals', kind: 'banner', Component: PendingProposalsWidget },
  { id: 'people-kpi', module: 'people', title: 'Students & faculty', kind: 'kpi', Component: PeopleKpi },
  { id: 'finance-kpi', module: 'finance', title: 'Payments', kind: 'kpi', Component: FinanceKpi },
  { id: 'placement-kpi', module: 'placement', title: 'Placement offers', kind: 'kpi', Component: PlacementKpi },
  { id: 'admissions-kpi', module: 'admissions', title: 'New admissions', kind: 'kpi', Component: AdmissionsKpi },
  { id: 'academics-kpi', module: 'academics', title: 'Active courses', kind: 'kpi', Component: AcademicsKpi },
  { id: 'welfare-kpi', module: 'welfare', title: 'Hostel blocks', kind: 'kpi', Component: WelfareKpi },
  { id: 'campus-kpi', module: 'campus', title: 'Buildings', kind: 'kpi', Component: CampusKpi },
  { id: 'onboarding-banner', module: 'people', title: 'Onboarding attention', kind: 'banner', Component: OnboardingBanner },
  { id: 'academics-card', module: 'academics', title: 'Academics', kind: 'card', Component: AcademicsCard },
  { id: 'admissions-card', module: 'admissions', title: 'Admissions', kind: 'card', Component: AdmissionsCard },
  { id: 'finance-card', module: 'finance', title: 'Finance', kind: 'card', Component: FinanceCard },
  { id: 'hr-card', module: 'hr', title: 'HR', kind: 'card', Component: HrCard },
  { id: 'placement-card', module: 'placement', title: 'Placement', kind: 'card', Component: PlacementCard },
  { id: 'welfare-card', module: 'welfare', title: 'Welfare', kind: 'card', Component: WelfareCard },
  { id: 'campus-card', module: 'campus', title: 'Campus Ops', kind: 'card', Component: CampusCard },
  { id: 'student-dev-card', module: 'student-dev', title: 'Student Development', kind: 'card', Component: StudentDevCard },
  { id: 'governance-card', module: 'governance', title: 'Governance', kind: 'card', Component: GovernanceCard },
  { id: 'compliance-card', module: 'compliance', title: 'Compliance', kind: 'card', Component: ComplianceCard },
  { id: 'platform-card', module: 'platform', title: 'Platform', kind: 'card', Component: PlatformCard },
];
