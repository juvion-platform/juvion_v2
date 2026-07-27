/**
 * Student Development W09 surfaces.
 *
 * Fest lifecycle, Competitions, Workshops, SD Programmes, Awards,
 * Certificates, Activity Budgets and Sponsorships all had complete backends
 * and no frontend — the audit's "/student-dev/fests → no match". Declared as
 * ResourcePage configs for the same reason as the Placement W04 set.
 *
 * Portfolios are deliberately absent: that API is student-scoped
 * (/portfolios/my, /portfolios/:studentId) rather than a college-wide list,
 * so it belongs on the student detail page, not an admin list.
 */
import { CheckCircle2, XCircle, Ban, Archive, BadgeCheck, Undo2, Scale } from 'lucide-react';
import ResourcePage, { type ResourceConfig } from '../../components/ui/ResourcePage';
import * as svc from '../../services/student-dev';
import { listStudents, listPersons } from '../../services/people';
import { listAcademicYears, listDepartments } from '../../services/academics';

// ─── shared ref pickers ────────────────────────────────────────────────────

const personRef = {
  queryKey: ['persons', 'picker'] as const,
  fetcher: (q: string) => listPersons(1, 20, q || undefined),
  getLabel: (p: any) => p.name || p._id,
  getHint: (p: any) => [p.phone, p.email].filter(Boolean).join(' · ') || undefined,
};

const studentRef = {
  queryKey: ['students', 'picker'] as const,
  fetcher: (q: string) => listStudents(1, 20, undefined, q || undefined),
  getLabel: (s: any) => s.person?.name || s.personId?.name || s.rollNumber || s._id,
  getHint: (s: any) => s.rollNumber || undefined,
};

const academicYearRef = {
  queryKey: ['academic-years', 'picker'] as const,
  fetcher: (q: string) => listAcademicYears(1, 20, q || undefined),
  getLabel: (y: any) => y.label || y.code || y._id,
};

const departmentRef = {
  queryKey: ['departments', 'picker'] as const,
  fetcher: (q: string) => listDepartments(1, 20, q || undefined),
  getLabel: (d: any) => d.name || d.code || d._id,
};

const clubRef = {
  queryKey: ['clubs', 'picker'] as const,
  fetcher: (q: string) => svc.listClubs(1, 20, q || undefined),
  getLabel: (c: any) => c.name || c._id,
};

const sponsorContactRef = {
  queryKey: ['sponsor-contacts', 'picker'] as const,
  fetcher: (q: string) => svc.listSponsorContacts(1, 20, q || undefined),
  getLabel: (s: any) => s.organisationName || s.name || s._id,
  getHint: (s: any) => s.contactPerson || s.email || undefined,
};

// ─── configs ───────────────────────────────────────────────────────────────

const fests: ResourceConfig = {
  title: 'Fests',
  singular: 'Fest',
  queryKey: 'sd-fests',
  description: 'Multi-day campus fests, from proposal through to close-out.',
  invalidates: ['student-dev-stats'],
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['technical', 'cultural', 'sports', 'literary', 'multi'] },
    { name: 'academicYearId', label: 'Academic Year', type: 'ref', required: true, ref: academicYearRef },
    { name: 'startDate', label: 'Start', type: 'date', required: true },
    { name: 'endDate', label: 'End', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['proposed', 'approved', 'planning', 'active', 'completed', 'closed', 'cancelled'] },
    { name: 'proposedBy', label: 'Proposed By', type: 'ref', required: true, ref: personRef, hideInTable: true },
    { name: 'estimatedBudget', label: 'Est. Budget', type: 'number', hideInTable: true },
    { name: 'estimatedAttendance', label: 'Est. Attendance', type: 'number', hideInTable: true },
    { name: 'description', label: 'Description', type: 'textarea', hideInTable: true },
  ],
  rowActions: [
    { key: 'approve', label: 'Approve fest', icon: CheckCircle2, color: 'text-teal-600', visible: (r) => r.status === 'proposed', run: (r) => svc.approveFest(r._id) },
    { key: 'reject', label: 'Reject fest', icon: XCircle, color: 'text-red-500', tone: 'danger', visible: (r) => r.status === 'proposed', requireReason: true, reasonLabel: 'Rejection reason', run: (r, reason) => svc.rejectFest(r._id, reason) },
    { key: 'close', label: 'Close fest', icon: Archive, color: 'text-slate-600', visible: (r) => ['active', 'completed'].includes(r.status), run: (r) => svc.closeFest(r._id) },
    { key: 'cancel', label: 'Cancel fest', icon: Ban, color: 'text-red-500', tone: 'danger', visible: (r) => !['closed', 'cancelled'].includes(r.status), requireReason: true, reasonLabel: 'Cancellation reason', run: (r, reason) => svc.cancelFest(r._id, reason) },
  ],
  api: { list: svc.listFests, create: svc.proposeFest },
};

