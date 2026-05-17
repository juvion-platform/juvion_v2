# Discovery: Student → Fee Structure Mapping Architecture

**Date:** 2026-05-17  
**Scope:** Very thorough. Covers lookup chain, pinning lifecycle, Course role, drift surfaces, and clarity candidates.

---

## TL;DR

The system maps a student to a fee structure via **7-axis lookup**: `collegeId`, `programmeId` (required), `branchId` (optional match), `quota` (exact match required), `category` (optional match), `academicYearId` (required context), and implicit `yearOfStudy` (stored separately as pin subdoc). **Course is completely absent** from fee selection—it's not part of the model or any lookup path. Pinning happens automatically at admission (Year-1) and on promotion (Year-N). The real clarity issue is that `yearOfStudy` is implicit in the FeeStructureInstance model (no `yearOfStudy` field), forcing callers to track it separately on the pin and rely on AcademicYear context for disambiguation.

---

## 1. Current Lookup Chain

### Entry Point: `resolveMatchingFeeStructureInstance()`  
**File:** `backend/src/modules/finance/fee-pin-service.ts:188–263`

**Lookup steps:**

1. **Input:** Student object with `programmeId`, `branchId?`, `quota?`, `category?` + opts with `academicYearId`
2. **Base filter** (lines 199–207):
   - `collegeId`: from Student  
   - `programmeId`: from Student (required; returns null if absent)  
   - `academicYearId`: from opts (required; returns null if undefined)  
   - `status: 'active'`: hardcoded  
   - `quota`: exact match if Student has it; no fallback (line 205–208)

3. **Candidates query** (line 217):
   ```
   FeeStructureInstance.find(baseFilter)
   ```
   Retrieves ALL active FSI matching collegeId, programmeId, academicYearId, status.

4. **Scoring & preference** (lines 220–254):
   - For each candidate, compute two independent scores:
     - **Branch** (lines 230–238): 
       - FSI branch is null → score 1 (wildcard, always acceptable)
       - FSI branch matches Student.branchId → score 2 (exact)
       - FSI branch set but doesn't match → rejected (continue)
     - **Category** (lines 240–248):
       - FSI category is null → score 1 (wildcard)
       - FSI category matches Student.category → score 2 (exact)
       - FSI category set but doesn't match → rejected (continue)
   - **Combined score** (line 253): `branchScore * 10 + categoryScore`
     - Ranges: 11–22 (both exact) down to 11 (branch exact, cat wild)
     - Branch-exact always beats branch-wildcard regardless of category
   - **Tie-break** (line 260): sort by `approvedAt` descending (most recent wins)

5. **Return:** First (highest-scoring) candidate or null

### Implicit Axis: Year-of-Study  
**File:** `backend/src/modules/finance/fee-pin-service.ts:209–215`

The lookup **does not** filter on `yearOfStudy`. Line 215 says:
```typescript
// NOTE: yearOfStudy is not a field on FeeStructureInstance...
// We pass yearOfStudy through so the caller can include it if/when the
// model grows a `yearOfStudy` field. For now it's a no-op filter.
void yearOfStudy;
```

**Actual state:** Year-of-study is tracked **on the AcademicYear**, not the FSI. Each academic year row represents "this year's rates for this programme." The lookup chain relies on the caller passing the correct `academicYearId` for the student's current year-of-study.

---

## 2. Pinning Lifecycle

### When Pinning Happens

#### 2a. **Admission (Initial Pin)**  
**File:** `backend/src/modules/admissions/workflow.handlers.ts` (grep output)

Trigger:
- Applicant is finalized in Admissions module
- Calls `feePinService.pinYear(String(student._id), entryPoint.studyYear, { pinnedBy: 'system:admission', reason: 'initial', academicYearId, ... })`
- If `FeeStructureNotFoundError`: admission is blocked and the Student is deleted (rollback)

**Key:** `entryPoint.studyYear` is the year-of-study the student enters at (1 for normal, 2+ for lateral entry). Derived from Student.studyYearAtAdmission (default 1).

#### 2b. **Promotion (Year-N Pin)**  
**File:** `backend/src/modules/academics/academic-delivery-service.ts` (grep output)

Trigger:
- Academic office runs semester/year promotion workflow
- For each promoted student, calls `feePinService.pinYear(studentId, newYearOfStudy, { pinnedBy: 'system:promotion', reason: 'initial', academicYearId: targetAcademicYearId, ... })`
- If `FeeStructureNotFoundError`: promotion succeeds but pin is deferred (logged; lazy-pinned on first invoice)

