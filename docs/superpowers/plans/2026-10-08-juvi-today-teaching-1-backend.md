# Juvi Today & Teaching — Plan 1 of 3: Backend (ERP + Juvi API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S03 Today (student) and S10 Teaching (faculty) surfaces backed by the ERP: class exceptions (cancel/reschedule), the shared attendance formula, day/glance/dues/assessment readers, the widened attention endpoint, class-change push notifications, the `/v1` mobile API contract, and seed data.

**Architecture:** Compute-on-read. The ERP timetable stays the source of truth; a live-read rule (highest-version published `Timetable` whose effective window covers the date) plus `ClassException` rows — the only new stored entity — are resolved per request. Only the attendance formula writes (existing `AttendanceSummary` upserts, now threshold-driven). Push rides the existing outbox → `notification.requested` → sender pipeline with a new `class_change` source type.

**Tech Stack:** Node 20, TypeScript strict, Express 4, Mongoose 8, Zod 3, vitest, `@asteasolutions/zod-to-openapi`, BullMQ-free outbox (`shared/outbox`), Flutter dart-dio client (regen only — app code is Plan 3).

**Spec:** `docs/superpowers/specs/2026-10-08-juvi-today-teaching-design.md` — this plan implements §12 item 1 (backend) only. §4 exceptions+settings, §5 ERP service/routes/portal rules, §6 readers, §7 mobile API, §8 push are in scope; §9 (Flutter behaviour) and the portal dialog UI are Plan 2/Plan 3 deliverables and are not implementable from this plan's tasks.

**Worktree:** `/Users/srinivasarao.kandula/code/juvion_v2/.claude/worktrees/juvi-flutter-shell` (branch `feat/juvi-today-teaching`). All paths below are relative to `backend/` unless they start with `mobile/`, `docs/` or another workspace root.

## Rulings (Assumptions)

Recorded so executors do not re-litigate; each traces to the spec or to verified code ground truth.

- **R1 (money).** Juvi /v1 returns integer paise via `toPaise(amount: number | null): number | null` (rupees ×100, rounded half-up, null passthrough) in `backend/src/modules/juvi-app/home/money.ts` — applied once at the reader boundary; everything downstream (glance, me/academics, fee_due attention) forwards paise unchanged and must never call `toPaise` again. ERP stays rupees/2dp; Flutter divides by 100 (Plan 3).
- **R2 (conflicts).** `detectTimetableConflicts` (academics routes `GET /timetables/:id/conflicts`) is a placeholder for scheduling. This plan implements the real check it stands for as tested functions in the exception service: a reschedule's target room on `newDate`/`newStart`–`newEnd` must be free of any other slot there (after that day's exceptions) and of any other active exception overlapping; the moving slot's own occurrence is excluded. The placeholder is superseded: `GET /timetables/:id/conflicts` routes it to the new check via a comment, and the route is left untouched otherwise.
- **R3 (live timetable).** READ rule only: `status:'published'` with `effectiveFrom ≤ date` and `effectiveTo ≥ date or null`, highest `version` wins (tie broken by newest `updatedAt`). Timetable publish/manage APIs stay out of scope.
- **R4 (enum casing).** Follows the code exactly: attendance records `'od'` (lowercase), invoices `'written_off'`, sessions `'closed'`, slot types `'lecture'|'tutorial'|'lab'|'free'`, days `'monday'…'saturday'`. Spec prose like "OD" or "written-off" is informal.
- **R5 (open invoices).** Open = every status except the terminal/closed set `draft`, `paid`, `cancelled`, `written_off` — i.e. `generated`, `sent`, `partially_paid`, `overdue`, `disputed`, `confirmed` remain open and count for dues.
- **R6 (per-actor check).** `assertClassChangePermission(collegeId, actor, offeringId, slotId?)` is bespoke and e2e-covered. Resolution order: (a) `RBAC_ENFORCE==='false'` → `{basis:'office'}` (dev bypass); (b) the actor's User→Person→Faculty row owns the class (offering.facultyId / coFacultyIds / slot.substituteFacultyId) → `{basis:'faculty'}` — ownership first so a faculty user who also holds an academics-write policy can still only touch their own classes; (c) `evaluateAccess(collegeId, role, personaCodes, 'academics', 'update')` allows → `{basis:'office'}`; (d) otherwise 403 `AppError` "You can change only your own classes". Flagged for extra review.
- **R7 (instalment state).** `PaymentPlan.installments[].status` never leaves `'pending'` in code; dues are computed on read by matching successful payments to instalments chronologically (the 007 payment-matching precedent). No new stored state; "only ClassException is a new stored entity" holds.
- **R8 (ERP-visible change).** Shared-formula wiring makes `computeAttendanceSummary` and `updateAttendanceSummary` store `percentage: null` when no closed session has been held (displaying "—" in the portal), and adopt the `College.juvi.attendanceThreshold` category boundaries for newly computed rows. Existing stored rows change only through the recomputation paths the spec wires (marking writes); the portal already renders missing percentages as "—".
- **R9 (alerting path).** `checkAttendanceThresholds` (service.ts) and its alert thresholds, and the `pct < 75` check near service.ts:2794, keep their hard-coded 75/65 — the threshold setting here governs categories and the Juvi surface only; the spec is silent on the alert path, so it is left alone.
- **R10 (Sunday).** Resolves to no classes (no Sunday slot enum and no weekday match); `resolveDay` returns an empty class list for Sundays.
- **R11 (optional display fields).** `faculty`, `room`, `channelId` are omitted (never null) when they cannot be resolved — no null object fields.
- **R12 (name collision).** The ERP formula keeps the spec name: `attendanceFor(collegeId, studentId, threshold?)` in `backend/src/modules/academics/attendance-formula.ts`; the Juvi reader (`home/readers.ts`) imports it under an alias and adds `available` + the college threshold.
- **R13 (held = 0).** `pct` is stored `null` (not 0) and the category is `'safe'` when no closed session has been held.
- **R14 (class_change attention).** Deadline = the original occurrence start instant (ISO); the item shows from creation until that instant has passed, and only when the original or new date is today or tomorrow.
- **R15 (fee_due attention).** Deadline/date come from the reader's next due (first unpaid instalment, else the invoice's due date). Two distinct fields: `deadline` = ISO instant of that date at college-tz midnight (e.g. 2027-03-01 in IST → '2027-02-28T18:30:00.000Z') — the same instant convention as R14/R16, so ordering across kinds stays comparable; `dueDate` = the display 'YYYY-MM-DD' string derived with `ymd` in the college tz — that is what the app renders. Window/overdue logic compares instants, never date strings: overdue = deadline < start-of-today instant (strictly — a due-today item appears and is NOT overdue); within 7 days = start-of-today ≤ deadline ≤ start-of-today + 7 days.
- **R16 (assessment attention).** Deadline = the assessment's `at` instant.
- **R17 (preview).** `previewClassException` returns `affectedStudents: number` and `faculty: string[]` (display names; substitution first).
- **R18 (channel id).** A class's `channelId` resolves via an active `Channel` with `scopeType:'course_offering'`, `scopeId` = offering id; only such a channel counts.
- **R19 (push consumer registration).** The class-change consumer is registered *inside* the existing `registerNotificationConsumers()` in `backend/src/modules/juvi-app/notifications/index.ts` (`registerConsumer(CLASS_CHANGE_EVENT, …)`, Task 16), which `backend/src/modules/juvi-app/routes.ts` already calls at module load beside `registerNoticeConsumers()`. No `registerClassChangeConsumers()` function exists and Task 16 does not edit `routes.ts`.
- **R20 (variant mapping).** Push `variant`: created + `type:'cancelled'` → `'cancelled'`; created + `type:'rescheduled'` → `'rescheduled'`; revoked → `'restored'`.
- **R21 (back-compat).** `GET /v1/attention` without `kinds` returns exactly today's notice items only; with `kinds=all` items carry a `kind` field. Old clients (not sending kinds) never see non-notice items.
- **R22 (version tiebreak).** Two live published timetables for a section with equal `version` → newest `updatedAt` wins.
- **R23 (date bounds).** A class exception's `date` must be today or later **in the college timezone** (`getJuviConfig(collegeId)?.timezone ?? 'Asia/Kolkata'`), on the slot's weekday, and inside the owning timetable's effective window.
- **R24 (staff on home).** Staff-kind accounts get 403 `MobileApiError` on `GET /v1/today`, `/v1/teaching` and `/v1/me/academics` (no student/faculty context).
- **R25 (room display).** Room shown as `"<roomNumber>, <building name>"`, building name omitted when absent; a slot without a room sends no room field.
- **R26 (nextTeachingDay).** Teaching-only scan (faculty's next day with classes, ≤14 days, skipping holidays); students get it from `today.nextTeachingDay` — the same resolver runs for both viewers.
- **R27 (viewer, not account kind in the resolver).** `resolveDay(collegeId, viewer, date, timezone)` takes `{studentId?|facultyId?}`; account-kind routing lives in the controllers.
- **R28 (self-occurrence).** The conflict check excludes the moving slot's own occurrence — a reschedule to a later period the same day is fine.
- **R29 (preview push tier).** Preview computes the tier through the same `classifyExceptionPushTier` the push pipeline uses, over `[date, newDate?]` (the endpoint takes optional `newDate`).
- **R30 (faculty attention).** Faculty items under `kinds=all` are notices + class_change only — no fee or assessment items for faculty viewers.
- **R31 (kinds param).** Only `kinds=all` is accepted; anything else is 400 `MobileApiError(400,'VALIDATION_FAILED','kinds must be "all"')`.
- **R32 (dueCount).** Under `kinds=all`, `dueCount` counts every returned item (all kinds); notices are not capped at 3 in the payload (the app slices to 3 + "+N more").
- **R33 (AttentionItem schema).** One flat Zod object — `kind` required, every other field optional — instead of a discriminated union: dart-dio `oneOf` generation is a known client-generation risk (notifications-plan Ruling 15 precedent).
- **R34 (DeliveryReason).** The union gains `'superseded'` and `'already_started'` for the send-time re-check.
- **R35 (write routes).** Exception write routes chain `authenticate` + `validate(schema)` only — the per-actor check runs in the controller/service (route chain per R6); reads keep `authorize('academics','read')` + `authenticate`.
- **R36 (list shape).** `GET /api/academics/class-exceptions` returns a lean array (bounded by date range), not `paginate()` — a season's exceptions are small and the portal list is flat.
- **R37 (index addition).** Besides the spec's three `ClassException` indexes, read-side scanning for a date adds `{collegeId, date: 1, revokedAt: 1}` — spec listed write-side indexes only.
- **R38 (dates query shape).** `activeExceptionsFor(collegeId, {slotIds?, offeringIds?, dates?})` supports offeringIds so `resolveDay` can fetch a viewer day's exceptions in one round trip, matching rows whose `date` or `newDate` is one of the dates.
- **R39 (registered count).** A class's `registered` count is the stored `CourseOffering.enrolledCount` (the field the ERP maintains); it is only emitted for faculty viewers on the teaching home.
- **R40 (audit actions).** Exception create/revoke write `createAuditLog` actions `'create'` and `'archive'` respectively (no `revoke` action exists); `changes: []` each time — rows are never edited.
- **R41 (timezone for ERP services).** ERP-side day math (validation, tier, holiday) uses the college timezone from `getJuviConfig(collegeId)?.timezone ?? 'Asia/Kolkata'` — the same default the Juvi mobile stack already uses.
- **R42 (per-course attendance shape).** Juvi `/v1` per-course rows are `{ offeringId, courseCode, title, held, attended, pct, headroom, channelId? }` (§7.3): `threshold` is dropped at the Juvi boundary and appears only at the attendance top level (and in `glance.attendance`, §7.1). Task 10's ERP-internal `CourseAttendance` keeps its `threshold` (Task 11's summary writers read `calc.threshold` for the category), so the Juvi course mapping rest-destructures it out and `JuviAttendanceCourse` extends `Omit<CourseAttendance, 'threshold'>`. Per-course `headroom` follows the §5.4 formula rule (0 unless `pct >= threshold`) gated further by the College's `showAttendanceHeadroom` — the spec's optional `headroom?` is emitted as a number (0 when suppressed), never null (Foundation R57/R61 discipline).

## Global Constraints

Every task's tests implicitly include all of these; exact values, verbatim from spec §1/§4/§5/§7/§8/§11:

- Attendance threshold setting: 50–95 integer, default 75, per college, editable in ERP admin (Task 10), with headroom toggle default ON.
- Headroom: `max(0, floor(attended / (threshold/100) − held))`, shown only when `pct ≥ threshold`; `pct` shown only when `pct > 0` ("—"/omitted at null).
- `pct = round1(attended / held × 100)` or `null` when `held = 0`. Round to 1 decimal exactly once (round1).
- Overall: `Σ attended ÷ Σ held` across courses; per-course only if the course has sessions.
- `attended` = present + late + od (per record status `'od'`); absent + leave excluded.
- Held = **closed** sessions only. Categories: safe ≥ threshold+10; warning [threshold, threshold+10); at_risk [threshold−10, threshold); detained < threshold−10; held = 0 → 'safe'.
- Class exception: reason 5–300 chars; type `'cancelled' | 'rescheduled'`; a reschedule carries `newDate` today-or-later and **within 14 days of today**, plus `newStartTime` < `newEndTime` and optional `newRoomId`.
- Exception date: today or later (college tz, R23), on the slot's weekday, inside the live timetable's effective window; one active exception per (slot, date) — revoke-then-create to change; rows are never edited or deleted, only revoked (`revokedAt`/`revokedBy`).
- Reschedule: newDate checked for section overlap and room occupancy (R2); cancelling needs no conflict check.
- Urgent push: the original class starts today AND within 2 hours of the change (forward-looking: start is in the future, ≤ 120 min away); Important: today or tomorrow, otherwise; `none` beyond → no push row scheduled, no attention item beyond its date window (R14).
- Push only for today/tomorrow audiences, sent once (unique `notification.requested` dedupe), at Important unless Urgent; Urgent bypasses mute + tier toggles + quiet hours; mute matches the course channel (R18).
- Audience: enrolled students of the offering + the other teaching faculty minus the acting user; Juvi accounts only.
- Send-time re-check cancels rows when the exception was revoked, superseded or the class has already started; reasons `'superseded' | 'already_started'` (R34).
- Money at the Juvi boundary: integer paise (R1); amounts dropped from dues when ≤ 0; instalments matched chronologically against cumulative successful payments (R7).
- Attention: `kinds=all` only (R31); windows — fee_due within 7 days or overdue, assessment within 48h, class_change today/tomorrow until start passed (R14); ordering by deadline, nulls last.
- Group key `class:<offeringId>`; outbox event `class.exception.changed` with dedupe `class-exception:<id>:<created|revoked>`; notification dedupe `notif:class_change:<id>:<created|revoked>`.
- Deep link targets `/today` and `/teaching` (strings in the push payload; client allows them — Plan 3).
- Events allow-list gains exactly: `timeline.class_opened`, `glance.opened`, `post_class_prompt.shown`, `post_class_prompt.opened`.
- No null object fields anywhere on Juvi responses (optional = omitted; `AttentionItem` is a single flat schema, R33).
- `/v1` order: `homeRouter` mounted after `notificationsRouter`, before `spacesRouter`; per-route `authenticateMobile`.
- Readers scope to callers: filter by `collegeId` + the MobileContext's `studentId`/`facultyId` only; back-compat R21.
- AppError constructor: `statusCode` FIRST — `new AppError(404, 'msg')`; mobile errors `new MobileApiError(status, code, message, detail?)` with the `{ error: { code, message } }` envelope.
- `String(doc._id)` for ObjectId → string; unused params prefixed `_`.
- TS strict (`noUnusedLocals/Parameters`, `noUncheckedIndexedAccess`): no non-null assertion on user input — use `!` only after an explicit undefined check threw.
- Unit tests: `npm test -w backend` on the `mongoMemory` helper (`backend/src/__tests__/helpers/mongoMemory.ts`). E2E: `npm run test:e2e -w backend` (vitest.e2e.config.ts, per-worker Mongo, `seedBase()` fixtures, `createTestApi()`, factories, `drainOutbox()`; FakePushTransport via the transport setter).
- Never import from the known-failing on main e2e specs: fee-alerts (×2), fee-configuration-http. Do not plan to fix them.
- Every task commits with plain `git add`/`git commit` steps (executors handle their own auth/identities and never push).

## Review Focus

Five uncovered failure modes, most likely first; each pinning test lands in its owning task.

1. **Timezone day boundary** — "today or tomorrow" evaluated in UTC turns a late-evening class change into tomorrow in IST: push and attention silently skip. Pinned by the boundary test in Task 16 (`23:30 UTC change, Asia/Kolkata` — affected date is still today).
2. **Stacked exceptions on one date** — an occurrence cancelled on date D *plus* an incoming reschedule whose `newDate` is D: students must see both (the struck class and the moved-in class with `movedFrom`) in one sorted list. Pinned in Task 12 (`resolveDay` stacking test).
3. **An instalment paid between reads** — dues have no stored state: a payment that covers the current instalment must drop the fee item immediately on the next read. Pinned in Task 13 (`duesFor` after recording a payment).
4. **A reschedule targeting a published holiday** — spec §6 is unconditional: `resolveDay` must return `{ holiday, classes: [] }` for that day even though a class was moved *into* it; the move stays visible only in the ERP exception list. Pinned in Task 12 so an executor does not "fix" it by unioning the moved class back in.
5. **An offering with zero enrollments or absent faculty in resolveDay** — the class still appears; `faculty` (and `room`, `channelId`) omitted, `registered` = 0. Pinned in Task 12.

## File structure

Files this plan creates (`C`) or modifies (`M`), with each file's one responsibility. No file is touched outside these lists except `models/index.ts`-style generated barrels and `seed.ts`, which are listed too.

- C `backend/src/models/academic-ops/ClassException.ts` — the only new stored entity (§4).
- M `backend/src/models/index.ts` — barrel export for ClassException.
- C `backend/src/modules/academics/timetable-date.ts` — pure date/weekday/instant helpers (timezone-correct day math).
- C `backend/src/modules/academics/live-timetable.ts` — the live-read rule (R3) + active-semester ids.
- C `backend/src/modules/academics/class-exception-service.ts` — create/revoke/list/activeExceptionsFor + audit + outbox emit + validation.
- C `backend/src/modules/academics/push-tier.ts` — pure `classifyExceptionPushTier` (§8 tier rule).
- M `backend/src/modules/academics/validation.ts` — exception schemas.
- M `backend/src/modules/academics/routes.ts` — /class-exceptions routes.
- M `backend/src/modules/academics/controller.ts` — exception controllers.
- M `backend/src/modules/academics/service.ts` — marking endpoints recompute summaries via the shared formula.
- M `backend/src/modules/academics/academic-delivery-service.ts` — `computeAttendanceSummary` adopts the shared formula.
- C `backend/src/modules/academics/attendance-formula.ts` — the one formula (ERP + readers).
- C `backend/src/modules/juvi-app/home/resolve-day.ts` — day resolution (viewer → classes, exceptions applied, holiday).
- C `backend/src/modules/juvi-app/home/money.ts` — `toPaise(amount: number | null): number | null`, the R1 money boundary (rupees ×100, half-up, null passthrough).
- C `backend/src/modules/juvi-app/home/readers.ts` — the three home readers in one module: attendance (R12), dues (paise outputs via `toPaise`, instalment matching), assessments (internal + exam).
- C `backend/src/modules/juvi-app/home/attention.ts` — `extendedAttention` (kinds=all).
- C `backend/src/modules/juvi-app/home/schemas.ts` — Zod response schemas (today/teaching/me/attention).
- C `backend/src/modules/juvi-app/home/service.ts` — payload builders + account-kind gates.
- C `backend/src/modules/juvi-app/home/controller.ts` — home controllers.
- C `backend/src/modules/juvi-app/home/routes.ts` — `homeRouter`.
- M `backend/src/modules/juvi-app/routes.ts` — mount homeRouter (§7).
- M `backend/src/modules/juvi-app/notices/mobile-service.ts` — export uncapped `dueNoticeCards`.
- M `backend/src/modules/juvi-app/notices/mobile-controller.ts` — kinds param handling.
- M `backend/src/modules/juvi-app/notices/schemas.ts` — attention response schema widened.
- M `backend/src/modules/juvi-app/spaces/next-class.ts` — live rule + exceptions (§5.3).
- M `backend/src/modules/juvi-app/notifications/payload.ts` — `buildClassChangePush`.
- C `backend/src/modules/juvi-app/notifications/class-change-expand.ts` — recipient expansion for class_change.
- C `backend/src/modules/juvi-app/notifications/class-change-consumer.ts` — `class.exception.changed` consumer → `notification.requested`.
- M `backend/src/modules/juvi-app/notifications/expand-consumer.ts` — dispatch class_change sources.
- M `backend/src/modules/juvi-app/notifications/sender.ts` — `sendClassChangeGroup` branch + re-check.
- M `backend/src/models/juvi/NotificationDelivery.ts` — source type/kind widen + reasons (R34).
- M `backend/src/models/College.ts` — 3 `juvi` settings fields.
- M `backend/src/modules/juvi-app/config/institution-config.ts` — normalize the 3 fields.
- M `backend/src/modules/juvi-app/admin/schemas.ts` — settingsUpdateSchema gains them.
- M `backend/src/modules/juvi-app/openapi/document.ts` — components + route defs (§7).
- M `backend/src/modules/juvi-app/notifications/events-service.ts` — +4 event names.
- M `mobile/api/openapi.json` — regenerated (committed artifact).
- `mobile/packages/juvi_api/**` — regenerated by `mobile/tool/gen_api.sh` (executor commits; may need Java 17).
- M `backend/src/seed.ts` — current-term dates, timetable Mon–Sat, exception tomorrow, calendar holiday, 8 weeks attendance, open invoice + instalment, assessment 36h, ClassException deletion.
- M `backend/src/scripts/seed-e2e-users.ts` — `seedE2ETodayTeaching()`.
- C `backend/src/__e2e__/factories/academics-fixture.factory.ts` — today/teaching fixture builder (timetables, slots, exceptions, calendar).
- C `backend/src/__e2e__/modules/juvi-class-exceptions.e2e.test.ts`
- C `backend/src/__e2e__/modules/juvi-home.e2e.test.ts`
- C `backend/src/__e2e__/modules/juvi-attention.e2e.test.ts`
- C `backend/src/__e2e__/modules/juvi-class-change-push.e2e.test.ts`
- C `backend/src/__e2e__/modules/juvi-erp-parity.e2e.test.ts`
- C tests: `modules/academics/__tests__/class-exception.test.ts`, `modules/academics/__tests__/timetable-date.test.ts`, `modules/academics/__tests__/live-timetable.test.ts`, `modules/academics/__tests__/push-tier.test.ts`, `modules/academics/__tests__/attendance-formula.test.ts`, `models/academic-ops/__tests__/class-exception.model.test.ts`, `spaces/__tests__/next-class-live.test.ts`, `modules/juvi-app/home/__tests__/{attention-items,home-service}.test.ts`, `admin/__tests__/juvi-settings.test.ts`.

---

### Task 1: ClassException model and barrel export

**Files:**
- Create: `backend/src/models/academic-ops/ClassException.ts`
- Modify: `backend/src/models/index.ts` (after the `AttendanceSession` export in the Academic Ops block, ~line 48)
- Test: `backend/src/models/academic-ops/__tests__/class-exception.model.test.ts`

**Interfaces:**
- Consumes: nothing (new model).
- Produces: `ClassException`, `IClassException`, `LeanClassException`, `CLASS_EXCEPTION_TYPES` — used by the class-exception service (Task 4), readers (Tasks 11/12/15) and push (Task 16).

- [ ] **Step 1: Write the failing model test**

```typescript
// backend/src/models/academic-ops/__tests__/class-exception.model.test.ts
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { ClassException, LeanClassException } from '../ClassException';
import { Types } from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const cid = () => new Types.ObjectId();

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    collegeId: cid(),
    timetableSlotId: cid(),
    courseOfferingId: cid(),
    date: '2026-10-15',
    type: 'cancelled',
    reason: 'Faculty on university duty',
    createdBy: new Types.ObjectId('000000000000000000000001'),
    ...overrides,
  };
}

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

describe('ClassException', () => {
  it('stores a cancelled row', async () => {
    const row = await ClassException.create(valid());
    expect(String(row._id)).toBeTruthy();
    expect(row.date).toBe('2026-10-15');
    expect(row.type).toBe('cancelled');
    expect(row.revokedAt).toBeNull();
  });

  it('requires newDate/newStartTime/newEndTime for reschedules', async () => {
    await expect(ClassException.create(valid({ type: 'rescheduled' }))).rejects.toThrow(/newDate/);
    await expect(ClassException.create(valid({
      type: 'rescheduled', newDate: '2026-10-17', newStartTime: '10:00',
    }))).rejects.toThrow(/newEndTime/);
    const ok = await ClassException.create(valid({
      type: 'rescheduled', newDate: '2026-10-17', newStartTime: '10:00', newEndTime: '11:00',
    }));
    expect(ok.newDate).toBe('2026-10-17');
  });

  it('rejects a reason shorter than 5 characters', async () => {
    await expect(ClassException.create(valid({ reason: 'nope' }))).rejects.toThrow();
  });

  it('enforces one ACTIVE exception per (slot, date) but allows revoked alongside', async () => {
    const base = valid();
    await ClassException.create(base);
    await expect(ClassException.create(base)).rejects.toThrow(/duplicate key/);
    // Revoke the first, then the second create must succeed.
    const first = await ClassException.findOne({ date: '2026-10-15' }).lean<LeanClassException | null>();
    expect(first).not.toBeNull();
    await ClassException.updateOne({ _id: first!._id }, { $set: { revokedAt: new Date(), revokedBy: new Types.ObjectId('000000000000000000000002') } });
    await expect(ClassException.create(base)).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w backend -- --run models/academic-ops/__tests__/class-exception.model.test.ts`
Expected: FAIL — "Cannot find module '../ClassException'".

- [ ] **Step 3: Write the model**

```typescript
// backend/src/models/academic-ops/ClassException.ts
import { Schema, model, Document, Types, CallbackError } from 'mongoose';

export type ClassExceptionType = 'cancelled' | 'rescheduled';

export const CLASS_EXCEPTION_TYPES: readonly ClassExceptionType[] = ['cancelled', 'rescheduled'];

/**
 * One exception per (slot, date) occurrence, effective until revoked (spec §4):
 * cancel the class entirely, or move it to a new date/time/room. Rows are never
 * edited or deleted — a change is revoke-then-create — so every reader can
 * reason from active rows (revokedAt null) alone. `reason` is ERP-only text and
 * never reaches the app or a push. Dates are 'YYYY-MM-DD' strings in the
 * college timezone; times are 'HH:MM'.
 */
export interface IClassException extends Document {
  collegeId: Types.ObjectId;
  timetableSlotId: Types.ObjectId;   // → TimetableSlot (the original occurrence)
  courseOfferingId: Types.ObjectId;  // denormalised from the slot for reader scans
  date: string;                      // 'YYYY-MM-DD' — the original occurrence date
  type: ClassExceptionType;
  newDate?: string;                  // required when type is rescheduled
  newStartTime?: string;             // 'HH:MM'
  newEndTime?: string;               // 'HH:MM'
  newRoomId?: Types.ObjectId;        // → Room; omitted to keep the original room
  reason: string;                    // 5–300 chars
  createdBy: Types.ObjectId;         // → User
  revokedAt: Date | null;
  revokedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IClassException>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    timetableSlotId: { type: Schema.Types.ObjectId, ref: 'TimetableSlot', required: true },
    courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: { type: String, enum: CLASS_EXCEPTION_TYPES, required: true },
    newDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    newStartTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    newEndTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    newRoomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    reason: { type: String, required: true, minlength: 5, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// One ACTIVE exception per (slot, date); revoked rows coexist.
schema.index({ timetableSlotId: 1, date: 1 }, { unique: true, partialFilterExpression: { revokedAt: null } });
// Write-side and read-side scans (R37).
schema.index({ collegeId: 1, courseOfferingId: 1, date: 1 });
schema.index({ collegeId: 1, newDate: 1 });
schema.index({ collegeId: 1, date: 1, revokedAt: 1 });

// A reschedule carries all three new* fields and ends after it starts.
schema.pre('validate', function (next) {
  if (this.type === 'rescheduled') {
    if (!this.newDate) return next(new Error('A reschedule requires newDate') as CallbackError);
    if (!this.newStartTime) return next(new Error('A reschedule requires newStartTime') as CallbackError);
    if (!this.newEndTime) return next(new Error('A reschedule requires newEndTime') as CallbackError);
    const [sH = '0', sM = '0'] = this.newStartTime.split(':');
    const [eH = '0', eM = '0'] = this.newEndTime.split(':');
    if (Number(sH) * 60 + Number(sM) >= Number(eH) * 60 + Number(eM)) {
      return next(new Error('newStartTime must be before newEndTime') as CallbackError);
    }
  }
  next();
});

/** A lean read of a ClassException: fields only, no Document methods. */
export type LeanClassException = Omit<IClassException, keyof Document> & { _id: Types.ObjectId };

export const ClassException = model<IClassException>('ClassException', schema);
```

Note on destructured defaults: `sH ?? 0`-style fallbacks are needed because `noUncheckedIndexedAccess` types `split(':')` elements as `string | undefined`.

- [ ] **Step 4: Add the barrel export**

In `backend/src/models/index.ts`, inside the Academic Ops block (after the line `export { AttendanceSession } from './academic-ops/AttendanceSession';`, before `COAttainmentRecord`), add:

```typescript
export { ClassException, LeanClassException, CLASS_EXCEPTION_TYPES } from './academic-ops/ClassException';
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npm test -w backend -- --run models/academic-ops/__tests__/class-exception.model.test.ts`
Expected: PASS (4 tests).
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/academic-ops/ClassException.ts backend/src/models/academic-ops/__tests__/class-exception.model.test.ts backend/src/models/index.ts
git commit -m "feat(academics): ClassException model (Today&Teaching §4)"
```

---

### Task 2: timetable-date.ts — timezone day math

**Files:**
- Create: `backend/src/modules/academics/timetable-date.ts`
- Test: `backend/src/modules/academics/__tests__/timetable-date.test.ts`

**Interfaces:**
- Consumes: nothing (pure module; no imports except `Intl` usage).
- Produces: `DayEnum`, `DAYS`, `ymd(at, timezone)`, `dayEnumOf(date)`, `startOfDay(date, timezone)`, `addDays(date, n)`, `diffDays(a, b)`, `instantOf(date, hhmm, timezone)`, `hhmmToMinutes(hhmm)`, `overlaps(aStart, aEnd, bStart, bEnd)` — used by Tasks 3, 4, 6, 11, 12, 15, 16.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/academics/__tests__/timetable-date.test.ts
import { describe, expect, it } from 'vitest';
import {
  ymd, dayEnumOf, startOfDay, addDays, diffDays, instantOf, hhmmToMinutes, overlaps,
} from '../timetable-date';

describe('ymd', () => {
  it('formats the instant in the zone, not UTC', () => {
    // 2026-10-08T18:30:00Z is already 2026-10-09 00:00 in Asia/Kolkata.
    expect(ymd(new Date('2026-10-08T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-10-09');
    expect(ymd(new Date('2026-10-08T18:30:00Z'), 'UTC')).toBe('2026-10-08');
  });
  it('never returns a slashed or partial date', () => {
    expect(ymd(new Date('2026-01-01T00:00:00Z'), 'Pacific/Auckland')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dayEnumOf', () => {
  it('maps calendar dates to lowercase day enums (2026-01-01 is a Thursday)', () => {
    expect(dayEnumOf('2026-01-01')).toBe('thursday');
    expect(dayEnumOf('2026-01-03')).toBe('saturday');
    expect(dayEnumOf('2026-01-04')).toBe('sunday');
  });
});

describe('startOfDay', () => {
  it('returns the midnight instant of the zoned date', () => {
    expect(startOfDay('2026-01-01', 'Asia/Kolkata').toISOString()).toBe('2025-12-31T18:30:00.000Z');
  });
});

describe('addDays / diffDays', () => {
  it('wraps months and compares', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-10-08', 14)).toBe('2026-10-22');
    expect(diffDays('2026-10-09', '2026-10-08')).toBe(1);
    expect(diffDays('2026-10-08', '2026-10-09')).toBe(-1);
  });
});

describe('instantOf', () => {
  it('resolves a zoned wall-clock instant', () => {
    expect(instantOf('2026-01-01', '09:00', 'Asia/Kolkata').toISOString()).toBe('2026-01-01T03:30:00.000Z');
    expect(instantOf('2026-01-01', '07:00', 'America/New_York').toISOString()).toBe('2026-01-01T12:00:00.000Z');
  });
});

describe('hhmmToMinutes / overlaps', () => {
  it('treats touching slots as non-overlapping and inverted ranges as empty', () => {
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(overlaps('09:00', '10:00', '09:30', '11:00')).toBe(true);
    expect(overlaps('09:00', '10:00', '10:00', '11:00')).toBe(false); // strict overlap
    expect(overlaps('10:00', '09:00', '09:30', '10:30')).toBe(false); // degenerate
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w backend -- --run modules/academics/__tests__/timetable-date.test.ts`
Expected: FAIL — "Cannot find module '../timetable-date'".

- [ ] **Step 3: Implement**

```typescript
// backend/src/modules/academics/timetable-date.ts
/**
 * Pure date math for the timetable (Today&Teaching §5/§6). Every function is
 * timezone-correct: a 'day' is a college-timezone day, never a UTC day. The
 * wall-clock math mirrors the notification policy's approach (private there;
 * duplicated here to keep this module import-free) with the no-DST simplification
 * for Asia/Kolkata explicitly valid via the real Intl offset lookup.
 */

export type DayEnum =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS: readonly DayEnum[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const UTC_DAY_BY_En_US_SHORT: Record<string, DayEnum> = {
  Sun: 'sunday', Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday',
  Thu: 'thursday', Fri: 'friday', Sat: 'saturday',
};

function partsOf(at: Date, timezone: string): {
  y: number; m: number; d: number; minutes: number; weekday: DayEnum;
} {
  // en-CA formats the day as YYYY-MM-DD exactly.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? 0 : p.hour; // ICU can emit 24 for midnight in hour12: false
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    minutes: Number(hour) * 60 + Number(p.minute) + Number(p.second) / 60,
    weekday: UTC_DAY_BY_En_US_SHORT[p.weekday ?? 'Sun'] ?? 'sunday',
  };
}

/** The calendar date 'YYYY-MM-DD' of the instant, in the zone. */
export function ymd(at: Date, timezone: string): string {
  const p = partsOf(at, timezone);
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** The lowercase weekday of a plain 'YYYY-MM-DD' date (UTC-parsed; no zone involved). */
export function dayEnumOf(date: string): DayEnum {
  const dayIndex = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return DAYS[(dayIndex + 6) % 7]!;
}

/**
 * The instant midnight of a zoned date: the UTC instant whose y/m/d parts, read
 * back in the zone, equal those of `date`. Fixed-point iteration (converges in
 * ≤3 passes) — exact for any zone and offset shape, including half-hour and
 * quarter-hour offsets.
 */
export function startOfDay(date: string, timezone: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return fromWall(y, m, d, 0, timezone);
}

/** The instant of `date` at `hh:mm` wall-clock, in the zone. */
export function instantOf(date: string, hhmm: string, timezone: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const minutes = hhmmToMinutes(hhmm);
  return fromWall(y, m, d, minutes, timezone);
}

function fromWall(y: number, m: number, d: number, minutes: number, timezone: string): Date {
  let at = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  for (let i = 0; i < 3; i += 1) {
    const p = partsOf(at, timezone);
    const delta = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60) - Date.UTC(p.y, p.m - 1, p.d, 0, p.minutes);
    if (delta === 0) return at;
    at = new Date(at.getTime() + delta);
  }
  return at;
}

export function addDays(date: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Days a − b as a whole number (calendar dates; no zone involved). */
export function diffDays(a: string, b: string): number {
  const [ay = 1970, am = 1, ad = 1] = a.split('-').map(Number);
  const [by = 1970, bm = 1, bd = 1] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h = '0', mm = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(mm);
}

/** Strict overlaps of half-open [start, end) HH:MM ranges; inverted ranges are empty. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = hhmmToMinutes(aStart); const aE = hhmmToMinutes(aEnd);
  const bS = hhmmToMinutes(bStart); const bE = hhmmToMinutes(bEnd);
  return aS < aE && bS < bE && aS < bE && bS < aE;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -w backend -- --run modules/academics/__tests__/timetable-date.test.ts`
Expected: PASS.
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/academics/timetable-date.ts backend/src/modules/academics/__tests__/timetable-date.test.ts
git commit -m "feat(academics): timezone-correct timetable date helpers"
```
---

### Task 3: live-timetable.ts — the live-read rule

**Files:**
- Create: `backend/src/modules/academics/live-timetable.ts`
- Test: `backend/src/modules/academics/__tests__/live-timetable.test.ts`

**Interfaces:**
- Consumes: `Timetable`, `TimetableSlot`, `Semester` models; `ymd`, `dayEnumOf`, `startOfDay`, `addDays` (Task 2).
- Produces: `getLiveTimetable(collegeId, sectionId, at, timezone): Promise<LeanTimetable | null>`, `getLiveTimetables(collegeId, at, timezone): Promise<Map<string, LeanTimetable>>` (key = sectionId string), `liveSlotsForDay(collegeId, sectionIds, at, timezone): Promise<LeanTimetableSlot[]>` (sorted by startTime then period; `'free'` excluded), `activeSemesterIds(collegeId): Promise<string[]>`, types `LeanTimetable`, `LeanTimetableSlot` — used by Tasks 5, 8, 12.
- **`timezone` is the college timezone and the window is judged on the college-LOCAL day** (`ymd(at, timezone)`), matching the weekday rule in the same file (R53). Every caller already holds the timezone; never pass a bare instant without it.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/academics/__tests__/live-timetable.test.ts
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Semester } from '../../../models/academic-structure/Semester';
import { getLiveTimetable, getLiveTimetables, liveSlotsForDay, activeSemesterIds } from '../live-timetable';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const cid = '000000000000000000000001';
const cidO = () => new Types.ObjectId(cid);
const semId = new Types.ObjectId();
const secId = new Types.ObjectId();
const offerId = new Types.ObjectId();

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

function createTimetable(version: number, opts: { from?: string; to?: string; status?: 'draft' | 'published' | 'archived' } = {}) {
  return Timetable.create({
    collegeId: cidO(), semesterId: semId, sectionId: secId,
    version,
    status: opts.status ?? 'published',
    effectiveFrom: opts.from ? new Date(`${opts.from}T00:00:00Z`) : new Date('2026-10-01T00:00:00Z'),
    ...(opts.to ? { effectiveTo: new Date(`${opts.to}T00:00:00Z`) } : {}),
  });
}

describe('getLiveTimetable', () => {
  it('picks the highest version among published coverings', async () => {
    await createTimetable(1);
    const v2 = await createTimetable(2);
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(v2._id));
  });

  it('falls back to the earlier covering when the newer one has not started', async () => {
    const v1 = await createTimetable(1, { from: '2026-10-01' });
    await createTimetable(2, { from: '2026-10-20' });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(v1._id));
  });

  it('excludes drafts, archived versions and expired windows', async () => {
    await createTimetable(1, { from: '2026-09-01', to: '2026-09-30' });
    await createTimetable(2, { from: '2026-10-01', to: '2026-10-31', status: 'draft' });
    await createTimetable(3, { from: '2026-10-01', status: 'archived' });
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC')).toBeNull();
  });

  it('treats window boundaries as inclusive', async () => {
    const t = await createTimetable(1, { from: '2026-10-01', to: '2026-10-10' });
    const atStart = await getLiveTimetable(cid, String(secId), new Date('2026-10-01T00:00:00Z'), 'UTC');
    const atEnd = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T03:39:00Z'), 'UTC');
    expect(String(atStart!._id)).toBe(String(t._id));
    expect(String(atEnd!._id)).toBe(String(t._id));
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-10-11T00:00:00Z'), 'UTC')).toBeNull();
  });

  it('breaks equal versions by newest updatedAt', async () => {
    await createTimetable(3);
    await new Promise((r) => setTimeout(r, 20));
    const newer = await createTimetable(3);
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(newer._id));
  });

  it('breaks equal versions by newest updatedAt, not by _id order', async () => {
    // The winner by `updatedAt` is inserted FIRST, so it carries the SMALLER _id: a sort
    // keyed on _id picks the other row. This test and the one above pin DIFFERENT
    // regressions — the one above catches a deleted tie-break, this one catches a
    // tie-break substituted for _id order. Keep both (R55).
    const newest = await createTimetable(3);
    await new Promise((r) => setTimeout(r, 20));
    await createTimetable(3);
    // Raw driver: bypasses Mongoose's timestamp plugin, so the bump is deterministic.
    await Timetable.collection.updateOne({ _id: newest._id }, { $currentDate: { updatedAt: true } });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(newest._id));
  });

  it('judges the window on the college-local day, not the instant\'s UTC day', async () => {
    // The term starts 2026-10-13 (stored at UTC midnight). Local midnight of that
    // date in IST is 2026-10-12T18:30Z, whose UTC date is the 12th — an instant-day
    // comparison would drop the term's first day; the local-day rule keeps it live. R53.
    const t = await createTimetable(1, { from: '2026-10-13' });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-12T18:30:00Z'), 'Asia/Kolkata');
    expect(String(out!._id)).toBe(String(t._id));
  });

  it('keeps the window live through its last local day and not the day after', async () => {
    // The window ends 2026-11-08, stored at UTC midnight, so its last covered LOCAL day in
    // IST is 2026-11-08. Local midnight of 11-09 in IST is 2026-11-08T18:30Z, whose UTC date
    // is still 11-08 — a UTC-day rule would keep this timetable live into 11-09 and show
    // classes the day after the term ended. The last day stays live. R53/R56.
    const t = await createTimetable(1, { from: '2026-10-01', to: '2026-11-08' });
    const lastDay = await getLiveTimetable(cid, String(secId), new Date('2026-11-07T18:30:00Z'), 'Asia/Kolkata');
    expect(String(lastDay!._id)).toBe(String(t._id));
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-11-08T18:30:00Z'), 'Asia/Kolkata')).toBeNull();
  });

  it('builds each day bound from the local day, so a DST transition cannot stretch the range', async () => {
    // 2026-03-08 is the US spring-forward day in America/New_York: local midnight of 03-08 is
    // 2026-03-08T05:00Z (EST) and of 03-09 is 2026-03-09T04:00Z (EDT) — a 23-hour local day. A
    // range built as `dayStart + 86_400_000` would put this window's dayEnd at 05:00Z and
    // wrongly cover 03-08; deriving it with `startOfDay(addDays(day, 1), timezone)` gives
    // 04:00Z and excludes it. R57.
    // The probe instant is the local EVENING of 03-08 (22:00 EDT = 02:00Z on 03-09), so its UTC
    // date (03-09) is NOT its local date (03-08). That is what makes the ANCHOR — not only the
    // step — observable here, so this test also fails if `dayStart` reverts to a UTC midnight
    // (a UTC-anchored day resolves 03-09 and wrongly covers this timetable). A probe at local
    // midnight would have UTC date == local date and hide the anchor entirely. R59.
    const t = await Timetable.create({
      collegeId: cidO(), semesterId: semId, sectionId: secId,
      version: 1, status: 'published',
      effectiveFrom: new Date('2026-03-09T04:30:00Z'), // 30 min into the local day 03-09
    });
    const dayBefore = await getLiveTimetable(cid, String(secId), new Date('2026-03-09T02:00:00Z'), 'America/New_York');
    expect(dayBefore).toBeNull();
    const firstDay = await getLiveTimetable(cid, String(secId), new Date('2026-03-09T04:00:00Z'), 'America/New_York');
    expect(String(firstDay!._id)).toBe(String(t._id));
  });
});

describe('liveSlotsForDay', () => {
  it('returns only that weekday\'s real slots of the live timetable, sorted', async () => {
    const t = await createTimetable(1);
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 1, startTime: '11:00', endTime: '12:00', courseOfferingId: offerId });
    const early = await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 2, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'tuesday', period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 3, startTime: '12:00', endTime: '13:00', courseOfferingId: offerId, slotType: 'free' });

    // 2026-10-12 is a Monday; 06:00Z is 11:30 IST.
    const slots = await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata');
    expect(slots.map((s) => s.startTime)).toEqual(['09:00', '11:00']);
    expect(String(slots[0]!._id)).toBe(String(early._id));
  });

  it('breaks equal start times by period', async () => {
    const t = await createTimetable(1);
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 5, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    const p2 = await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 2, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    const slots = await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata');
    expect(slots.map((s) => s.period)).toEqual([2, 5]);
    expect(String(slots[0]!._id)).toBe(String(p2._id));
  });

  it('returns nothing for a section with no live timetable', async () => {
    expect(await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata')).toEqual([]);
  });
});

describe('getLiveTimetables / activeSemesterIds', () => {
  it('maps one live timetable per section and lists only active semesters', async () => {
    await createTimetable(1);
    const map = await getLiveTimetables(cid, new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(map.size).toBe(1);

    await Semester.create({ collegeId: cidO(), academicYearId: new Types.ObjectId(), number: 1, year: 2026, startDate: new Date(), endDate: new Date(), status: 'active' });
    await Semester.create({ collegeId: cidO(), academicYearId: new Types.ObjectId(), number: 2, year: 2026, startDate: new Date(), endDate: new Date(), status: 'upcoming' });
    const ids = await activeSemesterIds(cid);
    expect(ids).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w backend -- --run modules/academics/__tests__/live-timetable.test.ts`
Expected: FAIL — "Cannot find module '../live-timetable'".

- [ ] **Step 3: Implement**

```typescript
// backend/src/modules/academics/live-timetable.ts
/**
 * The live-timetable read rule (Today&Teaching §5.3 / R3): a Timetable that is
 * `status:'published'` and whose effective window covers the date; the highest
 * version wins, newest `updatedAt` on ties. Readers resolve per section;
 * nothing here mutates.
 */
import { Document, Types } from 'mongoose';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { Semester } from '../../models/academic-structure/Semester';
import { addDays, dayEnumOf, startOfDay, ymd } from './timetable-date';

export type LeanTimetable = Omit<InstanceType<typeof Timetable>, keyof Document> & { _id: Types.ObjectId };
export type LeanTimetableSlot = Omit<InstanceType<typeof TimetableSlot>, keyof Document> & { _id: Types.ObjectId };

/**
 * The live window is compared at DATE granularity, never by instant (R3/§5.3:
 * `effectiveFrom ≤ date ≤ (effectiveTo ?? ∞)`). A timetable whose `effectiveTo`
 * is 2026-10-10 stays live for the whole of 2026-10-10 — an instant comparison
 * would drop it from midnight onward and contradict this module's own boundary
 * test. Bounds are stored as calendar days, so a half-open day range is the exact test.
 *
 * The day is the COLLEGE-LOCAL day — `ymd(at, timezone)` — matching the weekday
 * this same module judges in `timezone`. `at`'s UTC day is the *previous* local
 * day for every positive-offset zone (local midnight of 2026-10-13 in IST is
 * 2026-10-12T18:30Z), so judging the window on the UTC day would silently shift
 * every window by one day: the term's first day would read as not-live and the
 * day after it ended would read as live. R53.
 */
const covering = (at: Date, timezone: string) => {
  const day = ymd(at, timezone);
  const dayStart = startOfDay(day, timezone);
  const dayEnd = startOfDay(addDays(day, 1), timezone);
  return {
    status: 'published' as const,
    effectiveFrom: { $lt: dayEnd },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: dayStart } }],
  };
};

export async function getLiveTimetable(collegeId: string, sectionId: string, at: Date, timezone: string): Promise<LeanTimetable | null> {
  const rows = await Timetable.find({
    collegeId, sectionId, ...covering(at, timezone),
  }).sort({ version: -1, updatedAt: -1 }).limit(1).lean<LeanTimetable[]>();
  return rows[0] ?? null;
}

export async function getLiveTimetables(collegeId: string, at: Date, timezone: string): Promise<Map<string, LeanTimetable>> {
  const rows = await Timetable.find({ collegeId, ...covering(at, timezone) })
    .sort({ version: -1, updatedAt: -1 })
    .lean<LeanTimetable[]>();
  // Sorted version-desc, so the FIRST row seen per section is the winner.
  const bySection = new Map<string, LeanTimetable>();
  for (const t of rows) {
    const key = String(t.sectionId);
    if (!bySection.has(key)) bySection.set(key, t);
  }
  return bySection;
}

/** Real slots (never `free`) for the sections on `at`'s zoned weekday, start-sorted, period tiebreak. */
export async function liveSlotsForDay(
  collegeId: string, sectionIds: string[], at: Date, timezone: string,
): Promise<LeanTimetableSlot[]> {
  const live = await getLiveTimetables(collegeId, at, timezone);
  const timetableIds: string[] = [];
  for (const sectionId of sectionIds) {
    const t = live.get(sectionId);
    if (t) timetableIds.push(String(t._id));
  }
  if (timetableIds.length === 0) return [];
  const slots = await TimetableSlot.find({
    collegeId, timetableId: { $in: timetableIds }, day: dayEnumOf(ymd(at, timezone)), slotType: { $ne: 'free' },
  }).lean<LeanTimetableSlot[]>();
  return slots.sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.period - b.period;
  });
}

/** Ids of the college's active semesters; readers scope schedules to the current term. */
export async function activeSemesterIds(collegeId: string): Promise<string[]> {
  const rows = await Semester.find({ collegeId, status: 'active' }).select('_id').lean<{ _id: Types.ObjectId }[]>();
  return rows.map((r) => String(r._id));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -w backend -- --run modules/academics/__tests__/live-timetable.test.ts`
Expected: PASS.
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/academics/live-timetable.ts backend/src/modules/academics/__tests__/live-timetable.test.ts
git commit -m "feat(academics): live timetable read rule (highest version published)"
```

---

### Task 4: class-exception-service.ts — create/revoke/list/active

**Files:**
- Create: `backend/src/modules/academics/class-exception-service.ts`
- Test: `backend/src/modules/academics/__tests__/class-exception.test.ts`

**Interfaces:**
- Consumes: `ClassException`, `LeanClassException`, `IClassException`, `ClassExceptionType` (Task 1); `Timetable`, `TimetableSlot`, `Course`, `CourseOffering` models; `ymd`, `dayEnumOf`, `diffDays`, `hhmmToMinutes` (Task 2 — no `getLiveTimetable` here: the window check pins the slot's own timetable, see step 3); `emit` from `../../shared/outbox/outbox`; `createAuditLog` from `../../shared/audit`; `getJuviConfig` from `../juvi-app/config/institution-config`.
- Produces:
  - `type ClassChangeAction = 'created' | 'revoked'`
  - `CLASS_EVENTS = { CHANGED: 'class.exception.changed' }`
  - `classExceptionEventKey.changed(exceptionId, action): string` → `class-exception:<id>:<action>`
  - `collegeTimezone(collegeId): Promise<string>` — `getJuviConfig(collegeId)?.timezone ?? 'Asia/Kolkata'` (R41); Redis-down falls through to Mongo inside `getJuviConfig`.
  - `interface ClassExceptionInput { timetableSlotId: string; date: string; type: ClassExceptionType; newDate?: string; newStartTime?: string; newEndTime?: string; newRoomId?: string; reason: string }`
  - `createClassException(collegeId, input, performingUserId): Promise<LeanClassException>`
  - `revokeClassException(collegeId, id, performingUserId): Promise<LeanClassException>` (second revoke → 409 `'Class exception already revoked'`)
  - `listClassExceptions(collegeId, { offeringId?, slotId?, from?, to? }): Promise<LeanClassException[]>`
  - `activeExceptionsFor(collegeId, { slotIds?, offeringIds?, dates? }): Promise<LeanClassException[]>` (R38 — dates match `date` OR `newDate`)
- used by Tasks 5 (conflict check calls `activeExceptionsFor`), 7 (routes), 8 (next-class), 11 (resolve-day), 15 (attention), 16 (push consumer + sender re-check, which read the model directly).

Validation order in `createClassException`, exact messages, all `AppError`:
1. slot exists → 404 `'Class slot not found'`.
2. `date` shape (`/^\d{4}-\d{2}-\d{2}$/`) → 400 `'date must be YYYY-MM-DD'`.
3. `dayEnumOf(date) !== slot.day` → 400 `` `Class date does not fall on the slot's weekday (${slot.day})` ``.
4. `diffDays(date, today) < 0` — `today = ymd(new Date(), timezone)` with the college tz (R23) → 400 `'Class date is in the past'`.
5. Window: the slot's own Timetable must be `status:'published'` (else 404 `'Class slot not found'`) and its effective window must cover `date` at date granularity (`ymd(effectiveFrom, tz) <= date` and `!effectiveTo || date <= ymd(effectiveTo, tz)`), else 400 `'Class date lies outside the live timetable window'`. The check pins the slot's own timetable, not the live winner — an exception attaches to a specific slot; R3 governs reads, not this validation.
6. Active duplicate for (slot, date) → 409 `'This class already has an active exception for that date'` (the partial unique index backstops the race with 11000).
7. Reschedule: `newDate`, `newStartTime`, `newEndTime` all present → 400 `'A reschedule requires newDate, newStartTime and newEndTime'`; `newDate` shape; `diffDays(newDate, today) < 0` → 400 `'Reschedule target date is in the past'`; `diffDays(newDate, today) > 14` → 400 `'Reschedule target must be within 14 days of today'`; `hhmmToMinutes(newStartTime) >= hhmmToMinutes(newEndTime)` → 400 `'newStartTime must be before newEndTime'`. A cancellation carries no `new*` fields (strip any that were sent).
8. Create (`courseOfferingId` denormalised from the slot), audit `action:'create'` with `changes: []` and `entityName: '<course.code> on <date>'` (the raw offeringId string when no Course resolves), emit, return the lean row.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/academics/__tests__/class-exception.test.ts
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { AuditLog } from '../../../shared/audit';
import { OutboxEvent } from '../../../shared/outbox';
import {
  createClassException, revokeClassException, listClassExceptions, activeExceptionsFor,
  CLASS_EVENTS, classExceptionEventKey,
} from '../class-exception-service';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const CID = '000000000000000000000001';
const USER = '000000000000000000000002';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

/** A published timetable (open-ended unless `from`/`to` given) with one Monday 09:00-10:00 slot. */
async function seedSlot(opts: { from?: string; to?: string; day?: string } = {}) {
  const course = await Course.create({
    collegeId: new Types.ObjectId(CID), code: 'CS301', name: 'Databases',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 3, lectureHrs: 2, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId: new Types.ObjectId(CID), courseId: course._id, semesterId: new Types.ObjectId(),
    sectionId: new Types.ObjectId(), facultyId: new Types.ObjectId(), maxEnrollment: 60, enrolledCount: 40,
  });
  const timetable = await Timetable.create({
    collegeId: new Types.ObjectId(CID), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
    version: 1, status: 'published',
    effectiveFrom: opts.from ? new Date(`${opts.from}T00:00:00+05:30`) : new Date(),
    ...(opts.to ? { effectiveTo: new Date(`${opts.to}T00:00:00+05:30`) } : {}),
  });
  const slot = await TimetableSlot.create({
    collegeId: new Types.ObjectId(CID), timetableId: timetable._id, day: opts.day ?? 'monday', period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id,
  });
  return { course, offering, timetable, slot };
}

/** First date ≥ today+minDays that is a `weekday` ('monday'…), in Asia/Kolkata. */
function upcoming(day: string, minDays = 2): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  const want = day.slice(0, 3);
  for (let i = minDays; i < minDays + 8; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    if (weekday.format(d).toLowerCase() === want) return fmt.format(d);
  }
  throw new Error('no upcoming date');
}

describe('createClassException', () => {
  it('creates a cancellation, writes audit and emits the outbox event', async () => {
    const { slot, course, offering } = await seedSlot();
    const date = upcoming('monday');
    const row = await createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER);
    expect(row.type).toBe('cancelled');
    expect(row.revokedAt).toBeNull();
    expect(String(row.courseOfferingId)).toBe(String(offering._id));

    const audits = await AuditLog.find({ entityType: 'ClassException', entityId: String(row._id) }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('create');
    expect(audits[0]!.entityName).toBe(`${course.code} on ${date}`);

    const events = await OutboxEvent.find({ type: CLASS_EVENTS.CHANGED }).lean();
    expect(events.map((e) => e.dedupeKey)).toContain(classExceptionEventKey.changed(String(row._id), 'created'));
  });

  it('rejects weekday mismatch, a 5-char-minimum reason, and duplicates, in order', async () => {
    const { slot } = await seedSlot();
    const reason = 'Faculty attending a workshop';
    const date = upcoming('monday');
    // 2026-01-01 is a Thursday; the slot is a Monday slot. Weekday fires before the past-date check.
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date: '2026-01-01', type: 'cancelled', reason,
    }, USER)).rejects.toThrow(/weekday/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason: 'nope',
    }, USER)).rejects.toThrow(/reason/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason,
    }, USER)).resolves.toBeTruthy();
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason,
    }, USER)).rejects.toThrow(/already has an active exception/);
  });

  it('rejects a closed window (effectiveTo before the date)', async () => {
    const { slot } = await seedSlot({ from: '2026-01-10', to: '2026-01-20' });
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday'), type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER)).rejects.toThrow(/outside the live timetable window/);
  });

  it('rejects reschedules beyond 14 days, in the past, or ending at their start', async () => {
    const { slot } = await seedSlot();
    const date = upcoming('monday');
    const tooFar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 16 * 86_400_000));
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled', newDate: tooFar, newStartTime: '10:00', newEndTime: '11:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/within 14 days/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled', newDate: '2026-01-01', newStartTime: '10:00', newEndTime: '11:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/Reschedule target date is in the past/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled', newDate: date, newStartTime: '11:00', newEndTime: '11:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/before newEndTime/);
  });

  it('404s for unknown slots', async () => {
    await expect(createClassException(CID, {
      timetableSlotId: new Types.ObjectId().toString(), date: upcoming('monday'), type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER)).rejects.toThrow(/not found/);
  });

  it('does not leak another college\'s course code into the audit name (falls back to the offering id)', async () => {
    const { slot, offering } = await seedSlot();
    const foreignCourse = await Course.create({
      collegeId: new Types.ObjectId(), code: 'XX999', name: 'Foreign Course',
      regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
      credits: 3, type: 'theory',
    });
    // The offering stays in this college; its course does not.
    await CourseOffering.updateOne({ _id: offering._id }, { $set: { courseId: foreignCourse._id } });

    const date = upcoming('monday');
    const row = await createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER);

    const audits = await AuditLog.find({ entityType: 'ClassException', entityId: String(row._id) }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]!.entityName).not.toContain('XX999');
    expect(audits[0]!.entityName).toContain(String(offering._id));
  });
});

describe('revokeClassException', () => {
  it('revokes, writes an archive audit, emits revoked; second revoke 409s', async () => {
    const { slot } = await seedSlot();
    const row = await createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday'), type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER);
    const revoked = await revokeClassException(CID, String(row._id), USER);
    expect(revoked.revokedAt).not.toBeNull();
    const events = await OutboxEvent.find({ type: CLASS_EVENTS.CHANGED }).lean();
    expect(events.map((e) => e.dedupeKey)).toContain(classExceptionEventKey.changed(String(row._id), 'revoked'));
    expect(await AuditLog.countDocuments({ entityId: String(row._id), action: 'archive' })).toBe(1);
    await expect(revokeClassException(CID, String(row._id), USER)).rejects.toThrow(/already revoked/);
  });

  it('404s for unknown ids', async () => {
    await expect(revokeClassException(CID, new Types.ObjectId().toString(), USER)).rejects.toThrow(/not found/);
  });
});

describe('listClassExceptions / activeExceptionsFor', () => {
  it('filters by offering/slot/range; active excludes revoked and matches date or newDate', async () => {
    const { slot, offering } = await seedSlot();
    const reason = 'Faculty attending a workshop';
    const a = await createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday', 2), type: 'cancelled', reason,
    }, USER);
    await revokeClassException(CID, String(a._id), USER);
    const b = await createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday', 9), type: 'rescheduled',
      newDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
      newStartTime: '14:00', newEndTime: '15:00', reason,
    }, USER);

    expect(await listClassExceptions(CID, { offeringId: String(offering._id) })).toHaveLength(2);
    expect(await listClassExceptions(CID, { slotId: String(slot._id) })).toHaveLength(2);

    const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const active = await activeExceptionsFor(CID, { dates: [todayIst] });
    // `a` is revoked; `b` matches via newDate. When today is itself a Monday this
    // still holds: the (slot, date) uniqueness is on the original date, and
    // upcoming(2,9) is never today.
    expect(active.map((x) => String(x._id))).toEqual([String(b._id)]);
    expect(await activeExceptionsFor(CID, { offeringIds: [String(offering._id)] })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w backend -- --run modules/academics/__tests__/class-exception.test.ts`
Expected: FAIL — "Cannot find module '../class-exception-service'".

- [ ] **Step 3: Implement the service**

```typescript
// backend/src/modules/academics/class-exception-service.ts
/**
 * Class exceptions (Today&Teaching §4/§5). One active row per (slot, date).
 * Changes are revoke-then-create — rows are never edited or deleted. CUD writes
 * audit logs and emits `class.exception.changed` over the outbox so the Juvi
 * notification pipeline (plan task 16) reacts. Section/room conflict checks are
 * wired in by plan task 5.
 */
import { Document, Types } from 'mongoose';
import { ClassException, LeanClassException, IClassException, ClassExceptionType } from '../../models/academic-ops/ClassException';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { emit } from '../../shared/outbox/outbox';
import { getJuviConfig } from '../juvi-app/config/institution-config';
import { ymd, dayEnumOf, diffDays, hhmmToMinutes } from './timetable-date';

export const CLASS_EVENTS = { CHANGED: 'class.exception.changed' } as const;
export type ClassChangeAction = 'created' | 'revoked';
export const classExceptionEventKey = {
  changed: (exceptionId: string, action: ClassChangeAction): string => `class-exception:${exceptionId}:${action}`,
};

export async function collegeTimezone(collegeId: string): Promise<string> {
  const cfg = await getJuviConfig(collegeId);
  return cfg?.timezone ?? 'Asia/Kolkata';
}

export interface ClassExceptionInput {
  timetableSlotId: string;
  date: string;
  type: ClassExceptionType;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  newRoomId?: string;
  reason: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type LeanSlot = Omit<InstanceType<typeof TimetableSlot>, keyof Document> & { _id: Types.ObjectId };
type LeanTimetableOfSlot = Omit<InstanceType<typeof Timetable>, keyof Document> & { _id: Types.ObjectId };

/**
 * The validation steps run in the order the brief's numbered list gives:
 * slot → date shape → weekday → past → window → duplicate → reschedule.
 */
export async function createClassException(
  collegeId: string, input: ClassExceptionInput, performingUserId: string,
): Promise<LeanClassException> {
  const slot = await TimetableSlot.findOne({ _id: input.timetableSlotId, collegeId }).lean<LeanSlot | null>();
  if (!slot) throw new AppError(404, 'Class slot not found');

  if (!DATE_RE.test(input.date)) throw new AppError(400, 'date must be YYYY-MM-DD');

  const timezone = await collegeTimezone(collegeId);
  const today = ymd(new Date(), timezone);

  if (dayEnumOf(input.date) !== slot.day) {
    throw new AppError(400, `Class date does not fall on the slot's weekday (${slot.day})`);
  }
  if (diffDays(input.date, today) < 0) throw new AppError(400, 'Class date is in the past');

  // The exception pins a specific slot, so the window check uses the slot's own
  // timetable; the live-winner rule governs reads (task 3), not this validation.
  const timetable = await Timetable.findOne({ _id: slot.timetableId, collegeId }).lean<LeanTimetableOfSlot | null>();
  if (!timetable || timetable.status !== 'published') throw new AppError(404, 'Class slot not found');

  const fromDate = ymd(timetable.effectiveFrom, timezone);
  const toDate = timetable.effectiveTo ? ymd(timetable.effectiveTo, timezone) : null;
  if (fromDate > input.date || (toDate !== null && input.date > toDate)) {
    throw new AppError(400, 'Class date lies outside the live timetable window');
  }

  const dup = await ClassException.findOne({ collegeId, timetableSlotId: input.timetableSlotId, date: input.date, revokedAt: null }).lean();
  if (dup) throw new AppError(409, 'This class already has an active exception for that date');

  let patch: Partial<IClassException> = {};
  if (input.type === 'rescheduled') {
    if (!input.newDate || !input.newStartTime || !input.newEndTime) {
      throw new AppError(400, 'A reschedule requires newDate, newStartTime and newEndTime');
    }
    if (!DATE_RE.test(input.newDate)) throw new AppError(400, 'newDate must be YYYY-MM-DD');
    if (diffDays(input.newDate, today) < 0) throw new AppError(400, 'Reschedule target date is in the past');
    if (diffDays(input.newDate, today) > 14) throw new AppError(400, 'Reschedule target must be within 14 days of today');
    if (hhmmToMinutes(input.newStartTime) >= hhmmToMinutes(input.newEndTime)) {
      throw new AppError(400, 'newStartTime must be before newEndTime');
    }
    patch = {
      newDate: input.newDate,
      newStartTime: input.newStartTime,
      newEndTime: input.newEndTime,
      newRoomId: input.newRoomId ? new Types.ObjectId(input.newRoomId) : undefined,
    };
  }

  const doc = await ClassException.create({
    collegeId: new Types.ObjectId(collegeId),
    timetableSlotId: slot._id,
    courseOfferingId: slot.courseOfferingId,
    date: input.date,
    type: input.type,
    ...patch,
    reason: input.reason,
    createdBy: new Types.ObjectId(performingUserId),
  });

  await createAuditLog({
    collegeId,
    entityType: 'ClassException',
    entityId: String(doc._id),
    entityName: await entityName(collegeId, String(slot.courseOfferingId), input.date),
    action: 'create',
    changes: [],
    performedBy: performingUserId,
  });

  await emit(
    CLASS_EVENTS.CHANGED,
    { collegeId, exceptionId: String(doc._id), action: 'created' },
    classExceptionEventKey.changed(String(doc._id), 'created'),
  );

  return doc.toObject() as unknown as LeanClassException;
}

async function entityName(collegeId: string, offeringId: string, date: string): Promise<string> {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId }).select('courseId').lean<{ courseId: Types.ObjectId } | null>();
  if (!offering) return `${offeringId} on ${date}`;
  // Scoped by collegeId: `course.code` lands in AuditLog.entityName, a collection
  // shared across colleges. `findOne({ _id, collegeId })` — not `findById(id,
  // collegeId)`, whose second argument is a projection and would filter nothing.
  const course = await Course.findOne({ _id: offering.courseId, collegeId }).lean<{ code: string } | null>();
  return `${course ? course.code : offeringId} on ${date}`;
}

export async function revokeClassException(
  collegeId: string, id: string, performingUserId: string,
): Promise<LeanClassException> {
  const doc = await ClassException.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Class exception not found');
  if (doc.revokedAt) throw new AppError(409, 'Class exception already revoked');
  doc.set({ revokedAt: new Date(), revokedBy: new Types.ObjectId(performingUserId) });
  await doc.save();
  const lean = doc.toObject() as unknown as LeanClassException;

  await createAuditLog({
    collegeId, entityType: 'ClassException', entityId: String(doc._id),
    entityName: `exception on ${doc.date}`, action: 'archive', changes: [], performedBy: performingUserId,
  });
  await emit(
    CLASS_EVENTS.CHANGED,
    { collegeId, exceptionId: String(doc._id), action: 'revoked' },
    classExceptionEventKey.changed(String(doc._id), 'revoked'),
  );
  return lean;
}

export async function listClassExceptions(
  collegeId: string, filter: { offeringId?: string; slotId?: string; from?: string; to?: string },
): Promise<LeanClassException[]> {
  const where: Record<string, unknown> = { collegeId };
  if (filter.offeringId) where.courseOfferingId = filter.offeringId;
  if (filter.slotId) where.timetableSlotId = filter.slotId;
  if (filter.from || filter.to) {
    const range: Record<string, unknown> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    where.date = range;
  }
  return ClassException.find(where).sort({ date: -1, createdAt: -1 }).limit(200).lean<LeanClassException[]>();
}

export async function activeExceptionsFor(
  collegeId: string, selector: { slotIds?: string[]; offeringIds?: string[]; dates?: string[] },
): Promise<LeanClassException[]> {
  const where: Record<string, unknown> = { collegeId, revokedAt: null };
  const clauses: Record<string, unknown>[] = [];
  if (selector.slotIds?.length) clauses.push({ timetableSlotId: { $in: selector.slotIds } });
  if (selector.dates?.length) clauses.push({ $or: [{ date: { $in: selector.dates } }, { newDate: { $in: selector.dates } }] });
  if (selector.offeringIds?.length) clauses.push({ courseOfferingId: { $in: selector.offeringIds } });
  if (clauses.length > 0) where.$and = clauses;
  return ClassException.find(where).sort({ date: 1 }).limit(500).lean<LeanClassException[]>();
}
```

The unique-partial index makes a concurrent double-create race resolve to a 11000; the explicit pre-check returns the 409 in the normal path.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -w backend -- --run modules/academics/__tests__/class-exception.test.ts`
Expected: PASS (9 tests).
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/academics/class-exception-service.ts backend/src/modules/academics/__tests__/class-exception.test.ts
git commit -m "feat(academics): class exception service - create/revoke/list/active (§4)"
```
---

### Task 5: Real section/room conflict check, wired into the service

**Files:**
- Modify: `backend/src/modules/academics/class-exception-service.ts` (add `checkRescheduleConflicts` + wire into `createClassException`)
- Test: add a `describe` block to `backend/src/modules/academics/__tests__/class-exception.test.ts`

**Interfaces:**
- Consumes: `activeExceptionsFor` (R38, Task 4); `getLiveTimetables(collegeId, at, timezone)` (Task 3 — window judged on the college-LOCAL day, R53); `TimetableSlot`, `Timetable`, `Room`, `CourseOffering`, `Course` models; `dayEnumOf`, `instantOf`, `overlaps` (Task 2).
- Produces: `interface RescheduleConflict { kind: 'section_overlap' | 'room_occupied'; detail: string }` and `checkRescheduleConflicts(collegeId, slot: LeanSlot, reschedule: { date, newDate, newStartTime, newEndTime, newRoomId? }, timezone): Promise<RescheduleConflict[]>`. Supersedes the `detectTimetableConflicts` placeholder (R2). Used by Task 7's `preview...` flow? No — used only inside `createClassException`; the preview endpoint does not conflict-check.

Semantics (spec §5.1, R28):
- **Section overlap:** any OTHER slot of the SAME section's live timetable on `newDate` (weekday of `newDate`, `'free'` excluded) whose occurrence is not vacated by an active exception dated `newDate`, and which is not the moving slot, overlapping `[newStartTime, newEndTime)`.
- **Room occupancy (across sections):** the target room (`newRoomId ?? slot.roomId`; the check is skipped when that is null) occupied on `newDate` by any other live slot or by a moved-in exception row, excluding the moving slot's own occurrence; slots vacated by active exceptions dated `newDate` do not occupy.
- Moved-in rows (active exceptions whose `newDate` equals the analysed date) occupy `newRoomId ?? slot.roomId` at `[newStartTime, newEndTime)`. `slot.roomId` means the room stored on the row's ORIGINAL slot: when that slot is not in the analysed day's slot set — a move in from another weekday, or one whose timetable is no longer the live winner — it is resolved by a collegeId-scoped `findOne` on the slot itself, not left to resolve to null. A row whose `newDate` is some *other* day has moved away and occupies nothing here — `activeExceptionsFor` returns it because `dates` matches `date` OR `newDate` (R38), so the check is explicit (R47).

- [ ] **Step 1: Add the failing tests**

Extend `seedSlot` (already in the file) with start/end/room-free options, then append this block. Add `import { Room } from '../../../models/campus/Room';` to the file's imports.

```typescript
describe('reschedule conflicts (R2)', () => {
  it('blocks a same-section time overlap; adjacent times pass (strict overlap)', async () => {
    const { slot, offering } = await seedSlot();
    const date = upcoming('monday');
    await TimetableSlot.create({
      collegeId: new Types.ObjectId(CID), timetableId: slot.timetableId, day: 'monday', period: 2,
      startTime: '10:30', endTime: '11:30', courseOfferingId: offering._id,
    });
    // Assert the conflict CONTRACT directly, not just that the call rejects: the `kind`
    // literal and the section detail format are production strings, and asserting only
    // /Reschedule conflicts/ leaves both unpinned (they could be renamed freely).
    const conflicts = await checkRescheduleConflicts(CID, slot, {
      date, newDate: date, newStartTime: '11:00', newEndTime: '12:00',
    }, 'Asia/Kolkata');
    expect(conflicts.map((c) => c.kind)).toEqual(['section_overlap']);
    expect(conflicts[0]!.detail).toContain('(same section)');
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled',
      newDate: date, newStartTime: '11:00', newEndTime: '12:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/Reschedule conflicts/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled',
      newDate: date, newStartTime: '11:30', newEndTime: '12:30', reason: 'Room maintenance pending',
    }, USER)).resolves.toBeTruthy(); // 11:30 only touches the occupant's end — strict overlap says free
  });

  it('excludes the moving slot\'s own occurrence (R28)', async () => {
    const { slot } = await seedSlot();
    const date = upcoming('monday');
    // The target window must OVERLAP the slot's own 09:00–10:00 occurrence on this date, or the
    // test is vacuous: a target that does not overlap it (e.g. 13:00–14:00) passes with or
    // without the exclusion and would not fail if the exclusion were deleted. 09:30–10:30
    // overlaps, so the ONLY reason this can resolve is the R28 exclusion — delete the line and
    // the slot's own occurrence becomes a section_overlap against itself.
    const conflicts = await checkRescheduleConflicts(CID, slot, {
      date, newDate: date, newStartTime: '09:30', newEndTime: '10:30',
    }, 'Asia/Kolkata');
    expect(conflicts).toEqual([]);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled',
      newDate: date, newStartTime: '09:30', newEndTime: '10:30', reason: 'Room maintenance pending',
    }, USER)).resolves.toBeTruthy();
  });

  it('a move-in from another weekday still occupies its stored room (R28)', async () => {
    const { slot, offering } = await seedSlot();
    const room = await Room.create({
      collegeId: new Types.ObjectId(CID), buildingId: new Types.ObjectId(), roomNumber: 'B-203',
      floor: 2, type: 'classroom', capacity: 60, status: 'available',
    });
    // A TUESDAY class holding this room, moved onto the analysed Monday with no newRoomId, so the
    // row's room can only come from its STORED slot — which is not in Monday's slot set. Resolving
    // the fallback only from that set yields null, the row occupies no room, and this blocks
    // nothing; the check must look the original slot up instead.
    const otherTt = await Timetable.create({
      collegeId: new Types.ObjectId(CID), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
      version: 1, status: 'published', effectiveFrom: new Date(),
    });
    const tueSlot = await TimetableSlot.create({
      collegeId: new Types.ObjectId(CID), timetableId: otherTt._id, day: 'tuesday', period: 1,
      startTime: '15:00', endTime: '16:00', courseOfferingId: offering._id, roomId: room._id,
    });
    const date = upcoming('monday');
    await createClassException(CID, {
      timetableSlotId: String(tueSlot._id), date, type: 'rescheduled',
      newDate: date, newStartTime: '09:30', newEndTime: '10:30', reason: 'Room maintenance pending',
    }, USER);
    const conflicts = await checkRescheduleConflicts(CID, slot, {
      date, newDate: date, newStartTime: '09:30', newEndTime: '10:30', newRoomId: String(room._id),
    }, 'Asia/Kolkata');
    expect(conflicts.map((c) => c.kind)).toEqual(['room_occupied']);
  });

  it('a cancellation on the target date vacates that occurrence', async () => {
    const { slot, offering } = await seedSlot();
    const date = upcoming('monday');
    const other = await TimetableSlot.create({
      collegeId: new Types.ObjectId(CID), timetableId: slot.timetableId, day: 'monday', period: 2,
      startTime: '10:30', endTime: '11:30', courseOfferingId: offering._id,
    });
    await createClassException(CID, {
      timetableSlotId: String(other._id), date, type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled',
      newDate: date, newStartTime: '10:30', newEndTime: '11:30', reason: 'Room maintenance pending',
    }, USER)).resolves.toBeTruthy(); // the vacated window is free
  });

  it('another section\'s slot in the target room blocks with a room detail (no section check)', async () => {
    const { slot, offering } = await seedSlot();
    const room = await Room.create({
      collegeId: new Types.ObjectId(CID), buildingId: new Types.ObjectId(), roomNumber: 'B-201',
      floor: 2, type: 'classroom', capacity: 60, status: 'available',
    });
    const otherTt = await Timetable.create({
      collegeId: new Types.ObjectId(CID), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
      version: 1, status: 'published', effectiveFrom: new Date(),
    });
    await TimetableSlot.create({
      collegeId: new Types.ObjectId(CID), timetableId: otherTt._id, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id, roomId: room._id,
    });
    const date = upcoming('monday');
    const conflicts = await checkRescheduleConflicts(CID, slot, {
      date, newDate: date, newStartTime: '09:00', newEndTime: '10:00', newRoomId: String(room._id),
    }, 'Asia/Kolkata');
    expect(conflicts.map((c) => c.kind)).toEqual(['room_occupied']);
    expect(conflicts[0]!.detail).toContain('B-201');
    expect(conflicts[0]!.detail).toContain('CS301');
  });

  it('a move-in exception occupies its new room; a revoked one does not', async () => {
    const { slot, offering } = await seedSlot();
    const room = await Room.create({
      collegeId: new Types.ObjectId(CID), buildingId: new Types.ObjectId(), roomNumber: 'B-202',
      floor: 2, type: 'classroom', capacity: 60, status: 'available',
    });
    const otherTt = await Timetable.create({
      collegeId: new Types.ObjectId(CID), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
      version: 1, status: 'published', effectiveFrom: new Date(),
    });
    const lateSlot = await TimetableSlot.create({
      collegeId: new Types.ObjectId(CID), timetableId: otherTt._id, day: 'monday', period: 6,
      startTime: '15:00', endTime: '16:00', courseOfferingId: offering._id, roomId: room._id,
    });
    const date = upcoming('monday');
    const moveIn = await createClassException(CID, {
      timetableSlotId: String(lateSlot._id), date, type: 'rescheduled',
      newDate: date, newStartTime: '09:00', newEndTime: '10:00', newRoomId: String(room._id), reason: 'Room maintenance pending',
    }, USER);
    const conflicts = await checkRescheduleConflicts(CID, slot, {
      date, newDate: date, newStartTime: '09:30', newEndTime: '10:30', newRoomId: String(room._id),
    }, 'Asia/Kolkata');
    expect(conflicts.map((c) => c.kind)).toEqual(['room_occupied']);
    await revokeClassException(CID, String(moveIn._id), USER);
    const after = await checkRescheduleConflicts(CID, slot, {
      date, newDate: date, newStartTime: '09:30', newEndTime: '10:30', newRoomId: String(room._id),
    }, 'Asia/Kolkata');
    expect(after).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w backend -- --run modules/academics/__tests__/class-exception.test.ts`
Expected: FAIL — `checkRescheduleConflicts` is not defined (import error).

- [ ] **Step 3: Implement and wire**

Append to `class-exception-service.ts` (and extend its `timetable-date` import with `instantOf` and `overlaps`; add `import { Room } from '../../models/campus/Room';`; `Timetable`, `TimetableSlot`, `Course`, `CourseOffering` are already imported):

```typescript
export interface RescheduleConflict { kind: 'section_overlap' | 'room_occupied'; detail: string }

/** courseId → course code, for conflict detail strings. */
async function offeringCodes(collegeId: string, offeringIds: string[]): Promise<Map<string, string>> {
  if (offeringIds.length === 0) return new Map();
  const offerings = await CourseOffering.find({ _id: { $in: offeringIds }, collegeId }).select('courseId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId }[]>();
  const courseIds = [...new Set(offerings.map((o) => String(o.courseId)))];
  const courses = await Course.find({ _id: { $in: courseIds }, collegeId }).select('code').lean<{ _id: Types.ObjectId; code: string }[]>();
  const codeByCourse = new Map(courses.map((c) => [String(c._id), c.code]));
  const out = new Map<string, string>();
  for (const o of offerings) out.set(String(o._id), codeByCourse.get(String(o.courseId)) ?? 'another class');
  return out;
}

async function sectionOf(collegeId: string, slot: LeanSlot): Promise<string | null> {
  const tt = await Timetable.findOne({ _id: slot.timetableId, collegeId }).select('sectionId').lean<{ sectionId: Types.ObjectId } | null>();
  return tt ? String(tt.sectionId) : null;
}

/**
 * The real conflict check the `detectTimetableConflicts` route placeholder stood
 * for (R2). Rescheduling into `newDate`/[newStartTime, newEndTime): no other
 * class of the same section overlaps, and the target room (newRoomId ?? the
 * slot's room) is free of every other class on that day. That day's own
 * exceptions apply — cancellations and moves-away vacate, moves-in occupy. The
 * moving slot's own occurrence is excluded everywhere (R28).
 */
export async function checkRescheduleConflicts(
  collegeId: string, slot: LeanSlot,
  r: { date: string; newDate: string; newStartTime: string; newEndTime: string; newRoomId?: string },
  timezone: string,
): Promise<RescheduleConflict[]> {
  const weekday = dayEnumOf(r.newDate);
  const at = instantOf(r.newDate, '09:00', timezone); // any instant inside that zoned day
  const live = await getLiveTimetables(collegeId, at, timezone);
  const winnerIds = [...live.values()].map((t) => String(t._id));
  const daySlots = winnerIds.length === 0
    ? []
    : await TimetableSlot.find({
        collegeId, timetableId: { $in: winnerIds }, day: weekday, slotType: { $ne: 'free' },
      }).lean<LeanSlot[]>();

  const exceptions = await activeExceptionsFor(collegeId, { dates: [r.newDate] });
  const vacated = new Set(exceptions.map((e) => String(e.timetableSlotId)));

  type Occ = { occSlotId: string; roomId: string | null; start: string; end: string; code: string; offeringId: string };
  const occs: Occ[] = [];
  for (const s of daySlots) {
    if (vacated.has(String(s._id))) continue;          // cancelled on newDate, or moved away
    if (String(s._id) === String(slot._id)) continue;  // the moving slot's own occurrence (R28)
    occs.push({ occSlotId: String(s._id), roomId: s.roomId ? String(s.roomId) : null, start: s.startTime, end: s.endTime, code: '', offeringId: String(s.courseOfferingId) });
  }
  for (const e of exceptions) {
    // `dates` matches `date` OR `newDate` (R38), so this set also holds rows that moved
    // AWAY to a different day — only a row landing on the analysed day is a move-in. R47.
    if (e.type !== 'rescheduled' || e.newDate !== r.newDate || !e.newStartTime || !e.newEndTime) continue;
    const occSlot = daySlots.find((s) => String(s._id) === String(e.timetableSlotId));
    // `daySlots` holds ONE weekday across the live timetables, so a row moved in from another
    // weekday has no entry there — and neither does one whose timetable is no longer the live
    // winner. Its room must then come from the stored slot itself; leaving the fallback to
    // resolve to null would let the row occupy no room and block nothing (R28).
    let originRoomId: string | null = occSlot?.roomId ? String(occSlot.roomId) : null;
    if (!originRoomId) {
      const origin = await TimetableSlot.findOne({ _id: e.timetableSlotId, collegeId })
        .select('roomId').lean<{ roomId?: Types.ObjectId } | null>();
      originRoomId = origin?.roomId ? String(origin.roomId) : null;
    }
    occs.push({
      occSlotId: String(e.timetableSlotId),
      roomId: e.newRoomId ? String(e.newRoomId) : originRoomId,
      start: e.newStartTime, end: e.newEndTime, code: '', offeringId: String(e.courseOfferingId),
    });
  }
  const codes = await offeringCodes(collegeId, [...new Set(occs.map((o) => o.offeringId))]);
  for (const occ of occs) occ.code = codes.get(occ.offeringId) ?? 'another class';

  const conflicts: RescheduleConflict[] = [];

  // 1. Same-section overlap: the moving slot's section's live slots. Move-ins from
  //    other sections are room-wide, not section-wise.
  const sectionId = await sectionOf(collegeId, slot);
  const sectionWinner = sectionId ? live.get(sectionId) : undefined;
  if (sectionWinner) {
    const sectionSlotIds = new Set(
      daySlots.filter((s) => String(s.timetableId) === String(sectionWinner._id)).map((s) => String(s._id)),
    );
    for (const occ of occs) {
      if (!sectionSlotIds.has(occ.occSlotId)) continue;
      if (overlaps(r.newStartTime, r.newEndTime, occ.start, occ.end)) {
        conflicts.push({ kind: 'section_overlap', detail: `${occ.code} ${occ.start}–${occ.end} (same section)` });
      }
    }
  }

  // 2. Room occupancy across sections; no target room → nothing to check.
  const roomId = r.newRoomId ?? (slot.roomId ? String(slot.roomId) : null);
  if (roomId) {
    // findOne, not find: `find` returns an array, so `busy?.roomNumber` would be
    // undefined for every room and the detail would read "Room another room is taken by …".
    const busy = await Room.findOne({ _id: roomId, collegeId }).select('roomNumber').lean<{ roomNumber: string } | null>();
    const roomNumber = busy?.roomNumber ?? 'another room';
    for (const occ of occs) {
      if (occ.roomId === roomId && overlaps(r.newStartTime, r.newEndTime, occ.start, occ.end)) {
        conflicts.push({ kind: 'room_occupied', detail: `Room ${roomNumber} is taken by ${occ.code} ${occ.start}–${occ.end}` });
      }
    }
  }
  return conflicts;
}
```

Wire into `createClassException` — inside the reschedule branch, after the `hhmmToMinutes` check and before `patch = {…}`:

```typescript
    const conflicts = await checkRescheduleConflicts(collegeId, slot, {
      date: input.date, newDate: input.newDate, newStartTime: input.newStartTime, newEndTime: input.newEndTime,
      newRoomId: input.newRoomId,
    }, timezone);
    if (conflicts.length > 0) {
      throw new AppError(400, `Reschedule conflicts: ${conflicts.map((c) => c.detail).join('; ')}`);
    }
```

Update the file-header comment's last line to: "Section/room conflict checks live here (checkRescheduleConflicts)."

- [ ] **Step 4: Run to verify pass**

Run: `npm test -w backend -- --run modules/academics/__tests__/class-exception.test.ts`
Expected: PASS (15 tests).
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 5: Mark the route placeholder superseded**

In `backend/src/modules/academics/routes.ts`, above the FIRST `router.get('/timetables/:id/conflicts'` line (~L318), insert:

```typescript
// Superseded for class-change conflicts: class-exception-service.checkRescheduleConflicts is the real
// section/room check that spec §5.1 means (R2); this route keeps its legacy draft-conflict behaviour.
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/academics/class-exception-service.ts backend/src/modules/academics/__tests__/class-exception.test.ts backend/src/modules/academics/routes.ts
git commit -m "feat(academics): real section/room conflict check for reschedules (§5.1)"
```

---

### Task 6: push tier + preview

**Files:**
- Create: `backend/src/modules/academics/push-tier.ts`
- Modify: `backend/src/modules/academics/class-exception-service.ts` (add `previewClassException`)
- Test: `backend/src/modules/academics/__tests__/push-tier.test.ts`

**Interfaces:**
- Consumes: `Enrollment`, `TimetableSlot`, `CourseOffering`, `Course`, `Person`, `Faculty` models; `ymd`, `addDays`, `instantOf` (Task 2); `LeanSlot` alias, `collegeTimezone` (Task 4).
- Produces:
  - `type ClassChangePushTier = 'urgent' | 'important' | 'none'`
  - `URGENT_WINDOW_MS = 2 * 60 * 60_000`
  - `classifyExceptionPushTier(originalDate: string, originalStartHHMM: string, affectedDates: readonly string[], now: Date, timezone: string): ClassChangePushTier` — pure, §8: urgent ⇔ the ORIGINAL occurrence starts today (college tz) and its start instant is in the future and ≤ 2 h away; else important ⇔ any affected date is today or tomorrow; else none.
  - `interface ClassExceptionPreview { slotId: string; date: string; newDate?: string; affectedStudents: number; faculty: string[]; pushTier: ClassChangePushTier }`
  - `previewClassException(collegeId, slotId, date, now?, newDate?): Promise<ClassExceptionPreview>` — `now` defaults `new Date()`, `newDate` optional.
- Used by Task 7 (routes). Task 16 does **not** call this: its class-change notification expansion declares its own `tierOf` and its own `URGENT_WINDOW_MS`, because it never needs the `'none'` outcome — it only ever tiers a row it has already decided to notify about. That leaves the 2-hour urgent window expressed twice (here, and again in Task 16), so Task 16's dispatch must either import this function or state why the two must differ; it must not re-derive the constant by hand.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/academics/__tests__/push-tier.test.ts
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { classifyExceptionPushTier } from '../push-tier';
import { previewClassException } from '../class-exception-service';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Course, CourseOffering, Enrollment } from '../../../models';
import { Person, Faculty, Student } from '../../../models';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const TZ = 'Asia/Kolkata';
const CID = '000000000000000000000001';
const base = new Date('2026-10-08T05:00:00.000Z'); // 10:30 IST

describe('classifyExceptionPushTier (§8)', () => {
  it('urgent when the original class starts today within 2 hours', () => {
    // Original start 2026-10-08 11:00 IST = 05:30Z; 30 min after base.
    expect(classifyExceptionPushTier('2026-10-08', '11:00', ['2026-10-08'], base, TZ)).toBe('urgent');
  });
  it('the 2h boundary is inclusive (exactly 2h → urgent)', () => {
    // start 10:00 IST = 04:30Z. 02:30Z is exactly 120 min before the start → urgent
    // (the window is delta > 0 && delta <= 2h, inclusive on the far edge); 02:29Z is
    // one minute more to wait (121 min) → important.
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-08'], new Date('2026-10-08T02:30:00.000Z'), TZ)).toBe('urgent');
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-08'], new Date('2026-10-08T02:29:00.000Z'), TZ)).toBe('important');
  });
  it('important when the class already started today, or the date is today or tomorrow', () => {
    // Started 59 min ago.
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-08'], new Date('2026-10-08T05:29:00.000Z'), TZ)).toBe('important');
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-09'], base, TZ)).toBe('important');
  });
  it('none beyond tomorrow', () => {
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-11'], base, TZ)).toBe('none');
    expect(classifyExceptionPushTier('2026-10-08', '10:00', [], base, TZ)).toBe('none');
  });
});

const CID2 = '000000000000000000000003';
const USER = '000000000000000000000002';

async function seedPreview(opts: { enrolled?: boolean } = {}) {
  const person = await Person.create({ collegeId: new Types.ObjectId(CID2), name: 'Prof. Rao', phone: '9000090001', gender: 'male' });
  const faculty = await Faculty.create({
    collegeId: new Types.ObjectId(CID2), personId: person._id, employeeCode: 'FAC9001',
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId: new Types.ObjectId(CID2), code: 'CS401', name: 'Networks',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 3, lectureHrs: 2, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId: new Types.ObjectId(CID2), courseId: course._id, semesterId: new Types.ObjectId(),
    sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 60,
  });
  const tt = await Timetable.create({
    collegeId: new Types.ObjectId(CID2), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
    version: 1, status: 'published', effectiveFrom: new Date(),
  });
  const slot = await TimetableSlot.create({
    collegeId: new Types.ObjectId(CID2), timetableId: tt._id, day: 'monday', period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id,
  });
  if (opts.enrolled) {
    const sp = await Person.create({ collegeId: new Types.ObjectId(CID2), name: 'Test Student', phone: '9000090002', gender: 'male' });
    const st = await Student.create({
      collegeId: new Types.ObjectId(CID2), personId: sp._id, admissionYear: 2026,
      rollNumber: '26JIT9001', status: 'active', onboardingStatus: 'not_started',
    });
    await Enrollment.create({
      collegeId: new Types.ObjectId(CID2), studentId: st._id, courseOfferingId: offering._id,
      semesterId: offering.semesterId, status: 'enrolled', enrolledAt: new Date(),
    });
  }
  return { slot };
}

/** A date n days from now, in Asia/Kolkata (pure plumbing tests; the tier boundary cases are pinned above). */
function ist(nDaysFromNow: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + nDaysFromNow * 86_400_000));
}

describe('previewClassException (§5.1)', () => {
  it('counts enrolled students and names faculty, omits newDate', async () => {
    const { slot } = await seedPreview({ enrolled: true });
    const out = await previewClassException(CID2, String(slot._id), ist(9));
    expect(out.affectedStudents).toBe(1);
    expect(out.faculty).toEqual(['Prof. Rao']);
    expect(out.pushTier).toBe('none'); // single affected date 9 days out
    expect(out.newDate).toBeUndefined();
  });

  it('derives the tier from the optional newDate', async () => {
    const { slot } = await seedPreview({ enrolled: true });
    const out = await previewClassException(CID2, String(slot._id), ist(9), new Date(), ist(1));
    expect(out.pushTier).toBe('important'); // affected = [9 days out, tomorrow]
    expect(out.newDate).toBe(ist(1));
  });
});

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w backend -- --run modules/academics/__tests__/push-tier.test.ts`
Expected: FAIL — "Cannot find module '../push-tier'".

- [ ] **Step 3: Implement push-tier.ts**

```typescript
// backend/src/modules/academics/push-tier.ts
/**
 * The §8 push tier, as a pure function: Urgent when the ORIGINAL class start is
 * today (college tz) and within 2 hours of the change — forward-looking: the
 * start instant must be in the future and ≤ URGENT_WINDOW_MS away (an already
 * started class is at Important; the send-time re-check cancels it regardless).
 * Important when any affected date is today or tomorrow; none beyond.
 */
import { instantOf, ymd, addDays } from './timetable-date';

export type ClassChangePushTier = 'urgent' | 'important' | 'none';

export const URGENT_WINDOW_MS = 2 * 60 * 60_000;

export function classifyExceptionPushTier(
  originalDate: string,
  originalStartHHMM: string,
  affectedDates: readonly string[],
  now: Date,
  timezone: string,
): ClassChangePushTier {
  const today = ymd(now, timezone);
  if (originalDate === today) {
    const delta = instantOf(originalDate, originalStartHHMM, timezone).getTime() - now.getTime();
    if (delta > 0 && delta <= URGENT_WINDOW_MS) return 'urgent';
  }
  const tomorrow = addDays(today, 1);
  for (const d of affectedDates) {
    if (d === today || d === tomorrow) return 'important';
  }
  return 'none';
}
```

- [ ] **Step 4: Add the preview to the exception service**

Append to `class-exception-service.ts`. Extended imports: add `Enrollment` from `../../models/academic-ops/Enrollment`, `Person` from `../../models/people/Person`, `Faculty` from `../../models/people/Faculty`, and `classifyExceptionPushTier`, `ClassChangePushTier` from `./push-tier`.

```typescript
export interface ClassExceptionPreview {
  slotId: string;
  date: string;
  newDate?: string;
  affectedStudents: number;
  faculty: string[];
  pushTier: ClassChangePushTier;
}

/** §5.1 dialog preview: how many students, which faculty, and what push tier the change triggers. */
export async function previewClassException(
  collegeId: string, slotId: string, date: string, now: Date = new Date(), newDate?: string,
): Promise<ClassExceptionPreview> {
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId }).lean<LeanSlot | null>();
  if (!slot) throw new AppError(404, 'Class slot not found');
  const timezone = await collegeTimezone(collegeId);

  const [affectedStudents, faculty] = await Promise.all([
    Enrollment.countDocuments({ collegeId, courseOfferingId: slot.courseOfferingId, status: 'enrolled' }),
    facultyNames(collegeId, slot),
  ]);

  return {
    slotId, date,
    ...(newDate ? { newDate } : {}),
    affectedStudents,
    faculty,
    pushTier: classifyExceptionPushTier(date, slot.startTime, newDate ? [date, newDate] : [date], now, timezone),
  };
}

/** Display names for the occurrence's faculty: the substitution first, then the offering's. */
async function facultyNames(collegeId: string, slot: LeanSlot): Promise<string[]> {
  const offering = await CourseOffering.findOne({ _id: slot.courseOfferingId, collegeId }).select('facultyId coFacultyIds').lean<{ facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null>();
  const ids: Types.ObjectId[] = [];
  if (offering) ids.push(offering.facultyId, ...(offering.coFacultyIds ?? []));
  if (slot.substituteFacultyId) ids.unshift(slot.substituteFacultyId);
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return [];
  const rows = await Faculty.find({ _id: { $in: unique }, collegeId }).select('personId').lean<{ _id: Types.ObjectId; personId: Types.ObjectId }[]>();
  const people = await Person.find({ _id: { $in: rows.map((r) => r.personId) }, collegeId }).select('name').lean<{ _id: Types.ObjectId; name: string }[]>();
  const nameByPerson = new Map(people.map((p) => [String(p._id), p.name]));
  const personByFaculty = new Map(rows.map((r) => [String(r._id), String(r.personId)]));
  return unique
    .map((fid) => {
      const pid = personByFaculty.get(fid);
      return pid ? nameByPerson.get(pid) ?? '' : '';
    })
    .filter((name) => name.length > 0);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -w backend -- --run modules/academics/__tests__/push-tier.test.ts`
Expected: PASS (6 tests).
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/academics/push-tier.ts backend/src/modules/academics/class-exception-service.ts backend/src/modules/academics/__tests__/push-tier.test.ts
git commit -m "feat(academics): class-change push tier + preview (§5.1/§8)"
```
---

### Task 7: Per-actor permission, ERP routes and the class-exception e2e

**Files:**
- Modify: `backend/src/modules/academics/class-exception-service.ts` (add `assertClassChangePermission`, `listClassExceptionViewer`, `getClassException`; widen `listClassExceptions` with a teaching-viewer intersection and decorated rows)
- Modify: `backend/src/modules/academics/validation.ts` (three Zod schemas)
- Create: `backend/src/modules/academics/class-exception-controller.ts`
- Modify: `backend/src/modules/academics/routes.ts` (imports + the four routes after `router.get('/attendance-alerts', …)`, ~line 332)
- Test: `backend/src/__e2e__/modules/juvi-class-exceptions.e2e.test.ts`

**Interfaces:**
- Consumes: Tasks 4–6 exports; `evaluateAccess(collegeId, role, personaCodes, module, action)` from `../../shared/rbac/engine`; `personaCodesOf({ personaType?, personas? })` from `../../shared/rbac/persona-registry`; `User` from `../../models/User`; `Faculty` from `../../models/people/Faculty`; `validate(schema, 'query')` → `req.validatedQuery` (the pattern `people/search-controller.ts` uses).
- Produces:
  - `type ClassChangeActor = { id: string; role: string; personaType?: string; personas?: string[] }`
  - `type ClassChangeBasis = 'faculty' | 'office'`
  - `assertClassChangePermission(collegeId: string, actor: ClassChangeActor, offeringId: string, slotId?: string): Promise<ClassChangeBasis>` — R6's exact order; teaching callers can change only their own classes.
  - `listClassExceptionViewer(collegeId: string, actor: ClassChangeActor): Promise<ClassExceptionViewer>` — list scoping (§5.5: teaching callers see only their own classes). `ClassExceptionViewer` is `{ isOffice: boolean; facultyId?: string }`, declared beside it in the service; use that name, not an inline type.
  - `getClassException(collegeId: string, id: string): Promise<LeanClassException>` (404 `'Class exception not found'`).
  - `interface ClassExceptionRow extends LeanClassException { courseCode: string; courseName: string; createdByName: string }`; `listClassExceptions(collegeId, { offeringId?, slotId?, from?, to?, viewerFacultyId? })` now returns `ClassExceptionRow[]`.
  - Routes: `GET /class-exceptions/preview`, `GET /class-exceptions`, `POST /class-exceptions`, `DELETE /class-exceptions/:id` under `/api/academics`.
- **E2E env fact:** `getTestApp()` sets `process.env.RBAC_ENFORCE = 'false'` for the whole e2e suite and `authorize()` reads the flag per request — so these tests flip `process.env.RBAC_ENFORCE = 'true'` at the start of each permission test; an `afterEach` restores `'false'`. `seedBase()` seeds `DEFAULT_POLICIES` (`seedPolicies` + `seedPersonas`), so with enforcement on, `admin` (role-level `*` allow) is office and a `faculty` role has academics read for the list/preview routes.
- **Why the ownership branch is role-agnostic on the Faculty row:** the default `DEFAULT_POLICIES` grant every `faculty` role an `academics:update` allow — without the ownership-first rule every teaching user could change any class once policies are seeded. This is exactly R6.

- [ ] **Step 1: Write the failing e2e tests**

```typescript
// backend/src/__e2e__/modules/juvi-class-exceptions.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestCourse, createTestCourseOffering, createTestFaculty } from '../factories/academic.factory';
import { createTestUser } from '../factories/user.factory';
import { Timetable, TimetableSlot } from '../../models';
import { ClassException } from '../../models/academic-ops/ClassException';
import { AuditLog } from '../../shared/audit';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/academics';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterEach(async () => { process.env.RBAC_ENFORCE = 'false'; });
afterAll(async () => { await cleanupTestApp(); });

/** The next date at least `minAhead` days out (0 = today allowed) that is a Monday, in Asia/Kolkata. */
function nextMonday(minAhead = 0): string {
  for (let add = minAhead; add < minAhead + 7; add++) {
    const probe = new Date(Date.now() + add * 86_400_000);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(probe);
    if (day === 'Mon') return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(probe);
  }
  return '';
}

async function classWorld() {
  const course = await createTestCourse(fx.collegeId, {
    regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CSX01',
  });
  const owner = await createTestFaculty(fx.collegeId, { name: 'Prof. Owner' });
  const other = await createTestFaculty(fx.collegeId, { name: 'Prof. Other' });
  const offering = await createTestCourseOffering(fx.collegeId, {
    courseId: String(course._id), semesterId: String(fx.sem1._id),
    sectionId: String(fx.cseSection._id), facultyId: String(owner.faculty._id),
  });
  const tt = await Timetable.create({
    collegeId: fx.collegeId, semesterId: fx.sem1._id, sectionId: fx.cseSection._id,
    version: 1, status: 'published', effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  });
  const slot = await TimetableSlot.create({
    collegeId: fx.collegeId, timetableId: tt._id, day: 'monday', period: 1,
    startTime: '10:00', endTime: '11:00', courseOfferingId: offering._id,
  });
  // ≥+2d so the preview test's pushTier: 'none' pin can't flake into 'urgent' when today is a Monday
  return { course, owner, other, offering, slot, date: nextMonday(2) };
}

function cancelBody(slotId: string, date: string) {
  return { timetableSlotId: slotId, date, type: 'cancelled', reason: 'Faculty attending a workshop' };
}

describe('class exception permissions (§5.1/§11)', () => {
  it('office can change any class', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    const res = await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    expect(res.body.type).toBe('cancelled');
    expect(res.body.timetableSlotId).toBe(String(w.slot._id));
  });

  it('a faculty member can change their own class, and no one else\'s', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    const mine = await api.as(w.owner.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    expect(mine.body.date).toBe(w.date);
    const stranger = await api.as(w.other.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(403);
    expect(stranger.body).toEqual({ error: 'You can change only your own classes' });
  });

  it('a student gets 403', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    const student = await createTestUser({
      collegeId: fx.collegeId, role: 'student', personaType: 'L-STD',
      name: 'Test Student', email: 'students@test.com',
    });
    const res = await api.as(student.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(403);
    expect(res.body).toEqual({ error: 'You can change only your own classes' });
  });

  it('the overlap check surfaces through HTTP as a 400 with the detail', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    await TimetableSlot.create({
      collegeId: fx.collegeId, timetableId: w.slot.timetableId, day: 'monday', period: 2,
      startTime: '10:30', endTime: '11:30', courseOfferingId: w.offering._id,
    });
    const res = await api.as(w.owner.token).post(`${A}/class-exceptions`).send({
      timetableSlotId: String(w.slot._id), date: w.date, type: 'rescheduled',
      newDate: w.date, newStartTime: '11:00', newEndTime: '12:00', reason: 'Room maintenance pending',
    }).expect(400);
    expect(res.body.error).toMatch(/Reschedule conflicts/);
  });

  it('DELETE revokes, returns the row and writes the archive audit entry', async () => {
    const w = await classWorld();
    const created = await api.as(w.owner.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    const del = await api.as(fx.admin.token).delete(`${A}/class-exceptions/${String(created.body._id)}`).expect(200);
    expect(del.body.revokedAt).toBeTruthy();
    expect(await ClassException.countDocuments({
      collegeId: fx.collegeId, timetableSlotId: String(w.slot._id), revokedAt: { $ne: null },
    })).toBe(1);
    const archive = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'ClassException', action: 'archive' }).lean();
    expect(archive).toBeTruthy();
    const create = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'ClassException', action: 'create' }).lean();
    expect(String(create?.performedBy ?? '')).toBeTruthy();
  });

  it('preview returns counts, faculty names and the tier', async () => {
    const w = await classWorld();
    const res = await api.as(w.owner.token)
      .get(`${A}/class-exceptions/preview?slotId=${String(w.slot._id)}&date=${w.date}`).expect(200);
    expect(res.body).toMatchObject({ affectedStudents: 0, faculty: ['Prof. Owner'], pushTier: 'none' });
  });

  it('the list is scoped: a teaching caller sees only their own classes', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    const asOwner = await api.as(w.owner.token).get(`${A}/class-exceptions`).expect(200);
    expect(Array.isArray(asOwner.body)).toBe(true);
    expect(asOwner.body).toHaveLength(1);
    const asOther = await api.as(w.other.token).get(`${A}/class-exceptions`).expect(200);
    expect(asOther.body).toHaveLength(0);
    const asAdmin = await api.as(fx.admin.token).get(`${A}/class-exceptions`).expect(200);
    expect(asAdmin.body).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:e2e -w backend -- __e2e__/modules/juvi-class-exceptions.e2e.test.ts`
Expected: FAIL — the routes are unknown (`404` "Not found" instead of `201`/`403`), so the first assertion fails.

- [ ] **Step 3: Add the Zod schemas**

In `backend/src/modules/academics/validation.ts`, append at the end:

```typescript
// ─── Class exceptions (spec §5.2) ───────────────────────────
export const createClassExceptionBodySchema = z.object({
  timetableSlotId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: z.enum(['cancelled', 'rescheduled']),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'newDate must be YYYY-MM-DD').optional(),
  newStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'newStartTime must be HH:MM').optional(),
  newEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'newEndTime must be HH:MM').optional(),
  newRoomId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id').optional(),
  reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(300),
}).strict().superRefine((v, ctx) => {
  if (v.type === 'rescheduled' && !(v.newDate && v.newStartTime && v.newEndTime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A reschedule requires newDate, newStartTime and newEndTime' });
  }
  if (v.type === 'cancelled' && (v.newDate ?? v.newStartTime ?? v.newEndTime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A cancellation excludes newDate, newStartTime and newEndTime' });
  }
});

export const classExceptionListQuerySchema = z.object({
  offeringId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id').optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
});

export const classExceptionPreviewQuerySchema = z.object({
  slotId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'newDate must be YYYY-MM-DD').optional(),
});
```

`reason`'s `min(5)` matches the model's `minlength: 5` (Task 1).

- [ ] **Step 4: Write the controller**

```typescript
// backend/src/modules/academics/class-exception-controller.ts
/**
 * class-exception-controller — HTTP layer for class exceptions (spec §5.2).
 * Thin wraps over class-exception-service, in the exam-config-controller style.
 * Writes run the per-actor check (§5.1) instead of authorize('academics',
 * 'update') so teaching faculty can change their own classes; reads keep the
 * standard authorize('academics','read') chain.
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './class-exception-service';

/** What `validate(schema, 'query')` attaches (Express 5 keeps req.query read-only). */
interface ReqWithValidatedQuery<T> extends AuthRequest {
  validatedQuery?: T;
}

export async function listClassExceptions(
  req: ReqWithValidatedQuery<{ offeringId?: string; from?: string; to?: string }>,
  res: Response, next: NextFunction,
) {
  try {
    const viewer = await svc.listClassExceptionViewer(req.collegeId!, req.user!);
    // Office callers see every exception; teaching callers only their own (§5.5);
    // anything else (no policy, no Faculty row) sees nothing.
    if (!viewer.isOffice && !viewer.facultyId) { res.json([]); return; }
    const scope = viewer.isOffice ? undefined : viewer.facultyId;
    res.json(await svc.listClassExceptions(req.collegeId!, { ...req.validatedQuery, ...(scope ? { viewerFacultyId: scope } : {}) }));
  } catch (e) { next(e); }
}

/**
 * §5.1: the create path decides permission BEFORE any validation writes —
 * assertClassChangePermissionForSlot resolves slotId → slot → offeringId,
 * 404s an unknown slot, then runs the R6 check. createClassException (Task 4)
 * re-fetches the slot for its own validation chain; the double read is
 * deliberate and keeps Task 4's signature frozen.
 */
export async function createClassException(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await svc.assertClassChangePermissionForSlot(req.collegeId!, req.user!, String(req.body.timetableSlotId));
    res.status(201).json(await svc.createClassException(req.collegeId!, req.body, String(req.user!.id)));
  } catch (e) { next(e); }
}

export async function revokeClassException(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await svc.getClassException(req.collegeId!, String(req.params.id));
    await svc.assertClassChangePermission(req.collegeId!, req.user!, String(row.courseOfferingId), String(row.timetableSlotId));
    res.json(await svc.revokeClassException(req.collegeId!, String(req.params.id), String(req.user!.id)));
  } catch (e) { next(e); }
}

export async function previewClassException(
  req: ReqWithValidatedQuery<{ slotId: string; date: string; newDate?: string }>,
  res: Response, next: NextFunction,
) {
  try {
    const q = req.validatedQuery!;
    res.json(await svc.previewClassException(req.collegeId!, q.slotId, q.date, new Date(), q.newDate));
  } catch (e) { next(e); }
}
```

The final controller file therefore contains exactly `listClassExceptions`, `createClassException`, `revokeClassException`, `previewClassException` — nothing else; `assertClassChangePermissionForSlot`'s service side is Step 5.

- [ ] **Step 5: Add the service permission helpers and widen the list**

Add to `class-exception-service.ts` (imports to extend: `User` from `../../models/User`, `Faculty` from `../../models/people/Faculty`, `evaluateAccess` from `../../shared/rbac/engine`, `personaCodesOf` from `../../shared/rbac/persona-registry`):

```typescript
export type ClassChangeActor = { id: string; role: string; personaType?: string; personas?: string[] };
export type ClassChangeBasis = 'faculty' | 'office';

/** The caller's Faculty row (ERP User → Person → Faculty), or null when they are not a teaching person. */
async function actingFacultyId(collegeId: string, actor: ClassChangeActor): Promise<string | null> {
  const user = await User.findOne({ _id: actor.id, collegeId }).select('personId').lean<{ personId?: Types.ObjectId } | null>();
  if (!user?.personId) return null;
  const faculty = await Faculty.findOne({ collegeId, personId: user.personId }).select('_id').lean<{ _id: Types.ObjectId } | null>();
  return faculty ? String(faculty._id) : null;
}

/** True when the faculty member owns the class: the offering's faculty, a co-faculty, or the slot's substitute. */
async function ownsOfferingOrSlot(
  collegeId: string, offeringId: string, fid: string, slotId?: string,
): Promise<boolean> {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId })
    .select('facultyId coFacultyIds').lean<{ facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null>();
  if (!offering) return false;
  if (String(offering.facultyId) === fid || (offering.coFacultyIds ?? []).some((id) => String(id) === fid)) return true;
  if (!slotId) return false;
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId })
    .select('substituteFacultyId').lean<{ substituteFacultyId?: Types.ObjectId } | null>();
  return Boolean(slot?.substituteFacultyId && String(slot.substituteFacultyId) === fid);
}

/**
 * §5.1 permission (R6: RBAC off → office; teaching callers are decided by
 * ownership alone — their default academics:update policy does not widen it;
 * non-teaching callers fall to the academics:update policy; anything else 403).
 */
export async function assertClassChangePermission(
  collegeId: string, actor: ClassChangeActor, offeringId: string, slotId?: string,
): Promise<ClassChangeBasis> {
  if (process.env.RBAC_ENFORCE === 'false') return 'office'; // dev bypass, matches authorize()
  const fid = await actingFacultyId(collegeId, actor);
  if (fid !== null) {
    const own = await ownsOfferingOrSlot(collegeId, offeringId, fid, slotId);
    if (own) return 'faculty';
    throw new AppError(403, 'You can change only your own classes');
  }
  const policy = await evaluateAccess(collegeId, actor.role, personaCodesOf(actor), 'academics', 'update');
  if (policy) return 'office';
  throw new AppError(403, 'You can change only your own classes');
}

/** Create-path variant: resolve the slot first, then decide on it; 404 for an unknown slot. */
export interface SlotChangeCheck { slot: LeanSlot; basis: ClassChangeBasis }
export async function assertClassChangePermissionForSlot(
  collegeId: string, actor: ClassChangeActor, slotId: string,
): Promise<SlotChangeCheck> {
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId }).lean<LeanSlot | null>();
  if (!slot) throw new AppError(404, 'Class slot not found');
  const basis = await assertClassChangePermission(collegeId, actor, String(slot.courseOfferingId), slotId);
  return { slot, basis };
}

export interface ClassExceptionViewer { isOffice: boolean; facultyId?: string }

/** List scoping (§5.5): teaching callers see only their own classes; office callers see everything. */
export async function listClassExceptionViewer(collegeId: string, actor: ClassChangeActor): Promise<ClassExceptionViewer> {
  if (process.env.RBAC_ENFORCE === 'false') return { isOffice: true };
  const fid = await actingFacultyId(collegeId, actor);
  if (fid) return { isOffice: false, facultyId: fid };
  const policy = await evaluateAccess(collegeId, actor.role, personaCodesOf(actor), 'academics', 'update');
  return policy ? { isOffice: true } : { isOffice: false };
}

export interface ClassExceptionRow extends LeanClassException {
  courseCode: string;
  courseName: string;
  createdByName: string;
}

/** §5.5 list decoration: course code/name and who made each change. */
async function decorateClassExceptions(collegeId: string, rows: LeanClassException[]): Promise<ClassExceptionRow[]> {
  const offeringIds = [...new Set(rows.map((r) => String(r.courseOfferingId)))];
  const offerings = offeringIds.length === 0 ? [] : await CourseOffering.find({ _id: { $in: offeringIds }, collegeId })
    .select('courseId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId }[]>();
  const courseIds = [...new Set(offerings.map((o) => String(o.courseId)))];
  const courses = courseIds.length === 0 ? [] : await Course.find({ _id: { $in: courseIds }, collegeId })
    .select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
  const courseByOffering = new Map(offerings.map((o) => [String(o._id), String(o.courseId)]));
  const byCourse = new Map(courses.map((c) => [String(c._id), c]));
  const users = rows.length === 0 ? [] : await User.find({ _id: { $in: rows.map((r) => r.createdBy) }, collegeId })
    .select('name').lean<{ _id: Types.ObjectId; name: string }[]>();
  const nameByUser = new Map(users.map((u) => [String(u._id), u.name]));
  return rows.map((r) => {
    const courseId = courseByOffering.get(String(r.courseOfferingId));
    const course = courseId ? byCourse.get(courseId) : undefined;
    return {
      ...r,
      courseCode: course?.code ?? 'Unknown',
      courseName: course?.name ?? 'Unknown',
      createdByName: nameByUser.get(String(r.createdBy)) ?? 'Unknown',
    };
  });
}
```

Then REPLACE the whole `listClassExceptions` body of Task 4 with this widened version (the filter type gains `viewerFacultyId?`, the rows are decorated, and the return type becomes `ClassExceptionRow[]`):

```typescript
export async function listClassExceptions(
  collegeId: string,
  filter: { offeringId?: string; slotId?: string; from?: string; to?: string; viewerFacultyId?: string },
): Promise<ClassExceptionRow[]> {
  const where: Record<string, unknown> = { collegeId };
  if (filter.offeringId) where.courseOfferingId = filter.offeringId;
  if (filter.slotId) where.timetableSlotId = filter.slotId;
  if (filter.from || filter.to) {
    const range: Record<string, unknown> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    where.date = range;
  }
  if (filter.viewerFacultyId) {
    const ownOfferings = await CourseOffering.find({
      collegeId,
      $or: [{ facultyId: filter.viewerFacultyId }, { coFacultyIds: filter.viewerFacultyId }],
    }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    const ownSlots = await TimetableSlot.find({
      collegeId, substituteFacultyId: filter.viewerFacultyId,
    }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    if (ownOfferings.length === 0 && ownSlots.length === 0) return []; // theirs only, and they own nothing
    where.$or = [
      { courseOfferingId: { $in: ownOfferings.map((o) => o._id) } },
      { timetableSlotId: { $in: ownSlots.map((s) => s._id) } },
    ];
  }
  const rows = await ClassException.find(where).sort({ date: -1, createdAt: -1 }).limit(200)
    .lean<LeanClassException[]>();
  return decorateClassExceptions(collegeId, rows);
}
```

Also append this small read helper beside the revokes:

```typescript
export async function getClassException(collegeId: string, id: string): Promise<LeanClassException> {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Class exception not found');
  const row = await ClassException.findOne({ _id: id, collegeId }).lean<LeanClassException | null>();
  if (!row) throw new AppError(404, 'Class exception not found');
  return row;
}
```

And extend the file header comment with: "Permission (R6) and the §5.5 list viewer live here; the controllers stay thin."

- [ ] **Step 6: Mount the routes**

In `backend/src/modules/academics/routes.ts`:

Extend the imports (after the existing `import * as examCfg from './exam-config-controller';` and the validation import list — add the three new schemas to the existing `from './validation'` import):

```typescript
import * as classExc from './class-exception-controller';
```

and inside the existing `from './validation'` destructuring add:

```typescript
  createClassExceptionBodySchema, classExceptionListQuerySchema, classExceptionPreviewQuerySchema,
```

Then insert after the line `router.get('/attendance-alerts', authorize('academics', 'read'), ctrl.listAttendanceAlerts);`:

```typescript
// ─── Class exceptions (spec §5.2): reads through RBAC; writes through the per-actor check (§5.1) ───
router.get('/class-exceptions/preview', authenticate, authorize('academics', 'read'), validate(classExceptionPreviewQuerySchema, 'query'), classExc.previewClassException);
router.get('/class-exceptions', authenticate, authorize('academics', 'read'), validate(classExceptionListQuerySchema, 'query'), classExc.listClassExceptions);
router.post('/class-exceptions', authenticate, validate(createClassExceptionBodySchema), classExc.createClassException);
router.delete('/class-exceptions/:id', authenticate, classExc.revokeClassException);
```

- [ ] **Step 7: Run to verify pass**

Run: `npm run test:e2e -w backend -- __e2e__/modules/juvi-class-exceptions.e2e.test.ts`
Expected: PASS (7 tests).
Run: `npm test -w backend -- --run modules/academics/__tests__/class-exception.test.ts`
Expected: PASS (the widened list keeps Task 4's assertions green).
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/academics/class-exception-service.ts backend/src/modules/academics/validation.ts backend/src/modules/academics/class-exception-controller.ts backend/src/modules/academics/routes.ts backend/src/__e2e__/modules/juvi-class-exceptions.e2e.test.ts
git commit -m "feat(academics): class-exception routes with per-actor permission (§5.1/§5.2)"
```

---

### Task 8: next-class.ts on the live rule, with exceptions

**Files:**
- Modify: `backend/src/modules/juvi-app/spaces/next-class.ts` (full rewrite, §5.3; `WeeklySlot`, `nextOccurrence`, `zonedNow` are gone)
- Modify: `backend/src/modules/juvi-app/spaces/__tests__/next-class.test.ts` (drop the `nextOccurrence` describe; keep the `formatNextClassLabel` tests and the `NOW`/`TZ` consts they use)
- Modify: `backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts` (it imports `nextOccurrence` — see the Interfaces note; its oracle must be replaced in the same commit)
- Test: `backend/src/modules/juvi-app/spaces/__tests__/next-class-live.test.ts`

**Interfaces:**
- Consumes: `getLiveTimetables(collegeId, at, timezone)` (Task 3 — window judged on the college-LOCAL day, R53), `activeExceptionsFor` (Task 4), `ymd`, `addDays`, `dayEnumOf`, `instantOf` (Task 2); `Timetable`, `TimetableSlot` models.
- Produces: `nextClassByOffering(collegeId, offeringIds, timezone): Promise<Map<string, Date>>` — **same name, same shape, new semantics** (§5.3); `formatNextClassLabel` unchanged. `spaces-service.ts` needs no change (same call sites at lines 10/44/54).
- **`WeeklySlot` and `nextOccurrence` ARE referenced elsewhere** — the claim that they are unreferenced is false, and deleting them breaks a live test. `backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts:11` imports `nextOccurrence` and calls it at `:58` and `:59`, where it is the **independent oracle** for the "courses ordered by next class" assertion: the e2e deliberately derives the expected OS-before-DBMS order from the server's own `asOf` rather than hard-coding it, so the ordering assertion stays wall-clock independent. Step 4 below expects that file to pass, so it must be updated in the same commit. Replace the two calls with a local pure helper built on Task 2's primitives — no new production export, and the oracle stays independent of the code under test:

```typescript
// in juvi-app-spaces.e2e.test.ts, replacing the nextOccurrence import
import { ymd, addDays, dayEnumOf, instantOf } from '../../modules/academics/timetable-date';

/** Earliest instant strictly after `asOf` at which `hhmm` starts on weekday `day`. */
function nextAt(day: string, hhmm: string, asOf: Date, tz: string): Date {
  let date = ymd(asOf, tz);
  for (let i = 0; i <= 7; i++) {
    if (dayEnumOf(date) === day) {
      const at = instantOf(date, hhmm, tz);
      if (at.getTime() > asOf.getTime()) return at;
    }
    date = addDays(date, 1);
  }
  throw new Error(`no upcoming ${day} ${hhmm}`);
}
```

  then `const osNext = nextAt('monday', '08:00', asOf, TZ);` becomes a fold over `DAYS6`:

```typescript
    const nextFor = (hhmm: string) => DAYS6
      .map((day) => nextAt(day, hhmm, asOf, TZ))
      .reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
    const osNext = nextFor('08:00');
    const dbmsNext = nextFor('17:00');
```

  `DAYS6`, `asOf` and `TZ` on the surrounding lines stay as they are; the two `!` non-null assertions go away because `nextFor` either returns a date or throws. The seeded rows are daily 08:00/17:00 across `DAYS6`, so the earliest-of-the-week fold is the same instant the old helper returned.
- Import-direction check: `juvi-app/spaces/next-class.ts → academics/{live-timetable,class-exception-service,timetable-date}` — `class-exception-service` imports `juvi-app/config/institution-config`, which imports only `config/redis` and `models/College`, so there is no cycle.

- [ ] **Step 1: Update the old test file and write the new tests**

In `backend/src/modules/juvi-app/spaces/__tests__/next-class.test.ts` change the import line to `import { formatNextClassLabel } from '../next-class';` and delete the whole `describe('nextOccurrence', …)` block (lines 8–24). The `formatNextClassLabel` describe and the `NOW`/`TZ` consts stay.

Then write the new test file:

```typescript
// backend/src/modules/juvi-app/spaces/__tests__/next-class-live.test.ts
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Timetable } from '../../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../../models/academic-ops/TimetableSlot';
import { ClassException } from '../../../../models/academic-ops/ClassException';
import { nextClassByOffering } from '../next-class';
import { instantOf, addDays } from '../../../academics/timetable-date';
import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';

const CID = '000000000000000000000001';
const cidO = () => new Types.ObjectId(CID);
const TZ = 'Asia/Kolkata';
const secId = new Types.ObjectId();
const offerId = new Types.ObjectId();
const userId = new Types.ObjectId('000000000000000000000002');

async function seedSlot(opts: { tt?: Partial<Parameters<typeof Timetable.create>[0]> } = {}) {
  const tt = await Timetable.create({
    collegeId: cidO(), semesterId: new Types.ObjectId(), sectionId: secId,
    version: opts.tt?.version ?? 1, status: opts.tt?.status ?? 'published',
    effectiveFrom: opts.tt?.effectiveFrom ?? new Date('2026-01-01T00:00:00Z'),
  });
  const slot = await TimetableSlot.create({
    collegeId: cidO(), timetableId: tt._id, day: 'monday', period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offerId,
  });
  return { tt, slot };
}

function nextMonday(): string {
  for (let add = 0; add < 7; add++) {
    const probe = new Date(Date.now() + add * 86_400_000);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(probe);
    if (day === 'Mon') return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(probe);
  }
  return '';
}

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

describe('nextClassByOffering on the live rule (§5.3)', () => {
  it('the highest-version published timetable covering today wins', async () => {
    // v1 also covers today; the winner must be the slot of the higher version.
    await seedSlot({ tt: { version: 2 } });
    await Timetable.create({
      collegeId: cidO(), semesterId: new Types.ObjectId(), sectionId: secId,
      version: 1, status: 'published', effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(nextMonday(), '09:00', TZ).toISOString());
  });

  it('a cancelled occurrence is skipped; the next meeting is the following week', async () => {
    const { slot } = await seedSlot();
    const mon = nextMonday();
    await ClassException.create({
      collegeId: cidO(), timetableSlotId: slot._id, courseOfferingId: offerId,
      date: mon, type: 'cancelled', reason: 'Faculty attending a workshop', createdBy: userId,
      revokedAt: null, revokedBy: null,
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(addDays(mon, 7), '09:00', TZ).toISOString());
  });

  it('a rescheduled occurrence counts at its new time on its new date', async () => {
    const { slot } = await seedSlot();
    const mon = nextMonday();
    await ClassException.create({
      collegeId: cidO(), timetableSlotId: slot._id, courseOfferingId: offerId,
      date: mon, type: 'rescheduled', newDate: addDays(mon, 2), newStartTime: '11:00', newEndTime: '12:00',
      reason: 'Faculty on university duty', createdBy: userId, revokedAt: null, revokedBy: null,
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(addDays(mon, 2), '11:00', TZ).toISOString());
  });

  it('draft timetables are never the source; nothing published means no entry', async () => {
    await seedSlot({ tt: { status: 'draft' } });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.has(String(offerId))).toBe(false);
  });
});
```

Note the two exception rows are created through the model directly (revokedAt/revokedBy explicit) — the service path is exercised in Task 7's e2e; this file pins the READER's exception handling in isolation. `ClassException.create` bypasses the 14-day/weekday checks by design here.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w backend -- --run modules/juvi-app/spaces/__tests__/next-class-live.test.ts`
Expected: FAIL — the shipped `nextClassByOffering` is weekly arithmetic: it ignores exceptions (cancelled / rescheduled cases return the wrong occurrence) and the draft-timetable case returns an entry instead of an empty map (`out.has` true). All four tests fail.

- [ ] **Step 3: Rewrite next-class.ts**

Replace the entire file content with:

```typescript
// backend/src/modules/juvi-app/spaces/next-class.ts
/**
 * §5.3: the next class per offering now resolves on the live-read rule —
 * for each day in a 14-day horizon, the highest-version published timetable
 * whose effective window covers the date — and then applies that day's
 * exceptions: a cancelled occurrence is never "next", and a rescheduled one
 * counts at its new time on its new date. The old weekly-arithmetic
 * `nextOccurrence` (window-blind, exception-blind) is gone.
 */
import { Types } from 'mongoose';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { getLiveTimetables } from '../../academics/live-timetable';
import { activeExceptionsFor } from '../../academics/class-exception-service';
import { ymd, addDays, dayEnumOf, instantOf } from '../../academics/timetable-date';

const HORIZON_DAYS = 14;

export function formatNextClassLabel(at: Date, now: Date, timezone: string): string {
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  const today = dayKey(now); const tomorrow = dayKey(new Date(now.getTime() + 86_400_000)); const target = dayKey(at);
  const word = target === today ? 'Today' : target === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(at);
  return `Next: ${word} ${time}`;
}

type SlotLean = { _id: Types.ObjectId; courseOfferingId: Types.ObjectId; startTime: string; endTime: string };

/** Next class per offering on the live rule; offerings with no usable occurrence in the horizon are absent. */
export async function nextClassByOffering(
  collegeId: string, offeringIds: string[], timezone: string,
): Promise<Map<string, Date>> {
  const ids = [...new Set(offeringIds)];
  const out = new Map<string, Date>();
  if (ids.length === 0) return out;
  const best = new Map<string, number>();

  const today = ymd(new Date(), timezone);
  const dates = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));

  for (const date of dates) {
    const live = await getLiveTimetables(collegeId, instantOf(date, '12:00', timezone), timezone);
    const winners = [...live.values()].map((t) => String(t._id));
    if (winners.length === 0) continue;

    const slots = await TimetableSlot.find({
      collegeId, timetableId: { $in: winners }, day: dayEnumOf(date),
      slotType: { $ne: 'free' }, courseOfferingId: { $in: ids.map((id) => new Types.ObjectId(id)) },
    }).lean<SlotLean[]>();

    const rows = await activeExceptionsFor(collegeId, { dates: [date] });
    const vacated = new Set<string>();
    for (const e of rows) if (e.date === date) vacated.add(String(e.timetableSlotId));

    for (const s of slots) {
      const sid = String(s._id);
      if (vacated.has(sid)) continue;
      const at = instantOf(date, s.startTime, timezone).getTime();
      const cur = best.get(String(s.courseOfferingId));
      if (cur === undefined || at < cur) best.set(String(s.courseOfferingId), at);
    }
    for (const e of rows) {
      if (e.type !== 'rescheduled' || e.newDate !== date || !e.newStartTime) continue;
      const at = instantOf(date, e.newStartTime, timezone).getTime();
      const cur = best.get(String(e.courseOfferingId));
      if (cur === undefined || at < cur) best.set(String(e.courseOfferingId), at);
    }
  }

  for (const [offeringId, at] of best) out.set(offeringId, new Date(at));
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -w backend -- --run modules/juvi-app/spaces/__tests__/next-class-live.test.ts modules/juvi-app/spaces/__tests__/next-class.test.ts`
Expected: PASS (4 new + 1 kept test).
Run: `npm run test:e2e -w backend -- __e2e__/modules/juvi-app-spaces.e2e.test.ts`
Expected: PASS — `spaces-service` uses the same `nextClassByOffering`/`formatNextClassLabel` exports, so its `nextClassAt` assertions see the new semantics on fixtures that have live published timetables. This run is also what proves the replaced `nextAt` oracle compiles and agrees: the old `nextOccurrence` import is gone from that file, so a missed update here fails at typecheck or import time rather than silently.
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/spaces/next-class.ts backend/src/modules/juvi-app/spaces/__tests__/next-class.test.ts backend/src/modules/juvi-app/spaces/__tests__/next-class-live.test.ts
git commit -m "feat(juvi-app): next-class on the live timetable rule with exceptions (§5.3)"
```

---

### Task 9: College.juvi settings — attendance threshold, headroom, payment portal

**Files:**
- Modify: `backend/src/models/College.ts` (`IJuviConfig` + `juviConfigSchema` gain three fields, §4.2)
- Modify: `backend/src/modules/juvi-app/config/institution-config.ts` (`normalizeJuviConfig` gains the defaults — the path all readers read through)
- Modify: `backend/src/modules/juvi-app/admin/schemas.ts` (`settingsUpdateSchema` gains the three keys)
- Test: `backend/src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts` (extend)

**Interfaces:**
- Consumes: existing `JuviConfigView` spread — the new fields flow through `normalizeJuviConfig` to every consumer of `getJuviConfig` automatically.
- Produces (used by Tasks 10, 13, 14):
  - `IJuviConfig.attendanceThreshold: number` — 50–95, default **75**
  - `IJuviConfig.showAttendanceHeadroom: boolean` — default **true** (D6)
  - `IJuviConfig.paymentPortalUrl?: string` — `https://` URL or omitted (never null in views)
- `flatten()` in `settings-service.ts` needs no change: all three keys are leaves.

- [ ] **Step 1: Extend the failing e2e tests**

Add to the `describe('admin settings')` block in `backend/src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts` (extend the FIRST existing test's `toMatchObject` too, adding `attendanceThreshold: 75, showAttendanceHeadroom: true` to its expected object):

```typescript
  it('GET returns the attendance defaults for a college that never set them', async () => {
    const res = await api.as(fx.admin.token).get(`${A}/settings`).expect(200);
    expect(res.body.juvi).toMatchObject({ attendanceThreshold: 75, showAttendanceHeadroom: true });
    expect(res.body.juvi.paymentPortalUrl ?? null).toBeNull();
  });

  it('PUT round-trips the academics-in-app settings', async () => {
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({
      attendanceThreshold: 70, showAttendanceHeadroom: false, paymentPortalUrl: 'https://pay.juvion.test/college',
    }).expect(200);
    expect(res.body.juvi).toMatchObject({ attendanceThreshold: 70, showAttendanceHeadroom: false, paymentPortalUrl: 'https://pay.juvion.test/college' });
    expect((await College.findById(fx.collegeId).lean())?.juvi.attendanceThreshold).toBe(70);
  });

  it('PUT bounds the threshold to 50–95 (integer) and refuses non-https portals', async () => {
    await api.as(fx.admin.token).put(`${A}/settings`).send({ attendanceThreshold: 49 }).expect(400);
    await api.as(fx.admin.token).put(`${A}/settings`).send({ attendanceThreshold: 96 }).expect(400);
    await api.as(fx.admin.token).put(`${A}/settings`).send({ attendanceThreshold: 75.5 }).expect(400);
    await api.as(fx.admin.token).put(`${A}/settings`).send({ paymentPortalUrl: 'http://pay.example.test' }).expect(400);
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({ attendanceThreshold: 95 }).expect(200);
    expect(res.body.juvi.attendanceThreshold).toBe(95);
  });

  it('PUT clears paymentPortalUrl with null', async () => {
    await api.as(fx.admin.token).put(`${A}/settings`).send({ paymentPortalUrl: 'https://pay.juvion.test/college' }).expect(200);
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({ paymentPortalUrl: null }).expect(200);
    expect(res.body.juvi.paymentPortalUrl ?? null).toBeNull();
    expect((await College.findById(fx.collegeId).lean())?.juvi.paymentPortalUrl).toBeNull();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:e2e -w backend -- __e2e__/modules/juvi-app-admin-settings.e2e.test.ts`
Expected: FAIL — GET's view has no `attendanceThreshold` (undefined ≠ 75), and PUT with the new keys 400s (`settingsUpdateSchema` is `.strict()`).

- [ ] **Step 3: Model + settings schema**

In `backend/src/models/College.ts` — extend `IJuviConfig`:

```typescript
  featureFlags: { languageRoadmap: boolean };
  welcomeNotice?: { studentNoticeId?: string; facultyNoticeId?: string };
  /** §4.2: the shared attendance threshold (50–95, default 75) driving categories everywhere. */
  attendanceThreshold: number;
  /** §4.2 (D6): whether the Me screen offers the missable-classes headroom. */
  showAttendanceHeadroom: boolean;
  /** §4.2: optional https:// payment portal link for the dues card. */
  paymentPortalUrl?: string;
```

and `juviConfigSchema` (inside the fields list, after `welcomeNotice`):

```typescript
    attendanceThreshold: { type: Number, default: 75, min: 50, max: 95 },
    showAttendanceHeadroom: { type: Boolean, default: true },
    paymentPortalUrl: { type: String, match: /^https:\/\/\S+$/ },
```

In `backend/src/modules/juvi-app/config/institution-config.ts`, extend `normalizeJuviConfig`'s returned object:

```typescript
    attendanceThreshold: j.attendanceThreshold ?? 75,
    showAttendanceHeadroom: j.showAttendanceHeadroom ?? true,
    paymentPortalUrl: j.paymentPortalUrl,
```

In `backend/src/modules/juvi-app/admin/schemas.ts`, extend `settingsUpdateSchema` (before the closing of the object, keeping `.strict()`):

```typescript
  /** Spec §4.2: academics-in-the-app settings; null clears the portal link. */
  attendanceThreshold: z.number().int('Use a whole number between 50 and 95').min(50, 'Between 50 and 95').max(95, 'Between 50 and 95').optional(),
  showAttendanceHeadroom: z.boolean().optional(),
  paymentPortalUrl: z.string().trim().url('Enter a full https:// URL').refine((u) => u.startsWith('https://'), 'Use an https:// URL').nullable().optional(),
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:e2e -w backend -- __e2e__/modules/juvi-app-admin-settings.e2e.test.ts __e2e__/modules/juvi-app-config.e2e.test.ts`
Expected: PASS (7 existing + 4 new tests; the config e2e's settings flow is unaffected).
Run: `npm run typecheck -w backend`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/College.ts backend/src/modules/juvi-app/config/institution-config.ts backend/src/modules/juvi-app/admin/schemas.ts backend/src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts
git commit -m "feat(juvi-app): attendance threshold, headroom and payment portal settings (§4.2)"
```
### Task 10: Shared attendance formula (`attendance-formula.ts`)

**Files:**
- Create: `backend/src/modules/academics/attendance-formula.ts`
- Test: `backend/src/modules/academics/__tests__/attendance-formula.test.ts`

**Interfaces:**
- Consumes:
  - Models: `CourseOffering` (`courseId`, `semesterId`, `sectionId`, `facultyId`, `coFacultyIds`, `enrolledCount`, `status`), `AttendanceSession` (`status: 'open' | 'closed'`), `AttendanceRecord` (`sessionId`, `studentId`, `status`), `Enrollment` (`studentId`, `courseOfferingId`, `semesterId`, `status: 'enrolled' | 'dropped' | 'withdrawn' | 'completed'`), `Semester` (`status: 'upcoming' | 'active' | 'completed'`, default `'-upcoming'`), `Course` (`code`, `name`) — exported from the `../../../models` barrel; `College` is NOT in the barrel: import it from `'../../../models/College'`.
  - `getJuviConfig(collegeId: string): Promise<JuviConfigView | null>` from `../juvi-app/config/institution-config` — returns `null` when the College row is absent (falls back to Mongo when Redis is down; Redis reads are caught). Reads `attendanceThreshold?: number` on `juvi`, which Task 9 adds to `IJuviConfig` **and to `normalizeJuviConfig`**.
  - `activeSemesterIds(collegeId: string): Promise<string[]>` from `./live-timetable` (Task 3, already exported there).
  - `AppError` from `'../../middleware/errorHandler'` (statusCode first).
- Produces (Tasks 11 and 13 import from this module):
  - `round1(v: number): number` — `Math.round(v * 10) / 10`. The ONE place the spec's round-to-1-decimal happens (Global Constraint: round1 exactly once).
  - `type AttendanceCategory = 'safe' | 'warning' | 'at_risk' | 'detained'`
  - `attendanceCategory(pct: number | null, threshold: number): AttendanceCategory`
  - `attendanceThresholdFor(collegeId: string): Promise<number>`
  - `attendanceAvailableFor(collegeId: string): Promise<boolean>`
  - `interface CourseAttendance { offeringId: string; courseCode: string; title: string; held: number; attended: number; pct: number | null; headroom: number; threshold: number }`
  - `courseAttendanceFor(collegeId: string, studentId: string, offeringId: string, threshold?: number): Promise<CourseAttendance>`
  - `interface StudentAttendance { courses: CourseAttendance[]; held: number; attended: number; overallPct: number | null; threshold: number }`
  - `attendanceFor(collegeId: string, studentId: string, threshold?: number): Promise<StudentAttendance>` (Ruling R12: keeps the spec's §5.4 name in this file; the Juvi reader in Task 13 imports it aliased).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/academics/__tests__/attendance-formula.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { College } from '../../../models/College';
import {
  AttendanceRecord,
  AttendanceSession,
  Course,
  CourseOffering,
  Enrollment,
  Faculty,
  Person,
  Semester,
  Student,
} from '../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import {
  attendanceAvailableFor,
  attendanceCategory,
  attendanceFor,
  attendanceThresholdFor,
  courseAttendanceFor,
  round1,
} from '../attendance-formula';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

// --- pure tests (no DB) ------------------------------------------------------

describe('round1', () => {
  it('rounds to one decimal place', () => {
    expect(round1(66.66666666666667)).toBe(66.7);
    expect(round1(75)).toBe(75);
    expect(round1(0)).toBe(0);
  });
});

describe('attendanceCategory', () => {
  it('bands at threshold 75 per §5.4', () => {
    expect(attendanceCategory(100, 75)).toBe('safe');
    expect(attendanceCategory(85, 75)).toBe('safe');
    expect(attendanceCategory(84.9, 75)).toBe('warning');
    expect(attendanceCategory(75, 75)).toBe('warning');
    expect(attendanceCategory(74.9, 75)).toBe('at_risk');
    expect(attendanceCategory(65, 75)).toBe('at_risk');
    expect(attendanceCategory(64.9, 75)).toBe('detained');
    expect(attendanceCategory(0, 75)).toBe('detained');
  });

  it('bands shift when the threshold is 60', () => {
    expect(attendanceCategory(70, 60)).toBe('safe');
    expect(attendanceCategory(69.9, 60)).toBe('warning');
    expect(attendanceCategory(60, 60)).toBe('warning');
    expect(attendanceCategory(59.9, 60)).toBe('at_risk');
    expect(attendanceCategory(50, 60)).toBe('at_risk');
    expect(attendanceCategory(49.9, 60)).toBe('detained');
  });

  it('a null percentage is safe (held = 0 stores null)', () => {
    expect(attendanceCategory(null, 75)).toBe('safe');
  });
});

// --- DB-backed tests ---------------------------------------------------------

let collegeId = new Types.ObjectId();
let semesterId = new Types.ObjectId();
let codeSeq = 0;

interface SeedWorld {
  studentId: string;
  byPersonId: string;
  facultyId: string;
  offeringId: string;
  courseId: string;
}

async function seedWorld(threshold?: number): Promise<SeedWorld> {
  const college = await College.create({
    name: 'Juvi Test College',
    code: `JTC${Date.now()}_${codeSeq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
    contactEmail: 'a@juvion.test',
    contactPhone: '9000000000',
    juvi: { enabled: true, ...(threshold ? { attendanceThreshold: threshold } : {}) },
  });
  collegeId = college._id as Types.ObjectId;
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  semesterId = semester._id as Types.ObjectId;
  const sPerson = await Person.create({ collegeId, name: 'S Student', phone: '9000090002', gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: 'F Teacher', phone: '9000090001', gender: 'male' });
  const student = await Student.create({
    collegeId, personId: sPerson._id, admissionYear: 2026,
    rollNumber: `26JIT${codeSeq}`, status: 'active', onboardingStatus: 'not_started',
  });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FAC${codeSeq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'CS101', name: 'Intro to CS',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId,
    sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1,
  });
  await Enrollment.create({
    collegeId, studentId: student._id, courseOfferingId: offering._id,
    semesterId, status: 'enrolled', enrolledAt: new Date(),
  });
  return {
    studentId: String(student._id),
    byPersonId: String(fPerson._id),
    facultyId: String(faculty._id),
    offeringId: String(offering._id),
    courseId: String(course._id),
  };
}

async function closeSession(offeringId: string, facultyId: string, day: number): Promise<Types.ObjectId> {
  const doc = await AttendanceSession.create({
    collegeId, courseOfferingId: new Types.ObjectId(offeringId),
    date: new Date(`2026-07-${String(day).padStart(2, '0')}T00:00:00Z`), period: 1,
    facultyId: new Types.ObjectId(facultyId), status: 'closed',
  });
  return doc._id as Types.ObjectId;
}

async function mark(sessionId: Types.ObjectId, studentId: string, byPersonId: string, status: string): Promise<void> {
  await AttendanceRecord.create({
    collegeId, sessionId, studentId: new Types.ObjectId(studentId),
    status, markedBy: new Types.ObjectId(byPersonId),
  });
}

describe('attendanceFor', () => {
  beforeEach(async () => { await clearCollections(); });

  it('counts only closed sessions as held', async () => {
    const w = await seedWorld();
    await closeSession(w.offeringId, w.facultyId, 1);
    await AttendanceSession.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      date: new Date('2026-07-02T00:00:00Z'), period: 1, facultyId: new Types.ObjectId(w.facultyId), status: 'open',
    });
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.held).toBe(1);
    expect(s.courses[0]!.held).toBe(1);
  });

  it('maps od/late/absent per §5.4 and computes headroom only above threshold', async () => {
    const w = await seedWorld();
    const ses = [
      await closeSession(w.offeringId, w.facultyId, 1),
      await closeSession(w.offeringId, w.facultyId, 2),
      await closeSession(w.offeringId, w.facultyId, 3),
      await closeSession(w.offeringId, w.facultyId, 4),
    ];
    const statuses = ['present', 'od', 'late', 'absent'];
    for (let i = 0; i < statuses.length; i++) await mark(ses[i]!, w.studentId, w.byPersonId, statuses[i]!);
    const course = await courseAttendanceFor(collegeId.toString(), w.studentId, w.offeringId);
    expect(course.held).toBe(4);
    expect(course.attended).toBe(3);
    expect(course.pct).toBe(75);
    expect(course.headroom).toBe(0);
    expect(course.threshold).toBe(75);
  });

  it('held = 0 → pct null, headroom 0, overallPct null (R13)', async () => {
    const w = await seedWorld();
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.held).toBe(0);
    expect(s.overallPct).toBeNull();
    expect(s.courses[0]!.held).toBe(0);
    expect(s.courses[0]!.pct).toBeNull();
    expect(s.courses[0]!.headroom).toBe(0);
  });

  it('scopes courses to active-semester enrollments', async () => {
    const w = await seedWorld();
    const doneSemester = await Semester.create({
      collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 1,
      startDate: new Date('2025-06-01T00:00:00Z'), endDate: new Date('2025-12-01T00:00:00Z'), status: 'completed',
    });
    const otherCourse = await Course.create({
      collegeId, code: 'CS102', name: 'Other', regulationId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(), credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0,
      type: 'theory', isElective: false,
    });
    const otherOffering = await CourseOffering.create({
      collegeId, courseId: otherCourse._id, semesterId: doneSemester._id,
      sectionId: new Types.ObjectId(), facultyId: new Types.ObjectId(w.facultyId), status: 'active',
    });
    await Enrollment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), courseOfferingId: otherOffering._id,
      semesterId: doneSemester._id, status: 'enrolled',
    });
    await closeSession(w.offeringId, w.facultyId, 1);
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.courses.length).toBe(1);
    expect(s.courses[0]!.offeringId).toBe(w.offeringId);
  });

  it('aggregates overall as Σattended ÷ Σheld', async () => {
    const w = await seedWorld();
    const other = await CourseOffering.create({
      collegeId, courseId: new Types.ObjectId(w.courseId), semesterId,
      sectionId: new Types.ObjectId(), facultyId: new Types.ObjectId(w.facultyId), status: 'active',
    });
    await Enrollment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), courseOfferingId: other._id,
      semesterId, status: 'enrolled',
    });
    const a = await closeSession(w.offeringId, w.facultyId, 1);
    const b = await closeSession(String(other._id), w.facultyId, 2);
    const c = await closeSession(String(other._id), w.facultyId, 3);
    await mark(a, w.studentId, w.byPersonId, 'present');
    await mark(b, w.studentId, w.byPersonId, 'present');
    await mark(c, w.studentId, w.byPersonId, 'absent');
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.courses.map((course) => course.pct)).toEqual([100, 50]);
    expect(s.overallPct).toBe(66.7);
  });

  it('uses College juvi.attendanceThreshold for bands and headroom', async () => {
    const w = await seedWorld(60);
    const ses: Types.ObjectId[] = [];
    for (let i = 1; i <= 22; i++) ses.push(await closeSession(w.offeringId, w.facultyId, i));
    for (let i = 0; i < 14; i++) await mark(ses[i]!, w.studentId, w.byPersonId, 'present');
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.threshold).toBe(60);
    expect(s.courses[0]!.pct).toBe(63.6);
    expect(s.courses[0]!.headroom).toBe(1);
    expect(await attendanceThresholdFor(collegeId.toString())).toBe(60);
  });

  it('defaults the threshold to 75 when the College has no setting', async () => {
    await seedWorld();
    expect(await attendanceThresholdFor(collegeId.toString())).toBe(75);
  });

  it('reports available only once a closed session exists', async () => {
    const w = await seedWorld();
    expect(await attendanceAvailableFor(collegeId.toString())).toBe(false);
    await closeSession(w.offeringId, w.facultyId, 1);
    expect(await attendanceAvailableFor(collegeId.toString())).toBe(true);
  });

  it('404s an unknown course offering', async () => {
    await seedWorld();
    await expect(
      courseAttendanceFor(collegeId.toString(), new Types.ObjectId().toString(), new Types.ObjectId().toString()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

> **Caution for the threshold test:** `getJuviConfig` reads Redis first with a 60 s TTL. `seedWorld` writes the College with `juvi.attendanceThreshold: 60` in the create call itself, so the first cache fill already contains the setting — never mutate `juvi` after any `attendanceThresholdFor` call inside a test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/academics/__tests__/attendance-formula.test.ts`
Expected: FAIL — `Cannot find module '../attendance-formula'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/academics/attendance-formula.ts`:

```typescript
import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { AttendanceSession } from '../../models/academic-ops/AttendanceSession';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { getJuviConfig } from '../juvi-app/config/institution-config';
import { activeSemesterIds } from './live-timetable';

/** Spec §5.4: percentages round to one decimal, in exactly one place. */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export type AttendanceCategory = 'safe' | 'warning' | 'at_risk' | 'detained';

/**
 * Spec §5.4 bands relative to the college's threshold:
 * safe ≥ T+10, warning [T, T+10), at_risk [T−10, T), detained < T−10.
 * A null percentage (no classes held) is 'safe' — it never generates alerts.
 */
export function attendanceCategory(pct: number | null, threshold: number): AttendanceCategory {
  if (pct === null) return 'safe';
  if (pct >= threshold + 10) return 'safe';
  if (pct >= threshold) return 'warning';
  if (pct >= threshold - 10) return 'at_risk';
  return 'detained';
}

export async function attendanceThresholdFor(collegeId: string): Promise<number> {
  const cfg = await getJuviConfig(collegeId);
  return cfg?.attendanceThreshold ?? 75;
}

/** Spec §6 reader `available`: the college has any closed attendance session. */
export async function attendanceAvailableFor(collegeId: string): Promise<boolean> {
  return (await AttendanceSession.countDocuments({ collegeId, status: 'closed' })) > 0;
}

export interface CourseAttendance {
  offeringId: string;
  courseCode: string;
  title: string;
  held: number;
  attended: number;
  pct: number | null;
  headroom: number;
  threshold: number;
}

/**
 * Spec §5.4 for one (student, offering). held = closed sessions;
 * attended = records with status present | late | od;
 * pct = round1(attended / held × 100), null when held = 0;
 * headroom = max(0, floor(attended / (T/100) − held)), defined only when pct ≥ T, else 0.
 */
export async function courseAttendanceFor(
  collegeId: string,
  studentId: string,
  offeringId: string,
  threshold?: number,
): Promise<CourseAttendance> {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');
  const T = threshold ?? (await attendanceThresholdFor(collegeId));
  const sessionFilter = { collegeId, courseOfferingId: offeringId, status: 'closed' as const };
  const [held, sessionIds, course] = await Promise.all([
    AttendanceSession.countDocuments(sessionFilter),
    AttendanceSession.find(sessionFilter).select('_id').lean<{ _id: Types.ObjectId }[]>(),
    Course.findOne({ _id: offering.courseId, collegeId }).select('code name').lean<{ code: string; name: string } | null>(),
  ]);
  const attended = sessionIds.length
    ? await AttendanceRecord.countDocuments({
        collegeId,
        studentId,
        sessionId: { $in: sessionIds.map((s) => s._id) },
        status: { $in: ['present', 'late', 'od'] },
      })
    : 0;
  const pct = held > 0 ? round1((attended / held) * 100) : null;
  return {
    offeringId,
    courseCode: course?.code ?? '',
    title: course?.name ?? '',
    held,
    attended,
    pct,
    headroom: pct !== null && pct >= T ? Math.max(0, Math.floor(attended / (T / 100) - held)) : 0,
    threshold: T,
  };
}

export interface StudentAttendance {
  courses: CourseAttendance[];
  held: number;
  attended: number;
  overallPct: number | null;
  threshold: number;
}

/**
 * Spec §5.4 overall: Σattended ÷ Σheld across the student's enrolled courses in
 * active semesters. channelId is deliberately out of the formula — readers add it (R12).
 */
export async function attendanceFor(
  collegeId: string,
  studentId: string,
  threshold?: number,
): Promise<StudentAttendance> {
  const T = threshold ?? (await attendanceThresholdFor(collegeId));
  const semesterIds = await activeSemesterIds(collegeId);
  if (semesterIds.length === 0) return { courses: [], held: 0, attended: 0, overallPct: null, threshold: T };
  const enrollments = await Enrollment.find({
    collegeId,
    studentId,
    status: 'enrolled',
    semesterId: { $in: semesterIds },
  }).select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
  const offeringIds = [...new Set(enrollments.map((e) => String(e.courseOfferingId)))];
  const courses: CourseAttendance[] = [];
  for (const id of offeringIds) courses.push(await courseAttendanceFor(collegeId, studentId, id, T));
  const held = courses.reduce((sum, c) => sum + c.held, 0);
  const attended = courses.reduce((sum, c) => sum + c.attended, 0);
  return {
    courses,
    held,
    attended,
    overallPct: held > 0 ? round1((attended / held) * 100) : null,
    threshold: T,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/academics/__tests__/attendance-formula.test.ts`
Expected: PASS (all 13).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/academics/attendance-formula.ts backend/src/modules/academics/__tests__/attendance-formula.test.ts
git commit -m "feat(academics): shared §5.4 attendance formula with threshold-driven categories

Single formula for held/attended/pct/headroom plus the four category bands,
driven by College juvi.attendanceThreshold (default 75). Null percentage =
no classes held = safe, never alerted. attendanceAvailableFor answers the
Juvi reader's `available` flag."
```
### Task 11: ERP side — nullable percentage flows through every existing writer and reader

Spec §5.4 makes `computeAttendanceSummary`, `updateAttendanceSummary` and the marking endpoints all call the ONE formula. Rulings R8 (ERP-visible nullable percentage for new rows), R9 (alert thresholds stay hard-coded 75/65), R13 (held = 0 → pct `null`, never alerted).

**Files:**
- Modify: `backend/src/models/academic-ops/AttendanceSummary.ts` (interface + schema `percentage`, `default: null`)
- Modify: `backend/src/modules/academics/service.ts` (`categorizeAttendance` deletion; `updateAttendanceSummary` rewrite; private `courseOfferingIdOfSession` + exported `recomputeSummaries` helpers; six marking-write recompute hooks; four `.percentage` null-coalescing fallout sites)
- Modify: `backend/src/modules/academics/academic-delivery-service.ts` (`computeAttendanceSummary` rewrite; `checkAttendanceThreshold` guards; `generateAttendanceAlerts` guard; `checkHallTicketEligibility` guard)
- Modify: `backend/src/modules/academics/juvi-service.ts` (three `.percentage` fallout sites)
- Modify: `backend/src/modules/finance/service.ts` (`computeDistressScore` attendance signal guard)
- Test: `backend/src/modules/academics/__tests__/attendance-summary.test.ts`

**Interfaces:**
- Consumes (from Task 10, exact signatures): `courseAttendanceFor(collegeId: string, studentId: string, offeringId: string, threshold?: number): Promise<CourseAttendance>`, `attendanceCategory(pct: number | null, threshold: number): AttendanceCategory`, `attendanceThresholdFor(collegeId: string): Promise<number>`.
- Consumes: `Enrollment`, `AttendanceRecord`, `AttendanceSession`, `AttendanceSummary` — already imported in `service.ts`; `createAuditLog`, `AppError` already imported.
- Produces:
  - `updateAttendanceSummary(collegeId: string, studentId: string, courseOfferingId: string, threshold?: number)` — gains the optional `threshold` param (spec-gap A7; callers unchanged).
  - `recomputeSummaries(collegeId: string, pairs: { studentId: string; courseOfferingId: string }[]): Promise<void>` in `service.ts` — dedupes pairs, skips blank offering ids, swallows per-pair failures with a `console.error('[attendance] summary recompute failed for student ... offering ...')` line.
  - (private) `courseOfferingIdOfSession(collegeId: string, sessionId: string): Promise<string>` — `''` when the session is gone.
  - `computeAttendanceSummary(collegeId: string, studentId: string, courseOfferingId: string)` in `academic-delivery-service.ts` — same signature, now formula-true.
  - `checkAttendanceThreshold(collegeId, studentId, courseOfferingId, threshold = 75)` — unchanged signature; now returns `percentage: number` (never `null`) with `meetsThreshold: (pct ?? 0) >= threshold`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/academics/__tests__/attendance-summary.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { College } from '../../../models/College';
import {
  AttendanceAlert,
  AttendanceRecord,
  AttendanceSession,
  AttendanceSummary,
  Course,
  CourseOffering,
  Enrollment,
  Faculty,
  Person,
  Semester,
  Student,
} from '../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import {
  bulkUpsertAttendanceRecords,
  createAttendanceRecord,
  createAttendanceSession,
  deleteAttendanceRecord,
  deleteAttendanceSession,
  recomputeSummaries,
  updateAttendanceRecord,
  updateAttendanceSession,
  updateAttendanceSummary,
} from '../service';
import {
  checkAttendanceThreshold,
  checkHallTicketEligibility,
  computeAttendanceSummary,
  generateAttendanceAlerts,
} from '../academic-delivery-service';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let semesterId = new Types.ObjectId();
let codeSeq = 0;

interface SeedBase {
  studentIds: [string, string];
  byPersonId: string;
  facultyId: string;
  courseId: string;
  offeringIds: [string, string];
  makeOffering: () => Promise<Types.ObjectId>;
}

async function seedBase(withThreshold?: number): Promise<SeedBase> {
  if (withThreshold !== undefined) {
    const college = await College.create({
      name: 'Juvi Test College', code: `JTC${Date.now()}_${codeSeq++}`,
      address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
      contactEmail: 'a@juvion.test', contactPhone: '9000000000',
      juvi: { enabled: true, attendanceThreshold: withThreshold },
    });
    collegeId = college._id as Types.ObjectId;
  }
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  semesterId = semester._id as Types.ObjectId;
  const people = await Person.create([
    { collegeId, name: 'Teacher One', phone: '9000090001', gender: 'male' },
    { collegeId, name: 'Student A', phone: '9000090002', gender: 'male' },
    { collegeId, name: 'Student B', phone: '9000090003', gender: 'female' },
  ]);
  const [byPerson, sA, sB] = people;
  const faculty = await Faculty.create({
    collegeId, personId: byPerson._id, employeeCode: `FAC${codeSeq++}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const students = await Student.create([
    { collegeId, personId: sA._id, admissionYear: 2026, rollNumber: `26JITA${codeSeq++}`, status: 'active', onboardingStatus: 'not_started' },
    { collegeId, personId: sB._id, admissionYear: 2026, rollNumber: `26JITB${codeSeq++}`, status: 'active', onboardingStatus: 'not_started' },
  ]);
  const course = await Course.create({
    collegeId, code: `CS${codeSeq++}`, name: 'Intro',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const makeOffering = (): Promise<Types.ObjectId> =>
    CourseOffering.create({
      collegeId, courseId: course._id, semesterId,
      sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 0,
    }).then((o) => o._id as Types.ObjectId);
  const a = await makeOffering();
  const b = await makeOffering();
  await Enrollment.create({ collegeId, studentId: students[0]!._id, courseOfferingId: a, semesterId, status: 'enrolled' });
  await Enrollment.create({ collegeId, studentId: students[0]!._id, courseOfferingId: b, semesterId, status: 'enrolled' });
  await Enrollment.create({ collegeId, studentId: students[1]!._id, courseOfferingId: a, semesterId, status: 'enrolled' });
  return {
    studentIds: [String(students[0]!._id), String(students[1]!._id)],
    byPersonId: String(byPerson._id),
    facultyId: String(faculty._id),
    courseId: String(course._id),
    offeringIds: [String(a), String(b)],
    makeOffering,
  };
}

async function closedSession(offeringId: string, facultyId: string, day: number): Promise<Types.ObjectId> {
  const doc = await AttendanceSession.create({
    collegeId, courseOfferingId: new Types.ObjectId(offeringId),
    date: new Date(`2026-07-${String(day).padStart(2, '0')}T00:00:00Z`), period: 1,
    facultyId: new Types.ObjectId(facultyId), status: 'closed',
  });
  return doc._id as Types.ObjectId;
}

async function rec(sessionId: Types.ObjectId, studentId: string, byPersonId: string, status: string): Promise<void> {
  await AttendanceRecord.create({
    collegeId, sessionId, studentId: new Types.ObjectId(studentId),
    status, markedBy: new Types.ObjectId(byPersonId),
  });
}

function summaryFilter(studentId: string, offeringId: string) {
  return { collegeId: collegeId.toString(), studentId, courseOfferingId: offeringId };
}

describe('attendance summary wiring', () => {
  beforeEach(async () => { await clearCollections(); });

  it('stores a null percentage and safe category when nothing was held, and never alerts (R13)', async () => {
    const b = await seedBase();
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.percentage).toBeNull();
    expect(s.category).toBe('safe');
    expect(s.projectedFinal).toBe(0);
    expect(await AttendanceAlert.countDocuments({ collegeId })).toBe(0);
  });

  it('rounds to one decimal, categorises at_risk and creates one alert', async () => {
    const b = await seedBase();
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
      await closedSession(b.offeringIds[0]!, b.facultyId, 3),
    ];
    await rec(ses[0]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[1]!, b.studentIds[0]!, b.byPersonId, 'od');
    await rec(ses[2]!, b.studentIds[0]!, b.byPersonId, 'absent');
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.totalClasses).toBe(3);
    expect(s.percentage).toBe(66.7);
    expect(s.category).toBe('at_risk');
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[0]! });
    expect(alert?.alertType).toBe('at_risk');
    expect(alert?.threshold).toBe(65);
  });

  it('keeps the hard-coded warning band at threshold 75 (R9 pin)', async () => {
    const b = await seedBase();
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
      await closedSession(b.offeringIds[0]!, b.facultyId, 3),
      await closedSession(b.offeringIds[0]!, b.facultyId, 4),
    ];
    await rec(ses[0]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[1]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[2]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[3]!, b.studentIds[0]!, b.byPersonId, 'absent');
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.percentage).toBe(75);
    expect(s.category).toBe('warning');
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[0]! });
    expect(alert?.alertType).toBe('warning');
    expect(alert?.threshold).toBe(75);
  });

  it('moves categories with juvi.attendanceThreshold but keeps alert thresholds hard-coded (R9 pin)', async () => {
    const b = await seedBase(60);
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
      await closedSession(b.offeringIds[0]!, b.facultyId, 3),
      await closedSession(b.offeringIds[0]!, b.facultyId, 4),
      await closedSession(b.offeringIds[0]!, b.facultyId, 5),
    ];
    await rec(ses[0]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[1]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[2]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[3]!, b.studentIds[0]!, b.byPersonId, 'absent');
    await rec(ses[4]!, b.studentIds[0]!, b.byPersonId, 'absent');
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.percentage).toBe(60);
    expect(s.category).toBe('warning'); // T = 60: warning band [60, 70)
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[0]! });
    expect(alert?.alertType).toBe('warning');
    expect(alert?.threshold).toBe(75); // NOT 60 — the alert path ignores the setting per R9
  });

  it('bulkUpsertAttendanceRecords keeps summaries current for every marked student', async () => {
    const b = await seedBase();
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
    ];
    await bulkUpsertAttendanceRecords(collegeId.toString(), [
      { sessionId: String(ses[0]), studentId: b.studentIds[0], status: 'present', markedBy: b.byPersonId },
      { sessionId: String(ses[1]), studentId: b.studentIds[0], status: 'present', markedBy: b.byPersonId },
      { sessionId: String(ses[0]), studentId: b.studentIds[1], status: 'absent', markedBy: b.byPersonId },
      { sessionId: String(ses[1]), studentId: b.studentIds[1], status: 'absent', markedBy: b.byPersonId },
    ]);
    const a = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(a?.percentage).toBe(100);
    const c = await AttendanceSummary.findOne(summaryFilter(b.studentIds[1]!, b.offeringIds[0]!));
    expect(c?.percentage).toBe(0);
    expect(c?.category).toBe('detained');
    expect(
      await AttendanceSummary.countDocuments(summaryFilter(b.studentIds[1]!, b.offeringIds[1]!)),
    ).toBe(0);
  });

  it('closing a session recomputes every enrolled student; opening does not', async () => {
    const b = await seedBase();
    await createAttendanceSession(collegeId.toString(), {
      courseOfferingId: b.offeringIds[0], date: '2026-07-01', period: 1, facultyId: b.facultyId, status: 'closed',
    }, 'user-1');
    expect(await AttendanceSummary.countDocuments({ collegeId, courseOfferingId: b.offeringIds[0] })).toBe(2);
    await createAttendanceSession(collegeId.toString(), {
      courseOfferingId: b.offeringIds[1], date: '2026-07-02', period: 1, facultyId: b.facultyId, status: 'open',
    }, 'user-1');
    expect(await AttendanceSummary.countDocuments({ collegeId, courseOfferingId: b.offeringIds[1] })).toBe(0);
  });

  it('moving a session to another offering recomputes both offerings', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[1]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[1]!);
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!); // both rows pre-exist
    await updateAttendanceSession(collegeId.toString(), String(sesId), { courseOfferingId: b.offeringIds[0]! }, 'user-1');
    const movedFrom = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[1]!));
    expect(movedFrom?.totalClasses).toBe(0);
    expect(movedFrom?.percentage).toBeNull();
    const movedTo = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(movedTo?.totalClasses).toBe(1);
    expect(movedTo?.percentage).toBe(100);
  });

  it('create and update attendance records keep the summary fresh', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    const doc = await createAttendanceRecord(collegeId.toString(), {
      sessionId: String(sesId), studentId: b.studentIds[0]!, status: 'absent', markedBy: b.byPersonId,
    }, 'user-1');
    let s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.percentage).toBe(0);
    await updateAttendanceRecord(collegeId.toString(), String(doc._id), { status: 'present' }, 'user-1');
    s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.percentage).toBe(100);
  });

  it('deleting a session recomputes its summaries from remaining records', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    await deleteAttendanceSession(collegeId.toString(), String(sesId), 'user-1');
    const s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.totalClasses).toBe(0);
    expect(s?.percentage).toBeNull();
  });

  it('deleting an attendance record recomputes the summary to 0%', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    const recDoc = await AttendanceRecord.create({
      collegeId, sessionId: sesId, studentId: new Types.ObjectId(b.studentIds[0]!),
      status: 'present', markedBy: new Types.ObjectId(b.byPersonId),
    });
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect((await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!)))?.percentage).toBe(100);
    await deleteAttendanceRecord(collegeId.toString(), String(recDoc._id), 'user-1');
    const s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.attended).toBe(0);
    expect(s?.percentage).toBe(0);
  });

  it('recomputeSummaries dedupes pairs and survives unknown offerings', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    await expect(recomputeSummaries(collegeId.toString(), [
      { studentId: b.studentIds[0]!, courseOfferingId: new Types.ObjectId().toString() }, // unknown — swallowed
      { studentId: b.studentIds[0]!, courseOfferingId: b.offeringIds[0]! },
      { studentId: b.studentIds[0]!, courseOfferingId: b.offeringIds[0]! }, // duplicate — deduped
    ])).resolves.toBeUndefined();
    expect(
      await AttendanceSummary.countDocuments(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!)),
    ).toBe(1);
  });

  it('computeAttendanceSummary matches the formula and leaves projectedFinal unset', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    const computed = await computeAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(computed.percentage).toBe(100);
    expect(computed.projectedFinal).toBeUndefined();
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[1]!, b.offeringIds[0]!);
    const viaUpdate = await AttendanceSummary.findOne(summaryFilter(b.studentIds[1]!, b.offeringIds[0]!));
    expect(viaUpdate?.projectedFinal).toBe(0);
  });

  it('checkAttendanceThreshold returns 0/false for a null percentage in both branches', async () => {
    const b = await seedBase();
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!); // row with pct null
    const stored = await checkAttendanceThreshold(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(stored).toEqual({ meetsThreshold: false, percentage: 0, threshold: 75 });
    const computed = await checkAttendanceThreshold(collegeId.toString(), b.studentIds[1]!, b.offeringIds[1]!); // no row
    expect(computed).toEqual({ meetsThreshold: false, percentage: 0, threshold: 75 });
  });

  it('generateAttendanceAlerts skips never-held students and alerts only the 0% one', async () => {
    const b = await seedBase();
    expect(await generateAttendanceAlerts(collegeId.toString(), b.offeringIds[0]!, 'user-1'))
      .toEqual({ alertCount: 0, totalStudents: 2 });
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    expect(await generateAttendanceAlerts(collegeId.toString(), b.offeringIds[0]!, 'user-1'))
      .toEqual({ alertCount: 1, totalStudents: 2 });
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[1]! });
    expect(alert?.alertType).toBe('detained');
  });

  it('hall-ticket eligibility passes a never-held course and still blocks a 0% one (R13)', async () => {
    const b = await seedBase();
    await Enrollment.create({
      collegeId, studentId: new Types.ObjectId(b.studentIds[1]!),
      courseOfferingId: new Types.ObjectId(b.offeringIds[1]!), semesterId, status: 'enrolled',
    });
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[1]!, b.offeringIds[0]!); // stays null
    const sesId = await closedSession(b.offeringIds[1]!, b.facultyId, 2);
    await rec(sesId, b.studentIds[1]!, b.byPersonId, 'absent');
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[1]!, b.offeringIds[1]!); // 0%
    const { reasons } = await checkHallTicketEligibility(collegeId.toString(), b.studentIds[1]!, semesterId.toString());
    expect(reasons.filter((r) => r.includes('Attendance below'))).toHaveLength(1);
    expect(reasons.join('; ')).toContain(b.offeringIds[1]!);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/academics/__tests__/attendance-summary.test.ts`
Expected: FAIL — `recomputeSummaries` is not exported from `../service`, and the first test's `expect(s.percentage).toBeNull()` fails against the current `0`-based implementation.
- [ ] **Step 3: Write the implementation**

Apply these edits in order. Use the `Edit` tool; the old strings below are verbatim from the current files.

**3a. `backend/src/models/academic-ops/AttendanceSummary.ts` — nullable percentage.**

In the interface:

```
old: percentage: number;
new: percentage: number | null;
```

In the schema:

```
old: percentage: { type: Number, default: 0, min: 0, max: 100 },
new: percentage: { type: Number, default: null, min: 0, max: 100 },
```

(Mongo min/max validators skip `null`, so no range validation change is needed. Document the new meaning with a comment above the field: `/** §5.4: null = nothing held (no closed session yet); never alerts. */`.)

**3b. `backend/src/modules/academics/service.ts` — imports.**

```
old: import { FilterQuery } from 'mongoose';
new: import { FilterQuery, Types } from 'mongoose';
```

```
old: import { AppError } from '../../middleware/errorHandler';
new: import { AppError } from '../../middleware/errorHandler';
import { attendanceCategory, courseAttendanceFor } from './attendance-formula';
```

**3c. Delete the dead hard-coded categorizer** (the formula owns bands now; a non-exported function would be a TS6133 error under `noUnusedLocals`).

Verify nothing else references it first:

```bash
rtk proxy grep -rn "categorizeAttendance" backend/src --include='*.ts'
```

Expected: only the definition and the call inside the old `updateAttendanceSummary` (which Step 3d replaces). Then delete lines 1841–1849 (doc comment + function):

```
old:
/**
 * Determine attendance category based on percentage.
 */
function categorizeAttendance(percentage: number): 'safe' | 'warning' | 'at_risk' | 'detained' {
  if (percentage >= 85) return 'safe';
  if (percentage >= 75) return 'warning';
  if (percentage >= 65) return 'at_risk';
  return 'detained';
}

new: (nothing — remove the block)
```

**3d. Rewrite `updateAttendanceSummary`** (keep the existing doc comment `Recompute attendance summary after attendance marking. W02-L2-008`; replace the whole function body):

```typescript
export async function updateAttendanceSummary(
  collegeId: string,
  studentId: string,
  courseOfferingId: string,
  threshold?: number,
) {
  // 1. Same 404 as before.
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');
  const semesterId = String(offering.semesterId);

  // 2-4. The ONE formula (spec §5.4). held = closed sessions; attended = present|late|od.
  const calc = await courseAttendanceFor(collegeId, studentId, courseOfferingId, threshold);
  const category = attendanceCategory(calc.pct, calc.threshold);

  // 5. Previous summary, to detect a category change.
  const previousSummary = await AttendanceSummary.findOne({ collegeId, studentId, courseOfferingId })
    .select('category').lean<{ category?: string } | null>();
  const previousCategory = previousSummary?.category;

  // 6. Upsert — bare fields, as before.
  const summary = await AttendanceSummary.findOneAndUpdate(
    { collegeId, studentId, courseOfferingId },
    {
      collegeId,
      studentId,
      courseOfferingId,
      semesterId,
      totalClasses: calc.held,
      attended: calc.attended,
      percentage: calc.pct,
      category,
      projectedFinal: calc.pct ?? 0,
      lastUpdatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // 7. Category changed → threshold alert. Ruling R9: the alert thresholds stay
  //    hard-coded 75/65 inside checkAttendanceThresholds; a null pct never alerts.
  if (calc.pct !== null && category !== previousCategory) {
    await checkAttendanceThresholds(collegeId, studentId, courseOfferingId, semesterId, calc.pct, category);
  }
  return summary;
}
```

**3e. Add the recompute helpers** right after `resolvePersonIdForUser` (before `deleteAttendanceRecord`):

```typescript
/** The offering a session belongs to; '' when the session row is already gone. */
async function courseOfferingIdOfSession(collegeId: string, sessionId: string): Promise<string> {
  const session = await AttendanceSession.findOne({ _id: sessionId, collegeId })
    .select('courseOfferingId').lean<{ courseOfferingId: unknown } | null>();
  return session && session.courseOfferingId ? String(session.courseOfferingId) : '';
}

/**
 * Recomputes AttendanceSummary rows for (studentId, courseOfferingId) pairs so
 * §5.4 stays true after any attendance mutation. Dedupes pairs, skips pairs
 * whose offering vanished, and lets one bad pair fail without failing the rest.
 */
export async function recomputeSummaries(
  collegeId: string,
  pairs: { studentId: string; courseOfferingId: string }[],
): Promise<void> {
  const unique = new Map<string, { studentId: string; courseOfferingId: string }>();
  for (const p of pairs) {
    if (!p.courseOfferingId) continue;
    unique.set(`${p.studentId}:${p.courseOfferingId}`, p);
  }
  for (const p of unique.values()) {
    try {
      await updateAttendanceSummary(collegeId, p.studentId, p.courseOfferingId);
    } catch (err) {
      console.error(`[attendance] summary recompute failed for student ${p.studentId} offering ${p.courseOfferingId}:`, err);
    }
  }
}
```

**3f. Wire the six marking writes.** Replace each whole function (verbatim current bodies):

`createAttendanceSession`:

```typescript
export async function createAttendanceSession(collegeId: string, data: any, performedBy: string) {
  const doc = await AttendanceSession.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AttendanceSession', entityId: String(doc._id), entityName: `${data.date} P${data.period}`, action: 'create', changes: [], performedBy });
  // Closing a session is the first time held can rise: recompute every enrolled student.
  if (data?.status === 'closed') {
    const students = await Enrollment.find({ collegeId, courseOfferingId: doc.courseOfferingId, status: 'enrolled' })
      .select('studentId').lean<{ studentId: Types.ObjectId }[]>();
    await recomputeSummaries(collegeId, students.map((e) => ({ studentId: String(e.studentId), courseOfferingId: String(doc.courseOfferingId) })));
  }
  return doc;
}
```

`updateAttendanceSession`:

```typescript
export async function updateAttendanceSession(collegeId: string, id: string, data: any, _performedBy: string) {
  const before = await AttendanceSession.findOne({ _id: id, collegeId })
    .select('courseOfferingId').lean<{ courseOfferingId?: unknown } | null>();
  const doc = await AttendanceSession.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Attendance session not found');
  const marked = await AttendanceRecord.find({ collegeId, sessionId: doc._id })
    .select('studentId').lean<{ studentId: Types.ObjectId }[]>();
  const pairs = marked.flatMap((m) => {
    const list = [{ studentId: String(m.studentId), courseOfferingId: String(doc.courseOfferingId) }];
    if (before?.courseOfferingId && String(before.courseOfferingId) !== String(doc.courseOfferingId)) {
      list.push({ studentId: String(m.studentId), courseOfferingId: String(before.courseOfferingId) });
    }
    return list;
  });
  await recomputeSummaries(collegeId, pairs);
  return doc;
}
```

`deleteAttendanceSession`:

```typescript
export async function deleteAttendanceSession(collegeId: string, id: string, _performedBy: string) {
  const doc = await AttendanceSession.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Attendance session not found');
  const marked = await AttendanceRecord.find({ collegeId, sessionId: id })
    .select('studentId').lean<{ studentId: Types.ObjectId }[]>();
  await AttendanceRecord.deleteMany({ sessionId: id, collegeId });
  await recomputeSummaries(collegeId, marked.map((m) => ({ studentId: String(m.studentId), courseOfferingId: String(doc.courseOfferingId) })));
  return { deleted: true };
}
```

`createAttendanceRecord`:

```typescript
export async function createAttendanceRecord(collegeId: string, data: any, _performedBy: string) {
  const doc = await AttendanceRecord.create({ ...data, collegeId });
  await recomputeSummaries(collegeId, [{
    studentId: String(doc.studentId),
    courseOfferingId: await courseOfferingIdOfSession(collegeId, String(doc.sessionId)),
  }]);
  return doc;
}
```

`updateAttendanceRecord`:

```typescript
export async function updateAttendanceRecord(collegeId: string, id: string, data: any, _performedBy: string) {
  const before = await AttendanceRecord.findOne({ _id: id, collegeId })
    .select('sessionId studentId').lean<{ sessionId: unknown; studentId: unknown } | null>();
  const doc = await AttendanceRecord.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Attendance record not found');
  const pairs: { studentId: string; courseOfferingId: string }[] = [];
  if (before) {
    pairs.push({
      studentId: String(before.studentId),
      courseOfferingId: await courseOfferingIdOfSession(collegeId, String(before.sessionId)),
    });
  }
  if (!before
    || String(before.sessionId) !== String(doc.sessionId)
    || String(before.studentId) !== String(doc.studentId)) {
    pairs.push({
      studentId: String(doc.studentId),
      courseOfferingId: await courseOfferingIdOfSession(collegeId, String(doc.sessionId)),
    });
  }
  await recomputeSummaries(collegeId, pairs);
  return doc;
}
```

`deleteAttendanceRecord` (the before-image from `findOneAndDelete` is no longer discarded):

```typescript
export async function deleteAttendanceRecord(collegeId: string, id: string, _performedBy: string) {
  const doc = await AttendanceRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Attendance record not found');
  await recomputeSummaries(collegeId, [{
    studentId: String(doc.studentId),
    courseOfferingId: await courseOfferingIdOfSession(collegeId, String(doc.sessionId)),
  }]);
  return { deleted: true };
}
```

`bulkUpsertAttendanceRecords` — insert between the `bulkWrite` call and the `return`, keeping the return shape:

```typescript
  const res = await AttendanceRecord.bulkWrite(ops, { ordered: false });
  // One offering lookup per distinct session, then recompute every marked student.
  const sessionOfferings = new Map<string, string>();
  for (const r of records) {
    const key = String(r.sessionId);
    if (!sessionOfferings.has(key)) sessionOfferings.set(key, await courseOfferingIdOfSession(collegeId, key));
  }
  await recomputeSummaries(collegeId, records.map((r) => ({
    studentId: String(r.studentId),
    courseOfferingId: sessionOfferings.get(String(r.sessionId)) ?? '',
  })));
  return {
    upserted: res.upsertedCount ?? 0,
    modified: res.modifiedCount ?? 0,
    total: records.length,
  };
```

**3g. Rewrite `computeAttendanceSummary`** in `backend/src/modules/academics/academic-delivery-service.ts` (replace the whole function; add the formula import at the top):

```typescript
old: import { AppError } from '../../middleware/errorHandler';
new: import { AppError } from '../../middleware/errorHandler';
import { attendanceCategory, courseAttendanceFor } from './attendance-formula';
```

```typescript
export async function computeAttendanceSummary(collegeId: string, studentId: string, courseOfferingId: string) {
  // The ONE formula (spec §5.4). Unlike updateAttendanceSummary this reader path
  // never sets projectedFinal and never alerts.
  const calc = await courseAttendanceFor(collegeId, studentId, courseOfferingId);
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId }).select('semesterId');
  const semesterId = offering ? String(offering.semesterId) : '';
  return AttendanceSummary.findOneAndUpdate(
    { collegeId, studentId, courseOfferingId },
    {
      collegeId,
      studentId,
      courseOfferingId,
      semesterId,
      totalClasses: calc.held,
      attended: calc.attended,
      percentage: calc.pct,
      category: attendanceCategory(calc.pct, calc.threshold),
      lastUpdatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
```

**3h. Guards in the same file.**

`checkAttendanceThreshold` (both branches coalesce to the legacy numeric shape):

```
old:
    return {
      meetsThreshold: computed.percentage >= threshold,
      percentage: computed.percentage,
      threshold,
    };
new:
    return {
      meetsThreshold: (computed.percentage ?? 0) >= threshold,
      percentage: computed.percentage ?? 0,
      threshold,
    };
```

```
old:
  return {
    meetsThreshold: summary.percentage >= threshold,
    percentage: summary.percentage,
    threshold,
  };
new:
  return {
    meetsThreshold: (summary.percentage ?? 0) >= threshold,
    percentage: summary.percentage ?? 0,
    threshold,
  };
```

`generateAttendanceAlerts` — null never counts as a failing percentage (R13):

```
old:     if (pct < 75) {
new:     if (pct !== null && pct < 75) {
```

`checkHallTicketEligibility` — a never-held course no longer blocks a hall ticket (R13):

```
old:     if (summary && summary.percentage < 75) {
new:     if (summary && summary.percentage !== null && summary.percentage < 75) {
```

**3i. Type fallout from `percentage: number | null`.** Where the spec is silent, legacy behaviour is preserved by coalescing `null → 0` in AVERAGES; the hall-ticket guard and the `$lt: 65` query range are the two places null must be excluded explicitly.

| File | Site | old → new |
|---|---|---|
| `academics/service.ts` | hall-ticket loop (~L2792) | `attendancePercent = summary.percentage;` → `attendancePercent = summary.percentage ?? 0;` and `if (summary.percentage < 75) {` → `if (summary.percentage !== null && summary.percentage < 75) {` |
| `academics/service.ts` | `attendanceAvg` (~L4615) | `attendanceSummaries.reduce((s, a) => s + a.percentage, 0)` → `attendanceSummaries.reduce((s, a) => s + (a.percentage ?? 0), 0)` |
| `academics/service.ts` | `avgAttendance` insight (~L4794) | same reduce coalescing, inside `const avgAttendance = Math.round(...)` (multi-line) |
| `academics/service.ts` | `overallAvgAttendance` (~L4931) | `summaries.reduce((s, a) => s + a.percentage, 0)` → `summaries.reduce((s, a) => s + (a.percentage ?? 0), 0)` |
| `academics/service.ts` | courseMap (~L4948) | `existing.total += s.percentage;` → `existing.total += s.percentage ?? 0;` |
| `academics/service.ts` | courseMap (~L4951) | `courseMap.set(key, { total: s.percentage, count: 1 })` → `courseMap.set(key, { total: s.percentage ?? 0, count: 1 })` |
| `academics/service.ts` | lowAttendance query (~L4997) | `percentage: { $lt: 65 },` → `percentage: { $gte: 0, $lt: 65 }, // §5.4: null (never held) must not read as low` |
| `academics/juvi-service.ts` | avg (~L40) | `attendanceSummaries.reduce((sum, s) => sum + s.percentage, 0) / totalCourses` → `attendanceSummaries.reduce((sum, s) => sum + (s.percentage ?? 0), 0) / totalCourses` |
| `academics/juvi-service.ts` | map (~L106) | `attendanceMap.set(String(summary.courseOfferingId), summary.percentage);` → `attendanceMap.set(String(summary.courseOfferingId), summary.percentage ?? 0);` |
| `academics/juvi-service.ts` | recommendations (~L147–186) | hoist `const matchedPct = matchedSummary?.percentage ?? 0;` directly after the `matchedSummary = attendanceSummaries.find(...)` declaration; then `if (matchedSummary && matchedSummary.percentage < 75) {` → `if (matchedPct < 75) {`; `\`Your attendance is ${matchedSummary.percentage.toFixed(1)}%.\`` → `\`Your attendance is ${matchedPct.toFixed(1)}%.\``; `matchedSummary && matchedSummary.percentage >= 90` → `matchedPct >= 90` |
| `finance/service.ts` | `computeDistressScore` (~L3665) | `const attendanceSignal = attendanceSummary\n    ? Math.max(0, Math.min(1, (75 - attendanceSummary.percentage) / 75))\n    : 0;` → `const attendanceSignal = attendanceSummary && attendanceSummary.percentage !== null\n    ? Math.max(0, Math.min(1, (75 - attendanceSummary.percentage) / 75))\n    : 0;` |

Notes:
- `reviewCondonationRequest` (~L2135) assigns a number to `percentage` — compiles untouched; accepted.
- The `$lt: 65` description template (~L5005) and the metrics map (~L5012) compile untouched — no edit.
- Verify no other `.percentage` reads exist after the model change:

```bash
rtk proxy grep -rn "\.percentage\b" backend/src/modules --include='*.ts' | rtk proxy grep -v "attendancePercent\b" | rtk proxy grep -v "__tests__"
```

Expected: every remaining hit either compiles (object property reads like `metrics` values) or is one of the sites above. If `npm run typecheck -w backend` still reports a TS18048/TS2367 on `.percentage`, coalesce that site the same way (`?? 0`) with the one-decimal rounding unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/academics/__tests__/attendance-summary.test.ts`
Expected: PASS (all 15).

- [ ] **Step 5: Run the full academics + finance test files and typecheck**

Run: `npm test -w backend -- --run src/modules/academics src/modules/finance`
Expected: PASS — any pre-existing academic/finance test that asserted `percentage` is `0` for a held=0 student now sees `null`; if (and only if) such an assertion surfaces here, update THAT assertion to `null` per R13 and note it in the commit body.

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/academic-ops/AttendanceSummary.ts backend/src/modules/academics/service.ts backend/src/modules/academics/academic-delivery-service.ts backend/src/modules/academics/juvi-service.ts backend/src/modules/academics/__tests__/attendance-summary.test.ts backend/src/modules/finance/service.ts
git commit -m "refactor(academics): route all attendance summaries through the §5.4 formula

percentage is now number|null (null = nothing held, never alerted); every
marking write (session create/update/delete, record create/update/delete,
bulk upsert) recomputes the affected students' summaries through one
recomputeSummaries helper. Alert thresholds stay hard-coded 75/65 (R9);
hall tickets no longer block on never-held courses."
```
### Task 12: `resolve-day.ts` — spec §6 reader shared by both surfaces

**Files:**
- Create: `backend/src/modules/juvi-app/home/resolve-day.ts`
- Test: `backend/src/modules/juvi-app/home/__tests__/resolve-day.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2 (`backend/src/modules/academics/timetable-date.ts`): `startOfDay(date: string, timezone: string): Date`, `addDays(date: string, n: number): string`, `ymd(at: Date, timezone: string): string`, `hhmmToMinutes(hhmm: string): number`.
  - From Task 3 (`backend/src/modules/academics/live-timetable.ts`): `liveSlotsForDay(collegeId: string, sectionIds: string[], at: Date, timezone: string): Promise<LeanTimetableSlot[]>`, `getLiveTimetables(collegeId: string, at: Date, timezone: string): Promise<Map<string, LeanTimetable>>`, `activeSemesterIds(collegeId: string): Promise<string[]>`, type `LeanTimetableSlot`.
  - From Task 4 (`backend/src/modules/academics/class-exception-service.ts`): `activeExceptionsFor(collegeId: string, filter: { slotIds?: string[]; offeringIds?: string[]; dates?: string[] })` — rows are non-revoked `ClassException` docs with fields `timetableSlotId`, `courseOfferingId`, `date`, `type: 'cancelled' | 'rescheduled'`, `newDate?`, `newStartTime?`, `newEndTime?`, `newRoomId?`.
  - Models (barrel `../../../models` except `College`): `AcademicCalendar`, `Course`, `CourseOffering`, `Enrollment`, `TimetableSlot`, `Section`, `Person`, `Faculty`, `Building`, `Room`, `Channel`.
- Produces (Task 14's home service imports exactly these):
  - `type DayViewer = { kind: 'student'; studentId: string } | { kind: 'faculty'; facultyId: string }` (Ruling R27 — account-kind routing happens in the controller, resolveDay takes the viewer).
  - `interface DayClass { offeringId: string; courseCode: string; title: string; section: string; start: string; end: string; slotType: string; status: 'cancelled' | 'rescheduled' | 'scheduled'; room?: string; faculty?: string; channelId?: string; registered?: number; movedFrom?: { date: string; start: string } }`
  - `interface DayView { date: string; holiday?: string; classes: DayClass[] }`
  - `resolveDay(collegeId: string, viewer: DayViewer, date: string, timezone: string): Promise<DayView>` (spec §6 writes `resolveDay(ctx, date)` — flattened here to the codebase's collegeId-first style; `timezone` comes from `getJuviConfig(collegeId)?.timezone ?? 'Asia/Kolkata'` in the caller, R23).
  - `nextTeachingDay(collegeId: string, viewer: DayViewer, date: string, timezone: string): Promise<DayView | undefined>` — scans offsets 1..14 strictly after `date`.
  - Optional display fields are OMITTED, never null (R11); room is `"<roomNumber>, <building name>"`, or just the room number when the building is unresolvable, and absent when the slot has no room (R25); `channelId` = the offering's active course channel id (R18); `registered` appears only for faculty viewers (R39).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/juvi-app/home/__tests__/resolve-day.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AcademicCalendar,
  Building,
  Channel,
  Course,
  CourseOffering,
  Enrollment,
  Faculty,
  Person,
  Room,
  Section,
  Semester,
  Student,
  Timetable,
  TimetableSlot,
} from '../../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { ClassException } from '../../../../models/academic-ops/ClassException';
import { nextTeachingDay, resolveDay } from '../resolve-day';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let codeSeq = 0;

interface TeachingWorld {
  semesterId: Types.ObjectId;
  sectionId: Types.ObjectId;
  studentId: string;
  facultyId: string;
  altFacultyId: string;
  substitutePersonId: string;
  makeOffering: (facultyId: Types.ObjectId, enrolledCount?: number) => Promise<Types.ObjectId>;
  makeTimetable: (version: number, slots: { day: string; start: string; end: string; period: number; offeringId: Types.ObjectId; roomId?: Types.ObjectId | null; substituteFacultyId?: Types.ObjectId | null; originalFacultyId?: Types.ObjectId | null }[]) => Promise<Types.ObjectId>;
  roomId: Types.ObjectId;
}

async function seedTeachingWorld(): Promise<TeachingWorld> {
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const section = await Section.create({
    collegeId, name: 'CSE-A', branchId: new Types.ObjectId(), batchId: new Types.ObjectId(),
    year: 2, semester: 1, capacity: 60, studentIds: [],
  });
  const teacher = await Person.create({ collegeId, name: 'Dr. Rao', phone: '9000090001', gender: 'male' });
  const studentPerson = await Person.create({ collegeId, name: 'Test Student', phone: '9000090002', gender: 'male' });
  const substitute = await Person.create({ collegeId, name: 'Dr. Sub', phone: '9000090003', gender: 'female' });
  const faculty = await Faculty.create({ collegeId, personId: teacher._id, employeeCode: `FAC${codeSeq++}`, designation: 'Professor', contractType: 'regular', status: 'active' });
  const altFaculty = await Faculty.create({ collegeId, personId: substitute._id, employeeCode: `FAC${codeSeq++}`, designation: 'Professor', contractType: 'regular', status: 'active' });
  const student = await Student.create({
    collegeId, personId: studentPerson._id, admissionYear: 2026,
    rollNumber: `26JIT${codeSeq++}`, status: 'active', onboardingStatus: 'not_started',
  });
  const course = await Course.create({
    collegeId, code: 'CS101', name: 'Intro to CS',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const building = await Building.create({ collegeId, name: 'Alpha Block', code: `AB${codeSeq++}`, floors: 3, totalRooms: 30 });
  const room = await Room.create({
    collegeId, buildingId: building._id, roomNumber: '101', floor: 1, type: 'classroom', capacity: 60,
  });
  const makeOffering = (offFacultyId: Types.ObjectId, enrolledCount = 0): Promise<Types.ObjectId> =>
    CourseOffering.create({
      collegeId, courseId: course._id, semesterId, sectionId: section._id,
      facultyId: offFacultyId, maxEnrollment: 60, enrolledCount,
    }).then((o) => o._id as Types.ObjectId);
  const makeTimetable = async (
    version: number,
    slots: {
      day: string; start: string; end: string; period: number; offeringId: Types.ObjectId;
      roomId?: Types.ObjectId | null; substituteFacultyId?: Types.ObjectId | null; originalFacultyId?: Types.ObjectId | null;
    }[],
  ): Promise<Types.ObjectId> => {
    const tt = await Timetable.create({
      collegeId, semesterId, sectionId: section._id, version,
      status: 'published', effectiveFrom: new Date('2026-10-01T00:00:00Z'),
    });
    for (const s of slots) {
      await TimetableSlot.create({
        collegeId, timetableId: tt._id, day: s.day, period: s.period,
        startTime: s.start, endTime: s.end, courseOfferingId: s.offeringId,
        roomId: s.roomId ?? room._id, slotType: s.roomId === null ? 'free' : 'lecture',
        substituteFacultyId: s.substituteFacultyId ?? undefined,
        originalFacultyId: s.originalFacultyId ?? undefined,
      });
    }
    return tt._id as Types.ObjectId;
  };
  return {
    semesterId: semester._id, sectionId: section._id,
    studentId: String(student._id), facultyId: String(faculty._id), altFacultyId: String(altFaculty._id),
    substitutePersonId: String(substitute._id),
    makeOffering, makeTimetable, roomId: room._id,
  };
}

async function enroll(studentId: string, offeringId: Types.ObjectId): Promise<void> {
  await Enrollment.create({
    collegeId, studentId: new Types.ObjectId(studentId), courseOfferingId: offeringId,
    semesterId: new Types.ObjectId('000000000000000000000000'), status: 'enrolled', enrolledAt: new Date(),
  });
}

async function enrollIn(semesterId: Types.ObjectId, studentId: string, offeringId: Types.ObjectId): Promise<void> {
  await Enrollment.create({
    collegeId, studentId: new Types.ObjectId(studentId), courseOfferingId: offeringId,
    semesterId, status: 'enrolled', enrolledAt: new Date(),
  });
}

async function cancelException(offeringId: Types.ObjectId, slotId: Types.ObjectId, date: string): Promise<void> {
  await ClassException.create({
    collegeId, timetableSlotId: slotId, courseOfferingId: offeringId, date,
    type: 'cancelled', reason: 'Faculty unavailable today', createdBy: new Types.ObjectId(),
  });
}

async function rescheduleException(
  offeringId: Types.ObjectId, slotId: Types.ObjectId, date: string, newDate: string,
  newStart: string, newEnd: string, newRoomId?: Types.ObjectId,
): Promise<void> {
  await ClassException.create({
    collegeId, timetableSlotId: slotId, courseOfferingId: offeringId, date,
    type: 'rescheduled', newDate, newStartTime: newStart, newEndTime: newEnd,
    ...(newRoomId ? { newRoomId } : {}),
    reason: 'Moved for the day', createdBy: new Types.ObjectId(),
  });
}

async function publishHoliday(title: string, date: string): Promise<void> {
  await AcademicCalendar.create({
    collegeId, academicYearId: new Types.ObjectId(), title,
    eventType: 'holiday', startDate: new Date(`${date}T00:00:00Z`),
    endDate: new Date(`${date}T00:00:00Z`), isHoliday: true, status: 'published',
  });
}

describe('resolveDay', () => {
  beforeEach(async () => { await clearCollections(); });

  it('shows a student their active-semester classes, decorated and sorted (§11 row 1)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId, 2);
    const b = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await enrollIn(w.semesterId, w.studentId, b);
    await w.makeTimetable(1, [
      { day: 'monday', start: '10:00', end: '11:00', period: 2, offeringId: a, roomId: w.roomId },
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: b },
    ]);
    await Channel.create({
      collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
      scopeId: a, name: 'CS101 A', about: 'Course discussion',
      postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine',
    });
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.date).toBe('2026-11-09');
    expect(day.holiday).toBeUndefined();
    expect(day.classes.map((c) => c.start)).toEqual(['09:00', '10:00']);
    expect(day.classes[0]).toMatchObject({ offeringId: String(b), courseCode: 'CS101', title: 'Intro to CS', section: 'CSE-A', slotType: 'lecture', status: 'scheduled' });
    expect(day.classes[0]!.faculty).toBe('Dr. Rao');
    expect(day.classes[0]!.channelId).toBeUndefined();
    expect(day.classes[1]!.room).toBe('101, Alpha Block');
    expect(day.classes[1]!.channelId).toBeTruthy();
    expect(day.classes[0]!.registered).toBeUndefined();
  });

  it('gives faculty viewers registered counts and drops no classes (§11 row 2)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId, 37);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
    ]);
    const day = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.facultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.registered).toBe(37);
  });

  it('resolves substitutions for both viewers (§11 row 3)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    const tt = await w.makeTimetable(1, []);
    await TimetableSlot.create({
      collegeId, timetableId: tt, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: a,
      slotType: 'lecture', substituteFacultyId: new Types.ObjectId(w.altFacultyId),
      originalFacultyId: new Types.ObjectId(w.facultyId), isSubstitution: true,
    });
    const dayStudent = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(dayStudent.classes[0]!.faculty).toBe('Dr. Sub');
    const daySub = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.altFacultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(daySub.classes.map((c) => c.offeringId)).toEqual([String(a)]);
    const dayOriginal = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.facultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(dayOriginal.classes).toHaveLength(0);
  });

  it('keeps a cancelled class visible with status cancelled (§11 row 4)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a }]);
    const slot = (await TimetableSlot.find({ collegeId }).lean())[0]!;
    await cancelException(a, slot._id, '2026-11-09');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.status).toBe('cancelled');
  });

  it('moves a class off its original date and onto the new one (§11 row 5)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'friday', start: '14:00', end: '15:00', period: 6, offeringId: a },
    ]);
    const fridaySlot = (await TimetableSlot.find({ collegeId, day: 'friday' }).lean())[0]!;
    await rescheduleException(a, fridaySlot._id, '2026-11-13', '2026-11-09', '13:00', '14:00');
    const source = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-13', 'Asia/Kolkata');
    expect(source.classes).toHaveLength(0);
    const moved = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(moved.classes).toHaveLength(1);
    expect(moved.classes[0]).toMatchObject({ status: 'rescheduled', start: '13:00', end: '14:00', movedFrom: { date: '2026-11-13', start: '14:00' } });
  });

  it('returns a holiday day with no classes for a published holiday (§11 row 6)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a }]);
    await publishHoliday('Diwali', '2026-11-09');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.holiday).toBe('Diwali');
    expect(day.classes).toHaveLength(0);
  });

  it('hides a class rescheduled INTO a published holiday (Review Focus #4)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'friday', start: '14:00', end: '15:00', period: 6, offeringId: a }]);
    const fridaySlot = (await TimetableSlot.find({ collegeId, day: 'friday' }).lean())[0]!;
    await rescheduleException(a, fridaySlot._id, '2026-11-13', '2026-11-09', '13:00', '14:00');
    await publishHoliday('Diwali', '2026-11-09');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.holiday).toBe('Diwali');
    expect(day.classes).toHaveLength(0);
  });

  it('shows a cancelled class and a move-in together on the same day, sorted (Review Focus #2)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    const b = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await enrollIn(w.semesterId, w.studentId, b);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'friday', start: '10:00', end: '11:00', period: 2, offeringId: b },
    ]);
    const mondaySlot = (await TimetableSlot.find({ collegeId, day: 'monday' }).lean())[0]!;
    const fridaySlot = (await TimetableSlot.find({ collegeId, day: 'friday' }).lean())[0]!;
    await cancelException(a, mondaySlot._id, '2026-11-09');
    await rescheduleException(b, fridaySlot._id, '2026-11-13', '2026-11-09', '08:00', '09:00');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes.map((c) => [c.status, c.start])).toEqual([['rescheduled', '08:00'], ['cancelled', '09:00']]);
    expect(day.classes[0]!.movedFrom).toEqual({ date: '2026-11-13', start: '10:00' });
  });

  it('handles a student with no enrollments and an offering without a faculty person (Review Focus #5)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId, 0);
    await w.makeTimetable(1, [{ day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a }]);
    const empty = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(empty.classes).toHaveLength(0);
    const unlinked = await Person.create({ collegeId, name: 'Ghost Faculty', phone: '9000090004', gender: 'male' });
    const ghostFaculty = await Faculty.create({ collegeId, personId: unlinked._id, employeeCode: `FAC${codeSeq++}`, designation: 'Visiting', contractType: 'visiting', status: 'active' });
    await Person.findByIdAndDelete(unlinked._id);
    const b = await w.makeOffering(ghostFaculty._id);
    await enrollIn(w.semesterId, w.studentId, b);
    await w.makeTimetable(2, [{ day: 'monday', start: '11:00', end: '12:00', period: 3, offeringId: b }]);
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.faculty).toBeUndefined();
    const facDay = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.facultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(facDay.classes[0]!.registered).toBe(0);
  });

  it('returns no classes on a Sunday (R10)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'saturday', start: '09:00', end: '10:00', period: 1, offeringId: a },
    ]);
    await enroll(w.studentId, a); // stray wrong-semester enrollment must not leak
    const sunday = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-15', 'Asia/Kolkata');
    expect(sunday.classes).toHaveLength(0);
  });

  it('resolves the live timetable version only (§11 row: live rule)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'monday', start: '10:00', end: '11:00', period: 2, offeringId: a }]);
    await w.makeTimetable(2, [{ day: 'monday', start: '08:00', end: '09:00', period: 1, offeringId: a }]);
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes.map((c) => c.start)).toEqual(['08:00']);
  });

  it('follows the college-local day, not the UTC day of the instant (R53)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    // 2026-11-09T00:00Z is 05:30 IST on 11-09. `live-timetable.ts` keeps a timetable whose
    // `effectiveFrom` is strictly before the end of the queried LOCAL day, so it matters how
    // that day end is computed. Correct rule: dayStart 2026-11-08T18:30Z, dayEnd
    // 2026-11-09T18:30Z — the instant precedes dayEnd, so the term has opened. Old rule (the
    // UTC day OF THAT INSTANT, i.e. 11-08): dayEnd 2026-11-09T00:00Z — the instant does not
    // precede it, so the term had not opened. The two rules disagree, which is what makes the
    // IST assertion below the one that fails if the boundary regresses to the UTC day; the UTC
    // assertion holds under both rules and merely fixes the term's nominal date.
    const tt = await Timetable.create({
      collegeId, semesterId: w.semesterId, sectionId: w.sectionId,
      version: 1, status: 'published', effectiveFrom: new Date('2026-11-09T00:00:00Z'),
    });
    await TimetableSlot.create({
      collegeId, timetableId: tt._id, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: a, slotType: 'lecture',
    });
    const utcDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'UTC');
    expect(utcDay.classes).toHaveLength(1);
    const istDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(istDay.classes).toHaveLength(1);
  });

  it('reads the day window in the caller\'s timezone (§11 row: timezone)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    // The window starts at LOCAL midnight of 2026-11-10 in IST — 2026-11-09T18:30Z — so the
    // nominal date 2026-11-09 is inside the term for a UTC college and outside it for an IST
    // one. This pins that `timezone` reaches the window bound at all: a resolveDay that ignored
    // the argument and used the day of the raw date string would return 1 for IST as well.
    // It does NOT pin the local-day-over-UTC-day rule — both expectations hold under either
    // rule, in both timezones — so do not rely on it to catch an R53 regression; the test above
    // is the one that does. Keep it: it is the only test at this layer that fails if the tz
    // argument stops reaching the window.
    const tt = await Timetable.create({
      collegeId, semesterId: w.semesterId, sectionId: w.sectionId,
      version: 1, status: 'published', effectiveFrom: new Date('2026-11-09T18:30:00Z'),
    });
    await TimetableSlot.create({
      collegeId, timetableId: tt._id, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: a, slotType: 'lecture',
    });
    const utcDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'UTC');
    expect(utcDay.classes).toHaveLength(1);
    const istDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(istDay.classes).toHaveLength(0);
  });

  it('scans forward for the next teaching day, skipping holidays and Sundays', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'tuesday', start: '09:00', end: '10:00', period: 1, offeringId: a },
    ]);
    await publishHoliday('Diwali', '2026-11-09'); // Monday
    const next = await nextTeachingDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-08', 'Asia/Kolkata');
    expect(next?.date).toBe('2026-11-10');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/resolve-day.test.ts`
Expected: FAIL — `Cannot find module '../resolve-day'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/juvi-app/home/resolve-day.ts`:

```typescript
import { Types } from 'mongoose';

import { activeExceptionsFor } from '../../academics/class-exception-service';
import {
  activeSemesterIds,
  getLiveTimetables,
  liveSlotsForDay,
  type LeanTimetableSlot,
} from '../../academics/live-timetable';
import { addDays, hhmmToMinutes, startOfDay } from '../../academics/timetable-date';
import { AcademicCalendar } from '../../../models/academic-ops/AcademicCalendar';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Section } from '../../../models/academic-structure/Section';
import { Building } from '../../../models/campus/Building';
import { Room } from '../../../models/campus/Room';
import { Person } from '../../../models/people/Person';
import { Faculty } from '../../../models/people/Faculty';
import { Channel } from '../../../models/juvi/Channel';

export type DayViewer = { kind: 'student'; studentId: string } | { kind: 'faculty'; facultyId: string };

export interface DayClass {
  offeringId: string;
  courseCode: string;
  title: string;
  section: string;
  start: string;
  end: string;
  slotType: string;
  status: 'cancelled' | 'rescheduled' | 'scheduled';
  room?: string;
  faculty?: string;
  channelId?: string;
  registered?: number;
  movedFrom?: { date: string; start: string };
}

export interface DayView {
  date: string;
  holiday?: string;
  classes: DayClass[];
}

interface EffEntry {
  offeringId: string;
  start: string;
  end: string;
  slotType: string;
  roomId: string | undefined;
  status: 'cancelled' | 'rescheduled' | 'scheduled';
  subFacultyId: string | undefined;
  movedFrom?: { date: string; start: string };
}

const asObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

/** §6: the published holiday covering this date, if any. */
async function holidayCovering(collegeId: string, date: string, timezone: string): Promise<string | undefined> {
  const dayStart = startOfDay(date, timezone);
  const dayEnd = startOfDay(addDays(date, 1), timezone);
  const doc = await AcademicCalendar.find({
    collegeId,
    status: 'published',
    isHoliday: true,
    startDate: { $lte: dayEnd },
    endDate: { $gte: dayStart },
  }).sort({ startDate: -1 }).limit(1).lean<{ title: string } | null>();
  return doc?.title;
}

/** §6 reader for one date. Spec writes resolveDay(ctx, date); callers pass timezone from the college config. */
export async function resolveDay(
  collegeId: string,
  viewer: DayViewer,
  date: string,
  timezone: string,
): Promise<DayView> {
  const at = startOfDay(date, timezone);

  // The holiday gate runs FIRST (Review Focus #4): a published holiday hides
  // regular slots and move-ins alike.
  const holiday = await holidayCovering(collegeId, date, timezone);
  if (holiday) return { date, holiday, classes: [] };

  const active = await activeSemesterIds(collegeId);
  const poolOfferingIds = new Set<string>();
  let slotPool: LeanTimetableSlot[] = [];

  if (viewer.kind === 'student') {
    // Student classes = active-semester enrollments → offerings → the live
    // timetable slots of their sections.
    if (active.length === 0) return { date, classes: [] };
    const enrollments = await Enrollment.find({
      collegeId, studentId: viewer.studentId, status: 'enrolled', semesterId: { $in: active },
    }).select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
    const enrolledIds = [...new Set(enrollments.map((e) => String(e.courseOfferingId)))];
    if (enrolledIds.length === 0) return { date, classes: [] };
    const offered = await CourseOffering.find({
      collegeId, _id: { $in: enrolledIds.map(asObjectId) },
    }).select('_id sectionId').lean<{ _id: Types.ObjectId; sectionId: Types.ObjectId }[]>();
    for (const o of offered) poolOfferingIds.add(String(o._id));
    const sectionIds = [...new Set(offered.map((o) => String(o.sectionId)))];
    const slots = await liveSlotsForDay(collegeId, sectionIds, at, timezone);
    slotPool = slots.filter((s) => poolOfferingIds.has(String(s.courseOfferingId)));
  } else {
    // Faculty classes = owned offerings' slots across ALL live sections, plus
    // slots substituting for them, minus slots they were replaced out of.
    if (active.length > 0) {
      const owned = await CourseOffering.find({
        collegeId,
        $or: [
          { facultyId: asObjectId(viewer.facultyId) },
          { coFacultyIds: asObjectId(viewer.facultyId) },
        ],
        semesterId: { $in: active },
      }).select('_id').lean<{ _id: Types.ObjectId }[]>();
      for (const o of owned) poolOfferingIds.add(String(o._id));
    }
    const live = await getLiveTimetables(collegeId, at, timezone);
    const slots = await liveSlotsForDay(collegeId, [...live.keys()], at, timezone);
    slotPool = slots.filter((s) =>
      (poolOfferingIds.has(String(s.courseOfferingId)) || String(s.substituteFacultyId ?? '') === viewer.facultyId)
      && String(s.originalFacultyId ?? '') !== viewer.facultyId);
  }

  // Exceptions for the pool: rows dated today OR moved into today (R38).
  const exceptions = poolOfferingIds.size > 0
    ? await activeExceptionsFor(collegeId, { offeringIds: [...poolOfferingIds], dates: [date] })
    : [];
  const cancellations = new Map<string, boolean>();
  const rescheduledAway = new Set<string>();
  for (const row of exceptions) {
    if (row.date === date) {
      if (row.type === 'cancelled') cancellations.set(String(row.timetableSlotId), true);
      else rescheduledAway.add(String(row.timetableSlotId));
    }
  }
  const moveIns = exceptions.filter((row) => row.type === 'rescheduled' && row.newDate === date);

  const bySlotId = new Map(slotPool.map((s) => [String(s._id), s]));
  const missingOrigins = [...new Set(moveIns
    .map((row) => String(row.timetableSlotId))
    .filter((id) => !bySlotId.has(id)))];
  const fetched = missingOrigins.length > 0
    ? await TimetableSlot.find({ collegeId, _id: { $in: missingOrigins.map(asObjectId) } })
        .select('_id courseOfferingId startTime endTime roomId slotType substituteFacultyId').lean<LeanTimetableSlot[]>()
    : [];
  for (const s of fetched) bySlotId.set(String(s._id), s);

  const effEntries: EffEntry[] = [];
  for (const slot of slotPool) {
    const sid = String(slot._id);
    if (rescheduledAway.has(sid)) continue; // vacated by a reschedule dated today
    effEntries.push({
      offeringId: String(slot.courseOfferingId),
      start: slot.startTime,
      end: slot.endTime,
      slotType: slot.slotType,
      roomId: slot.roomId ? String(slot.roomId) : undefined,
      status: cancellations.has(sid) ? 'cancelled' : 'scheduled',
      subFacultyId: slot.substituteFacultyId ? String(slot.substituteFacultyId) : undefined,
    });
  }
  for (const row of moveIns) {
    const origin = bySlotId.get(String(row.timetableSlotId));
    if (!origin) continue; // origin slot no longer exists — nothing to move in
    effEntries.push({
      offeringId: String(row.courseOfferingId),
      start: row.newStartTime ?? origin.startTime,
      end: row.newEndTime ?? origin.endTime,
      slotType: origin.slotType,
      roomId: row.newRoomId ? String(row.newRoomId) : (origin.roomId ? String(origin.roomId) : undefined),
      status: 'rescheduled',
      subFacultyId: origin.substituteFacultyId ? String(origin.substituteFacultyId) : undefined,
      movedFrom: { date: row.date, start: origin.startTime },
    });
  }
  if (effEntries.length === 0) return { date, classes: [] };
  effEntries.sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start));

  // Batch decoration: offerings → courses → sections → faculty names → rooms → channels.
  const offeringIds = [...new Set(effEntries.map((e) => e.offeringId))];
  const offerings = await CourseOffering.find({ collegeId, _id: { $in: offeringIds.map(asObjectId) } })
    .select('_id courseId sectionId facultyId enrolledCount')
    .lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; sectionId: Types.ObjectId; facultyId: Types.ObjectId; enrolledCount?: number }[]>();
  const offeringById = new Map(offerings.map((o) => [String(o._id), o]));
  const courses = await Course.find({ collegeId, _id: { $in: [...new Set(offerings.map((o) => String(o.courseId)))].map(asObjectId) } })
    .select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const sections = await Section.find({ collegeId, _id: { $in: [...new Set(offerings.map((o) => String(o.sectionId)))].map(asObjectId) } })
    .select('name').lean<{ _id: Types.ObjectId; name: string }[]>();
  const sectionById = new Map(sections.map((s) => [String(s._id), s]));

  const facultyIds = new Set<string>();
  for (const e of effEntries) {
    if (e.subFacultyId) facultyIds.add(e.subFacultyId);
    if (offeringById.has(e.offeringId)) facultyIds.add(String(offeringById.get(e.offeringId)!.facultyId));
  }
  const faculties = facultyIds.size > 0
    ? await Faculty.find({ collegeId, _id: { $in: [...facultyIds].map(asObjectId) } })
        .select('personId').lean<{ _id: Types.ObjectId; personId: Types.ObjectId }[]>()
    : [];
  const personIds = [...new Set(faculties.map((f) => String(f.personId)))];
  const persons = personIds.length > 0
    ? await Person.find({ _id: { $in: personIds.map(asObjectId) } }).select('name').lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const nameByFaculty = new Map<string, string>();
  const nameByPerson = new Map(persons.map((p) => [String(p._id), p.name]));
  for (const f of faculties) {
    const name = nameByPerson.get(String(f.personId));
    if (name) nameByFaculty.set(String(f._id), name);
  }

  const roomIds = [...new Set(effEntries.map((e) => e.roomId).filter((r): r is string => Boolean(r)))];
  const rooms = roomIds.length > 0
    ? await Room.find({ collegeId, _id: { $in: roomIds.map(asObjectId) } })
        .select('roomNumber buildingId').lean<{ _id: Types.ObjectId; roomNumber: string; buildingId: Types.ObjectId }[]>()
    : [];
  const roomById = new Map(rooms.map((r) => [String(r._id), r]));
  const buildingIds = [...new Set(rooms.map((r) => String(r.buildingId)))];
  const buildings = buildingIds.length > 0
    ? await Building.find({ collegeId, _id: { $in: buildingIds.map(asObjectId) } })
        .select('name').lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const buildingById = new Map(buildings.map((b) => [String(b._id), b.name]));

  const channels = poolOfferingIds.size > 0
    ? await Channel.find({
        collegeId, scopeType: 'course_offering', scopeId: { $in: offeringIds.map(asObjectId) }, status: 'active',
      }).select('scopeId').lean<{ _id: Types.ObjectId; scopeId: Types.ObjectId }[]>()
    : [];
  const channelByOffering = new Map(channels.map((c) => [String(c.scopeId), String(c._id)]));

  const classes: DayClass[] = [];
  for (const e of effEntries) {
    const offering = offeringById.get(e.offeringId);
    if (!offering) continue; // offering vanished between pool and decoration
    const course = courseById.get(String(offering.courseId));
    const section = sectionById.get(String(offering.sectionId));
    const cls: DayClass = {
      offeringId: e.offeringId,
      courseCode: course?.code ?? '',
      title: course?.name ?? '',
      section: section?.name ?? '',
      start: e.start,
      end: e.end,
      slotType: e.slotType,
      status: e.status,
    };
    if (e.roomId) {
      const room = roomById.get(e.roomId);
      const roomLabel = room
        ? (buildingById.has(String(room.buildingId)) ? `${room.roomNumber}, ${buildingById.get(String(room.buildingId))}` : room.roomNumber)
        : undefined;
      if (roomLabel) cls.room = roomLabel;
    }
    const facultyName = e.subFacultyId ? nameByFaculty.get(e.subFacultyId) : nameByFaculty.get(String(offering.facultyId));
    if (facultyName) cls.faculty = facultyName;
    const channelId = channelByOffering.get(e.offeringId);
    if (channelId) cls.channelId = channelId;
    if (e.status === 'rescheduled' && e.movedFrom) cls.movedFrom = e.movedFrom;
    if (viewer.kind === 'faculty') cls.registered = offering.enrolledCount ?? 0;
    classes.push(cls);
  }
  return { date, classes };
}

/** §6/§7.2: the first day strictly after `date` (within 14 days) that has classes. */
export async function nextTeachingDay(
  collegeId: string,
  viewer: DayViewer,
  date: string,
  timezone: string,
): Promise<DayView | undefined> {
  for (let i = 1; i <= 14; i++) {
    const view = await resolveDay(collegeId, viewer, addDays(date, i), timezone);
    if (view.classes.length > 0) return view;
  }
  return undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/resolve-day.test.ts`
Expected: PASS (all 14).

- [ ] **Step 5: Run typecheck and the touched neighbour suites**

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

Run: `npm test -w backend -- --run src/modules/juvi-app/spaces/__tests__/next-class.test.ts`
Expected: PASS — `next-class.ts` keeps its own behaviour until Task 8; this suite must not regress from the shared imports.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/juvi-app/home/resolve-day.ts backend/src/modules/juvi-app/home/__tests__/resolve-day.test.ts
git commit -m "feat(juvi): resolve-day reader shared by Today and Teaching

Holiday gate runs first; student pool from active-semester enrollments and
faculty pool from owned offerings plus substitutions (minus replaced-out
slots); exceptions vacate/mark/inject per §6; batch decoration omits
optional fields instead of nulling them. nextTeachingDay scans 14 days
ahead skipping Sundays and holidays."
```
### Task 13: Juvi home readers — attendance, dues, assessments

**Files:**
- Create: `backend/src/modules/juvi-app/home/money.ts` — `toPaise`, the R1 money boundary converter (its own small module so Task 14/15 code and the Task 17 schemas can name it).
- Create: `backend/src/modules/juvi-app/home/readers.ts` (holds all three readers — attendance, dues, assessments — as one module)
- Test: `backend/src/modules/juvi-app/home/__tests__/readers.test.ts`

**Interfaces:**
- Consumes:
  - `attendanceFor` (imported as `erpAttendanceFor`) and `attendanceAvailableFor` from `../../academics/attendance-formula` (Task 10). Ruling R12 keeps the spec's name on the formula; the Juvi reader imports it aliased.
  - `getJuviConfig` from `../config/institution-config` — Task 9 added `attendanceThreshold?: number` and `showAttendanceHeadroom?: boolean` to `IJuviConfig` and `normalizeJuviConfig`.
  - `Channel` from `'../../../models/juvi/Channel'` — `scopeType: 'course_offering'`, `scopeId`, `status: 'active'` (R18: every course-scoped item carries the channel it links to).
  - `Invoice` from `'../../../models/finance/Invoice'`, `Payment` from `'../../../models/finance/Payment'`, `PaymentPlan` from `'../../../models/finance/PaymentPlan'`.
  - `InternalAssessment` from `'../../../models/academic-ops/InternalAssessment'`, `ExamSchedule` from `'../../../models/academic-ops/ExamSchedule'`, `CourseOffering` from `'../../../models/academic-ops/CourseOffering'`, `Course` from `'../../../models/academic-ops/Course'`.
  - `Enrollment`, `AttendanceSession`, `AttendanceRecord` from the `'../../../models'` barrel (same imports Task 10 verified).
  - `ymd`, `instantOf` from `../../academics/timetable-date` (Task 2); `activeSemesterIds(collegeId)` from `../../academics/live-timetable` (Task 3).
- Produces (Task 14's `home/service.ts` imports these):
  - `toPaise(amount: number | null): number | null` from `./money` — R1's single money converter (rupees ×100, rounded half-up, null passthrough). `duesFor` outputs integer paise through it; Task 14's glance/me-academics and Task 15's fee_due forward paise unchanged. Unit-tested in Step 1.
  - `interface JuviAttendanceCourse extends Omit<CourseAttendance, 'threshold'> { channelId?: string }` — R42: §7.3 names `threshold` once, at the attendance top level.
  - `interface JuviAttendance { available: boolean; threshold: number; showHeadroom: boolean; overall: { held: number; attended: number; pct: number | null }; courses: JuviAttendanceCourse[] }` — §7.3 nests the overall; `pct` is a nullable scalar (Foundation R57/R61), null exactly when held is 0 (R13).
  - `juviAttendance(collegeId: string, studentId: string): Promise<JuviAttendance>`
  - `courseChannels(collegeId: string, offeringIds: string[]): Promise<Map<string, string>>`
  - `interface DuesInstalment { id: string; amount: number; dueDate: string; paid: boolean; overdue: boolean }` — `dueDate` is a college-tz-midnight ISO instant (R15).
  - `interface DuesInvoice { id: string; invoiceNumber: string; type: string; amount: number; outstanding: number; dueDate: string; overdue: boolean; instalments: DuesInstalment[] }` — `dueDate` is a college-tz-midnight ISO instant (R15).
  - `interface JuviDues { available: boolean; invoiceCount: number; total: number; invoices: DuesInvoice[]; nextDue: { invoiceId: string; amount: number; date: string; overdue: boolean } | null; lastPayment: { invoiceId: string; amount: number; date: string; receiptNumber: string } | null }` — `nextDue.date` is a college-tz-midnight ISO instant (R15).
  - `duesFor(collegeId: string, studentId: string): Promise<JuviDues>`
  - `interface AssessmentItem { id: string; kind: 'internal' | 'exam'; offeringId: string; courseCode: string; title: string; at: string; channelId?: string }`
  - `assessmentsFor(collegeId: string, studentId: string, from: Date, to: Date): Promise<AssessmentItem[]>` — §6's signature; items are filtered to `at` ∈ [from, to), left-inclusive. The item keeps `id` and `offeringId` (a superset of §6's item list) because §7.4's attention items need them; §7.4 and the §7.1 glance pass narrow windows.
  - `nextInvoiceDue(invoice: DuesInvoice): { invoiceId: string; amount: number; date: string; overdue: boolean }` — §6's per-invoice next due (first unpaid instalment, else dueDate + outstanding); Task 14's `meAcademics` and Task 15's `fee_due` items both call it instead of re-deriving, and `duesFor`'s own `nextDue` winner is built from the same rows. Its `date` is a college-tz-midnight ISO instant (R15).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/juvi-app/home/__tests__/readers.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { College } from '../../../../models/College';
import {
  AttendanceRecord,
  AttendanceSession,
  Course,
  CourseOffering,
  Faculty,
  Person,
  Semester,
  Student,
} from '../../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { InternalAssessment } from '../../../../models/academic-ops/InternalAssessment';
import { ExamSchedule } from '../../../../models/academic-ops/ExamSchedule';
import { Invoice } from '../../../../models/finance/Invoice';
import { Payment } from '../../../../models/finance/Payment';
import { PaymentPlan } from '../../../../models/finance/PaymentPlan';
import { Channel } from '../../../../models/juvi/Channel';
import { toPaise } from '../money';
import { assessmentsFor, juviAttendance, duesFor } from '../readers';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let seq = 0;

interface World {
  studentId: string;
  facultyId: string;
  offeringId: string;
  courseId: string;
  semesterId: string;
  semester2Id: string;
}

async function seedWorld(): Promise<World> {
  const college = await College.create({
    name: 'Juvi Readers College', code: `JRC${seq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
    contactEmail: 'a@juvion.test', contactPhone: '9000000000',
    juvi: { enabled: true, attendanceThreshold: 60, showAttendanceHeadroom: true },
  });
  collegeId = college._id as Types.ObjectId;
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const semester2 = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 1,
    startDate: new Date('2025-06-01T00:00:00Z'), endDate: new Date('2025-12-01T00:00:00Z'), status: 'completed',
  });
  const sPerson = await Person.create({ collegeId, name: 'Rea Der', phone: '9000090002', gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: 'F Teacher', phone: '9000090001', gender: 'male' });
  const student = await Student.create({
    collegeId, personId: sPerson._id, admissionYear: 2026,
    rollNumber: `26JR${seq}`, status: 'active', onboardingStatus: 'not_started',
  });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FAC${seq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'CS201', name: 'Data Structures',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: semester._id,
    sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1, status: 'active',
  });
  return {
    studentId: String(student._id), facultyId: String(faculty._id),
    offeringId: String(offering._id), courseId: String(course._id),
    semesterId: String(semester._id), semester2Id: String(semester2._id),
  };
}

function closedSession(w: World, iso: string): Promise<Types.ObjectId> {
  return AttendanceSession.create({
    collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
    date: new Date(iso), period: 1, facultyId: new Types.ObjectId(w.facultyId), status: 'closed',
  }).then((doc) => doc._id as Types.ObjectId);
}

// --- attendance ---------------------------------------------------------------

describe('juviAttendance', () => {
  beforeEach(async () => { await clearCollections(); });

  it('wraps the ERP formula with available/threshold/showHeadroom and adds channelId (R18)', async () => {
    const w = await seedWorld();
    const channel = await Channel.create({
      collegeId, name: 'CS201 CSE-A', scopeType: 'course_offering',
      scopeId: new Types.ObjectId(w.offeringId), status: 'active',
    });
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out).toMatchObject({ available: false, threshold: 60, showHeadroom: true, overall: { held: 0, attended: 0, pct: null } });
    expect(out.courses[0]!.courseCode).toBe('CS201');
    expect(out.courses[0]!.channelId).toBe(String(channel._id));
  });

  it('no active channel → channelId omitted (never null, R11)', async () => {
    const w = await seedWorld();
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out.courses).toHaveLength(1);
    expect(out.courses[0]!.channelId).toBeUndefined();
  });

  it('available turns true once a closed session exists', async () => {
    const w = await seedWorld();
    await closedSession(w, '2026-07-01T00:00:00Z');
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out.available).toBe(true);
    expect(out.courses[0]!.held).toBe(1);
  });

  it('zeroes headroom when showAttendanceHeadroom is off', async () => {
    const w = await seedWorld();
    await College.updateOne({ _id: collegeId }, { $set: { 'juvi.showAttendanceHeadroom': false } });
    const session = await closedSession(w, '2026-07-01T00:00:00Z');
    await AttendanceRecord.create({
      collegeId, sessionId: session, studentId: new Types.ObjectId(w.studentId),
      status: 'present', markedBy: new Types.ObjectId(w.facultyId),
    });
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out.showHeadroom).toBe(false);
    expect(out.courses[0]!.pct).toBe(100);
    expect(out.courses[0]!.headroom).toBe(0);
  });
});

// --- dues ----------------------------------------------------------------------

// --- toPaise (R1 money boundary): pure converter, no DB -----------------------

describe('toPaise', () => {
  it('multiplies rupees ×100 half-up and passes null through', () => {
    expect(toPaise(12499.5)).toBe(1249950);
    expect(toPaise(19.99)).toBe(1999);   // 19.99 × 100 is 1998.9999999999998 in fp64 — must land on 1999
    expect(toPaise(0.125)).toBe(13);     // exact .5 boundary → half-up
    expect(toPaise(0)).toBe(0);
    expect(toPaise(null)).toBeNull();
  });

  it('keeps invoice-grade rupee values exact in paise', () => {
    expect(toPaise(39999.99)).toBe(3999999);
    expect(toPaise(25000.25)).toBe(2500025);
  });
});

describe('duesFor', () => {
  beforeEach(async () => { await clearCollections(); });

  it('drops draft/paid invoices and reports outstanding in paise (R1, R5)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-1',
      type: 'fee', totalAmount: 40000, dueDate: new Date('2027-07-01T00:00:00Z'), status: 'generated',
    });
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-2',
      type: 'fee', totalAmount: 10000, dueDate: new Date('2027-07-02T00:00:00Z'), status: 'paid',
    });
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-3',
      type: 'hostel', totalAmount: 20000, dueDate: new Date('2027-07-03T00:00:00Z'), status: 'draft',
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.available).toBe(true);
    expect(out.invoiceCount).toBe(1);
    expect(out.total).toBe(4000000);                    // 40000 ₹ in paise (R1)
    expect(out.invoices[0]!.outstanding).toBe(4000000); // 40000 ₹ in paise (R1)
    expect(out.invoices[0]!.instalments).toEqual([]);
  });

  it('outstanding = (netPayable ?? totalAmount) minus successful payments, in paise (R1)', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-10',
      type: 'fee', totalAmount: 40000, netPayable: 39999.99,
      dueDate: new Date('2026-07-01T00:00:00Z'), status: 'sent',
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-1', amount: 25000.25, paymentMode: 'upi', status: 'success',
      paymentDate: new Date('2026-07-05T00:00:00Z'),
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-2', amount: 5000, paymentMode: 'online', status: 'failed',
      paymentDate: new Date('2026-07-06T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    const invoice = out.invoices[0]!;
    expect(invoice.amount).toBe(3999999);      // 39999.99 ₹ in paise (R1)
    expect(invoice.outstanding).toBe(1499974); // 3999999 − 2500025 paise (R1) — exact, no toBeCloseTo needed
    expect(out.lastPayment).toMatchObject({ amount: 2500025, receiptNumber: 'RCP-1' });
    expect(out.nextDue!.invoiceId).toBe(invoice.id);
    expect(out.nextDue!.amount).toBe(1499974); // same paise arithmetic (R1)
  });

  it('matches instalments chronologically against cumulative payments (R7); next unpaid instalment is nextDue', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-20',
      type: 'fee', totalAmount: 30000,
      dueDate: new Date('2027-03-01T00:00:00Z'), status: 'sent',
    });
    await PaymentPlan.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      totalAmount: 30000, status: 'active',
      installments: [
        { dueDate: new Date('2027-01-01T00:00:00Z'), amount: 10000, status: 'pending' },
        { dueDate: new Date('2027-02-01T00:00:00Z'), amount: 10000, status: 'pending' },
        { dueDate: new Date('2027-03-01T00:00:00Z'), amount: 10000, status: 'pending' },
      ],
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-10', amount: 20000, paymentMode: 'upi', status: 'success',
      paymentDate: new Date('2026-11-01T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.invoices[0]!.instalments.map((i) => [i.paid, i.amount])).toEqual([[true, 1000000], [true, 1000000], [false, 1000000]]); // paise (R1)
    expect(out.nextDue!.amount).toBe(1000000);   // 10000 ₹ in paise (R1)
    // The test college has no timezone, so R41's 'Asia/Kolkata' default applies:
    // the 2027-03-01 due date at IST midnight is a college-tz-midnight ISO instant (R15).
    expect(out.nextDue!.date).toBe('2027-02-28T18:30:00.000Z');
    expect(out.invoices[0]!.outstanding).toBe(1000000); // 30000 − 20000 = 10000 ₹ in paise (R1)
  });

  it('flags overdue when the next due date is past (R15 overdue = date < today in college tz)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-30',
      type: 'fee', totalAmount: 15000,
      dueDate: new Date('2026-01-10T00:00:00Z'), status: 'overdue',
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.invoices[0]!.overdue).toBe(true);
    expect(out.nextDue!.overdue).toBe(true);
  });

  it('drops an invoice whose payments cover it; a college with nothing on file is not available', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-40',
      type: 'fee', totalAmount: 5000, dueDate: new Date('2027-07-01T00:00:00Z'), status: 'sent',
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-40', amount: 5000, paymentMode: 'upi', status: 'success',
      paymentDate: new Date('2026-11-01T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.available).toBe(true);          // the invoice row exists on file
    expect(out.invoiceCount).toBe(0);          // but nothing is OPEN
    expect(out.total).toBe(0);
    expect(out.nextDue).toBeNull();
    const otherCollege = await duesFor(new Types.ObjectId().toString(), w.studentId);
    expect(otherCollege.available).toBe(false);
  });

  it('reversed payments do not reduce outstanding', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-50',
      type: 'fee', totalAmount: 9000, dueDate: new Date('2027-07-01T00:00:00Z'), status: 'generated',
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-50', amount: 4000, paymentMode: 'upi', status: 'reversed',
      paymentDate: new Date('2026-11-01T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.invoices[0]!.outstanding).toBe(900000); // 9000 ₹ in paise (R1)
  });
});

// --- assessments ---------------------------------------------------------------

describe('assessmentsFor', () => {
  beforeEach(async () => { await clearCollections(); });

  it('merges scheduled assessments and exams on active-semester offerings, sorted by at (R18 ids + channelId)', async () => {
    const w = await seedWorld();
    const channel = await Channel.create({
      collegeId, name: 'CS201 CSE-A', scopeType: 'course_offering',
      scopeId: new Types.ObjectId(w.offeringId), status: 'active',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Mid 1', type: 'mid1', maxMarks: 30, weightage: 20,
      date: new Date('2026-11-20T09:00:00Z'), status: 'scheduled',
    });
    await ExamSchedule.create({
      collegeId, semesterId: new Types.ObjectId(w.semesterId), courseId: new Types.ObjectId(w.courseId),
      examType: 'regular', date: new Date('2026-11-25T00:00:00Z'), startTime: '10:00', endTime: '12:00',
      venue: 'Hall A', status: 'scheduled',
    });
    const items = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'));
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('internal');
    expect(items[0]!.title).toBe('Mid 1');
    expect(items[0]!.at).toBe(new Date('2026-11-20T09:00:00Z').toISOString());
    expect(items[0]!.channelId).toBe(String(channel._id));
    expect(items[1]!.kind).toBe('exam');
    expect(items[1]!.courseCode).toBe('CS201');
    expect(items[1]!.at).toBe('2026-11-25T04:30:00.000Z');   // 10:00 in Asia/Kolkata
  });

  it('skips conducted assessments, rows without a date, and other semesters', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Conducted Mid', type: 'mid1', maxMarks: 30, weightage: 20,
      date: new Date('2026-11-20T09:00:00Z'), status: 'conducted',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'No date', type: 'assignment', maxMarks: 10, weightage: 5, status: 'scheduled',
    });
    await ExamSchedule.create({
      collegeId, semesterId: new Types.ObjectId(w.semester2Id), courseId: new Types.ObjectId(w.courseId),
      examType: 'regular', date: new Date('2026-11-25T00:00:00Z'), startTime: '10:00', endTime: '12:00',
      status: 'scheduled',
    });
    const items = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'));
    expect(items).toEqual([]);
  });

  it('respects the from/to window: left edge inclusive, right edge exclusive', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Mid 1', type: 'mid1', maxMarks: 30, weightage: 20,
      date: new Date('2026-11-20T09:00:00Z'), status: 'scheduled',
    });
    const past = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-12-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'));
    expect(past).toEqual([]);
    const within = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-11-20T09:00:00Z'), new Date('2026-11-21T00:00:00Z'));
    expect(within).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/readers.test.ts`
Expected: FAIL — `Cannot find module '../readers'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/juvi-app/home/money.ts` — the R1 money boundary:

```typescript
/**
 * R1 money boundary. ERP finance stores rupees (2dp); the Juvi /v1 contract carries
 * integer paise. Convert exactly once at reader boundaries — never inside ERP finance
 * code, and never again on values that are already paise. Plan 3's Dart client divides by 100.
 */
export function toPaise(amount: number): number;
export function toPaise(amount: number | null): number | null;
export function toPaise(amount: number | null): number | null {
  return amount === null ? null : Math.round(amount * 100);
}
```

Create `backend/src/modules/juvi-app/home/readers.ts`:

```typescript
import { Types } from 'mongoose';

import { attendanceFor as erpAttendanceFor, attendanceAvailableFor, type CourseAttendance } from '../../academics/attendance-formula';
import { activeSemesterIds } from '../../academics/live-timetable';
import { instantOf, ymd } from '../../academics/timetable-date';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { ExamSchedule } from '../../../models/academic-ops/ExamSchedule';
import { InternalAssessment } from '../../../models/academic-ops/InternalAssessment';
import { Invoice } from '../../../models/finance/Invoice';
import { Payment } from '../../../models/finance/Payment';
import { PaymentPlan } from '../../../models/finance/PaymentPlan';
import { Channel } from '../../../models/juvi/Channel';
import { getJuviConfig } from '../config/institution-config';
import { toPaise } from './money';

// ---- attendance (§7.3 attendance block) ----------------------------------------

export interface JuviAttendanceCourse extends Omit<CourseAttendance, 'threshold'> {
  channelId?: string;
}

export interface JuviAttendance {
  available: boolean;
  threshold: number;
  showHeadroom: boolean;
  /** §7.3 nests the overall; pct is a nullable scalar (Foundation R57/R61), null exactly when held is 0 (R13). */
  overall: { held: number; attended: number; pct: number | null };
  courses: JuviAttendanceCourse[];
}

export async function juviAttendance(collegeId: string, studentId: string): Promise<JuviAttendance> {
  const [cfg, erp, available] = await Promise.all([
    getJuviConfig(collegeId),
    erpAttendanceFor(collegeId, studentId),
    attendanceAvailableFor(collegeId),
  ]);
  const showHeadroom = cfg?.showAttendanceHeadroom ?? true;
  const offeringIds = erp.courses.map((c) => c.offeringId);
  const channelByOffering = await courseChannels(collegeId, offeringIds);
  return {
    available,
    threshold: erp.threshold,
    showHeadroom,
    overall: { held: erp.held, attended: erp.attended, pct: erp.overallPct },
    courses: erp.courses.map(({ threshold: _t, ...c }) => ({ // R42: threshold stays ERP-internal (§7.3 names it once, at the top level)
      ...c,
      headroom: showHeadroom ? c.headroom : 0,
      channelId: channelByOffering.get(c.offeringId),
    })),
  };
}

/** R18: the active course channel for each offering, when one exists. */
export async function courseChannels(
  collegeId: string,
  offeringIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (offeringIds.length === 0) return map;
  const rows = await Channel.find({
    collegeId,
    scopeType: 'course_offering',
    scopeId: { $in: offeringIds.map((id) => new Types.ObjectId(id)) },
    status: 'active',
  }).select('scopeId').lean<{ _id: Types.ObjectId; scopeId: Types.ObjectId }[]>();
  for (const row of rows) map.set(String(row.scopeId), String(row._id));
  return map;
}

// ---- dues (§7.3 dues block) ------------------------------------------------------

export interface DuesInstalment {
  id: string;
  amount: number; // integer paise (R1)
  dueDate: string; // the due date at college-tz midnight, as an ISO instant — not a 'YYYY-MM-DD' string (R15)
  paid: boolean;
  overdue: boolean;
}

export interface DuesInvoice {
  id: string;
  invoiceNumber: string;
  type: string;
  amount: number;      // netPayable ?? totalAmount, integer paise (R1)
  outstanding: number; // integer paise (R1)
  dueDate: string; // the due date at college-tz midnight, as an ISO instant — not a 'YYYY-MM-DD' string (R15)
  overdue: boolean;
  instalments: DuesInstalment[];
}

/** The invoice's next due: the first unpaid instalment, else its dueDate + outstanding (§6). The returned `date` is a college-tz-midnight ISO instant (R15). */
export function nextInvoiceDue(invoice: DuesInvoice): { invoiceId: string; amount: number; date: string; overdue: boolean } {
  const unpaid = invoice.instalments.find((i) => !i.paid) ?? null;
  if (unpaid) return { invoiceId: invoice.id, amount: unpaid.amount, date: unpaid.dueDate, overdue: unpaid.overdue };
  return { invoiceId: invoice.id, amount: invoice.outstanding, date: invoice.dueDate, overdue: invoice.overdue };
}

export interface JuviDues {
  available: boolean;
  invoiceCount: number;
  total: number; // integer paise (R1) — downstream surfaces forward this, never re-convert
  invoices: DuesInvoice[];
  nextDue: { invoiceId: string; amount: number; date: string; overdue: boolean } | null; // date: college-tz-midnight ISO instant (R15)
  lastPayment: { invoiceId: string; amount: number; date: string; receiptNumber: string } | null;
}

/** R1: money enters and leaves this reader in integer paise (toPaise from './money'). */

/** R5: OPEN = anything not closed out. Draft is not due; paid/written-off/cancelled are done. */
const OPEN_STATUSES = ['generated', 'sent', 'partially_paid', 'overdue', 'disputed', 'confirmed'] as const;

// Raw DB rows are ERP-side: every `amount` below is rupees — converted once by toPaise.
interface RawInvoice {
  _id: Types.ObjectId;
  invoiceNumber: string;
  type: string;
  totalAmount: number; // rupees (ERP)
  netPayable?: number | null;
  dueDate: Date;
}

interface RawPayment {
  _id: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  amount: number; // rupees (ERP)
  receiptNumber: string;
  paymentDate: Date;
}

interface RawInstalment {
  dueDate: Date;
  amount: number; // rupees (ERP)
  status: string;
}

export async function duesFor(collegeId: string, studentId: string): Promise<JuviDues> {
  const now = new Date();
  const cfg = await getJuviConfig(collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const todayMidnight = instantOf(ymd(now, tz), '00:00', tz);

  const invoices = await Invoice.find({
    collegeId,
    studentId: new Types.ObjectId(studentId),
    status: { $in: OPEN_STATUSES },
  }).sort({ dueDate: 1 }).lean<RawInvoice[]>();

  const invoiceIds = invoices.map((i) => i._id);
  const [payments, plans] = await Promise.all([
    invoiceIds.length
      ? Payment.find({ collegeId, invoiceId: { $in: invoiceIds }, status: 'success' })
          .sort({ paymentDate: 1 }).lean<RawPayment[]>()
      : Promise.resolve([] as RawPayment[]),
    invoiceIds.length
      ? PaymentPlan.find({ collegeId, studentId: new Types.ObjectId(studentId), invoiceId: { $in: invoiceIds } })
          .lean<{ invoiceId: Types.ObjectId | null; installments: RawInstalment[] }[]>()
      : Promise.resolve([] as { invoiceId: Types.ObjectId | null; installments: RawInstalment[] }[]),
  ]);

  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    const key = String(p.invoiceId);
    paidByInvoice.set(key, (paidByInvoice.get(key) ?? 0) + toPaise(p.amount));
  }
  const instalmentsByInvoice = new Map<string, RawInstalment[]>();
  for (const plan of plans) if (plan.invoiceId) instalmentsByInvoice.set(String(plan.invoiceId), plan.installments ?? []);

  const duesInvoices: DuesInvoice[] = [];
  const nextDuePerInvoice: ReturnType<typeof nextInvoiceDue>[] = [];
  let total = 0;
  for (const inv of invoices) {
    const id = String(inv._id);
    const amount = inv.netPayable ?? inv.totalAmount;
    const paidPaise = paidByInvoice.get(id) ?? 0;
    const outstandingPaise = toPaise(amount) - paidPaise;
    if (outstandingPaise <= 0) continue;

    const invoiceDue = instantOf(ymd(inv.dueDate, tz), '00:00', tz); // the due date at college-tz midnight (R15)

    const instalments: DuesInstalment[] = [];
    let cumulative = 0;
    for (const [index, inst] of (instalmentsByInvoice.get(id) ?? []).entries()) {
      cumulative += toPaise(inst.amount);
      const paid = paidPaise >= cumulative;
      const dueDate = instantOf(ymd(inst.dueDate, tz), '00:00', tz); // the instalment's due date at college-tz midnight (R15)
      instalments.push({
        id: `${id}:${index}`,
        amount: toPaise(inst.amount), // integer paise (R1)
        dueDate: dueDate.toISOString(),
        paid,
        overdue: !paid && dueDate.getTime() < todayMidnight.getTime(),
      });
    }

    const nextInstalment = instalments.find((i) => !i.paid) ?? null;
    const row: DuesInvoice = {
      id,
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      amount: toPaise(amount),        // integer paise (R1)
      outstanding: outstandingPaise,  // interior math is already paise — no /100 here (R1)
      dueDate: invoiceDue.toISOString(),
      overdue: nextInstalment ? nextInstalment.overdue : invoiceDue.getTime() < todayMidnight.getTime(),
      instalments,
    };
    duesInvoices.push(row);
    nextDuePerInvoice.push(nextInvoiceDue(row));
    total += outstandingPaise; // integer paise (R1)
  }

  const winner = nextDuePerInvoice
    .reduce<ReturnType<typeof nextInvoiceDue> | null>(
      (min, n) => (min === null || n.date < min.date ? n : min), null);

  const last = payments.length ? payments[payments.length - 1] : null;
  return {
    available: (await Invoice.exists({ collegeId })) !== null,
    invoiceCount: duesInvoices.length,
    total,
    invoices: duesInvoices,
    nextDue: winner,
    lastPayment: last
      ? {
          invoiceId: last.invoiceId ? String(last.invoiceId) : '',
          amount: toPaise(last.amount), // integer paise (R1)
          date: last.paymentDate.toISOString(),
          receiptNumber: last.receiptNumber,
        }
      : null,
  };
}

// ---- assessments (§7.3 assessments block) ---------------------------------------

export type AssessmentKind = 'internal' | 'exam';

export interface AssessmentItem {
  id: string;
  kind: AssessmentKind;
  offeringId: string;
  courseCode: string;
  title: string;
  at: string;
  channelId?: string;
}

/** Spec §6: student assessments in [from, to), sorted by `at`. The item is a
 *  superset of §6's list (id, offeringId included) because §7.4 attention
 *  items need the id; callers pass narrow windows. */
export async function assessmentsFor(
  collegeId: string,
  studentId: string,
  from: Date,
  to: Date,
): Promise<AssessmentItem[]> {
  const [cfg, semesterIds] = await Promise.all([
    getJuviConfig(collegeId),
    activeSemesterIds(collegeId),
  ]);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  if (semesterIds.length === 0) return [];

  const enrollments = await Enrollment.find({
    collegeId,
    studentId: new Types.ObjectId(studentId),
    status: 'enrolled',
    semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
  }).select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
  const offeringIds = [...new Set(enrollments.map((e) => String(e.courseOfferingId)))];
  if (offeringIds.length === 0) return [];

  const offerings = await CourseOffering.find({
    collegeId, _id: { $in: offeringIds.map((i) => new Types.ObjectId(i)) },
  }).select('_id courseId semesterId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; semesterId: Types.ObjectId }[]>();
  const courseIds = [...new Set(offerings.map((o) => String(o.courseId)))];

  const [assessmentRows, examRows, courseRows] = await Promise.all([
    InternalAssessment.find({
      collegeId,
      courseOfferingId: { $in: offeringIds.map((i) => new Types.ObjectId(i)) },
      status: 'scheduled',
      date: { $ne: null },
    }).sort({ date: 1 }).lean<{ _id: Types.ObjectId; courseOfferingId: Types.ObjectId; name: string; date: Date }[]>(),
    ExamSchedule.find({
      collegeId,
      semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
      courseId: { $in: courseIds.map((i) => new Types.ObjectId(i)) },
      status: 'scheduled',
    }).sort({ date: 1 }).lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; semesterId: Types.ObjectId; examType: string; date: Date; startTime: string }[]>(),
    Course.find({ collegeId, _id: { $in: courseIds.map((i) => new Types.ObjectId(i)) } })
      .select('code').lean<{ _id: Types.ObjectId; code: string }[]>(),
  ]);
  const channelByOffering = await courseChannels(collegeId, offeringIds);

  const codeByCourse = new Map(courseRows.map((c) => [String(c._id), c.code]));

  const items: AssessmentItem[] = [];
  for (const row of assessmentRows) {
    const offeringId = String(row.courseOfferingId);
    const offering = offerings.find((o) => String(o._id) === offeringId);
    const courseCode = offering ? codeByCourse.get(String(offering.courseId)) ?? '' : '';
    items.push({
      id: String(row._id),
      kind: 'internal',
      offeringId,
      courseCode,
      title: row.name,
      at: row.date.toISOString(),
      channelId: channelByOffering.get(offeringId),
    });
  }
  for (const row of examRows) {
    // An exam is scheduled per (semester, course); attach it to the matching offering.
    const offering = offerings.find(
      (o) => String(o.courseId) === String(row.courseId) && String(o.semesterId) === String(row.semesterId),
    );
    if (!offering) continue;
    const name = row.examType === 'regular' ? 'End Semester Exam'
      : row.examType === 'supplementary' ? 'Supplementary Exam'
      : 'Improvement Exam';
    items.push({
      id: String(row._id),
      kind: 'exam',
      offeringId: String(offering._id),
      courseCode: codeByCourse.get(String(row.courseId)) ?? '',
      title: `${name} (${row.startTime})`,
      at: instantOf(ymd(row.date, tz), row.startTime, tz).toISOString(),
      channelId: channelByOffering.get(String(offering._id)),
    });
  }

  // [from, to), left-inclusive, compared as instants (at is an ISO string).
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return items
    .filter((i) => { const ms = new Date(i.at).getTime(); return ms >= fromMs && ms < toMs; })
    .sort((a, b) => a.at.localeCompare(b.at));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/readers.test.ts`
Expected: PASS (all 15).

- [ ] **Step 5: Run neighbours + typecheck**

Run: `npm test -w backend -- --run src/modules/juvi-app/home`
Expected: PASS — the Task 12 `resolve-day` tests still pass.

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/juvi-app/home/money.ts backend/src/modules/juvi-app/home/readers.ts backend/src/modules/juvi-app/home/__tests__/readers.test.ts
git commit -m "feat(juvi): Today/Teaching home readers - attendance, dues, assessments

Attendance wraps the ERP formula (R12: aliased import) with available/
threshold/showHeadroom plus course channels (R18). Dues read open
invoices with paise arithmetic (R1), an open-status filter (R5), and
chronological instalment matching against cumulative payments (R7);
due dates render as midnight college-time ISO (R15). Assessments merge
scheduled internals and exams on active-semester offerings, sorted by
time, each carrying id and course channel."
```
### Task 14: `GET /v1/today`, `/v1/teaching`, `/v1/me/academics` + per-actor guards

**Files:**
- Create: `backend/src/modules/juvi-app/home/service.ts`
- Create: `backend/src/modules/juvi-app/home/controller.ts`
- Create: `backend/src/modules/juvi-app/home/routes.ts`
- Modify: `backend/src/modules/juvi-app/routes.ts` (import + mount `homeRouter`)
- Test: `backend/src/modules/juvi-app/home/__tests__/home-service.test.ts` (unit)
- Test: `backend/src/__e2e__/modules/juvi-home.e2e.test.ts` (wiring)

**Interfaces:**
- Consumes:
  - From `./resolve-day` (Task 12): `resolveDay(collegeId: string, viewer: DayViewer, date: string, timezone: string): Promise<DayView>`, `nextTeachingDay(collegeId: string, viewer: DayViewer, date: string, timezone: string): Promise<DayView | undefined>`, types `DayViewer`, `DayView`, `DayClass`.
  - From `./readers` (Task 13): `juviAttendance(collegeId, studentId)`, `duesFor(collegeId, studentId): Promise<JuviDues>` (fields `available`, `total`, `nextDue: { invoiceId, amount, date, overdue } | null`, `lastPayment: { invoiceId, amount, date, receiptNumber } | null`), `assessmentsFor(collegeId, studentId, from: Date, to: Date)`, `courseChannels(collegeId, offeringIds)`, `nextInvoiceDue(invoice: DuesInvoice)`, types `JuviAttendance`, `DuesInvoice` — every money value (`total`, `DuesInvoice.amount`/`outstanding`, `instalments[].amount`, `nextDue.amount`, `lastPayment.amount`) is integer paise (R1); forward it, never re-convert.
  - From `../../academics/timetable-date` (Task 2): `ymd(at: Date, timezone: string): string`, `addDays(date: string, n: number): string`.
  - `getJuviConfig` from `../config/institution-config`.
  - Models: `Department` from the `'../../../models'` barrel; direct files `College` from `'../../../models/College'`, `Faculty` from `'../../../models/people/Faculty'`, `Course` from `'../../../models/academic-ops/Course'`, `CourseOffering` from `'../../../models/academic-ops/CourseOffering'`, `Section` from `'../../../models/academic-structure/Section'`.
  - `MobileContext` (type) and `requireMobile(req)` from `'../middleware/authenticate-mobile'`; `MobileApiError` from `'../errors'`.
- Produces (Task 15's controller, Task 17's contract, and the e2e rely on these):
  - `homeRouter` mounted via `v1Router.use(homeRouter)` BETWEEN `notificationsRouter` and `spacesRouter` in `backend/src/modules/juvi-app/routes.ts` (§7: before `spacesRouter`, whose router-wide `authenticateMobile` would otherwise run first).
  - Routes: `GET /v1/today` (students only), `GET /v1/teaching` (faculty only), `GET /v1/me/academics` (student or faculty); staff → 403 on all three (R24 — assumed in favour of 403 rather than the endpoint being hidden).
  - `homeToday(ctx: MobileContext): Promise<TodayResponse>`:
    ```typescript
    interface TodayResponse {
      asOf: string;
      today: DayView;
      tomorrow: DayView;
      glance: {
        attendance: { available: boolean; overallPct?: number; threshold: number; belowThreshold: boolean };
        dues: { available: boolean; totalOutstanding: number; nextDue?: { amount: number; date: string } }; // money: integer paise (R1)
        nextAssessment?: { offeringId: string; courseCode: string; title: string; at: string; channelId?: string };
      };
    }
    ```
    `overallPct` and `nextDue` are OMITTED when null (§7.5). `glance.nextAssessment` is the first item of `assessmentsFor(now, now + 14 days)` (Assumption A5: window is 14 days; spec §7.1 does not name it) and carries `offeringId` beyond §7.1's list (deep-link fuel; registered in the contract in Task 17).
  - `homeTeaching(ctx: MobileContext): Promise<TeachingResponse>`:
    ```typescript
    interface TeachingResponse {
      asOf: string;
      today: DayView;
      tomorrow: DayView;
      nextTeachingDay?: DayView;
      faculty: { kind: 'regular' | 'hod' | 'adjunct' };
    }
    ```
    `kind` precedence (Assumption A4): adjunct (contractType adjunct/visiting) > hod (Department.hodId === faculty._id) > regular.
  - `meAcademics(ctx: MobileContext): Promise<MeAcademicsResponse>` with these exported types:
    ```typescript
    export interface DueInvoiceItem { number: string; type: string; outstanding: number; nextDue: { amount: number; date: string }; overdue: boolean } // integer paise (R1)
    export interface StudentDues {
      available: boolean;
      totalOutstanding: number; // integer paise (R1)
      invoices: DueInvoiceItem[];
      lastPayment?: { amount: number; date: string }; // integer paise (R1)
      payUrl?: string;
    }
    export interface StudentAcademics { attendance: JuviAttendance; dues: StudentDues }
    export interface CoursesTaughtItem { offeringId: string; courseCode: string; title: string; section: string; channelId?: string }
    export type MeAcademicsResponse = StudentAcademics | { coursesTaught: CoursesTaughtItem[] };
    ```
    §7.3's contract shape: the reader's `instalments` and `receiptNumber` stay internal; `payUrl` comes from `getJuviConfig().paymentPortalUrl` (Task 9) and is omitted when unset. Attendance passes through `JuviAttendance` as-is — its `overall` is the nested `{ held, attended, pct }` block §7.3 names, with `pct` a nullable scalar (Foundation R57/R61: §7.5 bans null object fields, not null scalars).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/juvi-app/home/__tests__/home-service.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AttendanceRecord,
  AttendanceSession,
  Building,
  Channel,
  Course,
  CourseOffering,
  Department,
  Enrollment,
  Faculty,
  Person,
  Room,
  Section,
  Semester,
  Student,
  Timetable,
  TimetableSlot,
} from '../../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { College } from '../../../../models/College';
import { Invoice } from '../../../../models/finance/Invoice';
import { InternalAssessment } from '../../../../models/academic-ops/InternalAssessment';
import type { MobileContext } from '../../middleware/authenticate-mobile';
import { homeTeaching, homeToday, meAcademics } from '../service';

let collegeId = new Types.ObjectId();
let seq = 0;

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

interface World {
  studentId: string;
  facultyId: string;
  offeringId: string;
  courseId: string;
  semesterId: string;
  sectionId: string;
  todayDate: string;
  tomorrowDate: string;
}

function ctxOf(kind: 'student' | 'faculty' | 'staff', w?: World): MobileContext {
  return {
    kind,
    collegeId: collegeId.toString(),
    userId: new Types.ObjectId().toString(),
    accountId: new Types.ObjectId().toString(),
    sessionId: new Types.ObjectId().toString(),
    role: kind,
    studentId: kind === 'student' && w ? w.studentId : undefined,
    facultyId: kind === 'faculty' && w ? w.facultyId : undefined,
    account: { kind },
  } as unknown as MobileContext;
}

function collegeDates(): { todayDate: string; tomorrowDate: string } {
  // The service derives dates from the college tz (Asia/Kolkata here); derive the
  // same strings for slot placement so the test never depends on the wall clock.
  const inIst = new Date(Date.now() + 5.5 * 3_600_000);
  const todayDate = inIst.toISOString().slice(0, 10);
  const tomorrowDate = new Date(inIst.getTime() + 86_400_000).toISOString().slice(0, 10);
  return { todayDate, tomorrowDate };
}

async function seedHomeWorld(withTimetable: boolean): Promise<World> {
  const college = await College.create({
    name: 'Juvi Home College', code: `JHC${seq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
    contactEmail: 'a@juvion.test', contactPhone: '9000000000',
    juvi: { enabled: true, attendanceThreshold: 60, showAttendanceHeadroom: true, timezone: 'Asia/Kolkata' },
  });
  collegeId = college._id as Types.ObjectId;
  const { todayDate, tomorrowDate } = collegeDates();
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const section = await Section.create({
    collegeId, name: 'A', branchId: new Types.ObjectId(), batchId: new Types.ObjectId(),
    year: 2, semester: 1, capacity: 60, studentIds: [],
  });
  const sPerson = await Person.create({ collegeId, name: 'Home Student', phone: `90000${seq}`, gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: 'Prof. Rao', phone: `90001${seq}`, gender: 'male' });
  const student = await Student.create({
    collegeId, personId: sPerson._id, admissionYear: 2026,
    rollNumber: `26JH${seq}`, status: 'active', onboardingStatus: 'not_started',
  });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FACJH${seq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'CS301', name: 'Operating Systems',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: semester._id,
    sectionId: section._id, facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1, status: 'active',
  });
  await Enrollment.create({
    collegeId, studentId: student._id, courseOfferingId: offering._id,
    semesterId: semester._id, status: 'enrolled', enrolledAt: new Date(),
  });
  await Channel.create({
    collegeId, name: 'CS301 A', scopeType: 'course_offering', scopeId: offering._id, status: 'active',
  });
  if (withTimetable) {
    const building = await Building.create({ collegeId, name: 'Alpha Block', code: `JHAB${seq++}`, floors: 3, totalRooms: 30 });
    const room = await Room.create({ collegeId, buildingId: building._id, roomNumber: '101', floor: 1, type: 'classroom', capacity: 60 });
    const timetable = await Timetable.create({
      collegeId, semesterId: semester._id, sectionId: section._id,
      version: 1, status: 'published', effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    });
    // TimetableSlot is keyed by weekday (`day`), not a calendar date: one slot on
    // today's weekday and one on tomorrow's, on the same published timetable (the
    // service maps a date onto its weekday through the live timetable).
    for (const [index, date] of [todayDate, tomorrowDate].entries()) {
      const weekday = DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
      await TimetableSlot.create({
        collegeId, timetableId: timetable._id, day: weekday, period: index + 1,
        startTime: '09:00', endTime: '10:00', slotType: 'lecture',
        courseOfferingId: offering._id, roomId: room._id,
      });
    }
  }
  return {
    studentId: String(student._id), facultyId: String(faculty._id),
    offeringId: String(offering._id), courseId: String(course._id),
    semesterId: String(semester._id), sectionId: String(section._id),
    todayDate, tomorrowDate,
  };
}

describe('homeToday (§7.1)', () => {
  beforeEach(async () => { await clearCollections(); });

  it('returns asOf, today classes with channelId, tomorrow, and an empty-world glance', async () => {
    const w = await seedHomeWorld(true);
    const out = await homeToday(ctxOf('student', w));
    expect(out.asOf).toBeTypeOf('string');
    expect(out.today.classes.filter((c) => c.offeringId === w.offeringId).length).toBe(1);
    expect(out.today.classes[0]!.courseCode).toBe('CS301');
    expect(out.today.classes[0]!.channelId).toBeTypeOf('string');
    expect(out.tomorrow.date).toBe(w.tomorrowDate);
    expect(out.tomorrow.classes[0]!.courseCode).toBe('CS301');
    expect(out.glance.attendance).toMatchObject({ available: false, threshold: 60, belowThreshold: false });
    expect('overallPct' in out.glance.attendance).toBe(false);   // null omitted (§7.5)
    expect(out.glance.dues).toMatchObject({ available: false, totalOutstanding: 0 });
    expect('nextDue' in out.glance.dues).toBe(false);
    expect(out.glance.nextAssessment).toBeUndefined();
  });

  it('glance.dues carries totalOutstanding + nextDue, and nextAssessment comes from the 14-day window', async () => {
    const w = await seedHomeWorld(false);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'HINV-1',
      type: 'fee', totalAmount: 12000, dueDate: new Date(Date.now() + 86_400_000), status: 'sent',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 1', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(Date.now() + 3 * 86_400_000), status: 'scheduled',
    });
    const out = await homeToday(ctxOf('student', w));
    expect(out.glance.dues.available).toBe(true);
    expect(out.glance.dues.totalOutstanding).toBe(1200000); // 12000 ₹ in paise (R1)
    expect(out.glance.dues.nextDue).toMatchObject({ amount: 1200000 });
    expect(out.glance.nextAssessment!.title).toBe('Quiz 1');
    expect(out.glance.nextAssessment!.courseCode).toBe('CS301');
  });

  it('an assessment outside the 14-day window is not the next assessment (window assumption A5)', async () => {
    const w = await seedHomeWorld(false);
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Far quiz', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(Date.now() + 40 * 86_400_000), status: 'scheduled',
    });
    const out = await homeToday(ctxOf('student', w));
    expect(out.glance.nextAssessment).toBeUndefined();
  });

  it('attendance belowThreshold turns on when overall pct is under the threshold', async () => {
    const w = await seedHomeWorld(false);
    const session = await AttendanceSession.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      date: new Date('2026-07-01T00:00:00Z'), period: 1,
      facultyId: new Types.ObjectId(w.facultyId), status: 'closed',
    });
    await AttendanceRecord.create({
      collegeId, sessionId: session._id, studentId: new Types.ObjectId(w.studentId),
      status: 'absent', markedBy: new Types.ObjectId(w.facultyId),
    });
    const out = await homeToday(ctxOf('student', w));
    expect(out.glance.attendance.overallPct).toBe(0);
    expect(out.glance.attendance.belowThreshold).toBe(true);
  });

  it('staff is 403 FORBIDDEN (R24)', async () => {
    await seedHomeWorld(false);
    await expect(homeToday(ctxOf('staff'))).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});

describe('homeTeaching (§7.2)', () => {
  beforeEach(async () => { await clearCollections(); });

  it('a faculty day carries registered, and nextTeachingDay lands on the next slotted day', async () => {
    const w = await seedHomeWorld(true);
    const out = await homeTeaching(ctxOf('faculty', w));
    expect(out.faculty).toEqual({ kind: 'regular' });
    expect(out.asOf).toBeTypeOf('string');
    const first = out.nextTeachingDay ?? out.tomorrow;
    expect(first.classes[0]!.registered).toBe(1);
    expect(first.date === w.tomorrowDate || out.tomorrow.classes.length === 0).toBe(true);
  });

  it('kind adjunct wins over hod (precedence A4)', async () => {
    const w = await seedHomeWorld(false);
    await Faculty.updateOne({ _id: new Types.ObjectId(w.facultyId) }, { $set: { contractType: 'visiting' } });
    await Department.create({ collegeId, code: 'CSEJH', name: 'Comp Sci', isActive: true, hodId: new Types.ObjectId(w.facultyId) });
    const out = await homeTeaching(ctxOf('faculty', w));
    expect(out.faculty.kind).toBe('adjunct');
  });

  it('kind hod from Department.hodId', async () => {
    const w = await seedHomeWorld(false);
    await Department.create({ collegeId, code: 'CSEJH2', name: 'Comp Sci 2', isActive: true, hodId: new Types.ObjectId(w.facultyId) });
    const out = await homeTeaching(ctxOf('faculty', w));
    expect(out.faculty.kind).toBe('hod');
  });

  it('students are 403 on teaching (§7.2 is faculty)', async () => {
    const w = await seedHomeWorld(false);
    await expect(homeTeaching(ctxOf('student', w))).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});

describe('meAcademics (§7.3)', () => {
  beforeEach(async () => { await clearCollections(); });

  it('a student gets attendance + dues in the contract shape (no instalments, no receiptNumber)', async () => {
    const w = await seedHomeWorld(false);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'HINV-2',
      type: 'fee', totalAmount: 8000, dueDate: new Date(Date.now() + 2 * 86_400_000), status: 'sent',
    });
    const out = (await meAcademics(ctxOf('student', w))) as { attendance: { threshold: number }; dues: { invoices: { number: string; overdue: boolean }[]; payUrl?: string } };
    expect(out.attendance.threshold).toBe(60);
    expect(out.dues.invoices).toHaveLength(1);
    expect(out.dues.invoices[0]!.number).toBe('HINV-2');
    expect(out.dues.invoices[0]!.overdue).toBe(false);
    expect(JSON.stringify(out.dues)).not.toContain('instalments');
    expect(JSON.stringify(out.dues)).not.toContain('receiptNumber');
    expect('payUrl' in out.dues).toBe(false);
  });

  it('payUrl appears when the college configured paymentPortalUrl (Task 9 setting)', async () => {
    const w = await seedHomeWorld(false);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'HINV-3',
      type: 'fee', totalAmount: 8000, dueDate: new Date(Date.now() + 2 * 86_400_000), status: 'sent',
    });
    await College.updateOne({ _id: collegeId }, { $set: { 'juvi.paymentPortalUrl': 'https://pay.juvion.test/xyz' } });
    const out = (await meAcademics(ctxOf('student', w))) as { dues: { payUrl?: string } };
    expect(out.dues.payUrl).toBe('https://pay.juvion.test/xyz');
  });

  it('faculty get coursesTaught with section and channelId, not attendance/dues', async () => {
    const w = await seedHomeWorld(true);
    const out = (await meAcademics(ctxOf('faculty', w))) as { coursesTaught: { courseCode: string; section: string; channelId?: string }[] };
    expect(out.coursesTaught).toHaveLength(1);
    expect(out.coursesTaught[0]!.courseCode).toBe('CS301');
    expect(out.coursesTaught[0]!.section).toBe('A');
    expect(out.coursesTaught[0]!.channelId).toBeTypeOf('string');
    expect('attendance' in out).toBe(false);
    expect('dues' in out).toBe(false);
  });

  it('staff is 403 FORBIDDEN (R24)', async () => {
    await seedHomeWorld(false);
    await expect(meAcademics(ctxOf('staff'))).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/home-service.test.ts`
Expected: FAIL — `Cannot find module '../service'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/juvi-app/home/service.ts`:

```typescript
import { Types } from 'mongoose';

import type { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { Department } from '../../../models';
import { Faculty } from '../../../models/people/Faculty';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Section } from '../../../models/academic-structure/Section';
import { activeSemesterIds } from '../../academics/live-timetable';
import { addDays, ymd } from '../../academics/timetable-date';
import { nextTeachingDay, resolveDay, type DayView, type DayViewer } from './resolve-day';
import {
  assessmentsFor,
  courseChannels,
  duesFor,
  juviAttendance,
  nextInvoiceDue,
  type DuesInvoice,
  type JuviAttendance,
} from './readers';
import { getJuviConfig } from '../config/institution-config';

export interface TodayResponse {
  asOf: string;
  today: DayView;
  tomorrow: DayView;
  glance: {
    attendance: { available: boolean; overallPct?: number; threshold: number; belowThreshold: boolean };
    dues: { available: boolean; totalOutstanding: number; nextDue?: { amount: number; date: string } }; // money: integer paise (R1)
    nextAssessment?: { offeringId: string; courseCode: string; title: string; at: string; channelId?: string };
  };
}

export interface TeachingResponse {
  asOf: string;
  today: DayView;
  tomorrow: DayView;
  nextTeachingDay?: DayView;
  faculty: { kind: 'regular' | 'hod' | 'adjunct' };
}

export interface DueInvoiceItem { number: string; type: string; outstanding: number; nextDue: { amount: number; date: string }; overdue: boolean } // integer paise (R1)

export interface StudentDues {
  available: boolean;
  totalOutstanding: number; // integer paise (R1)
  invoices: DueInvoiceItem[];
  lastPayment?: { amount: number; date: string }; // integer paise (R1)
  payUrl?: string;
}

export interface StudentAcademics { attendance: JuviAttendance; dues: StudentDues }

export interface CoursesTaughtItem {
  offeringId: string;
  courseCode: string;
  title: string;
  section: string;
  channelId?: string;
}

export type MeAcademicsResponse = StudentAcademics | { coursesTaught: CoursesTaughtItem[] };

const NEXT_ASSESSMENT_WINDOW_MS = 14 * 86_400_000;

function requireStudent(ctx: MobileContext): { kind: 'student'; studentId: string } {
  if (ctx.kind !== 'student' || !ctx.studentId) throw new MobileApiError(403, 'FORBIDDEN', 'Available to students only.');
  return { kind: 'student', studentId: ctx.studentId };
}

function requireFaculty(ctx: MobileContext): { kind: 'faculty'; facultyId: string } {
  if (ctx.kind !== 'faculty' || !ctx.facultyId) throw new MobileApiError(403, 'FORBIDDEN', 'Available to faculty only.');
  return { kind: 'faculty', facultyId: ctx.facultyId };
}

function requireNotStaff(ctx: MobileContext): string {
  if (ctx.kind === 'staff') throw new MobileApiError(403, 'FORBIDDEN', 'Available to students and faculty only.');
  if (ctx.kind === 'student') return ctx.studentId ?? '';
  return ctx.facultyId ?? '';
}

export async function homeToday(ctx: MobileContext): Promise<TodayResponse> {
  const viewer = requireStudent(ctx);
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const todayDate = ymd(now, tz);
  const [today, tomorrow, attendance, dues, nextAssessments] = await Promise.all([
    resolveDay(ctx.collegeId, viewer, todayDate, tz),
    resolveDay(ctx.collegeId, viewer, addDays(todayDate, 1), tz),
    juviAttendance(ctx.collegeId, viewer.studentId),
    duesFor(ctx.collegeId, viewer.studentId),
    assessmentsFor(ctx.collegeId, viewer.studentId, now, new Date(now.getTime() + NEXT_ASSESSMENT_WINDOW_MS)),
  ]);

  const attendanceGlance: TodayResponse['glance']['attendance'] = {
    available: attendance.available,
    threshold: attendance.threshold,
    belowThreshold: attendance.overall.pct !== null && attendance.overall.pct < attendance.threshold,
  };
  if (attendance.overall.pct !== null) attendanceGlance.overallPct = attendance.overall.pct;

  // duesFor output is already integer paise (R1) — forward it; a second toPaise would ×100 again.
  const duesGlance: TodayResponse['glance']['dues'] = { available: dues.available, totalOutstanding: dues.total };
  if (dues.nextDue) duesGlance.nextDue = { amount: dues.nextDue.amount, date: dues.nextDue.date };

  const glance: TodayResponse['glance'] = { attendance: attendanceGlance, dues: duesGlance };
  const first = nextAssessments[0];
  if (first) {
    glance.nextAssessment = {
      offeringId: first.offeringId,
      courseCode: first.courseCode,
      title: first.title,
      at: first.at,
      channelId: first.channelId,
    };
  }
  return { asOf: now.toISOString(), today, tomorrow, glance };
}

export async function homeTeaching(ctx: MobileContext): Promise<TeachingResponse> {
  const viewer = requireFaculty(ctx);
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const todayDate = ymd(now, tz);
  const [today, tomorrow, next, kind] = await Promise.all([
    resolveDay(ctx.collegeId, viewer, todayDate, tz),
    resolveDay(ctx.collegeId, viewer, addDays(todayDate, 1), tz),
    nextTeachingDay(ctx.collegeId, viewer, todayDate, tz),
    facultyKindOf(ctx.collegeId, viewer.facultyId),
  ]);
  const out: TeachingResponse = { asOf: now.toISOString(), today, tomorrow, faculty: { kind } };
  if (next) out.nextTeachingDay = next;
  return out;
}

/** §7.2: adjunct when the contract is adjunct/visiting, else hod via Department.hodId, else regular (A4). */
async function facultyKindOf(collegeId: string, facultyId: string): Promise<'regular' | 'hod' | 'adjunct'> {
  const faculty = await Faculty.findOne({ _id: facultyId, collegeId }).select('contractType').lean<{ contractType?: string } | null>();
  if (!faculty) return 'regular';
  if (faculty.contractType === 'adjunct' || faculty.contractType === 'visiting') return 'adjunct';
  const dept = await Department.findOne({ collegeId, hodId: new Types.ObjectId(facultyId) }).select('_id').lean<{ _id: unknown } | null>();
  return dept ? 'hod' : 'regular';
}

export async function meAcademics(ctx: MobileContext): Promise<MeAcademicsResponse> {
  const id = requireNotStaff(ctx);
  if (ctx.kind === 'faculty') return { coursesTaught: await coursesTaughtOf(ctx.collegeId, id) };

  const studentId = id;
  if (!studentId) throw new MobileApiError(403, 'FORBIDDEN', 'Available to students and faculty only.');
  const [cfg, attendance, dues] = await Promise.all([
    getJuviConfig(ctx.collegeId),
    juviAttendance(ctx.collegeId, studentId),
    duesFor(ctx.collegeId, studentId),
  ]);
  // duesFor output is already integer paise (R1) — forward it (see homeToday's glance note).
  const duesBlock: StudentDues = {
    available: dues.available,
    totalOutstanding: dues.total,
    invoices: dues.invoices.map((i: DuesInvoice) => ({
      number: i.invoiceNumber,
      type: i.type,
      outstanding: i.outstanding,
      nextDue: nextInvoiceDue(i),
      overdue: i.overdue,
    })),
  };
  if (dues.lastPayment) duesBlock.lastPayment = { amount: dues.lastPayment.amount, date: dues.lastPayment.date };
  if (cfg?.paymentPortalUrl) duesBlock.payUrl = cfg.paymentPortalUrl;
  return { attendance, dues: duesBlock };
}

async function coursesTaughtOf(collegeId: string, facultyId: string): Promise<CoursesTaughtItem[]> {
  const semesterIds = await activeSemesterIds(collegeId);
  if (semesterIds.length === 0) return [];
  const offerings = await CourseOffering.find({
    collegeId,
    semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
    $or: [{ facultyId }, { coFacultyIds: facultyId }],
  }).select('_id courseId sectionId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; sectionId?: Types.ObjectId }[]>();
  if (offerings.length === 0) return [];
  const channels = await courseChannels(collegeId, offerings.map((o) => String(o._id)));
  const courses = await Course.find({
    collegeId, _id: { $in: [...new Set(offerings.map((o) => o.courseId))] },
  }).select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const sectionIds = [...new Set(offerings.map((o) => o.sectionId).filter((s): s is Types.ObjectId => Boolean(s)))];
  const sections = sectionIds.length
    ? await Section.find({ collegeId, _id: { $in: sectionIds } }).select('name').lean<{ _id: Types.ObjectId; name?: string }[]>()
    : [];
  const sectionName = new Map(sections.map((s) => [String(s._id), s.name ?? '']));
  return offerings.map((o) => ({
    offeringId: String(o._id),
    courseCode: courseById.get(String(o.courseId))?.code ?? '',
    title: courseById.get(String(o.courseId))?.name ?? '',
    section: o.sectionId ? sectionName.get(String(o.sectionId)) ?? '' : '',
    channelId: channels.get(String(o._id)),
  }));
}
```

Note on `$or: [{ facultyId }, { coFacultyIds: facultyId }]`: `facultyId`/`coFacultyIds` are ObjectIds in the schema, so the string must be cast — pass `new Types.ObjectId(facultyId)` in both arms:

```typescript
  const id = new Types.ObjectId(facultyId);
  const offerings = await CourseOffering.find({
    collegeId,
    semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
    $or: [{ facultyId: id }, { coFacultyIds: id }],
  }).select('_id courseId sectionId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; sectionId?: Types.ObjectId }[]>();
```

The first listing above is the version to type; apply this cast inside it (the `$or` arms are the only place the raw string is passed to an ObjectId field).

Create `backend/src/modules/juvi-app/home/controller.ts`:

```typescript
import { NextFunction, Request, Response } from 'express';

import { requireMobile } from '../middleware/authenticate-mobile';
import { homeTeaching, homeToday, meAcademics } from './service';

export async function today(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await homeToday(requireMobile(req)));
  } catch (e) { next(e); }
}

export async function teaching(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await homeTeaching(requireMobile(req)));
  } catch (e) { next(e); }
}

export async function academics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await meAcademics(requireMobile(req)));
  } catch (e) { next(e); }
}
```

Create `backend/src/modules/juvi-app/home/routes.ts`:

```typescript
import { Router } from 'express';

import { authenticateMobile } from '../middleware/authenticate-mobile';
import * as ctrl from './controller';

export const homeRouter = Router();

homeRouter.get('/today', authenticateMobile, ctrl.today);
homeRouter.get('/teaching', authenticateMobile, ctrl.teaching);
homeRouter.get('/me/academics', authenticateMobile, ctrl.academics);
```

Mount in `backend/src/modules/juvi-app/routes.ts`:

```
old:
import { notificationsRouter } from './notifications/routes';
new:
import { notificationsRouter } from './notifications/routes';
import { homeRouter } from './home/routes';
```

```
old:
v1Router.use(notificationsRouter);
v1Router.use(spacesRouter);
new:
v1Router.use(notificationsRouter);
v1Router.use(homeRouter);   // §7: /today, /teaching, /me/academics — after notificationsRouter, before spacesRouter
```

`homeRouter` carries its own `authenticateMobile` per route (so `/today` can 401 independently of `spacesRouter`'s router-wide middleware); requests still pass through the mounted router's matching order — `notificationsRouter` first, then `homeRouter`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/home-service.test.ts`
Expected: PASS (all 13).

- [ ] **Step 5: Write the wiring e2e and run it**

Create `backend/src/__e2e__/modules/juvi-home.e2e.test.ts`:

```typescript
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient, provisionTestFaculty, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, createStaffPublisher, signInAs } from '../factories/notice.factory';
import { provisionPerson } from '../../modules/juvi-app/accounts/provisioning-service';
import { revealLatestForAccount } from '../../modules/juvi-app/accounts/credential-store';

process.env.E2E_TESTING = '1';

let app: Express;
let fx: BaseFixtures;

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

const V1 = '/api/juvi-app/v1';

describe('GET /v1/today (§7.1)', () => {
  it('200 with the contract shape for a signed-in student', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/today`).expect(200);
    expect(res.body).toHaveProperty('asOf');
    expect(res.body.today).toHaveProperty('date');
    expect(Array.isArray(res.body.today.classes)).toBe(true);
    expect(res.body.glance.attendance).toHaveProperty('threshold');
    expect(res.body.glance.dues).toHaveProperty('available');
  });

  it('401 without a session', async () => {
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await mobileClient(app).get(`${V1}/today`).expect(401);
  });

  it('403 for faculty (§7.1 is the students surface)', async () => {
    const f = await provisionTestFaculty(fx);
    await activateAccount(String(f.account._id));
    const token = await signInAs(app, fx, String(f.faculty.employeeCode), f.tempPassword);
    await mobileClient(app, token).get(`${V1}/today`).expect(403);
  });
});

describe('GET /v1/teaching and /v1/me/academics (§7.2, §7.3)', () => {
  it('teaching is 200 for faculty and 403 for students', async () => {
    const f = await provisionTestFaculty(fx);
    await activateAccount(String(f.account._id));
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const sTok = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, sTok).get(`${V1}/teaching`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const fTok = await signInAs(app, fx, String(f.faculty.employeeCode), f.tempPassword);
    const teaching = await mobileClient(app, fTok).get(`${V1}/teaching`).expect(200);
    expect(teaching.body.faculty.kind).toBe('regular');
  });

  it('me/academics returns attendance+dues for a student and coursesTaught for faculty', async () => {
    const f = await provisionTestFaculty(fx);
    await activateAccount(String(f.account._id));
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const sTok = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const student = await mobileClient(app, sTok).get(`${V1}/me/academics`).expect(200);
    expect(student.body.attendance).toHaveProperty('threshold');
    expect(student.body.dues).toHaveProperty('invoices');
    const fTok = await signInAs(app, fx, String(f.faculty.employeeCode), f.tempPassword);
    const faculty = await mobileClient(app, fTok).get(`${V1}/me/academics`).expect(200);
    expect(Array.isArray(faculty.body.coursesTaught)).toBe(true);
  });

  it('staff are 403 on all three endpoints (R24)', async () => {
    const officer = await createStaffPublisher(fx, 'ST-REG');
    const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(officer.person._id), kind: 'staff', source: 'admin', performedBy: 'test' });
    await activateAccount(String(account._id));
    const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
    const token = await signInAs(app, fx, String(officer.user.email), cred!.password);
    await mobileClient(app, token).get(`${V1}/today`).expect(403);
    await mobileClient(app, token).get(`${V1}/teaching`).expect(403);
    await mobileClient(app, token).get(`${V1}/me/academics`).expect(403);
  });
});
```

(The staff sign-in identifier is the officer's User `email` — the identifier resolver matches emails case-insensitively, so pass the column value as-is; `cred!.password` matches how `provisionTestStudent` consumes `revealLatestForAccount`.)

- [ ] **Step 6: Run the e2e + unit neighbours + typecheck**

Run: `npm run test:e2e -w backend -- src/__e2e__/modules/juvi-home.e2e.test.ts`
Expected: PASS.

Run: `npm test -w backend -- --run src/modules/juvi-app/home`
Expected: PASS — resolve-day, readers, and home-service suites all green.

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/juvi-app/home/service.ts backend/src/modules/juvi-app/home/controller.ts backend/src/modules/juvi-app/home/routes.ts backend/src/modules/juvi-app/routes.ts backend/src/modules/juvi-app/home/__tests__/home-service.test.ts backend/src/__e2e__/modules/juvi-home.e2e.test.ts
git commit -m "feat(juvi): /v1/today, /v1/teaching, /v1/me/academics endpoints (§7.1-7.3)

Students get today+tomorrow days and a glance (attendance with
belowThreshold, open dues with nextDue, next assessment inside 14 days).
Faculty get their teaching day, nextTeachingDay, and adjunct>hod>regular
kind (A4). Staff are 403 (R24); today is students-only, teaching
faculty-only. Mounted after notificationsRouter, before spacesRouter."
```
### Task 15: `GET /v1/attention?kinds=all` — class changes, fee dues, assessments on the attention stack

**Files:**
- Create: `backend/src/modules/juvi-app/home/attention.ts`
- Modify: `backend/src/modules/juvi-app/notices/schemas.ts` (widen `attentionResponseSchema` to the flat-item form)
- Modify: `backend/src/modules/juvi-app/notices/mobile-service.ts` (export `dueNoticeCards`, add `attentionAll`)
- Modify: `backend/src/modules/juvi-app/notices/mobile-controller.ts` (`kinds` gate)
- Test: `backend/src/modules/juvi-app/home/__tests__/attention-items.test.ts` (unit)
- Test: `backend/src/__e2e__/modules/juvi-attention.e2e.test.ts` (wiring)

**Interfaces:**
- Consumes:
  - `activeExceptionsFor(collegeId, { dates?; slotIds?; offeringIds? }): Promise<LeanClassException[]>` from `'../../academics/class-exception-service'` (Task 4) — non-revoked rows, sorted date asc, `$or [{date $in}, {newDate $in}]` for a `dates` selector.
  - `duesFor(collegeId, studentId)`, `assessmentsFor(collegeId, studentId, from, to)`, `courseChannels(collegeId, offeringIds)`, `nextInvoiceDue(invoice: DuesInvoice): { invoiceId: string; amount: number; date: string; overdue: boolean }` from `./readers` (Task 13).
  - `ymd(at: Date, timezone)`, `addDays(date: string, n: number): string`, `instantOf(date: string, hhmm: string, timezone): Date` from `'../../academics/timetable-date'` (Task 2).
  - `TimetableSlot` from `'../../../models/academic-ops/TimetableSlot'`, `CourseOffering` from `'../../../models/academic-ops/CourseOffering'`, `Course` from `'../../../models/academic-ops/Course'`, `Enrollment` from `'../../../models/academic-ops/Enrollment'`, `Room`/`Building` from `'../../../models/campus/…'`, `getJuviConfig` from `'../config/institution-config'`, `MobileContext` type from `'../middleware/authenticate-mobile'`, `MobileApiError` from `'../errors'`, types `AttentionItem`/`AttentionResponse` from `'../notices/schemas'`.
  - `loadDue(ctx)` + `toCard` stay internal to `notices/mobile-service.ts`; the new export reuses them (no duplication of the due-notice query).
- Produces (Task 17's contract + the Flutter attention repository rely on these):
  - `attentionItems(ctx: MobileContext): Promise<AttentionItem[]>` — exported from `home/attention.ts`; the ERP items for `kinds=all`.
  - `dueNoticeCards(ctx: MobileContext): Promise<NoticeCard[]>` — every due notice card (uncapped) from `mobile-service.ts`.
  - `attentionAll(ctx: MobileContext): Promise<AttentionResponse>` in `mobile-service.ts` — notices + ERP items, `dueCount` counts EVERY item (R32), order `deadline` ascending with missing deadlines last (stable sort keeps notice-first composition order on ties).
  - The legacy `GET /v1/attention` behaviour is byte-for-byte unchanged when `kinds` is absent (R21): `dueCount` = all due notices, `items` = first 3 notice cards.
  - `kinds` accepts only `all` (R31): anything other than a missing param or `all` → `MobileApiError(400, 'VALIDATION_FAILED', 'kinds must be "all"')`.
  - R30: faculty get notices + class_change items only — fee_due and assessment rows are never built for a faculty context.
  - The reader's assessment kind (`internal | exam`) is internal-only; the response item's `kind` is the discriminator value `assessment` (§7.4 reads the item list as discriminated on `kind`; the flat form carries the discriminator in `kind`, so the source-row kind is dropped — Assumption A6).

The flat `AttentionItem` (R33 — kind required, every other field optional; NOT a discriminated union, so old app builds and the Flutter parser both degrade cleanly):

- [ ] **Step 1: Widen the contract schema**

In `backend/src/modules/juvi-app/notices/schemas.ts`, REPLACE the current `attentionResponseSchema` / `AttentionResponse` pair with:

```typescript
export const ATTENTION_KINDS = ['notice', 'class_change', 'fee_due', 'assessment'] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/**
 * §7.4 in the flat form (R33): kind is the discriminator, every other field is
 * optional so each kind carries only its own fields. Notice-card nullable
 * scalars stay `.nullable().optional()` (Foundation R57/R61: nullable values
 * are scalars; objects are never null in any response).
 */
export const attentionItemSchema = z.object({
  kind: z.enum(ATTENTION_KINDS),
  id: z.string(),
  // notice card fields (kind=notice) — the existing NoticeCard, flattened:
  title: z.string().optional(),
  preview: z.string().optional(),
  office: z.string().optional(),
  audienceLine: z.string().optional(),
  priority: z.enum(['routine', 'important', 'urgent']).optional(),
  purpose: z.enum(['standard', 'welcome']).optional(),
  ackRequired: z.boolean().optional(),
  ackCommentAllowed: z.boolean().optional(),
  // All deadlines are ISO instants (R14/R15/R16): class_change = original start,
  // fee_due = the due date at college-tz midnight, assessment = its at instant;
  // the notice's deadline is its ack deadline (nullable when there is none).
  deadline: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  attachmentCount: z.number().int().optional(),
  state: z.enum(NOTICE_STATES).optional(),
  seenAt: z.string().nullable().optional(),
  ackAt: z.string().nullable().optional(),
  late: z.boolean().optional(),
  remindedAt: z.string().nullable().optional(),
  isPublisher: z.boolean().optional(),
  // class_change (§7.4): date/start are the ORIGINAL slot; newDate/newStart the replacement.
  type: z.enum(['cancelled', 'rescheduled']).optional(),
  offeringId: z.string().optional(),
  courseCode: z.string().optional(),
  date: z.string().optional(),
  start: z.string().optional(),
  newDate: z.string().optional(),
  newStart: z.string().optional(),
  room: z.string().optional(),
  channelId: z.string().optional(),
  // fee_due (§7.4/§6): deadline is the next due date at college-tz midnight as an ISO
  // instant (R15 — same convention as R14/R16, so kinds sort together); dueDate is the
  // display 'YYYY-MM-DD' the app renders. amount is integer paise (R1): forwarded
  // unchanged from duesFor/nextInvoiceDue — never re-converted.
  invoiceNumber: z.string().optional(),
  amount: z.number().int().optional(),
  dueDate: z.string().optional(), // 'YYYY-MM-DD' display string only — deadline carries the instant (R15)
  overdue: z.boolean().optional(),
  // assessment (§7.4): the row's internal kind (internal|exam) is not sent (A6).
  at: z.string().optional(),
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const attentionResponseSchema = z.object({ dueCount: z.number().int(), items: z.array(attentionItemSchema) });
export type AttentionResponse = z.infer<typeof attentionResponseSchema>;
```

If `NOTICE_STATES` was imported rather than defined in this file, extend that import (it is part of the existing schemas module).

- [ ] **Step 2: Write the failing unit tests**

Create `backend/src/modules/juvi-app/home/__tests__/attention-items.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Building,
  Channel,
  Course,
  CourseOffering,
  Enrollment,
  Faculty,
  Person,
  Room,
  Section,
  Semester,
  Student,
  Timetable,
  TimetableSlot,
} from '../../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { College } from '../../../../models/College';
import { Invoice } from '../../../../models/finance/Invoice';
import { InternalAssessment } from '../../../../models/academic-ops/InternalAssessment';
import { Notice } from '../../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../../models/juvi/NoticeRecipient';
import { createClassException } from '../../../../modules/academics/class-exception-service';
import { attentionItems } from '../attention';
import { attention, attentionAll } from '../../notices/mobile-service';
import type { MobileContext } from '../../middleware/authenticate-mobile';

// Fixed clock: 2026-11-10T04:00:00Z = 09:30 IST, so the college-tz day is 2026-11-10.
const FIXED = new Date('2026-11-10T04:00:00.000Z');
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const TZ = 'Asia/Kolkata';
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
const offset = (days: number) => new Date(FIXED.getTime() + days * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let seq = 0;

interface World {
  studentId: string;
  facultyId: string;
  accountId: string;
  todayDate: string;
  offeringId: string;
  timetableId: string;
  slotIds: { todaySlot: string; farSlot: string };
}

async function seedWorld(): Promise<World> {
  const todayDate = FIXED.toISOString().slice(0, 10);
  const college = await College.create({
    name: `Attention College ${seq}`, code: `ATC${seq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '500001' },
    contactEmail: 'a@juvion.test', contactPhone: '9000000000',
    juvi: { enabled: true, attendanceThreshold: 60, showAttendanceHeadroom: true, timezone: TZ },
  });
  collegeId = college._id as Types.ObjectId;
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const section = await Section.create({ collegeId, name: 'A', branchId: new Types.ObjectId(), batchId: new Types.ObjectId(), year: 2, semester: 1, capacity: 60, studentIds: [] });
  const sPerson = await Person.create({ collegeId, name: `Attn Student ${seq}`, phone: `90000910${seq++}`, gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: `Prof. Devi ${seq}`, phone: `90000911${seq++}`, gender: 'female' });
  const student = await Student.create({ collegeId, personId: sPerson._id, admissionYear: 2026, rollNumber: `26AT${seq}`, status: 'active', onboardingStatus: 'not_started' });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FACAT${seq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'OOP101', name: 'Object Oriented Programming',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: semester._id,
    sectionId: section._id, facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1, status: 'active',
  });
  await Enrollment.create({ collegeId, studentId: student._id, courseOfferingId: offering._id, semesterId: semester._id, status: 'enrolled', enrolledAt: FIXED });
  await Channel.create({ collegeId, name: 'OOP101 A', scopeType: 'course_offering', scopeId: offering._id, status: 'active' });
  const building = await Building.create({ collegeId, name: 'Main Block', code: `ATMD${seq++}`, floors: 3, totalRooms: 30 });
  const room = await Room.create({ collegeId, buildingId: building._id, roomNumber: '101', floor: 1, type: 'classroom', capacity: 60 });
  const timetable = await Timetable.create({ collegeId, semesterId: semester._id, sectionId: section._id, version: 1, status: 'published', effectiveFrom: new Date('2026-06-01T00:00:00Z') });
  const farDate = offset(4); // a weekday four days out: outside today/tomorrow
  const todaySlot = await TimetableSlot.create({
    collegeId, timetableId: timetable._id, day: dow(todayDate), period: 2,
    startTime: '14:00', endTime: '15:00', slotType: 'lecture', courseOfferingId: offering._id, roomId: room._id,
  });
  const farSlot = await TimetableSlot.create({
    collegeId, timetableId: timetable._id, day: dow(farDate), period: 3,
    startTime: '09:00', endTime: '10:00', slotType: 'lecture', courseOfferingId: offering._id, roomId: room._id,
  });
  return {
    studentId: String(student._id), facultyId: String(faculty._id),
    accountId: new Types.ObjectId().toString(), todayDate,
    offeringId: String(offering._id), timetableId: String(timetable._id),
    slotIds: { todaySlot: String(todaySlot._id), farSlot: String(farSlot._id) },
  };
}

function studentCtx(w: World): MobileContext {
  return {
    kind: 'student', collegeId: collegeId.toString(), userId: new Types.ObjectId().toString(),
    accountId: w.accountId, sessionId: new Types.ObjectId().toString(), role: 'student',
    studentId: w.studentId, account: { kind: 'student' },
  } as unknown as MobileContext;
}

function facultyCtx(w: World): MobileContext {
  return {
    kind: 'faculty', collegeId: collegeId.toString(), userId: new Types.ObjectId().toString(),
    accountId: w.accountId, sessionId: new Types.ObjectId().toString(), role: 'faculty',
    facultyId: w.facultyId, account: { kind: 'faculty' },
  } as unknown as MobileContext;
}

async function cancel(slotId: string, date: string): Promise<string> {
  const doc = await createClassException(collegeId.toString(), { timetableSlotId: slotId, date, type: 'cancelled', reason: 'Venue flooded' }, new Types.ObjectId().toString());
  return String(doc._id);
}

async function seedDueNotice(w: World, title: string, ackDeadline: Date | null): Promise<void> {
  const notice = await Notice.create({
    collegeId, title, body: `Body of ${title}`,
    publisher: { personId: new Types.ObjectId(), userId: new Types.ObjectId(), office: 'Exams' },
    audience: { rules: [], line: 'All students' },
    ackRequired: true, ackDeadline, status: 'published', publishedAt: FIXED,
  });
  await NoticeRecipient.create({
    collegeId, noticeId: notice._id, personId: new Types.ObjectId(), accountId: new Types.ObjectId(w.accountId),
    kind: 'student', ackRequired: true, deadline: ackDeadline, receivedAt: FIXED,
  });
}

describe('attentionItems (§7.4)', () => {
  beforeEach(async () => { await clearCollections(); vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('a cancelled class today is a class_change item with the original slot and its channel', async () => {
    const w = await seedWorld();
    const exceptionId = await cancel(w.slotIds.todaySlot, w.todayDate);
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'class_change', id: exceptionId, type: 'cancelled', courseCode: 'OOP101',
      date: w.todayDate, start: '14:00', deadline: new Date('2026-11-10T08:30:00.000Z').toISOString(),
    });
    expect(items[0]!.channelId).toBeTypeOf('string');
    expect(items[0]!.room).toBe('101, Main Block');
  });

  it('an exception whose original date is beyond tomorrow is excluded (R14)', async () => {
    const w = await seedWorld();
    await cancel(w.slotIds.farSlot, offset(4));
    expect(await attentionItems(studentCtx(w))).toHaveLength(0);
  });

  it('a class change whose original start already passed is excluded', async () => {
    const w = await seedWorld();
    // Re-seed a today slot at 07:00 IST (01:30Z < the 04:00Z fixed clock) and cancel it.
    const early = await TimetableSlot.create({
      collegeId, timetableId: new Types.ObjectId(w.timetableId), day: dow(w.todayDate), period: 1,
      startTime: '07:00', endTime: '08:00', slotType: 'lecture',
      courseOfferingId: new Types.ObjectId(w.offeringId), roomId: (await Room.findOne({ collegeId }))!._id,
    });
    await cancel(String(early._id), w.todayDate);
    expect(await attentionItems(studentCtx(w))).toHaveLength(0);
  });

  it('a reschedule from today to next week shows the original date/start and the new date/start', async () => {
    const w = await seedWorld();
    const doc = await createClassException(collegeId.toString(), {
      timetableSlotId: w.slotIds.todaySlot, date: w.todayDate, type: 'rescheduled',
      newDate: offset(5), newStartTime: '15:00', newEndTime: '16:00', reason: 'Staff training',
    }, new Types.ObjectId().toString());
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'class_change', id: String(doc._id), type: 'rescheduled',
      date: w.todayDate, start: '14:00', newDate: offset(5), newStart: '15:00',
    });
  });

  it('a reschedule whose new date is tomorrow appears even when the original is beyond tomorrow (R14)', async () => {
    const w = await seedWorld();
    await createClassException(collegeId.toString(), {
      timetableSlotId: w.slotIds.farSlot, date: offset(4), type: 'rescheduled',
      newDate: offset(1), newStartTime: '15:00', newEndTime: '16:00', reason: 'Staff training',
    }, new Types.ObjectId().toString());
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'class_change', type: 'rescheduled', date: offset(4), start: '09:00', newDate: offset(1), newStart: '15:00',
    });
  });

  it('fee_due items appear inside the 7-day window and for overdue invoices (§6/§7.4)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AWIN-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(5)}T00:00:00Z`), status: 'sent',
    });
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AOLD-1',
      type: 'hostel', totalAmount: 3000, dueDate: new Date(`${offset(-3)}T00:00:00Z`), status: 'overdue',
    });
    const items = await attentionItems(studentCtx(w));
    const fees = items.filter((i) => i.kind === 'fee_due');
    expect(fees).toHaveLength(2);
    expect(fees.map((f) => f.invoiceNumber).sort()).toEqual(['AOLD-1', 'AWIN-1']);
    // AWIN-1 has no payments: outstanding 5000 ₹ = integer paise 500000 (R1).
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.amount).toBe(500000);
    expect(fees.find((f) => f.invoiceNumber === 'AOLD-1')!.overdue).toBe(true);
    // deadline carries the college-tz-midnight ISO instant; dueDate the display date (R15).
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.overdue).toBe(false);
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.dueDate).toBe(offset(5));
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.deadline).toBe('2026-11-14T18:30:00.000Z'); // IST midnight of 2026-11-15
    expect(fees.find((f) => f.invoiceNumber === 'AOLD-1')!.dueDate).toBe(offset(-3));
    expect(fees.find((f) => f.invoiceNumber === 'AOLD-1')!.deadline).toBe('2026-11-06T18:30:00.000Z'); // IST midnight of 2026-11-07
  });

  it('a fee due beyond 7 days is excluded', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AFAR-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(10)}T00:00:00Z`), status: 'sent',
    });
    const items = await attentionItems(studentCtx(w));
    expect(items.filter((i) => i.kind === 'fee_due')).toHaveLength(0);
  });

  it('a fee due exactly today appears and is NOT overdue (R15)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'ATODAY-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(0)}T00:00:00Z`), status: 'sent',
    });
    const items = await attentionItems(studentCtx(w));
    const fees = items.filter((i) => i.kind === 'fee_due');
    expect(fees).toHaveLength(1); // deadline == start-of-today: the window includes today
    expect(fees[0]).toMatchObject({
      invoiceNumber: 'ATODAY-1', dueDate: offset(0), overdue: false,
      deadline: '2026-11-09T18:30:00.000Z', // IST midnight of the 10th == start-of-today instant
    });
    expect(fees[0]!.amount).toBe(500000); // 5000 ₹ in paise (R1)
  });

  it('faculty get class changes but never fee or assessment items (R30)', async () => {
    const w = await seedWorld();
    await cancel(w.slotIds.todaySlot, w.todayDate);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AFAC-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(2)}T00:00:00Z`), status: 'sent',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 1', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(FIXED.getTime() + 36 * 3_600_000), status: 'scheduled',
    });
    const items = await attentionItems(facultyCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('class_change');
  });

  it('an assessment within 48 hours is an assessment item whose deadline is its start', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 2', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(FIXED.getTime() + 36 * 3_600_000), status: 'scheduled',
    });
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'assessment', courseCode: 'OOP101', title: 'Quiz 2',
      at: new Date(FIXED.getTime() + 36 * 3_600_000).toISOString(),
      deadline: new Date(FIXED.getTime() + 36 * 3_600_000).toISOString(),
    });
    expect(items[0]!.channelId).toBeTypeOf('string');
  });

  it('an assessment beyond 48 hours is excluded', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 3', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(FIXED.getTime() + 72 * 3_600_000), status: 'scheduled',
    });
    expect(await attentionItems(studentCtx(w))).toHaveLength(0);
  });
});

describe('attentionAll and the legacy shape', () => {
  beforeEach(async () => { await clearCollections(); vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('kinds=all merges due notices with ERP items, orders by deadline, and counts every item', async () => {
    const w = await seedWorld();
    await cancel(w.slotIds.todaySlot, w.todayDate);           // deadline 08:30Z
    await seedDueNotice(w, 'Submit hall ticket', new Date('2026-11-10T16:30:00.000Z')); // deadline 16:30Z
    const out = await attentionAll(studentCtx(w));
    expect(out.dueCount).toBe(2);
    expect(out.items.map((i) => i.kind)).toEqual(['class_change', 'notice']);
    const noticeItem = out.items[1]!;
    expect(noticeItem).toMatchObject({ kind: 'notice', title: 'Submit hall ticket', state: 'received', deadline: '2026-11-10T16:30:00.000Z' });
  });

  it('the legacy behaviour without kinds=all is unchanged: all due notices counted, items capped at 3', async () => {
    const w = await seedWorld();
    for (const n of [1, 2, 3, 4]) await seedDueNotice(w, `Dues notice ${n}`, new Date('2026-11-10T16:30:00.000Z'));
    await cancel(w.slotIds.todaySlot, w.todayDate);
    const legacy = await attention(studentCtx(w));
    expect(legacy.dueCount).toBe(4);
    expect(legacy.items).toHaveLength(3);
    expect(legacy.items.every((i) => i.kind === 'notice')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/attention-items.test.ts`
Expected: FAIL — `Cannot find module '../attention'`.

- [ ] **Step 4: Write the implementation**

Create `backend/src/modules/juvi-app/home/attention.ts`:

```typescript
/**
 * §7.4 attention items beyond notices: class changes, fee dues and assessments.
 * Notices are composed by notices/mobile-service (dueNoticeCards); this module
 * builds the ERP items the viewer is entitled to. Scoping is collegeId + the
 * caller's studentId/facultyId — never request parameters.
 */
import { Types } from 'mongoose';

import { activeExceptionsFor } from '../../academics/class-exception-service';
import { addDays, instantOf, ymd } from '../../academics/timetable-date';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Building } from '../../../models/campus/Building';
import { Room } from '../../../models/campus/Room';
import { getJuviConfig } from '../config/institution-config';
import type { MobileContext } from '../middleware/authenticate-mobile';
import type { AttentionItem } from '../notices/schemas';
import { assessmentsFor, courseChannels, duesFor, nextInvoiceDue } from './readers';

const FEE_WINDOW_DAYS = 7;                    // §7.4: next due within 7 days (or overdue)
const ASSESSMENT_WINDOW_MS = 48 * 3_600_000;  // §7.4: shown when it falls within 48 hours

/** §6: room number plus building when there is one. */
async function roomLabelOf(collegeId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const roomIds = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (roomIds.length === 0) return new Map();
  const rooms = await Room.find({ collegeId, _id: { $in: roomIds.map((v) => new Types.ObjectId(v)) } })
    .select('roomNumber buildingId').lean<{ _id: Types.ObjectId; roomNumber: string; buildingId?: Types.ObjectId }[]>();
  const buildingIds = [...new Set(rooms.map((r) => String(r.buildingId)).filter(Boolean))];
  const buildings = buildingIds.length
    ? await Building.find({ collegeId, _id: { $in: buildingIds.map((v) => new Types.ObjectId(v)) } })
        .select('name').lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const nameByBuilding = new Map(buildings.map((b) => [String(b._id), b.name]));
  return new Map(rooms.map((r) => {
    const building = nameByBuilding.get(String(r.buildingId));
    return [String(r._id), building ? `${r.roomNumber}, ${building}` : r.roomNumber];
  }));
}

/**
 * §7.4: the viewer's class changes whose original OR new date falls on
 * today or tomorrow (R14), shown until that original start has passed.
 * The item id is the exception id. A rescheduled class left its original
 * date, so deriving from day views would miss both an original-today
 * reschedule that moved beyond tomorrow and an original-beyond-tomorrow
 * reschedule whose new date is today/tomorrow — this queries the
 * exceptions directly and keeps every class whose either date is in-window
 * (Review Focus).
 */
async function classChangeItems(
  collegeId: string, ctx: MobileContext, todayDate: string, tomorrowDate: string, tz: string, now: Date,
): Promise<AttentionItem[]> {
  const exceptions = await activeExceptionsFor(collegeId, { dates: [todayDate, tomorrowDate] });
  const mine = exceptions.filter((e) => e.date === todayDate || e.date === tomorrowDate
    || e.newDate === todayDate || e.newDate === tomorrowDate); // R14: the new date counts too
  if (mine.length === 0) return [];

  const slotIds = [...new Set(mine.map((e) => String(e.timetableSlotId)))];
  const slots = await TimetableSlot.find({ collegeId, _id: { $in: slotIds.map((v) => new Types.ObjectId(v)) } })
    .select('courseOfferingId startTime roomId substituteFacultyId originalFacultyId')
    .lean<{ _id: Types.ObjectId; courseOfferingId: Types.ObjectId; startTime: string; roomId?: Types.ObjectId; substituteFacultyId?: Types.ObjectId; originalFacultyId?: Types.ObjectId }[]>();
  const slotById = new Map(slots.map((s) => [String(s._id), s]));

  const offeringIds = [...new Set(slots.map((s) => String(s.courseOfferingId)))];
  const offerings = offeringIds.length
    ? await CourseOffering.find({ collegeId, _id: { $in: offeringIds.map((v) => new Types.ObjectId(v)) } })
        .select('courseId facultyId coFacultyIds')
        .lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[] }[]>()
    : [];
  const offeringById = new Map(offerings.map((o) => [String(o._id), o]));
  const courses = offeringIds.length
    ? await Course.find({ collegeId, _id: { $in: [...new Set(offerings.map((o) => String(o.courseId)))] } })
        .select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>()
    : [];
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const [channels, roomLabels] = await Promise.all([courseChannels(collegeId, offeringIds), roomLabelOf(collegeId, [
    ...slots.map((s) => (s.roomId ? String(s.roomId) : null)),
    ...mine.map((e) => (e.newRoomId ? String(e.newRoomId) : null)),
  ])]);

  // Visibility: students see changes to offerings they are enrolled in; faculty
  // when they teach the offering or hold the slot's substitute/original seat.
  let enrolledOfferings: Set<string> = new Set();
  let myFacultyId = '';
  if (ctx.kind === 'student' && ctx.studentId) {
    const rows = await Enrollment.find({ collegeId, studentId: new Types.ObjectId(ctx.studentId), status: 'enrolled' })
      .select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
    enrolledOfferings = new Set(rows.map((r) => String(r.courseOfferingId)));
  }
  if (ctx.kind === 'faculty') myFacultyId = ctx.facultyId ?? '';

  const items: AttentionItem[] = [];
  for (const e of mine) {
    const slot = slotById.get(String(e.timetableSlotId));
    if (!slot) continue; // the slot row vanished between query and decoration
    const offering = offeringById.get(String(slot.courseOfferingId));
    if (!offering) continue;
    if (ctx.kind === 'faculty') {
      const teaches = String(offering.facultyId) === myFacultyId
        || (offering.coFacultyIds ?? []).some((c) => String(c) === myFacultyId)
        || Boolean(slot.substituteFacultyId && String(slot.substituteFacultyId) === myFacultyId)
        || Boolean(slot.originalFacultyId && String(slot.originalFacultyId) === myFacultyId);
      if (!teaches) continue;
    } else if (!enrolledOfferings.has(String(offering._id))) {
      continue;
    }
    const deadline = instantOf(e.date, slot.startTime, tz).toISOString();
    if (deadline <= now.toISOString()) continue; // shown until the original start has passed
    const course = courseById.get(String(offering.courseId));
    const roomName = e.newRoomId ? roomLabels.get(String(e.newRoomId)) : (slot.roomId ? roomLabels.get(String(slot.roomId)) : undefined);
    const channelId = channels.get(String(offering._id));
    const item: AttentionItem = {
      kind: 'class_change',
      id: String(e._id),
      type: e.type,
      offeringId: String(offering._id),
      courseCode: course?.code ?? '',
      title: course?.name ?? '',
      date: e.date,
      start: slot.startTime,
      deadline,
    };
    if (e.type === 'rescheduled') {
      item.newDate = e.newDate ?? undefined;
      item.newStart = e.newStartTime ?? undefined;
    }
    if (roomName) item.room = roomName;
    if (channelId) item.channelId = channelId;
    items.push(item);
  }
  return items;
}

/**
 * R15: the window and overdue comparisons are instant math — the origin is the
 * college-tz midnight passed in as todayMidnight (instantOf) — never string
 * comparison against 'YYYY-MM-DD' display values. A due-today item is inside
 * the window and not overdue (equal instants are not strictly before).
 */
async function feeDueItems(collegeId: string, studentId: string, todayMidnight: Date, tz: string): Promise<AttentionItem[]> {
  const dues = await duesFor(collegeId, studentId);
  const todayMs = todayMidnight.getTime();
  const windowMaxMs = todayMs + FEE_WINDOW_DAYS * 86_400_000;
  return dues.invoices.flatMap((invoice) => {
    const next = nextInvoiceDue(invoice);
    const deadlineMs = new Date(next.date).getTime();
    const overdue = deadlineMs < todayMs; // strictly before start-of-today (R15)
    const within = deadlineMs >= todayMs && deadlineMs <= windowMaxMs;
    if (!overdue && !within) return [];
    const item: AttentionItem = {
      kind: 'fee_due', id: invoice.id, invoiceNumber: invoice.invoiceNumber,
      amount: next.amount, // integer paise (R1): forwarded from duesFor — do NOT call toPaise again
      dueDate: ymd(new Date(next.date), tz), // display 'YYYY-MM-DD' the app renders (R15) — never compared
      overdue, deadline: next.date, // college-tz-midnight ISO instant (R15), comparable with R14/R16
    };
    return [item];
  });
}

async function assessmentItems(collegeId: string, studentId: string, now: Date): Promise<AttentionItem[]> {
  const rows = await assessmentsFor(collegeId, studentId, now, new Date(now.getTime() + ASSESSMENT_WINDOW_MS));
  return rows.map((a) => ({ kind: 'assessment', id: a.id, courseCode: a.courseCode, title: a.title, at: a.at, channelId: a.channelId, deadline: a.at }));
}

/** §7.4 kinds=all: the ERP items for the viewer (R30: faculty get notices + class changes only). */
export async function attentionItems(ctx: MobileContext): Promise<AttentionItem[]> {
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const todayDate = ymd(now, tz);
  const changes = await classChangeItems(ctx.collegeId, ctx, todayDate, addDays(todayDate, 1), tz, now);
  const studentId = ctx.kind === 'student' ? ctx.studentId : undefined;
  if (!studentId) return changes;
  const [fees, assessments] = await Promise.all([
    feeDueItems(ctx.collegeId, studentId, instantOf(todayDate, '00:00', tz), tz),
    assessmentItems(ctx.collegeId, studentId, now),
  ]);
  return [...changes, ...fees, ...assessments];
}
```

In `backend/src/modules/juvi-app/notices/mobile-service.ts`:

Add imports (extend the existing schemas import; add the attention import):

```typescript
old: import { AttentionResponse, NoticeCard, NoticeDetail, NoticeListQuery, NoticeListResponse } from './schemas';
new: import { AttentionItem, AttentionResponse, NoticeCard, NoticeDetail, NoticeListQuery, NoticeListResponse } from './schemas';
import { attentionItems } from '../home/attention';
```

First the legacy `attention`'s return line: the widened `attentionItemSchema` requires `kind` on every item — legacy notice cards included, since `attentionAll` below composes these cards into the same `AttentionItem[]` — so its mapping gains an additive stamp. R21's shape is otherwise untouched (no cap change, no shuffle):

```typescript
old:   return { dueCount: due.length, items: due.slice(0, ATTENTION_ITEMS).map(({ notice, row }) => toCard(notice, row, ctx.userId)) };
new:   return { dueCount: due.length, items: due.slice(0, ATTENTION_ITEMS).map(({ notice, row }) => ({ kind: 'notice' as const, ...toCard(notice, row, ctx.userId) })) };
```

Then add after the `attention` function (its body stays exactly as it is):

```typescript
/** §7.4 kinds=all: every due notice card (uncapped), in loadDue order. */
export async function dueNoticeCards(ctx: MobileContext): Promise<NoticeCard[]> {
  const due = await loadDue(ctx);
  return due.map(({ notice, row }) => toCard(notice, row, ctx.userId));
}

/** deadline ascending; missing deadlines last; stable on ties (notice-first composition order). */
function byDeadline(a: AttentionItem, b: AttentionItem): number {
  const da = a.deadline;
  const db = b.deadline;
  if (da && db) return da === db ? 0 : da < db ? -1 : 1;
  if (da) return -1;
  if (db) return 1;
  return 0;
}

export async function attentionAll(ctx: MobileContext): Promise<AttentionResponse> {
  const [cards, erp] = await Promise.all([dueNoticeCards(ctx), attentionItems(ctx)]);
  const items: AttentionItem[] = [...cards.map((c) => ({ kind: 'notice' as const, ...c })), ...erp];
  items.sort(byDeadline);
  return { dueCount: items.length, items };
}
```

In `backend/src/modules/juvi-app/notices/mobile-controller.ts` REPLACE the `attention` handler with:

```typescript
export async function attention(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    // R31: a missing kinds returns the legacy shape; the only widened value is all.
    const kinds = req.query.kinds;
    if (kinds !== undefined && kinds !== 'all') throw new MobileApiError(400, 'VALIDATION_FAILED', 'kinds must be "all"');
    const ctx = requireMobile(req);
    res.json(kinds === 'all' ? await svc.attentionAll(ctx) : await svc.attention(ctx));
  } catch (e) { next(e); }
}
```

and add to its imports: `import { MobileApiError } from '../errors';`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/juvi-app/home/__tests__/attention-items.test.ts`
Expected: PASS (all 13).

- [ ] **Step 6: Write the wiring e2e and run it**

Create `backend/src/__e2e__/modules/juvi-attention.e2e.test.ts`:

```typescript
import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, signInAs } from '../factories/notice.factory';
import { Invoice } from '../../models/finance/Invoice';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';

process.env.E2E_TESTING = '1';

let app: Express;
let fx: BaseFixtures;

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

const V1 = '/api/juvi-app/v1';

describe('GET /v1/attention', () => {
  it('kinds=all carries fee_due items and counts every item', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    await Invoice.create({
      collegeId: new Types.ObjectId(fx.collegeId), studentId: new Types.ObjectId(String(s.student._id)),
      invoiceNumber: 'EAI-1', type: 'fee', totalAmount: 5000,
      dueDate: new Date(Date.now() + 3 * 86_400_000), status: 'sent',
    });
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/attention?kinds=all`).expect(200);
    expect(res.body.dueCount).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((i: { kind: string }) => i.kind === 'fee_due')).toBe(true);
  });

  it('without kinds the legacy shape is returned: notice cards only', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const notice = await Notice.create({
      collegeId: new Types.ObjectId(fx.collegeId), title: 'Library closes early', body: 'At 5pm on Friday.',
      publisher: { personId: new Types.ObjectId(String(s.person._id)), userId: new Types.ObjectId(String(s.account._id)), office: 'Library' },
      audience: { rules: [], line: 'Everyone' },
      ackRequired: true, status: 'published', publishedAt: new Date(),
    });
    await NoticeRecipient.create({
      collegeId: new Types.ObjectId(fx.collegeId), noticeId: notice._id, personId: new Types.ObjectId(String(s.person._id)),
      accountId: new Types.ObjectId(String(s.account._id)), kind: 'student', ackRequired: true, receivedAt: new Date(),
    });
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/attention`).expect(200);
    expect(res.body.items.every((i: { kind: string }) => i.kind === 'notice')).toBe(true);
    expect(res.body.items[0]).toHaveProperty('preview');
  });

  it('kinds other than all is 400 VALIDATION_FAILED (R31) and unauthenticated is 401', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/attention?kinds=fees`).expect(400);
    expect(res.body.error.message).toBe('kinds must be "all"');
    await mobileClient(app).get(`${V1}/attention?kinds=all`).expect(401);
  });
});
```

(The factories return Mongoose documents — every `_id` used above is `String(...)`-ed at use and collegeId is wrapped in `Types.ObjectId`.)

- [ ] **Step 7: Run the e2e + neighbours + typecheck**

Run: `npm run test:e2e -w backend -- src/__e2e__/modules/juvi-attention.e2e.test.ts`
Expected: PASS.

Run: `npm test -w backend -- --run src/modules/juvi-app src/modules/notices`
Expected: PASS — the widened schema compiles against the legacy `attention` function; readers, resolve-day, home-service suites stay green.

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/juvi-app/home/attention.ts backend/src/modules/juvi-app/notices/schemas.ts backend/src/modules/juvi-app/notices/mobile-service.ts backend/src/modules/juvi-app/notices/mobile-controller.ts backend/src/modules/juvi-app/home/__tests__/attention-items.test.ts backend/src/__e2e__/modules/juvi-attention.e2e.test.ts
git commit -m "feat(juvi): attention kinds=all - class changes, fee dues, assessments (§7.4)

kinds=all merges every due notice (uncapped) with the viewer's class
changes (original slot today/tomorrow, until the start passes, exception
id as the item id), open fee dues (next due within 7 days or overdue)
and assessments inside 48 hours; items order by deadline with missing
deadlines last and dueCount counts every item. Without the parameter the
legacy shape is byte-for-byte unchanged; only 'all' is accepted (400
otherwise). Faculty get notices + class changes only (R30)."
```
### Task 16: §8 class-change push — request consumer, audience expansion, tier, send-time re-check, payload

**Files:**
- Modify: `backend/src/models/juvi/NotificationDelivery.ts` (widen source type/kind and the cancellation reasons)
- Create: `backend/src/modules/juvi-app/notifications/class-change.ts` (request side)
- Modify: `backend/src/modules/juvi-app/notifications/expand-consumer.ts` (source union + `expandClassChange`)
- Modify: `backend/src/modules/juvi-app/notifications/sender.ts` (class-change dispatch + send-time re-check)
- Modify: `backend/src/modules/juvi-app/notifications/payload.ts` (`buildClassChangePush`)
- Modify: `backend/src/modules/juvi-app/notifications/events-service.ts` (4 new event names, §7.5)
- Modify: `backend/src/modules/juvi-app/notifications/index.ts` (register the consumer)
- Test: `backend/src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts` (unit, 9 tests)
- Test: `backend/src/__e2e__/modules/juvi-class-change-push.e2e.test.ts` (pipeline through the wired app)

**Interfaces:**
- Consumes:
  - `CLASS_EVENTS.CHANGED` (`'class.exception.changed'`) from `../../academics/class-exception-service` (Task 4). The emitted payload is `{ collegeId, exceptionId, action }` with `action: 'created' | 'revoked'`; it carries no actor — the actor is resolved from the exception's `createdBy`/`revokedBy`.
  - `emit`, `OutboxPayload` from `'../../../shared/outbox'`; `decide` from `./policy`; `NOTIFICATION_REQUESTED`, `settingsOf`, `mutedEverywhere` from `./expand-consumer` (the last two become exported in this task); `PushMessage` type from `./transport`; `signReceipt`, `RECEIPT_TTL_MS` from `./receipts`.
  - `instantOf(date: string, hhmm: string, timezone: string): Date`, `ymd(at: Date, timezone): string`, `addDays(date: string, n: number): string` from `'../../academics/timetable-date'` (Task 2).
  - `getJuviConfig` from `'../config/institution-config'` — timezone, with the module default `'Asia/Kolkata'` when unset.
  - Models: `ClassException`, `LeanClassException` from `'../../../models/academic-ops/ClassException'` (Task 1); `TimetableSlot` from `'../../../models/academic-ops/TimetableSlot'`; `CourseOffering`, `Course`, `Enrollment` from `'../../../models/academic-ops/'`; `JuviAccount`, `IAccountSettings`, `ELIGIBLE_STATUSES`, `Channel`, `ChannelMembership`, `MobileSession`, `NotificationDelivery`, `NotificationTier` from `'../../../models/juvi/'`.
- Produces (Task 17's payload contract and the Flutter push rendering rely on these):
  - `NotificationDelivery.source` gains `type: 'class_change'` (`id` = the exception id, `kind: 'created' | 'revoked'`); delivery reasons gain `'superseded'` and `'already_started'`.
  - Request dedupe key `notif:class_change:<exceptionId>:<action>`; row `batchKey = 'class'`, `groupKey = 'class:<offeringId>'`.
  - Variant mapping (R20): `created` + exception type `cancelled` → `'cancelled'`; `created` + type `rescheduled` → `'rescheduled'`; `revoked` (either exception type) → `'restored'`.
  - Push data keys: `{ deliveryId, receipt, kind: 'class_change', exceptionId, tier, groupKey, office: <course code>, variant, when, newWhen? }` — `when`/`newWhen` are ISO instants of the original/new class start (the device renders the weekday and clock time in its own timezone). The exception's reason is NEVER sent (NFR-05).
  - Tier (§8): a `created` request is urgent when the original class start is today in the college timezone and lies in the future within 2 hours of now; important otherwise. A `revoked` request is always important. Urgent bypasses tier toggles, mute and quiet hours (the existing `decide()` policy).
  - Affected dates (§8): the original `date`, and for a reschedule also `newDate` — under both actions.
  - Audience (§8): students enrolled in the offering + the slot's other teaching faculty (`offering.facultyId`, `coFacultyIds`, `slot.substituteFacultyId`, `slot.originalFacultyId`), minus the acting user (matched on `JuviAccount.userId` against the exception's `createdBy` for `created` and `revokedBy` for `revoked`), eligible accounts only (`onboarding`/`active`); accounts not on Juvi see nothing.
  - Send-time re-check: a row is cancelled as `superseded` when a `created` row's exception has since been revoked (or a `revoked` row's exception is active again, or the slot/offering no longer resolve) and as `already_started` once the original class start has passed.
  - `CLASS_CHANGE_EVENT` re-exported as the consumer registration key; `requestClassChangeNotification` re-exported from `./index`.
  - Events allow-list gains `timeline.class_opened`, `glance.opened`, `post_class_prompt.shown`, `post_class_prompt.opened` (§7.5).

- [ ] **Step 1: Widen the delivery model and add the payload builder**

In `backend/src/models/juvi/NotificationDelivery.ts`:

```
old:
export type DeliveryReason = 'muted' | 'tier_off' | 'no_device' | 'acknowledged' | 'dismissed' | 'archived';
export type NotificationSourceKind = 'published' | 'reminder-1' | 'reminder-2';
new:
/** `superseded` and `already_started` are class-change send-time cancellations (Today&Teaching §8). */
export type DeliveryReason = 'muted' | 'tier_off' | 'no_device' | 'acknowledged' | 'dismissed' | 'archived' | 'superseded' | 'already_started';
/** `created` and `revoked` are class-change notification kinds (Today&Teaching §8). */
export type NotificationSourceKind = 'published' | 'reminder-1' | 'reminder-2' | 'created' | 'revoked';
```

```
old:
export const DELIVERY_REASONS: readonly DeliveryReason[] = ['muted', 'tier_off', 'no_device', 'acknowledged', 'dismissed', 'archived'];
export const NOTIFICATION_SOURCE_KINDS: readonly NotificationSourceKind[] = ['published', 'reminder-1', 'reminder-2'];
new:
export const DELIVERY_REASONS: readonly DeliveryReason[] = ['muted', 'tier_off', 'no_device', 'acknowledged', 'dismissed', 'archived', 'superseded', 'already_started'];
export const NOTIFICATION_SOURCE_KINDS: readonly NotificationSourceKind[] = ['published', 'reminder-1', 'reminder-2', 'created', 'revoked'];
```

```
old:
/** Sub-project 5 adds `post` and `mention` to `type`. */
export interface INotificationSource { type: 'notice'; id: Types.ObjectId; kind: NotificationSourceKind }
new:
/** `class_change` (Today&Teaching §8): id is the exception id, kind is created|revoked. Sub-project 5 adds `post` and `mention` to `type`. */
export interface INotificationSource { type: 'notice' | 'class_change'; id: Types.ObjectId; kind: NotificationSourceKind }
```

```
old:
      type: { type: String, enum: ['notice'], required: true },
new:
      type: { type: String, enum: ['notice', 'class_change'], required: true },
```

The reason enum line already spreads `DELIVERY_REASONS` (`enum: [...DELIVERY_REASONS, null]`), so it needs no edit. The existing indexes need none either: the sender's scan (`status: 1, sendAfter: 1`), the urgent-first scan (`status: 1, tier: 1, sendAfter: 1`) and the expansion's uniqueness key (`source.type, source.id, source.kind, accountId`) all serve the new rows unchanged.

In `backend/src/modules/juvi-app/notifications/payload.ts` append:

```typescript
export interface ClassChangePushInput {
  deliveryId: string;
  receipt: string;
  exceptionId: string;
  tier: NotificationTier;
  groupKey: string;
  office: string;
  variant: 'cancelled' | 'rescheduled' | 'restored';
  /** The original class start as an ISO instant. */
  when: string;
  /** For a reschedule: the new class start as an ISO instant. */
  newWhen?: string;
}

/**
 * The §8 push (NFR-05). Only opaque ids, the course code as the office, the when
 * instants and the variant — the reason never goes out, and a restore announces
 * itself by the restored variant alone.
 */
export function buildClassChangePush(i: ClassChangePushInput): PushMessage {
  const data: Record<string, string> = {
    deliveryId: i.deliveryId, receipt: i.receipt, kind: 'class_change', exceptionId: i.exceptionId,
    tier: i.tier, groupKey: i.groupKey, office: i.office, variant: i.variant, when: i.when,
  };
  if (i.newWhen) data.newWhen = i.newWhen;
  return { data, priority: i.tier === 'routine' ? 'normal' : 'high', collapseKey: i.groupKey };
}
```

- [ ] **Step 2: Write the failing unit tests**

Create `backend/src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts`:

```typescript
// backend/src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts
// Today&Teaching §8: the class.exception.changed consumer, audience expansion,
// tier decision and send-time re-check.
//
// There is no College doc in this suite, so getJuviConfig falls back to the
// module default Asia/Kolkata — the fixed clocks are chosen in IST terms to pin
// the gate:
//   BASE  2026-11-10T04:00:00Z = 09:30 IST on Nov 10 (the normal case)
//   LATE  2026-11-09T20:00:00Z = 01:30 IST on Nov 10 (UTC is still on Nov 9: a
//         gate that reads the UTC day would miss IST-tomorrow Nov 11 — the RF#1 pin)
import { Types } from 'mongoose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { Channel, Course, CourseOffering, Enrollment, Faculty, Person, Student, TimetableSlot } from '../../../../models';
import { ClassException } from '../../../../models/academic-ops/ClassException';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { ChannelMembership } from '../../../../models/juvi/ChannelMembership';
import { NotificationDelivery } from '../../../../models/juvi/NotificationDelivery';
import { drainOutbox, emit } from '../../../../shared/outbox';
import type { PushTransport } from '../transport';
import { CLASS_CHANGE_EVENT } from '../class-change';
import { registerNotificationConsumers } from '../index';
import { runSender } from '../sender';

const BASE = new Date('2026-11-10T04:00:00.000Z');
const LATE = new Date('2026-11-09T20:00:00.000Z');
const istDate = (at: Date) => new Date(at.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const datePlus = (at: Date, days: number) => new Date(at.getTime() + days * 86_400_000);
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
const oid = () => new Types.ObjectId();
const tokenTransport: PushTransport = { name: 'fake', send: async (tokens) => tokens.map((token) => ({ token, ok: true })) };

let collegeId = new Types.ObjectId();
let seq = 0;

interface World {
  offeringId: string;
  slotId: string;
  /** The teaching faculty's account id and its userId — the actor-exclusion test's actor. */
  facultyAccountId: string;
  facultyAccountUserId: string;
  studentAccountIds: string[];
  channelId: string;
}

/** `toFake: ['Date']` only — faking Mongo driver timers would hang the suite. */
function useClock(at: Date): void {
  vi.useFakeTimers({ now: at, toFake: ['Date'], shouldAdvanceTime: true });
}

async function seedWorld(now: Date): Promise<World> {
  seq += 1;
  const s = seq;
  collegeId = new Types.ObjectId();
  const course = await Course.create({
    collegeId, code: `CS10${s}`, name: 'Object Oriented Programming',
    regulationId: oid(), departmentId: oid(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const fPerson = await Person.create({ collegeId, name: 'Prof. Push', phone: `90000${s}`, gender: 'male' });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FACPC${s}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: oid(), sectionId: oid(),
    facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 2, status: 'active',
  });
  const slot = await TimetableSlot.create({
    collegeId, timetableId: oid(), day: dow(istDate(now)), period: 2,
    startTime: '14:00', endTime: '15:00', slotType: 'lecture', courseOfferingId: offering._id,
  });
  const studentAccountIds: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const p = await Person.create({ collegeId, name: `Push Student ${i}`, phone: `91${s}${i}`, gender: 'female' });
    const st = await Student.create({ collegeId, personId: p._id, admissionYear: 2026, rollNumber: `26PC${s}${i}`, status: 'active', onboardingStatus: 'not_started' });
    await Enrollment.create({ collegeId, studentId: st._id, courseOfferingId: offering._id, semesterId: oid(), status: 'enrolled', enrolledAt: now });
    const acc = await JuviAccount.create({ collegeId, personId: p._id, userId: oid(), kind: 'student', studentId: st._id, status: 'active', provisionedBy: 'test' });
    studentAccountIds.push(String(acc._id));
  }
  const fAcc = await JuviAccount.create({ collegeId, personId: fPerson._id, userId: oid(), kind: 'faculty', facultyId: faculty._id, status: 'active', provisionedBy: 'test' });
  const channel = await Channel.create({ collegeId, name: `CS10${s}`, scopeType: 'course_offering', scopeId: offering._id, status: 'active' });
  return {
    offeringId: String(offering._id), slotId: String(slot._id),
    facultyAccountId: String(fAcc._id), facultyAccountUserId: String(fAcc.userId),
    studentAccountIds, channelId: String(channel._id),
  };
}

interface ExceptionPatch {
  date?: string;
  type?: 'cancelled' | 'rescheduled';
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  /** A slot id other than the world's main slot (e.g. the early-morning one). */
  slotId?: string;
  /** The acting user id (createdBy, or revokedBy when revoked) — that user's account must be excluded. */
  actorUserId?: string;
  revoked?: boolean;
}

/** A ClassException placed directly: the service's own validations are clock-relative, the tests set the clock. */
async function makeException(w: World, now: Date, patch: ExceptionPatch = {}): Promise<string> {
  const doc = await ClassException.create({
    collegeId,
    timetableSlotId: new Types.ObjectId(patch.slotId ?? w.slotId),
    courseOfferingId: new Types.ObjectId(w.offeringId),
    date: patch.date ?? istDate(now),
    type: patch.type ?? 'cancelled',
    ...(patch.newDate ? { newDate: patch.newDate, newStartTime: patch.newStartTime ?? '15:00', newEndTime: patch.newEndTime ?? '16:00' } : {}),
    reason: 'Venue flooded',
    createdBy: patch.actorUserId && !patch.revoked ? new Types.ObjectId(patch.actorUserId) : oid(),
    ...(patch.revoked ? { revokedAt: now, revokedBy: patch.actorUserId ? new Types.ObjectId(patch.actorUserId) : oid() } : {}),
  });
  return String(doc._id);
}

/** The event Task 4 emits, written through the real outbox and drained. */
async function pipeline(exceptionId: string, action: 'created' | 'revoked'): Promise<void> {
  await emit(CLASS_CHANGE_EVENT, { collegeId: collegeId.toString(), exceptionId, action }, `class-exception:${exceptionId}:${action}`);
  await drainOutbox();
}

const rowsFor = (exceptionId: string) =>
  NotificationDelivery.find({ collegeId, 'source.type': 'class_change', 'source.id': new Types.ObjectId(exceptionId) }).lean();

describe('class-change push (Today&Teaching §8)', () => {
  beforeAll(async () => {
    await setupMongo();
    registerNotificationConsumers();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await clearCollections();
  });
  afterAll(async () => { await teardownMongo(); });

  it('a created cancellation inside the window schedules one row per eligible account, dedupe held on re-drain', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE);
    await pipeline(exceptionId, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3); // two enrolled students + the teaching faculty
    expect(new Set(rows.map((r) => String(r.accountId))).size).toBe(3);
    expect(rows.every((r) => r.tier === 'important')).toBe(true); // the 14:00 start is ~4.5 h away (> 2 h)
    expect(rows.every((r) => r.status === 'scheduled' && r.reason === null)).toBe(true);
    expect(rows.every((r) => r.batchKey === 'class' && r.groupKey === `class:${w.offeringId}`)).toBe(true);
    await pipeline(exceptionId, 'created'); // the event's dedupe key: a re-drain writes nothing new
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(3);
  });

  it('an exception whose only affected date is beyond tomorrow schedules nothing', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { date: istDate(datePlus(BASE, 5)) });
    await pipeline(exceptionId, 'created');
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(0);
  });

  it('a reschedule is affected by either date — original today, new date beyond tomorrow still fires', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { type: 'rescheduled', newDate: istDate(datePlus(BASE, 5)) });
    await pipeline(exceptionId, 'created');
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(3);
  });

  it('the tier is urgent when the original start is today and within 2 hours, and urgent bypasses a channel mute', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    await ChannelMembership.create({ collegeId, channelId: new Types.ObjectId(w.channelId), accountId: new Types.ObjectId(w.studentAccountIds[0]!), mutedAt: BASE });
    const early = await TimetableSlot.create({
      collegeId, timetableId: oid(), day: dow(istDate(BASE)), period: 1,
      startTime: '10:30', endTime: '11:30', slotType: 'lecture', courseOfferingId: new Types.ObjectId(w.offeringId),
    });
    const exceptionId = await makeException(w, BASE, { slotId: String(early._id) }); // 10:30 IST = 05:00Z, 1 h after the clock
    await pipeline(exceptionId, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.tier === 'urgent')).toBe(true);
    expect(rows.find((r) => String(r.accountId) === w.studentAccountIds[0])!.status).toBe('scheduled');
  });

  it('the acting user\'s own account is excluded from the audience', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { actorUserId: w.facultyAccountUserId });
    await pipeline(exceptionId, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(2); // the students only
    expect(rows.some((r) => String(r.accountId) === w.facultyAccountId)).toBe(false);
  });

  it('a revoked change schedules important restored rows for the same audience', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { revoked: true });
    await pipeline(exceptionId, 'revoked');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source.kind === 'revoked' && r.tier === 'important' && r.status === 'scheduled')).toBe(true);
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(3);
  });

  it('the gate reads the college timezone, not UTC (RF#1)', async () => {
    useClock(LATE); // 01:30 IST Nov 10; UTC is still on Nov 9
    const w = await seedWorld(LATE);
    // Derivation: LATE = 2026-11-09T20:00Z → IST Nov 10 01:30. IST today =
    // '2026-11-10', IST tomorrow = '2026-11-11'; a naive-UTC gate would read
    // today '2026-11-09' and tomorrow '2026-11-10'.
    const istTomorrow = istDate(datePlus(LATE, 1));  // '2026-11-11': inside the IST window, outside the naive-UTC one
    const beyond = istDate(datePlus(LATE, 2));       // '2026-11-12': the first date outside the IST window
    const fires = await makeException(w, LATE, { date: istTomorrow });
    const silent = await makeException(w, LATE, { date: beyond });
    await pipeline(fires, 'created');
    await pipeline(silent, 'created');
    expect(await rowsFor(fires)).toHaveLength(3);    // IST-tomorrow fires; a UTC-reading gate would drop it
    expect(await rowsFor(silent)).toHaveLength(0);   // nothing outside the window, even at the +2d boundary
  });

  it('the sender cancels a created row as superseded once its exception is revoked', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE);
    await pipeline(exceptionId, 'created');
    await ClassException.updateOne({ _id: new Types.ObjectId(exceptionId) }, { $set: { revokedAt: new Date(), revokedBy: oid() } });
    await runSender(new Date(), tokenTransport);
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === 'cancelled' && r.reason === 'superseded')).toBe(true);
  });

  it('the sender cancels a row as already_started once the original start has passed', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const early = await TimetableSlot.create({
      collegeId, timetableId: oid(), day: dow(istDate(BASE)), period: 1,
      startTime: '09:00', endTime: '10:00', slotType: 'lecture', courseOfferingId: new Types.ObjectId(w.offeringId),
    });
    const exceptionId = await makeException(w, BASE, { slotId: String(early._id) }); // 09:00 IST = 03:30Z, before the clock
    await pipeline(exceptionId, 'created');
    await runSender(new Date(), tokenTransport);
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === 'cancelled' && r.reason === 'already_started')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts`
Expected: FAIL — `Cannot find module '../class-change'`.

- [ ] **Step 4: Write the implementation**

Create `backend/src/modules/juvi-app/notifications/class-change.ts`:

```typescript
// backend/src/modules/juvi-app/notifications/class-change.ts
/**
 * Today&Teaching §8 request side: the class.exception.changed consumer. It
 * decides whether the affected date (original, plus the new date of a
 * reschedule) is today or tomorrow in the college timezone, sets the tier
 * (urgent when the original start is today and within 2 hours) and records the
 * notification request. Audience expansion lives in expand-consumer.ts
 * (expandClassChange); the send-time re-check lives in sender.ts.
 */
import { Types } from 'mongoose';
import { ClassException, LeanClassException } from '../../../models/academic-ops/ClassException';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { NotificationTier } from '../../../models/juvi/NotificationDelivery';
import { emit, OutboxPayload } from '../../../shared/outbox';
import { addDays, instantOf, ymd } from '../../academics/timetable-date';
import { CLASS_EVENTS } from '../../academics/class-exception-service';
import { getJuviConfig } from '../config/institution-config';
import { NOTIFICATION_REQUESTED } from './expand-consumer';

export const CLASS_CHANGE_EVENT = CLASS_EVENTS.CHANGED; // 'class.exception.changed'

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const URGENT_WINDOW_MS = 2 * 3_600_000;

/**
 * The affected dates of an exception (§8): the original date, and for a
 * reschedule also the new date — under both announce and revoke.
 */
function affectedDates(e: LeanClassException): string[] {
  return e.type === 'rescheduled' && e.newDate ? [e.date, e.newDate] : [e.date];
}

/**
 * §8 tier, decided on announce: urgent when the original class start is today in
 * the college timezone and lies within 2 hours of now; important otherwise. A
 * revoke is always important.
 */
async function tierOf(collegeId: string, e: LeanClassException, tz: string): Promise<NotificationTier> {
  const todayDate = ymd(new Date(), tz);
  if (e.date !== todayDate) return 'important';
  const slot = await TimetableSlot.findOne({ _id: e.timetableSlotId, collegeId }).select('startTime').lean<{ startTime: string } | null>();
  if (!slot) return 'important';
  const delta = instantOf(e.date, slot.startTime, tz).getTime() - new Date().getTime();
  return delta > 0 && delta <= URGENT_WINDOW_MS ? 'urgent' : 'important';
}

/** Records notification.requested for a class change; idempotent on its dedupe key. */
export function requestClassChangeNotification(collegeId: string, exceptionId: string, action: 'created' | 'revoked', tier: NotificationTier): Promise<boolean> {
  const source = { type: 'class_change', id: exceptionId, kind: action, tier };
  return emit(NOTIFICATION_REQUESTED, { collegeId, source }, `notif:class_change:${exceptionId}:${action}`);
}

/** The consumer registered for class.exception.changed (Today&Teaching §8). */
export async function onClassChanged(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const exceptionId = typeof payload.exceptionId === 'string' ? payload.exceptionId : '';
  const action: 'created' | 'revoked' = payload.action === 'revoked' ? 'revoked' : 'created';
  if (!Types.ObjectId.isValid(exceptionId)) return;
  const e = await ClassException.findOne({ _id: exceptionId, collegeId }).lean<LeanClassException | null>();
  if (!e) return; // a re-run after a rollback: nothing to notify about
  const tz = (await getJuviConfig(collegeId))?.timezone ?? DEFAULT_TIMEZONE;
  const todayDate = ymd(new Date(), tz);
  const tomorrowDate = addDays(todayDate, 1);
  if (!affectedDates(e).some((d) => d === todayDate || d === tomorrowDate)) return;
  const tier = action === 'created' ? await tierOf(collegeId, e, tz) : 'important';
  await requestClassChangeNotification(collegeId, exceptionId, action, tier);
}
```

In `backend/src/modules/juvi-app/notifications/expand-consumer.ts`, split the source interface into the union:

```
old:
export interface NotificationSource { type: 'notice'; id: string; kind: NotificationSourceKind }
new:
export interface NoticeSource { type: 'notice'; id: string; kind: NotificationSourceKind }
/** Today&Teaching §8: the tier travels in the request, so expansion does not recompute it. */
export interface ClassChangeSource { type: 'class_change'; id: string; kind: 'created' | 'revoked'; tier: NotificationTier }
export type NotificationSource = NoticeSource | ClassChangeSource;
```

Export the two row-policy helpers `requestNoticeNotification` already sits beside:

```
old:
function settingsOf(s: IAccountSettings | undefined): PolicySettings {
new:
export function settingsOf(s: IAccountSettings | undefined): PolicySettings {
```

```
old:
async function mutedEverywhere(collegeId: string, accountIds: Types.ObjectId[], channelIds: Types.ObjectId[]): Promise<Set<string>> {
new:
export async function mutedEverywhere(collegeId: string, accountIds: Types.ObjectId[], channelIds: Types.ObjectId[]): Promise<Set<string>> {
```

Add imports (after the `./policy` import line — `decide`, `digestSendAfter` and `PolicySettings` all stay in use):

```typescript
import { ClassException, LeanClassException } from '../../../models/academic-ops/ClassException';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { Channel } from '../../../models/juvi/Channel';
import { ELIGIBLE_STATUSES } from '../../../models/juvi/JuviAccount'; // JuviAccount and IAccountSettings are already imported
```

Widen the consumer dispatch in `expandNotification`:

```
old:
  if (source?.type !== 'notice' || !Types.ObjectId.isValid(source.id)) return 0;
  const notice = await Notice.findOne({ _id: source.id, collegeId }).select('status priority publisher channelIds').lean<LeanNotice>();
new:
  if (!source || !Types.ObjectId.isValid(source.id)) return 0;
  if (source.type === 'class_change') return expandClassChange(payload, now);
  if (source.type !== 'notice') return 0;
  const notice = await Notice.findOne({ _id: source.id, collegeId }).select('status priority publisher channelIds').lean<LeanNotice>();
```

Append at the end of the file:

```typescript
/**
 * The teaching seats of the slot other than the acting user: the offering's
 * facultyId and coFacultyIds plus the slot's substitute and original faculty.
 */
function teachingFacultyOf(offering: { facultyId?: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null, slot: { substituteFacultyId?: Types.ObjectId; originalFacultyId?: Types.ObjectId } | null): Types.ObjectId[] {
  const ids = [offering?.facultyId, ...(offering?.coFacultyIds ?? []), slot?.substituteFacultyId, slot?.originalFacultyId]
    .filter((v): v is Types.ObjectId => Boolean(v));
  return [...new Set(ids.map(String))].map((v) => new Types.ObjectId(v));
}

/**
 * notification.requested → one NotificationDelivery row per account for a class
 * change (Today&Teaching §8). Audience: students enrolled in the offering plus
 * the slot's other teaching faculty, minus the acting user, eligible Juvi accounts
 * only. Mute matches the course channel; the tier carried by the request (urgent
 * for a just-announced same-day change) bypasses it inside decide(). Class-change
 * rows are never Routine, so no digest window applies.
 */
export async function expandClassChange(payload: OutboxPayload, now: Date = new Date()): Promise<number> {
  const collegeId = payload.collegeId;
  const source = payload.source as ClassChangeSource | undefined;
  const tier: NotificationTier = source && 'tier' in source && source.tier === 'urgent' ? 'urgent' : 'important';
  if (!source || source.type !== 'class_change' || !Types.ObjectId.isValid(source.id)) return 0;
  const exception = await ClassException.findOne({ _id: source.id, collegeId })
    .select('timetableSlotId courseOfferingId createdBy revokedBy')
    .lean<LeanClassException | null>();
  if (!exception) return 0;
  const [slot, offering, channel, cfg] = await Promise.all([
    TimetableSlot.findOne({ _id: exception.timetableSlotId, collegeId })
      .select('substituteFacultyId originalFacultyId')
      .lean<{ _id: Types.ObjectId; substituteFacultyId?: Types.ObjectId; originalFacultyId?: Types.ObjectId } | null>(),
    CourseOffering.findOne({ _id: exception.courseOfferingId, collegeId })
      .select('facultyId coFacultyIds')
      .lean<{ _id: Types.ObjectId; facultyId?: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null>(),
    Channel.findOne({ collegeId, scopeType: 'course_offering', scopeId: exception.courseOfferingId, status: 'active' })
      .select('_id').lean<{ _id: Types.ObjectId } | null>(),
    getJuviConfig(collegeId),
  ]);
  if (!offering) return 0;
  const timezone = cfg?.timezone ?? DEFAULT_TIMEZONE;
  const actorUserId = source.kind === 'created' ? exception.createdBy : exception.revokedBy;
  const [students, accounts] = await Promise.all([
    Enrollment.find({ collegeId, courseOfferingId: exception.courseOfferingId, status: 'enrolled' })
      .select('studentId').lean<{ studentId: Types.ObjectId }[]>(),
    JuviAccount.find({ collegeId, status: { $in: ELIGIBLE_STATUSES } })
      .select('userId studentId facultyId settings')
      .lean<{ _id: Types.ObjectId; userId: Types.ObjectId; studentId?: Types.ObjectId; facultyId?: Types.ObjectId; settings?: IAccountSettings }[]>(),
  ]);
  const studentIds = new Set(students.map((s) => String(s.studentId)));
  const facultyIds = new Set(teachingFacultyOf(offering, slot).map(String));
  const audience = accounts
    .filter((a) => (a.studentId && studentIds.has(String(a.studentId))) || (a.facultyId && facultyIds.has(String(a.facultyId))))
    .filter((a) => String(a.userId) !== String(actorUserId));
  if (audience.length === 0) return 0;
  const muted = await mutedEverywhere(collegeId, audience.map((a) => a._id), channel ? [channel._id] : []);
  const settingsBy = new Map(audience.map((a) => [String(a._id), settingsOf(a.settings)]));
  const groupKey = `class:${String(exception.courseOfferingId)}`;
  await NotificationDelivery.bulkWrite(audience.map((a) => {
    const id = String(a._id);
    const d = decide({ tier, settings: settingsBy.get(id) ?? settingsOf(undefined), mutedAllMatchingChannels: muted.has(id), now, collegeTimezone: timezone });
    const common = { tier, batchKey: 'class', groupKey, sentAt: null, deliveredAt: null, openedAt: null, attempts: 0, lastError: null, lockedUntil: null, createdAt: now, updatedAt: now };
    const row = d.status === 'suppressed'
      ? { ...common, status: 'suppressed' as const, reason: d.reason, sendAfter: now }
      : { ...common, status: 'scheduled' as const, reason: null, sendAfter: d.sendAfter };
    return {
      updateOne: {
        // `collegeId`, `source` and `accountId` are written from the filter on insert. No automatic timestamps: a re-run must not touch updatedAt.
        filter: { collegeId: new Types.ObjectId(collegeId), 'source.type': 'class_change', 'source.id': exception._id, 'source.kind': source.kind, accountId: a._id },
        update: { $setOnInsert: row },
        upsert: true,
        timestamps: false,
      },
    };
  }), { ordered: false });
  return audience.length;
}
```

In `backend/src/modules/juvi-app/notifications/sender.ts` extend the imports:

```
old:
import { NotificationDelivery, LeanNotificationDelivery, DeliveryReason } from '../../../models/juvi/NotificationDelivery';
new:
import { NotificationDelivery, LeanNotificationDelivery, DeliveryReason } from '../../../models/juvi/NotificationDelivery';
import { ClassException, LeanClassException } from '../../../models/academic-ops/ClassException';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Course } from '../../../models/academic-ops/Course';
import { getJuviConfig } from '../config/institution-config';
import { instantOf } from '../../academics/timetable-date';
```

```
old: import { buildNoticePush } from './payload';
new: import { buildNoticePush, buildClassChangePush } from './payload';
```

Dispatch at the top of `sendGroup`:

```
old:
async function sendGroup(primary: Row, transport: PushTransport, now: Date, clock: Clock, stats: SenderStats): Promise<void> {
  const rows = primary.tier === 'routine' ? [primary, ...(await claimDigest(primary, now, clock))] : [primary];
new:
async function sendGroup(primary: Row, transport: PushTransport, now: Date, clock: Clock, stats: SenderStats): Promise<void> {
  // A class-change row is never Routine, so it has no digest to gather — its own
  // group function re-checks the exception instead of the notice.
  if (primary.source.type === 'class_change') return sendClassChangeGroup(primary, transport, now, stats);
  const rows = primary.tier === 'routine' ? [primary, ...(await claimDigest(primary, now, clock))] : [primary];
```

Append after `sendGroup`:

```typescript
/** R20: created+cancelled → cancelled, created+rescheduled → rescheduled, revoked → restored. */
const variantOf = (kind: 'created' | 'revoked', type: 'cancelled' | 'rescheduled'): 'cancelled' | 'rescheduled' | 'restored' => (
  kind === 'revoked' ? 'restored' : type === 'cancelled' ? 'cancelled' : 'rescheduled'
);

/**
 * §8 send-time re-check before any device is touched: a created row whose
 * exception was revoked since (or a revoked row whose exception is active
 * again), or one whose slot or offering no longer resolves, is superseded; once
 * the original start has passed the row is already_started. Then one message to
 * the account's devices, dead-token pruning and back-off, exactly as sendGroup.
 */
async function sendClassChangeGroup(primary: Row, transport: PushTransport, now: Date, stats: SenderStats): Promise<void> {
  const kind = primary.source.kind as 'created' | 'revoked';
  const exception = await ClassException.findOne({ collegeId: primary.collegeId, _id: primary.source.id })
    .select('type date newDate newStartTime courseOfferingId timetableSlotId revokedAt')
    .lean<LeanClassException | null>();
  if (!exception || (kind === 'created' && exception.revokedAt) || (kind === 'revoked' && !exception.revokedAt)) {
    await settle([primary], { status: 'cancelled', reason: 'superseded' });
    stats.cancelled += 1;
    return;
  }
  const tz = (await getJuviConfig(String(primary.collegeId)))?.timezone ?? 'Asia/Kolkata';
  const slot = await TimetableSlot.findOne({ collegeId: primary.collegeId, _id: exception.timetableSlotId })
    .select('startTime').lean<{ _id: Types.ObjectId; startTime: string } | null>();
  if (!slot || instantOf(exception.date, slot.startTime, tz).getTime() <= now.getTime()) {
    await settle([primary], { status: 'cancelled', reason: !slot ? 'superseded' : 'already_started' });
    stats.cancelled += 1;
    return;
  }
  const offering = await CourseOffering.findOne({ collegeId: primary.collegeId, _id: exception.courseOfferingId })
    .select('courseId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId } | null>();
  if (!offering) {
    await settle([primary], { status: 'cancelled', reason: 'superseded' });
    stats.cancelled += 1;
    return;
  }
  const course = await Course.findOne({ _id: offering.courseId, collegeId: primary.collegeId }).select('code').lean<{ _id: Types.ObjectId; code: string } | null>();
  const sessions = await MobileSession.find({ collegeId: primary.collegeId, accountId: primary.accountId, revokedAt: null, refreshExpiresAt: { $gt: now }, pushToken: { $type: 'string' } })
    .select('pushToken').lean();
  const tokens = [...new Set(sessions.map((s) => s.pushToken!))];
  if (tokens.length === 0) {
    await settle([primary], { status: 'suppressed', reason: 'no_device' });
    stats.noDevice += 1;
    return;
  }
  const deliveryId = String(primary._id);
  const message = buildClassChangePush({
    deliveryId, receipt: signReceipt(deliveryId, new Date(now.getTime() + RECEIPT_TTL_MS)),
    exceptionId: String(primary.source.id), tier: primary.tier, groupKey: primary.groupKey,
    office: course?.code ?? '', variant: variantOf(kind, exception.type),
    when: instantOf(exception.date, slot.startTime, tz).toISOString(),
    ...(exception.newDate && exception.newStartTime ? { newWhen: instantOf(exception.newDate, exception.newStartTime, tz).toISOString() } : {}),
  });
  let results: PushResult[];
  try {
    results = await transport.send(tokens, message);
  } catch {
    results = tokens.map((token) => ({ token, ok: false, error: 'UNAVAILABLE' as const }));
  }
  const dead = results.filter((r) => !r.ok && r.error && TOKEN_ERRORS.has(r.error)).map((r) => r.token);
  if (dead.length > 0) await MobileSession.updateMany({ collegeId: primary.collegeId, pushToken: { $in: dead } }, { $unset: { pushToken: 1 } });
  if (results.some((r) => r.ok)) {
    await settle([primary], { status: 'sent', sentAt: now, lastError: null });
    stats.sent += 1;
    return;
  }
  const transient = results.find((r) => !r.ok && !(r.error && TOKEN_ERRORS.has(r.error)));
  if (!transient) {
    await settle([primary], { status: 'suppressed', reason: 'no_device' });
    stats.noDevice += 1;
    return;
  }
  const attempts = primary.attempts + 1;
  if (attempts >= MAX_SEND_ATTEMPTS) {
    await settle([primary], { status: 'failed', attempts, lastError: transient.error ?? 'UNKNOWN' });
    stats.failed += 1;
    return;
  }
  await settle([primary], { attempts, lastError: transient.error ?? 'UNKNOWN', sendAfter: new Date(now.getTime() + sendBackoffMs(attempts)) });
  stats.retried += 1;
}
```

In `backend/src/modules/juvi-app/notifications/index.ts`:

```
old:
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';
new:
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';
import { onClassChanged, CLASS_CHANGE_EVENT } from './class-change';
```

```
old:
export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';
new:
export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';
export { requestClassChangeNotification } from './class-change';
```

```
old:
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
new:
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
  registerConsumer(CLASS_CHANGE_EVENT, async (payload) => { await onClassChanged(payload); });
```

In `backend/src/modules/juvi-app/notifications/events-service.ts` (§7.5 — four new app events):

```
old:
  'notification.opened', 'notification.permission',
  'permission_card.shown', 'permission_card.dismissed',
] as const;
new:
  'notification.opened', 'notification.permission',
  'permission_card.shown', 'permission_card.dismissed',
  'timeline.class_opened', 'glance.opened',
  'post_class_prompt.shown', 'post_class_prompt.opened',
] as const;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w backend -- --run src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts`
Expected: PASS (all 9).

- [ ] **Step 6: Run the pipeline e2e**

Create `backend/src/__e2e__/modules/juvi-class-change-push.e2e.test.ts`. It drives outbox + sender directly (the consumers are registered by `getTestApp()` via the notifications routes) and creates exceptions directly, so the legs stay clock-independent:

```typescript
import { Types } from 'mongoose';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi } from '../factories/juvi.factory';
import { Channel, Course, CourseOffering, Enrollment, Faculty, Person, Student, TimetableSlot } from '../../models';
import { ClassException } from '../../models/academic-ops/ClassException';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { drainOutbox, emit } from '../../shared/outbox';
import { CLASS_CHANGE_EVENT } from '../../modules/juvi-app/notifications/class-change';
import { runSender } from '../../modules/juvi-app/notifications/sender';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';

process.env.E2E_TESTING = '1';

let app: Express;
let fx: BaseFixtures;
const fake = new FakePushTransport();

const oid = () => new Types.ObjectId();
const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

interface PushWorld {
  offeringId: string;
  slotId: string;
  facultyAccountId: string;
  facultyAccountUserId: string;
  studentAccountIds: string[];
  exceptionDate: string; // the date the legs' slots and exceptions are built on
}

/**
 * One offering with two enrolled students and one teaching faculty, all on Juvi,
 * a slot and its course channel. `offsetDays` places the slot's weekday and the
 * legs' exception date (0 = college-tz today, 1 = tomorrow; the send legs use 1
 * so the send-time re-check can never see a start that has already passed).
 */
async function seedPushWorld(offsetDays: number, startTime = '14:00'): Promise<PushWorld> {
  const collegeId = fx.collegeId;
  const course = await Course.create({
    collegeId, code: 'PJ201', name: 'Push Subject',
    regulationId: oid(), departmentId: oid(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const fPerson = await Person.create({ collegeId, name: 'Prof. Push', phone: '9100000001', gender: 'male' });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: 'FACPSH1',
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: oid(), sectionId: fx.cseSection._id,
    facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 2, status: 'active',
  });
  const exceptionDate = istDate(offsetDays);
  const slot = await TimetableSlot.create({
    collegeId, timetableId: oid(), day: dow(exceptionDate), period: 2,
    startTime, endTime: '15:00', slotType: 'lecture', courseOfferingId: offering._id,
  });
  const studentAccountIds: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const p = await Person.create({ collegeId, name: `Push Student ${i}`, phone: `910000001${i}`, gender: 'female' });
    const st = await Student.create({ collegeId, personId: p._id, admissionYear: 2026, rollNumber: `26PW${i}`, status: 'active', onboardingStatus: 'not_started' });
    await Enrollment.create({ collegeId, studentId: st._id, courseOfferingId: offering._id, semesterId: oid(), status: 'enrolled', enrolledAt: new Date() });
    const acc = await JuviAccount.create({ collegeId, personId: p._id, userId: oid(), kind: 'student', studentId: st._id, status: 'active', provisionedBy: 'test' });
    studentAccountIds.push(String(acc._id));
  }
  const fAcc = await JuviAccount.create({ collegeId, personId: fPerson._id, userId: oid(), kind: 'faculty', facultyId: faculty._id, status: 'active', provisionedBy: 'test' });
  await Channel.create({ collegeId, name: 'PJ201', scopeType: 'course_offering', scopeId: offering._id, status: 'active' });
  return {
    offeringId: String(offering._id), slotId: String(slot._id),
    facultyAccountId: String(fAcc._id), facultyAccountUserId: String(fAcc.userId),
    studentAccountIds, exceptionDate,
  };
}

async function deviceFor(accountId: string, userId: string, token: string): Promise<void> {
  await MobileSession.create({
    collegeId: fx.collegeId, accountId: new Types.ObjectId(accountId), userId: new Types.ObjectId(userId),
    deviceId: `dev-${token}`, deviceName: 'Test Phone', platform: 'android',
    appVersion: '1.0.0', osVersion: '14', refreshTokenHash: `rh-${token}`,
    refreshExpiresAt: new Date(Date.now() + 86_400_000), pushToken: token,
  });
}

/** A ClassException placed directly (clock-independent), then its event through the real outbox. */
async function classChange(w: PushWorld, action: 'created' | 'revoked', patch: Partial<{ date: string; type: string; actorUserId: string; revoked: boolean }> = {}): Promise<string> {
  const doc = await ClassException.create({
    collegeId: fx.collegeId,
    timetableSlotId: new Types.ObjectId(w.slotId),
    courseOfferingId: new Types.ObjectId(w.offeringId),
    date: patch.date ?? w.exceptionDate,
    type: patch.type ?? 'cancelled',
    ...(patch.type === 'rescheduled' ? { newDate: istDate(2), newStartTime: '15:00', newEndTime: '16:00' } : {}), // Task 1's pre-validate requires the new* trio on a reschedule
    reason: 'Venue flooded',
    createdBy: patch.actorUserId && !patch.revoked ? new Types.ObjectId(patch.actorUserId) : oid(),
    ...(patch.revoked ? { revokedAt: new Date(), revokedBy: oid() } : {}),
  });
  const exceptionId = String(doc._id);
  await emit(CLASS_CHANGE_EVENT, { collegeId: fx.collegeId, exceptionId, action }, `class-exception:${exceptionId}:${action}`);
  await drainOutbox();
  return exceptionId;
}

const rowsFor = (exceptionId: string) =>
  NotificationDelivery.find({ collegeId: fx.collegeId, 'source.type': 'class_change', 'source.id': new Types.ObjectId(exceptionId) }).lean();

describe('class_change push through the real pipeline (Today&Teaching §8)', () => {
  it('a created cancellation on a today date schedules a row per eligible account', async () => {
    const w = await seedPushWorld(0); // start 14:00 IST today: inside the gate, tier important (no device send here)
    const exceptionId = await classChange(w, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source.kind === 'created' && r.status === 'scheduled')).toBe(true);
    expect(rows.every((r) => r.groupKey === `class:${w.offeringId}` && r.batchKey === 'class')).toBe(true);
    await drainOutbox(); // a re-drain must not double-write
    expect(await NotificationDelivery.countDocuments({ collegeId: fx.collegeId, 'source.type': 'class_change' })).toBe(3);
  });

  it('a reschedule fires on either affected date; an exception beyond tomorrow never fires', async () => {
    const w = await seedPushWorld(5); // beyond the window...
    const beyond = await classChange(w, 'created', { date: istDate(5) });
    expect(await rowsFor(beyond)).toHaveLength(0);
    const rescheduled = await classChange(w, 'created', { date: istDate(0), type: 'rescheduled' }); // original today, new date istDate(2) — still fires
    expect(await rowsFor(rescheduled)).toHaveLength(3);
  });

  it('the send carries the §8 payload: variant, office, when, and never the reason (NFR-05)', async () => {
    const w = await seedPushWorld(1, '10:00'); // tomorrow 10:00 IST: always a future start at send time
    const exceptionId = await classChange(w, 'created');
    await deviceFor(w.studentAccountIds[0]!, oid().toString(), 'tok-c1');
    await deviceFor(w.studentAccountIds[1]!, oid().toString(), 'tok-c2');
    await NotificationDelivery.updateMany({ collegeId: fx.collegeId, 'source.type': 'class_change' }, { $set: { sendAfter: new Date(Date.now() - 1_000) } });
    await runSender(new Date(), fake);
    expect(fake.sent).toHaveLength(2);
    const { tokens, message } = fake.sent[0]!;
    expect(tokens.length).toBeGreaterThan(0);
    const row = (await rowsFor(exceptionId)).find((r) => message.data.deliveryId === String(r._id))!;
    expect(message).toMatchObject({
      data: {
        deliveryId: String(row._id), kind: 'class_change', exceptionId, tier: 'important',
        groupKey: `class:${w.offeringId}`, office: 'PJ201', variant: 'cancelled',
      },
      priority: 'high', collapseKey: `class:${w.offeringId}`,
    });
    expect(message.data.when).toBeTypeOf('string');
    expect(message.data.newWhen).toBeUndefined();        // a cancellation has no new date
    expect(JSON.stringify(fake.sent)).not.toContain('Venue flooded');
    expect(await rowsFor(exceptionId)).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'sent' })]));
  });

  it('a revoke sends restored and cancels the stale created rows as superseded (R20 + re-check)', async () => {
    const w = await seedPushWorld(1, '10:00');
    const exceptionId = await classChange(w, 'created');
    await ClassException.updateOne({ _id: new Types.ObjectId(exceptionId) }, { $set: { revokedAt: new Date(), revokedBy: oid() } });
    await classChange(w, 'revoked');
    await deviceFor(w.studentAccountIds[0]!, oid().toString(), 'tok-r1');
    await NotificationDelivery.updateMany({ collegeId: fx.collegeId, 'source.type': 'class_change' }, { $set: { sendAfter: new Date(Date.now() - 1_000) } });
    await runSender(new Date(), fake);
    expect(fake.sent.map((m) => m.message.data.variant)).toEqual(['restored']);
    const rows = await rowsFor(exceptionId);
    expect(rows.filter((r) => r.source.kind === 'created').every((r) => r.status === 'cancelled' && r.reason === 'superseded')).toBe(true);
  });

  it('the acting user\'s account is excluded', async () => {
    const w = await seedPushWorld(0);
    const exceptionId = await classChange(w, 'created', { actorUserId: w.facultyAccountUserId });
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => String(r.accountId) === w.facultyAccountId)).toBe(false);
  });
});
```

Note on the send legs' `deviceFor(..., oid().toString(), ...)`: the sessions belong to the students, and the actor in those legs is the anonymous `oid()` the helper wrote into `createdBy` — the students' accounts are therefore unaffected by the exclusion, as intended.

Run: `npm run test:e2e -w backend -- src/__e2e__/modules/juvi-class-change-push.e2e.test.ts`
Expected: PASS (5 legs).

- [ ] **Step 7: Run the neighbouring suites and typecheck**

Run: `npm test -w backend -- --run src/modules/juvi-app/notifications src/modules/academics`
Expected: PASS — the widened enums keep the existing notice suites green.

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/models/juvi/NotificationDelivery.ts backend/src/modules/juvi-app/notifications/class-change.ts backend/src/modules/juvi-app/notifications/expand-consumer.ts backend/src/modules/juvi-app/notifications/sender.ts backend/src/modules/juvi-app/notifications/payload.ts backend/src/modules/juvi-app/notifications/events-service.ts backend/src/modules/juvi-app/notifications/index.ts backend/src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts backend/src/__e2e__/modules/juvi-class-change-push.e2e.test.ts
git commit -m "feat(juvi): class-change push (§8) - gate, audience, tier, re-check, payload

class.exception.changed requests a notification only when the affected
date (original, or new for a reschedule - either date) is today or
tomorrow in the COLLEGE timezone (RF#1); the tier is urgent when the
original start is today and within 2 hours, and urgent bypasses mute and
quiet hours. Expansion writes one row per eligible account - enrolled
students plus the slot's other teaching faculty minus the acting user -
with dedupe notif:class_change:<id>:<kind> and groupKey class:<offeringId>.
The sender re-checks: superseded on revoke or unresolvable slot/offering,
already_started on a past start. The payload carries variant cancelled |
rescheduled | restored plus the when instants; the reason never goes out
(NFR-05). The events allow-list gains the four new app events (§7.5)."
```
### Task 17: OpenAPI contract for the v1 surfaces; regenerate `mobile/api/openapi.json` and the Dart client (§7.5)

**Files:**
- Create: `backend/src/modules/juvi-app/home/schemas.ts`
- Modify: `backend/src/modules/juvi-app/openapi/document.ts` (imports, component registrations, route defs)
- Modify: `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts` (the contract's failing tests + the regenerated-JSON match test)
- Generated and committed: `mobile/api/openapi.json`, `mobile/packages/juvi_api/**` (whole regenerated Dart client directory)

**Interfaces:**
- Consumes:
  - `attentionItemSchema`, `attentionResponseSchema` from `'../../notices/schemas'` (Task 15 — the widened flat `AttentionItem` with kinds `'notice' | 'class_change' | 'fee_due' | 'assessment'`).
  - The service response shapes (hand-mirrored into Zod; the mirror must stay in lockstep — Task 19's parity e2e pins the runtime shapes against the live endpoints):
    - `dayClassSchema` mirroring `DayClass` (Task 12), `dayViewSchema` mirroring `DayView` (Task 12).
    - `todaySchema` mirroring `TodayResponse`, `teachingSchema` mirroring `TeachingResponse` (Task 14).
    - `studentAcademicsSchema` mirroring `StudentAcademics` (Task 14 wrapping Task 13's `JuviAttendance`), `studentDuesSchema` mirroring `StudentDues`, `dueInvoiceItemSchema` mirroring `DueInvoiceItem`, `coursesTaughtItemSchema` mirroring `CoursesTaughtItem` (Task 14).
- Produces:
  - Registered components so the Dart classes are stable: `AttentionItem`, `Attention` (rebuilt so `items` `$ref`s `AttentionItem`), `DayClass`, `DayView` (rebuilt so `classes` `$ref`s `DayClass`), `Today` and `Teaching` (rebuilt so both days `$ref` `DayView`), `DueInvoiceItem`, `StudentDues` (rebuilt so `invoices` `$ref`s `DueInvoiceItem`), `StudentAcademics`, `CoursesTaughtItem`, `FacultyCourses` (`{ coursesTaught: CoursesTaughtItem[] }`), `MeAcademics` (`z.union([StudentAcademics, FacultyCourses])` → `anyOf`/`oneOf` of the two arm components).
  - Route defs: `getToday` `GET /today`, `getTeaching` `GET /teaching`, `getMeAcademics` `GET /me/academics` (all `auth: true`, `errors: [401, 403]`), and the widened `getAttention` def with a `kinds` query (`z.literal('all')` optional, `errors: [400, 401]`).
  - A regenerated `mobile/api/openapi.json` (byte-identical to `stableStringify(buildOpenApiDocument()) + '\n'`, which the existing match test enforces) and regenerated `mobile/packages/juvi_api` with `MobileApi.getToday()` / `getTeaching()` / `getMeAcademics()`.
- Backend does NOT touch deep links: the allow-list regex (`_allowed` in `mobile/lib/app/deep_link_resolver.dart`) and any new Flutter route resolver are the Flutter sub-project's deliverable; the backend's contribution is the push payload `kind` (already emitted by Task 16's payload builder).

- [ ] **Step 1: Write the failing contract tests**

In `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`, make three edits.

Edit 1 — extend the declared path set:

```typescript
old:   '/me/devices/current/push-token', '/notifications/receipts', '/events',
new:   '/me/devices/current/push-token', '/notifications/receipts', '/events',
       '/today', '/teaching', '/me/academics',
```

Edit 2 — extend the component-name list (the comparison sorts both sides, so list order is irrelevant):

```typescript
old:    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'AckRequest', 'AckResult', 'Attention', 'ChangePasswordRequest', 'ChannelDetail', 'Config', 'Devices', 'DismissResult',
      'ErrorEnvelope', 'EventsRequest', 'EventsResult', 'InstitutionLookup', 'Me', 'MuteResult', 'NoticeAttachment', 'NoticeAttachmentUrl', 'NoticeCard',
      'NoticeDetail', 'NoticeList', 'NoticePending', 'NoticeReach', 'NoticeReminders', 'OnboardingAdvance', 'OnboardingState',
      'PendingPerson', 'PhotoResult', 'PushTokenRequest', 'ReachComment', 'ReachGroup', 'ReachPerson', 'ReadResult', 'ReceiptsRequest', 'ReceiptsResult',
      'RefreshRequest', 'RemindResult', 'RevokedCount', 'SeenResult', 'SettingsPatch', 'Settings', 'SignInRequest', 'SignInResponse', 'Spaces', 'Tokens',
    ].sort());
new:    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'AckRequest', 'AckResult', 'Attention', 'AttentionItem', 'ChangePasswordRequest', 'ChannelDetail', 'Config',
      'CoursesTaughtItem', 'DayClass', 'DayView', 'Devices', 'DismissResult', 'DueInvoiceItem', 'ErrorEnvelope', 'EventsRequest', 'EventsResult',
      'FacultyCourses', 'InstitutionLookup', 'Me', 'MeAcademics', 'MuteResult', 'NoticeAttachment', 'NoticeAttachmentUrl', 'NoticeCard',
      'NoticeDetail', 'NoticeList', 'NoticePending', 'NoticeReach', 'NoticeReminders', 'OnboardingAdvance', 'OnboardingState',
      'PendingPerson', 'PhotoResult', 'PushTokenRequest', 'ReachComment', 'ReachGroup', 'ReachPerson', 'ReadResult', 'ReceiptsRequest', 'ReceiptsResult',
      'RefreshRequest', 'RemindResult', 'RevokedCount', 'SeenResult', 'SettingsPatch', 'Settings', 'SignInRequest', 'SignInResponse', 'Spaces',
      'StudentAcademics', 'StudentDues', 'Teaching', 'Today', 'Tokens',
    ].sort());
```

Edit 3 — insert two its in front of the `stableStringify` it (the anchor line stays at the bottom of the new text):

```typescript
  it('names the Today, Teaching and MeAcademics endpoints (§7.1-§7.3)', () => {
    expect(doc.paths['/today'].get.operationId).toBe('getToday');
    expect(doc.paths['/teaching'].get.operationId).toBe('getTeaching');
    expect(doc.paths['/me/academics'].get.operationId).toBe('getMeAcademics');
    expect(doc.paths['/today'].get.responses['403']).toBeDefined();
    expect(doc.components.schemas.Today.properties.glance).toBeDefined();
    const refTargets = JSON.stringify(doc.components.schemas.MeAcademics);
    expect(refTargets).toContain('#/components/schemas/StudentAcademics');
    expect(refTargets).toContain('#/components/schemas/FacultyCourses');
  });

  it('documents attention kinds=all and the timeline event names (§7.4, §7.5)', () => {
    expect(doc.paths['/attention'].get.parameters?.map((p: { name: string }) => p.name)).toContain('kinds');
    expect(doc.components.schemas.EventsRequest.properties.events.items.properties.name.enum).toEqual(
      expect.arrayContaining(['timeline.class_opened', 'glance.opened', 'post_class_prompt.shown', 'post_class_prompt.opened']),
    );
  });

  it('stableStringify orders keys so the file is deterministic', () => {
```

(The `EventsRequest` enum assertion reads the allow-list from `documentedEventSchema` → `eventItemSchema`, whose `name` is `z.enum(EVENT_NAMES)` — Task 16 already widened `EVENT_NAMES` with the four timeline names, so the regenerated document carries them. The `MeAcademics` assertion string-matches `#/components/schemas/...` targets rather than pinning `anyOf` vs `oneOf`, because that choice belongs to the generator, not the contract.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w backend -- --run src/modules/juvi-app/openapi/__tests__/document.test.ts`
Expected: FAIL — `declares every v1 route and nothing else` (missing paths), `names every component and operation` (missing components), both new `it`s fail on `doc.paths['/today']` being undefined, and the committed-openapi.json match test fails because `mobile/api/openapi.json` still lacks the paths.

- [ ] **Step 3: Create the wire schema module**

Create `backend/src/modules/juvi-app/home/schemas.ts`:

```typescript
/**
 * §7.1–§7.3 wire schemas for the Today / Teaching / me-academics endpoints.
 * Hand mirror of the service types in ./service (Task 14) and ./readers
 * (Task 13) — keep field names in lockstep. Objects are never null
 * (Foundation rulings R57/R61): an absent block is `.optional()` (omitted),
 * a nullable value is a scalar with `.nullable()`.
 */
import { z } from 'zod';

export const dayClassSchema = z.object({
  offeringId: z.string(),
  courseCode: z.string(),
  title: z.string(),
  section: z.string(),
  /** College-timezone HH:MM. */
  start: z.string(),
  end: z.string(),
  slotType: z.string(),
  status: z.enum(['cancelled', 'rescheduled', 'scheduled']),
  room: z.string().optional(),
  faculty: z.string().optional(),
  channelId: z.string().optional(),
  /** Faculty viewers only: enrolled head-count on the offering. */
  registered: z.number().int().optional(),
  /** Present when status is rescheduled: the original date + start (§7.1). */
  movedFrom: z.object({ date: z.string(), start: z.string() }).optional(),
});

export const dayViewSchema = z.object({
  date: z.string(),
  /** Title of the published holiday covering this date. */
  holiday: z.string().optional(),
  classes: z.array(dayClassSchema),
});

export const todaySchema = z.object({
  asOf: z.string(),
  today: dayViewSchema,
  tomorrow: dayViewSchema,
  glance: z.object({
    attendance: z.object({
      available: z.boolean(),
      /** Omitted when no attendance has been recorded (held = 0 → null upstream). */
      overallPct: z.number().optional(),
      threshold: z.number(),
      belowThreshold: z.boolean(),
    }),
    dues: z.object({
      available: z.boolean(),
      totalOutstanding: z.number().int(), // integer paise (R1)
      /** Omitted when there are no open invoices. Amount is integer paise (R1); the date is a college-tz-midnight ISO instant, not 'YYYY-MM-DD' (R15). */
      nextDue: z.object({ amount: z.number().int(), date: z.string() }).optional(),
    }),
    /** First scheduled assessment within 14 days (Assumption A5); omitted when none. */
    nextAssessment: z.object({
      offeringId: z.string(),
      courseCode: z.string(),
      title: z.string(),
      at: z.string(),
      channelId: z.string().optional(),
    }).optional(),
  }),
});

export const teachingSchema = z.object({
  asOf: z.string(),
  today: dayViewSchema,
  tomorrow: dayViewSchema,
  /** Next day with classes, scanning strictly after the date, ≤ 14 days; omitted when none. */
  nextTeachingDay: dayViewSchema.optional(),
  faculty: z.object({ kind: z.enum(['regular', 'hod', 'adjunct']) }),
});

export const dueInvoiceItemSchema = z.object({
  number: z.string(),
  type: z.string(),
  outstanding: z.number().int(), // integer paise (R1)
  nextDue: z.object({ amount: z.number().int(), date: z.string() }), // amount: integer paise (R1); date: college-tz-midnight ISO instant (R15)
  overdue: z.boolean(),
});

export const studentDuesSchema = z.object({
  available: z.boolean(),
  totalOutstanding: z.number().int(), // integer paise (R1)
  invoices: z.array(dueInvoiceItemSchema),
  lastPayment: z.object({ amount: z.number().int(), date: z.string() }).optional(),
  /** Present only when the college's juvi.paymentPortalUrl is configured (Task 9). */
  payUrl: z.string().optional(),
});

export const studentAcademicsSchema = z.object({
  attendance: z.object({
    available: z.boolean(),
    threshold: z.number(),
    showHeadroom: z.boolean(),
    /** §7.3 nests the overall; pct is a nullable scalar (Foundation R57/R61), null exactly when held is 0 (R13). */
    overall: z.object({ held: z.number(), attended: z.number(), pct: z.number().nullable() }),
    courses: z.array(z.object({
      offeringId: z.string(),
      courseCode: z.string(),
      title: z.string(),
      held: z.number(),
      attended: z.number(),
      pct: z.number().nullable(),
      headroom: z.number(),
      channelId: z.string().optional(), // R42: no per-course threshold — §7.3 names it once, at the attendance top level
    })),
  }),
  dues: studentDuesSchema,
});

export const coursesTaughtItemSchema = z.object({
  offeringId: z.string(),
  courseCode: z.string(),
  title: z.string(),
  section: z.string(),
  channelId: z.string().optional(),
});

export const meAcademicsSchema = z.union([
  studentAcademicsSchema,
  z.object({ coursesTaught: z.array(coursesTaughtItemSchema) }),
]);
```

- [ ] **Step 4: Register the components and routes in `document.ts`**

Edit 1 — imports. In the notices import list add `attentionItemSchema`:

```typescript
old:  noticeAttachmentSchema, noticeCardSchema, noticeDetailSchema, attentionResponseSchema, noticeListQuerySchema, noticeListResponseSchema,
new:  noticeAttachmentSchema, noticeCardSchema, noticeDetailSchema, attentionItemSchema, attentionResponseSchema, noticeListQuerySchema, noticeListResponseSchema,
```

and add the home schemas import immediately under the spaces import:

```typescript
old: import { spacesResponseSchema, channelDetailSchema, muteResponseSchema, readResponseSchema } from '../spaces/schemas';
new: import { spacesResponseSchema, channelDetailSchema, muteResponseSchema, readResponseSchema } from '../spaces/schemas';
import {
  coursesTaughtItemSchema, dayClassSchema, dayViewSchema, dueInvoiceItemSchema,
  meAcademicsSchema, studentAcademicsSchema, studentDuesSchema, teachingSchema, todaySchema,
} from '../home/schemas';
```

Edit 2 — component registrations. Insert before the `// Every schema is a named component` comment (directly under the existing `const NoticeCardComponent = registry.register('NoticeCard', noticeCardSchema);` block):

```typescript
  // §7.1–§7.4: item schemas are registered first; every consumer of them re-registers
  // with the registered component in place of the raw nested schema — same pattern as
  // ChannelDetail's rebuild below, since zod-to-openapi only $refs the instance that
  // `.register()` returned, never a plain equal-valued schema.
  const AttentionItemComponent = registry.register('AttentionItem', attentionItemSchema);
  const Attention = registry.register('Attention', z.object({ ...attentionResponseSchema.shape, items: z.array(AttentionItemComponent) }));
  const DayClassComponent = registry.register('DayClass', dayClassSchema);
  const DayView = registry.register('DayView', z.object({ ...dayViewSchema.shape, classes: z.array(DayClassComponent) }));
  const DueInvoiceItemComponent = registry.register('DueInvoiceItem', dueInvoiceItemSchema);
  const StudentDues = registry.register('StudentDues', z.object({ ...studentDuesSchema.shape, invoices: z.array(DueInvoiceItemComponent) }));
  const StudentAcademics = registry.register('StudentAcademics', z.object({ ...studentAcademicsSchema.shape, dues: StudentDues }));
  const CoursesTaughtItemComponent = registry.register('CoursesTaughtItem', coursesTaughtItemSchema);
  const FacultyCourses = registry.register('FacultyCourses', z.object({ coursesTaught: z.array(CoursesTaughtItemComponent) }));
  const MeAcademics = registry.register('MeAcademics', z.union([StudentAcademics, FacultyCourses]));
  const Today = registry.register('Today', z.object({ ...todaySchema.shape, today: DayView, tomorrow: DayView }));
  const Teaching = registry.register('Teaching', z.object({ ...teachingSchema.shape, today: DayView, tomorrow: DayView }));
```

Edit 3 — replace the `Attention` entry in `const C = { … }` and add the new responses:

```typescript
old:    Attention: registry.register('Attention', attentionResponseSchema),
new:    Attention,
    AttentionItem: AttentionItemComponent,
    CoursesTaughtItem: CoursesTaughtItemComponent,
    DayClass: DayClassComponent,
    DayView,
    DueInvoiceItem: DueInvoiceItemComponent,
    FacultyCourses,
    MeAcademics,
    StudentAcademics,
    StudentDues,
    Teaching,
    Today,
```

Edit 4 — routes. Replace the `getAttention` route def and append the three new defs right after it:

```typescript
old:    { operationId: 'getAttention', method: 'get', path: '/attention', summary: 'Due acknowledgement notices: count and the first three', auth: true, response: C.Attention, errors: [401] },
new:    { operationId: 'getAttention', method: 'get', path: '/attention', summary: 'Due items: the notice stack, or every attention item with kinds=all', auth: true, query: z.object({ kinds: z.literal('all').optional() }), response: C.Attention, errors: [400, 401] },
    { operationId: 'getToday', method: 'get', path: '/today', summary: 'Student today: today + tomorrow class lists and the glance', auth: true, response: C.Today, errors: [401, 403] },
    { operationId: 'getTeaching', method: 'get', path: '/teaching', summary: 'Faculty today: today + tomorrow classes, next teaching day, faculty kind', auth: true, response: C.Teaching, errors: [401, 403] },
    { operationId: 'getMeAcademics', method: 'get', path: '/me/academics', summary: 'Attendance and dues (student) or courses taught (faculty)', auth: true, response: C.MeAcademics, errors: [401, 403] },
```

(`R31` still enforces that anything other than `all` is a 400 `VALIDATION_FAILED` at the controller — the contract documents the one widened value.)

- [ ] **Step 5: Regenerate the committed document**

Run: `npm run openapi:mobile -w backend`
Expected: exits 0 and rewrites `mobile/api/openapi.json`. `git diff --stat -- mobile/api/openapi.json` shows: 3 new `/paths/today`, `/paths/teaching`, `/paths/me~1academics` (path keys are escaped); new components `AttentionItem DayClass DayView DueInvoiceItem CoursesTaughtItem FacultyCourses MeAcademics StudentAcademics StudentDues Today Teaching`; `EventsRequest` carrying the four new event names.

- [ ] **Step 6: Enforce the null-object guard and regenerate the Dart client**

Run: `node mobile/tool/check_nullable_objects.js mobile/api/openapi.json`
Expected: exits 0 — nothing is object-or-null (`overallPct`/`pct` are scalar unions with `null`; `movedFrom`, `glance`, `nextDue`, `lastPayment`, `payUrl`, `nextTeachingDay` are optional objects, present-or-omitted, never null).

Then regenerate the client:

```bash
java -version
# Must print 17 or higher. Java 17+ is a hard precondition of dart-dio generation;
# if the toolchain is older, do not fake it — report the version and stop this task.
cd mobile
./tool/gen_api.sh
cd ..
```

Expected: the guard inside `gen_api.sh` re-passes, `openapi-generator-cli dart-dio` regenerates `mobile/packages/juvi_api`, perl-fixes the pubspec, `dart pub get` + `build_runner build` succeed, `flutter pub get` succeeds. `git status` then shows `mobile/packages/juvi_api` changed; CI fails if the committed directory differs from a regeneration, so the regenerated output is committed in the next step. (The allow-list regex and the new Flutter routes are the Flutter sub-project's work; nothing else under `mobile/lib` changes here.)

- [ ] **Step 7: Run the contract tests + typecheck**

Run: `npm test -w backend -- --run src/modules/juvi-app/openapi/__tests__/document.test.ts`
Expected: PASS (all 10) — the two new its pass, `declares every v1 route` passes, and the committed-JSON match test passes against the regenerated file.

Run: `npm run typecheck -w backend`
Expected: PASS with 0 errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/juvi-app/home/schemas.ts backend/src/modules/juvi-app/openapi/document.ts backend/src/modules/juvi-app/openapi/__tests__/document.test.ts mobile/api/openapi.json mobile/packages/juvi_api
git commit -m "feat(juvi): contract for today, teaching, me/academics and attention kinds=all (§7.5)

home/schemas.ts mirrors the reader/service wire shapes; document.ts
registers AttentionItem, DayClass, DayView, Today, Teaching, StudentDues,
StudentAcademics, DueInvoiceItem, CoursesTaughtItem, FacultyCourses and
MeAcademics so the Dart names are stable, documents the kinds=all query
(only widening value: all) and the three new endpoints. openapi.json and
the juvi_api Dart client are regenerated in the same commit."
```

### Task 18: Dev seed for Today & Teaching — live-window timetables, 8-week attendance, holiday, cancellation, open dues, scheduled assessment (§10)

**Files:**
- Modify: `backend/src/seed.ts` (imports, deletion block, timetable re-dating, slot widening, attendance replacement, and one "Today & Teaching demo" block in the Juvi tail)
- Temporary verification script (created, run, then deleted — never committed): `backend/tmp-seed-check.ts`

Verified facts this task builds on (all in `backend/src/seed.ts`): `CID` at L121 is the dev college; the giant deletion `Promise.all` wipes CID-scoped data (Timetable L323, TimetableSlot L324, AttendanceSession L311, AttendanceRecord L312, InternalAssessment L313, Invoice+Payment L153-154 …) but currently contains **no `ClassException` and no `AcademicCalendar` deletion**; the demo timetable rows (L2280-2284) carry a stale `effectiveFrom: new Date('2025-01-10')`; AttendanceSession demo rows (L2295-2299) set `totalPresent`/`totalAbsent`, which are NOT AttendanceSession model fields (Mongoose strict mode silently drops them — the rewrite drops them deliberately); `courseOfferings[0]` = sections[0] (CSE-A) taught by `faculties[0]` (FAC001, the demo faculty), `courseOfferings[1]` = sections[0] taught by `faculties[3]`; `demoStudent` (L3212) is the lowest-rollNumber **active** student — with the current data that is `students[6]` (`21B01A0301`), who has **no** enrollment today; `demoFaculty` (L3213) is faculties[0]; the admin user `admin@jit.edu.in` (L562) is created without a capture; invoices `INV-2024-001`…`INV-2024-004` are already in use (unique `(collegeId, invoiceNumber)`); `seed.ts` line 1 is `// @ts-nocheck`, so the block reads freely. There is **no** e2e-seed addition: the backend e2e harness (`provisionTestStudent` / `provisionTestFaculty` factories) plus per-test model creates already provide everything the e2e suites build, so `seed-e2e-users.ts` stays untouched (spec §10 "e2e seed = minimum for tests" — the minimum is already there).

**Interfaces:**
- Consumes: `ClassException`, `AcademicCalendar` from the models barrel (`./models`) — `AcademicCalendar` already on it (L49 of `models/index.ts`), `ClassException` added there by Task 1's barrel export; `ymd`, `addDays` from `./modules/academics/timetable-date` (Task 2, pure); `User` (already imported at L99 of seed.ts); in-scope seed constants `persons`, `students`, `faculties`, `sections`, `rooms`, `courseOfferings`, `sem2_24`, `ay2024`, `CID`.
- Produces: a dev database in which the seeded demo sign-in (`JIT` / lowest-rollNumber student `21B01A0301` / `FAC001` faculty, temporary password `river-lamp-482`) sees, through the Task 12-16 readers: a published live timetable covering Monday–Saturday for the demo student's section and the demo faculty's offerings; ~8 weeks of closed attendance with the demo student below threshold on courseOfferings[0] (~67% → `at_risk` band) and above on courseOfferings[1] (~95% → `safe`); a published holiday covering tomorrow (which the demo student's resolveDay turns into `{ holiday, classes: [] }`); a cancelled class dated tomorrow (ClassException, created by the JIT admin, reason ERP-only); an open invoice `JUVI-DEMO-001` with a PaymentPlan instalment due in 5 days (dues + fee_due attention); a scheduled internal assessment ~36 h out (glance nextAssessment + 48 h attention window).

- [ ] **Step 1: Write the seed-verification script (failing)**

Create `backend/tmp-seed-check.ts`:

```typescript
/**
 * Throwaway verification for the Today & Teaching dev-seed additions (§10).
 * Run from backend/: node -r ts-node/register/transpile-only -r dotenv/config tmp-seed-check.ts
 * Deleted before commit.
 */
import mongoose from 'mongoose';
import 'dotenv/config';
import { assert } from 'node:assert';

import { AcademicCalendar, AttendanceRecord, AttendanceSession, ClassException, InternalAssessment, Invoice, PaymentPlan, Student, Timetable, TimetableSlot } from './src/models';
import { resolveDay } from './src/modules/juvi-app/home/resolve-day';

const CID = '000000000000000000000001';
const collegeId = new mongoose.Types.ObjectId(CID);
const SEED_TZ = 'Asia/Kolkata';

const tomorrowDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: SEED_TZ }).format(new Date(Date.now() + 86_400_000));

async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/juvion_v2');
  const now = new Date();
  const [published, slotCount, closedSessions, records, exception, holiday, invoice, plan, scheduled] = await Promise.all([
    Timetable.countDocuments({ collegeId, status: 'published', effectiveFrom: { $lte: now } }),
    TimetableSlot.countDocuments({ collegeId }),
    AttendanceSession.countDocuments({ collegeId, status: 'closed', date: { $gte: new Date(Date.now() - 62 * 86_400_000) } }),
    AttendanceRecord.countDocuments({ collegeId }),
    ClassException.findOne({ collegeId, revokedAt: null, date: tomorrowDate() }).lean<{ type: string; reason: string } | null>(),
    AcademicCalendar.findOne({ collegeId, status: 'published', isHoliday: true, startDate: { $lte: new Date(`${tomorrowDate()}T23:59:59Z`) }, endDate: { $gte: new Date(`${tomorrowDate()}T00:00:00Z`) } }).lean<{ title: string } | null>(),
    Invoice.findOne({ collegeId, invoiceNumber: 'JUVI-DEMO-001', status: 'sent' }).lean<{ _id: mongoose.Types.ObjectId } | null>(),
    planQuery(),
    InternalAssessment.findOne({ collegeId, status: 'scheduled', date: { $gte: now, $lte: new Date(Date.now() + 40 * 3600 * 1000) } }).lean<{ name: string } | null>(),
  ]);
  async function planQuery() {
    const inv = await Invoice.findOne({ collegeId, invoiceNumber: 'JUVI-DEMO-001' }).lean<{ _id: mongoose.Types.ObjectId } | null>();
    if (!inv) throw new Error('check-seed: JUVI-DEMO-001 missing');
    return PaymentPlan.findOne({ collegeId, invoiceId: inv._id }).lean<{ installments: { dueDate: Date; amount: number; status: string }[] } | null>();
  }

  assert(published >= 3, `check-seed: expected ≥3 published live timetables, got ${published}`);
  assert(slotCount >= 20, `check-seed: expected ≥20 timetable slots (Mon–Sat × 2 offerings + CSE-B + ECE), got ${slotCount}`);
  assert(closedSessions >= 40, `check-seed: expected ≥40 closed sessions in the last 8+ weeks, got ${closedSessions}`);
  assert(records >= 80, `check-seed: expected ≥80 attendance records, got ${records}`);
  assert(exception?.type === 'cancelled', `check-seed: no cancelled ClassException dated ${tomorrowDate()}: ${String(exception)}`);
  assert(exception.reason.includes('Demo'), 'check-seed: exception reason missing');
  assert(holiday?.title === 'Demo College Holiday', `check-seed: no published holiday covering ${tomorrowDate()}: ${String(holiday)}`);
  assert(invoice, 'check-seed: open invoice JUVI-DEMO-001 missing');
  const first = plan?.installments[0];
  assert(plan?.installments.length === 2, 'check-seed: payment plan must carry 2 instalments');
  assert(first && Math.abs(first.dueDate.valueOf() - (Date.now() + 5 * 86_400_000)) < 86_400_000, `check-seed: first instalment is not within a day of 5 days out: ${String(first?.dueDate)}`);
  assert(scheduled?.name === 'Mid-2 Examination', `check-seed: no scheduled assessment inside 40 h: ${String(scheduled)}`);

  // The demo student's Tomorrow view must show the holiday, and the reader must exist on this database.
  const demoStudentId = String((await Student.findOne({ collegeId, rollNumber: '21B01A0301' }))!._id);
  const day = await resolveDay(String(CID), { kind: 'student', studentId: demoStudentId }, tomorrowDate(), SEED_TZ);
  assert(day.holiday === 'Demo College Holiday', `check-seed: student tomorrow view should carry the holiday, got ${day.holiday}`);
  console.log('check-seed: all assertions passed');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Then delete the mis-drawn first header block (the file contains only ONE import header — the second version). Run it:

Run: `cd backend && node -r ts-node/register/transpile-only -r dotenv/config tmp-seed-check.ts; cd ..`
Expected: FAIL — `check-seed: expected ≥3 published live timetables, got 2`… actually the exact first failure depends on the current dev DB state: the published-timetable count may already be 2 (stale window) or 0; whichever assertion fails first must be a **row-count/absence** failure (≥3 timetables, ≥20 slots, ≥40 sessions, ≥80 records, or one of the "missing" assertions). If the first run instead passes everything, the dev DB already contains the rows — stop, report it, and re-run after `npm run seed -w backend` resets to the pre-change baseline only if that pre-change seed still lacks the additions.

- [ ] **Step 2: Seed.ts edits — imports and deletion block** (idempotency: no second-run unique clashes)

Edit 1 — the Academic Ops line of the giant `./models` import:

```typescript
old:  ElectiveAllocation, LessonPlan, CourseFeedback, Timetable, TimetableSlot,
new:  ElectiveAllocation, LessonPlan, CourseFeedback, Timetable, TimetableSlot,
  ClassException, AcademicCalendar,
```

Edit 2 — add a `ymd`/`addDays` import under the channel-templates import:

```typescript
old: import { seedChannelTemplates } from './shared/seed/channel-templates';
new: import { seedChannelTemplates } from './shared/seed/channel-templates';
import { addDays, ymd } from './modules/academics/timetable-date';
```

Edit 3 — the deletion block gains the two models (after the TimetableSlot line):

```typescript
old:    Timetable.deleteMany({ collegeId: CID }),
    TimetableSlot.deleteMany({ collegeId: CID }),
new:    Timetable.deleteMany({ collegeId: CID }),
    TimetableSlot.deleteMany({ collegeId: CID }),
    ClassException.deleteMany({ collegeId: CID }),
    AcademicCalendar.deleteMany({ collegeId: CID }),
```

- [ ] **Step 3: Seed.ts edits — live-window timetables, Mon–Sat slots, attendance rewrite**

Edit 4 — re-date the demo timetables and add the CSE-B one (both stale `2025-01-10` windows go live-window, 60 days back, no effectiveTo = open-ended):

```typescript
old:  const timetables = await Timetable.create([
    { collegeId: CID, semesterId: sem2_24._id, sectionId: sections[0]._id, version: 1, status: 'published', effectiveFrom: new Date('2025-01-10') },
    { collegeId: CID, semesterId: sem2_24._id, sectionId: sections[2]._id, version: 1, status: 'published', effectiveFrom: new Date('2025-01-10') },
  ]);
  console.log('Timetables created');
new:  // §10: live-window timetables (published, effectiveFrom ≤ now, no effectiveTo) so the
  // Today/Teaching readers resolve them for the demo student's section (CSE-A), the demo
  // faculty's offering (CSE-B, FAC001) and the ECE-A section that already had slots.
  const timetables = await Timetable.create([
    { collegeId: CID, semesterId: sem2_24._id, sectionId: sections[0]._id, version: 1, status: 'published', effectiveFrom: new Date(Date.now() - 60 * 86_400_000) },
    { collegeId: CID, semesterId: sem2_24._id, sectionId: sections[2]._id, version: 1, status: 'published', effectiveFrom: new Date(Date.now() - 60 * 86_400_000) },
    { collegeId: CID, semesterId: sem2_24._id, sectionId: sections[1]._id, version: 1, status: 'published', effectiveFrom: new Date(Date.now() - 60 * 86_400_000) },
  ]);
  console.log('Timetables created');
```

Edit 5 — widen the slots to Monday–Saturday and bind the array (both demo worlds get a full week):

```typescript
old:  await TimetableSlot.create([
    { collegeId: CID, timetableId: timetables[0]._id, day: 'monday', period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: courseOfferings[0]._id, roomId: rooms[0]._id, slotType: 'lecture' },
    { collegeId: CID, timetableId: timetables[0]._id, day: 'monday', period: 2, startTime: '10:00', endTime: '11:00', courseOfferingId: courseOfferings[1]._id, roomId: rooms[0]._id, slotType: 'lecture' },
    { collegeId: CID, timetableId: timetables[0]._id, day: 'tuesday', period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: courseOfferings[0]._id, roomId: rooms[0]._id, slotType: 'lecture' },
    { collegeId: CID, timetableId: timetables[0]._id, day: 'wednesday', period: 3, startTime: '11:00', endTime: '13:00', courseOfferingId: courseOfferings[3]._id, roomId: rooms[2]._id, slotType: 'lab' },
    { collegeId: CID, timetableId: timetables[1]._id, day: 'monday', period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: courseOfferings[4]._id, roomId: rooms[6]._id, slotType: 'lecture' },
  ]);
  console.log('TimetableSlots created');
new:  const ttSlots = await TimetableSlot.create([
    // CSE-A (timetables[0]): period 1 = offerings[0] (demo faculty + demo student's course), period 2 = offerings[1] — Mon–Sat
    ...(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const).flatMap((day) => [
      { collegeId: CID, timetableId: timetables[0]._id, day, period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: courseOfferings[0]._id, roomId: rooms[0]._id, slotType: 'lecture' },
      { collegeId: CID, timetableId: timetables[0]._id, day, period: 2, startTime: '10:00', endTime: '11:00', courseOfferingId: courseOfferings[1]._id, roomId: rooms[0]._id, slotType: 'lecture' },
    ]),
    // CSE-B (timetables[2]): period 1 = offerings[2], taught by the demo faculty FAC001 — Mon–Sat
    ...(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const).map((day) => ({
      collegeId: CID, timetableId: timetables[2]._id, day, period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: courseOfferings[2]._id, roomId: rooms[2]._id, slotType: 'lecture',
    })),
    // ECE-A (timetables[1]) keeps its lab + Monday lecture
    { collegeId: CID, timetableId: timetables[1]._id, day: 'wednesday', period: 3, startTime: '11:00', endTime: '13:00', courseOfferingId: courseOfferings[3]._id, roomId: rooms[2]._id, slotType: 'lab' },
    { collegeId: CID, timetableId: timetables[1]._id, day: 'monday', period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: courseOfferings[4]._id, roomId: rooms[6]._id, slotType: 'lecture' },
  ]);
  console.log('TimetableSlots created');
```

Edit 6 — remove the stale 3-session/6-record attendance block (rewritten in the demo block below; the `totalPresent`/`totalAbsent` keys are not model fields and the March-2025 dates are outside any live window):

```typescript
old:  const attendanceSessions = await AttendanceSession.create([
    { collegeId: CID, courseOfferingId: courseOfferings[0]._id, date: new Date('2025-03-10'), period: 1, facultyId: faculties[0]._id, status: 'closed', totalPresent: 50, totalAbsent: 5 },
    { collegeId: CID, courseOfferingId: courseOfferings[1]._id, date: new Date('2025-03-10'), period: 2, facultyId: faculties[3]._id, status: 'closed', totalPresent: 52, totalAbsent: 6 },
    { collegeId: CID, courseOfferingId: courseOfferings[0]._id, date: new Date('2025-03-11'), period: 1, facultyId: faculties[0]._id, status: 'closed', totalPresent: 48, totalAbsent: 7 },
  ]);
  console.log('AttendanceSessions created');

  await AttendanceRecord.create([
    { collegeId: CID, sessionId: attendanceSessions[0]._id, studentId: students[0]._id, status: 'present', markedBy: persons[10]._id },
    { collegeId: CID, sessionId: attendanceSessions[0]._id, studentId: students[1]._id, status: 'present', markedBy: persons[10]._id },
    { collegeId: CID, sessionId: attendanceSessions[1]._id, studentId: students[0]._id, status: 'present', markedBy: persons[13]._id },
    { collegeId: CID, sessionId: attendanceSessions[1]._id, studentId: students[7]._id, status: 'absent', markedBy: persons[13]._id },
    { collegeId: CID, sessionId: attendanceSessions[2]._id, studentId: students[0]._id, status: 'late', markedBy: persons[10]._id },
    { collegeId: CID, sessionId: attendanceSessions[2]._id, studentId: students[1]._id, status: 'absent', markedBy: persons[10]._id },
  ]);
  console.log('AttendanceRecords created');

new:  (delete the whole block — nothing replaces it here; the Today & Teaching demo block below owns all attendance)
```

- [ ] **Step 4: The "Today & Teaching demo" block in the Juvi tail**

Insert after the `demoFaculty` provisionPerson line and **before** `const juviSummary = await reconcileCollege(String(CID));`:

```typescript
  // ========================================================================
  // TODAY & TEACHING demo (spec §10) — live readers for the demo sign-in
  // ========================================================================
  if (demoStudent && demoFaculty) {
    const adminUser = await User.findOne({ collegeId: CID, email: 'admin@jit.edu.in' });
    const todayDate = ymd(new Date(), 'Asia/Kolkata');
    const tomorrowDate = addDays(todayDate, 1);
    const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

    // The demo student (lowest rollNumber = 21B01A0301) has no enrollment in the
    // generic rows above — enrol them into the two CSE-A offerings the timetable covers.
    await Enrollment.create([
      { collegeId: CID, studentId: demoStudent._id, courseOfferingId: courseOfferings[0]._id, semesterId: sem2_24._id, status: 'enrolled' },
      { collegeId: CID, studentId: demoStudent._id, courseOfferingId: courseOfferings[1]._id, semesterId: sem2_24._id, status: 'enrolled' },
    ]);
    await Section.updateOne({ _id: courseOfferings[0].sectionId }, { $addToSet: { studentIds: demoStudent._id } });

    // ~8 weeks of closed sessions (Mon–Sat), the demo student below threshold on
    // courseOfferings[0] (~67% → at_risk at T=75) and above on courseOfferings[1] (~95% → safe).
    const markerFor: Record<string, mongoose.Types.ObjectId> = {
      [String(courseOfferings[0]._id)]: persons[10]._id,
      [String(courseOfferings[1]._id)]: persons[13]._id,
    };
    const sessionDocs = [];
    for (let back = 8; back <= 60; back++) {
      const d = new Date(Date.now() - back * 86_400_000);
      if (d.getUTCDay() === 0) continue; // Sundays: Mon–Sat weeks
      sessionDocs.push(
        { collegeId: CID, courseOfferingId: courseOfferings[0]._id, date: d, period: 1, facultyId: courseOfferings[0].facultyId, status: 'closed' },
        { collegeId: CID, courseOfferingId: courseOfferings[1]._id, date: d, period: 2, facultyId: courseOfferings[1].facultyId, status: 'closed' },
      );
    }
    const createdSessions = await AttendanceSession.create(sessionDocs);
    const markedFor: Record<string, number> = {
      [String(courseOfferings[0]._id)]: 0,
      [String(courseOfferings[1]._id)]: 0,
    };
    const recordDocs = [];
    for (const session of createdSessions) {
      const key = String(session.courseOfferingId);
      const order = markedFor[key] ?? 0;
      markedFor[key] = order + 1;
      recordDocs.push({
        collegeId: CID, sessionId: session._id, studentId: demoStudent._id,
        status: key === String(courseOfferings[0]._id) ? (order % 3 === 0 ? 'absent' : 'present') : (order % 12 === 0 ? 'absent' : 'present'),
        markedBy: markerFor[key],
      });
    }
    await AttendanceRecord.create(recordDocs);

    // Published holiday covering tomorrow (§10) — Task 12's holidayCovering window.
    await AcademicCalendar.create({
      collegeId: CID, academicYearId: ay2024._id, title: 'Demo College Holiday',
      eventType: 'holiday', startDate: new Date(`${tomorrowDate}T00:00:00Z`), endDate: new Date(`${tomorrowDate}T00:00:00Z`),
      isHoliday: true, status: 'published',
    });

    // A cancellation dated tomorrow, on the demo student's first course
    // (skipped gracefully when tomorrow is a Sunday — no weekday slot exists).
    const cancelledSlot = ttSlots.find(
      (s) => s.day === dow(tomorrowDate) && String(s.courseOfferingId) === String(courseOfferings[0]._id),
    );
    if (adminUser && cancelledSlot) {
      await ClassException.create({
        collegeId: CID, timetableSlotId: cancelledSlot._id, courseOfferingId: cancelledSlot.courseOfferingId,
        date: tomorrowDate, type: 'cancelled',
        reason: 'Demo seeded cancellation for the Today timeline', createdBy: adminUser._id,
      });
    }

    // Open invoice with a plan instalment due in 5 days (dues + fee_due attention).
    const demoInvoice = await Invoice.create({
      collegeId: CID, studentId: demoStudent._id, invoiceNumber: 'JUVI-DEMO-001', type: 'fee',
      totalAmount: 43500, dueDate: new Date(Date.now() + 30 * 86_400_000), status: 'sent',
    });
    await PaymentPlan.create({
      collegeId: CID, studentId: demoStudent._id, invoiceId: demoInvoice._id,
      totalAmount: 43500, status: 'active',
      installments: [
        { dueDate: new Date(Date.now() + 5 * 86_400_000), amount: 21750, status: 'pending' },
        { dueDate: new Date(Date.now() + 35 * 86_400_000), amount: 21750, status: 'pending' },
      ],
    });

    // Scheduled internal assessment ~36 h out (glance nextAssessment, 48 h attention window).
    await InternalAssessment.create({
      collegeId: CID, courseOfferingId: courseOfferings[0]._id, name: 'Mid-2 Examination', type: 'mid2',
      maxMarks: 30, weightage: 15, date: new Date(Date.now() + 36 * 60 * 60 * 1000), status: 'scheduled',
    });

    console.log('Today & Teaching demo created (enrolments, 8-week attendance, holiday, cancellation, open dues, scheduled assessment)');
  }
```

(The `dow` helper indexes the Sunday-first `DOW` array directly with `getUTCDay()` — Sunday is 0, matching the array's first element — so `dow(tomorrowDate)` names the weekday-key used by TimetableSlot. `persons[10]`/`persons[13]` are faculties[0]/faculties[3]'s persons, the offering faculty for courseOfferings[0]/[1].)

- [ ] **Step 5: Run the seed twice (idempotency proof)**

Run: `npm run seed -w backend` — twice in a row.
Expected: BOTH runs exit 0; each prints (among the existing lines) `Timetables created`, `TimetableSlots created`, `Today & Teaching demo created (enrolments, 8-week attendance, holiday, cancellation, open dues, scheduled assessment)`, the `Juvi: …` summary, `Juvi demo sign-in — institution code JIT; student 21B01A0301 / faculty FAC001; …`, and `Seed complete!`. The second run must not fail on any unique-index clash (its own deletion block now covers `ClassException` and `AcademicCalendar`).

- [ ] **Step 6: Re-run the verification script, then delete it**

Run: `cd backend && node -r ts-node/register/transpile-only -r dotenv/config tmp-seed-check.ts; cd ..`
Expected: `check-seed: all assertions passed` — including the reader-level assertion that the demo student's tomorrow view carries the holiday.

Then: `rm backend/tmp-seed-check.ts` and run `npm run typecheck -w backend`
Expected: typecheck PASS with 0 errors; `git status` shows only `backend/src/seed.ts` modified (the temp script was never committed).

- [ ] **Step 7: Commit**

```bash
git add backend/src/seed.ts
git commit -m "feat(juvi): dev seed for Today & Teaching (§10)

Re-dates the demo timetables into the live window and widens CSE-A/CSE-B
slots to Mon-Sat; enrols and marks the lowest-rollNumber demo student over
~8 weeks (Compiler Design below threshold, ML safe); seeds a published
holiday covering tomorrow, a cancelled ClassException dated tomorrow (JIT
admin, ERP-only reason), the open invoice JUVI-DEMO-001 with a PaymentPlan
instalment due in 5 days, and a scheduled internal assessment ~36h out.
Deletion block covers ClassException + AcademicCalendar for idempotency."
```

### Task 19: ERP↔Juvi parity e2e — one change, one surface; full verification gates (§11)

**Files:**
- Test: `backend/src/__e2e__/modules/juvi-erp-parity.e2e.test.ts`

**Interfaces:**
- Consumes:
  - ERP side (Task 7): `POST /api/academics/class-exceptions` (body `{ timetableSlotId, date, type, reason }`); `DELETE /api/academics/class-exceptions/:id` (revokes, returns the row).
  - Juvi side (Tasks 14-16): `GET /api/juvi-app/v1/today`, `GET /api/juvi-app/v1/attention?kinds=all`, `GET /api/juvi-app/v1/me/academics` with the mobile session from `signInAs`/`mobileClient`.
  - Harness: `getTestApp`/`cleanupTestApp`, `seedBase` (`fx.sem1` is the active semester), `createTestApi`/`TestApi` from `'../helpers/request'`, `createTestCourse`/`createTestCourseOffering`/`createTestFaculty` from `'../factories/academic.factory'`, `enableJuvi`/`provisionTestStudent`/`mobileClient` from `'../factories/juvi.factory'`, `activateAccount`/`signInAs` from `'../factories/notice.factory'`, models direct-path imported per the 2-up depth of `__e2e__/modules/`.
- Produces: the closing proof that the ERP write side and the Juvi read side share ONE truth — a class cancelled in the ERP appears as `cancelled` on the student's `/today` and as a `class_change` attention item (id = the exception's `_id`), restores on revoke, an invoice becomes a `fee_due` attention item and a dues invoice, and a scheduled assessment becomes the glance `nextAssessment` and an `assessment` attention item.

- [ ] **Step 1: Write the parity suite**

Create `backend/src/__e2e__/modules/juvi-erp-parity.e2e.test.ts`:

```typescript
// ERP↔Juvi parity (§11): the ERP write surface and the Juvi read surface share one truth.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestCourse, createTestCourseOffering, createTestFaculty } from '../factories/academic.factory';
import { enableJuvi, mobileClient, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, signInAs } from '../factories/notice.factory';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { InternalAssessment } from '../../models/academic-ops/InternalAssessment';
import { Timetable, TimetableSlot } from '../../models';
import { Invoice } from '../../models/finance/Invoice';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/academics';
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const tomorrowDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000));
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** One offering taught to fx.cseSection, one live timetable, and one slot dated tomorrow. */
async function parityWorld() {
  const studentFixture = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(studentFixture.account._id));
  const studentToken = await signInAs(app, fx, studentFixture.student.rollNumber, studentFixture.tempPassword);
  const course = await createTestCourse(fx.collegeId, {
    regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CSX01',
  });
  const faculty = (await createTestFaculty(fx.collegeId, { name: 'Prof. Parity' }));
  const offering = await createTestCourseOffering(fx.collegeId, {
    courseId: String(course._id), semesterId: String(fx.sem1._id),
    sectionId: String(fx.cseSection._id), facultyId: String(faculty.faculty._id),
  });
  const tomorrow = tomorrowDate();
  const tt = await Timetable.create({
    collegeId: fx.collegeId, semesterId: fx.sem1._id, sectionId: fx.cseSection._id,
    version: 1, status: 'published', effectiveFrom: new Date(Date.now() - 86_400_000),
  });
  const slot = await TimetableSlot.create({
    collegeId: fx.collegeId, timetableId: tt._id, day: dow(tomorrow), period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id,
  });
  await Enrollment.create({
    collegeId: fx.collegeId, studentId: String(studentFixture.student._id),
    courseOfferingId: String(offering._id), semesterId: String(fx.sem1._id), status: 'enrolled',
  });
  return { studentFixture, studentToken, offering, slot, tomorrow };
}

describe('ERP ↔ Juvi parity (§11)', () => {
  it('a class cancelled in the ERP is cancelled on /v1/today and a class_change attention item; revoke restores it', async () => {
    const w = await parityWorld();

    const before = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    expect(before.body.tomorrow.classes.find((c: { offeringId: string }) => c.offeringId === String(w.offering._id))?.status).toBe('scheduled');

    const created = await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send({ timetableSlotId: String(w.slot._id), date: w.tomorrow, type: 'cancelled', reason: 'Parity check: workshop day' })
      .expect(201);

    const after = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    const cancelled = after.body.tomorrow.classes.find((c: { offeringId: string }) => c.offeringId === String(w.offering._id));
    expect(cancelled?.status).toBe('cancelled');

    const attention = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    const item = attention.body.items.find((i: { kind: string }) => i.kind === 'class_change');
    expect(item?.id).toBe(String(created.body._id));
    expect(item?.type).toBe('cancelled');
    expect(item?.courseCode).toBe('CSX01');
    expect(item?.date).toBe(w.tomorrow);

    await api.as(fx.admin.token).delete(`${A}/class-exceptions/${String(created.body._id)}`).expect(200);
    const restored = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    expect(restored.body.tomorrow.classes.find((c: { offeringId: string }) => c.offeringId === String(w.offering._id))?.status).toBe('scheduled');
    const attentionAfter = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    expect(attentionAfter.body.items.some((i: { kind: string; id: string }) => i.kind === 'class_change' && i.id === String(created.body._id))).toBe(false);
  });

  it('an open invoice is a fee_due attention item and a dues row on me/academics', async () => {
    const w = await parityWorld();
    const invoice = await Invoice.create({
      collegeId: fx.collegeId, studentId: String(w.studentFixture.student._id),
      invoiceNumber: 'JUVI-PARITY-1', type: 'fee', totalAmount: 15000,
      dueDate: new Date(Date.now() + 86_400_000), status: 'sent',
    });
    const attention = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    const fee = attention.body.items.find((i: { kind: string }) => i.kind === 'fee_due');
    expect(fee?.invoiceNumber).toBe('JUVI-PARITY-1');
    expect(fee?.id).toBe(String(invoice._id));
    expect(fee?.overdue).toBe(false);
    expect(fee?.amount).toBe(1500000); // 15000 ₹ in paise (R1)
    const academics = await mobileClient(app, w.studentToken).get(`${V1}/me/academics`).expect(200);
    expect(academics.body.dues.invoices.map((i: { number: string }) => i.number)).toContain('JUVI-PARITY-1');
    expect(academics.body.dues.totalOutstanding).toBe(1500000); // 15000 ₹ in paise (R1)
  });

  it('a scheduled assessment is the glance nextAssessment and an assessment attention item', async () => {
    const w = await parityWorld();
    await InternalAssessment.create({
      collegeId: fx.collegeId, courseOfferingId: String(w.offering._id), name: 'Mid-1 Parity Check', type: 'mid1',
      maxMarks: 30, weightage: 10, date: new Date(Date.now() + 36 * 60 * 60 * 1000), status: 'scheduled',
    });
    const today = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    expect(today.body.glance.nextAssessment?.courseCode).toBe('CSX01');
    const attention = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    expect(attention.body.items.some((i: { kind: string; courseCode?: string }) => i.kind === 'assessment' && i.courseCode === 'CSX01')).toBe(true);
  });
});
```

(The cancelled-class assertions read `tomorrow.classes` because the exception is dated tomorrow — `attention?kinds=all` carries it within the today/tomorrow window regardless of which of the two surfaces is checked. `fx.admin.token` writes through the ERP; the per-actor faculty gate is Task 7's own suite, not re-tested here.)

- [ ] **Step 2: Run the parity suite**

Run: `npm run test:e2e -w backend -- src/__e2e__/modules/juvi-erp-parity.e2e.test.ts`
Expected: PASS (all 3). This is a verification suite — everything it exercises landed in Tasks 1-16, so a FAILURE here means an earlier task's contract broke; fix at the failing function's own task, not here. Never import from, or re-run to fix, the known-failing `fee-alerts` and `fee-configuration-http` e2e tests — their failures are pre-existing and out of this plan's scope.

- [ ] **Step 3: Full gates**

```bash
npm run typecheck
npm test -w backend
npm run test:e2e -w backend
```

Expected: typecheck 0 errors across all workspaces; the backend unit suite green; `test:e2e` green except the two pre-existing `fee-alerts` failures and `fee-configuration-http` (documented known-failing carry-over, out of scope). Any OTHER e2e failure is this plan's regression — fix it before declaring the task done.

- [ ] **Step 4: Commit**

```bash
git add backend/src/__e2e__/modules/juvi-erp-parity.e2e.test.ts
git commit -m "test(juvi): ERP <-> Juvi parity e2e for class changes, dues and assessments (§11)

One change, one surface: an ERP class-exception cancels the class on
/v1/today and becomes a class_change attention item whose id is the
exception's _id, restores on revoke; an open invoice becomes a fee_due
item and a me/academics dues row; a scheduled assessment becomes the
glance nextAssessment and an assessment item. Closes the plan's full
gates (typecheck, unit, backend e2e)."
```