const competitions: ResourceConfig = {
  title: 'Competitions',
  singular: 'Competition',
  queryKey: 'sd-competitions',
  description: 'Hackathons, quizzes, matches and performances — standalone or inside a fest.',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['hackathon', 'coding', 'quiz', 'debate', 'sports_match', 'cultural_performance', 'other'] },
    { name: 'parentType', label: 'Context', type: 'select', required: true, options: ['fest', 'standalone', 'inter_college'] },
    { name: 'status', label: 'Status', type: 'select', options: ['proposed', 'approved', 'registration_open', 'ongoing', 'results_declared', 'closed', 'cancelled'] },
    { name: 'startDate', label: 'Start', type: 'date', required: true },
    { name: 'endDate', label: 'End', type: 'date', required: true },
    { name: 'clubId', label: 'Club', type: 'ref', ref: clubRef, hideInTable: true },
    { name: 'departmentId', label: 'Department', type: 'ref', ref: departmentRef, hideInTable: true },
    { name: 'coordinatorId', label: 'Coordinator', type: 'ref', ref: personRef, hideInTable: true },
    { name: 'venue', label: 'Venue', type: 'text', hideInTable: true },
    { name: 'maxParticipants', label: 'Max Participants', type: 'number', hideInTable: true },
    { name: 'registrationDeadline', label: 'Registration Deadline', type: 'date', hideInTable: true },
    { name: 'eligibilityCriteria', label: 'Eligibility', type: 'textarea', hideInTable: true },
  ],
  rowActions: [
    { key: 'approve', label: 'Approve competition', icon: CheckCircle2, color: 'text-teal-600', visible: (r) => r.status === 'proposed', run: (r) => svc.approveCompetition(r._id) },
    { key: 'close', label: 'Close competition', icon: Archive, color: 'text-slate-600', visible: (r) => !['closed', 'cancelled'].includes(r.status), run: (r) => svc.closeCompetition(r._id) },
  ],
  api: { list: svc.listCompetitions, create: svc.proposeCompetition },
};

const workshops: ResourceConfig = {
  title: 'Workshops',
  singular: 'Workshop',
  queryKey: 'sd-workshops',
  description: 'Skill workshops run by clubs, departments or external instructors.',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'topic', label: 'Topic', type: 'text', required: true },
    { name: 'parentType', label: 'Context', type: 'select', required: true, options: ['fest', 'standalone', 'programme'] },
    { name: 'status', label: 'Status', type: 'select', options: ['proposed', 'approved', 'registration_open', 'ongoing', 'completed', 'closed', 'cancelled'] },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'duration', label: 'Duration (hrs)', type: 'number', required: true },
    { name: 'instructorId', label: 'Instructor', type: 'ref', ref: personRef, hideInTable: true },
    { name: 'externalInstructor', label: 'External Instructor', type: 'text', hideInTable: true },
    { name: 'clubId', label: 'Club', type: 'ref', ref: clubRef, hideInTable: true },
    { name: 'departmentId', label: 'Department', type: 'ref', ref: departmentRef, hideInTable: true },
    { name: 'venue', label: 'Venue', type: 'text', hideInTable: true },
    { name: 'maxCapacity', label: 'Capacity', type: 'number', hideInTable: true },
    { name: 'completionCriteria', label: 'Completion Criteria', type: 'textarea', hideInTable: true },
  ],
  rowActions: [
    { key: 'approve', label: 'Approve workshop', icon: CheckCircle2, color: 'text-teal-600', visible: (r) => r.status === 'proposed', run: (r) => svc.approveWorkshop(r._id) },
    { key: 'complete', label: 'Mark complete', icon: BadgeCheck, color: 'text-teal-600', visible: (r) => ['ongoing', 'registration_open', 'approved'].includes(r.status), run: (r) => svc.completeWorkshop(r._id) },
  ],
  api: { list: svc.listWorkshops, create: svc.proposeWorkshop },
};

