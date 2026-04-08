// ─── W01: Student Intake & Onboarding ───────────────────────
// State machine definition for the complete admissions workflow.
// Phases: LEAD → APP → SEAT → OFFER → ENROL → CANCEL (optional)

import { WorkflowDefinition, registerWorkflow } from '../WorkflowDefinition';

const W01: WorkflowDefinition = {
  id: 'W01',
  name: 'Student Intake & Onboarding',
  version: 1,
  entityType: 'Inquiry',

  phases: [
    // ─── Phase 1: Lead Capture & Enquiry ──────────────────
    {
      id: 'M01.1_LEAD',
      name: 'Lead Capture & Enquiry',
      description: 'Capture, score, deduplicate, and nurture leads from all channels',
      order: 1,
      steps: [
        {
          id: 'lead_capture',
          name: 'Capture Lead',
          phase: 'M01.1_LEAD',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:lead:captured',
          metadata: { description: 'Lead record created from walk-in, web, WhatsApp, or bulk import' },
        },
        {
          id: 'lead_score',
          name: 'Score & Grade Lead',
          phase: 'M01.1_LEAD',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:lead:scored',
          metadata: { description: 'AI scores lead as Hot/Warm/Cold based on programme demand, location, engagement' },
        },
        {
          id: 'lead_dedup',
          name: 'Deduplicate Lead',
          phase: 'M01.1_LEAD',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:lead:deduped',
          metadata: { description: 'Match confidence ≥80%: auto-merge. <80%: flag for staff review' },
        },
        {
          id: 'lead_nurture',
          name: 'Nurture Lead',
          phase: 'M01.1_LEAD',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:lead:nurtured',
          metadata: { description: 'Periodic WhatsApp/SMS follow-ups at Day 1, 3, 7, 14' },
        },
        {
          id: 'lead_convert',
          name: 'Convert Lead to Application',
          phase: 'M01.1_LEAD',
          type: 'manual',
          assigneeRole: 'admissions_staff',
          aiAutonomy: 'assists',
          onComplete: 'admissions:lead:converted',
          metadata: { description: 'Create Application record from qualified lead, determine admission pathway' },
        },
      ],
    },

    // ─── Phase 2: Application Processing ──────────────────
    {
      id: 'M01.2_APP',
      name: 'Application Processing',
      description: 'Document collection, verification, OCR, and eligibility determination',
      order: 2,
      steps: [
        {
          id: 'app_submit',
          name: 'Submit Application',
          phase: 'M01.2_APP',
          type: 'manual',
          assigneeRole: 'admissions_staff',
          onComplete: 'admissions:application:submitted',
          metadata: { description: 'Application form completed, fee paid, documents initiated' },
        },
        {
          id: 'doc_collection',
          name: 'Collect Documents',
          phase: 'M01.2_APP',
          type: 'manual',
          assigneeRole: 'admissions_staff',
          onComplete: 'admissions:documents:collected',
          metadata: { description: 'Physical/digital document collection and upload' },
        },
        {
          id: 'doc_ocr',
          name: 'Verify Documents via AI OCR',
          phase: 'M01.2_APP',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:documents:ocr_complete',
          onFail: 'admissions:documents:ocr_failed',
          metadata: { description: 'AI OCR extraction. Confidence ≥90%: auto-verify. <90%: flag for staff' },
        },
        {
          id: 'doc_review',
          name: 'Review Flagged Documents',
          phase: 'M01.2_APP',
          type: 'manual',
          assigneeRole: 'admissions_staff',
          aiAutonomy: 'flags_for_review',
          onComplete: 'admissions:documents:reviewed',
          metadata: { description: 'Staff resolves OCR flags: Verify/Correct/Deficient/Reject' },
        },
        {
          id: 'eligibility_check',
          name: 'Verify Eligibility',
          phase: 'M01.2_APP',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:eligibility:verified',
          metadata: { description: 'AI evaluates marks, subjects, age, category rules' },
        },
        {
          id: 'eligibility_review',
          name: 'Review Eligibility Edge Cases',
          phase: 'M01.2_APP',
          type: 'approval',
          assigneeRole: 'hod',
          aiAutonomy: 'flags_for_review',
          onComplete: 'admissions:eligibility:edge_resolved',
          metadata: { description: 'HOD/Leadership reviews borderline eligibility cases' },
        },
      ],
    },

    // ─── Phase 3: Seat Inventory & Allotment ──────────────
    {
      id: 'M01.3_SEAT',
      name: 'Seat Inventory & Allotment',
      description: 'Seat matrix management, merit list generation, and allotment rounds',
      order: 3,
      steps: [
        {
          id: 'seat_check',
          name: 'Check Seat Availability',
          phase: 'M01.3_SEAT',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:seat:available',
          metadata: { description: 'Verify seats available in requested programme/branch/quota' },
        },
        {
          id: 'merit_rank',
          name: 'Calculate Merit Rank',
          phase: 'M01.3_SEAT',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:merit:ranked',
          metadata: { description: 'Generate merit ranking based on configured criteria' },
        },
        {
          id: 'allotment',
          name: 'Execute Allotment',
          phase: 'M01.3_SEAT',
          type: 'approval',
          assigneeRole: 'admissions_head',
          aiAutonomy: 'assists',
          onComplete: 'admissions:allotment:done',
          metadata: { description: 'Allot seat or add to waitlist based on merit + preferences' },
        },
      ],
    },

    // ─── Phase 4: Offer & Fee Negotiation ─────────────────
    {
      id: 'M01.4_OFFER',
      name: 'Offer & Fee Negotiation',
      description: 'Generate offers, handle fee negotiations, track acceptance',
      order: 4,
      steps: [
        {
          id: 'offer_generate',
          name: 'Generate Admission Offer',
          phase: 'M01.4_OFFER',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:offer:generated',
          metadata: { description: 'Fee structure from M04, PDF generation, multi-channel delivery' },
        },
        {
          id: 'fee_negotiation',
          name: 'Fee Negotiation',
          phase: 'M01.4_OFFER',
          type: 'manual',
          assigneeRole: 'admissions_staff',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:fee:negotiated',
          metadata: { description: 'AI auto-approves waiver ≤₹50K. >₹50K escalates to leadership' },
        },
        {
          id: 'offer_acceptance',
          name: 'Offer Acceptance & Payment',
          phase: 'M01.4_OFFER',
          type: 'manual',
          assigneeRole: 'admissions_staff',
          timeout: 168, // 7 days
          onComplete: 'admissions:offer:accepted',
          onFail: 'admissions:offer:expired',
          metadata: { description: 'Student accepts offer and makes first payment via gateway' },
        },
      ],
    },

    // ─── Phase 5: Enrolment & Provisioning ────────────────
    {
      id: 'M01.5_ENROL',
      name: 'Enrolment & Provisioning',
      description: 'Create student records, provision across modules, complete onboarding',
      order: 5,
      steps: [
        {
          id: 'enrol_execute',
          name: 'Execute Enrolment',
          phase: 'M01.5_ENROL',
          type: 'parallel_group',
          aiAutonomy: 'autonomous',
          parallelSteps: [
            'provision_m02',    // Person + Student records
            'provision_m03',    // Section + Courses + Timetable
            'provision_m04',    // Invoice generation
            'provision_m08',    // Hostel + Transport + Library
            'provision_m12',    // User account + RBAC
            'provision_juvi',   // Juvi app onboarding
          ],
          onComplete: 'admissions:enrolment:provisioned',
          metadata: { description: 'Parallel provisioning across 6 modules' },
        },
        {
          id: 'provision_m02',
          name: 'Provision M02: Person & Student',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          metadata: { module: 'M02', description: 'Create Person record, Student record, roll number, parent linkage' },
        },
        {
          id: 'provision_m03',
          name: 'Provision M03: Academics',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          metadata: { module: 'M03', description: 'Assign section, register courses, map timetable' },
        },
        {
          id: 'provision_m04',
          name: 'Provision M04: Finance',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          metadata: { module: 'M04', description: 'Generate first semester invoice with all fee components' },
        },
        {
          id: 'provision_m08',
          name: 'Provision M08: Campus',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          metadata: { module: 'M08', description: 'Hostel room, transport route, library membership, lab access' },
        },
        {
          id: 'provision_m12',
          name: 'Provision M12: Platform',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          metadata: { module: 'M12', description: 'Create user account, assign RBAC roles, send credentials' },
        },
        {
          id: 'provision_juvi',
          name: 'Provision Juvi: Student App',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          metadata: { module: 'Juvi', description: 'Create Juvi account, subscribe channels, AI companion intro' },
        },
        {
          id: 'onboarding_complete',
          name: 'Onboarding Complete',
          phase: 'M01.5_ENROL',
          type: 'automated',
          aiAutonomy: 'autonomous',
          onComplete: 'admissions:onboarding:complete',
          metadata: { description: 'All provisioning verified, student is academically active' },
        },
      ],
    },

    // ─── Phase 6: Cancellation (optional) ─────────────────
    {
      id: 'M01.6_CANCEL',
      name: 'Cancellation & Recovery',
      description: 'Handle admission cancellations, reversals, and seat recovery',
      order: 6,
      steps: [
        {
          id: 'cancel_request',
          name: 'Process Cancellation Request',
          phase: 'M01.6_CANCEL',
          type: 'approval',
          assigneeRole: 'admissions_head',
          onComplete: 'admissions:cancellation:approved',
          metadata: { description: 'Approve cancellation, initiate reversals across modules' },
        },
        {
          id: 'cancel_execute',
          name: 'Execute Reversals',
          phase: 'M01.6_CANCEL',
          type: 'parallel_group',
          aiAutonomy: 'autonomous',
          parallelSteps: ['cancel_m02', 'cancel_m04', 'cancel_m08', 'cancel_m12', 'cancel_juvi'],
          onComplete: 'admissions:cancellation:completed',
          metadata: { description: 'Reverse provisioning across modules, process refund, release seat' },
        },
        { id: 'cancel_m02', name: 'Reverse M02 Records', phase: 'M01.6_CANCEL', type: 'automated', aiAutonomy: 'autonomous', metadata: { module: 'M02' } },
        { id: 'cancel_m04', name: 'Process Refund (M04)', phase: 'M01.6_CANCEL', type: 'automated', aiAutonomy: 'autonomous', metadata: { module: 'M04' } },
        { id: 'cancel_m08', name: 'Reverse M08 Allocations', phase: 'M01.6_CANCEL', type: 'automated', aiAutonomy: 'autonomous', metadata: { module: 'M08' } },
        { id: 'cancel_m12', name: 'Deactivate M12 Account', phase: 'M01.6_CANCEL', type: 'automated', aiAutonomy: 'autonomous', metadata: { module: 'M12' } },
        { id: 'cancel_juvi', name: 'Deactivate Juvi Account', phase: 'M01.6_CANCEL', type: 'automated', aiAutonomy: 'autonomous', metadata: { module: 'Juvi' } },
      ],
    },
  ],

  transitions: [
    // Phase 1: Lead
    { from: 'lead_capture', to: 'lead_score', event: 'complete' },
    { from: 'lead_score', to: 'lead_dedup', event: 'complete' },
    { from: 'lead_dedup', to: 'lead_nurture', event: 'complete' },
    { from: 'lead_nurture', to: 'lead_convert', event: 'complete' },

    // Phase 1 → Phase 2
    { from: 'lead_convert', to: 'app_submit', event: 'complete' },

    // Phase 2: Application
    { from: 'app_submit', to: 'doc_collection', event: 'complete' },
    { from: 'doc_collection', to: 'doc_ocr', event: 'complete' },
    { from: 'doc_ocr', to: 'doc_review', event: 'complete', guard: 'has_flagged_documents' },
    { from: 'doc_ocr', to: 'eligibility_check', event: 'complete', guard: 'all_documents_verified' },
    { from: 'doc_review', to: 'eligibility_check', event: 'complete' },
    { from: 'eligibility_check', to: 'eligibility_review', event: 'complete', guard: 'is_edge_case' },
    { from: 'eligibility_check', to: 'seat_check', event: 'complete', guard: 'is_eligible' },
    { from: 'eligibility_review', to: 'seat_check', event: 'complete' },

    // Phase 3: Seat & Allotment
    { from: 'seat_check', to: 'merit_rank', event: 'complete' },
    { from: 'merit_rank', to: 'allotment', event: 'complete' },

    // Phase 3 → Phase 4
    { from: 'allotment', to: 'offer_generate', event: 'complete' },

    // Phase 4: Offer
    { from: 'offer_generate', to: 'fee_negotiation', event: 'complete', guard: 'negotiation_requested' },
    { from: 'offer_generate', to: 'offer_acceptance', event: 'complete', guard: 'no_negotiation' },
    { from: 'fee_negotiation', to: 'offer_acceptance', event: 'complete' },

    // Phase 4 → Phase 5
    { from: 'offer_acceptance', to: 'enrol_execute', event: 'complete' },

    // Phase 5: Enrolment
    { from: 'enrol_execute', to: 'onboarding_complete', event: 'complete' },

    // Cancellation (can be triggered from various states)
    { from: 'cancel_request', to: 'cancel_execute', event: 'complete' },
  ],

  initialStep: 'lead_capture',
  terminalSteps: ['onboarding_complete', 'cancel_execute'],
};

// Register W01 on import
registerWorkflow(W01);

export default W01;
