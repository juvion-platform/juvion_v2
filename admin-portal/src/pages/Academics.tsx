import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '../services/academics';
import { BookOpen, GraduationCap, Building2, GitBranch, Users, LayoutGrid, Calendar, Clock, BookMarked, Map, Layers, UserCheck, CalendarDays, Table2, ClipboardCheck, FileText, FileCheck, Award, Target, MessageSquare, BookCopy, TrendingUp } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';

import RegulationsPage from './academics/RegulationsPage';
import ProgrammesPage from './academics/ProgrammesPage';
import DepartmentsPage from './academics/DepartmentsPage';
import BranchesPage from './academics/BranchesPage';
import BatchesPage from './academics/BatchesPage';
import SectionsPage from './academics/SectionsPage';
import AcademicYearsPage from './academics/AcademicYearsPage';
import SemestersPage from './academics/SemestersPage';
import CoursesPage from './academics/CoursesPage';
import CurriculumPage from './academics/CurriculumPage';
import CourseOfferingsPage from './academics/CourseOfferingsPage';
import AcademicCalendarPage from './academics/AcademicCalendarPage';
import TimetablesPage from './academics/TimetablesPage';
import AttendanceSessionsPage from './academics/AttendanceSessionsPage';
import InternalAssessmentsPage from './academics/InternalAssessmentsPage';
import ExamSchedulesPage from './academics/ExamSchedulesPage';
import ExamRegistrationsPage from './academics/ExamRegistrationsPage';
import GradeCardsPage from './academics/GradeCardsPage';
import SemesterResultsPage from './academics/SemesterResultsPage';
import LessonPlansPage from './academics/LessonPlansPage';
import CourseFeedbackPage from './academics/CourseFeedbackPage';
import ExamConfigPage from './academics/ExamConfigPage';
import PromotionPage from './academics/PromotionPage';

const STRUCTURE_CARDS = [
  { to: 'regulations', icon: BookOpen, label: 'Regulations', desc: 'Academic rule sets (R20, R23)', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'regulations' },
  { to: 'programmes', icon: GraduationCap, label: 'Programmes', desc: 'B.Tech, M.Tech, MBA etc.', iconBg: 'bg-primary-50 text-primary-600', border: 'border-primary-200 hover:border-primary-400', statKey: 'programmes' },
  { to: 'departments', icon: Building2, label: 'Departments', desc: 'Academic departments', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'departments' },
  { to: 'branches', icon: GitBranch, label: 'Branches', desc: 'CSE, ECE, ME etc.', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'branches' },
  { to: 'batches', icon: Users, label: 'Batches', desc: 'Admission year groups', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'batches' },
  { to: 'sections', icon: LayoutGrid, label: 'Sections', desc: 'Class divisions (A, B, C)', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'sections' },
  { to: 'academic-years', icon: Calendar, label: 'Academic Years', desc: 'Year cycle management', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'academicYears' },
  { to: 'semesters', icon: Clock, label: 'Semesters', desc: 'Term periods & status', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'semesters' },
];

function AcademicsHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['academics-stats'], queryFn: getStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Academics</h2>

      {/* Current Academic Year Banner */}
      {stats?.currentYear && (
        <div className="bg-gradient-to-r from-primary-50 to-teal-50 border border-primary-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-primary-500 uppercase tracking-wide">Current Academic Year</span>
            <h3 className="text-lg font-bold text-navy">{stats.currentYear.label}</h3>
            <p className="text-sm text-gray-500">
              {new Date(stats.currentYear.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' — '}
              {new Date(stats.currentYear.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {stats.activeSemesters > 0 && (
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {stats.activeSemesters} Active Semester{stats.activeSemesters > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Structure Cards */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Academic Structure</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STRUCTURE_CARDS.map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '—';
          return (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}
            >
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}>
                <Icon size={22} />
              </div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Course & Curriculum Cards */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Courses & Curriculum</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'courses', icon: BookMarked, label: 'Courses', desc: 'Course catalog', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'courses' },
          { to: 'curriculum', icon: Map, label: 'Curriculum', desc: 'Semester-wise mapping', iconBg: 'bg-purple-50 text-purple-600', border: 'border-purple-200 hover:border-purple-400', statKey: null },
          { to: 'offerings', icon: Layers, label: 'Offerings', desc: 'Course offerings per section', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'courseOfferings' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '—';
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Scheduling */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Scheduling</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'academic-calendar', icon: CalendarDays, label: 'Academic Calendar', desc: 'Events, holidays & dates', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400' },
          { to: 'timetables', icon: Table2, label: 'Timetables', desc: 'Section-wise schedules', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Operations */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Operations</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'attendance', icon: ClipboardCheck, label: 'Attendance', desc: 'Session-wise tracking', iconBg: 'bg-lime-50 text-lime-600', border: 'border-lime-200 hover:border-lime-400' },
          { to: 'internal-assessments', icon: FileText, label: 'Assessments', desc: 'Internal marks & quizzes', iconBg: 'bg-fuchsia-50 text-fuchsia-600', border: 'border-fuchsia-200 hover:border-fuchsia-400' },
          { to: 'exam-schedules', icon: FileCheck, label: 'Exam Schedules', desc: 'Exam date & venue', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400' },
          { to: 'exam-registrations', icon: UserCheck, label: 'Exam Registrations', desc: 'Student exam sign-ups', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Results & OBE */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Results & OBE</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'grade-cards', icon: Award, label: 'Grade Cards', desc: 'Course-wise grades', iconBg: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-200 hover:border-yellow-400' },
          { to: 'semester-results', icon: Target, label: 'Semester Results', desc: 'SGPA/CGPA computation', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400' },
          { to: 'promotion', icon: TrendingUp, label: 'Promotion', desc: 'Promote students + fee pin', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400' },
          { to: 'lesson-plans', icon: BookCopy, label: 'Lesson Plans', desc: 'Week-wise planning', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400' },
          { to: 'course-feedback', icon: MessageSquare, label: 'Feedback', desc: 'Course & faculty feedback', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400' },
          { to: 'exam-config', icon: ClipboardCheck, label: 'Exam Config', desc: 'Rooms · evaluators · grading · papers · signatures · MOOC', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Breadcrumbs className="mb-4" />
      {children}
    </div>
  );
}

export default function Academics() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<AcademicsHome />} />
        <Route path="regulations" element={<RegulationsPage />} />
        <Route path="programmes" element={<ProgrammesPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="sections" element={<SectionsPage />} />
        <Route path="academic-years" element={<AcademicYearsPage />} />
        <Route path="semesters" element={<SemestersPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="curriculum" element={<CurriculumPage />} />
        <Route path="offerings" element={<CourseOfferingsPage />} />
        <Route path="academic-calendar" element={<AcademicCalendarPage />} />
        <Route path="timetables" element={<TimetablesPage />} />
        <Route path="attendance" element={<AttendanceSessionsPage />} />
        <Route path="internal-assessments" element={<InternalAssessmentsPage />} />
        <Route path="exam-schedules" element={<ExamSchedulesPage />} />
        <Route path="exam-registrations" element={<ExamRegistrationsPage />} />
        <Route path="grade-cards" element={<GradeCardsPage />} />
        <Route path="semester-results" element={<SemesterResultsPage />} />
        <Route path="promotion" element={<PromotionPage />} />
        <Route path="lesson-plans" element={<LessonPlansPage />} />
        <Route path="course-feedback" element={<CourseFeedbackPage />} />
        <Route path="exam-config" element={<ExamConfigPage />} />
        <Route path="exam-config/:entity" element={<ExamConfigPage />} />
      </Routes>
    </SubPageWrapper>
  );
}
