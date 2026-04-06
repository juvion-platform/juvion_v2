import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, IndianRupee, TrendingUp, UserPlus, BookOpen, Heart, Building2,
  BookOpenCheck, Banknote, Briefcase, ShieldCheck, Landmark, Megaphone, Lightbulb,
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';

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

const v = (val: unknown): string | number => (val !== undefined && val !== null ? val as string | number : '—');

export default function Dashboard() {
  const collegeId = useAuthStore((s) => s.collegeId);

  const { data: people } = useQuery({ queryKey: ['dashboard-people', collegeId], queryFn: getPeopleStats });
  const { data: admissions } = useQuery({ queryKey: ['dashboard-admissions', collegeId], queryFn: getAdmissionsStats });
  const { data: academics } = useQuery({ queryKey: ['dashboard-academics', collegeId], queryFn: getAcademicsStats });
  const { data: finance } = useQuery({ queryKey: ['dashboard-finance', collegeId], queryFn: getFinanceStats });
  const { data: hr } = useQuery({ queryKey: ['dashboard-hr', collegeId], queryFn: getHRStats });
  const { data: welfare } = useQuery({ queryKey: ['dashboard-welfare', collegeId], queryFn: getWelfareStats });
  const { data: placement } = useQuery({ queryKey: ['dashboard-placement', collegeId], queryFn: getPlacementStats });
  const { data: campusOps } = useQuery({ queryKey: ['dashboard-campus-ops', collegeId], queryFn: getCampusOpsStats });
  const { data: studentDev } = useQuery({ queryKey: ['dashboard-student-dev', collegeId], queryFn: getStudentDevStats });
  const { data: compliance } = useQuery({ queryKey: ['dashboard-compliance', collegeId], queryFn: getComplianceStats });
  const { data: governance } = useQuery({ queryKey: ['dashboard-governance', collegeId], queryFn: getGovernanceStats });
  const { data: platform } = useQuery({ queryKey: ['dashboard-platform', collegeId], queryFn: getPlatformStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Dashboard</h2>

      {/* ── Top KPI Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={v(people?.activeStudents)} icon={Users} color="bg-primary-50 text-primary-500" to="/people" />
        <StatCard label="Active Faculty" value={v(people?.activeFaculty)} icon={GraduationCap} color="bg-teal-50 text-teal-600" to="/people" />
        <StatCard label="Total Payments" value={v(finance?.payments)} icon={IndianRupee} color="bg-orange-50 text-orange-500" to="/finance" />
        <StatCard label="Placement Offers" value={v(placement?.offersAccepted)} icon={TrendingUp} color="bg-accent-50 text-accent-500" to="/placement" />
        <StatCard label="New Admissions" value={v(admissions?.admissions)} icon={UserPlus} color="bg-primary-100 text-primary-700" to="/admissions" />
        <StatCard label="Active Courses" value={v(academics?.courseOfferings)} icon={BookOpen} color="bg-teal-100 text-teal-700" to="/academics" />
        <StatCard label="Hostel Blocks" value={v(welfare?.hostelBlocks)} icon={Heart} color="bg-accent-100 text-accent-600" to="/welfare" />
        <StatCard label="Buildings" value={v(campusOps?.buildings)} icon={Building2} color="bg-orange-100 text-orange-600" to="/campus" />
      </div>

      {/* ── Module Summary Cards ──────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Academics */}
        <Link to="/academics" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <BookOpenCheck size={18} className="text-primary-500" /> Academics
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Departments</span><span className="font-medium">{v(academics?.departments)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Programmes</span><span className="font-medium">{v(academics?.programmes)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Courses</span><span className="font-medium">{v(academics?.courses)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Course Offerings</span><span className="font-medium">{v(academics?.courseOfferings)}</span></div>
          </div>
        </Link>

        {/* Admissions */}
        <Link to="/admissions" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <UserPlus size={18} className="text-primary-500" /> Admissions
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Inquiries</span><span className="font-medium">{v(admissions?.inquiries)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Applicants</span><span className="font-medium">{v(admissions?.applicants)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Offers</span><span className="font-medium">{v(admissions?.offers)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Enrolled</span><span className="font-medium">{v(admissions?.admissions)}</span></div>
          </div>
        </Link>

        {/* Finance */}
        <Link to="/finance" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Banknote size={18} className="text-primary-500" /> Finance
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Fee Structures</span><span className="font-medium">{v(finance?.feeStructures)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payments</span><span className="font-medium">{v(finance?.payments)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Scholarships</span><span className="font-medium">{v(finance?.scholarships)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Budgets</span><span className="font-medium">{v(finance?.budgets)}</span></div>
          </div>
        </Link>

        {/* HR */}
        <Link to="/hr" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Briefcase size={18} className="text-primary-500" /> HR
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Employees</span><span className="font-medium">{v(hr?.employees)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Leave Applications</span><span className="font-medium">{v(hr?.leaveApplications)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payroll Records</span><span className="font-medium">{v(hr?.payrolls)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Trainings</span><span className="font-medium">{v(hr?.trainings)}</span></div>
          </div>
        </Link>

        {/* Placement */}
        <Link to="/placement" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-500" /> Placement
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Companies</span><span className="font-medium">{v(placement?.companies)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Job Postings</span><span className="font-medium">{v(placement?.jobPostings)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Offers Accepted</span><span className="font-medium">{v(placement?.offersAccepted)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Internships</span><span className="font-medium">{v(placement?.internships)}</span></div>
          </div>
        </Link>

        {/* Welfare */}
        <Link to="/welfare" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Heart size={18} className="text-primary-500" /> Welfare
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Hostel Blocks</span><span className="font-medium">{v(welfare?.hostelBlocks)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Transport Routes</span><span className="font-medium">{v(welfare?.transportRoutes)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Counseling Sessions</span><span className="font-medium">{v(welfare?.counselingSessions)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Grievances</span><span className="font-medium">{v(welfare?.studentGrievances)}</span></div>
          </div>
        </Link>

        {/* Campus Ops */}
        <Link to="/campus" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Building2 size={18} className="text-primary-500" /> Campus Ops
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Buildings</span><span className="font-medium">{v(campusOps?.buildings)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rooms</span><span className="font-medium">{v(campusOps?.rooms)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Assets</span><span className="font-medium">{v(campusOps?.assets)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Maintenance Requests</span><span className="font-medium">{v(campusOps?.maintenanceRequests)}</span></div>
          </div>
        </Link>

        {/* Student Development */}
        <Link to="/student-dev" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-primary-500" /> Student Development
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Clubs</span><span className="font-medium">{v(studentDev?.clubs)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Events</span><span className="font-medium">{v(studentDev?.events)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Achievements</span><span className="font-medium">{v(studentDev?.achievements)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Projects</span><span className="font-medium">{v(studentDev?.studentProjects)}</span></div>
          </div>
        </Link>

        {/* Governance */}
        <Link to="/governance" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Landmark size={18} className="text-primary-500" /> Governance
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Committees</span><span className="font-medium">{v(governance?.committees)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Policies</span><span className="font-medium">{v(governance?.policies)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Board Members</span><span className="font-medium">{v(governance?.boardMembers)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Strategic Goals</span><span className="font-medium">{v(governance?.goals)}</span></div>
          </div>
        </Link>

        {/* Compliance */}
        <Link to="/compliance" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-500" /> Compliance
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Accreditation Bodies</span><span className="font-medium">{v(compliance?.accreditationBodies)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Compliance Criteria</span><span className="font-medium">{v(compliance?.complianceCriteria)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Regulatory Filings</span><span className="font-medium">{v(compliance?.regulatoryFilings)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IQAC Reports</span><span className="font-medium">{v(compliance?.iqacReports)}</span></div>
          </div>
        </Link>

        {/* Platform */}
        <Link to="/platform" className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all">
          <h3 className="font-semibold text-navy-dark mb-3 flex items-center gap-2">
            <Megaphone size={18} className="text-primary-500" /> Platform
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Announcements</span><span className="font-medium">{v(platform?.announcements)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Circulars</span><span className="font-medium">{v(platform?.circulars)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Notifications</span><span className="font-medium">{v(platform?.notifications)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Surveys</span><span className="font-medium">{v(platform?.feedbackSurveys)}</span></div>
          </div>
        </Link>

      </div>
    </div>
  );
}
