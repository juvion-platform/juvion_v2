# Persona Capture Specification

> **Status**: DRAFT | Last updated: April 2026

## Purpose

Define the minimum and extended information Juvion should capture for each persona in the application, while preserving the current model split:

- `Person`: shared identity and contact record
- `User`: platform access and RBAC record
- persona-specific records: `Student`, `Faculty`, `Staff`, `Parent`, `Organization`

This keeps identity data normalized and prevents each persona schema from becoming a duplicate of the others.

## Design Principles

1. A human should have one canonical `Person` record per college.
2. Login and authorization stay in `User`; business profile stays outside `User`.
3. Persona-specific schemas should capture operational data only.
4. Fields required for admissions or onboarding can be collected progressively.
5. `HOD`, `Principal`, and `Admin` are access personas layered on top of `Faculty` or `Staff`, not separate master entities.

## Persona Model

### Shared Identity Layer: `Person`

Required at creation:

- `name`
- `phone`

Recommended at creation:

- `email`
- `gender`
- `dob`
- `aadhaar`
- `address`

Extended profile fields:

- `alternatePhone`
- `preferredLanguage`
- `emergencyContact.name`
- `emergencyContact.phone`
- `emergencyContact.relationship`
- `photo`
- `biometricEnrolled`

System rules:

- `collegeId` is mandatory
- Aadhaar uniqueness remains college-scoped when present
- `User.personId` should link back to the same person

### Access Layer: `User`

Required for login-enabled personas:

- `email`
- `password`
- `name`
- `role`
- `personaType`
- `personId`
- `isActive`

Notes:

- `super_admin` may remain platform-level without `collegeId`
- `principal`, `hod`, `faculty`, `staff`, `student`, and `parent` should map to a business record plus a `Person`

## Persona-Specific Capture

### Student

Must capture:

- `admissionYear`
- `programmeId`
- `branchId`
- `batchId`
- `status`

Should capture:

- `rollNumber`
- `category`
- `quota`
- `regulationId`

Later phases:

- guardian links
- fee-responsible parent
- hostel and transport preference
- medical and accommodation information
- scholarship and concession flags
- placement intent

### Parent / Guardian

Must capture:

- linked `Person`
- `relationship`
- `linkedStudents`
- `primaryContact`

Should capture:

- `occupation`
- `employer`
- `annualIncomeBand`
- `isFeeResponsible`
- `communicationPreference`

### Faculty

Must capture:

- linked `Person`
- `employeeCode`
- `designation`
- `departmentId`
- `contractType`
- `status`

Should capture:

- `qualification`
- `specialization`

Later phases:

- experience
- reporting manager
- mentor groups
- research profile
- approval scope

### Staff

Must capture:

- linked `Person`
- `employeeCode`
- `designation`
- `staffType`
- `departmentId`
- `status`

Later phases:

- shift
- work location
- reporting manager
- payroll and statutory references
- asset allocations

### Organization

Must capture:

- `name`
- `type`

Should capture:

- `address`
- `contact`
- `contactPersonName`
- `contactPersonEmail`
- `contactPersonPhone`
- `partnershipType`
- `status`

Later phases:

- agreement start and end dates
- supporting documents
- placement and internship linkage

### Alumni

Must capture:

- linked `Person`
- `graduationYear`
- `programmeId`
- `branchId`
- `currentStatus` (employed/higher-studies/entrepreneur/other)

Should capture:

- `currentEmployer`
- `currentDesignation`
- `linkedInUrl`
- `contactPreference` (email/whatsapp/phone)
- `willingToMentor`
- `willingToRecruit`

Later phases:

- mentoring session history
- guest lecture availability
- donation/sponsorship tracking
- alumni event participation
- referral network mapping

System rules:

- Alumni records are created during W10 (Student Exit) when `Student.lifecycle` transitions to `Graduated`.
- The linked `Person` record persists; the `Student` record is sealed (read-only).
- Alumni get a `User` account with role `alumni` and access scoped to M07 (placement/alumni network) and Juvi (alumni channel).

### External Person

Must capture:

- linked `Person`
- `organizationId` (if affiliated)
- `purpose` (recruiter/guest-faculty/vendor/assessor/parent-visitor/other)
- `validFrom`
- `validTo`

Should capture:

- `designation`
- `visitFrequency` (one-time/recurring)
- `sponsoredBy` (faculty/staff who invited them)
- `accessLevel` (visitor/limited/full-campus)

Later phases:

- gate pass automation (link to M08 GatePass)
- NDA/agreement tracking (link to Organization)
- feedback collection after guest lectures

System rules:

- ExternalPerson records are created by placement officers (recruiters), HR (guest faculty), or campus ops (vendors/assessors).
- Validity dates control active/expired status. Expired records are soft-archived.
- No `User` account by default; login is only provisioned for recurring external persons (e.g., visiting faculty with course assignments).

### Admin / Principal / HOD

These should not become standalone people schemas.

Model:

- `Faculty` + elevated `User.role` for academic leaders
- `Staff` + elevated `User.role` for operations leaders

Additional capture should live in role or policy configuration:

- approval limits
- department or college scope
- delegated approvers
- escalation ownership

## Key User Journeys

### Student Onboarding (via Admissions → People)

1. Admissions staff creates an `Applicant` record (or it is auto-created from EAMCET import).
2. On enrolment, the system creates a `Person` record (dedup by Aadhaar/phone) and a linked `Student` record.
3. Admin portal shows the student detail page with shared `Person` fields (name, phone, email, emergency contact) and student-specific fields (programme, branch, batch, roll number).
4. Staff fills in missing fields progressively — required fields are enforced by phase, not all at once.
5. When a parent phone is provided, the system creates a `Person` + `Parent` record and links to the student via `linkedStudents`.

