/**
 * Placement W04 surfaces.
 *
 * These twelve entities shipped with complete backends and no frontend at
 * all — the audit's "W04 backend workflow routes have no frontend UI". Each
 * is a straightforward list/detail surface plus its lifecycle transitions, so
 * they are declared as ResourcePage configs rather than twelve near-identical
 * hand-written files. Anything that needs bespoke behaviour later can be
 * promoted to its own page without changing its route.
 */
import { CheckCircle2, XCircle, Ban, Undo2, Send, UserCheck, Handshake, Play, Archive, RefreshCw, ListChecks } from 'lucide-react';
import ResourcePage, { type ResourceConfig } from '../../components/ui/ResourcePage';
import * as svc from '../../services/placement';
import { listStudents, listPersons } from '../../services/people';

// ─── shared ref pickers ────────────────────────────────────────────────────

const studentRef = {
  queryKey: ['students', 'picker'] as const,
  fetcher: (q: string) => listStudents(1, 20, undefined, q || undefined),
  getLabel: (s: any) => s.person?.name || s.personId?.name || s.rollNumber || s._id,
  getHint: (s: any) => s.rollNumber || undefined,
};

const personRef = {
  queryKey: ['persons', 'picker'] as const,
  fetcher: (q: string) => listPersons(1, 20, q || undefined),
  getLabel: (p: any) => p.name || p._id,
  getHint: (p: any) => [p.phone, p.email].filter(Boolean).join(' · ') || undefined,
};

const seasonRef = {
  queryKey: ['placement-seasons', 'picker'] as const,
  fetcher: (q: string) => svc.listPlacementSeasons(1, 20, q || undefined),
  getLabel: (s: any) => s.name || s._id,
  getHint: (s: any) => s.status || undefined,
};

const companyRef = {
  queryKey: ['companies', 'picker'] as const,
  fetcher: (q: string) => svc.listCompanies(1, 20, q || undefined),
  getLabel: (c: any) => c.name || c._id,
  getHint: (c: any) => c.industry || undefined,
};

const jobPostingRef = {
  queryKey: ['job-postings', 'picker'] as const,
  fetcher: (q: string) => svc.listJobPostings(1, 20, undefined, q || undefined),
  getLabel: (j: any) => j.title || j.role || j._id,
  getHint: (j: any) => j.companyId?.name || undefined,
};

const driveRef = {
  queryKey: ['placement-drives', 'picker'] as const,
  fetcher: (q: string) => svc.listDrives(1, 20, q || undefined),
  getLabel: (d: any) => d.companyId?.name ? `${d.companyId.name} drive` : d._id,
  getHint: (d: any) => d.status || undefined,
};

const alumniProfileRef = {
  queryKey: ['alumni-profiles', 'picker'] as const,
  fetcher: (q: string) => svc.listAlumniProfiles(1, 20, q || undefined),
  getLabel: (a: any) => a.personId?.name || a.name || a._id,
  getHint: (a: any) => a.graduationYear ? String(a.graduationYear) : undefined,
};

// ─── configs ───────────────────────────────────────────────────────────────

