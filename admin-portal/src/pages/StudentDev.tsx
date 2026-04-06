import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStudentDevStats } from '../services/student-dev';
import { ArrowLeft, Users, UserPlus, Calendar, Ticket, Award, BookOpen, Trophy, UserCheck, Heart, HeartHandshake, BadgeCheck, FolderGit2, Building2, ShieldCheck } from 'lucide-react';

import ClubsPage from './student-dev/ClubsPage';
import ClubMembershipsPage from './student-dev/ClubMembershipsPage';
import EventsPage from './student-dev/EventsPage';
import EventRegistrationsPage from './student-dev/EventRegistrationsPage';
import AchievementsPage from './student-dev/AchievementsPage';
import MentoringPage from './student-dev/MentoringPage';
import SportsTeamsPage from './student-dev/SportsTeamsPage';
import SportsTeamMembersPage from './student-dev/SportsTeamMembersPage';
import NSSActivitiesPage from './student-dev/NSSActivitiesPage';
import NSSParticipantsPage from './student-dev/NSSParticipantsPage';
import SkillCertificationsPage from './student-dev/SkillCertificationsPage';
import StudentProjectsPage from './student-dev/StudentProjectsPage';
import CommunityProjectsPage from './student-dev/CommunityProjectsPage';
import LeadershipRolesPage from './student-dev/LeadershipRolesPage';

function StudentDevHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['student-dev-stats'], queryFn: getStudentDevStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Student Development (M09)</h2>

      {/* KPI Banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Clubs</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.activeClubs || 0}</div>
            <span className="text-xs text-blue-500">of {stats.clubs || 0} total</span>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Events</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.completedEvents || 0}</div>
            <span className="text-xs text-green-500">completed of {stats.events || 0}</span>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Achievements</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.achievements || 0}</div>
            <span className="text-xs text-amber-500">total</span>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
            <span className="text-xs font-medium text-violet-600 uppercase">Projects</span>
            <div className="text-2xl font-bold text-violet-700 mt-1">{stats.completedProjects || 0}</div>
            <span className="text-xs text-violet-500">completed of {stats.studentProjects || 0}</span>
          </div>
        </div>
      )}

      {/* Clubs & Events */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Clubs & Events</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'clubs', icon: Users, label: 'Clubs', desc: 'Student clubs & societies', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'clubs' },
          { to: 'club-memberships', icon: UserPlus, label: 'Club Memberships', desc: 'Member roles & status', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'clubMemberships' },
          { to: 'events', icon: Calendar, label: 'Events', desc: 'Fests, workshops & hackathons', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'events' },
          { to: 'event-registrations', icon: Ticket, label: 'Event Registrations', desc: 'Participants & teams', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'eventRegistrations' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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

      {/* Achievements & Mentoring */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Achievements & Mentoring</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'achievements', icon: Award, label: 'Achievements', desc: 'Awards & recognition', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'achievements' },
          { to: 'mentoring', icon: BookOpen, label: 'Mentoring', desc: 'Faculty-student mentoring', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: 'mentoringSessions' },
          { to: 'skill-certifications', icon: BadgeCheck, label: 'Skill Certifications', desc: 'Industry certifications', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'skillCertifications' },
          { to: 'leadership-roles', icon: ShieldCheck, label: 'Leadership Roles', desc: 'Student leadership positions', iconBg: 'bg-purple-50 text-purple-600', border: 'border-purple-200 hover:border-purple-400', statKey: 'leadershipRoles' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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

      {/* Sports & NSS */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sports & NSS</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'sports-teams', icon: Trophy, label: 'Sports Teams', desc: 'Teams & tournaments', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'sportsTeams' },
          { to: 'sports-team-members', icon: UserCheck, label: 'Team Members', desc: 'Player positions & roster', iconBg: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-200 hover:border-yellow-400', statKey: 'sportsTeamMembers' },
          { to: 'nss-activities', icon: Heart, label: 'NSS Activities', desc: 'Social service activities', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'nssActivities' },
          { to: 'nss-participants', icon: HeartHandshake, label: 'NSS Participants', desc: 'Volunteer participation', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400', statKey: 'nssParticipants' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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

      {/* Projects */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Projects</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'student-projects', icon: FolderGit2, label: 'Student Projects', desc: 'Mini & major projects', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'studentProjects' },
          { to: 'community-projects', icon: Building2, label: 'Community Projects', desc: 'Social impact projects', iconBg: 'bg-lime-50 text-lime-600', border: 'border-lime-200 hover:border-lime-400', statKey: 'communityProjects' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isSubPage = path !== '/student-dev' && path !== '/student-dev/';

  return (
    <div>
      {isSubPage && (
        <button onClick={() => navigate('/student-dev')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} className="text-gray-400" /> Back to Student Development
        </button>
      )}
      {children}
    </div>
  );
}

export default function StudentDev() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<StudentDevHome />} />
        <Route path="clubs" element={<ClubsPage />} />
        <Route path="club-memberships" element={<ClubMembershipsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="event-registrations" element={<EventRegistrationsPage />} />
        <Route path="achievements" element={<AchievementsPage />} />
        <Route path="mentoring" element={<MentoringPage />} />
        <Route path="sports-teams" element={<SportsTeamsPage />} />
        <Route path="sports-team-members" element={<SportsTeamMembersPage />} />
        <Route path="nss-activities" element={<NSSActivitiesPage />} />
        <Route path="nss-participants" element={<NSSParticipantsPage />} />
        <Route path="skill-certifications" element={<SkillCertificationsPage />} />
        <Route path="student-projects" element={<StudentProjectsPage />} />
        <Route path="community-projects" element={<CommunityProjectsPage />} />
        <Route path="leadership-roles" element={<LeadershipRolesPage />} />
      </Routes>
    </SubPageWrapper>
  );
}
