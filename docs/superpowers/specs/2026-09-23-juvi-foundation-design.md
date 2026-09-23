# Juvi Foundation — Design

**Date:** 2026-09-23
**Status:** Approved in review, ready for implementation planning
**Source:** `Juvi_PRD_R1_The_Official_Layer.pdf` (PRD-JUVI-R1 v1.0, 17 Sep 2026)
**Sub-project:** 1 of 7 for Juvi Release 1 (see §2)

## Problem

Indian colleges run official communication on WhatsApp groups. The PRD
specifies Juvi, the college's own mobile network for students and faculty,
bundled with the Juvion ERP. Release 1 is "the official layer": every enrolled
student and faculty member is provisioned into the app, belongs to the right
channels automatically, receives every official notice, and acknowledges what
must be acknowledged, with the institution able to see who has and hasn't seen
what.

Nothing in this repo can support that yet. There is no student login outside
the W01 admissions workflow, no session model, no channels, no reconciled
membership, no durable events, and no mobile client. The existing `juvi`
module and `models/juvi/` folder hold the AI companion (PRD Release 3) plus two
unrouted prototypes, `JuviNoticeCard` and `AckRecord`.

This document is the design for the first sub-project, **Foundation**: the
account, session, provisioning, channel and app-shell layer everything else in
Release 1 stands on. It opens with the whole-release roadmap and the PRD-to-repo
mapping so the six later specs can point here instead of repeating it.

## 1. PRD-to-repo mapping

The PRD was written against a different backend description: a NestJS
monolith with outbox events already written and module codes that do not match
this repo. The table below is the binding translation for every Juvi spec.

| PRD reference | What it means in juvion_v2 |
|---|---|
| "NestJS modular monolith" | Express 4 + Mongoose 8 monolith at `backend/`. Same recommendation applies: extend it. |
| "outbox events written, no dispatcher" | **No outbox exists.** `shared/events.ts` is an in-process `EventEmitter` with one consumer. Most BullMQ workers under `backend/src/workers/` are never registered in `server.ts`. |
| M02 Student Records | `models/people/Student.ts`, `Person.ts`, `modules/people` |
| M04 HR | `models/hr/Employee.ts`, `models/people/Faculty.ts`, `Staff.ts`, `modules/hr` |
| M05 Academic Structure | `models/academic-structure/*`, `models/academic-ops/Course.ts`, `CourseOffering.ts`, `Enrollment.ts`, `Timetable.ts`, `TimetableSlot.ts`, `modules/academics` |
| M06 Finance | `models/finance/Invoice.ts`, `Payment.ts`, `PaymentPlan.ts`, `StudentFeeAccount.ts`, `modules/finance` |
| M08 Examinations | `models/academic-ops/ExamSchedule.ts`, `InternalAssessment.ts`, `Assignment.ts` |
| M09 Attendance | `models/academic-ops/AttendanceSession.ts`, `AttendanceRecord.ts`, `AttendanceSummary.ts` |
| M12.2 Communication | `models/communication/Announcement.ts`, `Circular.ts`, `Notification.ts` (plain CRUD, no delivery). Superseded by the Juvi notice entity in sub-project 2. |
| M12.6 Audit | `shared/audit.ts` `createAuditLog()` and the `AuditLog` model |
| M13 Platform Admin | `modules/platform`, `shared/rbac/*`, `models/College.ts` |
| "Notice, NoticeAcknowledgement exist (partial)" | `models/juvi/JuviNoticeCard.ts`, `AckRecord.ts`. Unrouted, student-only, no seen state, deadline or audience snapshot. Replaced, not extended, in sub-project 2. |
| "Document has storageKey only" | No generic Document model exists. `FacultyDocument` and `Person.photo` hold S3 keys; `shared/s3/s3-client.ts` provides put and presigned GET. |
| W01 / W05 / W10 | `shared/workflow/definitions/W01.ts` and handlers in `modules/admissions/workflow.handlers.ts`; HR and exit flows in `modules/hr`, `modules/people` |

Known defect the app must not inherit: `shared/rbac/scope-resolver.ts` never
resolves a student id for `role: 'student'`, and `shared/rbac/apply-scope.ts:51`
writes `authScope.personId` into whatever `selfField` the caller names, so
`selfField: 'studentId'` filters `Student._id` fields by a `Person._id`.
Student self-scoped ERP reads return nothing. §13 fixes it.

## 2. Release 1 roadmap

Seven sub-projects, each its own spec, plan and implementation. Order is by
dependency, not importance: notices are the heart of R1 but need accounts and
channels first.

| # | Sub-project | Delivers | PRD refs | Depends on |
|---|---|---|---|---|
| 1 | **Foundation** (this doc) | Institution lookup, sign-in, sessions, provisioning, credential export, channel templates, official channels, reconciled membership, Flutter shell with S01, S02 steps 1–3, S06, S07 header, S12, S14, Today/Teaching shells, admin provisioning + settings | ACC-01..06, PRV-01..08, SPC-01..07, PRF-01, PRF-03 (part), PRF-04, ADM-03 (part), ADM-05, ADM-07 | — |
| 2 | Notices & acknowledgement | Notice entity with audience snapshot, ack rules, priority, attachments; notice cards with seen/ack/dismiss/late; S04, S05, attention stack, S11 Reach; ERP publish flow (ADM-04); S02 step 4; durable outbox + dispatcher | NTC-01..09, RCH-01..02, HOME-02 (ack items), ADM-04, ADM-06 (part) | 1 |
| 3 | Notifications | FCM push, three tiers, quiet hours, mute semantics, grouping, delivery tracking, confidential payloads, permission-denied card, Crashlytics + analytics sink | NTF-01..05, NFR-05, NFR-11 | 1, 2 |
| 4 | Today & Teaching | S03 timeline + glance row, S10 teaching home + post-class prompt, class exceptions (cancel/reschedule) in ERP, attendance threshold setting, attendance and dues detail in S12 | HOME-01..06, PRF-02 | 1, 2 |
| 5 | Posts & threads | S07 body, S08, S09; posts, replies, reactions, pins, edit window, drafts, offline queue, attachment uploads | CNT-01..08, SPC-04 posting matrix, BQ-Juvi-06 | 1, 3 |
| 6 | Admin configuration | Template editing with preview, notification policy, audit views, remaining ADM screens | ADM-01, ADM-02, ADM-06 | 1, 2, 3 |
| 7 | Search, analytics, hardening | S13, Section 11 metrics feed to M12 dashboard, accessibility audit, performance and data-size passes, iOS parity | RCH-03, NFR-02..04, NFR-09..10 | all |

Foundation is the largest of the seven. Its implementation plan is expected
to run in three phases that each leave `main` deployable: backend core
(models, auth, provisioning, reconcile, mobile API), admin console, then the
Flutter shell against the live API.