const drives: ResourceConfig = {
  title: 'Placement Drives',
  singular: 'Drive',
  queryKey: 'placement-drives',
  description: 'Company recruitment drives for a placement season.',
  invalidates: ['placement-stats'],
  fields: [
    { name: 'placementSeasonId', label: 'Season', type: 'ref', required: true, ref: seasonRef },
    { name: 'companyId', label: 'Company', type: 'ref', required: true, ref: companyRef },
    { name: 'jobPostingId', label: 'Job Posting', type: 'ref', required: true, ref: jobPostingRef },
    { name: 'type', label: 'Type', type: 'select', options: ['on_campus', 'virtual', 'pool', 'off_campus'] },
    { name: 'status', label: 'Status', type: 'select', options: ['scheduled', 'jd_published', 'applications_open', 'applications_closed', 'shortlist_released', 'interviews_in_progress', 'offers_released', 'closed', 'cancelled'] },
    { name: 'driveDate', label: 'Drive Date', type: 'date' },
    { name: 'venue', label: 'Venue', type: 'text' },
    { name: 'virtualLink', label: 'Virtual Link', type: 'url', hideInTable: true },
    { name: 'applicationCount', label: 'Applications', type: 'number', readOnly: true },
    { name: 'shortlistedCount', label: 'Shortlisted', type: 'number', readOnly: true },
    { name: 'offeredCount', label: 'Offers', type: 'number', readOnly: true },
  ],
  rowActions: [
    {
      key: 'shortlist', label: 'Generate shortlist', icon: ListChecks, color: 'text-primary-600',
      visible: (r) => ['applications_closed', 'applications_open'].includes(r.status),
      confirmMessage: 'Scores every application against the posting’s eligibility criteria.',
      run: (r) => svc.generateDriveShortlist(r._id),
    },
    {
      key: 'release', label: 'Release shortlist', icon: Send, color: 'text-teal-600',
      visible: (r) => r.status === 'applications_closed',
      confirmMessage: 'Shortlisted students are notified. This cannot be un-sent.',
      run: (r) => svc.releaseDriveShortlist(r._id),
    },
    {
      key: 'close', label: 'Close drive', icon: Archive, color: 'text-slate-600',
      visible: (r) => !['closed', 'cancelled'].includes(r.status),
      run: (r) => svc.closeDrive(r._id),
    },
    {
      key: 'cancel', label: 'Cancel drive', icon: Ban, color: 'text-red-500', tone: 'danger',
      visible: (r) => !['closed', 'cancelled'].includes(r.status),
      requireReason: true, reasonLabel: 'Cancellation reason',
      run: (r, reason) => svc.cancelDrive(r._id, reason),
    },
  ],
  api: { list: svc.listDrives, create: svc.createDrive },
};

const driveApplications: ResourceConfig = {
  title: 'Drive Applications',
  singular: 'Application',
  queryKey: 'drive-applications',
  description: 'Student applications to a drive. Created by students; managed here.',
  fields: [
    { name: 'driveId', label: 'Drive', type: 'ref', ref: driveRef },
    { name: 'studentId', label: 'Student', type: 'ref', ref: studentRef },
    { name: 'status', label: 'Status', type: 'select', options: ['applied', 'shortlisted', 'not_selected', 'offered', 'withdrawn', 'no_show'] },
    { name: 'matchScore', label: 'Match', type: 'number' },
    { name: 'matchConfidence', label: 'Confidence', type: 'select', options: ['high', 'medium', 'low'] },
    { name: 'appliedAt', label: 'Applied', type: 'datetime' },
    { name: 'resumeUrl', label: 'Resume', type: 'url', hideInTable: true },
  ],
  rowActions: [
    {
      key: 'withdraw', label: 'Withdraw', icon: Undo2, color: 'text-red-500', tone: 'danger',
      visible: (r) => !['withdrawn', 'offered'].includes(r.status),
      requireReason: true, reasonLabel: 'Withdrawal reason',
      run: (r, reason) => svc.withdrawDriveApplication(r._id, reason),
    },
  ],
  api: { list: svc.listDriveApplications },
};

const interviewSchedules: ResourceConfig = {
  title: 'Interview Schedules',
  singular: 'Interview',
  queryKey: 'interview-schedules',
  description: 'Interview slots allocated to shortlisted students.',
  fields: [
    { name: 'driveId', label: 'Drive', type: 'ref', ref: driveRef },
    { name: 'studentId', label: 'Student', type: 'ref', ref: studentRef },
    { name: 'slotStart', label: 'Slot Start', type: 'datetime' },
    { name: 'slotEnd', label: 'Slot End', type: 'datetime' },
    { name: 'venue', label: 'Venue', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: ['scheduled', 'confirmed', 'rescheduled', 'completed', 'no_show', 'cancelled'] },
    { name: 'outcome', label: 'Outcome', type: 'select', options: ['selected', 'not_selected', 'pending'], hideInTable: true },
    { name: 'virtualLink', label: 'Virtual Link', type: 'url', hideInTable: true },
  ],
  rowActions: [
    {
      key: 'selected', label: 'Mark selected', icon: CheckCircle2, color: 'text-teal-600',
      visible: (r) => r.outcome !== 'selected',
      run: (r) => svc.setInterviewOutcome(r._id, 'selected'),
    },
    {
      key: 'not-selected', label: 'Mark not selected', icon: XCircle, color: 'text-red-500', tone: 'danger',
      visible: (r) => r.outcome !== 'not_selected',
      run: (r) => svc.setInterviewOutcome(r._id, 'not_selected'),
    },
  ],
  api: { list: svc.listInterviewSchedules },
};