const programmes: ResourceConfig = {
  title: 'SD Programmes',
  singular: 'Programme',
  queryKey: 'sd-programmes',
  description: 'NCC, NSS, NSO and YRC cohorts for an academic year.',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['ncc', 'nss', 'nso', 'yrc', 'other'] },
    { name: 'academicYearId', label: 'Academic Year', type: 'ref', required: true, ref: academicYearRef },
    { name: 'officerId', label: 'Officer', type: 'ref', required: true, ref: personRef },
    { name: 'status', label: 'Status', type: 'select', options: ['enrollment_open', 'active', 'completed'] },
    { name: 'enrolledCount', label: 'Enrolled', type: 'number', readOnly: true },
    { name: 'capacity', label: 'Capacity', type: 'number', hideInTable: true },
    { name: 'startDate', label: 'Start', type: 'date', required: true, hideInTable: true },
    { name: 'endDate', label: 'End', type: 'date', required: true, hideInTable: true },
    { name: 'description', label: 'Description', type: 'textarea', hideInTable: true },
  ],
  api: { list: svc.listSDProgrammes, create: svc.createSDProgramme },
};

const awards: ResourceConfig = {
  title: 'Awards',
  singular: 'Award',
  queryKey: 'sd-awards',
  description: 'The award catalogue. Individual conferrals are Award Instances.',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: ['academic', 'sports', 'cultural', 'service', 'leadership', 'innovation'] },
    { name: 'level', label: 'Level', type: 'select', required: true, options: ['department', 'institution'] },
    { name: 'isActive', label: 'Active', type: 'boolean' },
    { name: 'description', label: 'Description', type: 'textarea', hideInTable: true },
    { name: 'criteria', label: 'Criteria', type: 'textarea', hideInTable: true },
  ],
  api: { list: svc.listAwards, create: svc.createAward, update: svc.updateAward, remove: svc.deleteAward },
};

const certificates: ResourceConfig = {
  title: 'Certificates',
  singular: 'Certificate',
  queryKey: 'sd-certificates',
  description: 'Generated participation and achievement certificates.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['participation', 'achievement', 'ncc_rank', 'nss_completion', 'award', 'workshop_completion'] },
    { name: 'sourceType', label: 'Source', type: 'select', required: true, options: ['achievement', 'event', 'award', 'programme'] },
    { name: 'status', label: 'Status', type: 'select', options: ['draft', 'issued', 'revoked'] },
    { name: 'issuedDate', label: 'Issued', type: 'date' },
    { name: 'signedBy', label: 'Signed By', type: 'ref', ref: personRef, hideInTable: true },
    { name: 'fileUrl', label: 'File', type: 'url', hideInTable: true },
  ],
  rowActions: [
    { key: 'issue', label: 'Issue certificate', icon: BadgeCheck, color: 'text-teal-600', visible: (r) => r.status === 'draft', confirmMessage: 'The certificate becomes visible to the student and can no longer be edited.', run: (r) => svc.issueCertificate(r._id) },
    { key: 'revoke', label: 'Revoke certificate', icon: Undo2, color: 'text-red-500', tone: 'danger', visible: (r) => r.status === 'issued', requireReason: true, reasonLabel: 'Reason for revocation', run: (r, reason) => svc.revokeCertificate(r._id, reason) },
  ],
  api: { list: svc.listCertificates, create: svc.generateCertificate },
};