## 3. Decisions locked in review

- **Mobile stack: Flutter**, co-located at `mobile/` in this repo, excluded
  from npm workspaces. Riverpod with code generation, go_router, dio, freezed +
  json_serializable for app state, drift on SQLCipher, flutter_secure_storage,
  firebase_messaging (sub-project 3).
- **Backend: new module `backend/src/modules/juvi-app/`**, mounted at
  `/api/juvi-app/v1` (mobile) and `/api/juvi-app/admin` (ERP-authenticated).
  Models in `models/juvi/`. The existing `modules/juvi` AI module is untouched.
- **Sessions are per-device with server-side revocation**, not the ERP's
  7-day JWT.
- **Membership by reconciliation, not events.** The durable outbox and
  dispatcher arrive in sub-project 2 with their first real consumer.
- **API contract is generated from Zod into OpenAPI**, committed, and the Dart
  client is generated from it. CI fails on drift.
- **PRD open decisions D1–D6:** the PRD's stated defaults are adopted. D3
  (class-coordinator faculty may post in batch channels) and D4 (College
  channel announcement-only; replies allowed elsewhere) affect this spec.

## 4. Goals

- A provisioned student or faculty member installs the app, signs in with
  institution code + roll number or email or employee code + temporary
  password, sets a real password, and lands on Today or Teaching in under a
  minute.
- Onboarding reveals who the app already knows they are and which spaces they
  belong to, with zero typed input beyond the optional photo.
- Spaces reflects ERP registrations within five minutes of a change, with no
  user action and no ERP write-path changes.
- An admin bulk-provisions a 1,500-person college in under 15 minutes and
  exports credentials per section.
- Sessions survive restarts and reboots; sign-out-elsewhere, password change
  and deactivation take effect on the next request.
- Every screen in scope handles loading, populated, empty, error and offline.

## 5. Non-goals (this sub-project)

- Notices, acknowledgement, attention stack, Reach, onboarding step 4.
- Posts, replies, reactions, unread counts, latest-post previews.
- Push notifications, real-time delivery, quiet-hours enforcement.
- Today timeline content, glance row values, attendance and dues detail.
- Search, template editing, notification policy, audit views.
- The analytics sink and crash reporting (interfaces exist; sinks are no-op).
- iOS store signing. iOS builds compile; distribution is sub-project 7.
- Parent, alumni or DM access of any kind. Locked out by the PRD.

## 6. User stories and acceptance criteria

Each AC is testable. IDs map to PRD requirement IDs where one exists.

### US-1 Sign in (S01) — ACC-01, ACC-02, ACC-05

As a provisioned user I sign in with my institution code, identifier and
password, and am forced to set a real password on first use.

1. Entering a valid institution code shows the college name and mark before
   any credentials are typed; an unknown code shows "We couldn't find that
   college code" with no distinction between unknown and disabled.
2. Roll number, employee code and email each resolve to the same User; wrong
   identifier and wrong password return one identical 401 body.
3. A user with `mustChangePassword` cannot reach any screen but set-password;
   after setting one (≥ 8 chars, no forced character classes) the temporary
   password no longer works.
4. Five failures within ten minutes for one college+identifier return 429
   with `retryAfterSeconds`; the sixth attempt with the correct password also
   waits; there is no permanent lock.
5. Institution code is prefilled on second launch.
6. A deactivated account with the correct password receives
   `ACCOUNT_DEACTIVATED`, not the generic error; with a wrong password it
   receives the generic error.

### US-2 Stay signed in (S14) — ACC-03, ACC-04

1. A session survives app restart and phone reboot.
2. "Sign out other devices" causes those devices' next request to return
   `SESSION_INVALIDATED`; measured latency ≤ 60 s including the Redis cache.
3. Password change revokes every other session and keeps the current one.
4. Presenting a refresh token that has already been rotated revokes the
   session it belonged to.
5. Going offline never signs the user out; cached Me and Spaces remain
   readable with an "As of HH:MM" line.

### US-3 Onboarding (S02) — PRV-04, PRV-05

1. Steps: identity confirmation, your spaces, notifications and quiet hours,
   optional photo. No typed input other than the photo.
2. The server owns the ordered step list; `onboardingComplete` is set only
   after the last step. Abandoning at step N resumes at step N on next launch.
3. Every channel shown in step 2 exists and has a membership row before step 3
   renders (the account reconcile runs before step 2 is served).
4. A lateral-entry student (`Student.studyYearAtAdmission > 1`) sees the
   lateral-entry copy in step 2 and, because membership is derived from actual
   registrations, is not in first-year course channels.
5. Faculty see courses taught and department in step 2.

### US-4 Spaces (S06, S07 header) — SPC-01..07

1. Student groups render in fixed order: College, My Department, My Batch, My
   Courses, Hostel (S5 only). Faculty: My Courses, My Department, College.
2. Course channels are ordered by next scheduled class and show "Next: Tue
   10:00" computed from published timetable slots.
3. Pull-to-refresh after an ERP enrollment add or drop shows or hides the
   course channel with no other user action.
4. Long-press mutes or unmutes; mute persists across devices.
5. Archived channels collapse into an Archived group at the bottom.
6. No create, join, leave, invite or discover control exists; the API returns
   404 for any such path.
7. A user with no course registrations sees My Courses with an explanatory
   line, not an empty group.
8. `GET /channels/:id` shows name, member count, About with purpose, who can
   post, and the linked ERP object; a non-member gets 404, not 403.

### US-5 Me (S12) — PRF-01, PRF-03 (part), PRF-04

1. Identity card fields equal the ERP Person, Student or Faculty record.
2. Photo change crops and compresses on device; upload ≤ 5 MB; the new photo
   appears on the identity card within one refresh.
3. Quiet hours, tier toggles and language persist server-side and appear on a
   second device after sign-in. Urgent cannot be disabled in the UI or by the
   API.
4. Devices list shows name, platform, last active and marks the current one.
5. About shows app version, support contact and the data-residency note.

### US-6 Bulk provisioning (admin) — PRV-01, PRV-06, PRV-07, PRV-08, ADM-05

1. A run over 1,500 active students and faculty completes in under 15 minutes
   on the reference server and produces one account per person.
2. Re-running the same filter creates nothing new and reports skipped counts.
3. Credentials CSV per section is downloadable for seven days; afterwards the
   endpoint returns 410 and the console offers reset.
4. Every status transition appears in `AuditLog` with source and actor.
5. Deactivating an account revokes all sessions, removes memberships, keeps
   `JuviAccount` and its transitions, and the next app request returns
   `ACCOUNT_DEACTIVATED` and clears the local cache.
6. W01 `provision_m12` and `people.createFaculty` produce a `JuviAccount` in
   onboarding state when the college has Juvi enabled.