const careerProfiles: ResourceConfig = {
  title: 'Career Profiles',
  singular: 'Career Profile',
  queryKey: 'career-profiles',
  description: 'The placement-facing profile a student presents to recruiters.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', ref: studentRef },
    { name: 'placementSeasonId', label: 'Season', type: 'ref', ref: seasonRef },
    { name: 'status', label: 'Status', type: 'select', options: ['draft', 'incomplete', 'complete', 'validated'] },
    { name: 'profileCompletenessScore', label: 'Completeness', type: 'number', readOnly: true },
    { name: 'photoUrl', label: 'Photo', type: 'url', hideInTable: true },
  ],
  rowActions: [
    {
      key: 'refresh', label: 'Refresh academic data', icon: RefreshCw, color: 'text-primary-600',
      confirmMessage: 'Re-pulls CGPA, backlogs and attendance from the academic records.',
      run: (r) => svc.refreshCareerProfileAcademic(r._id),
    },
  ],
  api: { list: svc.listCareerProfiles, update: svc.updateCareerProfile },
};

const readinessScores: ResourceConfig = {
  title: 'Readiness Scores',
  singular: 'Readiness Score',
  queryKey: 'readiness-scores',
  description: 'Computed placement-readiness per student. Recomputed in batch, never edited by hand.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', ref: studentRef },
    { name: 'placementSeasonId', label: 'Season', type: 'ref', ref: seasonRef },
    { name: 'overall', label: 'Overall', type: 'number' },
    { name: 'category', label: 'Category', type: 'select', options: ['ready', 'needs_improvement', 'at_risk'] },
    { name: 'lastComputedAt', label: 'Last Computed', type: 'datetime' },
  ],
  api: { list: svc.listReadinessScores },
};

const skillRecords: ResourceConfig = {
  title: 'Skill Records',
  singular: 'Skill Record',
  queryKey: 'skill-records',
  description: 'Assessment and certification evidence backing a student’s readiness score.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef },
    { name: 'skillName', label: 'Skill', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: ['aptitude', 'technical', 'soft_skills', 'domain'] },
    { name: 'source', label: 'Source', type: 'select', required: true, options: ['assessment', 'training_assessment', 'self_reported', 'certification', 'mock_interview'] },
    { name: 'score', label: 'Score', type: 'number' },
    { name: 'percentile', label: 'Percentile', type: 'number', hideInTable: true },
    { name: 'vendor', label: 'Vendor', type: 'text', hideInTable: true },
    { name: 'assessedAt', label: 'Assessed', type: 'date', hideInTable: true },
    { name: 'verificationStatus', label: 'Verification', type: 'select', options: ['unverified', 'verified', 'rejected'] },
  ],
  api: { list: svc.listSkillRecords, create: svc.createSkillRecord, update: svc.updateSkillRecord, remove: svc.deleteSkillRecord },
};

const placementBars: ResourceConfig = {
  title: 'Placement Bars',
  singular: 'Placement Bar',
  queryKey: 'placement-bars',
  description: 'Students barred from placement activity, and why.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef },
    { name: 'barType', label: 'Type', type: 'select', required: true, options: ['disciplinary', 'academic_fraud', 'fee_default', 'other'] },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'lifted'] },
    { name: 'appliedBy', label: 'Applied By', type: 'ref', required: true, ref: personRef },
    { name: 'appliedAt', label: 'Applied', type: 'date' },
    { name: 'liftConditions', label: 'Lift Conditions', type: 'textarea', hideInTable: true },
  ],
  rowActions: [
    {
      key: 'lift', label: 'Lift bar', icon: Undo2, color: 'text-teal-600',
      visible: (r) => r.status === 'active',
      requireReason: true, reasonLabel: 'Conditions / justification for lifting',
      confirmMessage: 'The student becomes eligible for placement activity again.',
      run: (r, reason) => svc.liftPlacementBar(r._id, reason),
    },
  ],
  api: { list: svc.listPlacementBars, create: svc.createPlacementBar },
};

