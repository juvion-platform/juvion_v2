/**
 * People M02 exit / clearance / alumni surfaces.
 *
 * The backend fully implements exit requests, clearance workflows, document
 * generation and alumni conversion; none of it had a page or a nav entry —
 * the audit's "Entire Exit/Alumni workflow has zero frontend UI".
 */
import { CheckCircle2, XCircle, Ban } from 'lucide-react';
import ResourcePage, { type ResourceConfig } from '../../components/ui/ResourcePage';
import * as svc from '../../services/people';
import { listProgrammes, listBranches, listBatches } from '../../services/academics';

const studentRef = {
  queryKey: ['students', 'picker'] as const,
  fetcher: (q: string) => svc.listStudents(1, 20, undefined, q || undefined),
  getLabel: (s: any) => s.person?.name || s.personId?.name || s.rollNumber || s._id,
  getHint: (s: any) => s.rollNumber || undefined,
};

const personRef = {
  queryKey: ['persons', 'picker'] as const,
  fetcher: (q: string) => svc.listPersons(1, 20, q || undefined),
  getLabel: (p: any) => p.name || p._id,
};

const programmeRef = {
  queryKey: ['programmes', 'picker'] as const,
  fetcher: (q: string) => listProgrammes(1, 20, q || undefined),
  getLabel: (p: any) => p.name || p.code || p._id,
};

const branchRef = {
  queryKey: ['branches', 'picker'] as const,
  fetcher: (q: string) => listBranches(1, 20, q || undefined),
  getLabel: (b: any) => b.name || b.code || b._id,
};

const batchRef = {
  queryKey: ['batches', 'picker'] as const,
  fetcher: (q: string) => listBatches(1, 20, q || undefined),
  getLabel: (b: any) => b.name || b.code || b._id,
};

const exitRequests: ResourceConfig = {
  title: 'Exit Requests',
  singular: 'Exit Request',
  queryKey: 'exit-requests',
  description: 'Withdrawals, transfers, expulsions and formalised dropouts, through to clearance.',
  invalidates: ['people-stats'],
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef },
    { name: 'exitType', label: 'Exit Type', type: 'select', required: true, options: ['withdrawal', 'transfer', 'expulsion', 'dropout_formalization'] },
    { name: 'reasonCategory', label: 'Reason', type: 'select', required: true, options: ['personal', 'financial', 'academic', 'transfer', 'family', 'health', 'disciplinary', 'other'] },
    { name: 'status', label: 'Status', type: 'select', options: ['submitted', 'under_review', 'clearance_in_progress', 'completed', 'rejected', 'cancelled'] },
    { name: 'requestedAt', label: 'Requested', type: 'date' },
    { name: 'parentConsentObtained', label: 'Parent Consent', type: 'boolean' },
    { name: 'reason', label: 'Reason Summary', type: 'textarea', required: true, hideInTable: true },
    { name: 'reasonDetails', label: 'Details', type: 'textarea', hideInTable: true },
    { name: 'requestedBy', label: 'Requested By', type: 'ref', required: true, ref: personRef, hideInTable: true },
    { name: 'destinationInstitution', label: 'Destination Institution', type: 'text', hideInTable: true },
    { name: 'destinationUniversity', label: 'Destination University', type: 'text', hideInTable: true },
  ],
  rowActions: [
    {
      key: 'approve', label: 'Approve exit', icon: CheckCircle2, color: 'text-teal-600',
      visible: (r) => ['submitted', 'under_review'].includes(r.status),
      confirmMessage: 'Starts the clearance workflow for this student.',
      run: (r) => svc.approveExitRequest(r._id),
    },
    {
      key: 'reject', label: 'Reject exit', icon: XCircle, color: 'text-red-500', tone: 'danger',
      visible: (r) => ['submitted', 'under_review'].includes(r.status),
      requireReason: true, reasonLabel: 'Rejection reason',
      run: (r, reason) => svc.rejectExitRequest(r._id, reason),
    },
    {
      key: 'cancel', label: 'Cancel request', icon: Ban, color: 'text-slate-500',
      visible: (r) => !['completed', 'cancelled', 'rejected'].includes(r.status),
      run: (r) => svc.cancelExitRequest(r._id),
    },
  ],
  // Exit requests are raised against a student via
  // POST /students/:id/exit-request, so there is no generic create here —
  // the student detail page is the right entry point.
  api: { list: svc.listExitRequests },
};

const clearanceWorkflows: ResourceConfig = {
  title: 'Clearance Workflows',
  singular: 'Clearance Workflow',
  queryKey: 'clearance-workflows',
  description: 'Per-department no-dues raised by an approved exit request.',
  fields: [
    { name: 'studentId', label: 'Student', type: 'ref', ref: studentRef },
    { name: 'status', label: 'Status', type: 'text' },
    { name: 'initiatedAt', label: 'Initiated', type: 'date' },
    { name: 'completedAt', label: 'Completed', type: 'date' },
  ],
  api: { list: svc.listClearanceWorkflows, create: svc.initiateClearance },
};

const documentTemplates: ResourceConfig = {
  title: 'Document Templates',
  singular: 'Document Template',
  queryKey: 'document-templates',
  description: 'Templates behind generated TCs, bonafides and conduct certificates.',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'documentType', label: 'Type', type: 'text', required: true },
    { name: 'isActive', label: 'Active', type: 'boolean' },
    { name: 'body', label: 'Template Body', type: 'textarea', hideInTable: true },
  ],
  api: { list: svc.listDocumentTemplates, create: svc.createDocumentTemplate },
};

const alumni: ResourceConfig = {
  title: 'Alumni',
  singular: 'Alumni Record',
  queryKey: 'alumni',
  description: 'Graduated students converted to alumni records.',
  invalidates: ['people-stats'],
  fields: [
    { name: 'personId', label: 'Person', type: 'ref', required: true, ref: personRef },
    { name: 'studentId', label: 'Student', type: 'ref', required: true, ref: studentRef, hideInTable: true },
    { name: 'programmeId', label: 'Programme', type: 'ref', required: true, ref: programmeRef },
    { name: 'branchId', label: 'Branch', type: 'ref', required: true, ref: branchRef },
    { name: 'graduationDate', label: 'Graduated', type: 'date', required: true },
    { name: 'classObtained', label: 'Class', type: 'select', required: true, options: ['first_class_distinction', 'first_class', 'second_class', 'pass'] },
    { name: 'engagementStatus', label: 'Engagement', type: 'select', options: ['active', 'inactive', 'revoked'] },
    { name: 'batchId', label: 'Batch', type: 'ref', ref: batchRef, hideInTable: true },
    { name: 'degreeAwarded', label: 'Degree', type: 'text', required: true, hideInTable: true },
    { name: 'finalCgpa', label: 'Final CGPA', type: 'number', required: true, hideInTable: true },
    { name: 'convocationStatus', label: 'Convocation', type: 'select', options: ['pending', 'attended', 'absentia', 'direct_collection'], hideInTable: true },
    { name: 'convocationDate', label: 'Convocation Date', type: 'date', hideInTable: true },
    { name: 'lastContactDate', label: 'Last Contact', type: 'date', hideInTable: true },
  ],
  api: { list: svc.listAlumni, create: svc.createAlumniRecord },
};

export const ExitRequestsPage = () => <ResourcePage config={exitRequests} />;
export const ClearanceWorkflowsPage = () => <ResourcePage config={clearanceWorkflows} />;
export const DocumentTemplatesPage = () => <ResourcePage config={documentTemplates} />;
export const AlumniPage = () => <ResourcePage config={alumni} />;