**Key:** Year-N FSI is determined by passing the NEW academic year's ID to the lookup.

#### 2c. **Programme Transfer**  
**File:** `backend/src/modules/finance/programme-transfer-service.ts:55–149`

Trigger:
- Admin changes `Student.programmeId`, `Student.branchId`, and/or `Student.regulationId`
- Service calls `feePinService.pinYear(studentId, effectiveYearOfStudy, { reason: 'programme_transfer', ... })`
- If pin resolution fails: compensating rollback restores prior programme/branch/regulation and any old active pin

**Key:** This is the ONLY place where `programmeId` change triggers automatic re-pin for the current year. Branch or category changes (Journey 4 in spec) do NOT auto-trigger; they're flagged as "stale" for admin decision.

#### 2d. **Manual Admin Re-pin**  
**File:** `backend/src/modules/finance/fee-pin-controller.ts:52–84`

Trigger:
- Admin calls `POST /students/:id/pins/re-pin` with explicit target FSI ID
- Calls `feePinService.rePin(studentId, yearOfStudy, { targetFeeStructureInstanceId, reason: 'admin_override' | 'data_correction', ... })`

**Key:** No lookup—admin selects the FSI directly. Useful for policy exceptions.

### Pin Commit Path  
**File:** `backend/src/modules/finance/fee-pin-service.ts:569–675`

Both `pinYear()` and `rePin()` call the internal `commitPin()` function:

1. **Archive existing active pin** (lines 577–583):
   - For any existing pin on the same `(studentId, yearOfStudy)` with `archivedAt === null`:
   - Set `archivedAt = now`, `archiveReason = 'replaced'`

2. **Push new pin** (lines 585–593):
   ```typescript
   student.feePins.push({
     yearOfStudy,
     feeStructureInstanceId: ...,
     pinnedAt: now,
     pinnedBy: opts.pinnedBy,
     reason: opts.reason,
     remarks: opts.remarks,
     archivedAt: null,
   })
   ```
   Embedded on Student.feePins[] (type: DocumentArray<IFeePin>).

3. **Concurrency guard** (lines 604–625):
   - After save, re-fetch Student; check for multiple active pins for the same year
   - If found, keep the one with most recent `pinnedAt`; archive the rest
   - This handles race conditions in the test harness (no replica sets → no transactions)

4. **Audit log + commitment sheet enqueue** (lines 634–674):
   - Log pin creation
   - Enqueue `enqueueFeeCommitmentJob()` unless `enqueueCommitmentSheet === false`

### Pin Validity Check  
**File:** `backend/src/modules/finance/fee-pin-service.ts:489–557`

Function `checkPinValidity()` re-evaluates whether the current active pin is still valid:

1. **Read current active pin** (lines 498–501): Find pin with `yearOfStudy` + `archivedAt === null`
2. **Compute what SHOULD be pinned** (lines 503–519):
   - Re-run `resolveMatchingFeeStructureInstance()` with the current student attributes
   - Infers `academicYearId` from the pinned instance itself (if pin exists)
3. **Compare** (lines 531–554):
   - `programmeId` mismatch → invalid (line 531–533)
   - `branchId` mismatch → invalid only if FSI has a branch set (lines 536–540)
   - `quota` mismatch → invalid if either student or FSI has a value (lines 542–547)
   - `category` mismatch → invalid only if FSI has a category set (lines 550–554)
4. **Return verdict** (line 556): `{ valid: boolean, reason, currentPin, matchingInstance }`

**Used by:** invoice UI banner to warn "pin is stale; student's attributes changed."

---

## 3. Role of Course: Completely Absent

### Course Model  
**File:** `backend/src/models/academic-ops/Course.ts:1–27`

Fields relevant to fee selection:
- `departmentId` (references Department, not used in fee lookup)
- `regulationId` (same as Student.regulationId, but Course is keyed differently)

### Fee Model Chain  
Lookup path: Student → FeeStructureInstance

- Student has: `programmeId`, `branchId`, `quota`, `category`, `regulationId`
- FeeStructureInstance has: `programmeId`, `branchId`, `quota`, `category` (no `regulationId`)
- **No reference to Course anywhere**

### Grep Confirmation  
```bash
grep -r "Course" backend/src/modules/finance --include="*.ts"
# (no output — zero matches)
```

### Spec Confirmation  
**File:** `.captain/specs/fee-configuration/spec.md:144–149`

Section "NOT For" explicitly lists:
> **Course-level / per-subject fees** — individual CourseOffering surcharges are explicitly out of scope. If the college needs a "DBMS Lab ₹2K surcharge" pattern in the future, it's a separate feature with its own spec.

