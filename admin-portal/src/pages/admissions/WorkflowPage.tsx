import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  ListTodo,
  PlayCircle,
  RefreshCw,
  SkipForward,
  XCircle,
} from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';
import {
  completeWorkflowTask,
  failWorkflowTask,
  getWorkflowStats,
  getWorkflowStatus,
  listInquiries,
  listWorkflowAllotmentRounds,
  listWorkflowInstances,
  listWorkflowTasks,
  skipWorkflowTask,
  startWorkflow,
  triggerWorkflowStep,
} from '../../services/admissions';
import { listAcademicYears, listBranches, listProgrammes } from '../../services/academics';
import { getStudent } from '../../services/people';

const STATUS_VARIANT: Record<string, string> = {
  active: 'info',
  completed: 'success',
  cancelled: 'danger',
  failed: 'danger',
  pending: 'warning',
  in_progress: 'purple',
  skipped: 'default',
  blocked: 'orange',
};

const TASK_TYPE_VARIANT: Record<string, string> = {
  automated: 'purple',
  manual: 'info',
  approval: 'warning',
  parallel_group: 'teal',
};

const INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

const QUOTA_OPTIONS = [
  { value: 'convener', label: 'Convener' },
  { value: 'management', label: 'Management' },
  { value: 'nri', label: 'NRI' },
  { value: 'spot', label: 'Spot' },
] as const;

const CATEGORY_OPTIONS = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS'];
const ADMISSION_TYPES = ['fresh', 'lateral'] as const;
const PHASE_OPTIONS = [
  { value: '', label: 'All phases' },
  { value: 'M01.1_LEAD', label: 'Lead' },
  { value: 'M01.2_APP', label: 'Application' },
  { value: 'M01.3_SEAT', label: 'Seat' },
  { value: 'M01.4_OFFER', label: 'Offer' },
  { value: 'M01.5_ENROL', label: 'Enrolment' },
  { value: 'M01.6_CANCEL', label: 'Cancellation' },
] as const;
const WORKFLOW_BLUEPRINT = [
  {
    id: 'M01.1_LEAD',
    label: 'Lead',
    description: 'Capture, qualify, and convert enquiries.',
    steps: ['lead_capture', 'lead_score', 'lead_dedup', 'lead_nurture', 'lead_convert'],
  },
  {
    id: 'M01.2_APP',
    label: 'Application',
    description: 'Collect documents and verify eligibility.',
    steps: ['app_submit', 'doc_collection', 'doc_ocr', 'doc_review', 'eligibility_check', 'eligibility_review'],
  },
  {
    id: 'M01.3_SEAT',
    label: 'Seat',
    description: 'Check seat availability and execute allotment.',
    steps: ['seat_check', 'merit_rank', 'allotment'],
  },
  {
    id: 'M01.4_OFFER',
    label: 'Offer',
    description: 'Generate the offer, negotiate if needed, and collect acceptance.',
    steps: ['offer_generate', 'fee_negotiation', 'offer_acceptance'],
  },
  {
    id: 'M01.5_ENROL',
    label: 'Enrolment',
    description: 'Provision downstream modules and close onboarding.',
    steps: ['enrol_execute', 'provision_m02', 'provision_m03', 'provision_m04', 'provision_m08', 'provision_m12', 'provision_juvi', 'onboarding_complete'],
  },
  {
    id: 'M01.6_CANCEL',
    label: 'Cancellation',
    description: 'Approve cancellation, reverse provisioning, and recover the seat.',
    steps: ['cancel_request', 'cancel_execute', 'cancel_m02', 'cancel_m04', 'cancel_m08', 'cancel_m12', 'cancel_juvi'],
  },
] as const;

type TaskActionState = {
  mode: 'complete' | 'fail' | 'skip';
  task: any;
  instance: any;
} | null;

function formatStepLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function getBlueprintStepVariant(status: string) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'skipped') return 'default';
  if (status === 'in_progress') return 'purple';
  if (status === 'pending') return 'warning';
  if (status === 'current') return 'teal';
  return 'default';
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== '' && value !== null),
  );
}

function getDefaultActionForm(action: TaskActionState, currentAcademicYearId: string) {
  const metadata = action?.instance?.metadata || {};
  const today = new Date();
  const validityDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    leadScore: '',
    nurtureType: 'whatsapp',
    nurtureOutcome: 'interested',
    nurtureSummary: 'Automated nurture follow-up sent to keep the lead warm.',
    followUpDate: '',
    programmeApplied: metadata.programmeApplied || '',
    branchPreference1: metadata.branchPreference1 || '',
    quota: metadata.quota || 'management',
    category: '',
    admissionType: metadata.admissionType || 'fresh',
    allDocumentsVerified: true,
    hasFlaggedDocuments: false,
    flaggedDocumentsCount: 0,
    reviewOutcome: 'verified',
    deficiencyDeadline: '',
    fraudNotes: '',
    isEligible: true,
    isEdgeCase: false,
    meritScore: metadata.meritScore || '',
    notes: '',
    finalEligibilityStatus: 'eligible',
    academicYearId: metadata.academicYearId || currentAcademicYearId,
    programmeId: metadata.programmeId || '',
    branchId: metadata.branchId || '',
    allotmentRoundId: metadata.allotmentRoundId || '',
    meritRank: metadata.meritRank || '',
    status: 'allotted',
    waitlistPosition: '',
    feeQuoted: '',
    validityDate,
    negotiationRequested: false,
    requestedWaiver: '',
    requestedReason: '',
    negotiationStatus: 'approved',
    approvedWaiver: '',
    finalFee: metadata.feeQuoted || '',
    counterOffer: '',
    paymentConfirmed: true,
    hostelRequired: false,
    transportRequired: false,
    libraryRequired: true,
    preferredStopName: '',
    createConversation: true,
    createWelcomeMessage: true,
    enrollmentNumber: '',
    cancellationType: 'post_enrolment',
    reasonCategory: 'student_request',
    refundAmount: '',
    reason: '',
  };
}

