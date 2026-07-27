/**
 * HR surfaces that shipped with complete backends and no frontend at all —
 * the audit's "Major backend entities have zero frontend pages".
 *
 * FDP Records, FDP Compliance, Separation Requests, Exit Clearances, Handover
 * Records, Final Settlements, Disciplinary Cases, Disciplinary Outcomes,
 * Payroll Extracts and Attendance Anomalies. Declared as ResourcePage configs
 * for the same reason as the Placement W04 and Student Dev W09 sets.
 *
 * Designations already exists under Master Data, so it is not duplicated here.
 */
import { BadgeCheck, Send, Eye } from 'lucide-react';
import ResourcePage, { type ResourceConfig } from '../../components/ui/ResourcePage';
import * as svc from '../../services/hr';
import { listPersons } from '../../services/people';
import { listAcademicYears } from '../../services/academics';

// ─── shared ref pickers ────────────────────────────────────────────────────

const employeeRef = {
  queryKey: ['employees', 'picker'] as const,
  fetcher: (q: string) => svc.listEmployees(1, 20, undefined, undefined, q || undefined),
  getLabel: (e: any) => e.personId?.name || e.employeeId || e._id,
  getHint: (e: any) => [e.employeeId, e.designation].filter(Boolean).join(' · ') || undefined,
};

const personRef = {
  queryKey: ['persons', 'picker'] as const,
  fetcher: (q: string) => listPersons(1, 20, q || undefined),
  getLabel: (p: any) => p.name || p._id,
};

const academicYearRef = {
  queryKey: ['academic-years', 'picker'] as const,
  fetcher: (q: string) => listAcademicYears(1, 20, q || undefined),
  getLabel: (y: any) => y.label || y.code || y._id,
};

const separationRef = {
  queryKey: ['separation-requests', 'picker'] as const,
  fetcher: (q: string) => svc.listSeparationRequests(1, 20, q || undefined),
  getLabel: (s: any) => s.employeeId?.personId?.name ? `${s.employeeId.personId.name} — ${s.separationType}` : s._id,
  getHint: (s: any) => s.status || undefined,
};

const disciplinaryCaseRef = {
  queryKey: ['disciplinary-cases', 'picker'] as const,
  fetcher: (q: string) => svc.listDisciplinaryCases(1, 20, q || undefined),
  getLabel: (c: any) => c.caseNumber || c._id,
  getHint: (c: any) => c.employeeId?.personId?.name || undefined,
};

// ─── configs ───────────────────────────────────────────────────────────────

const fdpRecords: ResourceConfig = {
  title: 'FDP Records',
  singular: 'FDP Record',
  queryKey: 'hr-fdp-records',
  description: 'Faculty development activity claims — the evidence behind NAAC 6.3.3.',
  fields: [
    { name: 'facultyId', label: 'Faculty', type: 'ref', required: true, ref: employeeRef },
    { name: 'activityType', label: 'Activity', type: 'select', required: true, options: ['fdp', 'workshop', 'seminar', 'conference', 'certification'] },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'organiser', label: 'Organiser', type: 'text', required: true },
    { name: 'hours', label: 'Hours', type: 'number', required: true },
    { name: 'verificationStatus', label: 'Verification', type: 'select', options: ['pending', 'verified', 'rejected'] },
    { name: 'startDate', label: 'Start', type: 'date', required: true, hideInTable: true },
    { name: 'endDate', label: 'End', type: 'date', required: true, hideInTable: true },
    { name: 'complianceYear', label: 'Compliance Year', type: 'number', required: true, hideInTable: true },
    { name: 'certificateUrl', label: 'Certificate', type: 'url', hideInTable: true },
  ],
  rowActions: [
    {
      key: 'verify', label: 'Verify record', icon: BadgeCheck, color: 'text-teal-600',
      visible: (r) => r.verificationStatus === 'pending',
      confirmMessage: 'The hours count toward the faculty member’s compliance total.',
      run: (r) => svc.verifyFDPRecord(r._id),
    },
  ],
  api: { list: svc.listFDPRecords, create: svc.createFDPRecord, update: svc.updateFDPRecord, remove: svc.deleteFDPRecord },
};