### US-7 Institution settings and pause (admin) — ADM-03 (part), ADM-07

1. Accent colour, support contact, default quiet hours and minimum app version
   save and are visible in the app on next config fetch without an app update.
2. Pausing with a message causes every mobile request to return 503
   `INSTITUTION_PAUSED` with that message within five minutes; the app shows
   the full-screen paused state; resuming clears it.
3. A build below the minimum version receives 426 `UPDATE_REQUIRED` and shows
   the store link; nothing else about the build is inspected.

### US-8 Tenancy and scope — NFR-06, NFR-07

1. An account in college A cannot list, read or mute a college B channel, even
   with a valid id; the response is 404.
2. All mobile reads are scoped by `accountId` or `collegeId` server-side; no
   endpoint accepts a foreign `studentId` or `personId` parameter.
3. A student user's ERP self-scoped read (`selfField: 'studentId'`) returns
   that student's rows, not an empty set.

## 7. Data model

All new models live in `backend/src/models/juvi/` and are exported from
`models/index.ts`. Every one has `collegeId: ObjectId, required, indexed`.

### JuviAccount

| Field | Type | Notes |
|---|---|---|
| personId | ObjectId → Person | unique with collegeId |
| userId | ObjectId → User | |
| kind | `'student' \| 'faculty' \| 'staff'` | |
| studentId / facultyId / staffId | ObjectId, optional | denormalised for joins |
| status | `'onboarding' \| 'active' \| 'exiting' \| 'deactivated'` | `'alumni'` reserved in the enum, never set in R1 |
| onboardingStep | number | index of the next step; see §10 |
| onboardingCompletedAt | Date, optional | |
| settings.quietHours | `{ start: 'HH:MM', end: 'HH:MM' }` | default from College.juvi |
| settings.tiers | `{ important: boolean, routine: boolean }` | Urgent has no toggle |
| settings.language | `'en'` | enum grows later |
| lastSeenAt | Date | updated at most once per minute per request |
| lastReconciledAt | Date | |
| transitions[] | `{ from, to, source: 'bulk' \| 'workflow' \| 'admin' \| 'system', by, at }` | append-only |
| provisionedAt, provisionedBy | | |

Indexes: `(collegeId, personId)` unique; `(collegeId, status, kind)`;
`(collegeId, studentId)`; `(collegeId, facultyId)`.

### MobileSession

| Field | Type | Notes |
|---|---|---|
| accountId, userId | ObjectId | |
| deviceId | string | client-generated, stable per install |
| deviceName, platform (`'android' \| 'ios'`), appVersion, osVersion | string | |
| refreshTokenHash | string | SHA-256 of the opaque token; unique |
| refreshExpiresAt | Date | 90 days from issue, refreshed on rotation |
| createdAt, lastActiveAt | Date | |
| revokedAt, revokedReason | Date, `'sign_out' \| 'signed_out_elsewhere' \| 'password_changed' \| 'admin' \| 'deactivated' \| 'token_reuse' \| 'expired'` | |
| pushToken | string, optional | populated in sub-project 3 |

Indexes: `refreshTokenHash` unique; `(collegeId, accountId)`;
`(accountId, deviceId)`.

### ChannelTemplate

| Field | Type | Notes |
|---|---|---|
| code | `'college' \| 'department' \| 'batch' \| 'course' \| 'hostel'` | unique with collegeId |
| name | string | admin-facing label |
| namePattern | string | tokens in §9 |
| aboutPattern | string | |
| scopeType | `'college' \| 'department' \| 'batch' \| 'course_offering' \| 'hostel_block'` | |
| membershipStrategy | same enum as `code` | selects a code strategy in §9 |
| postingRule | `'publishers_only'` | only value in R1 |
| replyRule | `'allowed' \| 'announcement_only'` | College defaults to announcement_only (D4) |
| defaultPriority | `'routine' \| 'important'` | |
| archiveRule | `'on_semester_end' \| 'never'` | course = on_semester_end |
| isEnabled | boolean | |

### Channel

| Field | Type | Notes |
|---|---|---|
| type | `'official' \| 'custom' \| 'dm'` | only `official` creatable (SPC-01) |
| templateCode | ChannelTemplate.code | |
| scopeType | as ChannelTemplate.scopeType | |
| scopeId | ObjectId, null for college | |
| semesterId | ObjectId, optional | set for course channels |
| name, about | string | rendered from patterns at creation |
| status | `'active' \| 'archived'` | |
| archivedAt | Date, optional | |
| postingRule, replyRule, defaultPriority | copied from template at creation | template edits affect future channels only (SPC-02) |
| memberCount | number | maintained by reconcile |
| createdVia | `'reconcile' \| 'admin'` | |

Indexes: `(collegeId, scopeType, scopeId)` unique; `(collegeId, status)`.

### ChannelMembership

| Field | Type | Notes |
|---|---|---|
| channelId, accountId | ObjectId | unique pair |
| role | `'member' \| 'publisher'` | |
| mutedAt | Date, optional | |
| joinedVia | `'rule' \| 'admin'` | |
| joinedAt | Date | |
| lastReadAt | Date, optional | used from sub-project 5 |

Indexes: `(channelId, accountId)` unique; `(collegeId, accountId)`.

### JuviProvisioningRun

| Field | Type | Notes |
|---|---|---|
| filter | `{ kinds[], programmeIds?, batchIds?, departmentIds? }` | |
| options | `{ resetExistingPasswords: boolean }` | default true |
| status | `'queued' \| 'running' \| 'completed' \| 'partial' \| 'failed'` | |
| counts | `{ scanned, created, existingLinked, skipped, failed }` | |
| errors[] | `{ personId, reason }` | capped at 500 |
| performedBy, startedAt, finishedAt | | |
| credentialsExpireAt | Date | startedAt + 7 days |

### JuviProvisionedCredential

| Field | Type | Notes |
|---|---|---|
| runId | ObjectId, optional | null for workflow- and console-sourced credentials |
| accountId | ObjectId | |
| source | `'bulk' \| 'workflow' \| 'admin'` | |
| identifier | string | roll number or employee code shown in the CSV |
| displayName | string | |
| sectionId, batchId, departmentId | ObjectId, optional | CSV grouping |
| ciphertext, iv, authTag | Buffer | AES-256-GCM under `JUVI_CREDENTIAL_KEY` |
| expiresAt | Date | TTL index; Mongo deletes the row |

### Changes to existing models

- **User** (`models/User.ts`): add `mustChangePassword: boolean` (default
  false) and `passwordChangedAt?: Date`. No other change; the unique
  `(collegeId, email)` index stays.