### Conclusion  
**Course is completely absent from the fee mapping architecture.** The system maps at the **programme level** (e.g., "B.Tech CSE Year 2"), not at the subject/course level (e.g., "Data Structures CS201 + Lab surcharge"). User confusion likely stems from Indian colloquial usage where "course" = "programme" (e.g., "Which course are you in?" meaning "Which degree programme?").

---

## 4. Drift Surfaces & Inconsistencies

### 4a. Year-of-Study: Implicit & Split

**Problem:** FeeStructureInstance has NO `yearOfStudy` field. Year-of-study information lives in:
- **Student.feePins[].yearOfStudy** (embedded, explicit)
- **AcademicYear context** (implicit; callers must pass academicYearId)
- **Caller's responsibility** (e.g., `academic-delivery-service.ts` computes `newYearOfStudy = oldYearOfStudy + 1` before calling pinYear)

**File references:**
- `FeeStructureInstance.ts:21–44` — no `yearOfStudy` field
- `fee-pin-service.ts:209–215` — explicit comment about this gap
- `fee-pin-service.ts:142–155` — `deriveAcademicYearId()` returns undefined if no batch; callers MUST pass academicYearId explicitly

**Smell:** The spec (`.captain/specs/fee-configuration/spec.md:16, 26, 33`) assumes "FeeStructureInstance for Year-1," "Year-2," etc., but the actual model has no `year` field. Year is conflated with "which AcademicYear this FSI is valid for." This works but is non-obvious.

**Candidate for fix:** Add explicit `yearOfStudy: number` (1–8) to FeeStructureInstance model so the lookup can filter directly instead of relying on AcademicYear indirection.

---

### 4b. Regulation: Present on Student, Absent on FSI

**Problem:** Student has `regulationId` (which curriculum/regulation set the student enrolled under). FeeStructureInstance has NO `regulationId` field.

**File references:**
- `Student.ts:146` — `regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' }`
- `FeeStructureInstance.ts:21–44` — no `regulationId`
- `fee-pin-service.ts:188–263` — lookup does NOT filter on Student.regulationId

**Implication:** Two students in the same (programme, branch, batch, quota, category) but different regulations (e.g., 2022 vs 2023 regulations) would get pinned to the SAME FeeStructureInstance, even if their fee structures should differ.

**Use case where this matters:**
- College updates curriculum & fee structure every 2–3 years
- Older regulation students might have different (lower) fees
- Current code would silently map them to the newest active FSI, inflating their fees

**Comment in code:** None found. This is a silent drift, not documented.

**Candidate for fix:** Add `regulationId?` to FeeStructureInstance and update the lookup to match `Student.regulationId` when both are present.

---

### 4c. Branch Null-Wildcard Logic is Subtle

**Problem:** FeeStructureInstance.branchId can be null (wildcard). Student.branchId can also be null or undefined. The scoring logic (lines 230–238 of fee-pin-service.ts) has a subtle fallback:

```typescript
if (docBranch === null) {
  branchScore = 1; // wildcard — always acceptable
} else if (studentBranch && docBranch === studentBranch) {
  branchScore = 2;
} else {
  continue; // branch on instance that doesn't match student → drop
}
```

**Case 1:** Student.branchId is null. FSI.branchId is null → score 1 ✓  
**Case 2:** Student.branchId is null. FSI.branchId is set (e.g., CSE) → rejected (continue) ✓  
**Case 3:** Student.branchId is CSE. FSI.branchId is null → score 1 ✓  
**Case 4:** Student.branchId is CSE. FSI.branchId is CSE → score 2 ✓

**Ambiguity:** Case 2 (no student branch, FSI requires branch) could be interpreted as "this FSI is branch-specific, student has no branch, reject" OR "student is branch-agnostic, FSI is too detailed, accept with low score." The code chooses reject, which is correct but not obvious from the variable names alone.

**No comment in code** explaining this decision.

**Candidate for fix:** Add explicit comment in the logic or rename `studentBranch` to `studentBranchId` + add doc comment on the preference rules.

---

### 4d. Quota: No Fallback, Strict Exact Match

**Problem:** If Student.quota is null and FSI.quota is set (or vice versa), the lookup returns no matches.

**File:** `fee-pin-service.ts:205–208`

```typescript
if (student.quota) {
  baseFilter.quota = student.quota;
}
// NOTE: If student.quota is null, quota is NOT filtered at all.
// So candidates include FSIs with quota=null AND quota=non-null.
```