const fdpCompliance: ResourceConfig = {
  title: 'FDP Compliance',
  singular: 'Compliance Summary',
  queryKey: 'hr-fdp-compliance',
  description: 'Required vs completed FDP hours per faculty member. Computed in batch, not edited by hand.',
  fields: [
    { name: 'facultyId', label: 'Faculty', type: 'ref', ref: employeeRef },
    { name: 'academicYearId', label: 'Academic Year', type: 'ref', ref: academicYearRef },
    { name: 'cadre', label: 'Cadre', type: 'select', options: ['assistant_professor', 'associate_professor', 'professor'] },
    { name: 'requiredHours', label: 'Required', type: 'number' },
    { name: 'completedHours', label: 'Completed', type: 'number' },
    { name: 'gap', label: 'Gap', type: 'number' },
    { name: 'complianceStatus', label: 'Status', type: 'select', options: ['compliant', 'partial', 'non_compliant'] },
    { name: 'lastComputedAt', label: 'Last Computed', type: 'datetime', hideInTable: true },
  ],
  api: { list: svc.listFDPCompliance },
};

const separationRequests: ResourceConfig = {
  title: 'Separation Requests',
  singular: 'Separation Request',
  queryKey: 'hr-separation-requests',
  description: 'Resignations, retirements and terminations, from submission to settlement.',
  fields: [
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'separationType', label: 'Type', type: 'select', required: true, options: ['resignation', 'retirement', 'termination', 'death', 'contract_end'] },
    { name: 'status', label: 'Status', type: 'select', options: ['submitted', 'accepted', 'in_clearance', 'settled', 'completed', 'rejected'] },
    { name: 'requestedLastWorkingDay', label: 'Requested LWD', type: 'date' },
    { name: 'confirmedLastWorkingDay', label: 'Confirmed LWD', type: 'date' },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true, hideInTable: true },
    { name: 'noticePeriodDays', label: 'Notice Period (days)', type: 'number', hideInTable: true },
    { name: 'noticePeriodWaived', label: 'Notice Waived', type: 'boolean', hideInTable: true },
    { name: 'waiverApprovedBy', label: 'Waiver Approved By', type: 'ref', ref: employeeRef, hideInTable: true },
  ],
  api: { list: svc.listSeparationRequests, create: svc.createSeparationRequest, update: svc.updateSeparationRequest, remove: svc.deleteSeparationRequest },
};

const exitClearances: ResourceConfig = {
  title: 'Exit Clearances',
  singular: 'Exit Clearance',
  queryKey: 'hr-exit-clearances',
  description: 'Departmental no-dues for a separating employee.',
  fields: [
    { name: 'separationRequestId', label: 'Separation', type: 'ref', required: true, ref: separationRef },
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'overallStatus', label: 'Status', type: 'select', options: ['in_progress', 'all_cleared', 'blocked'] },
    { name: 'generatedAt', label: 'Generated', type: 'date' },
    { name: 'completedAt', label: 'Completed', type: 'date' },
  ],
  api: { list: svc.listExitClearances, create: svc.createExitClearance, update: svc.updateExitClearance, remove: svc.deleteExitClearance },
};

const handoverRecords: ResourceConfig = {
  title: 'Handover Records',
  singular: 'Handover Record',
  queryKey: 'hr-handover-records',
  description: 'Courses, mentees, research and assets handed to a successor.',
  fields: [
    { name: 'separationRequestId', label: 'Separation', type: 'ref', required: true, ref: separationRef },
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'overallStatus', label: 'Status', type: 'select', options: ['pending', 'in_progress', 'completed'] },
    { name: 'verifiedByHOD', label: 'HOD Verified', type: 'boolean' },
    { name: 'verifiedAt', label: 'Verified', type: 'date' },
  ],
  api: { list: svc.listHandoverRecords, create: svc.createHandoverRecord, update: svc.updateHandoverRecord, remove: svc.deleteHandoverRecord },
};