### Faculty Onboarding (via HR → People)

1. HR creates an `Employee` record which triggers creation of `Person` + `Faculty` records.
2. Admin portal shows the faculty detail page with shared fields (emergency contact, photo) and faculty-specific fields (employee code, department, designation, specialization).
3. HOD or HR assigns department, designation, and contract type.
4. Later phases: research profile, mentor group assignments, and approval scope are added as the faculty's role expands.

### Parent Registration

1. During student onboarding, staff enters parent's name, phone, and relationship.
2. System checks for existing `Person` record by phone (handles sibling scenario — same parent, two students).
3. If new, creates `Person` + `Parent`. If existing, adds student to `linkedStudents`.
4. Phase 2 adds a self-service parent login provisioning flow (OTP-based via phone).

### Organization Registration (Placement/External)

1. Placement officer creates an `Organization` record when a new company registers for placement drives.
2. Contact person details (name, email, phone) are captured along with partnership type (placement/internship/training).
3. Later phases link the organization to placement seasons, job postings, and internship agreements.

## Out of Scope

The following are explicitly **not** part of this specification:

- **User model changes** — the `User` schema (email, password, role, personaType, personId, isActive) is not modified; only `Person` and persona-specific schemas are enriched.
- **RBAC or permission changes** — role definitions and authorization logic remain unchanged.
- **Data migration of existing records** — existing Person/Student/Faculty/Staff records are not retroactively enriched; new fields are optional and filled progressively.
- **Student/Faculty/Staff self-service profile editing** — Phase 1 covers admin-portal forms only; student/faculty-facing profile pages are deferred to Phase 3 or later.
- **Biometric enrollment integration** — the `biometricEnrolled` field is added to Person but actual biometric hardware integration is a separate effort.
- **DigiLocker or external document verification** — document vault references are captured but external API integrations are not in scope.

## Phased Implementation

### Phase 1

- enrich `Person` with shared contact and emergency fields
- enrich `Parent` with responsibility and communication fields
- enrich `Organization` with contact-person and partnership fields
- expose shared fields in existing student, faculty, and staff forms

### Phase 2

- build dedicated parent and organization management pages in the admin portal
- add login provisioning flow for parent, student, faculty, and staff personas
- add guardian-to-student and fee-responsibility workflows

### Phase 3

- add advanced persona attributes needed by finance, welfare, placement, and Juvi personalization
- add completeness scoring and onboarding checklists per persona

### Profile Completeness Scoring

Each persona has a completeness score computed as: `(filled fields / total scoreable fields) × 100`. Fields are weighted by tier:

| Tier | Weight | Description |
|------|--------|-------------|
| Required | 3× | Must-capture fields (e.g., name, phone, programmeId) |
| Recommended | 2× | Should-capture fields (e.g., email, category, rollNumber) |
| Extended | 1× | Later-phase fields (e.g., hostel preference, placement intent) |

**Formula**: `score = sum(filled_field_weight) / sum(all_field_weight) × 100`

**Per-persona thresholds**:

| Persona | Green (≥) | Yellow (≥) | Red (<) |
|---------|-----------|------------|---------|
| Student | 80% | 50% | 50% |
| Faculty | 75% | 45% | 45% |
| Staff | 70% | 40% | 40% |
| Parent | 60% | 35% | 35% |
| Organization | 65% | 40% | 40% |
| Alumni | 50% | 30% | 30% |

**Usage**:
- Admin portal: completeness badge (green/yellow/red) on persona cards and detail pages.
- Juvi: personalization quality degrades below Yellow — AI companion warns that profile is incomplete and suggests specific missing fields.
- Compliance: aggregate completeness scores per persona type feed into NAAC/IQAC evidence (data hygiene metrics).

## Acceptance Criteria

### Phase 1

1. `Person` model includes `alternatePhone`, `preferredLanguage`, `emergencyContact` (name, phone, relationship), `photo`, and `biometricEnrolled` fields — all optional.
2. `Parent` model includes `occupation`, `employer`, `annualIncomeBand`, `isFeeResponsible`, and `communicationPreference` fields — all optional.
3. `Organization` model includes `contactPersonName`, `contactPersonEmail`, `contactPersonPhone`, `partnershipType`, and `status` fields.
4. Student create/edit form in the admin portal exposes the shared Person fields (emergency contact, alternate phone, preferred language).
5. Faculty and staff create/edit forms in the admin portal expose the same shared Person fields.
6. `GET /api/people/persons/:id` returns the new fields when populated.
7. `PUT /api/people/persons/:id` accepts and persists the new fields.
8. Existing People CRUD flows (list, create, update, delete) continue to function when new optional fields are omitted from request bodies.
9. Zod validation schemas are updated for all changed models.
10. TypeScript strict mode passes with zero errors after changes.

### Phase 2

1. Dedicated Parent management page exists in the admin portal with list, create, edit, and delete.
2. Dedicated Organization management page exists in the admin portal.
3. Parent-to-student linkage can be created and displays linked students on the parent detail view.
4. Login provisioning flow exists for parent, student, faculty, and staff personas (creates User + links to Person).

### Phase 3

1. Persona completeness score is computed and displayed on each profile (percentage of recommended fields filled).
2. Onboarding checklist component renders per-persona required steps and tracks completion.
3. Advanced persona attributes (placement intent, medical info, hostel preference) are capturable through the student profile.
