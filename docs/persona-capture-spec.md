# Persona Capture Specification

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

## Acceptance Criteria

1. Shared identity fields can be created and updated through People APIs.
2. Student, faculty, and staff forms can capture the Phase 1 shared fields.
3. Parent and organization APIs can persist their new Phase 1 persona-specific fields.
4. Existing People CRUD flows continue to work without requiring the new optional fields.