const finalSettlements: ResourceConfig = {
  title: 'Final Settlements',
  singular: 'Final Settlement',
  queryKey: 'hr-final-settlements',
  description: 'Full-and-final computation: encashment, gratuity and deductions.',
  fields: [
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'separationRequestId', label: 'Separation', type: 'ref', required: true, ref: separationRef, hideInTable: true },
    { name: 'grossSettlement', label: 'Gross', type: 'number', required: true },
    { name: 'netSettlement', label: 'Net', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['computed', 'approved', 'processed', 'disputed'] },
    { name: 'computedAt', label: 'Computed', type: 'date' },
    { name: 'leaveEncashmentDays', label: 'Encashment Days', type: 'number', required: true, hideInTable: true },
    { name: 'leaveEncashmentAmount', label: 'Encashment Amount', type: 'number', required: true, hideInTable: true },
    { name: 'gratuityEligible', label: 'Gratuity Eligible', type: 'boolean', hideInTable: true },
    { name: 'gratuityAmount', label: 'Gratuity', type: 'number', required: true, hideInTable: true },
    { name: 'gratuityYearsOfService', label: 'Years of Service', type: 'number', required: true, hideInTable: true },
    { name: 'pendingReimbursements', label: 'Reimbursements', type: 'number', hideInTable: true },
    { name: 'advanceDeductions', label: 'Advance Deductions', type: 'number', hideInTable: true },
    { name: 'dueDeductions', label: 'Due Deductions', type: 'number', hideInTable: true },
  ],
  api: { list: svc.listFinalSettlements, create: svc.createFinalSettlement, update: svc.updateFinalSettlement, remove: svc.deleteFinalSettlement },
};

const disciplinaryCases: ResourceConfig = {
  title: 'Disciplinary Cases',
  singular: 'Disciplinary Case',
  queryKey: 'hr-disciplinary-cases',
  description: 'Investigation, show-cause, hearing and decision trail.',
  fields: [
    { name: 'caseNumber', label: 'Case #', type: 'text', required: true },
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'origin', label: 'Origin', type: 'select', required: true, options: ['internal', 'external_referral'] },
    { name: 'status', label: 'Status', type: 'select', options: ['under_investigation', 'show_cause', 'awaiting_response', 'hearing', 'decided', 'implemented', 'closed', 'appealed', 'insufficient_evidence'] },
    { name: 'outcome', label: 'Outcome', type: 'select', options: ['warning', 'fine', 'suspension', 'demotion', 'termination', 'exonerated'] },
    { name: 'hearingDate', label: 'Hearing', type: 'date' },
    { name: 'allegation', label: 'Allegation', type: 'textarea', required: true, hideInTable: true },
    { name: 'referralSource', label: 'Referral Source', type: 'select', options: ['m06_icc', 'm06_arc', 'other'], hideInTable: true },
    { name: 'investigatingAuthorityId', label: 'Investigating Authority', type: 'ref', ref: personRef, hideInTable: true },
    { name: 'investigationFindings', label: 'Findings', type: 'textarea', hideInTable: true },
    { name: 'responseDeadline', label: 'Response Deadline', type: 'date', hideInTable: true },
    { name: 'appealDeadline', label: 'Appeal Deadline', type: 'date', hideInTable: true },
    { name: 'outcomeDetails', label: 'Outcome Details', type: 'textarea', hideInTable: true },
  ],
  api: { list: svc.listDisciplinaryCases, create: svc.createDisciplinaryCase, update: svc.updateDisciplinaryCase, remove: svc.deleteDisciplinaryCase },
};

