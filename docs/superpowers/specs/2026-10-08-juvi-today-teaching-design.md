# Juvi Today & Teaching — Design

**Sub-project 4 of Juvi Release 1.**

**Depends on:**
- Foundation (`2026-09-23-juvi-foundation-design.md`; #94, #96, #99)
- Notices (`2026-09-26-juvi-notices-design.md`; #102–#105)
- Notifications (`2026-10-02-juvi-notifications-design.md`; #106–#108)

**PRD (PRD-JUVI-R1 v1.0):**
- Requirements: §7.5 HOME-01..05, §7.9 PRF-02, §8.1–8.2 (timetable, attendance, fees, assessments)
- Data model and events: Appendix B `AttentionItem` (computed), Appendix C `timetable.slot.cancelled / rescheduled`
- Open decision D6
- Screens: S03 Today, S10 Teaching, S12 Me (attendance, dues, courses taught)

## Problem

Today and Teaching are shells. The attention stack holds only notices, the timeline says "No classes today", and the glance row says "Attendance and dues appear here soon". Me has no attendance or dues.

Every number these screens need is already in the ERP, but some of it is hard to read:
- **Weekly timetable only.** The timetable repeats weekly and has no dated exceptions. A cancelled class can't be recorded, let alone shown.
- **Attendance:**
  - It is computed by two formulas that disagree.
  - Neither formula runs when attendance is marked, so stored summaries go stale.
  - The threshold is hard-coded at 75.
- **Dues** can be read from four different sources.
- **Assessments** live in two models with different keys.
- **No student-facing view.** No ERP route returns a person's day, and there is no student-facing ERP portal to match against.

## 1. Decisions locked in review (2026-10-08)

- **ERP data now; posts later.** This sub-project builds everything that reads ERP data. Anything that shows posts waits for sub-project 5 and appears here as a designed empty state:
  - unread spaces
  - Post to class
  - Awaiting my reply (HOME-06)
  - the HOD activity row
  - the latest department and college posts
  - the faculty first-week checklist

  The post-class prompt is in scope. Its action opens the course channel until compose exists.
- **Who changes a class, and where.** Class exceptions (cancel or reschedule one dated class) are made in the ERP portal by:
  - academics office staff, for any class
  - the faculty teaching the class, for their own classes

  Nothing is authored from the app in R1. Every change carries a reason and is audited.
- **Push for class changes.** A change affecting today or tomorrow pushes once at **Important**. It becomes **Urgent** when the class is today and starts within 2 hours of the change.
- **One attendance formula.** A single live formula, shared by Juvi and both ERP summary routes, so the app and the ERP always agree:
  - attended = present, late or OD
  - held = closed sessions
  - overall = total attended ÷ total held
- **Dues come from invoices and plan instalments.** These are the 007 billing data: invoice net payable minus successful payments against it, and the next unpaid payment-plan instalment.
- **Architecture: compute on read.**
  - The only new stored entity is `ClassException`.
  - Day timelines, glance values and attention items are derived on each request, as PRD Appendix B intends for `AttentionItem`. A paid instalment, a restored class or a past assessment simply stops matching, so items resolve themselves.
- **Defaults chosen by the designer and accepted:**
  - **Assessments:** an `InternalAssessment` with a date, or an `ExamSchedule` row, for the student's active courses, status `scheduled`.
  - **Threshold:** stored in `College.juvi`, default 75. The headroom line has a D6 toggle, default on, editable in `/platform/juvi` now.
  - **Holidays:** from the published `AcademicCalendar`.
  - **Pay link:** a "payment portal URL" setting, hidden when unset.
  - **Seed:** the dev seed gains current-term data.

## 2. Goals

1. **Timeline.** Today shows today's and tomorrow's classes from the ERP timetable, with these properties:
   - Cancellations are struck through, not removed.
   - Reschedules appear at their new time.
   - The next class is emphasised and past classes fade.
   - Tapping a class opens its course channel.
   - A timetable change or class exception made in the ERP appears on the next refresh (HOME-03, S03 AC3).
2. **Attention stack.** The stack holds four kinds of item:
   - acknowledgement-required notices
   - class changes for today or tomorrow
   - a fee instalment due within 7 days, or overdue
   - an assessment within 48 hours

   Each appears while its condition holds and disappears when it is resolved. Items are ordered by deadline, and one Due count is shared by the badge, the stack and the sheet (HOME-02, S05 AC2).
3. **Glance row.** It shows overall attendance (colour plus a text label below the threshold), open dues ("₹12,000 due 30 Sep" or "No dues") and the next assessment. Each taps through to detail (HOME-04).
4. **Teaching.** Teaching shows the faculty member's classes in time order, with course, section, room, time, registered count and status:
   - With no classes today, it shows the next teaching day.
   - For two hours after a class ends, its card offers the post-class prompt.
   - Department and College are hidden for adjunct and visiting faculty (HOME-05, S10 AC1).
5. **Me.** Students get attendance detail per course (held, attended, %, threshold, and the headroom line when enabled) and dues detail (open invoices, next due, last payment, and "Pay in the college portal"). Faculty get Courses taught. A section is hidden, not shown empty, when the institution has no such data (PRF-02, S12).
6. **ERP agreement.** Juvi's attendance and dues figures equal the ERP's own computation for the same student at the same time (S03 AC4, S12 AC). There is no student ERP portal in this codebase, so parity is defined against the ERP's service computation.
7. **Class exceptions in the ERP.** Office staff can cancel or reschedule any dated class, and faculty only their own. Each change carries a reason, is audited and can be revoked.
8. **Class-change push.** A class change for today or tomorrow reaches the affected students, and the other teaching faculty, by push at the right tier.

## 3. Non-goals

- Everything that shows posts or replies: sub-project 5.
- Class changes authored from the app.
- Pushes for fee dues and assessments. In R1 these are attention items only.
- A push for a class change dated beyond tomorrow. People see it on Today when it comes into range.
- Home personalisation by academic calendar (HOME-07, R3).
- In-app payment.
- The S5 hostel glance line.
- A Reach screen for class changes.
- Recurring cancellations (e.g. "every Monday in November"). Each date is its own exception.

## 4. Data model

### 4.1 `ClassException` (`backend/src/models/academic-ops/ClassException.ts`)

| Field | Type | Notes |
|---|---|---|
| `collegeId` | ObjectId, required, indexed | Multi-tenancy. |
| `timetableSlotId` | ObjectId → TimetableSlot, required | The weekly slot whose occurrence changes. |
| `courseOfferingId` | ObjectId, required | Denormalised from the slot. |
| `date` | string `YYYY-MM-DD` | The original occurrence date, in the college timezone. |
| `type` | `cancelled` \| `rescheduled` | |
| `newDate`, `newStartTime`, `newEndTime` | string, required when rescheduled | `HH:MM`. `newDate` is within 14 days of today. |
| `newRoomId` | ObjectId → Room, optional | |
| `reason` | string, 5–300 characters, required | ERP-only. Never sent to the app or in a push. |
| `createdBy` | ObjectId → User | |
| `revokedAt`, `revokedBy` | Date, ObjectId, or null | |

**Indexes:**
- Partial unique on `(timetableSlotId, date)` where `revokedAt: null`, so a slot occurrence has at most one active exception.
- `(collegeId, courseOfferingId, date)`
- `(collegeId, newDate)`

**Changing an exception.** Revoke it and create a new one. Rows are never edited or deleted.

### 4.2 Settings (`College.juvi`, normalised with defaults in `normalizeJuviConfig`)

| Field | Values |
|---|---|
| `attendanceThreshold` | number 50–95, default 75 |
| `showAttendanceHeadroom` | boolean, default `true` (D6) |
| `paymentPortalUrl` | `https://` URL or null |

The ERP attendance categories derive from the threshold:
- `safe`: threshold + 10 or more
- `warning`: from the threshold up to threshold + 10
- `at_risk`: from threshold − 10 up to the threshold
- `detained`: below threshold − 10

These replace the hard-coded 85/75/65.

## 5. ERP side

### 5.1 Service (`modules/academics/class-exception-service.ts`)

- `createClassException(collegeId, input, actor)`, `revokeClassException(collegeId, id, actor)` and `listClassExceptions(collegeId, filter)`, where `filter` is by offering, slot or date range.
- **Permission:**
  - With `academics:update`, the actor may change any class.
  - Otherwise the actor must be a faculty member who is the offering's `facultyId`, appears in its `coFacultyIds`, or is the slot's `substituteFacultyId`.
  - Anything else gets a 403.
- **Validation:**
  - `date` falls on the slot's weekday, is today or later, and lies inside the live timetable's effective window.
  - A reschedule's new time doesn't overlap another class of the same section on `newDate`, after that day's exceptions are applied.
  - The room conflict check reuses `detectTimetableConflicts`.
- **Side effects:**
  - Each create and revoke writes an audit log entry.
  - It emits the outbox event `class.exception.changed { exceptionId, action: 'created' | 'revoked' }`, with dedupe key `class-exception:<id>:<action>`.

### 5.2 Routes (`/api/academics`, ERP chain)

| Route | Behaviour |
|---|---|
| `GET /class-exceptions?offeringId&from&to` | |
| `POST /class-exceptions` | Validated with Zod. |
| `DELETE /class-exceptions/:id` | Revokes the exception and returns 200 with the revoked row. |
| `GET /class-exceptions/preview?slotId&date` | Returns `{ affectedStudents, faculty, pushTier: 'urgent' \| 'important' \| 'none' }` for the confirm dialog. |

Faculty reach these routes through the per-actor check in §5.1. Reads use `authorize('academics','read')`. Writes use `authenticate` plus the per-actor check, not `authorize('academics','update')`, so that teaching faculty without academics write permission can still change their own classes.

### 5.3 Live timetable rule

For a section and a date, the live timetable is the `published` `Timetable` whose `effectiveFrom ≤ date ≤ (effectiveTo ?? ∞)`, with the highest `version` winning.

`spaces/next-class.ts` and every Juvi reader use this rule, and `next-class.ts` also applies exceptions. A cancelled next occurrence is skipped, and a rescheduled one moves.

### 5.4 Shared attendance formula (`modules/academics/attendance-formula.ts`)

`attendanceFor(collegeId, studentId, threshold)` computes:
- For each active-semester enrolled offering:
  - `held` = closed sessions
  - `attended` = records with status present, late or OD
  - `pct` = `round1(attended / held × 100)`, or null when held = 0
  - `headroom` = `max(0, floor(attended / (threshold / 100) − held))`, defined only when pct ≥ threshold
- `overall` = Σattended ÷ Σheld

`computeAttendanceSummary`, `updateAttendanceSummary` and the attendance-marking endpoints all call this formula, so `AttendanceSummary` stays current and matches Juvi.

### 5.5 Portal (`/academics/timetables`)

- **"Change this class" on a slot:**
  - Pick a date: the next 14 dates on which the slot meets.
  - Choose cancel or reschedule. A reschedule needs a date, time and optional room.
  - Give a reason.
  - The preview shows "62 students, Prof. Rao · they'll be notified now (Urgent)", or "they'll see it on Today".
  - Confirm.
- **A "Class changes" list** shows upcoming and recent changes with who made each, and offers revoke. Faculty see only their own classes.
- **Settings:** `/platform/juvi` → Settings gains an "Academics in the app" section with the threshold, the headroom toggle and the payment portal URL.

## 6. Readers (`modules/juvi-app/home/`, pure functions over ERP data)

- **`resolveDay(ctx, date)`:**
  - **Classes in.** Students: active-semester `Enrollment` (status enrolled) → offerings → live-timetable slots. Faculty: offerings where they are `facultyId` or in `coFacultyIds`, plus slots where they are `substituteFacultyId`, minus slots where they are `originalFacultyId`.
  - **Exceptions applied.** A cancelled class stays in the list with `status: 'cancelled'`. A rescheduled class leaves its original date and appears on `newDate` with `status: 'rescheduled'` and `movedFrom: { date, start }`.
  - **Holidays.** If a published `AcademicCalendar` entry with `isHoliday` covers the date, the result is `{ holiday: title, classes: [] }`.
  - **Each class carries:**
    - `offeringId`, `courseCode`, `title`, `section`
    - `room` (room number plus building when there is one)
    - `faculty` (name, or the substitute's)
    - `start`, `end`, `slotType`, `status`, `channelId`
    - faculty only: `registered`
  - **Order and look-ahead.** Classes are sorted by start time. `nextTeachingDay` scans forward up to 14 days.
- **`attendanceFor`:** §5.4, plus `available` = the college has any closed attendance session.
- **`duesFor(collegeId, studentId)`:**
  - **Open invoices** have a status other than draft, paid, cancelled or written off. For each:
    - `outstanding` = `netPayable ?? totalAmount` − Σ successful `Payment.amount` against it; dropped when ≤ 0
    - `nextDue` = the next unpaid `PaymentPlan` instalment (date and amount), or the invoice `dueDate` and its outstanding amount when there is no plan
    - `overdue` = `nextDue.date` < today
  - **Totals:**
    - `totalOutstanding` = Σ outstanding
    - `nextDue` = the earliest invoice `nextDue`
    - `lastPayment` = the latest successful Payment for the student
  - **Units and availability:** money is in integer paise. `available` = the college has any invoice.
- **`assessmentsFor(collegeId, studentId, from, to)`:** returns `{ kind, courseCode, title, at, channelId }`, sorted by `at`. It merges:
  - `InternalAssessment` rows with status scheduled and a date, on the student's active offerings
  - `ExamSchedule` rows with status scheduled, on those offerings' `courseId`s in the active semester

**Scoping.** All readers scope by `collegeId` and by `MobileContext.studentId` / `facultyId`, never by request parameters.

## 7. Mobile API (`/v1`, authenticated per route, mounted before `spacesRouter`)

### 7.1 `GET /v1/today` (students)

Returns `{ asOf, today: Day, tomorrow: Day, glance }`. Here `Day` is `{ date, holiday?, classes: Class[] }`, and `glance` holds:
- `attendance: { available, overallPct?, threshold, belowThreshold }`
- `dues: { available, totalOutstanding, nextDue?: { amount, date } }`
- `nextAssessment?: { courseCode, title, at, channelId }`

### 7.2 `GET /v1/teaching` (faculty)

Returns `{ asOf, today: Day, tomorrow: Day, nextTeachingDay?: Day, faculty: { kind } }`:
- `kind` is `regular | hod | adjunct`.
- `hod` comes from `Department.hodId`.
- `adjunct` is set when `contractType` is adjunct or visiting.

### 7.3 `GET /v1/me/academics`

- **Students:**
  - `attendance`: `{ available, threshold, showHeadroom, overall: { held, attended, pct? }, courses: [{ offeringId, courseCode, title, held, attended, pct?, headroom?, channelId }] }`
  - `dues`: `{ available, totalOutstanding, invoices: [{ number, type, outstanding, nextDue: { amount, date }, overdue }], lastPayment?: { amount, date }, payUrl? }`
- **Faculty:** `{ coursesTaught: [{ offeringId, courseCode, title, section, channelId }] }`

### 7.4 `GET /v1/attention?kinds=all`

- **Response:** `{ dueCount, items: AttentionItem[] }`.
- **`AttentionItem`** is discriminated on `kind`:
  - `notice`: the existing `NoticeCard`
  - `class_change`: `{ id, type, offeringId, courseCode, title, date, start, newDate?, newStart?, room?, channelId, deadline }`. The deadline is the original start. It is shown from creation until that start has passed, and only for today or tomorrow.
  - `fee_due`: `{ id: invoiceId, invoiceNumber, amount, dueDate, overdue, deadline }`. Shown when the next due is within 7 days, or is overdue.
  - `assessment`: `{ id, kind, courseCode, title, at, channelId, deadline }`. Shown when it falls within 48 hours.
- **Count and order:** `dueCount` counts every item, and items are ordered by `deadline`.
- **Without `kinds=all`:** the endpoint returns notices only, exactly as before. This keeps older app builds safe. The new app always sends the parameter.

### 7.5 Contract

- Every schema is registered in `openapi/document.ts`.
- No object field is `null` in any response; optional fields are omitted instead.
- Regenerate `mobile/api/openapi.json` and the Dart client.
- The events allow-list gains `timeline.class_opened`, `glance.opened`, `post_class_prompt.shown` and `post_class_prompt.opened`.

## 8. Class-change push

- **Source type.** `NotificationDelivery.source.type` gains `class_change`, with `id` = the exception id and `kind` = `created | revoked`.
- **Trigger.** The `class.exception.changed` consumer emits `notification.requested` for that source, with dedupe key `notif:class_change:<id>:<kind>`. It does so only when the affected date is today or tomorrow in the college timezone. For a reschedule, the affected date is either the original or the new date.
- **Audience.** Students enrolled in the offering, plus its other teaching faculty (excluding the actor). Accounts not on Juvi are skipped. The expand consumer gains an audience resolver keyed on `source.type`.
- **Tier:**
  - `urgent` when the original class start is today and within 2 hours of the change
  - `important` otherwise

  Mute matches the course channel. Urgent bypasses mute and quiet hours.
- **Send-time re-check.** The row is cancelled if the exception was revoked or superseded, or if the class has already started.
- **Payload** (NFR-05; the reason is never sent): `{ deliveryId, receipt, kind: 'class_change', exceptionId, tier, groupKey: 'class:<offeringId>', office: <courseCode>, variant: 'cancelled' | 'rescheduled' | 'restored', when, newWhen? }`

**Rendering in the app:**

| Variant | Title | Text |
|---|---|---|
| cancelled | "CS301 cancelled" | "Today 10:00" |
| rescheduled | "CS301 moved" | "Tue 10:00 → Wed 14:00" |
| restored | "CS301 is back on" | "Today 10:00" |

- **Deep links.** The allow-list gains `/today` and `/teaching`, and a tap opens the person's home tab.

## 9. Flutter

- **Repositories.** `TodayRepository` (cache key `today`), `TeachingRepository` (`teaching`) and `AcademicsRepository` (`me:academics`) follow the `spaces_repository` pattern: cached value, then network, marked stale on failure. The attention repository sends `kinds=all` and parses into freezed `AttentionItem` subtypes.
- **S03 Today:**
  - Header, then `PermissionCard`.
  - **Attention stack:**
    - Shows `NoticeCard`, plus `ClassChangeCard` (struck-through or "Moved to Wed 14:00"), `FeeDueCard` (opens Me › Dues) and `AssessmentCard` (opens the channel).
    - Each new card has a deadline ring and no ack control.
    - At most 3 items, plus "+N more".
  - **`DayTimeline`:**
    - A vertical line with a now marker driven by `minuteClockProvider`. The next class is emphasised and past classes fade.
    - A cancelled class is struck through with a "Cancelled" label. A rescheduled class shows "Moved from 10:00".
    - Tapping a class opens its course channel (S07). A horizontal swipe switches between today and tomorrow.
    - Empty states: "No classes today", "Holiday: <title>", "Done for today", and "Timetable unavailable" on error.
  - **Glance row:**
    - Attendance ring with %, a text label, and the threshold colour.
    - Dues chip.
    - Next assessment chip.
    - Each chip is hidden when not `available`.
  - **Unread spaces:** a placeholder until sub-project 5.
  - **Pull to refresh** refreshes today, attention and me.
- **S10 Teaching:**
  - Header, then My acknowledgements.
  - **Teaching today:** class cards showing course, section, room, time, registered count and status.
    - For two hours after a class ends, the card shows "Share notes or a reminder for CS301, 10:00?". Its action opens the course channel.
    - With no classes today, the section shows the next teaching day.
  - **Awaiting my reply, Department and College:** placeholders.
  - Department and College are hidden for `adjunct`.
- **S12 Me:**
  - **Students:**
    - **Attendance:** overall, the threshold, and per course: held/attended, % with a bar, and "You can miss 2 more CS301 classes and stay above 75%" when headroom is on. Below the threshold it reads "Below 75% — attend every remaining class".
    - **Dues:** total, open invoices with outstanding amount, next due and an overdue tag, last payment, and "Pay in the college portal" (opens `payUrl` externally; hidden when unset).
  - **Faculty:** Courses taught, with channel links.
- **General:**
  - Every screen handles the five states (§6 PRD).
  - Strings live in ARB, with ₹ and dates formatted en-IN.
  - Layout holds up at 200% text.
  - Colour is never the only signal.
- **Push.**
  - The push union is `NoticePush | ClassChangePush`, rendered as §8 specifies.
  - The deep-link resolver accepts `/today` and `/teaching`.

## 10. Seed

`seed.ts` (idempotent) adds:
- a current semester whose dates are computed from now
- a published timetable for the demo student's section and the demo faculty member's offerings, covering every weekday Monday–Saturday
- a cancellation dated tomorrow
- one published holiday
- about eight weeks of closed attendance sessions for the demo student, with one course below the threshold
- an open invoice with a plan instalment due in 5 days
- an internal assessment 36 hours away

The e2e seed gets the minimum needed by the tests below.

## 11. Testing

- **Backend unit:**
  - `resolveDay` table tests: student, faculty, substitution, cancel, reschedule across days, holiday, timezone, the live-timetable rule, next teaching day.
  - The attendance formula: headroom and the threshold edges.
  - `duesFor`: partial payments, plans, overdue invoices, excluded statuses.
  - Assessment merge.
  - Attention ordering and resolve-by-condition.
  - Push tier: the 2-hour Urgent boundary.
- **Backend e2e:**
  - Class-exception permissions: office any class, faculty only their own, student 403.
  - The overlap check.
  - Revoke plus the audit entry.
  - Push only for today and tomorrow; a payload with no reason.
  - `/today`, `/teaching`, `/me/academics` and `/attention?kinds=all` scoped to the caller; old clients still get notices only.
  - The ERP summary routes agree with `attendanceFor`.
- **Portal:**
  - Vitest for the change dialog, the list and the settings section.
  - Playwright: a faculty member cancels their own class, and another faculty member's slot offers no action.
- **Flutter:**
  - Widget tests for the timeline (now marker, struck-through classes, swipe, empty states), each attention card, the glance row and the Me sections.
  - The post-class window, tested with a fake clock.
  - Goldens for the timeline and the glance row.
  - A flow test: a class-change push tap opens Today with the class struck through.

## 12. Delivery

Three plans, each leaving `main` deployable:

1. **Backend:**
   - the `ClassException` model, service and routes
   - the live-timetable rule (including `next-class.ts`)
   - the shared attendance formula wired into the ERP
   - the dues and assessment readers, and `resolveDay`
   - `/today`, `/teaching`, `/me/academics`, and `/attention?kinds=all`
   - the `class_change` push source, settings and seed
   - the contract and the Dart client
2. **Portal:** Change this class, the Class changes list, and the Academics settings.
3. **Flutter:**
   - the repositories
   - the Today, Teaching and Me sections
   - the new attention cards and the sheet
   - class-change push rendering and deep links