- **College** (`models/College.ts`): add typed sub-document `juvi`:

  ```ts
  juvi: {
    enabled: boolean;                 // default false
    paused: boolean; pausedMessage?: string;
    accentColor?: string;             // '#RRGGBB'
    supportContact?: { name: string; phone?: string; email?: string };
    quietHoursDefault: { start: string; end: string }; // '22:00', '07:00'
    minAppVersion?: { android?: string; ios?: string };
    timezone: string;                 // default 'Asia/Kolkata'
    featureFlags: { languageRoadmap: boolean };
  }
  ```

- **Person.photo** is reused unchanged for the profile photo.

No destructive migration. All new fields have defaults; colleges with
`juvi.enabled: false` are unaffected.

## 8. Authentication and sessions

### Institution lookup

`GET /api/juvi-app/v1/institutions/:code`, public, `express-rate-limit`
20/min per IP. Matches `College.code` (uppercase) with `status: 'active'` and
`juvi.enabled: true`. Returns `{ collegeId, name, logoUrl, accentColor,
paused, pausedMessage, minAppVersion }`. Any other case returns 404
`NOT_FOUND` with the same body, so codes cannot be enumerated.

### Sign-in

`POST /auth/sign-in`

```json
{ "collegeId": "…", "identifier": "21CS1042", "password": "river-lamp-482",
  "device": { "id": "uuid", "name": "Pixel 7a", "platform": "android",
              "appVersion": "1.0.0", "osVersion": "14" } }
```

Identifier resolution, in order, all scoped by `collegeId`:

1. Contains `@` → `User.findOne({ collegeId, email })`.
2. `Student.findOne({ collegeId, rollNumber })` → `personId` → `User`.
3. `Faculty.findOne({ collegeId, employeeCode })` → `personId` → `User`.
4. `Staff.findOne({ collegeId, employeeCode })` → `personId` → `User`.

Then `JuviAccount.findOne({ collegeId, userId })`. Decision table:

| Condition | Response |
|---|---|
| Cooldown counter ≥ 5 | 429 `COOLDOWN { retryAfterSeconds }` (checked first, before any lookup) |
| No User, or no JuviAccount, or bcrypt mismatch | 401 `INVALID_CREDENTIALS`; bcrypt still runs against a fixed dummy hash when no User is found; counter incremented; server log line with reason |
| Password ok, account `deactivated` or User `isActive: false` | 403 `ACCOUNT_DEACTIVATED { supportContact }` |
| Password ok | 200 below; counter cleared |

```json
{ "accessToken": "…", "accessExpiresIn": 900, "refreshToken": "…",
  "account": { "id": "…", "kind": "student", "status": "onboarding",
               "onboardingStep": 0, "onboardingComplete": false,
               "mustChangePassword": true } }
```

Success replaces any existing session for `(accountId, device.id)`, revoking
the old one with reason `sign_out`.

Cooldown key: `juvi:login-fail:{collegeId}:{sha256(identifier.lower())}`,
`INCR` + `EXPIRE 600`. Never keyed by IP alone, never persisted on User.

### Tokens

- **Access token**: JWT HS256 with `JWT_SECRET`, 15-minute TTL. Claims:
  `{ sub: userId, sid: sessionId, aid: accountId, cid: collegeId, role, kind,
  typ: 'mobile', iat, exp }`. The ERP's `authenticate` middleware rejects
  `typ: 'mobile'` tokens; the mobile middleware rejects tokens without it.
- **Refresh token**: 32 random bytes, base64url. Stored as SHA-256 in
  `MobileSession.refreshTokenHash`. 90-day TTL, extended on each rotation.
- `POST /auth/refresh { refreshToken, deviceId }` rotates: new access + new
  refresh, old hash replaced atomically (`findOneAndUpdate` on the old hash).
  A miss on the hash where the session exists and is active means an old token
  was replayed: the session is revoked with `token_reuse` and 401
  `SESSION_INVALIDATED { reason: 'token_reuse' }` is returned.

### Mobile middleware (`modules/juvi-app/middleware/authenticate-mobile.ts`)

1. Parse Bearer; verify JWT; require `typ === 'mobile'`. Expired → 401
   `TOKEN_EXPIRED`.
2. Session check via Redis `juvi:sess:{sid}`:
   - `revoked:{reason}` → 401 `SESSION_INVALIDATED { reason }`.
   - `active` → continue.
   - miss → load `MobileSession`; if `revokedAt` set, write `revoked:{reason}`
     with TTL 900 s and reject; else write `active` with TTL 60 s.
   Every revocation path writes `revoked:{reason}` **synchronously** before
   returning, so the worst-case latency is one request, not the cache TTL.
3. Load `JuviAccount` (cached 60 s in Redis by id). `deactivated` → 403
   `ACCOUNT_DEACTIVATED`.
4. Load College.juvi (cached 60 s). `paused` → 503 `INSTITUTION_PAUSED
   { message }`. Compare `X-Juvi-App-Version` against `minAppVersion[platform]`
   with semver → 426 `UPDATE_REQUIRED { minVersion, storeUrl }`.
5. Set `req.mobile = { userId, accountId, sessionId, collegeId, role, kind,
   studentId?, facultyId? }`; bump `lastActiveAt` and `lastSeenAt` at most
   once per minute.

Mobile routes never call `authorize()`. Authorization is per-resource in the
service layer: membership row for channels, own account for Me.

### Other auth routes

- `POST /auth/change-password { currentPassword, newPassword }` — requires the
  current (or temporary) password; `newPassword.length ≥ 8`, no other rules;
  sets hash, clears `mustChangePassword`, sets `passwordChangedAt`, revokes all
  sessions except `sid` with reason `password_changed`.
- `POST /auth/sign-out` — revokes `sid` with `sign_out`; idempotent.
- `GET /me/devices` → `[{ sessionId, deviceName, platform, lastActiveAt,
  isCurrent }]`; `DELETE /me/devices/:sessionId`; `POST
  /me/devices/revoke-others` — reason `signed_out_elsewhere`.
- No forgot-password route. S01 shows the "institution resets it" message.

### Deactivation path

`deactivateAccount(collegeId, accountId, source, by)`: status →
`deactivated` (transition appended), `User.isActive = false`, all sessions
revoked with `deactivated`, all `ChannelMembership` rows deleted, audit entry.
The app, on receiving `ACCOUNT_DEACTIVATED`, wipes the drift database and
secure storage and shows the S14 deactivated screen with the support contact
from the response body.

## 9. Provisioning and channel reconciliation

### `provisionPerson(collegeId, personId, kind, opts, source, performedBy)`

Idempotent. Steps:

1. Resolve `Student`/`Faculty`/`Staff` by `personId` for `kind`; fail if
   missing.