**Case 1:** Student.quota = 'convener'. FSI.quota = 'convener' → matches ✓  
**Case 2:** Student.quota = 'convener'. FSI.quota = 'management' → rejected in scoring (different quota value) ✓  
**Case 3:** Student.quota = null. FSI.quota = 'convener' → included in baseFilter, then scoring (line 223–255). No scoring logic rejects quota mismatch here — quota is not scored.

**Critical gap:** Line 223–255 score logic does NOT check quota at all! It only scores branch and category. So if a student has no quota, they can match FSIs with any quota value, which is wrong.

**Code comment** at `FeeStructureInstance.ts:27–29`:
```typescript
// No enum: quota codes come from the admin-managed FeeQuota CRUD
// (/api/finance/fee-quotas). Matched by string-equality against
// `Student.quota` in fee-pin-service — same contract as `category`.
```

The comment says "matched by string-equality" but the code doesn't enforce this in the scoring phase—only in the base filter (which is permissive when Student.quota is null).

**Candidate for fix:** Add explicit quota-mismatch check in the scoring phase (lines 226–255) to reject candidates where quota differs from student.quota.

---

### 4e. Category Null-Wildcard Logic is Correct but Unmarked

**Problem:** Category follows the same pattern as branch (null = wildcard) but has no comment.

**File:** `fee-pin-service.ts:240–248`

The logic is correct (null category on FSI accepts any student category), but the comment at `FeeStructureInstance.ts:26–29` talks about quota ("matched by string-equality") and doesn't clarify the null-wildcard for category.

**Not a bug, but clarity issue.**

---

## 5. "Not Very Clear" Candidates

### A. **Implicit Year-of-Study Dimension**  
- **File:** `fee-pin-service.ts:209–215`
- **Issue:** The lookup chain doesn't filter on `yearOfStudy` because FSI has no `yearOfStudy` field. Instead, callers must pass the correct `academicYearId`. An outside reader encountering this code would ask: "How does the system know which year's fees apply?" The answer is scattered across AcademicYear context + Student.feePins[].yearOfStudy tracking.
- **Clarity:** 3/10

### B. **Regulation Mismatch (Silent Drift)**  
- **File:** `fee-pin-service.ts:193–263`
- **Issue:** The lookup does NOT consider Student.regulationId, even though the Student model requires it. No comment explains why. A reader would wonder: "If a student's regulation changes, should their fee structure change?" The system currently says no.
- **Clarity:** 2/10

### C. **Quota Matching Gap in Scoring Logic**  
- **File:** `fee-pin-service.ts:220–254`
- **Issue:** The base filter is permissive on quota (includes all FSIs if student.quota is null), but the scoring logic doesn't penalize quota mismatch. The comment at FeeStructureInstance.ts says quota is "matched by string-equality," but that's only enforced in the base filter, not the preference logic. An outside reader might assume all quoted FSIs are equally preferred.
- **Clarity:** 4/10

### D. **Branch & Category Null-Wildcard Asymmetry**  
- **File:** `fee-pin-service.ts:220–254`
- **Issue:** Null branch or category on FSI = wildcard (acceptable). But null on Student + non-null on FSI = rejected (dropped early). This asymmetry is intentional but not documented. A reader might ask: "Why does a student without a branch get rejected from a branch-specific FSI?"
- **Clarity:** 5/10

### E. **Student.studyYearAtAdmission Buried in Comments**  
- **File:** `Student.ts:121–139`
- **Issue:** The field exists to handle lateral-entry students (entering Year 2+ instead of Year 1), but the comment is verbose and not referenced elsewhere. The admission workflow calls `pinYear(studentId, entryPoint.studyYear, ...)`, where `entryPoint.studyYear` comes from this field. But `entryPoint.studyYear` is not defined in the workflow file. A reader tracing the admission flow would need to jump through multiple files to understand lateral entry.
- **Clarity:** 5/10

---

## 6. Three Plausible Interpretations of "Correct the Architecture"

### Interpretation A: **Add Explicit yearOfStudy Field to FeeStructureInstance**

**What:** Add `yearOfStudy: number` (1–8) to FeeStructureInstance schema. Update lookup to filter on it directly.

**Why:** Year-of-study is described in the spec as a "dimension" of the fee structure (like branchId, quota), but it's not a field in the model. Callers must pass academicYearId + rely on external context. Making it explicit clarifies the model.

**Surface that changes:**
- FeeStructureInstance schema + unique index
- `resolveMatchingFeeStructureInstance()` signature and base filter
- FeeStructure model (if kept in sync) + any seed scripts

**Effort:** Medium. Backward-compat risk if existing code hardcodes academicYear-based lookups.