function buildCompletePayload(stepId: string, form: Record<string, any>) {
  switch (stepId) {
    case 'lead_score':
      return cleanPayload({ leadScore: form.leadScore === '' ? undefined : Number(form.leadScore) });
    case 'lead_convert':
      return cleanPayload({
        programmeApplied: form.programmeApplied,
        branchPreference1: form.branchPreference1,
        quota: form.quota,
        category: form.category,
        admissionType: form.admissionType,
      });
    case 'lead_nurture':
      return cleanPayload({
        type: form.nurtureType,
        outcome: form.nurtureOutcome,
        summary: form.nurtureSummary,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
      });
    case 'app_submit':
      return cleanPayload({
        programmeApplied: form.programmeApplied,
        branchPreference1: form.branchPreference1,
        quota: form.quota,
        admissionType: form.admissionType,
      });
    case 'doc_ocr':
      return {
        allDocumentsVerified: Boolean(form.allDocumentsVerified),
        hasFlaggedDocuments: Boolean(form.hasFlaggedDocuments),
        flaggedDocumentsCount: Number(form.flaggedDocumentsCount || 0),
      };
    case 'doc_review':
      return cleanPayload({
        reviewOutcome: form.reviewOutcome,
        deficiencyDeadline: form.deficiencyDeadline || undefined,
        fraudNotes: form.fraudNotes,
      });
    case 'eligibility_check':
      return cleanPayload({
        isEligible: Boolean(form.isEligible),
        isEdgeCase: Boolean(form.isEdgeCase),
        meritScore: form.meritScore === '' ? undefined : Number(form.meritScore),
        notes: form.notes,
      });
    case 'eligibility_review':
      return cleanPayload({
        finalEligibilityStatus: form.finalEligibilityStatus,
        notes: form.notes,
      });
    case 'seat_check':
      return cleanPayload({
        academicYearId: form.academicYearId,
        programmeId: form.programmeId,
        branchId: form.branchId,
        quota: form.quota,
      });
    case 'merit_rank':
      return cleanPayload({
        meritScore: form.meritScore === '' ? undefined : Number(form.meritScore),
        meritRank: form.meritRank === '' ? undefined : Number(form.meritRank),
      });
    case 'allotment':
      return cleanPayload({
        status: form.status,
        academicYearId: form.academicYearId,
        programmeId: form.programmeId,
        branchId: form.branchId,
        quota: form.quota,
        allotmentRoundId: form.allotmentRoundId,
        meritScore: form.meritScore === '' ? undefined : Number(form.meritScore),
        meritRank: form.meritRank === '' ? undefined : Number(form.meritRank),
        waitlistPosition: form.waitlistPosition === '' ? undefined : Number(form.waitlistPosition),
      });
    case 'offer_generate':
      return cleanPayload({
        feeQuoted: form.feeQuoted === '' ? undefined : Number(form.feeQuoted),
        programmeId: form.programmeId,
        branchId: form.branchId,
        allotmentRoundId: form.allotmentRoundId,
        validityDate: form.validityDate ? new Date(form.validityDate).toISOString() : undefined,
        negotiationRequested: form.negotiationRequested ? true : undefined,
      });
    case 'fee_negotiation':
      return cleanPayload({
        requestedWaiver: form.requestedWaiver === '' ? undefined : Number(form.requestedWaiver),
        requestedReason: form.requestedReason,
        status: form.negotiationStatus,
        approvedWaiver: form.approvedWaiver === '' ? undefined : Number(form.approvedWaiver),
        finalFee: form.finalFee === '' ? undefined : Number(form.finalFee),
        counterOffer: form.counterOffer === '' ? undefined : Number(form.counterOffer),
        notes: form.notes,
      });
    case 'offer_acceptance':
      return { paymentConfirmed: Boolean(form.paymentConfirmed) };
    case 'provision_m08':
      return cleanPayload({
        hostelRequired: Boolean(form.hostelRequired),
        transportRequired: Boolean(form.transportRequired),
        libraryRequired: Boolean(form.libraryRequired),
        preferredStopName: form.preferredStopName,
      });
    case 'provision_m02':
    case 'provision_m03':
    case 'provision_m04':
    case 'provision_m12':
      return { status: 'completed' };
    case 'provision_juvi':
      return cleanPayload({
        createConversation: Boolean(form.createConversation),
        createWelcomeMessage: Boolean(form.createWelcomeMessage),
      });
    case 'onboarding_complete':
      return cleanPayload({ enrollmentNumber: form.enrollmentNumber });
    case 'cancel_request':
      return cleanPayload({
        cancellationType: form.cancellationType,
        reasonCategory: form.reasonCategory,
        reason: form.reason,
        refundAmount: form.refundAmount === '' ? undefined : Number(form.refundAmount),
      });
    default:
      return {};
  }
}