const optOuts: ResourceConfig = {
  title: 'Placement Opt-Outs',
  singular: 'Opt-Out',
  queryKey: 'placement-opt-outs',
  description: 'Students who have opted out of placement for a season. Affects placement-rate denominators.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef },
    { name: 'placementSeasonId', label: 'Season', type: 'ref', required: true, ref: seasonRef },
    { name: 'reason', label: 'Reason', type: 'select', required: true, options: ['higher_education', 'entrepreneurship', 'family_business', 'personal', 'other'] },
    { name: 'reasonDetail', label: 'Detail', type: 'textarea', hideInTable: true },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'voided'] },
    { name: 'recordedBy', label: 'Recorded By', type: 'ref', required: true, ref: personRef },
    { name: 'evidenceUrl', label: 'Evidence', type: 'url', hideInTable: true },
    { name: 'recordedAt', label: 'Recorded', type: 'date' },
  ],
  rowActions: [
    {
      key: 'void', label: 'Void opt-out', icon: Ban, color: 'text-red-500', tone: 'danger',
      visible: (r) => r.status === 'active',
      requireReason: true, reasonLabel: 'Reason for voiding',
      confirmMessage: 'The student re-enters the placement pool and the season’s statistics change.',
      run: (r, reason) => svc.voidOptOut(r._id, reason),
    },
  ],
  api: { list: svc.listOptOuts, create: svc.createOptOut },
};

const recruiterAccounts: ResourceConfig = {
  title: 'Recruiter Accounts',
  singular: 'Recruiter Account',
  queryKey: 'recruiter-accounts',
  description: 'External recruiter logins, and their verification state.',
  fields: [
    { name: 'personId', label: 'Person', type: 'ref', required: true, ref: personRef },
    { name: 'companyId', label: 'Company', type: 'ref', required: true, ref: companyRef },
    { name: 'designation', label: 'Designation', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'text', hideInTable: true },
    { name: 'status', label: 'Status', type: 'select', options: ['registered', 'verified', 'active', 'deactivated'] },
    { name: 'lastLoginAt', label: 'Last Login', type: 'datetime' },
  ],
  rowActions: [
    {
      key: 'verify', label: 'Verify account', icon: UserCheck, color: 'text-teal-600',
      visible: (r) => r.status === 'registered',
      confirmMessage: 'The recruiter gains access to the recruiter portal.',
      run: (r) => svc.verifyRecruiterAccount(r._id),
    },
    {
      key: 'deactivate', label: 'Deactivate account', icon: Ban, color: 'text-red-500', tone: 'danger',
      visible: (r) => r.status !== 'deactivated',
      requireReason: true, reasonLabel: 'Deactivation reason',
      run: (r, reason) => svc.deactivateRecruiterAccount(r._id, reason),
    },
  ],
  api: { list: svc.listRecruiterAccounts, create: svc.createRecruiterAccount },
};

const alumniCareerRecords: ResourceConfig = {
  title: 'Alumni Career Records',
  singular: 'Career Record',
  queryKey: 'alumni-career-records',
  description: 'Where alumni are now — drives outcome reporting and the mentor pool.',
  fields: [
    { name: 'personId', label: 'Person', type: 'ref', required: true, ref: personRef },
    { name: 'alumniProfileId', label: 'Alumni Profile', type: 'ref', required: true, ref: alumniProfileRef },
    { name: 'currentEmployer', label: 'Employer', type: 'text' },
    { name: 'currentRole', label: 'Role', type: 'text' },
    { name: 'careerStatus', label: 'Status', type: 'select', options: ['employed', 'seeking', 'higher_education', 'entrepreneur', 'unknown'] },
    { name: 'industry', label: 'Industry', type: 'text', hideInTable: true },
    { name: 'location', label: 'Location', type: 'text', hideInTable: true },
    { name: 'ctcRange', label: 'CTC Range', type: 'text', hideInTable: true },
    { name: 'updateSource', label: 'Source', type: 'select', required: true, options: ['system_seeded', 'self_report', 'tpo_entry', 'survey'] },
    { name: 'lastUpdated', label: 'Updated', type: 'date' },
  ],
  api: { list: svc.listAlumniCareerRecords, create: svc.createAlumniCareerRecord, update: svc.updateAlumniCareerRecord },
};