2. Find `User` by `personId`. If none, create one: `email = Person.email` or
   the placeholder `{identifier}@no-email.{collegeCode}.juvion.invalid`
   (lowercased; `.invalid` is reserved and cannot receive mail); `role` and
   `personaType` by kind: student → `student`/`L-STU`; faculty →
   `hod`/`F-HOD` if `Department.hodId` equals the Faculty id, else
   `faculty`/`F-FAC`; staff → `staff` with the Staff record's existing persona
   or `ST-REG` if none.
3. If `JuviAccount` exists, return it (no password change). Otherwise:
   - If the User was just created **or** `opts.resetPassword` (default true
     for every caller; bulk runs expose it as the "Reset existing passwords"
     toggle): generate a temporary password, store its bcrypt hash, set
     `mustChangePassword: true`, and write a `JuviProvisionedCredential`
     (AES-256-GCM, seven-day TTL) so the responsible office can retrieve it
     from the console. Bulk runs link the row to their `runId`; workflow and
     console callers leave `runId` null.
   - Create `JuviAccount` `{ status: 'onboarding', onboardingStep: 0,
     settings from College.juvi defaults, transitions: [{ from: null, to:
     'onboarding', source, by }] }`.
   - `createAuditLog({ entityType: 'JuviAccount', action: 'create', … })`.
4. Return `{ account, credentialId? }`. The plaintext is never returned to a
   caller; the console reveals it from the encrypted row while it lives.

Temporary password format: two words from a fixed 2,048-word list of short,
unambiguous English words plus a three-digit number, hyphen-separated,
e.g. `river-lamp-482`. Length ≥ 12, ~4.3 × 10⁹ combinations, readable on
paper, satisfies the 8-character minimum.

### Callers

- **Bulk run**: `POST /admin/provisioning/runs` enqueues a BullMQ job on queue
  `juvi_provisioning` (added to `QUEUE_NAMES`, registered in `server.ts` next
  to the existing two). The worker iterates matching active Students and
  Faculty (and Staff when requested) in batches of 100, calls
  `provisionPerson` with the run's `runId` and `resetPassword` option. Counts
  and errors are written to the run every batch. Ten failures in a row abort the run as `failed`; any
  failures at all end it as `partial`.
- **W01** `provision_m12` (`modules/admissions/workflow.handlers.ts:1479`)
  calls `provisionPerson(kind: 'student', source: 'workflow')` after its own
  User creation when `College.juvi.enabled`. The Juvi temporary password
  replaces the step's current hardcoded default, and the step result carries
  the `credentialId` instead of a plaintext password.
- **Faculty creation** `modules/people/service.ts:687 createFaculty` calls
  `provisionPerson(kind: 'faculty', source: 'workflow')` when enabled.
  Staff are provisioned only through bulk runs or the console, since most
  staff never need the app. HR's `createEmployee` creates an `Employee`, not a
  Faculty or Staff, so it is not a hook.
- **Deprovisioning**: W01 `cancel_m12`, the W10 exit flow's final step, HR
  separation completion, and the admin console call `deactivateAccount`.

### Credential export

`GET /admin/provisioning/runs/:id/credentials.csv?sectionId=…|batchId=…|departmentId=…`
decrypts matching `JuviProvisionedCredential` rows and streams
`identifier,name,section,temporaryPassword,institutionCode`. After
`credentialsExpireAt` the rows are gone (TTL index) and the endpoint returns
410 `GONE`. A single account's live credential, including workflow-sourced
ones, is revealed from the console's accounts table through
`POST /admin/accounts/:id/reveal-credential`, which is audited. `JUVI_CREDENTIAL_KEY` is a 32-byte base64 value; in production its
absence fails startup with the same guard style as `PAYMENT_WEBHOOK_SECRET`
(`app.ts:55`). In development a fixed dev key is used with a warning.

### Templates

Seeded by `shared/seed/channel-templates.ts` `seedChannelTemplates(collegeId)`
(idempotent upsert on `(collegeId, code)`), called from `seed.ts` and lazily
by the first reconcile for a college that has none.

| code | scopeType | namePattern | replyRule | defaultPriority | archiveRule |
|---|---|---|---|---|---|
| college | college | `{{college.name}}` | announcement_only | important | never |
| department | department | `{{department.name}}` | allowed | important | never |
| batch | batch | `{{batch.code}} Batch` | allowed | routine | never |
| course | course_offering | `{{course.code}} {{course.name}} · {{section.name}}` | allowed | routine | on_semester_end |
| hostel | hostel_block | `{{block.name}} Hostel` | allowed | routine | never |

### Membership strategies (code, keyed by template code)

Eligible accounts are those with `status ∈ {onboarding, active}`.

| Strategy | Scope objects | Members | Publishers |
|---|---|---|---|
| college | the college | every eligible account except faculty with `Faculty.contractType ∈ {adjunct, visiting}` (F4) | `User.role ∈ {admin, principal}` or `kind = staff` |
| department | every `Department` | students whose `Student.branchId` → `Branch.departmentId` = D; faculty with `Faculty.departmentId` = D and `contractType ∉ {adjunct, visiting}` | `Department.hodId` → Faculty → account; principal; staff with `Staff.personaCode` = `ST-REG` |
| batch | every `Batch` with ≥ 1 active student | students with `Student.batchId` = B | staff whose `Staff.personaCode` starts with `ST-ADM` or equals `ST-REG`; `Section{batchId: B}.classAdvisorId` (D3); HODs of `Section.branchId → Branch.departmentId` |
| course | every `CourseOffering` with `status: 'active'` whose `Semester.status` is `'active'` | `Enrollment{courseOfferingId, status: 'enrolled'}.studentId`; if the offering has **zero** enrollments, `Section{_id: sectionId}.studentIds` | `facultyId` and `coFacultyIds` |
| hostel | every `HostelBlock{isActive}` | students with `HostelAllocation{status: 'active'}` → `HostelRoom.blockId` = H | `wardenId` (Person) and `chiefWardenId` (Staff) → account |

Adjunct and visiting faculty (PRD F4) are identified by
`Faculty.contractType` and are members of their course channels only,
matching Appendix D.

### Reconcile algorithm (`modules/juvi-app/spaces/reconcile-service.ts`)

`reconcileCollege(collegeId)`:

1. Acquire Redis lock `juvi:reconcile-lock:{cid}` (TTL 240 s); skip if held.
2. Ensure templates exist.
3. For each enabled template, enumerate scope objects; upsert a `Channel` per
   `(scopeType, scopeId)`; render `name`/`about` only at creation. Archive
   course channels whose `Semester.status` is `'completed'`; un-archive if a
   semester returns to `'active'`.
4. For each active channel, compute `expected: Map<accountId, role>` via the
   strategy; load `existing` memberships; insert missing, delete extra, update
   role changes; set `memberCount`.
5. Write `juvi:reconcile-last:{cid}` = `{ at, durationMs, channels,
   memberships: { added, removed, roleChanged }, errors }`.