function renderTaskFormFields(
  action: TaskActionState,
  form: Record<string, any>,
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  lookups: {
    academicYears: any[];
    programmes: any[];
    branches: any[];
    allotmentRounds: any[];
  },
) {
  if (!action || action.mode !== 'complete') return null;

  const stepId = action.task.stepId;

  switch (stepId) {
    case 'lead_score':
      return (
        <div>
          <label className={LABEL_CLASS}>Lead score</label>
          <input type="number" min="0" max="100" value={form.leadScore} onChange={(e) => setForm((f) => ({ ...f, leadScore: e.target.value }))} className={INPUT_CLASS} placeholder="e.g. 88" />
        </div>
      );
    case 'lead_convert':
    case 'app_submit':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Programme</label>
            <input value={form.programmeApplied} onChange={(e) => setForm((f) => ({ ...f, programmeApplied: e.target.value }))} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Branch preference</label>
            <input value={form.branchPreference1} onChange={(e) => setForm((f) => ({ ...f, branchPreference1: e.target.value }))} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Quota</label>
            <select value={form.quota} onChange={(e) => setForm((f) => ({ ...f, quota: e.target.value }))} className={INPUT_CLASS}>
              {QUOTA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Admission type</label>
            <select value={form.admissionType} onChange={(e) => setForm((f) => ({ ...f, admissionType: e.target.value }))} className={INPUT_CLASS}>
              {ADMISSION_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={LABEL_CLASS}>Category</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={INPUT_CLASS}>
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>
      );
    case 'lead_nurture':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Nurture channel</label>
              <select value={form.nurtureType} onChange={(e) => setForm((f) => ({ ...f, nurtureType: e.target.value }))} className={INPUT_CLASS}>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="phone_call">Phone call</option>
                <option value="campus_visit">Campus visit</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Outcome</label>
              <select value={form.nurtureOutcome} onChange={(e) => setForm((f) => ({ ...f, nurtureOutcome: e.target.value }))} className={INPUT_CLASS}>
                <option value="interested">Interested</option>
                <option value="callback_requested">Callback requested</option>
                <option value="no_response">No response</option>
                <option value="not_interested">Not interested</option>
                <option value="visit_scheduled">Visit scheduled</option>
                <option value="converted">Converted</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Follow-up summary</label>
            <textarea value={form.nurtureSummary} onChange={(e) => setForm((f) => ({ ...f, nurtureSummary: e.target.value }))} className={INPUT_CLASS} rows={3} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Next follow-up date</label>
            <input type="date" value={form.followUpDate} onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))} className={INPUT_CLASS} />
          </div>
        </div>
      );
    case 'doc_ocr':
      return (
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.allDocumentsVerified} onChange={(e) => setForm((f) => ({ ...f, allDocumentsVerified: e.target.checked, hasFlaggedDocuments: !e.target.checked }))} />
            Mark all documents as AI-verified
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.hasFlaggedDocuments} onChange={(e) => setForm((f) => ({ ...f, hasFlaggedDocuments: e.target.checked, allDocumentsVerified: !e.target.checked }))} />
            Route flagged documents to manual review
          </label>
          {form.hasFlaggedDocuments && (
            <div>
              <label className={LABEL_CLASS}>Flagged documents count</label>
              <input type="number" min="1" value={form.flaggedDocumentsCount} onChange={(e) => setForm((f) => ({ ...f, flaggedDocumentsCount: e.target.value }))} className={INPUT_CLASS} />
            </div>
          )}
        </div>
      );
    case 'doc_review':
      return (
        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Review outcome</label>
            <select value={form.reviewOutcome} onChange={(e) => setForm((f) => ({ ...f, reviewOutcome: e.target.value }))} className={INPUT_CLASS}>
              <option value="verified">Verified</option>
              <option value="deficient">Deficient</option>
              <option value="rejected">Rejected</option>
              <option value="fraud_flagged">Fraud flagged</option>
            </select>
          </div>
          {form.reviewOutcome === 'deficient' && (
            <div>
              <label className={LABEL_CLASS}>Deficiency deadline</label>
              <input type="date" value={form.deficiencyDeadline} onChange={(e) => setForm((f) => ({ ...f, deficiencyDeadline: e.target.value }))} className={INPUT_CLASS} />
            </div>
          )}
          {form.reviewOutcome === 'fraud_flagged' && (
            <div>
              <label className={LABEL_CLASS}>Fraud notes</label>
              <textarea value={form.fraudNotes} onChange={(e) => setForm((f) => ({ ...f, fraudNotes: e.target.value }))} className={INPUT_CLASS} rows={3} />
            </div>
          )}
        </div>
      );
    case 'eligibility_check':
      return (
        <div className="space-y-4">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isEligible} onChange={(e) => setForm((f) => ({ ...f, isEligible: e.target.checked }))} />
              Eligible
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isEdgeCase} onChange={(e) => setForm((f) => ({ ...f, isEdgeCase: e.target.checked }))} />
              Edge case
            </label>
          </div>
          <div>
            <label className={LABEL_CLASS}>Merit score</label>
            <input type="number" step="0.1" value={form.meritScore} onChange={(e) => setForm((f) => ({ ...f, meritScore: e.target.value }))} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={INPUT_CLASS} rows={3} />
          </div>
        </div>
      );
    case 'eligibility_review':
      return (
        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Final eligibility status</label>
            <select value={form.finalEligibilityStatus} onChange={(e) => setForm((f) => ({ ...f, finalEligibilityStatus: e.target.value }))} className={INPUT_CLASS}>
              <option value="eligible">Eligible</option>
              <option value="conditional">Conditional</option>
              <option value="ineligible">Ineligible</option>
              <option value="edge_case">Edge case</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Review notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={INPUT_CLASS} rows={3} />
          </div>
        </div>
      );
    case 'seat_check':
      return renderSeatFields(form, setForm, lookups);
    case 'merit_rank':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Merit score</label>
            <input type="number" step="0.1" value={form.meritScore} onChange={(e) => setForm((f) => ({ ...f, meritScore: e.target.value }))} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Merit rank</label>
            <input type="number" min="1" value={form.meritRank} onChange={(e) => setForm((f) => ({ ...f, meritRank: e.target.value }))} className={INPUT_CLASS} />
          </div>
        </div>
      );
    case 'allotment':
      return (
        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Allotment outcome</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={INPUT_CLASS}>
              <option value="allotted">Allotted</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="not_eligible">Not eligible</option>
            </select>
          </div>
          {renderSeatFields(form, setForm, lookups)}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Allotment round</label>
              <select value={form.allotmentRoundId} onChange={(e) => setForm((f) => ({ ...f, allotmentRoundId: e.target.value }))} className={INPUT_CLASS}>
                <option value="">Select round</option>
                {lookups.allotmentRounds.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Waitlist position</label>
              <input type="number" min="1" value={form.waitlistPosition} onChange={(e) => setForm((f) => ({ ...f, waitlistPosition: e.target.value }))} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Merit score</label>
              <input type="number" step="0.1" value={form.meritScore} onChange={(e) => setForm((f) => ({ ...f, meritScore: e.target.value }))} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Merit rank</label>
              <input type="number" min="1" value={form.meritRank} onChange={(e) => setForm((f) => ({ ...f, meritRank: e.target.value }))} className={INPUT_CLASS} />
            </div>
          </div>
        </div>
      );
    case 'offer_generate':
      return (
        <div className="space-y-4">
          {renderSeatFields(form, setForm, lookups)}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Offer amount</label>
              <input type="number" min="0" value={form.feeQuoted} onChange={(e) => setForm((f) => ({ ...f, feeQuoted: e.target.value }))} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Valid until</label>
              <input type="date" value={form.validityDate} onChange={(e) => setForm((f) => ({ ...f, validityDate: e.target.value }))} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Allotment round</label>
            <select value={form.allotmentRoundId} onChange={(e) => setForm((f) => ({ ...f, allotmentRoundId: e.target.value }))} className={INPUT_CLASS}>
              <option value="">Select round</option>
              {lookups.allotmentRounds.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.negotiationRequested} onChange={(e) => setForm((f) => ({ ...f, negotiationRequested: e.target.checked }))} />
            Route this offer to fee negotiation before acceptance
          </label>
        </div>
      );
    case 'fee_negotiation':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Requested waiver</label>
              <input type="number" min="0" value={form.requestedWaiver} onChange={(e) => setForm((f) => ({ ...f, requestedWaiver: e.target.value }))} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Final fee</label>
              <input type="number" min="0" value={form.finalFee} onChange={(e) => setForm((f) => ({ ...f, finalFee: e.target.value }))} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Requested reason</label>
            <textarea value={form.requestedReason} onChange={(e) => setForm((f) => ({ ...f, requestedReason: e.target.value }))} className={INPUT_CLASS} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Negotiation outcome</label>
              <select value={form.negotiationStatus} onChange={(e) => setForm((f) => ({ ...f, negotiationStatus: e.target.value }))} className={INPUT_CLASS}>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="counter_offered">Counter offered</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Approved waiver</label>
              <input type="number" min="0" value={form.approvedWaiver} onChange={(e) => setForm((f) => ({ ...f, approvedWaiver: e.target.value }))} className={INPUT_CLASS} />
            </div>
          </div>
          {form.negotiationStatus === 'counter_offered' && (
            <div>
              <label className={LABEL_CLASS}>Counter offer amount</label>
              <input type="number" min="0" value={form.counterOffer} onChange={(e) => setForm((f) => ({ ...f, counterOffer: e.target.value }))} className={INPUT_CLASS} />
            </div>
          )}
          <div>
            <label className={LABEL_CLASS}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={INPUT_CLASS} rows={3} />
          </div>
        </div>
      );
    case 'offer_acceptance':
      return (
        <label className="flex items-center gap-3 text-sm text-gray-700">
          <input type="checkbox" checked={form.paymentConfirmed} onChange={(e) => setForm((f) => ({ ...f, paymentConfirmed: e.target.checked }))} />
          First payment confirmed
        </label>
      );
    case 'provision_m08':
      return (
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.hostelRequired} onChange={(e) => setForm((f) => ({ ...f, hostelRequired: e.target.checked }))} />
            Allocate hostel room
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.transportRequired} onChange={(e) => setForm((f) => ({ ...f, transportRequired: e.target.checked }))} />
            Assign transport route
          </label>
          {form.transportRequired && (
            <div>
              <label className={LABEL_CLASS}>Preferred stop name</label>
              <input value={form.preferredStopName} onChange={(e) => setForm((f) => ({ ...f, preferredStopName: e.target.value }))} className={INPUT_CLASS} placeholder="Optional route stop hint" />
            </div>
          )}
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.libraryRequired} onChange={(e) => setForm((f) => ({ ...f, libraryRequired: e.target.checked }))} />
            Create library membership
          </label>
        </div>
      );
    case 'provision_juvi':
      return (
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.createConversation} onChange={(e) => setForm((f) => ({ ...f, createConversation: e.target.checked }))} />
            Create Juvi student conversation
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={form.createWelcomeMessage} onChange={(e) => setForm((f) => ({ ...f, createWelcomeMessage: e.target.checked }))} />
            Seed welcome message
          </label>
        </div>
      );
    case 'onboarding_complete':
      return (
        <div>
          <label className={LABEL_CLASS}>Enrollment number</label>
          <input value={form.enrollmentNumber} onChange={(e) => setForm((f) => ({ ...f, enrollmentNumber: e.target.value }))} className={INPUT_CLASS} placeholder="e.g. WF-2026-0001" />
        </div>
      );
    case 'cancel_request':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Cancellation type</label>
              <select value={form.cancellationType} onChange={(e) => setForm((f) => ({ ...f, cancellationType: e.target.value }))} className={INPUT_CLASS}>
                <option value="post_enrolment">Post enrolment</option>
                <option value="pre_enrolment">Pre enrolment</option>
                <option value="convener_surrender">Convener surrender</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Reason category</label>
              <select value={form.reasonCategory} onChange={(e) => setForm((f) => ({ ...f, reasonCategory: e.target.value }))} className={INPUT_CLASS}>
                <option value="student_request">Student request</option>
                <option value="fee_default">Fee default</option>
                <option value="document_fraud">Document fraud</option>
                <option value="disciplinary">Disciplinary</option>
                <option value="convener_reallocation">Convener reallocation</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={INPUT_CLASS} rows={3} placeholder="Why is this admission being cancelled?" />
          </div>
          <div>
            <label className={LABEL_CLASS}>Refund amount</label>
            <input type="number" min="0" value={form.refundAmount} onChange={(e) => setForm((f) => ({ ...f, refundAmount: e.target.value }))} className={INPUT_CLASS} placeholder="Optional" />
          </div>
        </div>
      );
    default:
      return (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No extra input is required for this step. Completing it will advance the workflow.
        </div>
      );
  }
}