---

### Interpretation B: **Add Regulation to FeeStructureInstance & Lookup**

**What:** Add optional `regulationId?: ObjectId` to FeeStructureInstance. Update lookup to match Student.regulationId when both are present (fall back to null-wildcard if FSI.regulationId is null).

**Why:** Regulations change; fees change by regulation. The current code silently maps students across regulations, which is likely wrong.

**Surface that changes:**
- FeeStructureInstance schema + unique index
- `resolveMatchingFeeStructureInstance()` scoring logic
- FSI creation/admin UI (must choose regulation when creating structures)

**Effort:** Medium-high. Requires policy decision: should old-regulation students be on old fee structures (complex to maintain) or auto-migrate to new ones (simpler but policy risk)?

---

### Interpretation C: **Clarify & Codify the Null-Wildcard Rules**

**What:** Add explicit comments + helper functions to clarify when null FSI fields accept any student value (branch, category), and add assertion in the scoring logic to enforce quota exact-match.

**Why:** The current logic is correct but underspecified. Comments reference "wildcard" but don't define the rules consistently. The quota-match gap is a latent bug.

**Surface that changes:**
- `fee-pin-service.ts` comments + maybe a small scoring fix
- No schema changes; no backward compat risk

**Effort:** Low. Quick win for clarity.

---

## 7. Files of Interest

| Path | Annotation |
|------|-----------|
| `backend/src/models/finance/FeeStructure.ts` | Fee structure versioning; no yearOfStudy field |
| `backend/src/models/finance/FeeStructureInstance.ts` | Active fee structure; axes: programme, branch?, quota, category?, academicYear; no yearOfStudy, no regulation |
| `backend/src/models/people/Student.ts` | Embedded feePins[]; contains yearOfStudy; has regulationId but not used in fee lookup |
| `backend/src/modules/finance/fee-pin-service.ts` | Core lookup logic; resolveMatchingFeeStructureInstance(), pinYear(), checkPinValidity() |
| `backend/src/modules/finance/programme-transfer-service.ts` | Auto re-pin on programme change; only place where programme change triggers re-pin |
| `backend/src/modules/finance/fee-lifecycle-service.ts` | Invoice generation; uses pin; fallback to live resolution if pin absent |
| `backend/src/modules/admissions/workflow.handlers.ts` | Initial pin at admission; fails if FSI not found |
| `backend/src/modules/academics/academic-delivery-service.ts` | Promotion pin (Year-N); defers if FSI not found |
| `.captain/specs/fee-configuration/spec.md` | Requirements; Journeys 1–8; explicitly out-of-scope: course-level fees |
| `backend/src/models/academic-ops/Course.ts` | Subject-level entity; completely absent from fee selection |
| `backend/src/modules/finance/fee-pin-controller.ts` | HTTP endpoints; previewMatchingFeeStructure() for live UI preview |

---

## Summary for Lead

The student-to-fee-structure mapping is **well-structured but uses implicit axes** that create clarity issues. The 7-axis lookup (programme, branch, quota, category, regulation [missing], yearOfStudy [implicit], academicYear) works correctly in practice, but:

1. **yearOfStudy is not a field**—callers must infer it from AcademicYear context + Student.feePins[].yearOfStudy. Spec describes it as a "dimension," but it's not modeled as one.
2. **regulationId is silently ignored**—Student has it; FSI doesn't. No comment explains why. Two students in different regulations can be pinned to the same fee structure.
3. **Quota matching is gappy**—base filter is permissive; scoring logic doesn't penalize mismatch. Risk: student with null quota could match any FSI.

**Course is completely absent** from fee selection (correct per spec, but a source of user confusion given Indian colloquial usage).

**Pinning is well-triggered** (admission → Year-1, promotion → Year-N, programme transfer → current year, admin override). Lifecycle is clear.

**The "not very clear" part:** A reader must jump across 5+ files to understand that yearOfStudy is implicit in AcademicYear, that regulation is ignored, and that null-wildcard rules are asymmetric. Spec says "fee axis" for year-of-study, but the model doesn't enforce it.

**Three interpretations of "correct":**
- A: Add explicit `yearOfStudy` field to FSI (medium effort, high clarity gain).
- B: Add `regulationId` to FSI lookup (high effort, policy-dependent, addresses silent drift).
- C: Add comments + fix quota-match gap (low effort, modest clarity gain).

**Recommendation:** Ask the user which axis is causing the confusion. If they're confused about "which year's fees apply," that's A. If they're concerned about regulation changes, that's B. If it's just comments/documentation, that's C.