const budgets: ResourceConfig = {
  title: 'Activity Budgets',
  singular: 'Budget',
  queryKey: 'sd-budgets',
  description: 'Budget requests for clubs, events, fests and programmes.',
  fields: [
    { name: 'entityType', label: 'For', type: 'select', required: true, options: ['club', 'event', 'fest', 'programme', 'pool'] },
    { name: 'academicYearId', label: 'Academic Year', type: 'ref', required: true, ref: academicYearRef },
    { name: 'requestedBy', label: 'Requested By', type: 'ref', required: true, ref: personRef },
    { name: 'requestedAmount', label: 'Requested', type: 'number', required: true },
    { name: 'approvedAmount', label: 'Approved', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['requested', 'approved', 'active', 'reconciled', 'rejected'] },
    { name: 'utilisedAmount', label: 'Utilised', type: 'number', readOnly: true },
    { name: 'justification', label: 'Justification', type: 'textarea', hideInTable: true },
    { name: 'varianceNotes', label: 'Variance Notes', type: 'textarea', hideInTable: true },
  ],
  rowActions: [
    { key: 'approve', label: 'Approve budget', icon: CheckCircle2, color: 'text-teal-600', visible: (r) => r.status === 'requested', run: (r) => svc.approveActivityBudget(r._id) },
    { key: 'reject', label: 'Reject budget', icon: XCircle, color: 'text-red-500', tone: 'danger', visible: (r) => r.status === 'requested', requireReason: true, reasonLabel: 'Rejection reason', run: (r, reason) => svc.rejectActivityBudget(r._id, reason) },
    { key: 'reconcile', label: 'Reconcile budget', icon: Scale, color: 'text-primary-600', visible: (r) => ['approved', 'active'].includes(r.status), confirmMessage: 'Closes the budget against actual spend and records the variance.', run: (r) => svc.reconcileActivityBudget(r._id) },
  ],
  api: { list: svc.listActivityBudgets, create: svc.requestActivityBudget },
};

const sponsorships: ResourceConfig = {
  title: 'Sponsorships',
  singular: 'Sponsorship',
  queryKey: 'sd-sponsorships',
  description: 'Cash and in-kind sponsorship of fests, events and competitions.',
  fields: [
    { name: 'eventType', label: 'Event Type', type: 'select', required: true, options: ['fest', 'event', 'competition'] },
    { name: 'sponsorContactId', label: 'Sponsor', type: 'ref', required: true, ref: sponsorContactRef },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['cash', 'in_kind', 'mixed'] },
    { name: 'committedAmount', label: 'Committed', type: 'number' },
    { name: 'receivedAmount', label: 'Received', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['prospective', 'approached', 'committed', 'received', 'fulfilled', 'withdrawn'] },
    { name: 'acknowledgmentDone', label: 'Acknowledged', type: 'boolean', hideInTable: true },
    { name: 'agreementUrl', label: 'Agreement', type: 'url', hideInTable: true },
  ],
  api: { list: svc.listSponsorships, create: svc.createSponsorship, remove: svc.deleteSponsorship },
};

// ─── exported page components ──────────────────────────────────────────────

export const FestsPage = () => <ResourcePage config={fests} />;
export const CompetitionsPage = () => <ResourcePage config={competitions} />;
export const WorkshopsPage = () => <ResourcePage config={workshops} />;
export const SDProgrammesPage = () => <ResourcePage config={programmes} />;
export const AwardsPage = () => <ResourcePage config={awards} />;
export const CertificatesPage = () => <ResourcePage config={certificates} />;
export const ActivityBudgetsPage = () => <ResourcePage config={budgets} />;
export const SponsorshipsPage = () => <ResourcePage config={sponsorships} />;