`reconcileAccount(accountId)`: compute the account's expected memberships by
inverse queries (its Section, Batch, Department via Branch, Enrollments,
HostelAllocation; for faculty, its offerings and department), diff against
existing rows, apply. Runs on sign-in and when `GET /spaces` is called with
`lastReconciledAt` older than 60 s. Also sets `lastReconciledAt`.

Scheduling: a BullMQ repeatable job `juvi_reconcile` every
`JUVI_RECONCILE_INTERVAL_MINUTES` (default 5) enumerates colleges with
`juvi.enabled` and runs `reconcileCollege` for each. Registered in
`server.ts`. `POST /admin/reconcile` triggers one immediately.

Membership removal deletes the row. Any future content stays attributed to its
author by `accountId`.

### Next-class computation

For a course channel, `nextClassAt` = the earliest future occurrence, in
`College.juvi.timezone`, of any `TimetableSlot{courseOfferingId, slotType ≠
'free'}` whose `Timetable.status = 'published'`, evaluated over the next seven
days from `(day, startTime)`. No date exceptions in Foundation; sub-project 4
adds cancellations and reschedules.

## 10. Mobile API v1

Prefix `/api/juvi-app/v1`. Router in `modules/juvi-app/routes.ts`, mounted in
`app.ts` before `apiRouter`. Sub-routers per PRD sub-domain:
`accounts/` (auth, me, onboarding), `spaces/` (spaces, channels),
`config/`. Every route: `validate(zodSchema)` then controller; mobile
middleware on everything except `/institutions/:code`, `/auth/sign-in` and
`/auth/refresh`.

| Method + path | Purpose | Notes |
|---|---|---|
| `GET /institutions/:code` | S01 identity | public, rate-limited |
| `POST /auth/sign-in` | §8 | |
| `POST /auth/refresh` | §8 | |
| `POST /auth/sign-out` | §8 | |
| `POST /auth/change-password` | §8 | |
| `GET /me` | identity card + account state + settings + institution snapshot | drives routing |
| `GET /me/settings`, `PATCH /me/settings` | quiet hours, tiers, language | `tiers.urgent` not accepted |
| `POST /me/photo` | multipart, ≤ 5 MB, jpeg/png/webp | reuses `photo-service.uploadEntityPhoto` for the account's own Person; returns thumb + original presigned URLs |
| `POST /me/onboarding/advance { step }` | advances if `step === onboardingStep`; completes after last | server step list: `['identity','spaces','notifications']` |
| `GET /me/devices`, `DELETE /me/devices/:id`, `POST /me/devices/revoke-others` | §8 | |
| `GET /config` | accent, logo, support contact, quiet-hours default, timezone, feature flags, min version, onboarding steps | fetched on start and daily |
| `GET /spaces` | grouped list | inline `reconcileAccount` if stale |
| `GET /channels/:id` | header + About | 404 unless member |
| `PUT /channels/:id/mute`, `DELETE /channels/:id/mute` | | |
| `POST /channels/:id/read` | sets `lastReadAt` | |

`GET /me` response shape:

```json
{ "account": { "id", "kind", "status", "onboardingStep", "onboardingSteps": ["identity","spaces","notifications"],
               "onboardingComplete", "mustChangePassword" },
  "person":  { "firstName", "lastName", "photoUrl" },
  "student": { "rollNumber", "programme", "branch", "batch", "section", "department", "hostel", "isLateralEntry" },
  "faculty": { "employeeCode", "designation", "department", "isHod" },
  "settings": { "quietHours": { "start", "end" }, "tiers": { "important", "routine" }, "language" },
  "institution": { "name", "code", "logoUrl", "accentColor", "supportContact" },
  "asOf": "2026-09-23T08:14:00+05:30" }
```

`GET /spaces` response shape:

```json
{ "groups": [
    { "key": "college", "title": "College", "channels": [ { "id", "name", "about", "scopeType", "muted", "memberCount", "archived": false } ] },
    { "key": "department", "title": "My Department", "channels": [ … ] },
    { "key": "batch", "title": "My Batch", "channels": [ … ] },
    { "key": "courses", "title": "My Courses", "emptyHint": "Your course spaces appear once registrations are in.", "channels": [ { …, "nextClassAt", "nextClassLabel": "Next: Tue 10:00" } ] },
    { "key": "hostel", "title": "Hostel", "channels": [ … ] },
    { "key": "archived", "title": "Archived", "channels": [ … ] } ],
  "asOf": "…" }
```

Group order is by kind; groups with no channels are omitted except `courses`,
which carries `emptyHint`, and `hostel`, which is omitted unless the student
has an allocation.

### Headers

`Authorization: Bearer`, `X-Juvi-App-Version`, `X-Juvi-Platform`,
`X-Juvi-Device-Id`. No `x-college-id`; the college is in the token.

### Error envelope

`class MobileApiError extends AppError { constructor(statusCode, code, message, detail?) }`.
The mobile router installs its own error handler that renders:

```json
{ "error": { "code": "COOLDOWN", "message": "Too many attempts. Try again in 9 minutes.",
             "retryAfterSeconds": 540 } }
```

| Code | Status | App reaction |
|---|---|---|
| VALIDATION_FAILED | 400 | inline field errors |
| INVALID_CREDENTIALS | 401 | generic message on S01 |
| TOKEN_EXPIRED | 401 | refresh once, retry |
| SESSION_INVALIDATED | 401 | wipe cache, S01 with reason line |
| ACCOUNT_DEACTIVATED | 403 | wipe cache, S14 deactivated |
| FORBIDDEN | 403 | toast |
| NOT_FOUND | 404 | screen-local empty/error |
| GONE | 410 | admin only |
| UPDATE_REQUIRED | 426 | S14 update with store link |
| COOLDOWN | 429 | S01 cool-down message |
| INSTITUTION_PAUSED | 503 | S14 paused with message |
| INTERNAL | 500 | retry affordance |

Unknown errors are logged with request id and returned as `INTERNAL` with no
detail. Validation errors never echo submitted values.

### Contract generation

- Request and response schemas are Zod in `modules/juvi-app/**/schemas.ts`,
  registered with `@asteasolutions/zod-to-openapi`'s `OpenAPIRegistry`.
  Controllers parse responses through the response schema in test mode so a
  handler cannot return a shape the contract doesn't declare.
- `npm run openapi:mobile -w backend` runs
  `backend/src/modules/juvi-app/openapi/generate.ts` and writes
  `mobile/api/openapi.json` (OpenAPI 3.1, deterministic key order).
- CI job `contract` runs the script and `git diff --exit-code mobile/api`.
- `mobile/packages/juvi_api` is generated by `openapi-generator-cli` (npm
  wrapper, Java in CI via `setup-java`) with generator `dart-dio`,
  `serializationLibrary=json_serializable`. Generated code is committed and
  `mobile/tool/gen_api.sh` regenerates it. Hand edits under the package are
  caught by a CI diff check after regeneration.