const disciplinaryOutcomes: ResourceConfig = {
  title: 'Disciplinary Outcomes',
  singular: 'Outcome',
  queryKey: 'hr-disciplinary-outcomes',
  description: 'The sanction decided on a case, and whether it has been implemented.',
  fields: [
    { name: 'disciplinaryCaseId', label: 'Case', type: 'ref', required: true, ref: disciplinaryCaseRef },
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'outcomeType', label: 'Outcome', type: 'select', required: true, options: ['warning', 'fine', 'suspension', 'demotion', 'termination'] },
    { name: 'status', label: 'Status', type: 'select', options: ['decided', 'communicated', 'implemented', 'appealed', 'overturned'] },
    { name: 'details', label: 'Details', type: 'textarea', hideInTable: true },
    { name: 'communicationLetterUrl', label: 'Letter', type: 'url', hideInTable: true },
  ],
  api: { list: svc.listDisciplinaryOutcomes, create: svc.createDisciplinaryOutcome, update: svc.updateDisciplinaryOutcome, remove: svc.deleteDisciplinaryOutcome },
};

const payrollExtracts: ResourceConfig = {
  title: 'Payroll Extracts',
  singular: 'Payroll Extract',
  queryKey: 'hr-payroll-extracts',
  description: 'Monthly attendance, leave and LOP roll-up handed to payroll. Generated, then reviewed and released.',
  fields: [
    { name: 'month', label: 'Month', type: 'number', required: true },
    { name: 'year', label: 'Year', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['draft', 'reviewed', 'released'] },
    { name: 'reviewedBy', label: 'Reviewed By', type: 'ref', ref: personRef },
    { name: 'releasedAt', label: 'Released', type: 'datetime' },
  ],
  rowActions: [
    {
      key: 'review', label: 'Mark reviewed', icon: Eye, color: 'text-primary-600',
      visible: (r) => r.status === 'draft',
      run: (r) => svc.reviewPayrollExtract(r._id),
    },
    {
      key: 'release', label: 'Release to payroll', icon: Send, color: 'text-teal-600',
      visible: (r) => r.status === 'reviewed',
      confirmMessage: 'Payroll processing uses these figures. Releasing cannot be undone.',
      run: (r) => svc.releasePayrollExtract(r._id),
    },
  ],
  api: { list: svc.listPayrollExtracts, create: svc.generatePayrollExtract, remove: svc.deletePayrollExtract },
};

const attendanceAnomalies: ResourceConfig = {
  title: 'Attendance Anomalies',
  singular: 'Anomaly',
  queryKey: 'hr-attendance-anomalies',
  description: 'Chronic lateness, missing swipes and irregular patterns flagged for review.',
  fields: [
    { name: 'employeeId', label: 'Employee', type: 'ref', required: true, ref: employeeRef },
    { name: 'anomalyType', label: 'Type', type: 'select', required: true, options: ['chronic_late', 'missing_swipe', 'irregular_pattern'] },
    { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['info', 'warning', 'critical'] },
    { name: 'month', label: 'Month', type: 'number', required: true },
    { name: 'year', label: 'Year', type: 'number', required: true },
    { name: 'referredToDisciplinary', label: 'Referred', type: 'boolean' },
    { name: 'flaggedAt', label: 'Flagged', type: 'date', hideInTable: true },
  ],
  api: { list: svc.listAttendanceAnomalies, create: svc.createAttendanceAnomaly, update: svc.updateAttendanceAnomaly, remove: svc.deleteAttendanceAnomaly },
};

// ─── exported page components ──────────────────────────────────────────────

export const FDPRecordsPage = () => <ResourcePage config={fdpRecords} />;
export const FDPCompliancePage = () => <ResourcePage config={fdpCompliance} />;
export const SeparationRequestsPage = () => <ResourcePage config={separationRequests} />;
export const ExitClearancesPage = () => <ResourcePage config={exitClearances} />;
export const HandoverRecordsPage = () => <ResourcePage config={handoverRecords} />;
export const FinalSettlementsPage = () => <ResourcePage config={finalSettlements} />;
export const DisciplinaryCasesPage = () => <ResourcePage config={disciplinaryCases} />;
export const DisciplinaryOutcomesPage = () => <ResourcePage config={disciplinaryOutcomes} />;
export const PayrollExtractsPage = () => <ResourcePage config={payrollExtracts} />;
export const AttendanceAnomaliesPage = () => <ResourcePage config={attendanceAnomalies} />;
