# Global People Search API Reference

**Feature:** global-people-search
**Module:** M02 People
**Base path:** `/api/people`
**Audience:** frontend developers, integration partners, future maintainers

Single endpoint that powers the Cmd+K global-search overlay and the
`/search` full-results page in the admin portal. Design and rationale
live in `.captain/specs/global-people-search/spec.md` and `plan.md`;
this file is the wire contract.

---

## 1. Endpoint

### `GET /api/people/search`

**Auth:** required (`Authorization: Bearer <JWT>` + `x-college-id` header)
**Permission:** `people:read`
**Rate limit:** 60 requests / 60 seconds per authenticated user
**Response:** `application/json`

Returns people matching `q` across five roles (student, faculty, staff,
parent, alumni) in the caller's college, filtered by the caller's RBAC
scope.

---

## 2. Query parameters

| Param             | Type    | Required | Default | Constraint                                       |
|-------------------|---------|----------|---------|--------------------------------------------------|
| `q`               | string  | yes      | —       | 2–100 chars after trim, charset `[A-Za-z0-9 @.\-+]` |
| `limit`           | integer | no       | `10`    | 1–25                                             |
| `includeInactive` | boolean | no       | `false` | `'true'` / `'false'`; admin-only — see §6         |

Invalid values → `400 Validation failed`.

Matching is case-insensitive and substring-based across:

- `Person.name`, `Person.email`, `Person.phone`, `Person.alternatePhone`
- `Student.rollNumber`
- `Faculty.employeeCode`
- `Staff.employeeCode`