### Versioning

Additive changes stay on v1. Breaking changes open `/v2` beside `/v1`. The
`minAppVersion` gate is the escape hatch, used only when a client version must
be retired.

## 11. Flutter app

### Layout

```
mobile/
  pubspec.yaml                    package: juvi
  api/openapi.json
  packages/juvi_api/              generated dio client + models
  lib/
    main.dart
    app/        bootstrap.dart, router.dart, theme/, l10n/ (ARB)
    core/       http/ (dio, interceptors), session/, storage/ (secure, drift schema, kv cache, pending actions),
                connectivity/, config/, analytics/, errors/
    features/
      auth/        sign_in_screen, set_password_screen, institution_code_field
      onboarding/  onboarding_screen (steps: identity, spaces, notifications, photo)
      home/        today_shell_screen, teaching_shell_screen
      spaces/      spaces_screen, channel_screen (header + About), channel_row
      me/          me_screen, devices_screen, settings_screen, change_password_screen, photo_picker
      system/      offline_banner, deactivated_screen, paused_screen, update_required_screen
    shared/     empty_state, skeleton, section_header, identity_card, formatting
  test/         unit + widget + golden
  integration_test/
  tool/gen_api.sh
```

Targets: Android 10 (API 29) and iOS 15. Tablets render but are not tuned.

### Routing

go_router with one `redirect` reading `sessionStateProvider`:

| State | Route |
|---|---|
| no session | `/sign-in` |
| `mustChangePassword` | `/set-password` |
| `!onboardingComplete` | `/onboarding/:step` |
| account deactivated | `/deactivated` |
| institution paused | `/paused` |
| update required | `/update-required` |
| otherwise | `StatefulShellRoute` with tabs `/today` or `/teaching` (by kind), `/spaces`, `/me` |

Child routes: `/spaces/:channelId`, `/me/devices`, `/me/settings`,
`/me/change-password`. The `juvi://` scheme and Android App Links host are
registered now so sub-project 3 deep links need no store resubmission.

### State and data

Riverpod. Each feature has a repository wrapping `juvi_api` and the drift
cache, exposing `AsyncValue`s through generated providers. Repository pattern:
emit cached value if present, fetch, write cache, emit. `asOf` from the
server is stored with each cache entry and shown as "As of 08:14" when the
device is offline or the fetch fails.

Drift schema (Foundation):

- `kv_cache(key TEXT PK, json TEXT, as_of INTEGER)` for `me`, `config`,
  `spaces`, `channel:{id}`.
- `pending_actions(id TEXT PK, type TEXT, payload TEXT, created_at INTEGER,
  attempts INTEGER, last_error TEXT)` for `settings.patch`, `channel.mute`,
  `channel.unmute`, `channel.read`. A `SyncWorker` drains FIFO on connectivity
  regained and on app resume, with exponential backoff and a cap of 10
  attempts before surfacing the failure in Me.

Online-only actions: sign-in, refresh, change password, photo upload, device
revocation. Their buttons disable offline with the reason inline.

### Security on the device

flutter_secure_storage for access token, refresh token, device id and the
SQLCipher key. drift opens the database with `sqlcipher_flutter_libs`. No
identifiers, names or tokens in `debugPrint` in release builds; a lint rule
forbids `print`. Screenshots are not blocked (PRD does not ask for it).

### Look and feel

Material 3. `ColorScheme.fromSeed(seed: institution.accentColor)` with the
accent applied only to primary actions and the College channel row; surfaces
and text stay neutral. Dark theme from the OS, overridable in Me (device
preference). Text theme roles: `noticeTitle`, `publisherLine`, `body`,
`meta`, sized for `textScaleFactor` up to 2.0 without truncating actions.
Skeletons for every list; `EmptyState(illustration, title, hint)` for every
empty section; `OfflineBanner` in the shell. Minimum touch target 44 pt.
ARB strings only; `intl` with `en_IN`.

### Screens and their five states

| Screen | Loading | Populated | Empty | Error | Offline |
|---|---|---|---|---|---|
| S01 sign-in | skeleton for college identity | form | — | generic / cooldown / not-found | "Sign-in needs a connection" |
| Set password | — | form + strength hint | — | inline | disabled with reason |
| S02 onboarding | skeleton per step | 3 steps + photo | step 2 with no courses shows the explanatory line | retry keeps step | steps 1–2 readable from cache; step 3 needs network |
| Today / Teaching shell | header skeleton | header + 3 empty sections | "You're clear", "No classes today", glance placeholders | retry | cached header + "As of" |
| S06 Spaces | row skeletons | grouped rows | My Courses hint | retry | cached + banner |
| S07 header | skeleton | header + About | "Nothing new" body | retry | cached |
| S12 Me | skeleton | card + sections | — | retry | cached; write actions queue or disable |
| Devices | skeleton | list | — | retry | disabled with reason |
| S14 states | full-screen designs | | | | |

### Instrumentation

`Analytics` interface with `ConsoleAnalytics` now. Events: `app.opened`,
`account.signed_in`, `onboarding.step_completed { step }`,
`onboarding.completed`, `settings.changed { key }`, `channel.muted`. Payloads
carry ids and enums, never names or content. Crash reporting hook is a no-op
until Firebase lands in sub-project 3.

### Build

`flutter analyze` with `very_good_analysis` rules, `flutter test`,
`flutter build appbundle` in a new `.github/workflows/mobile.yml`. iOS builds
run without signing to prove compilation.

## 12. Admin portal

Route `/platform/juvi/*` in `admin-portal/src/App.tsx`, lazy page
`pages/platform/JuviAdminPage.tsx` with tabs, matching the folder's naming, services in
`admin-portal/src/services/juvi-app.ts`. Visible only to users passing
`platform:read`; mutations need `platform:create` or `platform:update`.

| Tab | Content |
|---|---|
| Provisioning | filter (kinds, programme, batch, department), "Reset existing passwords" toggle, Run; runs table with status, counts, started/finished; per-run credentials download grouped by section with expiry countdown; accounts table with kind, status, last seen, search, Deactivate, Reset password, Reveal credential while one is live |
| Settings | Enable Juvi, accent colour, support contact, default quiet hours, timezone, min app version per platform, Pause switch with message, last reconcile summary, "Reconcile now" |
| Channels | read-only channels table (name, template, scope, members, status) and templates table |

Backend admin routes, all under `/api/juvi-app/admin`, ERP `authenticate` +
`authorize('platform', …)`:

| Method + path | authorize |
|---|---|
| `POST /provisioning/runs` | create |
| `GET /provisioning/runs`, `GET /provisioning/runs/:id` | read |
| `GET /provisioning/runs/:id/credentials.csv` | create (it reveals secrets) |
| `GET /accounts` | read |
| `POST /accounts/:id/deactivate`, `POST /accounts/:id/reset-password` | update |
| `POST /accounts/:id/reveal-credential` | create (it reveals a secret; audited) |
| `GET /settings`, `PUT /settings` | read / update |
| `GET /channels`, `GET /templates` | read |
| `POST /reconcile` | update |

## 13. The self-scope fix

`shared/rbac/scope-resolver.ts`: for `role: 'student'`, look up
`Student.findOne({ personId, collegeId })` and set `scope.studentId`.
`AuthScope` gains `studentId?: string`. `shared/rbac/apply-scope.ts`: when
`opts.selfField === 'studentId'` use `authScope.studentId` (and short-circuit
to an impossible filter if absent); otherwise keep the existing `personId`
behaviour. Unit tests cover both branches. Existing callers are unchanged.

## 14. Failure handling

- **Reconcile**: per-channel `try/catch`; a failing strategy skips that
  channel and increments `errors`; the run continues. Lock TTL prevents
  overlap; a crashed run's lock expires in four minutes. BullMQ: 3 attempts,
  exponential backoff from 30 s.
- **Provisioning run**: per-person `try/catch` with reason recorded;
  `partial` on any failure; `failed` after ten consecutive failures. Safe to
  re-run: idempotent on `(collegeId, personId)`.
- **Sign-in timing**: bcrypt compare always runs (dummy hash when no User).
- **Photo upload**: multer memory storage, `PHOTO_MAX_BYTES`, mime allowlist,
  `sharp` re-encode as today's `photo-service` does.
- **Redis unavailable**: session check falls back to Mongo (slower, still
  correct); cooldown falls back to allow with a warning log; reconcile
  scheduling is skipped with a warning, matching the existing guarded
  registration pattern in `server.ts`.
- **App**: dio interceptor maps every failure to a typed `ApiFailure`; screens
  render the error state with retry and never lose typed input; the sync
  worker never drops a pending action silently.

## 15. Security and tenancy

- Every model carries `collegeId`; every query filters by it; every mobile
  read is additionally scoped by `accountId`. Cross-tenant tests in §16.
- No endpoint accepts a `studentId`, `personId` or `accountId` parameter for
  the caller's own data; the token supplies it.
- Non-members get 404, not 403, for channels.
- Rate limits: 20/min on institution lookup, 10/min on sign-in per IP, plus
  the per-identifier cooldown. Existing global 100/min applies.
- Logs carry `userId`, `sessionId`, `accountId`, request id. Never
  identifiers, names, emails or tokens.
- Credentials at rest: bcrypt for passwords; AES-256-GCM under a dedicated key
  for the seven-day export; SHA-256 for refresh tokens.
- TLS is a deployment concern (nginx already fronts the API).
- Device: secure storage for secrets, SQLCipher for the cache.

## 16. Testing

**Backend unit (vitest, `backend/src/modules/juvi-app/**/__tests__`)**

- identifier resolution across email, roll number, employee code, and
  collisions between Faculty and Staff codes
- temporary-password generator: format, length, uniqueness over 10⁵ draws
- refresh rotation, reuse detection, concurrent refresh
- cooldown counter and TTL
- each membership strategy against fixture graphs (including the zero-
  enrollment fallback and the HOD/class-advisor publisher rules)
- reconcile diff: add, remove, role change, archive/un-archive
- onboarding advance: wrong step, repeat step, completion
- `MobileApiError` → envelope mapping for every code
- OpenAPI generator snapshot
- scope-resolver and apply-scope student branch

**Backend integration (`vitest.e2e.config.ts`, real Mongo + Redis)**

- sign-in → refresh → revoke-others → 401 on the revoked device
- change-password revokes others, keeps current
- bulk run over a seeded college → run `completed`, CSV rows decrypt, TTL set
- deactivate → 403 on next request, memberships gone, audit rows present
- cross-tenant: college A account requesting college B channel → 404;
  college B admin cannot see college A runs

**Contract**: CI job regenerates `mobile/api/openapi.json` and the Dart
package, fails on diff.

**Flutter**

- unit: redirect function table, cache-then-network repository, pending
  actions queue and backoff, `ApiFailure` mapping
- widget: every screen in §11's five states with fake repositories
- golden: identity card, channel row, empty states, S14 screens, light and
  dark, text scale 1.0 and 2.0
- integration_test: sign-in → set-password → onboarding → Today against a
  `dio` mock adapter fed from `openapi.json` examples

**Playwright (e2e workspace)**: as `e2e_super`, enable Juvi, save settings,
run bulk provisioning on the seeded college, download a CSV; zero retries,
no fixed waits, accessible selectors, per the existing suite discipline.

**Seed**: `npm run seed` gains channel templates for the dev college and
`JuviAccount`s for one seeded student and one faculty member with the
documented temporary password `river-lamp-482`, so a developer can sign in to
the app against a local backend immediately.

## 17. Configuration, rollout and operations

New environment variables:

```
JUVI_CREDENTIAL_KEY=                 # 32-byte base64; required in production (startup guard)
JUVI_RECONCILE_INTERVAL_MINUTES=5    # repeatable job interval
```

Registered at startup in `server.ts`: `juvi_provisioning` worker,
`juvi_reconcile` repeatable job. Both guarded like the existing two.

Rollout: everything is inert until an admin sets `College.juvi.enabled`. The
pilot college is enabled, templates seed on first reconcile, bulk provisioning
runs, credentials are exported per section and distributed by class
coordinators (PRD §12). No data migration; new fields default.

Operational visibility: last reconcile summary and last provisioning run on
the Settings tab; both jobs log one summary line per run.

## 18. Verified facts the design relies on

Checked against the code on 2026-09-23:

- `Semester.status` is `'upcoming' | 'active' | 'completed'`. "Current" means
  `'active'`; course channels archive on `'completed'`.
- `Timetable.status` includes `'published'`; `TimetableSlot.day` is a
  lowercase weekday enum and `startTime` is an `'HH:MM'` string.
- `Faculty.contractType` is `'regular' | 'contract' | 'adjunct' | 'visiting'`,
  which identifies PRD F4.
- `Student.studyYearAtAdmission` is the lateral-entry signal (`> 1`).
- `Staff.personaCode` carries the canonical `ST-*` persona used for publisher
  detection.
- `people/service.ts:687 createFaculty` and `:787 createStaff` exist;
  `hr/service.ts:76 createEmployee` creates only an `Employee`.
- `Department.hodId` and `Section.classAdvisorId` reference `Faculty`;
  `HostelBlock.wardenId` references `Person` and `chiefWardenId` references
  `Staff`.
- `User.email` is required and unique per college; `Person.email` is
  optional, hence the placeholder address rule.
