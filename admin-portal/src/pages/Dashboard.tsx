import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, IndianRupee, TrendingUp, UserPlus, BookOpen, Heart, Building2,
  BookOpenCheck, Banknote, Briefcase, ShieldCheck, Landmark, Megaphone, Lightbulb,
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import PendingProposalsWidget from '../components/PendingProposalsWidget';

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

import { useAuthStore } from '../stores/authStore';

function Num({ value, loading }: { value: unknown; loading?: boolean }) {
  if (loading) return <span className="inline-block h-3.5 w-8 animate-pulse rounded bg-slate-200/70 align-middle" aria-hidden="true" />;
  return <>{v(value)}</>;
}

const v = (val: unknown): string | number => (val !== undefined && val !== null ? val as string | number : '—');

export default function Dashboard() {
  const collegeId = useAuthStore((s) => s.collegeId);

  const { data: people, isLoading: peopleLoading } = useQuery({ queryKey: ['dashboard-people', collegeId], queryFn: getPeopleStats });
  const { data: admissions, isLoading: admissionsLoading } = useQuery({ queryKey: ['dashboard-admissions', collegeId], queryFn: getAdmissionsStats });
  const { data: academics, isLoading: academicsLoading } = useQuery({ queryKey: ['dashboard-academics', collegeId], queryFn: getAcademicsStats });
  const { data: finance, isLoading: financeLoading } = useQuery({ queryKey: ['dashboard-finance', collegeId], queryFn: getFinanceStats });
  const { data: hr, isLoading: hrLoading } = useQuery({ queryKey: ['dashboard-hr', collegeId], queryFn: getHRStats });
  const { data: welfare, isLoading: welfareLoading } = useQuery({ queryKey: ['dashboard-welfare', collegeId], queryFn: getWelfareStats });
  const { data: placement, isLoading: placementLoading } = useQuery({ queryKey: ['dashboard-placement', collegeId], queryFn: getPlacementStats });
  const { data: campusOps, isLoading: campusOpsLoading } = useQuery({ queryKey: ['dashboard-campus-ops', collegeId], queryFn: getCampusOpsStats });
  const { data: studentDev, isLoading: studentDevLoading } = useQuery({ queryKey: ['dashboard-student-dev', collegeId], queryFn: getStudentDevStats });
  const { data: compliance, isLoading: complianceLoading } = useQuery({ queryKey: ['dashboard-compliance', collegeId], queryFn: getComplianceStats });
  const { data: governance, isLoading: governanceLoading } = useQuery({ queryKey: ['dashboard-governance', collegeId], queryFn: getGovernanceStats });
  const { data: platform, isLoading: platformLoading } = useQuery({ queryKey: ['dashboard-platform', collegeId], queryFn: getPlatformStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Dashboard</h2>

      {/* ── Student-facing: pending campus service proposals (self-hiding when zero) ── */}
      <div className="mb-6">
        <PendingProposalsWidget />
      </div>

      {/* ── Top KPI Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={v(people?.activeStudents)} loading={peopleLoading} icon={Users} color="bg-primary-50 text-primary-500" to="/people/students" />
        <StatCard label="Active Faculty" value={v(people?.activeFaculty)} loading={peopleLoading} icon={GraduationCap} color="bg-teal-50 text-teal-600" to="/people/faculty" />
        <StatCard label="Total Payments" value={v(finance?.payments)} loading={financeLoading} icon={IndianRupee} color="bg-orange-50 text-orange-500" to="/finance/payments" />
        <StatCard label="Placement Offers" value={v(placement?.offersAccepted)} loading={placementLoading} icon={TrendingUp} color="bg-accent-50 text-accent-500" to="/placement/offers" />
        <StatCard label="New Admissions" value={v(admissions?.admissions)} loading={admissionsLoading} icon={UserPlus} color="bg-primary-100 text-primary-700" to="/admissions/enrollments" />
        <StatCard label="Active Courses" value={v(academics?.courseOfferings)} loading={academicsLoading} icon={BookOpen} color="bg-teal-100 text-teal-700" to="/academics/offerings" />
        <StatCard label="Hostel Blocks" value={v(welfare?.hostelBlocks)} loading={welfareLoading} icon={Heart} color="bg-accent-100 text-accent-600" to="/welfare/hostel-blocks" />
        <StatCard label="Buildings" value={v(campusOps?.buildings)} loading={campusOpsLoading} icon={Building2} color="bg-orange-100 text-orange-600" to="/campus/buildings" />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/people/students?needsAttention=true" className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 hover:shadow-md hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Onboarding Attention</div>
              <div className="mt-2 text-3xl font-bold text-navy">{v(people?.onboardingNeedsAttention)}</div>
              <div className="mt-1 text-sm text-gray-500">Students blocked or incomplete in onboarding</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <UserPlus size={22} />
            </div>
          </div>
        </Link>
        <Link to="/people/students?needsAttention=true" className="bg-white rounded-xl border border-rose-200 shadow-sm p-5 hover:shadow-md hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-rose-600">Missing Fee Guardian</div>
              <div className="mt-2 text-3xl font-bold text-navy">{v(people?.missingFeeResponsibleGuardians)}</div>
              <div className="mt-1 text-sm text-gray-500">Students without a fee responsible guardian</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <Users size={22} />
            </div>
          </div>
        </Link>
        <Link to="/people/students?onboardingStatus=completed" className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 hover:shadow-md hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">Onboarding Complete</div>
              <div className="mt-2 text-3xl font-bold text-navy">{v(people?.onboardingCompleted)}</div>
              <div className="mt-1 text-sm text-gray-500">Students fully ready after admissions</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <GraduationCap size={22} />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Module Summary Cards ──────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Academics */}
        <Link to="/academics" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <BookOpenCheck size={18} className="text-primary-500" /> Academics
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Departments</span><span className="font-medium"><Num value={academics?.departments} loading={academicsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Programmes</span><span className="font-medium"><Num value={academics?.programmes} loading={academicsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Courses</span><span className="font-medium"><Num value={academics?.courses} loading={academicsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Course Offerings</span><span className="font-medium"><Num value={academics?.courseOfferings} loading={academicsLoading} /></span></div>
          </div>
        </Link>

        {/* Admissions */}
        <Link to="/admissions" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <UserPlus size={18} className="text-primary-500" /> Admissions
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Inquiries</span><span className="font-medium"><Num value={admissions?.inquiries} loading={admissionsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Applicants</span><span className="font-medium"><Num value={admissions?.applicants} loading={admissionsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Offers</span><span className="font-medium"><Num value={admissions?.offers} loading={admissionsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Enrolled</span><span className="font-medium"><Num value={admissions?.admissions} loading={admissionsLoading} /></span></div>
          </div>
        </Link>

        {/* Finance */}
        <Link to="/finance" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Banknote size={18} className="text-primary-500" /> Finance
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Fee Structures</span><span className="font-medium"><Num value={finance?.feeStructures} loading={financeLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payments</span><span className="font-medium"><Num value={finance?.payments} loading={financeLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Scholarships</span><span className="font-medium"><Num value={finance?.scholarships} loading={financeLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Budgets</span><span className="font-medium"><Num value={finance?.budgets} loading={financeLoading} /></span></div>
          </div>
        </Link>

        {/* HR */}
        <Link to="/hr" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Briefcase size={18} className="text-primary-500" /> HR
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Employees</span><span className="font-medium"><Num value={hr?.employees} loading={hrLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Leave Applications</span><span className="font-medium"><Num value={hr?.leaveApplications} loading={hrLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payroll Records</span><span className="font-medium"><Num value={hr?.payrolls} loading={hrLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Trainings</span><span className="font-medium"><Num value={hr?.trainings} loading={hrLoading} /></span></div>
          </div>
        </Link>

        {/* Placement */}
        <Link to="/placement" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-500" /> Placement
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Companies</span><span className="font-medium"><Num value={placement?.companies} loading={placementLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Job Postings</span><span className="font-medium"><Num value={placement?.jobPostings} loading={placementLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Offers Accepted</span><span className="font-medium"><Num value={placement?.offersAccepted} loading={placementLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Internships</span><span className="font-medium"><Num value={placement?.internships} loading={placementLoading} /></span></div>
          </div>
        </Link>

        {/* Welfare */}
        <Link to="/welfare" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Heart size={18} className="text-primary-500" /> Welfare
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Hostel Blocks</span><span className="font-medium"><Num value={welfare?.hostelBlocks} loading={welfareLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Transport Routes</span><span className="font-medium"><Num value={welfare?.transportRoutes} loading={welfareLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Counseling Sessions</span><span className="font-medium"><Num value={welfare?.counselingSessions} loading={welfareLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Grievances</span><span className="font-medium"><Num value={welfare?.studentGrievances} loading={welfareLoading} /></span></div>
          </div>
        </Link>

        {/* Campus Ops */}
        <Link to="/campus" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Building2 size={18} className="text-primary-500" /> Campus Ops
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Buildings</span><span className="font-medium"><Num value={campusOps?.buildings} loading={campusOpsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rooms</span><span className="font-medium"><Num value={campusOps?.rooms} loading={campusOpsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Assets</span><span className="font-medium"><Num value={campusOps?.assets} loading={campusOpsLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Maintenance Requests</span><span className="font-medium"><Num value={campusOps?.maintenanceRequests} loading={campusOpsLoading} /></span></div>
          </div>
        </Link>

        {/* Student Development */}
        <Link to="/student-dev" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-primary-500" /> Student Development
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Clubs</span><span className="font-medium"><Num value={studentDev?.clubs} loading={studentDevLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Events</span><span className="font-medium"><Num value={studentDev?.events} loading={studentDevLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Achievements</span><span className="font-medium"><Num value={studentDev?.achievements} loading={studentDevLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Projects</span><span className="font-medium"><Num value={studentDev?.studentProjects} loading={studentDevLoading} /></span></div>
          </div>
        </Link>

        {/* Governance */}
        <Link to="/governance" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Landmark size={18} className="text-primary-500" /> Governance
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Committees</span><span className="font-medium"><Num value={governance?.committees} loading={governanceLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Policies</span><span className="font-medium"><Num value={governance?.policies} loading={governanceLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Board Members</span><span className="font-medium"><Num value={governance?.boardMembers} loading={governanceLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Strategic Goals</span><span className="font-medium"><Num value={governance?.goals} loading={governanceLoading} /></span></div>
          </div>
        </Link>

        {/* Compliance */}
        <Link to="/compliance" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-500" /> Compliance
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Accreditation Bodies</span><span className="font-medium"><Num value={compliance?.accreditationBodies} loading={complianceLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Compliance Criteria</span><span className="font-medium"><Num value={compliance?.complianceCriteria} loading={complianceLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Regulatory Filings</span><span className="font-medium"><Num value={compliance?.regulatoryFilings} loading={complianceLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">IQAC Reports</span><span className="font-medium"><Num value={compliance?.iqacReports} loading={complianceLoading} /></span></div>
          </div>
        </Link>

        {/* Platform */}
        <Link to="/platform" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Megaphone size={18} className="text-primary-500" /> Platform
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Announcements</span><span className="font-medium"><Num value={platform?.announcements} loading={platformLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Circulars</span><span className="font-medium"><Num value={platform?.circulars} loading={platformLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Notifications</span><span className="font-medium"><Num value={platform?.notifications} loading={platformLoading} /></span></div>
            <div className="flex justify-between"><span className="text-gray-500">Surveys</span><span className="font-medium"><Num value={platform?.feedbackSurveys} loading={platformLoading} /></span></div>
          </div>
        </Link>

      </div>
    </div>
  );
}