Phone queries are digit-normalized: `+91 9998 887777` matches a stored
`9998887777`. Regex meta-characters in `q` (`.*+?^${}()|[]\`) are escaped
server-side so `q=.` does NOT match every record.

---

## 3. Response shape

```json
{
  "results": [
    {
      "_id": "24-char-oid",
      "role": "student",
      "personId": "24-char-oid",
      "name": "Ramesh Kumar",
      "photo": "https://.../ramesh.jpg",
      "identifier": "22JIT0001",
      "identifierLabel": "Roll #",
      "department": "Computer Science",
      "status": "active"
    }
  ],
  "counts": {
    "student": 3,
    "faculty": 0,
    "staff": 0,
    "parent": 0,
    "alumni": 0
  },
  "totalMatched": 3,
  "hasMore": false
}
```

### Field reference

| Field                  | Type                                   | Notes                                                                                  |
|------------------------|----------------------------------------|----------------------------------------------------------------------------------------|
| `results[i]._id`       | string (ObjectId)                      | Role-document `_id` (Student / Faculty / Staff / Parent / Alumni)                      |
| `results[i].role`      | `'student' \| 'faculty' \| 'staff' \| 'parent' \| 'alumni'` | One of five.                                          |
| `results[i].personId`  | string (ObjectId)                      | The underlying `Person` document id — use for navigation.                              |
| `results[i].name`      | string                                 | Full name.                                                                             |
| `results[i].photo`     | string \| undefined                    | Public URL if set.                                                                     |
| `results[i].identifier`| string \| undefined                    | Roll # for students, emp code for faculty/staff, linked-student name(s) for parents.   |
| `results[i].identifierLabel` | string                           | Human label: `"Roll #"`, `"Emp Code"`, `"Parent of"`, `"Batch"` (alumni).              |
| `results[i].department`| string \| undefined                    | Resolved department name (for alumni, via `branchId → Branch.departmentId`).           |
| `results[i].status`    | string \| undefined                    | `active` / `inactive` / `graduated` / `separated` etc. — role-dependent, absent for parents. |
| `counts.<role>`        | integer                                | Pre-slice match count for that role (may exceed returned rows).                        |
| `totalMatched`         | integer                                | Sum of counts.                                                                         |
| `hasMore`              | boolean                                | `true` if any role's match count exceeds its per-role limit.                           |

### PII guarantees

The response **never** includes:

- `phone` / `alternatePhone`
- `email`
- `dateOfBirth` / `dob`
- `aadhaar`
- `address`

Even admin users. If those fields are required, navigate to the
person's detail page — the detail endpoints enforce their own RBAC
and audit any access.

This is enforced by:

1. A service-level projection in `search-service.ts` that reads only the
   whitelisted fields, AND
2. A negative assertion at the HTTP boundary in the e2e test
   (`backend/src/__e2e__/modules/people-search.test.ts`).

---

## 4. Error responses

### 400 Validation failed

```json
{
  "error": "Validation failed",
  "details": [
    { "path": "q", "message": "String must contain at least 2 character(s)" }
  ]
}
```

Triggers: `q` missing, `q` too short (< 2) or too long (> 100),
disallowed chars in `q`, `limit` out of `[1, 25]`, `includeInactive`
not boolean-coercible.

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

Missing / invalid JWT or missing `x-college-id`.

### 403 Forbidden

```json
{ "error": "Forbidden" }
```

Caller authenticated but lacks `people:read`.

### 429 Too Many Requests

```json
{
  "error": "rate_limited",
  "message": "Too many search requests — please wait before retrying.",
  "retryAfter": 60
}
```

`retryAfter` is seconds until the rate window resets. Keyed on
`req.user.id` — per-user, not per-IP.

---

## 5. RBAC scope (what each role sees)

Scope is applied unchanged by the existing `applyAuthScope(filter, authScope, { selfField: 'personId' })` helper.

| Caller role / persona          | Students                           | Faculty                            | Staff                              | Parents          | Alumni                             |
|--------------------------------|------------------------------------|------------------------------------|------------------------------------|------------------|------------------------------------|
| `super_admin`                  | All colleges (scope bypass)        | All                                | All                                | All              | All                                |
| `admin` / `principal`          | All in caller's college            | All                                | All                                | All              | All                                |
| `hod` (dept-scoped)            | Students in HOD's dept (via `Branch.departmentId`) | Faculty in HOD's dept | Staff in HOD's dept   | — (empty)        | Alumni in HOD's dept (via branch)  |
| `faculty` (self-scoped persona) | Self-linked records only           | Self-linked records only           | —                                  | —                | —                                  |

Parent + HOD scope returns empty by design: parents have no
`departmentId` so a dept-scoped HOD can't see them. Super-admin and
admin see parents unrestricted.

---

## 6. `includeInactive` semantics

| Caller role                                       | Effect of `includeInactive=true`                          |
|---------------------------------------------------|-----------------------------------------------------------|
| `super_admin` / `admin` / `principal`             | Honored — separated / graduated / inactive rows returned. |
| Any other role                                    | **Silently downgraded** to `false`. Server logs at `info` level. No error returned. |

Parent + alumni docs have no `status` field and are always returned
regardless of the flag.

---

## 7. Performance

- Two compound indexes on `Person` support the regex queries:
  `{ collegeId: 1, name: 1 }`, `{ collegeId: 1, email: 1 }`.
- Five parallel role-scoped queries via `Promise.all`.
- Typical p95 < 300ms on a 500-person college; < 600ms on 5000-person.
- Per-user rate limit (60/min) mitigates accidental polling loops.
- The global per-IP rate limit in `app.ts` remains the backstop for
  unauthenticated traffic.

---

## 8. Example

```bash
curl -sS "http://localhost:3003/api/people/search?q=ramesh&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-college-id: 000000000000000000000001"
```

```json
{
  "results": [
    {
      "_id": "661b2c3d4e5f6a7b8c9d0e1f",
      "role": "student",
      "personId": "661b2c3d4e5f6a7b8c9d0e2a",
      "name": "Ramesh Kumar",
      "identifier": "22JIT0001",
      "identifierLabel": "Roll #",
      "department": "Computer Science",
      "status": "active"
    }
  ],
  "counts": { "student": 1, "faculty": 0, "staff": 0, "parent": 0, "alumni": 0 },
  "totalMatched": 1,
  "hasMore": false
}
```