function renderSeatFields(
  form: Record<string, any>,
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  lookups: {
    academicYears: any[];
    programmes: any[];
    branches: any[];
  },
) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={LABEL_CLASS}>Academic year</label>
        <select value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))} className={INPUT_CLASS}>
          <option value="">Select academic year</option>
          {lookups.academicYears.map((item) => <option key={item._id} value={item._id}>{item.label || item.code}</option>)}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Quota</label>
        <select value={form.quota} onChange={(e) => setForm((f) => ({ ...f, quota: e.target.value }))} className={INPUT_CLASS}>
          {QUOTA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Programme</label>
        <select value={form.programmeId} onChange={(e) => setForm((f) => ({ ...f, programmeId: e.target.value }))} className={INPUT_CLASS}>
          <option value="">Select programme</option>
          {lookups.programmes.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Branch</label>
        <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} className={INPUT_CLASS}>
          <option value="">Select branch</option>
          {lookups.branches.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function renderWorkflowBlueprint(workflowDetail: any) {
  const tasks = workflowDetail?.tasks || [];
  const taskMap = new Map<string, any>(tasks.map((task: any) => [task.stepId, task]));
  const currentStep = workflowDetail?.instance?.currentStep;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-navy">Journey Blueprint</h3>
          <p className="text-sm text-gray-500">
            {workflowDetail
              ? `Showing live progression for workflow ${workflowDetail.instance.workflowId}.`
              : 'Select a workflow instance to see live step status across the full admissions journey.'}
          </p>
        </div>
        {workflowDetail && (
          <Badge variant={STATUS_VARIANT[workflowDetail.instance.status]}>
            {workflowDetail.instance.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {WORKFLOW_BLUEPRINT.map((phase) => (
          <div key={phase.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{phase.id}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{phase.label}</div>
            <p className="mt-1 text-sm text-slate-500">{phase.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {phase.steps.map((stepId) => {
                const task = taskMap.get(stepId);
                const derivedStatus = task?.status || (currentStep === stepId ? 'current' : 'upcoming');
                return (
                  <Badge key={stepId} variant={getBlueprintStepVariant(derivedStatus)}>
                    {formatStepLabel(stepId)}
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskActionModal({
  action,
  open,
  onClose,
  onSubmit,
  isPending,
  currentAcademicYearId,
  lookups,
}: {
  action: TaskActionState;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  isPending: boolean;
  currentAcademicYearId: string;
  lookups: {
    academicYears: any[];
    programmes: any[];
    branches: any[];
    allotmentRounds: any[];
  };
}) {
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!action) return;
    setForm(getDefaultActionForm(action, currentAcademicYearId));
  }, [action, currentAcademicYearId]);

  if (!action) return null;
  const activeAction = action;

  const title =
    activeAction.mode === 'complete'
      ? `Complete ${activeAction.task.stepName}`
      : activeAction.mode === 'fail'
        ? `Fail ${activeAction.task.stepName}`
        : `Skip ${activeAction.task.stepName}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeAction.mode === 'complete') {
      onSubmit(buildCompletePayload(activeAction.task.stepId, form));
      return;
    }
    onSubmit({ reason: form.reason });
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
          <div className="font-medium text-slate-800">{activeAction.task.stepName}</div>
          <div className="mt-1 text-slate-500">{activeAction.task.phase.replace(/_/g, ' ')} • {activeAction.task.type}</div>
        </div>

        {activeAction.mode === 'complete' ? (
          renderTaskFormFields(activeAction, form, setForm, lookups)
        ) : (
          <div>
            <label className={LABEL_CLASS}>Reason</label>
            <textarea required value={form.reason || ''} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={INPUT_CLASS} rows={4} />
          </div>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
            style={{ background: activeAction.mode === 'complete' ? '#0F766E' : activeAction.mode === 'fail' ? '#B91C1C' : '#475569' }}
          >
            {isPending ? 'Saving...' : activeAction.mode === 'complete' ? 'Complete step' : activeAction.mode === 'fail' ? 'Mark failed' : 'Skip step'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function WorkflowPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [taskFilter, setTaskFilter] = useState('pending');
  const [taskPhaseFilter, setTaskPhaseFilter] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [startOpen, setStartOpen] = useState(false);
  const [taskAction, setTaskAction] = useState<TaskActionState>(null);
  const [startForm, setStartForm] = useState({ inquiryId: '', academicYearId: '' });
  const [liveMode, setLiveMode] = useState(true);

  const { data: stats } = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: getWorkflowStats,
    refetchInterval: liveMode ? 10000 : false,
  });
  const { data: instances, isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances', page, statusFilter],
    queryFn: () => listWorkflowInstances(page, 20, statusFilter || undefined),
    refetchInterval: liveMode ? 10000 : false,
  });
  const { data: taskQueue, isLoading: queueLoading } = useQuery({
    queryKey: ['workflow-tasks', taskFilter, taskPhaseFilter],
    queryFn: () => listWorkflowTasks(1, 20, taskFilter || undefined, taskPhaseFilter || undefined),
    refetchInterval: liveMode ? 10000 : false,
  });
  const { data: workflowDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['workflow-detail', selectedInstanceId],
    queryFn: () => getWorkflowStatus(selectedInstanceId),
    enabled: Boolean(selectedInstanceId),
    refetchInterval: selectedInstanceId && liveMode ? 10000 : false,
  });
  const detailStudentId = workflowDetail?.instance?.metadata?.studentId;
  const { data: workflowStudent } = useQuery({
    queryKey: ['workflow-detail-student', detailStudentId],
    queryFn: () => getStudent(detailStudentId),
    enabled: Boolean(detailStudentId),
    refetchInterval: detailStudentId && liveMode ? 10000 : false,
  });
  const { data: inquiries, isFetching: startInquiriesLoading, refetch: refetchStartInquiries } = useQuery({
    queryKey: ['workflow-start-inquiries'],
    queryFn: () => listInquiries(1, 100),
    enabled: startOpen,
    refetchOnMount: 'always',
  });
  const { data: academicYears } = useQuery({
    queryKey: ['workflow-academic-years'],
    queryFn: () => listAcademicYears(1, 100),
  });
  const { data: programmes } = useQuery({
    queryKey: ['workflow-programmes'],
    queryFn: () => listProgrammes(1, 100),
  });
  const { data: branches } = useQuery({
    queryKey: ['workflow-branches'],
    queryFn: () => listBranches(1, 100),
  });
  const { data: allotmentRounds } = useQuery({
    queryKey: ['workflow-allotment-rounds'],
    queryFn: () => listWorkflowAllotmentRounds(),
  });

  async function openTaskAction(mode: 'complete' | 'fail' | 'skip', task: any, workflowInstanceId: string) {
    const detail = await qc.fetchQuery({
      queryKey: ['workflow-detail', workflowInstanceId],
      queryFn: () => getWorkflowStatus(workflowInstanceId),
    });
    setSelectedInstanceId(workflowInstanceId);
    setTaskAction({ mode, task, instance: detail.instance });
  }

  useEffect(() => {
    if (startForm.academicYearId || !academicYears?.items?.length) return;
    const current = academicYears.items.find((item: any) => item.isCurrent) || academicYears.items[0];
    if (current?._id) {
      setStartForm((form) => ({ ...form, academicYearId: current._id }));
    }
  }, [academicYears, startForm.academicYearId]);

  useEffect(() => {
    if (!startOpen) return;
    void refetchStartInquiries();
  }, [startOpen, refetchStartInquiries]);

  const startMutation = useMutation({
    mutationFn: startWorkflow,
    onSuccess: (data) => {
      setStartOpen(false);
      setStartForm((form) => ({ ...form, inquiryId: '' }));
      setSelectedInstanceId(data._id);
      invalidateWorkflowData(qc);
    },
  });

  const taskMutation = useMutation({
    mutationFn: async (payload: { action: TaskActionState; data: any }) => {
      if (!payload.action) return null;
      if (payload.action.mode === 'complete') {
        return completeWorkflowTask(payload.action.task._id, payload.data);
      }
      if (payload.action.mode === 'fail') {
        return failWorkflowTask(payload.action.task._id, payload.data.reason);
      }
      return skipWorkflowTask(payload.action.task._id, payload.data.reason);
    },
    onSuccess: () => {
      setTaskAction(null);
      invalidateWorkflowData(qc);
    },
  });

  const triggerStepMutation = useMutation({
    mutationFn: ({ instanceId, stepId, data }: { instanceId: string; stepId: string; data?: Record<string, any> }) =>
      triggerWorkflowStep(instanceId, {
        stepId,
        metadata: data?.metadata,
        notes: data?.notes,
      }),
    onSuccess: async (data) => {
      invalidateWorkflowData(qc);
      setSelectedInstanceId(data.instance._id);
      const detail = await qc.fetchQuery({
        queryKey: ['workflow-detail', data.instance._id],
        queryFn: () => getWorkflowStatus(data.instance._id),
      });
      setTaskAction({ mode: 'complete', task: data.task, instance: detail.instance });
    },
  });

  const workflowInstances = instances?.items || [];
  const queueItems = taskQueue?.items || [];
  const pendingStartInquiries = (inquiries?.items || []).filter((item: any) => (
    item.status !== 'converted'
    && item.status !== 'lost'
    && !item.workflowInstanceId
  ));
  const currentAcademicYearId = startForm.academicYearId || academicYears?.items?.find((item: any) => item.isCurrent)?._id || '';

  const instanceColumns = [
    {
      key: 'entity',
      label: 'Entity',
      render: (row: any) => (
        <div>
          <div className="font-medium text-navy">{row.metadata?.applicationNumber || row.metadata?.inquiryId || row.entityId}</div>
          <div className="text-xs text-gray-500">{row.entityType}</div>
        </div>
      ),
    },
    { key: 'currentPhase', label: 'Phase', render: (row: any) => <span className="text-gray-600">{row.currentPhase.replace(/_/g, ' ')}</span> },
    { key: 'currentStep', label: 'Current step', render: (row: any) => formatStepLabel(row.currentStep) },
    { key: 'status', label: 'Status', render: (row: any) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge> },
    { key: 'createdAt', label: 'Started', render: (row: any) => new Date(row.createdAt).toLocaleString() },
  ];

  const queueColumns = [
    { key: 'stepName', label: 'Task', render: (row: any) => <span className="font-medium text-navy">{row.stepName}</span> },
    { key: 'phase', label: 'Phase', render: (row: any) => row.phase.replace(/_/g, ' ') },
    { key: 'assigneeRole', label: 'Owner', render: (row: any) => row.assigneeRole ? row.assigneeRole.replace(/_/g, ' ') : 'System' },
    { key: 'type', label: 'Type', render: (row: any) => <Badge variant={TASK_TYPE_VARIANT[row.type]}>{row.type}</Badge> },
    { key: 'status', label: 'Status', render: (row: any) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (row: any) => (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInstanceId(row.workflowInstanceId);
            }}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Inspect
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openTaskAction('complete', row, row.workflowInstanceId);
            }}
            className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700"
          >
            Complete
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openTaskAction('skip', row, row.workflowInstanceId);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Skip
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openTaskAction('fail', row, row.workflowInstanceId);
            }}
            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Fail
          </button>
        </div>
      ),
    },
  ];

  function handleStartWorkflow(e: React.FormEvent) {
    e.preventDefault();
    startMutation.mutate({
      workflowId: 'W01',
      entityType: 'Inquiry',
      entityId: startForm.inquiryId,
      academicYearId: startForm.academicYearId || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-900 px-6 py-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-teal-100">
              <GitBranch size={13} />
              W01 Admissions Workflow
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Workflow Console</h2>
            <p className="mt-2 text-sm text-slate-200">
              Operate the admissions journey as a real state machine: start an inquiry, work the active task queue, and inspect each instance as it moves from lead to onboarding.
            </p>
          </div>
          <button
            onClick={() => setStartOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-teal-50"
          >
            <PlayCircle size={16} />
            Start Workflow
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-slate-900">Live operations mode</div>
          <div className="text-xs text-slate-500">Auto-refresh stats, instances, queue, and the selected workflow every 10 seconds.</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
            Live refresh
          </label>
          <button
            onClick={() => invalidateWorkflowData(qc)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Refresh now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard label="Active workflows" value={stats?.activeWorkflows || 0} icon={Activity} color="bg-sky-50 text-sky-600" />
        <StatCard label="Pending tasks" value={stats?.pendingTasks || 0} icon={ListTodo} color="bg-amber-50 text-amber-600" />
        <StatCard label="Completed today" value={stats?.completedToday || 0} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Seat fill %" value={stats?.seatMatrix?.fillPercentage || 0} icon={ClipboardList} color="bg-teal-50 text-teal-600" />
      </div>

      {renderWorkflowBlueprint(workflowDetail)}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-navy">Workflow Instances</h3>
              <p className="text-sm text-gray-500">Every active and completed admissions journey.</p>
            </div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <DataTable columns={instanceColumns} data={workflowInstances} loading={instancesLoading} onRowClick={(row: any) => setSelectedInstanceId(row._id)} />

          {instances && instances.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {instances.pages}</span>
              <button disabled={page >= instances.pages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-navy">Task Queue</h3>
              <p className="text-sm text-gray-500">Pending and in-progress workflow work items.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select value={taskPhaseFilter} onChange={(e) => setTaskPhaseFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                {PHASE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="">All tasks</option>
              </select>
            </div>
          </div>

          <DataTable columns={queueColumns} data={queueItems} loading={queueLoading} onRowClick={(row: any) => setSelectedInstanceId(row.workflowInstanceId)} />
        </section>
      </div>

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Start Admissions Workflow">
        <form onSubmit={handleStartWorkflow} className="space-y-4">
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            W01 starts from an inquiry. The picker only shows inquiries that are not lost, not converted, and not already linked to another workflow.
          </div>
          <div>
            <label className={LABEL_CLASS}>Inquiry</label>
            <select
              required
              value={startForm.inquiryId}
              onChange={(e) => setStartForm((form) => ({ ...form, inquiryId: e.target.value }))}
              className={INPUT_CLASS}
              disabled={startInquiriesLoading || pendingStartInquiries.length === 0}
            >
              <option value="">
                {startInquiriesLoading ? 'Loading inquiries...' : pendingStartInquiries.length === 0 ? 'No startable inquiries found' : 'Select inquiry'}
              </option>
              {pendingStartInquiries.map((item: any) => (
                <option key={item._id} value={item._id}>
                  {item.name} • {item.phone} • {item.programmeInterest || 'No programme'} • {item.status}
                </option>
              ))}
            </select>
            {!startInquiriesLoading && pendingStartInquiries.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                No eligible inquiries are available for workflow start in the current college context.
              </p>
            )}
          </div>
          <div>
            <label className={LABEL_CLASS}>Academic year</label>
            <select value={startForm.academicYearId} onChange={(e) => setStartForm((form) => ({ ...form, academicYearId: e.target.value }))} className={INPUT_CLASS}>
              <option value="">Select academic year</option>
              {(academicYears?.items || []).map((item: any) => (
                <option key={item._id} value={item._id}>{item.label || item.code}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={() => setStartOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={startMutation.isPending || pendingStartInquiries.length === 0} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {startMutation.isPending ? 'Starting...' : 'Start workflow'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedInstanceId)}
        onClose={() => setSelectedInstanceId('')}
        title={workflowDetail ? `Workflow ${workflowDetail.instance.workflowId} • ${workflowDetail.instance.status}` : 'Workflow Details'}
        widthClass="max-w-5xl"
      >
        {detailLoading || !workflowDetail ? (
          <div className="py-10 text-center text-gray-400">Loading workflow details...</div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const hasCancellationTask = workflowDetail.tasks.some((task: any) => task.phase === 'M01.6_CANCEL');
              const canTriggerCancellation = ['active', 'completed'].includes(workflowDetail.instance.status) && !hasCancellationTask;

              return canTriggerCancellation ? (
                <div className="flex justify-end">
                  <button
                    onClick={() => triggerStepMutation.mutate({
                      instanceId: workflowDetail.instance._id,
                      stepId: 'cancel_request',
                      data: { notes: 'Cancellation branch initiated from workflow console.' },
                    })}
                    disabled={triggerStepMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle size={15} />
                    {triggerStepMutation.isPending ? 'Preparing cancellation...' : 'Trigger Cancellation'}
                  </button>
                </div>
              ) : null;
            })()}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Entity</div>
                <div className="mt-1 font-semibold text-slate-900">{workflowDetail.instance.entityType}</div>
                <div className="text-xs text-slate-500 break-all">{workflowDetail.instance.entityId}</div>
              </div>
              <div className="rounded-xl border bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Current phase</div>
                <div className="mt-1 font-semibold text-slate-900">{workflowDetail.instance.currentPhase.replace(/_/g, ' ')}</div>
              </div>
              <div className="rounded-xl border bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Current step</div>
                <div className="mt-1 font-semibold text-slate-900">{formatStepLabel(workflowDetail.instance.currentStep)}</div>
              </div>
              <div className="rounded-xl border bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Started</div>
                <div className="mt-1 font-semibold text-slate-900">{formatDateTime(workflowDetail.instance.createdAt)}</div>
              </div>
            </div>

            {workflowStudent && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-amber-700">Student Onboarding</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {workflowStudent.personId?.name || workflowStudent.person?.name || workflowStudent.rollNumber || workflowStudent._id}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Roll: {workflowStudent.rollNumber || '—'} • Onboarding status: {workflowStudent.onboardingStatus?.replace(/_/g, ' ') || '—'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={workflowStudent.profileCompleteness?.status === 'complete' ? 'success' : workflowStudent.profileCompleteness?.status === 'progressing' ? 'warning' : 'default'}>
                      {workflowStudent.profileCompleteness?.percent || 0}% profile
                    </Badge>
                    <Badge variant={workflowStudent.onboardingCompleteness?.status === 'completed' ? 'success' : workflowStudent.onboardingCompleteness?.status === 'in_progress' ? 'warning' : 'default'}>
                      {workflowStudent.onboardingCompleteness?.percent || 0}% onboarded
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-white/60 bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Guardian linkage</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <div>Primary guardian: {workflowStudent.primaryParentId?.personId?.name || 'Missing'}</div>
                      <div>Fee guardian: {workflowStudent.feeResponsibleParentId?.personId?.name || 'Missing'}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/60 bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Current blockers</div>
                    {(() => {
                      const blockers = [
                        !workflowStudent.feeResponsibleParentId ? 'Fee responsible guardian not linked' : null,
                        ...(workflowStudent.onboardingCompleteness?.missing || []),
                      ].filter(Boolean);
                      return blockers.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {blockers.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      ) : (
                        <div className="mt-2 text-sm text-emerald-700">No blockers. Student onboarding is fully ready.</div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border bg-slate-950 p-4 text-slate-100">
              <div className="text-xs uppercase tracking-[0.2em] text-teal-300">Workflow Metadata</div>
              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-slate-300">{JSON.stringify(workflowDetail.instance.metadata || {}, null, 2)}</pre>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-navy">Tasks</h4>
              <div className="mt-4 space-y-3">
                {workflowDetail.tasks.map((task: any) => {
                  const actionable = workflowDetail.instance.status === 'active' && task.status !== 'completed' && task.status !== 'failed' && task.status !== 'skipped';
                  return (
                    <div key={task._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-slate-900">{task.stepName}</div>
                            <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
                            <Badge variant={TASK_TYPE_VARIANT[task.type]}>{task.type}</Badge>
                          </div>
                          <div className="mt-2 text-sm text-slate-500">{task.phase.replace(/_/g, ' ')}{task.assigneeRole ? ` • ${task.assigneeRole}` : ''}</div>
                          {task.notes && <div className="mt-2 text-sm text-slate-600">{task.notes}</div>}
                          {task.result && Object.keys(task.result).length > 0 && (
                            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{JSON.stringify(task.result, null, 2)}</pre>
                          )}
                        </div>
                        {actionable && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => setTaskAction({ mode: 'complete', task, instance: workflowDetail.instance })} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700">
                              <CheckCircle2 size={14} />
                              Complete
                            </button>
                            <button onClick={() => setTaskAction({ mode: 'skip', task, instance: workflowDetail.instance })} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              <SkipForward size={14} />
                              Skip
                            </button>
                            <button onClick={() => setTaskAction({ mode: 'fail', task, instance: workflowDetail.instance })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                              <XCircle size={14} />
                              Fail
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <TaskActionModal
        action={taskAction}
        open={Boolean(taskAction)}
        onClose={() => setTaskAction(null)}
        onSubmit={(data) => taskAction && taskMutation.mutate({ action: taskAction, data })}
        isPending={taskMutation.isPending}
        currentAcademicYearId={currentAcademicYearId}
        lookups={{
          academicYears: academicYears?.items || [],
          programmes: programmes?.items || [],
          branches: branches?.items || [],
          allotmentRounds: allotmentRounds || [],
        }}
      />
    </div>
  );
}

function invalidateWorkflowData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['workflow-stats'] });
  qc.invalidateQueries({ queryKey: ['workflow-instances'] });
  qc.invalidateQueries({ queryKey: ['workflow-detail'] });
  qc.invalidateQueries({ queryKey: ['workflow-tasks'] });
  qc.invalidateQueries({ queryKey: ['workflow-start-inquiries'] });
  qc.invalidateQueries({ queryKey: ['inquiries'] });
  qc.invalidateQueries({ queryKey: ['applicants'] });
  qc.invalidateQueries({ queryKey: ['enrollments'] });
  qc.invalidateQueries({ queryKey: ['admissions-stats'] });
}