const alumniEngagements: ResourceConfig = {
  title: 'Alumni Engagements',
  singular: 'Engagement',
  queryKey: 'alumni-engagements',
  description: 'Outreach sent to alumni and how they responded.',
  fields: [
    { name: 'alumniId', label: 'Alumni', type: 'ref', required: true, ref: alumniProfileRef },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['career_tracking_invitation', 'career_update', 'mentor_registration', 'event_participation', 'guest_lecture', 'donation'] },
    { name: 'status', label: 'Status', type: 'select', options: ['sent', 'opened', 'responded', 'declined', 'expired'] },
    { name: 'sentAt', label: 'Sent', type: 'datetime' },
    { name: 'respondedAt', label: 'Responded', type: 'datetime' },
    { name: 'reminderCount', label: 'Reminders', type: 'number', readOnly: true },
  ],
  rowActions: [
    {
      key: 'remind', label: 'Send reminder', icon: Send, color: 'text-primary-600',
      visible: (r) => !['responded', 'declined'].includes(r.status),
      run: (r) => svc.remindAlumniEngagement(r._id),
    },
  ],
  api: { list: svc.listAlumniEngagements, create: svc.createAlumniEngagement },
};

const mentorMatches: ResourceConfig = {
  title: 'Mentor Matches',
  singular: 'Mentor Match',
  queryKey: 'mentor-matches',
  description: 'Suggested alumni-to-student mentoring pairs and their progress.',
  fields: [
    { name: 'alumniId', label: 'Alumni', type: 'ref', required: true, ref: alumniProfileRef },
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef },
    { name: 'matchScore', label: 'Score', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['suggested', 'approved_by_tpo', 'introduced', 'active', 'closed', 'declined'] },
    { name: 'introducedAt', label: 'Introduced', type: 'datetime' },
    { name: 'lastInteractionAt', label: 'Last Contact', type: 'datetime' },
  ],
  rowActions: [
    {
      key: 'approve', label: 'Approve match', icon: CheckCircle2, color: 'text-teal-600',
      visible: (r) => r.status === 'suggested',
      run: (r) => svc.approveMentorMatch(r._id),
    },
    {
      key: 'introduce', label: 'Send introduction', icon: Handshake, color: 'text-primary-600',
      visible: (r) => r.status === 'approved_by_tpo',
      run: (r) => svc.introduceMentorMatch(r._id),
    },
    {
      key: 'activate', label: 'Mark active', icon: Play, color: 'text-teal-600',
      visible: (r) => r.status === 'introduced',
      run: (r) => svc.activateMentorMatch(r._id),
    },
    {
      key: 'close', label: 'Close match', icon: Archive, color: 'text-slate-600',
      visible: (r) => !['closed', 'declined'].includes(r.status),
      run: (r) => svc.closeMentorMatch(r._id),
    },
  ],
  api: { list: svc.listMentorMatches, create: svc.createMentorMatch },
};

// ─── exported page components ──────────────────────────────────────────────

export const DrivesPage = () => <ResourcePage config={drives} />;
export const DriveApplicationsPage = () => <ResourcePage config={driveApplications} />;
export const InterviewSchedulesPage = () => <ResourcePage config={interviewSchedules} />;
export const CareerProfilesPage = () => <ResourcePage config={careerProfiles} />;
export const ReadinessScoresPage = () => <ResourcePage config={readinessScores} />;
export const SkillRecordsPage = () => <ResourcePage config={skillRecords} />;
export const PlacementBarsPage = () => <ResourcePage config={placementBars} />;
export const OptOutsPage = () => <ResourcePage config={optOuts} />;
export const RecruiterAccountsPage = () => <ResourcePage config={recruiterAccounts} />;
export const AlumniCareerRecordsPage = () => <ResourcePage config={alumniCareerRecords} />;
export const AlumniEngagementsPage = () => <ResourcePage config={alumniEngagements} />;
export const MentorMatchesPage = () => <ResourcePage config={mentorMatches} />;
