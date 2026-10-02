# Juvi Notices & Acknowledgement — Plan 3 of 3: Flutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Juvi notices to the Flutter app: a student or faculty member sees up to three due acknowledgement cards on Today or Teaching, opens a notice (S04), acknowledges it deliberately (a 1.2 s hold or tap-then-confirm, queued when offline), browses every notice in the attention sheet (S05), sees notices inline in their channels, meets a real welcome notice as onboarding step 4, and — when they published the notice — follows its reach and sends reminders (S11).

**Architecture:** One `NoticesRepository` (`lib/core/repos/notices_repository.dart`) on the Foundation pattern: cached-then-network Riverpod streams over the drift `kv_cache` (`attention`, `notices:<segment>`, `notice:<id>`), the generated `juvi_api` client for every endpoint whose generated model is right, and the shared authenticated Dio for the one that is not (the attachment URL, whose key has to travel as one encoded path segment). Acknowledgement goes through `acknowledgeNotice()` (`lib/features/notices/notice_actions.dart`): online it waits for the server; offline it enqueues a `notice.ack` pending action that `SyncWorker` replays at launch, reconnect and resume, where a 409 counts as sent. Presentational widgets (`DeadlineRing`, `AckControl`, `NoticeCard`, `NoticeTile`) sit under `lib/features/notices/widgets/`; `AttentionStack` and the screens are `ConsumerWidget`s over the repository's providers. Routing stays in `lib/app/router.dart`: `/notices/:id` (S04), `/notices/:id/reach` (S11) and `/attention` (S05, a modal bottom-sheet page), all above the tab shell so `redirect()` keeps governing them.

**Tech Stack:** Flutter 3.44 / Dart 3.12, flutter_riverpod 3 + riverpod_generator (`.value`, `retry: (_, _) => null` in tests), freezed 4.0.0-dev + json_serializable, go_router 17, dio 5.11, drift 2.35 over SQLCipher, intl (`en_IN`), url_launcher, very_good_analysis; tests with flutter_test, mocktail, http_mock_adapter. Android only (no Xcode on the build machine).

**Spec:** `docs/superpowers/specs/2026-09-26-juvi-notices-design.md` — §9 (Flutter app), §4 US-2, US-3, US-4 (app side), US-5, US-6, §12 (mobile tests), and §13 item 3. Depends on Plan 1 (`docs/superpowers/plans/2026-09-26-juvi-notices-1-backend.md`, merged in #102), the regenerated Dart client (#103) and Plan 2 (#104). The live contract is `mobile/api/openapi.json`; the live server is `backend/src/modules/juvi-app/notices/`.

## Global Constraints

- `mobile/` is not an npm workspace; every Flutter command runs from `mobile/`. Nothing under `mobile/` imports from `backend/`, and `mobile/packages/juvi_api/` (generated) is never edited by hand.
- **Acknowledgement gesture (spec §4 US-2.2, §9):** a **1.2 s hold** with a filling ring, or **tap-then-confirm**. The confirm path is **forced under `MediaQuery.accessibleNavigation`** (a screen reader is running). **There is no single-tap acknowledgement.** The hold is timed from the moment Flutter recognises the press (`kPressTimeout`, 100 ms inside a scrollable), so a scroll that starts on the control never acknowledges.
- **Online acknowledgement is not optimistic** (spec §4 US-3.3): the card stays, showing progress, until the server confirms; **a failure restores the card with a message** (a SnackBar with `ApiFailure.message`).
- **Offline acknowledgement** (spec §4 US-3.4, §9) is queued as a pending action of type **`notice.ack`** with payload `{ noticeId, method, comment, clientAt, offline: true }`, `clientAt` the gesture's time in UTC ISO-8601. The card shows **"Will send when online"** until the queue drains. `SyncWorker` replays it; **a 409 on replay counts as success** (sent, removed from the queue). One queued acknowledgement per notice.
- **Attention (spec §4 US-3.1, US-3.2):** Today and Teaching show **at most 3** due acknowledgement items, **ordered by deadline with nulls last** (the server's `GET /attention` order, rendered as given), then a **"+N more"** pill (N = `dueCount` − items shown) that opens the attention sheet, and **"You're clear"** when nothing is due. **The Due count equals the badge everywhere**: the tab badge, the "+N more" arithmetic and the sheet's Due segment label all read `attentionProvider`'s `dueCount`.
- **Analytics (spec §9):** `notice.opened {noticeId}`, `notice.acknowledged {noticeId, late, method}` (`late` is `null` while queued: the server decides it on receipt) and `notice.dismissed {noticeId}`. Ids and enums only — never titles, bodies, comments, names or identifiers.
- **Attachments** read **"Available when online"** while offline and are disabled; online they open a 5-minute presigned URL in the external browser.
- **Generated-client rule (Foundation R57/R61):** the notices contract has no object-or-null field (Plan 1 Global Constraints), so `Attention`, `NoticeList`, `NoticeDetail`, `SeenResult`, `AckRequest`/`AckResult`, `DismissResult`, `NoticeReach`, `NoticePending`, `RemindResult` and `ChannelDetail.notices` go through `wire.MobileApi`, converted with `toJson()` into app freezed models (the Foundation `spaces_repository.dart` pattern). `GET /notices/:id/attachments/:key` uses the shared Dio, because the generated method interpolates the slash-bearing key unencoded. `error.ack` (409 `ALREADY_ACKNOWLEDGED`) and `error.reminders` (409 `REMINDER_LIMIT`) are read from the raw envelope through `ApiFailure.ackRecord` / `ApiFailure.reminders`. `mobile/tool/check_nullable_objects.js` needs no new allow-list entry.
- All user-visible strings live in `lib/app/l10n/app_en.arb`; run `flutter gen-l10n` after editing it and commit the regenerated `lib/app/l10n/app_localizations*.dart`. Dates use `en_IN` (`dayMonthTime` → "Fri 3 Oct, 17:00").
- Touch targets are at least **44 pt**; screens and cards lay out at **text scale 2.0** without clipping actions.
- Tests: `ProviderScope(retry: (_, _) => null)` (or `ProviderContainer(retry: …)`) wherever a provider can fail; golden tests are tagged `@Tags(['golden'])`, live under a `goldens/` folder beside the test, and are excluded in CI (`flutter test --exclude-tags golden`). New goldens are generated once with `--update-goldens` in the task that adds them.
- Every task ends with `flutter analyze` at 0 issues and both test runs green. Baseline before Task 1: `flutter test --exclude-tags golden` → `+93: All tests passed!`, `flutter test --tags golden` → `+8: All tests passed!`.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

## File structure

**Create**

```
mobile/lib/core/models/notices.dart                       freezed: NoticeItem, NoticeAttachment, NoticeDetail, AttentionData, NoticePage, AckRecord, Reminders,
                                                          ReachPerson, ReachComment, ReachGroup, ReachAddedLater(Item), NoticeReachData, PendingPerson, PendingGroup,
                                                          PendingPage; enums NoticeSegment, AckMethod; class AckInput
mobile/lib/core/repos/notices_repository.dart             NoticesRepository, ApiNoticesRepository; providers noticesRepository, attention, noticeDetail, pendingAcks
mobile/lib/features/notices/notice_actions.dart           acknowledgeNotice (online / queued), dismissNotice, refreshNotice, AckOutcome
mobile/lib/features/notices/widgets/deadline_ring.dart    DeadlineRing
mobile/lib/features/notices/widgets/ack_control.dart      AckControl (hold 1.2 s, tap-then-confirm, screen-reader confirm only)
mobile/lib/features/notices/widgets/notice_card.dart      NoticeCard
mobile/lib/features/notices/widgets/notice_tile.dart      NoticeTile
mobile/lib/features/notices/widgets/attention_stack.dart  AttentionStack
mobile/lib/features/notices/widgets/linked_text.dart      LinkedText (body links, spec §5)
mobile/lib/features/notices/widgets/due_badge.dart        DueBadge (the tab badge, from attentionProvider)
mobile/lib/features/notices/notice_detail_screen.dart     S04 NoticeDetailScreen; externalLauncherProvider
mobile/lib/features/notices/notice_list_controller.dart   NoticeListController (S05 segments, office filter, paging)
mobile/lib/features/notices/attention_sheet.dart          S05 AttentionSheet
mobile/lib/features/notices/reach_screen.dart             S11 ReachScreen; noticeReachProvider, PendingController
mobile/lib/app/sheet_page.dart                            SheetPage (go_router page for a modal bottom sheet)
mobile/lib/features/onboarding/steps/first_notice_step.dart   onboarding step 4; firstNoticeProvider
mobile/test/core/repos/notices_fixtures.dart              contract-shaped payloads (not a test file)
mobile/test/core/repos/notices_repository_test.dart
mobile/test/features/notices/host.dart                    localized, themed host (not a test file)
mobile/test/features/notices/notice_actions_test.dart
mobile/test/features/notices/ack_control_test.dart
mobile/test/features/notices/deadline_ring_test.dart
mobile/test/features/notices/deadline_ring_golden_test.dart
mobile/test/features/notices/notice_card_test.dart
mobile/test/features/notices/attention_stack_test.dart
mobile/test/features/notices/notice_widgets_golden_test.dart
mobile/test/features/notices/notice_detail_screen_test.dart
mobile/test/features/notices/attention_sheet_test.dart
mobile/test/features/notices/reach_screen_test.dart
mobile/test/features/spaces/channel_screen_test.dart
mobile/test/features/notices/goldens/*.png                generated in Tasks 3 and 4
```

**Modify**

```
mobile/lib/core/http/api_failure.dart          notice error codes; ackRecord / reminders from the raw envelope
mobile/lib/core/session/session_controller.dart  exhaustive switch gains the notice codes (no behaviour change)
mobile/lib/core/sync/pending_action.dart       documents notice.ack
mobile/lib/core/sync/sync_worker.dart          NoticesRepository; notice.ack replay; 409 on replay = sent
mobile/lib/core/sync/sync_lifecycle.dart       passes NoticesRepository; invalidates pendingAcks and attention
mobile/lib/shared/format.dart                  dayMonthTime
mobile/lib/app/l10n/app_en.arb (+ generated app_localizations*.dart)
mobile/lib/app/router.dart                     /notices/:id, /notices/:id/reach, /attention
mobile/lib/shared/widgets/app_shell.dart       Due badge on the Today / Teaching tab
mobile/lib/features/home/today_shell_screen.dart, teaching_shell_screen.dart   AttentionStack
mobile/lib/features/onboarding/onboarding_screen.dart   first_notice → FirstNoticeStep
mobile/lib/core/models/models.dart             ChannelDetail.notices
mobile/lib/features/spaces/channel_screen.dart inline notice tiles
mobile/test/core/http/api_failure_test.dart, test/core/sync/sync_worker_test.dart, test/core/sync/sync_lifecycle_test.dart, test/app/redirect_test.dart,
mobile/test/core/repos/spaces_repository_test.dart,
mobile/test/features/home/today_shell_test.dart, test/features/onboarding/onboarding_screen_test.dart, test/flows/sign_in_flow_test.dart
mobile/README.md, CLAUDE.md ("Juvi mobile app" section)
```

---

### Task 1: Notice models, error codes and `NoticesRepository`

**Files:**
- Create: `mobile/lib/core/models/notices.dart`, `mobile/lib/core/repos/notices_repository.dart`, `mobile/test/core/repos/notices_fixtures.dart`, `mobile/test/core/repos/notices_repository_test.dart`
- Modify: `mobile/lib/core/http/api_failure.dart`, `mobile/lib/core/session/session_controller.dart:103-136` (exhaustive switch), `mobile/test/core/http/api_failure_test.dart`

**Interfaces:**
- Consumes: `wire.MobileApi` methods `getAttention`, `listNotices({segment, office, cursor})`, `getNotice({id})`, `markNoticeSeen({id})`, `acknowledgeNotice({id, ackRequest})`, `dismissNotice({id})`, `getNoticeReach({id})`, `listNoticePending({id, group, q, cursor})`, `remindNotice({id})`, `getFirstNotice()` (`packages/juvi_api/lib/src/api/mobile_api.dart`); `wire.AckRequest`, `wire.AckRequestMethodEnum`; `dioProvider`, `mobileApiProvider`, `appDatabaseProvider` (`lib/core/http/api_providers.dart`); `AppDatabase.readDoc/writeDoc`; `Cached<T>` (`lib/core/models/models.dart`).
- Produces:
  ```dart
  // lib/core/models/notices.dart
  enum NoticeSegment { due, done, all, published }
  enum AckMethod { hold, confirm }
  class NoticeItem { id, title, preview, office, audienceLine, priority, purpose, ackRequired, ackCommentAllowed, archived,
    attachmentCount, state, isLate (json 'late'), isPublisher, DateTime? deadline/publishedAt/seenAt/ackAt/remindedAt;
    bool get isAcknowledged; bool get needsAck; }
  class NoticeDetail { …every NoticeItem field…, body, List<NoticeAttachment> attachments, ackOffline, String? ackMethod,
    String? ackComment, DateTime? ackClientAt, DateTime? dismissedAt; NoticeItem get item; bool get isAcknowledged; bool get needsAck; }
  class AttentionData { int dueCount; List<NoticeItem> items; }      class NoticePage { items; String? nextCursor; }
  class AckRecord { DateTime ackAt; bool isLate; String method; bool offline; String? comment; DateTime? clientAt; }
  class Reminders { int used; int max; DateTime? lastAt; bool get exhausted; }
  class NoticeReachData { noticeId, title, status, ackRequired, audience, acknowledged, seen, notSeen, notOnJuvi, dismissed,
    lateCount (json 'late'), Reminders reminders, List<int> sparkline, groups, lateAcks, comments, ReachAddedLater addedLater, asOf, deadline?, publishedAt? }
  class PendingPage { List<PendingPerson> items; int total; List<PendingGroup> groups; String? nextCursor; }
  class AckInput { AckMethod method; String? comment; bool offline; DateTime? clientAt; factory AckInput.fromQueued(Map<String, dynamic>); }
  // lib/core/http/api_failure.dart
  enum ApiErrorCode { …, noticeNotFound, alreadyAcknowledged, noticeArchived, notPublisher, reminderLimit, ackRequired, ackNotRequired, offline, unknown }
  class ApiFailure { …; Map<String, dynamic>? get ackRecord; Map<String, dynamic>? get reminders; }
  // lib/core/repos/notices_repository.dart
  abstract class NoticesRepository {
    Future<Cached<AttentionData>?> cachedAttention();  Future<Cached<AttentionData>> attention();
    Future<Cached<NoticePage>?> cachedList(NoticeSegment s);  Future<NoticePage> list(NoticeSegment s, {String? office, String? cursor});
    Future<Cached<NoticeDetail>?> cachedDetail(String id);  Future<Cached<NoticeDetail>> detail(String id);
    Future<DateTime> markSeen(String id);  Future<AckRecord> acknowledge(String id, AckInput input);  Future<DateTime> dismiss(String id);
    Future<Uri> attachmentUrl(String id, String key);  Future<NoticeReachData> reach(String id);
    Future<PendingPage> pending(String id, {String? group, String? q, String? cursor});  Future<Reminders> remind(String id);
    Future<NoticeDetail> firstNotice();
  }
  final noticesRepositoryProvider;   // FutureProvider<NoticesRepository>, keepAlive
  final attentionProvider;           // Stream<Cached<AttentionData>>, cached-then-network
  final noticeDetailProvider;        // family (String id) → Stream<Cached<NoticeDetail>>
  ```

Decisions that bind later tasks:
- **Raw Dio versus generated client, per endpoint** (checked against `mobile/api/openapi.json` and `packages/juvi_api/lib/src/model/`):

  | Endpoint | Client | Why |
  |---|---|---|
  | `GET /attention` | generated `getAttention` → `Attention` | items (`AttentionItemsInner`) are scalars; nullable dates are `String?` |
  | `GET /notices` | generated `listNotices` → `NoticeList` | same item model; `nextCursor` is `String?`; `segment` is a plain `String` |
  | `GET /notices/:id` | generated `getNotice` → `NoticeDetail` | `ackMethod` decodes as a nullable enum; attachments are a non-null array |
  | `POST /notices/:id/seen` | generated `markNoticeSeen` → `SeenResult` | no body; `seenAt` is a non-null string |
  | `POST /notices/:id/ack` | generated `acknowledgeNotice(ackRequest: AckRequest)` → `AckResult` | `AckRequest.toJson` omits a null `comment`/`clientAt` (the server's `.strict()` schema rejects `null`); `clientAt` is passed as a UTC `DateTime`, which serialises with `Z` as `z.string().datetime({ offset: true })` requires. The 409 body is read from the raw envelope |
  | `POST /notices/:id/dismiss` | generated `dismissNotice` → `DismissResult` | scalar |
  | `GET /notices/:id/attachments/:key` | **raw Dio** | the generated method does `replaceAll('{key}', key)` with no encoding, so `colleges/<cid>/notices/<uuid>` becomes four path segments and Express 404s; the repository sends `Uri.encodeComponent(key)` (Dio keeps `%2F`) |
  | `GET /notices/:id/reach` | generated `getNoticeReach` → `NoticeReach` | `addedLater` and `reminders` are always-present objects; lists are arrays |
  | `GET /notices/:id/reach/pending` | generated `listNoticePending` → `NoticePending` | scalars; query params map one to one |
  | `POST /notices/:id/remind` | generated `remindNotice` → `RemindResult` | `reminders` is an always-present object; the 409 body is read from the raw envelope |
  | `GET /onboarding/first-notice` | generated `getFirstNotice` → `NoticeDetail` | as `GET /notices/:id` |
  | `GET /channels/:id` (`notices[]`) | generated `getChannel` → `ChannelDetail` (Foundation, unchanged) | `notices` items are `NoticeCard`, scalars only; Task 9 parses them |

- The app model is `NoticeItem` (contract `NoticeCard`), leaving the spec's widget name `NoticeCard` free for Task 4. `late` is a Dart keyword, so the JSON field `late` maps to `isLate` (`lateCount` on reach).
- Cache keys: `attention`, `notices:<segment>` (only the unfiltered first page, so the sheet opens offline), `notice:<id>`. Sign-out's `AppDatabase.wipe()` already clears them.
- `acknowledge` turns a 409 `ALREADY_ACKNOWLEDGED` carrying `error.ack` into a successful return of that record (the acknowledgement exists; US-2.3). Any other failure is an `ApiFailure`. On success it patches the cached detail (state, ack fields) and removes the notice from the cached attention document (decrementing `dueCount`), so the next attention read drops the card before the network answers.

- [ ] **Step 1: Write the contract fixtures and the failing repository tests**

```dart
// mobile/test/core/repos/notices_fixtures.dart
/// Contract-shaped notice payloads (mobile/api/openapi.json `NoticeCard`,
/// `NoticeDetail`, `NoticeReach`, `NoticePending`), including their nulls. Shared by
/// the repository, widget and flow tests.
library;

Map<String, dynamic> cardJson(
  String id, {
  String title = 'Mid-semester exam timetable',
  String office = 'Exam Section',
  String? deadline = '2026-10-03T11:30:00.000Z',
  bool ackRequired = true,
  bool ackCommentAllowed = false,
  String state = 'received',
  String? ackAt,
  bool late = false,
  bool archived = false,
  String priority = 'important',
  String purpose = 'standard',
  bool isPublisher = false,
  int attachmentCount = 0,
}) =>
    {
      'id': id,
      'title': title,
      'preview': 'The timetable for the mid-semester examinations is attached.',
      'office': office,
      'audienceLine': 'Sent to 2024 Batch',
      'priority': priority,
      'purpose': purpose,
      'ackRequired': ackRequired,
      'ackCommentAllowed': ackCommentAllowed,
      'deadline': deadline,
      'publishedAt': '2026-09-30T04:30:00.000Z',
      'archived': archived,
      'attachmentCount': attachmentCount,
      'state': state,
      'seenAt': null,
      'ackAt': ackAt,
      'late': late,
      'remindedAt': null,
      'isPublisher': isPublisher,
    };

Map<String, dynamic> detailJson(
  String id, {
  String title = 'Mid-semester exam timetable',
  String office = 'Exam Section',
  String? deadline = '2026-10-03T11:30:00.000Z',
  bool ackRequired = true,
  bool ackCommentAllowed = false,
  String state = 'received',
  String? ackAt,
  bool late = false,
  bool archived = false,
  String purpose = 'standard',
  bool isPublisher = false,
  List<Map<String, dynamic>> attachments = const [],
  String body = 'The timetable for the mid-semester examinations is attached.\n\nSee https://jit.example/exams for rooms.',
}) =>
    {
      ...cardJson(
        id,
        title: title,
        office: office,
        deadline: deadline,
        ackRequired: ackRequired,
        ackCommentAllowed: ackCommentAllowed,
        state: state,
        ackAt: ackAt,
        late: late,
        archived: archived,
        purpose: purpose,
        isPublisher: isPublisher,
        attachmentCount: attachments.length,
      ),
      'body': body,
      'attachments': attachments,
      'ackMethod': ackAt == null ? null : 'hold',
      'ackOffline': false,
      'ackComment': null,
      'ackClientAt': null,
      'dismissedAt': null,
    };

const Map<String, dynamic> pdfAttachment = {'key': 'colleges/c1/notices/7f3a', 'name': 'timetable.pdf', 'mime': 'application/pdf', 'size': 245760};

Map<String, dynamic> attentionJson(List<Map<String, dynamic>> items, {int? dueCount}) => {'dueCount': dueCount ?? items.length, 'items': items};

Map<String, dynamic> ackJson({bool late = false, String method = 'hold', bool offline = false, String? clientAt}) => {
      'ackAt': '2026-10-01T05:00:00.000Z',
      'late': late,
      'method': method,
      'offline': offline,
      'comment': null,
      'clientAt': clientAt,
    };

Map<String, dynamic> reachJson({int used = 0, String status = 'published'}) => {
      'noticeId': 'n1',
      'title': 'Mid-semester exam timetable',
      'status': status,
      'ackRequired': true,
      'deadline': '2026-10-03T11:30:00.000Z',
      'publishedAt': '2026-09-30T04:30:00.000Z',
      'audience': 10,
      'acknowledged': 4,
      'seen': 3,
      'notSeen': 2,
      'notOnJuvi': 1,
      'dismissed': 0,
      'late': 1,
      'reminders': {'used': used, 'max': 2, 'lastAt': used == 0 ? null : '2026-10-01T04:00:00.000Z'},
      'sparkline': [0, 1, 2, 4],
      'groups': [
        {'label': '2024 Batch · A', 'total': 6, 'acknowledged': 3, 'seen': 2, 'notSeen': 1, 'notOnJuvi': 0},
        {'label': '2024 Batch · B', 'total': 4, 'acknowledged': 1, 'seen': 1, 'notSeen': 1, 'notOnJuvi': 1},
      ],
      'lateAcks': [
        {'name': 'Kavya Rao', 'identifier': '24JIT0007', 'group': '2024 Batch · A', 'at': '2026-10-03T12:00:00.000Z'},
      ],
      'comments': [
        {'name': 'Rahul Menon', 'identifier': null, 'group': '2024 Batch · B', 'at': '2026-10-01T05:00:00.000Z', 'comment': 'Room 204 clashes with lab.', 'late': false},
      ],
      'addedLater': {
        'total': 1,
        'acknowledged': 0,
        'seen': 1,
        'items': [
          {'name': 'Ishaan Gupta', 'identifier': '24JIT0042', 'group': '2024 Batch · A', 'at': null, 'state': 'seen'},
        ],
      },
      'asOf': '2026-10-01T06:00:00.000Z',
    };

Map<String, dynamic> pendingJson({String? nextCursor, List<Map<String, dynamic>>? items}) => {
      'items': items ??
          [
            {'name': 'Aditya Nair', 'identifier': '24JIT0001', 'group': '2024 Batch · A', 'state': 'seen', 'lastSeenInApp': '2026-10-01T05:30:00.000Z'},
            {'name': 'Meera Iyer', 'identifier': null, 'group': '2024 Batch · B', 'state': 'not_on_juvi', 'lastSeenInApp': null},
          ],
      'total': 2,
      'groups': [
        {'label': '2024 Batch · A', 'count': 1},
        {'label': '2024 Batch · B', 'count': 1},
      ],
      'nextCursor': nextCursor,
    };
```

```dart
// mobile/test/core/repos/notices_repository_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart';

import 'notices_fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late AppDatabase db;
  late ApiNoticesRepository repo;
  late List<RequestOptions> sent;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    sent = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      sent.add(o);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio);
    db = AppDatabase.memory();
    repo = ApiNoticesRepository(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), dio, db);
  });
  tearDown(() => db.close());

  test('attention parses the contract payload, nulls included, and caches it', () async {
    adapter.onGet('/attention', (s) => s.reply(200, attentionJson([cardJson('n1'), cardJson('n2', deadline: null)], dueCount: 5)));
    final fresh = await repo.attention();
    expect(fresh.data.dueCount, 5);
    expect(fresh.data.items.map((c) => c.id), ['n1', 'n2']);
    expect(fresh.data.items.first.deadline, DateTime.utc(2026, 10, 3, 11, 30));
    expect(fresh.data.items.last.deadline, isNull);
    expect(fresh.data.items.first.ackAt, isNull);
    expect(fresh.data.items.first.needsAck, isTrue);
    expect((await repo.cachedAttention())?.data.dueCount, 5);
  });

  test('list sends the segment and caches only the unfiltered first page', () async {
    adapter
      ..onGet('/notices', (s) => s.reply(200, {'items': [cardJson('n1')], 'nextCursor': 'abc'}), queryParameters: {'segment': 'all'})
      ..onGet('/notices', (s) => s.reply(200, {'items': [cardJson('n2')], 'nextCursor': null}), queryParameters: {'segment': 'all', 'cursor': 'abc'});
    final first = await repo.list(NoticeSegment.all);
    expect(first.nextCursor, 'abc');
    final second = await repo.list(NoticeSegment.all, cursor: 'abc');
    expect(second.items.single.id, 'n2');
    expect(second.nextCursor, isNull);
    expect((await repo.cachedList(NoticeSegment.all))?.data.items.single.id, 'n1');
    expect(await repo.cachedList(NoticeSegment.due), isNull);
  });

  test('detail parses attachments and the flattened acknowledgement, and caches it', () async {
    adapter.onGet('/notices/n1', (s) => s.reply(200, detailJson('n1', attachments: [pdfAttachment])));
    final d = (await repo.detail('n1')).data;
    expect(d.attachments.single.name, 'timetable.pdf');
    expect(d.ackMethod, isNull);
    expect(d.ackClientAt, isNull);
    expect(d.item.id, 'n1');
    expect((await repo.cachedDetail('n1'))?.data.body, contains('mid-semester'));
  });

  test('markSeen moves a cached received notice to seen', () async {
    adapter
      ..onGet('/notices/n1', (s) => s.reply(200, detailJson('n1')))
      ..onPost('/notices/n1/seen', (s) => s.reply(200, {'seenAt': '2026-10-01T04:00:00.000Z'}));
    await repo.detail('n1');
    expect(await repo.markSeen('n1'), DateTime.utc(2026, 10, 1, 4));
    final cached = (await repo.cachedDetail('n1'))!.data;
    expect(cached.state, 'seen');
    expect(cached.seenAt, DateTime.utc(2026, 10, 1, 4));
  });

  test('acknowledge sends method, offline and a UTC clientAt, omits a null comment, and updates the caches', () async {
    adapter
      ..onGet('/attention', (s) => s.reply(200, attentionJson([cardJson('n1'), cardJson('n2')], dueCount: 4)))
      ..onGet('/notices/n1', (s) => s.reply(200, detailJson('n1')))
      ..onPost('/notices/n1/ack', (s) => s.reply(200, ackJson(offline: true, clientAt: '2026-10-01T04:59:00.000Z')), data: Matchers.any);
    await repo.attention();
    await repo.detail('n1');
    final record = await repo.acknowledge(
      'n1',
      AckInput(method: AckMethod.hold, offline: true, clientAt: DateTime.utc(2026, 10, 1, 4, 59)),
    );
    expect(record.method, 'hold');
    expect(record.offline, isTrue);
    final body = jsonDecode(sent.last.data as String) as Map<String, dynamic>;
    expect(body, {'method': 'hold', 'offline': true, 'clientAt': '2026-10-01T04:59:00.000Z'});
    final cached = (await repo.cachedDetail('n1'))!.data;
    expect(cached.state, 'acknowledged');
    expect(cached.ackAt, DateTime.utc(2026, 10, 1, 5));
    expect(cached.ackOffline, isTrue);
    final attention = (await repo.cachedAttention())!.data;
    expect(attention.items.map((i) => i.id), ['n2']);
    expect(attention.dueCount, 3);
  });

  test('a 409 ALREADY_ACKNOWLEDGED returns the existing record from error.ack', () async {
    adapter.onPost(
      '/notices/n1/ack',
      (s) => s.reply(409, {
        'error': {'code': 'ALREADY_ACKNOWLEDGED', 'message': 'You have already acknowledged this notice.', 'ack': ackJson(late: true, method: 'confirm')},
      }),
      data: Matchers.any,
    );
    final record = await repo.acknowledge('n1', const AckInput(method: AckMethod.hold));
    expect(record.method, 'confirm');
    expect(record.isLate, isTrue);
  });

  test('a 409 NOTICE_ARCHIVED on acknowledge is a failure', () async {
    adapter.onPost(
      '/notices/n1/ack',
      (s) => s.reply(409, {'error': {'code': 'NOTICE_ARCHIVED', 'message': 'This notice has been archived.'}}),
      data: Matchers.any,
    );
    await expectLater(
      repo.acknowledge('n1', const AckInput(method: AckMethod.confirm)),
      throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.noticeArchived).having((f) => f.status, 'status', 409)),
    );
  });

  test('a notice the caller did not receive is NOTICE_NOT_FOUND', () async {
    adapter.onGet('/notices/zz', (s) => s.reply(404, {'error': {'code': 'NOTICE_NOT_FOUND', 'message': 'This notice is not available.'}}));
    await expectLater(repo.detail('zz'), throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.noticeNotFound)));
  });

  test('attachmentUrl sends the key as one encoded path segment', () async {
    adapter.onGet(
      '/notices/n1/attachments/colleges%2Fc1%2Fnotices%2F7f3a',
      (s) => s.reply(200, {'url': 'https://s3.test/signed?x=1', 'expiresAt': '2026-10-01T05:05:00.000Z'}),
    );
    final url = await repo.attachmentUrl('n1', 'colleges/c1/notices/7f3a');
    expect(url.host, 's3.test');
    expect(sent.last.uri.path, '/v1/notices/n1/attachments/colleges%2Fc1%2Fnotices%2F7f3a');
  });

  test('reach parses counts that reconcile, and the late, comment and added-later lists', () async {
    adapter.onGet('/notices/n1/reach', (s) => s.reply(200, reachJson()));
    final r = await repo.reach('n1');
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi, r.audience);
    expect(r.lateCount, 1);
    expect(r.comments.single.identifier, isNull);
    expect(r.addedLater.items.single.at, isNull);
    expect(r.reminders.lastAt, isNull);
  });

  test('pending passes group, search and cursor', () async {
    adapter.onGet(
      '/notices/n1/reach/pending',
      (s) => s.reply(200, pendingJson()),
      queryParameters: {'group': '2024 Batch · A', 'q': 'adi', 'cursor': 'c2'},
    );
    final p = await repo.pending('n1', group: '2024 Batch · A', q: 'adi', cursor: 'c2');
    expect(p.items.last.lastSeenInApp, isNull);
    expect(p.groups, hasLength(2));
  });

  test('a student calling reach gets NOT_PUBLISHER', () async {
    adapter.onGet('/notices/n1/reach', (s) => s.reply(403, {'error': {'code': 'NOT_PUBLISHER', 'message': 'Only the publisher of this notice can do that.'}}));
    await expectLater(repo.reach('n1'), throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.notPublisher)));
  });

  test('a third reminder is refused with the reminder budget in error.reminders', () async {
    adapter.onPost(
      '/notices/n1/remind',
      (s) => s.reply(409, {
        'error': {
          'code': 'REMINDER_LIMIT',
          'message': 'A notice can have at most two reminders.',
          'reminders': {'used': 2, 'max': 2, 'lastAt': '2026-10-01T04:00:00.000Z'},
        },
      }),
    );
    try {
      await repo.remind('n1');
      fail('expected REMINDER_LIMIT');
    } on ApiFailure catch (f) {
      expect(f.code, ApiErrorCode.reminderLimit);
      expect(f.message, 'A notice can have at most two reminders.');
      expect(Reminders.fromJson(f.reminders!).exhausted, isTrue);
    }
  });

  test('firstNotice returns the welcome notice and caches it as a detail', () async {
    adapter.onGet('/onboarding/first-notice', (s) => s.reply(200, detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome')));
    final d = await repo.firstNotice();
    expect(d.purpose, 'welcome');
    expect(d.deadline, isNull);
    expect((await repo.cachedDetail('w1'))?.data.title, 'Welcome to Juvi');
  });
}
```

Add a test to `mobile/test/core/http/api_failure_test.dart`, before the final closing brace of `main()`:

```dart
  test('notice codes map, and error.ack / error.reminders are read from the raw envelope', () {
    final ack = ApiFailure.fromDio(_dio(409, {
      'error': {'code': 'ALREADY_ACKNOWLEDGED', 'message': 'Already', 'ack': {'ackAt': '2026-10-01T05:00:00.000Z', 'late': false, 'method': 'hold', 'offline': false, 'comment': null, 'clientAt': null}},
    }));
    expect(ack.code, ApiErrorCode.alreadyAcknowledged);
    expect(ack.ackRecord?['method'], 'hold');
    expect(ack.reminders, isNull);
    final limit = ApiFailure.fromDio(_dio(409, {
      'error': {'code': 'REMINDER_LIMIT', 'message': 'At most two', 'reminders': {'used': 2, 'max': 2, 'lastAt': null}},
    }));
    expect(limit.code, ApiErrorCode.reminderLimit);
    expect(limit.reminders?['used'], 2);
    for (final (wire, code) in [
      ('NOTICE_NOT_FOUND', ApiErrorCode.noticeNotFound),
      ('NOTICE_ARCHIVED', ApiErrorCode.noticeArchived),
      ('NOT_PUBLISHER', ApiErrorCode.notPublisher),
      ('ACK_REQUIRED', ApiErrorCode.ackRequired),
      ('ACK_NOT_REQUIRED', ApiErrorCode.ackNotRequired),
    ]) {
      expect(ApiErrorCode.fromWire(wire), code);
    }
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd mobile && flutter test test/core/repos/notices_repository_test.dart test/core/http/api_failure_test.dart`
Expected: FAIL — compilation errors: `Target of URI doesn't exist: 'package:juvi/core/models/notices.dart'` and `The getter 'ackRecord' isn't defined for the type 'ApiFailure'`.

- [ ] **Step 3: Add the notice error codes to `ApiFailure`**

In `mobile/lib/core/http/api_failure.dart`, replace the enum's value list:

```dart
  forbidden, notFound, gone, updateRequired, cooldown, institutionPaused, internal, offline, unknown;
```

with:

```dart
  forbidden, notFound, gone, updateRequired, cooldown, institutionPaused, internal,
  // Juvi notices (notices spec §7.1).
  noticeNotFound, alreadyAcknowledged, noticeArchived, notPublisher, reminderLimit, ackRequired, ackNotRequired,
  offline, unknown;
```

In `fromWire`, after `'INTERNAL' => internal,` add:

```dart
        'NOTICE_NOT_FOUND' => noticeNotFound,
        'ALREADY_ACKNOWLEDGED' => alreadyAcknowledged,
        'NOTICE_ARCHIVED' => noticeArchived,
        'NOT_PUBLISHER' => notPublisher,
        'REMINDER_LIMIT' => reminderLimit,
        'ACK_REQUIRED' => ackRequired,
        'ACK_NOT_REQUIRED' => ackNotRequired,
```

After the `fields` getter add:

```dart

  /// The existing acknowledgement on a 409 `ALREADY_ACKNOWLEDGED` (`error.ack`), raw.
  Map<String, dynamic>? get ackRecord => _object('ack');

  /// The reminder budget on a 409 `REMINDER_LIMIT` (`error.reminders`), raw.
  Map<String, dynamic>? get reminders => _object('reminders');

  Map<String, dynamic>? _object(String key) {
    final v = detail[key];
    return v is Map ? Map<String, dynamic>.from(v) : null;
  }
```

`SessionController.handleFailure` switches exhaustively on `ApiErrorCode`, so the new values must be listed. In `mobile/lib/core/session/session_controller.dart`, replace:

```dart
      case ApiErrorCode.internal:
      case ApiErrorCode.offline:
      case ApiErrorCode.unknown:
        break;
```

with:

```dart
      case ApiErrorCode.internal:
      case ApiErrorCode.noticeNotFound:
      case ApiErrorCode.alreadyAcknowledged:
      case ApiErrorCode.noticeArchived:
      case ApiErrorCode.notPublisher:
      case ApiErrorCode.reminderLimit:
      case ApiErrorCode.ackRequired:
      case ApiErrorCode.ackNotRequired:
      case ApiErrorCode.offline:
      case ApiErrorCode.unknown:
        break;
```

- [ ] **Step 4: Write the models**

```dart
// mobile/lib/core/models/notices.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'notices.freezed.dart';
part 'notices.g.dart';

/// `GET /notices?segment=`. `published` lists the notices the caller published.
enum NoticeSegment { due, done, all, published }

/// How an acknowledgement was made: a 1.2 s hold, or tap-then-confirm (spec §4 US-2.2).
enum AckMethod { hold, confirm }

/// A notice as a card or a list row (contract `NoticeCard`). Nullable dates arrive
/// as ISO strings or null; `late` is a Dart keyword, so the field is `isLate`.
@freezed
abstract class NoticeItem with _$NoticeItem {
  const factory NoticeItem({
    required String id,
    required String title,
    required String preview,
    required String office,
    required String audienceLine,
    required String priority, // routine | important | urgent
    required String purpose, // standard | welcome
    required bool ackRequired,
    required bool ackCommentAllowed,
    required bool archived,
    required int attachmentCount,
    required String state, // received | seen | acknowledged | dismissed
    @JsonKey(name: 'late') required bool isLate,
    required bool isPublisher,
    DateTime? deadline,
    DateTime? publishedAt,
    DateTime? seenAt,
    DateTime? ackAt,
    DateTime? remindedAt,
  }) = _NoticeItem;
  const NoticeItem._();
  factory NoticeItem.fromJson(Map<String, dynamic> json) => _$NoticeItemFromJson(json);

  bool get isAcknowledged => state == 'acknowledged';

  /// Still waiting for this person's acknowledgement (the server's Due rule, spec §7.1).
  bool get needsAck => ackRequired && !isAcknowledged && !archived && state != 'dismissed';
}

@freezed
abstract class NoticeAttachment with _$NoticeAttachment {
  const factory NoticeAttachment({required String key, required String name, required String mime, required int size}) = _NoticeAttachment;
  factory NoticeAttachment.fromJson(Map<String, dynamic> json) => _$NoticeAttachmentFromJson(json);
}

/// The S04 payload (contract `NoticeDetail`): every card field, plus the body,
/// attachments and the caller's acknowledgement record, flattened.
@freezed
abstract class NoticeDetail with _$NoticeDetail {
  const factory NoticeDetail({
    required String id,
    required String title,
    required String preview,
    required String office,
    required String audienceLine,
    required String priority,
    required String purpose,
    required bool ackRequired,
    required bool ackCommentAllowed,
    required bool archived,
    required int attachmentCount,
    required String state,
    @JsonKey(name: 'late') required bool isLate,
    required bool isPublisher,
    required String body,
    required List<NoticeAttachment> attachments,
    required bool ackOffline,
    DateTime? deadline,
    DateTime? publishedAt,
    DateTime? seenAt,
    DateTime? ackAt,
    DateTime? remindedAt,
    String? ackMethod, // hold | confirm
    String? ackComment,
    DateTime? ackClientAt,
    DateTime? dismissedAt,
  }) = _NoticeDetail;
  const NoticeDetail._();
  factory NoticeDetail.fromJson(Map<String, dynamic> json) => _$NoticeDetailFromJson(json);

  bool get isAcknowledged => state == 'acknowledged';
  bool get needsAck => item.needsAck;

  NoticeItem get item => NoticeItem(
        id: id,
        title: title,
        preview: preview,
        office: office,
        audienceLine: audienceLine,
        priority: priority,
        purpose: purpose,
        ackRequired: ackRequired,
        ackCommentAllowed: ackCommentAllowed,
        archived: archived,
        attachmentCount: attachmentCount,
        state: state,
        isLate: isLate,
        isPublisher: isPublisher,
        deadline: deadline,
        publishedAt: publishedAt,
        seenAt: seenAt,
        ackAt: ackAt,
        remindedAt: remindedAt,
      );
}

/// `GET /attention`: the Due count and at most three items (spec §7.1).
@freezed
abstract class AttentionData with _$AttentionData {
  const factory AttentionData({required int dueCount, required List<NoticeItem> items}) = _AttentionData;
  factory AttentionData.fromJson(Map<String, dynamic> json) => _$AttentionDataFromJson(json);
}

@freezed
abstract class NoticePage with _$NoticePage {
  const factory NoticePage({required List<NoticeItem> items, String? nextCursor}) = _NoticePage;
  factory NoticePage.fromJson(Map<String, dynamic> json) => _$NoticePageFromJson(json);
}

/// The acknowledgement record: the `POST /ack` 200 body, and `error.ack` on a 409
/// `ALREADY_ACKNOWLEDGED`.
@freezed
abstract class AckRecord with _$AckRecord {
  const factory AckRecord({
    required DateTime ackAt,
    @JsonKey(name: 'late') required bool isLate,
    required String method,
    required bool offline,
    String? comment,
    DateTime? clientAt,
  }) = _AckRecord;
  factory AckRecord.fromJson(Map<String, dynamic> json) => _$AckRecordFromJson(json);
}

/// `reminders` on reach and remind, and `error.reminders` on a 409 `REMINDER_LIMIT`.
@freezed
abstract class Reminders with _$Reminders {
  const factory Reminders({required int used, required int max, DateTime? lastAt}) = _Reminders;
  const Reminders._();
  factory Reminders.fromJson(Map<String, dynamic> json) => _$RemindersFromJson(json);
  bool get exhausted => used >= max;
}

@freezed
abstract class ReachPerson with _$ReachPerson {
  const factory ReachPerson({required String name, required String group, String? identifier, DateTime? at}) = _ReachPerson;
  factory ReachPerson.fromJson(Map<String, dynamic> json) => _$ReachPersonFromJson(json);
}

@freezed
abstract class ReachComment with _$ReachComment {
  const factory ReachComment({
    required String name,
    required String group,
    required String comment,
    @JsonKey(name: 'late') required bool isLate,
    String? identifier,
    DateTime? at,
  }) = _ReachComment;
  factory ReachComment.fromJson(Map<String, dynamic> json) => _$ReachCommentFromJson(json);
}

@freezed
abstract class ReachGroup with _$ReachGroup {
  const factory ReachGroup({
    required String label,
    required int total,
    required int acknowledged,
    required int seen,
    required int notSeen,
    required int notOnJuvi,
  }) = _ReachGroup;
  factory ReachGroup.fromJson(Map<String, dynamic> json) => _$ReachGroupFromJson(json);
}

@freezed
abstract class ReachAddedLaterItem with _$ReachAddedLaterItem {
  const factory ReachAddedLaterItem({
    required String name,
    required String group,
    required String state, // acknowledged | seen | not_seen | not_on_juvi
    String? identifier,
    DateTime? at,
  }) = _ReachAddedLaterItem;
  factory ReachAddedLaterItem.fromJson(Map<String, dynamic> json) => _$ReachAddedLaterItemFromJson(json);
}

@freezed
abstract class ReachAddedLater with _$ReachAddedLater {
  const factory ReachAddedLater({
    required int total,
    required int acknowledged,
    required int seen,
    required List<ReachAddedLaterItem> items,
  }) = _ReachAddedLater;
  factory ReachAddedLater.fromJson(Map<String, dynamic> json) => _$ReachAddedLaterFromJson(json);
}

/// S11 (contract `NoticeReach`). The four snapshot buckets add up to [audience]
/// (spec §6.5); added-later members are counted on their own.
@freezed
abstract class NoticeReachData with _$NoticeReachData {
  const factory NoticeReachData({
    required String noticeId,
    required String title,
    required String status, // publishing | published | archived
    required bool ackRequired,
    required int audience,
    required int acknowledged,
    required int seen,
    required int notSeen,
    required int notOnJuvi,
    required int dismissed,
    @JsonKey(name: 'late') required int lateCount,
    required Reminders reminders,
    required List<int> sparkline,
    required List<ReachGroup> groups,
    required List<ReachPerson> lateAcks,
    required List<ReachComment> comments,
    required ReachAddedLater addedLater,
    required DateTime asOf,
    DateTime? deadline,
    DateTime? publishedAt,
  }) = _NoticeReachData;
  factory NoticeReachData.fromJson(Map<String, dynamic> json) => _$NoticeReachDataFromJson(json);
}

@freezed
abstract class PendingPerson with _$PendingPerson {
  const factory PendingPerson({
    required String name,
    required String group,
    required String state, // seen | not_seen | not_on_juvi
    String? identifier,
    DateTime? lastSeenInApp,
  }) = _PendingPerson;
  factory PendingPerson.fromJson(Map<String, dynamic> json) => _$PendingPersonFromJson(json);
}

@freezed
abstract class PendingGroup with _$PendingGroup {
  const factory PendingGroup({required String label, required int count}) = _PendingGroup;
  factory PendingGroup.fromJson(Map<String, dynamic> json) => _$PendingGroupFromJson(json);
}

@freezed
abstract class PendingPage with _$PendingPage {
  const factory PendingPage({
    required List<PendingPerson> items,
    required int total,
    required List<PendingGroup> groups,
    String? nextCursor,
  }) = _PendingPage;
  factory PendingPage.fromJson(Map<String, dynamic> json) => _$PendingPageFromJson(json);
}

/// The body of `POST /notices/:id/ack`, and the payload of a queued `notice.ack`.
class AckInput {
  const AckInput({required this.method, this.comment, this.offline = false, this.clientAt});

  /// Rebuilds a queued `notice.ack` payload (`lib/features/notices/notice_actions.dart`).
  factory AckInput.fromQueued(Map<String, dynamic> p) => AckInput(
        method: AckMethod.values.byName(p['method'] as String),
        comment: p['comment'] as String?,
        offline: p['offline'] as bool? ?? true,
        clientAt: DateTime.tryParse(p['clientAt'] as String? ?? '')?.toUtc(),
      );

  final AckMethod method;
  final String? comment;
  final bool offline;

  /// Device time of the gesture, in UTC: the server accepts an ISO date with an offset only.
  final DateTime? clientAt;
}
```

- [ ] **Step 5: Write the repository**

```dart
// mobile/lib/core/repos/notices_repository.dart
import 'package:dio/dio.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notices_repository.g.dart';

abstract class NoticesRepository {
  Future<Cached<AttentionData>?> cachedAttention();
  Future<Cached<AttentionData>> attention();
  Future<Cached<NoticePage>?> cachedList(NoticeSegment segment);
  Future<NoticePage> list(NoticeSegment segment, {String? office, String? cursor});
  Future<Cached<NoticeDetail>?> cachedDetail(String id);
  Future<Cached<NoticeDetail>> detail(String id);
  Future<DateTime> markSeen(String id);
  Future<AckRecord> acknowledge(String id, AckInput input);
  Future<DateTime> dismiss(String id);
  Future<Uri> attachmentUrl(String id, String key);
  Future<NoticeReachData> reach(String id);
  Future<PendingPage> pending(String id, {String? group, String? q, String? cursor});
  Future<Reminders> remind(String id);
  Future<NoticeDetail> firstNotice();
}

/// Every notices endpoint but one goes through the generated `wire.MobileApi`. Checked
/// field by field against `mobile/api/openapi.json` (`Attention`, `NoticeList`,
/// `NoticeDetail`, `SeenResult`, `AckRequest`, `AckResult`, `DismissResult`,
/// `NoticeReach`, `NoticePending`, `RemindResult`) and the generated models in
/// `packages/juvi_api/lib/src/model/`: the contract has no object-or-null field (every
/// nested object is always present, every nullable value is a scalar), so the
/// R57/R61 generator gap does not apply, and `AckRequest.toJson` omits a null
/// `comment`/`clientAt` (the server's strict schema refuses `null` for either).
///
/// `attachmentUrl` uses the shared Dio directly: the key contains slashes
/// (`colleges/<cid>/notices/<uuid>`) and the generated `getNoticeAttachmentUrl` puts
/// it into the path unencoded, so Express would see extra path segments and 404. The
/// key is sent as one `Uri.encodeComponent` segment, as `mobile-routes.ts` expects.
///
/// `error.ack` (409 `ALREADY_ACKNOWLEDGED`) and `error.reminders` (409
/// `REMINDER_LIMIT`) are read from the raw envelope through `ApiFailure.ackRecord` /
/// `ApiFailure.reminders`; no generated error model is involved.
class ApiNoticesRepository implements NoticesRepository {
  ApiNoticesRepository(this._api, this._dio, this._db);
  final wire.MobileApi _api;
  final Dio _dio;
  final AppDatabase _db;

  static const attentionKey = 'attention';
  static String listKey(NoticeSegment s) => 'notices:${s.name}';
  static String detailKey(String id) => 'notice:$id';

  Future<T> _guard<T>(Future<T> Function() f) async {
    try {
      return await f();
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<Cached<AttentionData>?> cachedAttention() async {
    final doc = await _db.readDoc(attentionKey);
    return doc == null ? null : Cached(AttentionData.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<AttentionData>> attention() => _guard(() async {
        final json = (await _api.getAttention()).data!.toJson();
        final now = DateTime.now().toUtc();
        await _db.writeDoc(attentionKey, json, now);
        return Cached(AttentionData.fromJson(json), now);
      });

  @override
  Future<Cached<NoticePage>?> cachedList(NoticeSegment segment) async {
    final doc = await _db.readDoc(listKey(segment));
    return doc == null ? null : Cached(NoticePage.fromJson(doc.json), doc.asOf);
  }

  /// Only the unfiltered first page of each segment is cached, so the attention sheet
  /// opens offline; later pages and office filters need a connection.
  @override
  Future<NoticePage> list(NoticeSegment segment, {String? office, String? cursor}) => _guard(() async {
        final json = (await _api.listNotices(segment: segment.name, office: office, cursor: cursor)).data!.toJson();
        if (office == null && cursor == null) await _db.writeDoc(listKey(segment), json, DateTime.now().toUtc());
        return NoticePage.fromJson(json);
      });

  @override
  Future<Cached<NoticeDetail>?> cachedDetail(String id) async {
    final doc = await _db.readDoc(detailKey(id));
    return doc == null ? null : Cached(NoticeDetail.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<NoticeDetail>> detail(String id) => _guard(() async {
        final json = (await _api.getNotice(id: id)).data!.toJson();
        final now = DateTime.now().toUtc();
        await _db.writeDoc(detailKey(id), json, now);
        return Cached(NoticeDetail.fromJson(json), now);
      });

  /// Rewrites the cached detail document (if any) with [patch], keeping its as-of time.
  Future<void> _patchDetail(String id, Map<String, dynamic> Function(Map<String, dynamic> json) patch) async {
    final doc = await _db.readDoc(detailKey(id));
    if (doc != null) await _db.writeDoc(detailKey(id), {...doc.json, ...patch(doc.json)}, doc.asOf);
  }

  Future<void> _dropFromAttention(String id) async {
    final doc = await _db.readDoc(attentionKey);
    if (doc == null) return;
    final items = (doc.json['items'] as List).cast<Map<String, dynamic>>();
    final kept = items.where((i) => i['id'] != id).toList();
    if (kept.length == items.length) return;
    final due = (doc.json['dueCount'] as int) - 1;
    await _db.writeDoc(attentionKey, {...doc.json, 'items': kept, 'dueCount': due < 0 ? 0 : due}, doc.asOf);
  }

  @override
  Future<DateTime> markSeen(String id) => _guard(() async {
        final seenAt = (await _api.markNoticeSeen(id: id)).data!.seenAt;
        await _patchDetail(id, (j) => {'seenAt': seenAt, if (j['state'] == 'received') 'state': 'seen'});
        return DateTime.parse(seenAt);
      });

  /// A 409 `ALREADY_ACKNOWLEDGED` is an acknowledgement that exists, so it returns the
  /// server's existing record (from `error.ack`) instead of failing (spec §4 US-2.3).
  /// Once confirmed, the notice leaves the cached attention document too, so the next
  /// read of `attentionProvider` drops the card before the network answers.
  @override
  Future<AckRecord> acknowledge(String id, AckInput input) => _guard(() async {
        AckRecord record;
        try {
          final r = await _api.acknowledgeNotice(
            id: id,
            ackRequest: wire.AckRequest(
              method: wire.AckRequestMethodEnum.values.byName(input.method.name),
              comment: input.comment,
              offline: input.offline,
              clientAt: input.clientAt?.toUtc(),
            ),
          );
          record = AckRecord.fromJson(r.data!.toJson());
        } on Object catch (e) {
          final f = ApiFailure.of(e);
          final existing = f.ackRecord;
          if (f.code != ApiErrorCode.alreadyAcknowledged || existing == null) throw f;
          record = AckRecord.fromJson(existing);
        }
        await _patchDetail(id, (j) => {
              'state': 'acknowledged',
              'seenAt': j['seenAt'] ?? record.ackAt.toIso8601String(),
              'ackAt': record.ackAt.toIso8601String(),
              'late': record.isLate,
              'ackMethod': record.method,
              'ackOffline': record.offline,
              'ackComment': record.comment,
              'ackClientAt': record.clientAt?.toIso8601String(),
            });
        await _dropFromAttention(id);
        return record;
      });

  @override
  Future<DateTime> dismiss(String id) => _guard(() async {
        final dismissedAt = (await _api.dismissNotice(id: id)).data!.dismissedAt;
        await _patchDetail(id, (j) => {'state': 'dismissed', 'dismissedAt': dismissedAt, 'seenAt': j['seenAt'] ?? dismissedAt});
        return DateTime.parse(dismissedAt);
      });

  @override
  Future<Uri> attachmentUrl(String id, String key) => _guard(() async {
        final r = await _dio.get<Map<String, dynamic>>('/notices/$id/attachments/${Uri.encodeComponent(key)}');
        return Uri.parse(r.data!['url'] as String);
      });

  @override
  Future<NoticeReachData> reach(String id) =>
      _guard(() async => NoticeReachData.fromJson((await _api.getNoticeReach(id: id)).data!.toJson()));

  @override
  Future<PendingPage> pending(String id, {String? group, String? q, String? cursor}) => _guard(() async =>
      PendingPage.fromJson((await _api.listNoticePending(id: id, group: group, q: q, cursor: cursor)).data!.toJson()));

  @override
  Future<Reminders> remind(String id) =>
      _guard(() async => Reminders.fromJson((await _api.remindNotice(id: id)).data!.reminders.toJson()));

  @override
  Future<NoticeDetail> firstNotice() => _guard(() async {
        final json = (await _api.getFirstNotice()).data!.toJson();
        final detail = NoticeDetail.fromJson(json);
        await _db.writeDoc(detailKey(detail.id), json, DateTime.now().toUtc());
        return detail;
      });
}

/// Notice ids with an acknowledgement waiting in the offline queue. Their cards show
/// "Will send when online" until `SyncLifecycle` drains it (spec §4 US-3.4); it
/// invalidates this after every drain.
@riverpod
Future<Set<String>> pendingAcks(Ref ref) async {
  final db = await ref.read(appDatabaseProvider.future);
  return {
    for (final a in await db.pendingActions())
      if (a.type == 'notice.ack') a.payload['noticeId'] as String,
  };
}

@Riverpod(keepAlive: true)
Future<NoticesRepository> noticesRepository(Ref ref) async =>
    ApiNoticesRepository(ref.read(mobileApiProvider), ref.read(dioProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network, same shape as `me` in `me_repository.dart`. Its `dueCount`
/// is the one number behind the tab badge, the attention stack's "+N more" and the
/// sheet's Due segment (spec §4 US-3.2).
@riverpod
Stream<Cached<AttentionData>> attention(Ref ref) async* {
  final repo = await ref.read(noticesRepositoryProvider.future);
  final c = await repo.cachedAttention();
  if (c != null) yield c;
  try {
    yield await repo.attention();
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}

@riverpod
Stream<Cached<NoticeDetail>> noticeDetail(Ref ref, String id) async* {
  final repo = await ref.read(noticesRepositoryProvider.future);
  final c = await repo.cachedDetail(id);
  if (c != null) yield c;
  try {
    yield await repo.detail(id);
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}
```

- [ ] **Step 6: Generate, analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs`
Expected: ends with `Built with build_runner/aot in …; wrote … outputs.` and creates `lib/core/models/notices.freezed.dart`, `lib/core/models/notices.g.dart`, `lib/core/repos/notices_repository.g.dart`.

Run: `cd mobile && flutter analyze`
Expected: `No issues found!`

Run: `cd mobile && flutter test test/core/repos/notices_repository_test.dart test/core/http/api_failure_test.dart`
Expected: `+18: All tests passed!` (14 repository tests, 4 `ApiFailure` tests).

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+108: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+8: All tests passed!`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/core/models/notices.dart mobile/lib/core/models/notices.freezed.dart mobile/lib/core/models/notices.g.dart mobile/lib/core/repos/notices_repository.dart mobile/lib/core/repos/notices_repository.g.dart mobile/lib/core/http/api_failure.dart mobile/lib/core/session/session_controller.dart mobile/test/core/repos/notices_fixtures.dart mobile/test/core/repos/notices_repository_test.dart mobile/test/core/http/api_failure_test.dart
git commit -m "feat(mobile): notice models, error codes and NoticesRepository

Cached-then-network attention and detail, segment lists, seen, acknowledge
(409 ALREADY_ACKNOWLEDGED returns the existing record), dismiss, reach,
pending, remind and the first notice. Generated client everywhere except the
attachment URL, whose slash-bearing key is sent as one encoded segment.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The `notice.ack` offline queue and its replay

**Files:**
- Create: `mobile/lib/features/notices/notice_actions.dart`, `mobile/test/features/notices/notice_actions_test.dart`
- Modify: `mobile/lib/core/repos/notices_repository.dart` (`pendingAcks` provider), `mobile/lib/core/sync/pending_action.dart:23`, `mobile/lib/core/sync/sync_worker.dart`, `mobile/lib/core/sync/sync_lifecycle.dart:57-67`, `mobile/test/core/sync/sync_worker_test.dart`, `mobile/test/core/sync/sync_lifecycle_test.dart`

**Interfaces:**
- Consumes: Task 1 `NoticesRepository.acknowledge/dismiss`, `AckInput`, `AckRecord`, `AckMethod`, `attentionProvider`, `noticeDetailProvider`; `PendingAction.create`, `AppDatabase.enqueueAction/pendingActions`; `analyticsProvider`.
- Produces:
  ```dart
  // lib/core/repos/notices_repository.dart
  final pendingAcksProvider;   // Future<Set<String>>: notice ids with a queued notice.ack
  // lib/features/notices/notice_actions.dart
  enum AckOutcome { sent, queued }
  Future<AckOutcome> acknowledgeNotice(WidgetRef ref, String noticeId, AckMethod method, {String? comment});
  Future<void> dismissNotice(WidgetRef ref, String noticeId);
  void refreshNotice(WidgetRef ref, String noticeId);
  // lib/core/sync/sync_worker.dart
  SyncWorker(AppDatabase db, MeRepository me, SpacesRepository spaces, NoticesRepository notices);
  ```

Decisions that bind later tasks:
- Every acknowledgement in the app goes through `acknowledgeNotice` (attention stack, S04, onboarding step 4), so the online/offline split, the one-per-notice queue rule and the analytics live in one place. It takes a `WidgetRef`, like Foundation's `toggleMute`.
- A comment is trimmed; an empty one is sent as no comment.
- `pendingAcksProvider` lives in `core/repos` (not `features/`) because `SyncLifecycle` invalidates it after every drain, sent or dropped.
- In `SyncWorker`, a `notice.ack` that gets any 409 is removed and counted as **sent**: `ALREADY_ACKNOWLEDGED` never reaches the worker (the repository returns the existing record), and `NOTICE_ARCHIVED` / `ACK_NOT_REQUIRED` mean the notice no longer takes an acknowledgement (spec §9: "a 409 on replay counts as success"). Other 4xx keep Foundation's drop rule; offline keeps the R60 no-attempt rule.
- `refreshNotice` invalidates `attentionProvider` and `noticeDetailProvider(id)`; Task 6 adds the sheet's list.

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/features/notices/notice_actions_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:mocktail/mocktail.dart';

class _Notices extends Mock implements NoticesRepository {}

/// Records every tracked event with its props.
class SpyAnalytics implements Analytics {
  final events = <(String, Map<String, Object?>)>[];
  @override
  void track(String event, [Map<String, Object?> props = const {}]) => events.add((event, props));
}

/// Pumps a bare `Consumer` and hands back its `WidgetRef`, as `spaces_repository_test.dart` does.
Future<WidgetRef> pumpRef(WidgetTester t, List<Override> overrides) async {
  late WidgetRef captured;
  await t.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: overrides,
    child: MaterialApp(home: Consumer(builder: (context, ref, _) {
      captured = ref;
      return const SizedBox();
    })),
  ));
  await t.pump();
  return captured;
}

void main() {
  late _Notices repo;
  late AppDatabase db;
  late SpyAnalytics analytics;
  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() {
    repo = _Notices();
    db = AppDatabase.memory();
    analytics = SpyAnalytics();
  });
  tearDown(() => db.close());

  List<Override> overrides() => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(analytics),
      ];

  testWidgets('online: waits for the server, tracks {late, method} and queues nothing', (t) async {
    when(() => repo.acknowledge('n1', any()))
        .thenAnswer((_) async => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: true, method: 'hold', offline: false));
    final ref = await pumpRef(t, overrides());

    expect(await acknowledgeNotice(ref, 'n1', AckMethod.hold, comment: '  '), AckOutcome.sent);

    final input = verify(() => repo.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.offline, isFalse);
    expect(input.comment, isNull);
    expect(analytics.events.single.$1, 'notice.acknowledged');
    expect(analytics.events.single.$2, {'noticeId': 'n1', 'late': true, 'method': 'hold'});
    expect(await db.pendingActions(), isEmpty);
  });

  testWidgets('online failure is rethrown, nothing is queued and nothing is tracked', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.', status: 500));
    final ref = await pumpRef(t, overrides());

    await expectLater(acknowledgeNotice(ref, 'n1', AckMethod.confirm), throwsA(isA<ApiFailure>()));
    expect(await db.pendingActions(), isEmpty);
    expect(analytics.events, isEmpty);
  });

  testWidgets('offline: queues one notice.ack with offline and a UTC clientAt, and marks it pending', (t) async {
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    final ref = await pumpRef(t, overrides());

    expect(await acknowledgeNotice(ref, 'n1', AckMethod.confirm, comment: 'Noted'), AckOutcome.queued);
    expect(await acknowledgeNotice(ref, 'n1', AckMethod.confirm), AckOutcome.queued);

    final queued = await db.pendingActions();
    expect(queued, hasLength(1));
    expect(queued.single.type, 'notice.ack');
    expect(queued.single.payload['noticeId'], 'n1');
    expect(queued.single.payload['method'], 'confirm');
    expect(queued.single.payload['comment'], 'Noted');
    expect(queued.single.payload['offline'], isTrue);
    expect(DateTime.parse(queued.single.payload['clientAt'] as String).isUtc, isTrue);
    expect(await ref.read(pendingAcksProvider.future), {'n1'});
  });

  testWidgets('dismiss tracks notice.dismissed', (t) async {
    when(() => repo.dismiss('n2')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 5));
    final ref = await pumpRef(t, overrides());

    await dismissNotice(ref, 'n2');
    expect(analytics.events.single.$1, 'notice.dismissed');
    expect(analytics.events.single.$2, {'noticeId': 'n2'});
  });
}
```

In `mobile/test/core/sync/sync_worker_test.dart`, add the imports:

```dart
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
```

replace the mock declarations and `setUp`:

```dart
class _Spaces extends Mock implements SpacesRepository {}

void main() {
  late AppDatabase db; late _Me me; late _Spaces spaces; late SyncWorker w;
  setUp(() { db = AppDatabase.memory(); me = _Me(); spaces = _Spaces(); w = SyncWorker(db, me, spaces); });
```

with:

```dart
class _Spaces extends Mock implements SpacesRepository {}
class _Notices extends Mock implements NoticesRepository {}

void main() {
  late AppDatabase db; late _Me me; late _Spaces spaces; late _Notices notices; late SyncWorker w;
  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() { db = AppDatabase.memory(); me = _Me(); spaces = _Spaces(); notices = _Notices(); w = SyncWorker(db, me, spaces, notices); });
```

and add before the final closing brace of `main()`:

```dart
  Map<String, dynamic> queuedAck(String id) =>
      {'noticeId': id, 'method': 'confirm', 'comment': null, 'clientAt': '2026-10-01T04:59:00.000Z', 'offline': true};
  AckRecord record() => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: true);

  test('replays a queued notice.ack as an offline acknowledgement with its clientAt', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any())).thenAnswer((_) async => record());
    final r = await w.drain();
    expect(r, const DrainResult(sent: 1, deferred: 0, dropped: 0));
    final input = verify(() => notices.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.method, AckMethod.confirm);
    expect(input.offline, isTrue);
    expect(input.clientAt, DateTime.utc(2026, 10, 1, 4, 59));
    expect(input.comment, isNull);
  });

  test('a 409 on a replayed notice.ack counts as sent', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any()))
        .thenThrow(const ApiFailure(ApiErrorCode.noticeArchived, 'This notice has been archived.', status: 409));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 1, deferred: 0, dropped: 0));
    expect(await db.pendingActions(), isEmpty);
  });

  test('a queued notice.ack stays queued while offline', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, 'off'));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 1, dropped: 0));
    expect((await db.pendingActions()).single.type, 'notice.ack');
  });
```

In `mobile/test/core/sync/sync_lifecycle_test.dart`, add the imports:

```dart
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
```

add a mock after `_Spaces`:

```dart

class _Notices extends Mock implements NoticesRepository {}
```

replace the `host` signature and its first three overrides:

```dart
Widget host({required AppDatabase db, required MeRepository me, required SpacesRepository spaces, required Analytics analytics, required Stream<bool> online}) =>
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        appDatabaseProvider.overrideWith((_) async => db),
        meRepositoryProvider.overrideWith((_) async => me),
        spacesRepositoryProvider.overrideWith((_) async => spaces),
```

with:

```dart
Widget host({
  required AppDatabase db,
  required MeRepository me,
  required SpacesRepository spaces,
  required Analytics analytics,
  required Stream<bool> online,
  NoticesRepository? notices,
}) =>
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        appDatabaseProvider.overrideWith((_) async => db),
        meRepositoryProvider.overrideWith((_) async => me),
        spacesRepositoryProvider.overrideWith((_) async => spaces),
        noticesRepositoryProvider.overrideWith((_) async => notices ?? _Notices()),
```

and add before the final closing brace of `main()`:

```dart
  testWidgets('a notice.ack queued before launch is replayed at startup', (t) async {
    registerFallbackValue(const AckInput(method: AckMethod.hold));
    final notices = _Notices();
    await db.enqueueAction(PendingAction.create('notice.ack', {'noticeId': 'n1', 'method': 'hold', 'comment': null, 'clientAt': '2026-10-01T04:59:00.000Z', 'offline': true}));
    when(() => notices.acknowledge('n1', any()))
        .thenAnswer((_) async => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'hold', offline: true));
    final controller = StreamController<bool>();
    addTearDown(controller.close);

    await t.pumpWidget(host(db: db, me: me, spaces: spaces, analytics: analytics, online: controller.stream, notices: notices));
    await t.pumpAndSettle();

    verify(() => notices.acknowledge('n1', any())).called(1);
    expect(await db.pendingActions(), isEmpty);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/notices/notice_actions_test.dart test/core/sync`
Expected: FAIL — compilation errors: `Target of URI doesn't exist: 'package:juvi/features/notices/notice_actions.dart'`, `Too many positional arguments: 3 expected, but 4 found` (`SyncWorker`), `Undefined name 'pendingAcksProvider'`.

- [ ] **Step 3: Add `pendingAcksProvider`**

In `mobile/lib/core/repos/notices_repository.dart`, insert above `@Riverpod(keepAlive: true)\nFuture<NoticesRepository> noticesRepository`:

```dart
/// Notice ids with an acknowledgement waiting in the offline queue. Their cards show
/// "Will send when online" until `SyncLifecycle` drains it (spec §4 US-3.4); it
/// invalidates this after every drain.
@riverpod
Future<Set<String>> pendingAcks(Ref ref) async {
  final db = await ref.read(appDatabaseProvider.future);
  return {
    for (final a in await db.pendingActions())
      if (a.type == 'notice.ack') a.payload['noticeId'] as String,
  };
}

```

- [ ] **Step 4: Replay `notice.ack` in `SyncWorker`**

In `mobile/lib/core/sync/pending_action.dart`, change the `type` comment to:

```dart
  final String type; // settings.patch | channel.mute | channel.unmute | channel.read | notice.ack
```

In `mobile/lib/core/sync/sync_worker.dart`, add the imports:

```dart
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
```

extend the class doc comment, after `/// next item; ten attempts or a 4xx that is not a cooldown drops the action (spec §11).`:

```dart
/// A replayed `notice.ack` that gets a 409 is sent, not dropped: the server already
/// holds an acknowledgement for it, or the notice no longer takes one (notices spec §9).
```

replace the constructor and fields:

```dart
  SyncWorker(this._db, this._me, this._spaces);
  final AppDatabase _db;
  final MeRepository _me;
  final SpacesRepository _spaces;
```

with:

```dart
  SyncWorker(this._db, this._me, this._spaces, this._notices);
  final AppDatabase _db;
  final MeRepository _me;
  final SpacesRepository _spaces;
  final NoticesRepository _notices;
```

in `drain()`, directly after the offline branch's closing `}` (the one following `break;`), add:

```dart
          if (a.type == 'notice.ack' && f.status == 409) {
            await _db.removeAction(a.id);
            sent++;
            continue;
          }
```

and in `_apply`, after the `channel.read` case add:

```dart
      case 'notice.ack': await _notices.acknowledge(a.payload['noticeId'] as String, AckInput.fromQueued(a.payload));
```

In `mobile/lib/core/sync/sync_lifecycle.dart`, add `import 'package:juvi/core/repos/notices_repository.dart';` and replace:

```dart
      final spaces = await ref.read(spacesRepositoryProvider.future);
      final result = await SyncWorker(db, me, spaces).drain();
      if (result.sent > 0) ref..invalidate(meProvider)..invalidate(spacesProvider);
```

with:

```dart
      final spaces = await ref.read(spacesRepositoryProvider.future);
      final notices = await ref.read(noticesRepositoryProvider.future);
      final result = await SyncWorker(db, me, spaces, notices).drain();
      // Sent or dropped, a drained `notice.ack` no longer shows "Will send when online".
      ref.invalidate(pendingAcksProvider);
      if (result.sent > 0) ref..invalidate(meProvider)..invalidate(spacesProvider)..invalidate(attentionProvider);
```

- [ ] **Step 5: Write `notice_actions.dart`**

```dart
// mobile/lib/features/notices/notice_actions.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/sync/pending_action.dart';

enum AckOutcome { sent, queued }

/// Acknowledges [noticeId]. Online it is not optimistic: the caller keeps the card
/// until this returns [AckOutcome.sent], and a failure is rethrown so the caller can
/// restore the card with a message (spec §4 US-3.3). Offline the acknowledgement is
/// queued as `notice.ack` with `offline: true` and the gesture's `clientAt`, once per
/// notice, and this returns [AckOutcome.queued] (spec §4 US-3.4, §9).
Future<AckOutcome> acknowledgeNotice(WidgetRef ref, String noticeId, AckMethod method, {String? comment}) async {
  final clientAt = DateTime.now().toUtc();
  final trimmed = comment?.trim();
  final note = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  final repo = await ref.read(noticesRepositoryProvider.future);
  try {
    final record = await repo.acknowledge(noticeId, AckInput(method: method, comment: note));
    ref.read(analyticsProvider).track('notice.acknowledged', {'noticeId': noticeId, 'late': record.isLate, 'method': method.name});
    refreshNotice(ref, noticeId);
    return AckOutcome.sent;
  } on ApiFailure catch (f) {
    if (!f.isOffline) rethrow;
    if (!(await ref.read(pendingAcksProvider.future)).contains(noticeId)) {
      final db = await ref.read(appDatabaseProvider.future);
      await db.enqueueAction(PendingAction.create('notice.ack', {
        'noticeId': noticeId,
        'method': method.name,
        'comment': note,
        'clientAt': clientAt.toIso8601String(),
        'offline': true,
      }));
    }
    // The server decides `late` when the queued acknowledgement arrives.
    ref.read(analyticsProvider).track('notice.acknowledged', {'noticeId': noticeId, 'late': null, 'method': method.name});
    ref.invalidate(pendingAcksProvider);
    return AckOutcome.queued;
  }
}

/// Dismisses a notice that needs no acknowledgement. Online only: a failure, offline
/// included, is rethrown for the caller to show.
Future<void> dismissNotice(WidgetRef ref, String noticeId) async {
  final repo = await ref.read(noticesRepositoryProvider.future);
  await repo.dismiss(noticeId);
  ref.read(analyticsProvider).track('notice.dismissed', {'noticeId': noticeId});
  refreshNotice(ref, noticeId);
}

/// Re-reads everything that shows [noticeId]'s state.
void refreshNotice(WidgetRef ref, String noticeId) {
  ref
    ..invalidate(attentionProvider)
    ..invalidate(noticeDetailProvider(noticeId));
}
```

- [ ] **Step 6: Generate, analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter analyze`
Expected: `Built with build_runner/aot …`, then `No issues found!`

Run: `cd mobile && flutter test test/features/notices/notice_actions_test.dart test/core/sync`
Expected: `+19: All tests passed!` (4 action tests; `sync_worker_test.dart` 7 + 3; `sync_lifecycle_test.dart` 4 + 1).

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+116: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+8: All tests passed!`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/features/notices/notice_actions.dart mobile/lib/core/repos/notices_repository.dart mobile/lib/core/repos/notices_repository.g.dart mobile/lib/core/sync mobile/test/features/notices/notice_actions_test.dart mobile/test/core/sync
git commit -m "feat(mobile): queue offline notice acknowledgements and replay them

Online acknowledgement waits for the server; offline it is queued as
notice.ack with offline and clientAt, once per notice. SyncWorker replays it
at launch, reconnect and resume, and a 409 on replay counts as sent.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `DeadlineRing` and `AckControl`

**Files:**
- Create: `mobile/lib/features/notices/widgets/deadline_ring.dart`, `mobile/lib/features/notices/widgets/ack_control.dart`, `mobile/test/features/notices/host.dart`, `mobile/test/features/notices/ack_control_test.dart`, `mobile/test/features/notices/deadline_ring_test.dart`, `mobile/test/features/notices/deadline_ring_golden_test.dart`, `mobile/test/features/notices/goldens/deadline_ring_light.png`, `mobile/test/features/notices/goldens/deadline_ring_dark.png` (generated)
- Modify: `mobile/lib/app/l10n/app_en.arb` (+ regenerated `app_localizations.dart`, `app_localizations_en.dart`), `mobile/lib/shared/format.dart`

**Interfaces:**
- Consumes: `AckMethod` (Task 1); `buildTheme` (`lib/app/theme.dart`); `context.l10n`.
- Produces:
  ```dart
  String dayMonthTime(DateTime t);   // lib/shared/format.dart — "Fri 3 Oct, 17:00", en_IN, local time
  class DeadlineRing extends StatelessWidget {
    const DeadlineRing({required DateTime deadline, DateTime? start, DateTime? now, double size = 40});
    static double remaining({required DateTime deadline, required DateTime now, DateTime? start});   // 1 → 0
  }
  class AckControl extends StatefulWidget {
    const AckControl({required ValueChanged<AckMethod> onAcknowledge, bool busy = false});
    static const holdDuration = Duration(milliseconds: 1200);
  }
  Widget noticeHost(Widget child, {List<Override> overrides, bool accessibleNavigation, double textScale, Brightness brightness, bool scroll});  // test/features/notices/host.dart
  ```

Decisions that bind later tasks:
- `AckControl` is one control: hold for 1.2 s (ring fills, haptic, `AckMethod.hold`), or release earlier — a tap — which opens the confirmation dialog (`AckMethod.confirm` on "Acknowledge", nothing on "Cancel"). Under `MediaQuery.accessibleNavigation` it renders a plain "Acknowledge" `FilledButton` that only opens the confirmation. The hold control's semantics are a button whose tap action is the confirm path, so a screen reader's double-tap can never hold.
- `AckControl` reports the gesture; the caller performs the acknowledgement and passes `busy: true` while it waits, which shows a progress indicator and ignores input. The `GestureDetector` stays in the tree while busy: if it were swapped out with the finger still down, the enclosing card's `InkWell` would win the tap and open S04 (caught by Task 10's flow test; Task 4 has the regression test).
- `DeadlineRing` depletes over `[start, deadline]` (`start` = `publishedAt`), shows days / hours / minutes left in the centre, and is empty with a red track and "!" once the deadline has passed. Its semantics label is "Acknowledge by …" or "Deadline passed …". It takes `now` so tests and goldens are deterministic; production passes nothing.

- [ ] **Step 1: Add the strings and the date helper**

Append to `mobile/lib/app/l10n/app_en.arb` (before the closing `}`; add a comma after the current last entry):

```json
  "cancel": "Cancel",
  "ackHoldLabel": "Hold to acknowledge",
  "@ackHoldLabel": { "description": "AckControl: the press-and-hold control's label (spec §4 US-2.2)." },
  "ackHoldHint": "or tap to confirm",
  "@ackHoldHint": { "description": "AckControl: second line under the hold label; a short tap opens the confirmation instead." },
  "ackButton": "Acknowledge",
  "@ackButton": { "description": "AckControl under a screen reader (confirm path forced), and the confirm dialog's action." },
  "ackOpensConfirmation": "Opens a confirmation",
  "@ackOpensConfirmation": { "description": "Accessible hint on the acknowledge control." },
  "ackConfirmTitle": "Acknowledge this notice?",
  "ackConfirmBody": "The office will see that you have read it, and when.",
  "deadlineDaysShort": "{days}d",
  "@deadlineDaysShort": { "description": "DeadlineRing centre: whole days left.", "placeholders": { "days": { "type": "int" } } },
  "deadlineHoursShort": "{hours}h",
  "@deadlineHoursShort": { "description": "DeadlineRing centre: whole hours left.", "placeholders": { "hours": { "type": "int" } } },
  "deadlineMinutesShort": "{minutes}m",
  "@deadlineMinutesShort": { "description": "DeadlineRing centre: minutes left.", "placeholders": { "minutes": { "type": "int" } } },
  "deadlineDueBy": "Acknowledge by {when}",
  "@deadlineDueBy": { "placeholders": { "when": { "type": "String" } } },
  "deadlinePassed": "Deadline passed {when}",
  "@deadlinePassed": { "placeholders": { "when": { "type": "String" } } }
```

Append to `mobile/lib/shared/format.dart`:

```dart

/// "Fri 3 Oct, 17:00": notice deadlines, publish times and acknowledgement times.
String dayMonthTime(DateTime t) => DateFormat('EEE d MMM, HH:mm', 'en_IN').format(t.toLocal());
```

Run: `cd mobile && flutter gen-l10n`
Expected: no output; `lib/app/l10n/app_localizations.dart` gains `ackHoldLabel`, `deadlineDueBy` and the rest.

- [ ] **Step 2: Write the test host and the failing tests**

```dart
// mobile/test/features/notices/host.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/theme.dart';

/// A localized, themed host for the notices widgets. `accessibleNavigation` stands in
/// for a running screen reader; `textScale` exercises large text.
Widget noticeHost(
  Widget child, {
  List<Override> overrides = const [],
  bool accessibleNavigation = false,
  double textScale = 1,
  Brightness brightness = Brightness.light,
  bool scroll = true,
}) =>
    ProviderScope(
      retry: (_, _) => null,
      overrides: overrides,
      child: MaterialApp(
        theme: buildTheme(brightness: brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(accessibleNavigation: accessibleNavigation, textScaler: TextScaler.linear(textScale)),
          child: app!,
        ),
        home: Scaffold(body: scroll ? ListView(padding: const EdgeInsets.all(16), children: [child]) : child),
      ),
    );
```

```dart
// mobile/test/features/notices/ack_control_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';

import 'host.dart';

void main() {
  late List<AckMethod> acks;
  setUp(() => acks = []);

  Widget control({bool a11y = false, bool busy = false, double textScale = 1}) =>
      noticeHost(AckControl(onAcknowledge: acks.add, busy: busy), accessibleNavigation: a11y, textScale: textScale);

  Finder dialogButton(String label) => find.descendant(of: find.byType(AlertDialog), matching: find.text(label));

  testWidgets('a 1.2 s hold acknowledges with method hold, and no dialog opens', (t) async {
    await t.pumpWidget(control());
    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    // The host is a ListView, so the press is recognised after kPressTimeout (100 ms)
    // and the ring starts filling on the next frame.
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 1100));
    expect(acks, isEmpty);
    await t.pump(const Duration(milliseconds: 150));
    expect(acks, [AckMethod.hold]);
    await g.up();
    await t.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(acks, [AckMethod.hold]);
  });

  testWidgets('releasing early does not acknowledge; it offers the confirmation, and Cancel keeps it unacknowledged', (t) async {
    await t.pumpWidget(control());
    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 600));
    await g.up();
    await t.pumpAndSettle();
    expect(acks, isEmpty);
    expect(find.text('Acknowledge this notice?'), findsOneWidget);
    await t.tap(dialogButton('Cancel'));
    await t.pumpAndSettle();
    expect(acks, isEmpty);
  });

  testWidgets('tap then confirm acknowledges with method confirm', (t) async {
    await t.pumpWidget(control());
    await t.tap(find.byType(AckControl));
    await t.pumpAndSettle();
    expect(acks, isEmpty);
    await t.tap(dialogButton('Acknowledge'));
    await t.pumpAndSettle();
    expect(acks, [AckMethod.confirm]);
  });

  testWidgets('under a screen reader a hold never acknowledges; only the confirm path does', (t) async {
    await t.pumpWidget(control(a11y: true));
    expect(find.text('Hold to acknowledge'), findsNothing);
    final g = await t.startGesture(t.getCenter(find.widgetWithText(FilledButton, 'Acknowledge')));
    await t.pump();
    await t.pump(const Duration(milliseconds: 1500));
    expect(acks, isEmpty);
    await g.up();
    await t.pumpAndSettle();
    expect(acks, isEmpty);
    await t.tap(dialogButton('Acknowledge'));
    await t.pumpAndSettle();
    expect(acks, [AckMethod.confirm]);
  });

  testWidgets('the hold control exposes a button whose semantic tap opens the confirmation', (t) async {
    final semantics = t.ensureSemantics();
    await t.pumpWidget(control());
    expect(
      t.getSemantics(find.byType(AckControl)),
      matchesSemantics(label: 'Hold to acknowledge', hint: 'Opens a confirmation', isButton: true, hasTapAction: true),
    );
    semantics.dispose();
  });

  testWidgets('busy shows progress and ignores a hold', (t) async {
    await t.pumpWidget(control(busy: true));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 1500));
    await g.up();
    await t.pump();
    expect(acks, isEmpty);
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('text scale 2.0 lays out without overflow and keeps a 44 pt target', (t) async {
    await t.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(control(textScale: 2));
    expect(t.takeException(), isNull);
    expect(t.getSize(find.byType(AckControl)).height, greaterThanOrEqualTo(44));
  });
}
```

```dart
// mobile/test/features/notices/deadline_ring_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/shared/format.dart';

import 'host.dart';

void main() {
  final start = DateTime.utc(2026, 10);
  final deadline = DateTime.utc(2026, 10, 5);

  test('remaining depletes from 1 to 0 across the window and stays 0 after it', () {
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: start), 1);
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 2)), closeTo(0.75, 1e-9));
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: deadline), 0);
    expect(DeadlineRing.remaining(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 9)), 0);
    expect(DeadlineRing.remaining(deadline: deadline, now: DateTime.utc(2026, 10, 2)), 1);
  });

  testWidgets('shows the time left, and the due time to a screen reader', (t) async {
    await t.pumpWidget(noticeHost(DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 2))));
    expect(find.text('3d'), findsOneWidget);
    expect(find.bySemanticsLabel('Acknowledge by ${dayMonthTime(deadline)}'), findsOneWidget);
    await t.pumpWidget(noticeHost(DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 4, 19))));
    expect(find.text('5h'), findsOneWidget);
  });

  testWidgets('after the deadline it says so', (t) async {
    await t.pumpWidget(noticeHost(DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 6))));
    expect(find.text('!'), findsOneWidget);
    expect(find.bySemanticsLabel('Deadline passed ${dayMonthTime(deadline)}'), findsOneWidget);
  });
}
```

```dart
// mobile/test/features/notices/deadline_ring_golden_test.dart
@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';

import 'host.dart';

void main() {
  final start = DateTime.utc(2026, 10);
  final deadline = DateTime.utc(2026, 10, 5);
  for (final brightness in Brightness.values) {
    testWidgets('DeadlineRing golden ${brightness.name}', (t) async {
      await t.binding.setSurfaceSize(const Size(260, 80));
      addTearDown(() => t.binding.setSurfaceSize(null));
      await t.pumpWidget(noticeHost(
        Row(
          key: const ValueKey('rings'),
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 1, 6)),
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 3)),
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 4, 21)),
            DeadlineRing(deadline: deadline, start: start, now: DateTime.utc(2026, 10, 6)),
          ],
        ),
        brightness: brightness,
      ));
      await expectLater(find.byKey(const ValueKey('rings')), matchesGoldenFile('goldens/deadline_ring_${brightness.name}.png'));
    });
  }
}
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/notices/ack_control_test.dart test/features/notices/deadline_ring_test.dart`
Expected: FAIL — `Target of URI doesn't exist: 'package:juvi/features/notices/widgets/ack_control.dart'` (and `deadline_ring.dart`).

- [ ] **Step 4: Write the widgets**

```dart
// mobile/lib/features/notices/widgets/deadline_ring.dart
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/shared/format.dart';

/// A ring that depletes from full (just published) to empty (the deadline), with the
/// time left in the centre; empty and red once the deadline has passed (spec §9).
class DeadlineRing extends StatelessWidget {
  const DeadlineRing({required this.deadline, this.start, this.now, this.size = 40, super.key});
  final DateTime deadline;

  /// When the window opened (the notice's `publishedAt`); without it the ring starts full.
  final DateTime? start;

  /// The current time; injectable so tests and goldens are deterministic.
  final DateTime? now;
  final double size;

  /// The share of the window still left, from 1 down to 0; 0 once the deadline has passed.
  static double remaining({required DateTime deadline, required DateTime now, DateTime? start}) {
    if (!now.isBefore(deadline)) return 0;
    final total = deadline.difference(start ?? now).inSeconds;
    if (total <= 0) return 1;
    return (deadline.difference(now).inSeconds / total).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final at = now ?? DateTime.now();
    final overdue = !at.isBefore(deadline);
    final left = deadline.difference(at);
    final centre = overdue
        ? '!'
        : left.inDays >= 1
            ? l.deadlineDaysShort(left.inDays)
            : left.inHours >= 1
                ? l.deadlineHoursShort(left.inHours)
                : l.deadlineMinutesShort(math.max(1, left.inMinutes));
    return Semantics(
      label: overdue ? l.deadlinePassed(dayMonthTime(deadline)) : l.deadlineDueBy(dayMonthTime(deadline)),
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _RingPainter(
            fraction: remaining(deadline: deadline, now: at, start: start),
            track: overdue ? scheme.error : scheme.outlineVariant,
            arc: scheme.primary,
          ),
          child: Center(
            child: Text(
              centre,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: overdue ? scheme.error : scheme.onSurface,
                  ),
              textScaler: TextScaler.noScaling,
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction, required this.track, required this.arc});
  final double fraction;
  final Color track;
  final Color arc;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 4.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 2 * math.pi, false, paint..color = track);
    if (fraction > 0) canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * fraction, false, paint..color = arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction || old.track != track || old.arc != arc;
}
```

```dart
// mobile/lib/features/notices/widgets/ack_control.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/notices.dart';

/// The deliberate acknowledgement gesture (spec §4 US-2.2, §9). Holding for
/// [holdDuration] fills the ring and acknowledges with [AckMethod.hold]; a shorter
/// press is a tap, which opens a confirmation that acknowledges with
/// [AckMethod.confirm]. There is no single-tap path. Under a screen reader
/// (`MediaQuery.accessibleNavigation`) only the confirm path is offered.
///
/// The hold is timed from the moment the press is recognised. Inside a scrollable,
/// Flutter waits `kPressTimeout` (100 ms) to tell a press from a scroll first, so a
/// scroll that starts on the control never acknowledges.
class AckControl extends StatefulWidget {
  const AckControl({required this.onAcknowledge, this.busy = false, super.key});
  final ValueChanged<AckMethod> onAcknowledge;

  /// True while the caller waits for the server; the control shows progress and takes
  /// no input. The gesture detector stays in the tree, so a finger still down when the
  /// hold completes is never handed to an enclosing tap target (the card's `InkWell`).
  final bool busy;

  static const holdDuration = Duration(milliseconds: 1200);

  @override
  State<AckControl> createState() => _AckControlState();
}

class _AckControlState extends State<AckControl> with SingleTickerProviderStateMixin {
  late final AnimationController _hold;
  bool _held = false;

  @override
  void initState() {
    super.initState();
    _hold = AnimationController(vsync: this, duration: AckControl.holdDuration)..addStatusListener(_onHoldStatus);
  }

  void _onHoldStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || widget.busy) return;
    _held = true;
    unawaited(HapticFeedback.mediumImpact());
    widget.onAcknowledge(AckMethod.hold);
  }

  void _down(TapDownDetails _) {
    if (widget.busy) return;
    _held = false;
    unawaited(_hold.forward(from: 0));
  }

  void _up(TapUpDetails _) {
    if (_held) {
      _held = false;
      _hold.reset();
      return;
    }
    _hold.reset();
    if (!widget.busy) unawaited(_confirm());
  }

  Future<void> _confirm() async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(l.ackConfirmTitle),
        content: Text(l.ackConfirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.of(c).pop(true), child: Text(l.ackButton)),
        ],
      ),
    );
    if ((ok ?? false) && mounted && !widget.busy) widget.onAcknowledge(AckMethod.confirm);
  }

  @override
  void dispose() {
    _hold.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final busy = widget.busy;
    const spinner = SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.5));
    if (MediaQuery.accessibleNavigationOf(context)) {
      return Semantics(
        hint: l.ackOpensConfirmation,
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(onPressed: busy ? null : _confirm, child: busy ? spinner : Text(l.ackButton)),
        ),
      );
    }
    return Semantics(
      button: true,
      label: l.ackHoldLabel,
      hint: l.ackOpensConfirmation,
      onTap: busy ? null : _confirm,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _down,
        onTapUp: _up,
        onTapCancel: _hold.reset,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(28)),
          child: busy
              ? const Center(child: spinner)
              : Row(
                  children: [
                    SizedBox.square(
                      dimension: 32,
                      child: AnimatedBuilder(
                        animation: _hold,
                        builder: (_, _) => Stack(
                          alignment: Alignment.center,
                          children: [
                            CircularProgressIndicator(value: _hold.value, strokeWidth: 3, backgroundColor: scheme.surface.withValues(alpha: 0.6)),
                            Icon(Icons.check, size: 18, color: scheme.onPrimaryContainer),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l.ackHoldLabel,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(color: scheme.onPrimaryContainer, fontWeight: FontWeight.w700),
                          ),
                          Text(l.ackHoldHint, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onPrimaryContainer)),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Analyze, run the tests and generate the new goldens**

Run: `cd mobile && flutter analyze`
Expected: `No issues found!`

Run: `cd mobile && flutter test test/features/notices --exclude-tags golden`
Expected: `+14: All tests passed!` (7 `AckControl`, 3 `DeadlineRing`, 4 notice actions).

Run: `cd mobile && flutter test test/features/notices/deadline_ring_golden_test.dart --update-goldens`
Expected: `+2: All tests passed!`, writing `test/features/notices/goldens/deadline_ring_light.png` and `deadline_ring_dark.png`. Open one: four rings left to right — nearly full, half, a sliver, and an empty red ring with "!" (text renders as Ahem boxes in tests).

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+126: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+10: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/notices/widgets mobile/lib/shared/format.dart mobile/lib/app/l10n mobile/test/features/notices
git commit -m "feat(mobile): DeadlineRing and AckControl

A 1.2 s hold or tap-then-confirm, with the confirm path forced under a
screen reader and no single-tap acknowledgement; a ring that depletes toward
the deadline and turns red after it. Goldens for the ring.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `NoticeCard`, `NoticeTile` and `AttentionStack`

**Files:**
- Create: `mobile/lib/features/notices/widgets/notice_card.dart`, `mobile/lib/features/notices/widgets/notice_tile.dart`, `mobile/lib/features/notices/widgets/attention_stack.dart`, `mobile/test/features/notices/notice_card_test.dart`, `mobile/test/features/notices/attention_stack_test.dart`, `mobile/test/features/notices/notice_widgets_golden_test.dart`, `mobile/test/features/notices/goldens/notice_card_{light,dark}.png`, `mobile/test/features/notices/goldens/attention_stack_{light,dark}.png` (generated)
- Modify: `mobile/lib/app/l10n/app_en.arb` (+ regenerated `app_localizations*.dart`)

**Interfaces:**
- Consumes: Task 1 `NoticeItem`, `attentionProvider`; Task 2 `pendingAcksProvider`, `acknowledgeNotice`, `AckOutcome`; Task 3 `AckControl`, `DeadlineRing`, `dayMonthTime`, `noticeHost`; Foundation `EmptyState`, `FailureView`, `SkeletonList`.
- Produces:
  ```dart
  class NoticeCard extends StatelessWidget {
    const NoticeCard({required NoticeItem notice, bool pendingAck = false, bool busy = false, VoidCallback? onOpen,
      ValueChanged<AckMethod>? onAcknowledge, DateTime? now});
  }
  class NoticeTile extends StatelessWidget { const NoticeTile({required NoticeItem notice, bool pendingAck = false, VoidCallback? onTap, DateTime? now}); }
  class AttentionStack extends ConsumerStatefulWidget { const AttentionStack({DateTime? now}); static const maxItems = 3; }
  ```

Decisions that bind later tasks:
- `NoticeCard` footer precedence: archived → acknowledged (with "· Late") → queued ("Will send when online") → `AckControl` while `needsAck`. The deadline ring and "Acknowledge by …" line show only while the notice still needs acknowledgement.
- `NoticeTile` trailing precedence: Archived → acknowledged tick → queued cloud icon → deadline ring (or "Due" without a deadline) → "New" for an unopened notice.
- `AttentionStack` renders `attentionProvider` as given (the server orders by deadline, nulls last, then `receivedAt`) and takes at most three; "+N more" is `dueCount − shown`. It navigates with `GoRouter.maybeOf(context)?.push(...)` to `/notices/:id` and `/attention` (the routes land in Tasks 5 and 6; the stack is mounted on Today and Teaching only in Task 6, when both exist), so it is testable without a router.
- Online acknowledgement keeps the card with `busy: true` until the server confirms **and** the refreshed attention value has been read (the repository already dropped the item from the cache in Task 1), so the card never flashes back to its control. A failure shows a SnackBar with the failure's message and restores the control.

- [ ] **Step 1: Add the strings**

Append to `mobile/lib/app/l10n/app_en.arb`:

```json
  "noticeUrgent": "Urgent",
  "@noticeUrgent": { "description": "Priority label on a notice card." },
  "noticeImportant": "Important",
  "@noticeImportant": { "description": "Priority label on a notice card." },
  "noticeWillSendWhenOnline": "Will send when online",
  "@noticeWillSendWhenOnline": { "description": "A notice acknowledged offline, waiting in the queue (spec §4 US-3.4)." },
  "noticeAcknowledgedAt": "Acknowledged {when}",
  "@noticeAcknowledgedAt": { "placeholders": { "when": { "type": "String" } } },
  "noticeAcknowledged": "Acknowledged",
  "noticeLate": "Late",
  "@noticeLate": { "description": "An acknowledgement made after the deadline (spec §4 US-2.4)." },
  "noticeArchived": "Archived",
  "noticeNew": "New",
  "@noticeNew": { "description": "A notice received but not yet opened." },
  "noticeDue": "Due",
  "attentionMore": "+{count} more",
  "@attentionMore": { "description": "Pill under the attention stack: due items beyond the three shown.", "placeholders": { "count": { "type": "int" } } }
```

Run: `cd mobile && flutter gen-l10n`
Expected: no output.

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/features/notices/notice_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

void main() {
  final now = DateTime.utc(2026, 10, 1, 6);
  NoticeItem item(String id, {String state = 'received', String? ackAt, bool late = false, bool archived = false, bool ackRequired = true, String? deadline = '2026-10-03T11:30:00.000Z'}) =>
      NoticeItem.fromJson(cardJson(id, state: state, ackAt: ackAt, late: late, archived: archived, ackRequired: ackRequired, deadline: deadline));

  testWidgets('a due card shows office, priority, the deadline ring and the AckControl', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1'), now: now, onAcknowledge: (_) {})));
    expect(find.text('Exam Section · Important'), findsOneWidget);
    expect(find.byType(DeadlineRing), findsOneWidget);
    expect(find.byType(AckControl), findsOneWidget);
    expect(find.textContaining('Acknowledge by'), findsOneWidget);
  });

  testWidgets('an acknowledged late card says so and offers no control', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1', state: 'acknowledged', ackAt: '2026-10-03T12:00:00.000Z', late: true), now: now, onAcknowledge: (_) {})));
    expect(find.textContaining('Acknowledged'), findsOneWidget);
    expect(find.textContaining('Late'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
    expect(find.byType(DeadlineRing), findsNothing);
  });

  testWidgets('an archived card is read-only and marked Archived', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1', archived: true), now: now, onAcknowledge: (_) {})));
    expect(find.text('Archived'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('a queued acknowledgement shows Will send when online', (t) async {
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1'), pendingAck: true, now: now, onAcknowledge: (_) {})));
    expect(find.text('Will send when online'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('tiles mark new, due, acknowledged and archived notices', (t) async {
    await t.pumpWidget(noticeHost(Column(children: [
      NoticeTile(notice: item('a', ackRequired: false, deadline: null), now: now),
      NoticeTile(notice: item('b', deadline: null), now: now),
      NoticeTile(notice: item('c', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z'), now: now),
      NoticeTile(notice: item('d', archived: true), now: now),
    ])));
    expect(find.text('New'), findsOneWidget);
    expect(find.text('Due'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    expect(find.text('Archived'), findsOneWidget);
  });

  testWidgets('a card at text scale 2.0 lays out without overflow', (t) async {
    await t.binding.setSurfaceSize(const Size(360, 900));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(noticeHost(NoticeCard(notice: item('n1'), now: now, onAcknowledge: (_) {}), textScale: 2));
    expect(t.takeException(), isNull);
  });
}
```

```dart
// mobile/test/features/notices/attention_stack_test.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';
import 'notice_actions_test.dart' show SpyAnalytics;

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late _Notices repo;
  late AppDatabase db;
  late Map<String, dynamic> served;
  final now = DateTime.utc(2026, 10, 1, 6);

  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() {
    repo = _Notices();
    db = AppDatabase.memory();
    served = attentionJson([]);
    when(repo.cachedAttention).thenAnswer((_) async => null);
    when(repo.attention).thenAnswer((_) async => Cached(AttentionData.fromJson(served), DateTime.now()));
  });
  tearDown(() => db.close());

  List<Override> overrides() => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(SpyAnalytics()),
      ];

  Future<void> pumpStack(WidgetTester t) async {
    await t.pumpWidget(noticeHost(AttentionStack(now: now), overrides: overrides()));
    await t.pump();
    await t.pump();
  }

  Future<void> confirmAck(WidgetTester t, String title) async {
    await t.tap(find.descendant(of: find.ancestor(of: find.text(title), matching: find.byType(Card)), matching: find.byType(AckControl)));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
    await t.pump();
  }

  testWidgets("nothing due shows You're clear", (t) async {
    await pumpStack(t);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.byType(Card), findsNothing);
  });

  testWidgets('shows at most three due items in the server order, then a +N more pill', (t) async {
    served = attentionJson([
      cardJson('n1', title: 'Exam timetable'),
      cardJson('n2', title: 'Fee notice', deadline: '2026-10-05T11:30:00.000Z'),
      cardJson('n3', title: 'Library rules', deadline: null),
    ], dueCount: 5);
    await pumpStack(t);
    expect(find.byType(Card), findsNWidgets(3));
    final ys = ['Exam timetable', 'Fee notice', 'Library rules'].map((s) => t.getTopLeft(find.text(s)).dy).toList();
    expect(ys[0], lessThan(ys[1]));
    expect(ys[1], lessThan(ys[2]));
    expect(find.text('+2 more'), findsOneWidget);
  });

  testWidgets('no pill when every due item is shown', (t) async {
    served = attentionJson([cardJson('n1'), cardJson('n2')]);
    await pumpStack(t);
    expect(find.byType(Card), findsNWidgets(2));
    expect(find.textContaining('more'), findsNothing);
  });

  testWidgets('online: the card stays, busy, until the server confirms; then it leaves', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    final reply = Completer<AckRecord>();
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) => reply.future);
    await pumpStack(t);

    await confirmAck(t, 'Exam timetable');
    expect(find.text('Exam timetable'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    served = attentionJson([]);
    reply.complete(AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false));
    await t.pump();
    await t.pump();
    await t.pump();
    expect(find.text('Exam timetable'), findsNothing);
    expect(find.text("You're clear"), findsOneWidget);
  });

  testWidgets('online failure restores the card with a message', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong. Please try again.', status: 500));
    await pumpStack(t);

    await confirmAck(t, 'Exam timetable');
    await t.pump();
    expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
    expect(find.text('Exam timetable'), findsOneWidget);
    expect(find.text('Hold to acknowledge'), findsOneWidget);
  });

  testWidgets('offline: the acknowledgement is queued and the card says Will send when online', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    when(() => repo.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    await pumpStack(t);

    await confirmAck(t, 'Exam timetable');
    await t.pump();
    await t.pump();
    expect(find.text('Will send when online'), findsOneWidget);
    expect(find.text('Hold to acknowledge'), findsNothing);
    expect((await db.pendingActions()).single.type, 'notice.ack');
  });

  testWidgets('a hold on a card acknowledges it and never opens the notice', (t) async {
    served = attentionJson([cardJson('n1', title: 'Exam timetable')]);
    final reply = Completer<AckRecord>();
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) => reply.future);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => Scaffold(body: ListView(children: [AttentionStack(now: now)]))),
      GoRoute(path: '/notices/:id', builder: (_, s) => Text('detail ${s.pathParameters['id']}')),
    ]);
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: overrides(),
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    await t.pump();
    await t.pump();

    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 1250));
    await g.up();
    await t.pump();
    verify(() => repo.acknowledge('n1', any())).called(1);
    expect(find.text('detail n1'), findsNothing);

    served = attentionJson([]);
    reply.complete(AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'hold', offline: false));
    await t.pumpAndSettle();
    expect(find.text('detail n1'), findsNothing);
    expect(find.text("You're clear"), findsOneWidget);
  });

  testWidgets('a failure with nothing cached offers a retry', (t) async {
    when(repo.attention).thenThrow(const ApiFailure(ApiErrorCode.internal, 'Something went wrong.'));
    await pumpStack(t);
    expect(find.text('Try again'), findsOneWidget);
  });
}
```

```dart
// mobile/test/features/notices/notice_widgets_golden_test.dart
@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

void main() {
  final now = DateTime.utc(2026, 10, 1, 6);
  for (final brightness in Brightness.values) {
    testWidgets('NoticeCard golden ${brightness.name}', (t) async {
      await t.binding.setSurfaceSize(const Size(400, 520));
      addTearDown(() => t.binding.setSurfaceSize(null));
      await t.pumpWidget(noticeHost(
        Column(key: const ValueKey('cards'), children: [
          NoticeCard(notice: NoticeItem.fromJson(cardJson('n1')), now: now, onAcknowledge: (_) {}),
          const SizedBox(height: 12),
          NoticeCard(notice: NoticeItem.fromJson(cardJson('n2', title: 'Fee payment window', office: 'Finance', priority: 'urgent', state: 'acknowledged', ackAt: '2026-10-03T12:00:00.000Z', late: true)), now: now),
        ]),
        brightness: brightness,
      ));
      await expectLater(find.byKey(const ValueKey('cards')), matchesGoldenFile('goldens/notice_card_${brightness.name}.png'));
    });

    testWidgets('AttentionStack golden ${brightness.name}', (t) async {
      await t.binding.setSurfaceSize(const Size(400, 900));
      addTearDown(() => t.binding.setSurfaceSize(null));
      final data = AttentionData.fromJson(attentionJson([
        cardJson('n1'),
        cardJson('n2', title: 'Hostel curfew update', office: 'Welfare', deadline: '2026-10-01T09:00:00.000Z'),
        cardJson('n3', title: 'Library rules', office: 'Campus Ops', deadline: null, priority: 'routine'),
      ], dueCount: 5));
      await t.pumpWidget(noticeHost(
        AttentionStack(key: const ValueKey('stack'), now: now),
        brightness: brightness,
        overrides: [
          attentionProvider.overrideWith((_) => Stream.value(Cached(data, now))),
          pendingAcksProvider.overrideWith((_) async => {'n2'}),
        ],
      ));
      await t.pump();
      await t.pump();
      await expectLater(find.byKey(const ValueKey('stack')), matchesGoldenFile('goldens/attention_stack_${brightness.name}.png'));
    });
  }
}
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/notices/notice_card_test.dart test/features/notices/attention_stack_test.dart`
Expected: FAIL — `Target of URI doesn't exist: 'package:juvi/features/notices/widgets/notice_card.dart'` (and `notice_tile.dart`, `attention_stack.dart`).

- [ ] **Step 4: Write the widgets**

```dart
// mobile/lib/features/notices/widgets/notice_card.dart
import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/shared/format.dart';

/// A notice as a card: the attention stack on Today and Teaching (S03, S10). The
/// footer is the acknowledgement state: archived, acknowledged (with Late), queued
/// offline ("Will send when online"), or the [AckControl] while it is still due.
class NoticeCard extends StatelessWidget {
  const NoticeCard({
    required this.notice,
    this.pendingAck = false,
    this.busy = false,
    this.onOpen,
    this.onAcknowledge,
    this.now,
    super.key,
  });
  final NoticeItem notice;

  /// An acknowledgement for this notice is waiting in the offline queue.
  final bool pendingAck;

  /// An online acknowledgement is in flight.
  final bool busy;
  final VoidCallback? onOpen;
  final ValueChanged<AckMethod>? onAcknowledge;

  /// Injectable clock for the deadline ring (tests and goldens).
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final deadline = notice.deadline;
    final showDeadline = deadline != null && notice.needsAck;
    final overdue = deadline != null && !(now ?? DateTime.now()).isBefore(deadline);
    final priority = switch (notice.priority) {
      'urgent' => l.noticeUrgent,
      'important' => l.noticeImportant,
      _ => null,
    };
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text([notice.office, ?priority].join(' · '), style: t.labelMedium),
                        const SizedBox(height: 4),
                        Text(notice.title, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  if (showDeadline) ...[
                    const SizedBox(width: 12),
                    DeadlineRing(deadline: deadline, start: notice.publishedAt, now: now),
                  ],
                ],
              ),
              const SizedBox(height: 6),
              Text(notice.preview, style: t.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
              if (showDeadline) ...[
                const SizedBox(height: 6),
                Text(
                  overdue ? l.deadlinePassed(dayMonthTime(deadline)) : l.deadlineDueBy(dayMonthTime(deadline)),
                  style: t.labelMedium?.copyWith(color: overdue ? scheme.error : null),
                ),
              ],
              const SizedBox(height: 12),
              _Footer(notice: notice, pendingAck: pendingAck, busy: busy, onAcknowledge: onAcknowledge),
            ],
          ),
        ),
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.notice, required this.pendingAck, required this.busy, this.onAcknowledge});
  final NoticeItem notice;
  final bool pendingAck;
  final bool busy;
  final ValueChanged<AckMethod>? onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    Widget line(IconData icon, String text, {Color? color}) => Row(children: [
          Icon(icon, size: 18, color: color ?? scheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: t.labelLarge?.copyWith(color: color))),
        ]);
    final ackAt = notice.ackAt;
    if (notice.archived) return line(Icons.inventory_2_outlined, l.noticeArchived);
    if (notice.isAcknowledged) {
      final text = ackAt == null ? l.noticeAcknowledged : l.noticeAcknowledgedAt(dayMonthTime(ackAt));
      return line(Icons.check_circle, notice.isLate ? '$text · ${l.noticeLate}' : text, color: notice.isLate ? scheme.error : scheme.primary);
    }
    if (pendingAck) return line(Icons.cloud_upload_outlined, l.noticeWillSendWhenOnline);
    if (notice.needsAck && onAcknowledge != null) return AckControl(onAcknowledge: onAcknowledge!, busy: busy);
    return const SizedBox.shrink();
  }
}
```

```dart
// mobile/lib/features/notices/widgets/notice_tile.dart
import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/shared/format.dart';

/// A notice as a list row: the attention sheet's segments (S05) and a channel's
/// notice list (S07). Tapping opens S04.
class NoticeTile extends StatelessWidget {
  const NoticeTile({required this.notice, this.pendingAck = false, this.onTap, this.now, super.key});
  final NoticeItem notice;
  final bool pendingAck;
  final VoidCallback? onTap;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final published = notice.publishedAt;
    final deadline = notice.deadline;
    final Widget trailing;
    if (notice.archived) {
      trailing = Text(l.noticeArchived, style: Theme.of(context).textTheme.labelMedium);
    } else if (notice.isAcknowledged) {
      trailing = Icon(Icons.check_circle, color: notice.isLate ? scheme.error : scheme.primary, semanticLabel: notice.isLate ? '${l.noticeAcknowledged} · ${l.noticeLate}' : l.noticeAcknowledged);
    } else if (pendingAck) {
      trailing = Icon(Icons.cloud_upload_outlined, semanticLabel: l.noticeWillSendWhenOnline);
    } else if (notice.needsAck) {
      trailing = deadline == null ? Text(l.noticeDue, style: Theme.of(context).textTheme.labelLarge) : DeadlineRing(deadline: deadline, start: published, now: now, size: 36);
    } else if (notice.state == 'received') {
      trailing = Text(l.noticeNew, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: scheme.primary));
    } else {
      trailing = const SizedBox.shrink();
    }
    return ListTile(
      onTap: onTap,
      title: Text(notice.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: notice.state == 'received' ? FontWeight.w700 : null)),
      subtitle: Text([notice.office, if (published != null) dayMonthTime(published)].join(' · ')),
      trailing: trailing,
    );
  }
}
```

```dart
// mobile/lib/features/notices/widgets/attention_stack.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// The attention stack on Today and Teaching (spec §4 US-3.1): at most three due
/// acknowledgement cards in the server's order (deadline, nulls last), a "+N more"
/// pill to the attention sheet when more are due, and "You're clear" when none are.
class AttentionStack extends ConsumerStatefulWidget {
  const AttentionStack({this.now, super.key});
  static const maxItems = 3;

  /// Injectable clock for the deadline rings (tests and goldens).
  final DateTime? now;

  @override
  ConsumerState<AttentionStack> createState() => _AttentionStackState();
}

class _AttentionStackState extends ConsumerState<AttentionStack> {
  final _busy = <String>{};

  Future<void> _acknowledge(NoticeItem notice, AckMethod method) async {
    setState(() => _busy.add(notice.id));
    try {
      final outcome = await acknowledgeNotice(ref, notice.id, method);
      // Online, the card stays (busy) until the refreshed attention list drops it.
      if (outcome == AckOutcome.sent) await ref.read(attentionProvider.future);
    } on ApiFailure catch (f) {
      if (mounted) ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(f.message)));
    } finally {
      if (mounted) setState(() => _busy.remove(notice.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final attention = ref.watch(attentionProvider);
    final pending = ref.watch(pendingAcksProvider).value ?? const <String>{};
    return attention.when(
      loading: () => const SkeletonList(count: 1),
      error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(attentionProvider)),
      data: (c) {
        final items = c.data.items.take(AttentionStack.maxItems).toList();
        if (items.isEmpty) return EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint);
        final more = c.data.dueCount - items.length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final n in items)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: NoticeCard(
                  key: ValueKey('attention-${n.id}'),
                  notice: n,
                  pendingAck: pending.contains(n.id),
                  busy: _busy.contains(n.id),
                  now: widget.now,
                  onOpen: () => GoRouter.maybeOf(context)?.push('/notices/${n.id}'),
                  onAcknowledge: (m) => _acknowledge(n, m),
                ),
              ),
            if (more > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: ActionChip(
                  label: Text(l.attentionMore(more)),
                  onPressed: () => GoRouter.maybeOf(context)?.push('/attention'),
                ),
              ),
          ],
        );
      },
    );
  }
}
```

- [ ] **Step 5: Analyze, run the tests and generate the new goldens**

Run: `cd mobile && flutter analyze`
Expected: `No issues found!`

Run: `cd mobile && flutter test test/features/notices --exclude-tags golden`
Expected: `+28: All tests passed!` (adds 6 card/tile tests and 8 attention-stack tests).

Run: `cd mobile && flutter test test/features/notices/notice_widgets_golden_test.dart --update-goldens`
Expected: `+4: All tests passed!`, writing `notice_card_{light,dark}.png` (a due card with its ring and hold control above an acknowledged, late, urgent card) and `attention_stack_{light,dark}.png` (three cards — the second showing "Will send when online" — and a "+2 more" pill).

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+140: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/notices/widgets mobile/lib/app/l10n mobile/test/features/notices
git commit -m "feat(mobile): NoticeCard, NoticeTile and the attention stack

At most three due cards in deadline order, a +N more pill and the clear
state; online acknowledgement keeps the card until the server confirms and
restores it with a message on failure; offline the card says it will send
when online.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: S04 `NoticeDetailScreen` and the `/notices/:id` route

**Files:**
- Create: `mobile/lib/features/notices/notice_detail_screen.dart`, `mobile/lib/features/notices/widgets/linked_text.dart`, `mobile/test/features/notices/notice_detail_screen_test.dart`
- Modify: `mobile/lib/app/router.dart`, `mobile/lib/app/l10n/app_en.arb` (+ regenerated `app_localizations*.dart`), `mobile/test/app/redirect_test.dart`

**Interfaces:**
- Consumes: Task 1 `noticeDetailProvider`, `noticesRepositoryProvider` (`markSeen`, `attachmentUrl`), `NoticeDetail`; Task 2 `acknowledgeNotice`, `dismissNotice`, `pendingAcksProvider`; Task 3 `AckControl`, `DeadlineRing`, `dayMonthTime`; Foundation `isOnlineProvider`, `analyticsProvider`, `AsOfLine`, `EmptyState`, `FailureView`, `SectionHeader`, `SkeletonList`.
- Produces:
  ```dart
  final externalLauncherProvider;   // Provider<Future<bool> Function(Uri)> — launchUrl(…, externalApplication); overridden in tests
  class NoticeDetailScreen extends ConsumerStatefulWidget { const NoticeDetailScreen({required String noticeId, DateTime? now}); }
  class LinkedText extends StatefulWidget {
    const LinkedText(String text, {required ValueChanged<Uri> onOpen, TextStyle? style});
    static List<(String, Uri?)> segments(String text);
  }
  // router: GoRoute('/notices/:id') above the tab shell
  ```

Decisions that bind later tasks:
- On open the screen tracks `notice.opened {noticeId}` once and, the first time a value with `seenAt == null` arrives, calls `markSeen` once (US-2.1). Seen is best-effort: an offline failure is ignored and retried on the next open. Lists never mark seen.
- 404 `NOTICE_NOT_FOUND` (or `NOT_FOUND`) renders "This notice is not available" with no retry (US-2.5); any other failure without a cache is `FailureView` with retry; a stale cache shows the as-of line.
- An archived notice shows an "Archived" banner and no acknowledgement or dismiss controls (US-2.6).
- The comment field appears only when `ackCommentAllowed` (max 500, matching the server). A notice that needs no acknowledgement offers "Dismiss" (online only; offline says "This needs a connection.").
- Attachments are `ListTile`s disabled while offline with "Available when online"; online they fetch the signed URL and open it with `externalLauncherProvider`. Body links (spec §5) use `LinkedText` and the same launcher.
- The publisher (card `isPublisher`) gets "See who has read it", pushing `/notices/:id/reach` (Task 7).
- `/notices/:id` is a top-level route (not inside the tab shell), pushed from anywhere and popped back; `redirect()` needs no change, which the new redirect test pins.

- [ ] **Step 1: Add the strings**

Append to `mobile/lib/app/l10n/app_en.arb`:

```json
  "noticeNotAvailable": "This notice is not available",
  "@noticeNotAvailable": { "description": "S04 when the notice was not sent to this person (404 NOTICE_NOT_FOUND, spec §4 US-2.5)." },
  "noticeNotAvailableHint": "It may not have been sent to you.",
  "noticeArchivedBody": "This notice was archived. It no longer needs any action.",
  "noticeAttachments": "Attachments",
  "noticeAvailableWhenOnline": "Available when online",
  "@noticeAvailableWhenOnline": { "description": "An attachment while the device is offline." },
  "noticeCommentLabel": "Add a comment (optional)",
  "noticeYourComment": "Your comment: {comment}",
  "@noticeYourComment": { "placeholders": { "comment": { "type": "String" } } },
  "noticeSentOffline": "Sent while offline",
  "noticeDismiss": "Dismiss",
  "noticeDismissed": "Dismissed",
  "noticeNeedsConnection": "This needs a connection.",
  "noticeSeeReach": "See who has read it",
  "@noticeSeeReach": { "description": "S04 button for the notice's publisher: opens reach (S11)." },
  "fileSizeKb": "{size} KB",
  "@fileSizeKb": { "placeholders": { "size": { "type": "int" } } },
  "fileSizeMb": "{size} MB",
  "@fileSizeMb": { "placeholders": { "size": { "type": "String" } } }
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/features/notices/notice_detail_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/notice_detail_screen.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/linked_text.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';
import 'notice_actions_test.dart' show SpyAnalytics;

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late _Notices repo;
  late AppDatabase db;
  late SpyAnalytics analytics;
  late List<Uri> launched;
  late Map<String, dynamic> served;
  final now = DateTime.utc(2026, 10, 1, 6);

  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() {
    repo = _Notices();
    db = AppDatabase.memory();
    analytics = SpyAnalytics();
    launched = [];
    served = detailJson('n1');
    when(() => repo.cachedDetail(any())).thenAnswer((_) async => null);
    when(() => repo.detail('n1')).thenAnswer((_) async => Cached(NoticeDetail.fromJson(served), DateTime.now()));
    when(() => repo.markSeen('n1')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 6));
    when(repo.cachedAttention).thenAnswer((_) async => null);
    when(repo.attention).thenAnswer((_) async => Cached(AttentionData.fromJson(attentionJson([])), DateTime.now()));
  });
  tearDown(() => db.close());

  List<Override> overrides({bool online = true}) => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(analytics),
        isOnlineProvider.overrideWith((_) => Stream.value(online)),
        externalLauncherProvider.overrideWithValue((uri) async {
          launched.add(uri);
          return true;
        }),
      ];

  Future<void> open(WidgetTester t, {bool online = true, double textScale = 1}) async {
    await t.pumpWidget(noticeHost(NoticeDetailScreen(noticeId: 'n1', now: now), overrides: overrides(online: online), scroll: false, textScale: textScale));
    await t.pump();
    await t.pump();
  }

  testWidgets('opening tracks notice.opened and marks the notice seen once', (t) async {
    await open(t);
    expect(find.text('Mid-semester exam timetable'), findsOneWidget);
    expect(find.text('Sent to 2024 Batch'), findsOneWidget);
    expect(find.text('See who has read it'), findsNothing);
    verify(() => repo.markSeen('n1')).called(1);
    expect(analytics.events.first.$1, 'notice.opened');
    expect(analytics.events.first.$2, {'noticeId': 'n1'});
  });

  testWidgets('a notice already seen is not marked again', (t) async {
    served = {...detailJson('n1'), 'state': 'seen', 'seenAt': '2026-09-30T05:00:00.000Z'};
    await open(t);
    verifyNever(() => repo.markSeen(any()));
  });

  testWidgets('a notice not sent to this person is not available, with no retry', (t) async {
    when(() => repo.detail('n1')).thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.', status: 404));
    await open(t);
    expect(find.text('This notice is not available'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('acknowledging with a comment sends it, then shows the acknowledgement', (t) async {
    served = detailJson('n1', ackCommentAllowed: true);
    when(() => repo.acknowledge('n1', any())).thenAnswer((_) async {
      served = {...detailJson('n1', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z'), 'ackComment': 'Room clash'};
      return AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false, comment: 'Room clash');
    });
    await open(t);
    await t.enterText(find.byType(TextField), 'Room clash');
    await t.tap(find.byType(AckControl));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
    await t.pump();
    await t.pump();
    await t.pump();
    final input = verify(() => repo.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.method, AckMethod.confirm);
    expect(input.comment, 'Room clash');
    expect(find.textContaining('Acknowledged'), findsOneWidget);
    expect(find.text('Your comment: Room clash'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('a late acknowledgement is flagged Late', (t) async {
    served = detailJson('n1', state: 'acknowledged', ackAt: '2026-10-03T12:00:00.000Z', late: true);
    await open(t);
    expect(find.textContaining('Late'), findsOneWidget);
  });

  testWidgets('an archived notice is read-only and marked Archived', (t) async {
    served = detailJson('n1', archived: true);
    await open(t);
    expect(find.textContaining('Archived'), findsOneWidget);
    expect(find.byType(AckControl), findsNothing);
  });

  testWidgets('offline, attachments are disabled and say Available when online', (t) async {
    served = detailJson('n1', attachments: [pdfAttachment]);
    await open(t, online: false);
    expect(find.text('timetable.pdf'), findsOneWidget);
    expect(find.text('Available when online'), findsOneWidget);
    await t.tap(find.text('timetable.pdf'));
    await t.pump();
    verifyNever(() => repo.attachmentUrl(any(), any()));
  });

  testWidgets('online, an attachment opens its signed URL outside the app', (t) async {
    served = detailJson('n1', attachments: [pdfAttachment]);
    when(() => repo.attachmentUrl('n1', 'colleges/c1/notices/7f3a')).thenAnswer((_) async => Uri.parse('https://s3.test/signed'));
    await open(t);
    expect(find.text('240 KB'), findsOneWidget);
    await t.tap(find.text('timetable.pdf'));
    await t.pump();
    await t.pump();
    expect(launched, [Uri.parse('https://s3.test/signed')]);
  });

  testWidgets('a notice that needs no acknowledgement can be dismissed', (t) async {
    served = detailJson('n1', ackRequired: false, deadline: null);
    when(() => repo.dismiss('n1')).thenAnswer((_) async => DateTime.utc(2026, 10, 1, 6));
    await open(t);
    expect(find.byType(AckControl), findsNothing);
    await t.tap(find.text('Dismiss'));
    await t.pump();
    verify(() => repo.dismiss('n1')).called(1);
    expect(analytics.events.map((e) => e.$1), contains('notice.dismissed'));
  });

  testWidgets('the publisher sees the reach button', (t) async {
    served = detailJson('n1', isPublisher: true);
    await open(t);
    expect(find.text('See who has read it'), findsOneWidget);
  });

  testWidgets('links in the body are detected', (t) async {
    expect(LinkedText.segments('See https://jit.example/exams. Thanks').map((s) => s.$2?.toString()), [null, 'https://jit.example/exams', null]);
    await open(t);
    expect(find.byType(LinkedText), findsOneWidget);
  });

  testWidgets('text scale 2.0 lays out without overflow', (t) async {
    await t.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => t.binding.setSurfaceSize(null));
    served = detailJson('n1', ackCommentAllowed: true, attachments: [pdfAttachment]);
    await open(t, textScale: 2);
    expect(t.takeException(), isNull);
  });
}
```

In `mobile/test/app/redirect_test.dart`, after the `'complete accounts leave gates for their home tab and keep app routes'` test, add:

```dart
    test('notice routes are app routes once onboarding is complete', () {
      for (final path in ['/notices/n1', '/notices/n1/reach', '/attention']) {
        expect(redirect(SessionState.signedIn(acct()), path), isNull);
        expect(redirect(SessionState.signedIn(acct(kind: 'faculty')), path), isNull);
        expect(redirect(SessionState.signedIn(acct(step: 1, complete: false)), path), '/onboarding/1');
      }
    });
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/notices/notice_detail_screen_test.dart`
Expected: FAIL — `Target of URI doesn't exist: 'package:juvi/features/notices/notice_detail_screen.dart'`. (The redirect test already passes: `redirect()` treats any non-gate path as an app route.)

- [ ] **Step 4: Write `LinkedText` and the screen**

```dart
// mobile/lib/features/notices/widgets/linked_text.dart
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Plain text with its http(s) links made tappable. Notice bodies are plain text and
/// links are detected at render time (spec §5).
class LinkedText extends StatefulWidget {
  const LinkedText(this.text, {required this.onOpen, this.style, super.key});
  final String text;
  final ValueChanged<Uri> onOpen;
  final TextStyle? style;

  static final _link = RegExp(r'https?://[^\s<>"]+');
  static const _trailing = ".,;:!?)'";

  /// The text split into plain runs and links, in order; a link is a non-null [Uri].
  static List<(String, Uri?)> segments(String text) {
    final out = <(String, Uri?)>[];
    var at = 0;
    for (final m in _link.allMatches(text)) {
      var url = m.group(0)!;
      while (url.isNotEmpty && _trailing.contains(url[url.length - 1])) {
        url = url.substring(0, url.length - 1);
      }
      final uri = Uri.tryParse(url);
      if (uri == null || !uri.hasAuthority) continue;
      if (m.start > at) out.add((text.substring(at, m.start), null));
      out.add((url, uri));
      at = m.start + url.length;
    }
    if (at < text.length) out.add((text.substring(at), null));
    return out;
  }

  @override
  State<LinkedText> createState() => _LinkedTextState();
}

class _LinkedTextState extends State<LinkedText> {
  final _recognizers = <TapGestureRecognizer>[];
  late List<(String, Uri?)> _segments;

  @override
  void initState() {
    super.initState();
    _parse();
  }

  @override
  void didUpdateWidget(LinkedText old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) _parse();
  }

  void _parse() {
    _disposeRecognizers();
    _segments = LinkedText.segments(widget.text);
    for (final (_, uri) in _segments) {
      if (uri != null) _recognizers.add(TapGestureRecognizer()..onTap = () => widget.onOpen(uri));
    }
  }

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final linkStyle = TextStyle(color: Theme.of(context).colorScheme.primary, decoration: TextDecoration.underline);
    var i = 0;
    return Text.rich(TextSpan(
      style: widget.style,
      children: [
        for (final (text, uri) in _segments)
          uri == null ? TextSpan(text: text) : TextSpan(text: text, style: linkStyle, recognizer: _recognizers[i++]),
      ],
    ));
  }
}
```

```dart
// mobile/lib/features/notices/notice_detail_screen.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/deadline_ring.dart';
import 'package:juvi/features/notices/widgets/linked_text.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens an attachment or body link outside the app; overridden in tests.
final externalLauncherProvider = Provider<Future<bool> Function(Uri)>((_) => (uri) => launchUrl(uri, mode: LaunchMode.externalApplication));

/// S04. Opening it records `notice.opened` and sets `seenAt` once (spec §4 US-2.1);
/// an archived notice is read-only (US-2.6); a notice that was not sent to this
/// person is "not available" (US-2.5).
class NoticeDetailScreen extends ConsumerStatefulWidget {
  const NoticeDetailScreen({required this.noticeId, this.now, super.key});
  final String noticeId;

  /// Injectable clock for the deadline ring (tests).
  final DateTime? now;

  @override
  ConsumerState<NoticeDetailScreen> createState() => _NoticeDetailScreenState();
}

class _NoticeDetailScreenState extends ConsumerState<NoticeDetailScreen> {
  final _comment = TextEditingController();
  bool _busy = false;
  bool _seenSent = false;

  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).track('notice.opened', {'noticeId': widget.noticeId});
    ref.listenManual<AsyncValue<Cached<NoticeDetail>>>(noticeDetailProvider(widget.noticeId), (_, next) {
      final d = next.value?.data;
      if (d == null || d.seenAt != null || _seenSent) return;
      _seenSent = true;
      unawaited(_markSeen());
    }, fireImmediately: true);
  }

  Future<void> _markSeen() async {
    try {
      await (await ref.read(noticesRepositoryProvider.future)).markSeen(widget.noticeId);
    } on ApiFailure {
      // Offline or gone: seen is best-effort; the next open tries again.
      _seenSent = false;
    }
  }

  void _toast(String text) => ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(text)));

  Future<void> _acknowledge(AckMethod method) async {
    setState(() => _busy = true);
    try {
      await acknowledgeNotice(ref, widget.noticeId, method, comment: _comment.text);
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _dismiss() async {
    final l = context.l10n;
    try {
      await dismissNotice(ref, widget.noticeId);
      if (mounted) await Navigator.of(context).maybePop();
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    }
  }

  Future<void> _openAttachment(NoticeAttachment a) async {
    final l = context.l10n;
    try {
      final url = await (await ref.read(noticesRepositoryProvider.future)).attachmentUrl(widget.noticeId, a.key);
      await ref.read(externalLauncherProvider)(url);
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    }
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final detail = ref.watch(noticeDetailProvider(widget.noticeId));
    return Scaffold(
      appBar: AppBar(title: Text(detail.value?.data.office ?? '')),
      body: detail.when(
        loading: () => const SkeletonList(count: 3),
        error: (e, _) {
          final f = ApiFailure.of(e);
          if (f.code == ApiErrorCode.noticeNotFound || f.code == ApiErrorCode.notFound) {
            return EmptyState(icon: Icons.search_off, title: l.noticeNotAvailable, hint: l.noticeNotAvailableHint);
          }
          return FailureView(f, onRetry: () => ref.invalidate(noticeDetailProvider(widget.noticeId)));
        },
        data: (c) => _body(context, c),
      ),
    );
  }

  Widget _body(BuildContext context, Cached<NoticeDetail> c) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final d = c.data;
    final online = ref.watch(isOnlineProvider).value ?? true;
    final queued = (ref.watch(pendingAcksProvider).value ?? const <String>{}).contains(d.id);
    final deadline = d.deadline;
    final published = d.publishedAt;
    final overdue = deadline != null && !(widget.now ?? DateTime.now()).isBefore(deadline);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (c.stale) AsOfLine(c.asOf),
        if (d.archived)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(Icons.inventory_2_outlined),
              const SizedBox(width: 12),
              Expanded(child: Text('${l.noticeArchived}. ${l.noticeArchivedBody}')),
            ]),
          ),
        Text([d.office, if (published != null) dayMonthTime(published)].join(' · '), style: t.labelMedium),
        const SizedBox(height: 6),
        Text(d.title, style: t.titleLarge),
        const SizedBox(height: 4),
        Text(d.audienceLine, style: t.labelMedium),
        if (deadline != null && d.ackRequired) ...[
          const SizedBox(height: 12),
          Row(children: [
            if (d.needsAck) ...[DeadlineRing(deadline: deadline, start: published, now: widget.now), const SizedBox(width: 12)],
            Expanded(
              child: Text(
                overdue ? l.deadlinePassed(dayMonthTime(deadline)) : l.deadlineDueBy(dayMonthTime(deadline)),
                style: t.labelLarge?.copyWith(color: overdue && d.needsAck ? scheme.error : null),
              ),
            ),
          ]),
        ],
        const SizedBox(height: 16),
        LinkedText(d.body, style: t.bodyLarge, onOpen: (uri) => unawaited(ref.read(externalLauncherProvider)(uri))),
        if (d.attachments.isNotEmpty) ...[
          SectionHeader(l.noticeAttachments),
          for (final a in d.attachments)
            ListTile(
              contentPadding: EdgeInsets.zero,
              enabled: online,
              leading: Icon(a.mime.startsWith('image/') ? Icons.image_outlined : Icons.description_outlined),
              title: Text(a.name),
              subtitle: Text(online ? _size(l, a.size) : l.noticeAvailableWhenOnline),
              onTap: () => _openAttachment(a),
            ),
        ],
        const SizedBox(height: 16),
        ..._ackSection(context, d, queued),
        if (d.isPublisher) ...[
          const SizedBox(height: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.insights_outlined),
            label: Text(l.noticeSeeReach),
            onPressed: () => GoRouter.maybeOf(context)?.push('/notices/${d.id}/reach'),
          ),
        ],
      ],
    );
  }

  List<Widget> _ackSection(BuildContext context, NoticeDetail d, bool queued) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    if (d.archived) return const [];
    if (!d.ackRequired) {
      if (d.state == 'dismissed') return [Text(l.noticeDismissed, style: t.labelLarge)];
      return [Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: _dismiss, child: Text(l.noticeDismiss)))];
    }
    final ackAt = d.ackAt;
    if (d.isAcknowledged) {
      return [
        Row(children: [
          Icon(Icons.check_circle, color: d.isLate ? scheme.error : scheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              [
                if (ackAt == null) l.noticeAcknowledged else l.noticeAcknowledgedAt(dayMonthTime(ackAt)),
                if (d.isLate) l.noticeLate,
                if (d.ackOffline) l.noticeSentOffline,
              ].join(' · '),
              style: t.titleSmall,
            ),
          ),
        ]),
        if (d.ackComment != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(l.noticeYourComment(d.ackComment!))),
      ];
    }
    if (queued) {
      return [
        Row(children: [
          const Icon(Icons.cloud_upload_outlined),
          const SizedBox(width: 8),
          Expanded(child: Text(l.noticeWillSendWhenOnline, style: t.titleSmall)),
        ]),
      ];
    }
    return [
      if (d.ackCommentAllowed) ...[
        TextField(
          controller: _comment,
          maxLength: 500,
          maxLines: 3,
          minLines: 1,
          enabled: !_busy,
          decoration: InputDecoration(labelText: l.noticeCommentLabel, border: const OutlineInputBorder()),
        ),
        const SizedBox(height: 8),
      ],
      AckControl(onAcknowledge: _acknowledge, busy: _busy),
    ];
  }

  String _size(AppLocalizations l, int bytes) =>
      bytes < 1024 * 1024 ? l.fileSizeKb((bytes / 1024).ceil()) : l.fileSizeMb((bytes / (1024 * 1024)).toStringAsFixed(1));
}
```

In `mobile/lib/app/router.dart`, add `import 'package:juvi/features/notices/notice_detail_screen.dart';` after the `settings_screen.dart` import, and after the `/update-required` route add:

```dart
      // Notices sit above the tab shell: pushed from Today, Teaching, a channel or the
      // attention sheet, and popped back to wherever they were opened from.
      GoRoute(path: '/notices/:id', builder: (_, s) => NoticeDetailScreen(noticeId: s.pathParameters['id']!)),
```

- [ ] **Step 5: Analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter analyze`
Expected: `Built with build_runner/aot …`, then `No issues found!`

Run: `cd mobile && flutter test test/features/notices/notice_detail_screen_test.dart test/app/redirect_test.dart`
Expected: `+21: All tests passed!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+153: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/notices mobile/lib/app/router.dart mobile/lib/app/l10n mobile/test/features/notices/notice_detail_screen_test.dart mobile/test/app/redirect_test.dart
git commit -m "feat(mobile): S04 notice detail

Seen once on open, notice.opened, archived and not-available states,
attachments that are available only online, comment, acknowledge, dismiss,
links in the body, and the reach entry point for the publisher.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: S05 `AttentionSheet`, the attention stack on Today and Teaching, and the Due badge

**Files:**
- Create: `mobile/lib/app/sheet_page.dart`, `mobile/lib/features/notices/notice_list_controller.dart`, `mobile/lib/features/notices/attention_sheet.dart`, `mobile/lib/features/notices/widgets/due_badge.dart`, `mobile/test/features/notices/attention_sheet_test.dart`
- Modify: `mobile/lib/app/router.dart`, `mobile/lib/shared/widgets/app_shell.dart`, `mobile/lib/features/home/today_shell_screen.dart`, `mobile/lib/features/home/teaching_shell_screen.dart`, `mobile/lib/features/notices/notice_actions.dart` (`refreshNotice`), `mobile/lib/app/l10n/app_en.arb` (+ regenerated), `mobile/test/features/home/today_shell_test.dart`, `mobile/test/flows/sign_in_flow_test.dart`

**Interfaces:**
- Consumes: Task 1 `attentionProvider`, `NoticesRepository.list/cachedList`, `NoticeSegment`; Task 2 `pendingAcksProvider`; Task 4 `AttentionStack`, `NoticeTile`; Foundation `sessionControllerProvider` / `SignedIn`.
- Produces:
  ```dart
  class SheetPage<T> extends Page<T> { const SheetPage({required Widget child, LocalKey? key}); }   // ModalBottomSheetRoute, scroll-controlled, safe area, drag handle
  class NoticeListState { List<NoticeItem> items; String? nextCursor; bool loadingMore; DateTime? asOf; ApiFailure? failure; bool get stale; }
  final noticeListProvider;   // family (NoticeSegment segment, String? office) → AsyncNotifier<NoticeListState>; .notifier.loadMore()
  class AttentionSheet extends ConsumerStatefulWidget { const AttentionSheet({NoticeSegment initial = NoticeSegment.due}); }
  class DueBadge extends ConsumerWidget { const DueBadge({required Widget child}); }
  // router: GoRoute('/attention', pageBuilder: SheetPage(AttentionSheet()))
  ```

Decisions that bind later tasks:
- `/attention` is a route whose page is a modal bottom sheet (spec §9: "the attention sheet as a modal route"), so it is reachable by URL and pops back to the calling screen. The "+N more" pill and a "See all" action on the Attention / My acknowledgements section header open it — "See all" is what makes Done and All reachable when three or fewer are due (US-3.5).
- Segments are chips: Due (label `Due (N)`, N = `attentionProvider.dueCount`, the same number as the badge — US-3.2), Done, All, and Published by me for non-students. The office filter offers the offices seen in the segment's loaded items ("All offices" first); there is no offices endpoint.
- `NoticeList` is network-first; offline, an unfiltered segment falls back to its cached first page with the as-of line. "Show more" loads the next cursor page.
- The badge is `DueBadge` around both home-tab icons in `AppShell` (which therefore keeps `attentionProvider` alive across tabs). Pull-to-refresh on Today and Teaching refreshes `/me` and attention together.
- `refreshNotice` also invalidates every `noticeListProvider` member, so an acknowledgement made from S04 updates the sheet behind it.
- The flow test gains a `/attention` mock (empty) here, because Today now reads it; Task 10 makes it stateful.

- [ ] **Step 1: Add the strings**

Append to `mobile/lib/app/l10n/app_en.arb`:

```json
  "attentionSheetTitle": "Notices",
  "@attentionSheetTitle": { "description": "S05 attention sheet heading." },
  "attentionSeeAll": "See all",
  "@attentionSeeAll": { "description": "Attention section header action on Today and Teaching: opens the attention sheet." },
  "segmentDue": "Due ({count})",
  "@segmentDue": { "description": "S05 Due segment; the count equals the tab badge (spec §4 US-3.2).", "placeholders": { "count": { "type": "int" } } },
  "segmentDone": "Done",
  "segmentAll": "All",
  "segmentPublished": "Published by me",
  "officeAll": "All offices",
  "@officeAll": { "description": "S05 office filter: no filter." },
  "showMore": "Show more",
  "noticesNoneDone": "Nothing acknowledged yet",
  "noticesNoneAll": "No notices yet",
  "noticesNonePublished": "You haven't published any notices",
  "dueBadgeLabel": "{count} due",
  "@dueBadgeLabel": { "description": "Accessible label for the Today / Teaching tab badge.", "placeholders": { "count": { "type": "int" } } }
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/features/notices/attention_sheet_test.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/sheet_page.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/notices/attention_sheet.dart';
import 'package:juvi/features/notices/widgets/due_badge.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

class _Notices extends Mock implements NoticesRepository {}

class _Session extends SessionController {
  _Session(this.kind);
  final String kind;
  @override
  SessionState build() => SessionState.signedIn(Me.fromJson(meJson).account.copyWith(kind: kind, onboardingComplete: true));
}

void main() {
  late _Notices repo;

  setUp(() {
    repo = _Notices();
    when(() => repo.list(any(), office: any(named: 'office'), cursor: any(named: 'cursor')))
        .thenAnswer((_) async => const NoticePage(items: []));
    when(() => repo.cachedList(any())).thenAnswer((_) async => null);
  });
  setUpAll(() => registerFallbackValue(NoticeSegment.due));

  List<Override> overrides({int dueCount = 5, String kind = 'student'}) => [
        noticesRepositoryProvider.overrideWith((_) async => repo),
        attentionProvider.overrideWith((_) => Stream.value(Cached(AttentionData.fromJson(attentionJson([cardJson('n1')], dueCount: dueCount)), DateTime.now()))),
        pendingAcksProvider.overrideWith((_) async => <String>{}),
        sessionControllerProvider.overrideWith(() => _Session(kind)),
      ];

  Future<void> pumpSheet(WidgetTester t, {int dueCount = 5, String kind = 'student', Widget? extra}) async {
    await t.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(noticeHost(
      Column(children: [?extra, const Expanded(child: AttentionSheet())]),
      overrides: overrides(dueCount: dueCount, kind: kind),
      scroll: false,
    ));
    await t.pump();
    await t.pump();
  }

  NoticeItem item(String id, {String office = 'Exam Section'}) => NoticeItem.fromJson(cardJson(id, office: office, title: 'Notice $id'));

  testWidgets('the Due segment count equals the tab badge', (t) async {
    await pumpSheet(t, extra: const DueBadge(child: Icon(Icons.today)));
    expect(find.text('Due (5)'), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('5')), findsOneWidget);
  });

  testWidgets('Due lists the due notices; empty Due is clear', (t) async {
    when(() => repo.list(NoticeSegment.due)).thenAnswer((_) async => const NoticePage(items: []));
    await pumpSheet(t, dueCount: 0);
    expect(find.text('Due (0)'), findsOneWidget);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('0')), findsNothing);
  });

  testWidgets('All reaches every notice, a page at a time', (t) async {
    when(() => repo.list(NoticeSegment.all)).thenAnswer((_) async => NoticePage(items: [item('a'), item('b')], nextCursor: 'c1'));
    when(() => repo.list(NoticeSegment.all, cursor: 'c1')).thenAnswer((_) async => NoticePage(items: [item('c')]));
    await pumpSheet(t);
    await t.tap(find.text('All'));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeTile), findsNWidgets(2));
    await t.tap(find.text('Show more'));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeTile), findsNWidgets(3));
    expect(find.text('Show more'), findsNothing);
  });

  testWidgets('Published by me is not offered to students', (t) async {
    await pumpSheet(t);
    expect(find.text('Published by me'), findsNothing);
  });

  testWidgets('Published by me is offered to faculty', (t) async {
    await pumpSheet(t, kind: 'faculty');
    expect(find.text('Published by me'), findsOneWidget);
  });

  testWidgets('the office filter narrows the segment', (t) async {
    when(() => repo.list(NoticeSegment.done)).thenAnswer((_) async => NoticePage(items: [item('a'), item('b', office: 'Finance')]));
    when(() => repo.list(NoticeSegment.done, office: 'Finance')).thenAnswer((_) async => NoticePage(items: [item('b', office: 'Finance')]));
    await pumpSheet(t);
    await t.tap(find.text('Done'));
    await t.pump();
    await t.pump();
    expect(find.text('All offices'), findsOneWidget);
    await t.tap(find.widgetWithText(FilterChip, 'Finance'));
    await t.pump();
    await t.pump();
    verify(() => repo.list(NoticeSegment.done, office: 'Finance')).called(1);
    expect(find.byType(NoticeTile), findsOneWidget);
  });

  testWidgets('offline, a segment shows its cached first page with the as-of time', (t) async {
    when(() => repo.list(NoticeSegment.due)).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
    when(() => repo.cachedList(NoticeSegment.due)).thenAnswer((_) async => Cached(NoticePage(items: [item('a')]), DateTime(2026, 10, 1, 8, 14)));
    await pumpSheet(t);
    expect(find.byType(NoticeTile), findsOneWidget);
    expect(find.textContaining('As of 08:14'), findsOneWidget);
  });

  testWidgets('/attention opens as a modal sheet and returns to the calling screen', (t) async {
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const Scaffold(body: Text('Today'))),
      GoRoute(path: '/attention', pageBuilder: (_, s) => SheetPage<void>(key: s.pageKey, child: const AttentionSheet())),
    ]);
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      retry: (_, _) => null,
      overrides: overrides(),
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    unawaited(router.push('/attention'));
    await t.pumpAndSettle();
    expect(find.byType(AttentionSheet), findsOneWidget);
    expect(find.byType(BottomSheet), findsOneWidget);
    router.pop();
    await t.pumpAndSettle();
    expect(find.byType(AttentionSheet), findsNothing);
    expect(find.text('Today'), findsOneWidget);
  });
}
```

In `mobile/test/features/home/today_shell_test.dart`:

- replace:

```dart
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

import '../../core/repos/me_repository_test.dart' show meJson;

// R42: Riverpod 3 retries a failing provider automatically; disable it so a test that
// expects an error state sees it without waiting for retries.
Widget host(Stream<Cached<Me>> Function() stream) => ProviderScope(
      retry: (_, _) => null,
      overrides: [meProvider.overrideWith((ref) => stream())],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: TodayShellScreen()),
    );
```

  with:

```dart
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/home/teaching_shell_screen.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/features/notices/widgets/notice_card.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';

// R42: Riverpod 3 retries a failing provider automatically; disable it so a test that
// expects an error state sees it without waiting for retries.
Widget host(Stream<Cached<Me>> Function() stream, {Map<String, dynamic>? attention, Widget home = const TodayShellScreen()}) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        meProvider.overrideWith((ref) => stream()),
        attentionProvider.overrideWith((ref) => Stream.value(Cached(AttentionData.fromJson(attention ?? attentionJson([])), DateTime.now()))),
        pendingAcksProvider.overrideWith((ref) async => <String>{}),
      ],
      child: MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: home),
    );
```

- replace:

```dart
  testWidgets('offline with cache shows the as-of line', (t) async {
```

  with:

```dart
  testWidgets('due acknowledgements appear in the Attention section', (t) async {
    await t.pumpWidget(host(() async* { yield Cached(me, DateTime.now()); }, attention: attentionJson([cardJson('n1')], dueCount: 4)));
    await t.pump();
    await t.pump();
    expect(find.byType(NoticeCard), findsOneWidget);
    expect(find.text('+3 more'), findsOneWidget);
    expect(find.text('See all'), findsOneWidget);
    expect(find.text("You're clear"), findsNothing);
  });
  testWidgets('Teaching shows the attention stack under My acknowledgements', (t) async {
    await t.pumpWidget(host(() async* { yield Cached(me, DateTime.now()); }, attention: attentionJson([cardJson('n1')]), home: const TeachingShellScreen()));
    await t.pump();
    await t.pump();
    expect(find.text('MY ACKNOWLEDGEMENTS'), findsOneWidget);
    expect(find.byType(NoticeCard), findsOneWidget);
  });
  testWidgets('offline with cache shows the as-of line', (t) async {
```

- replace:

```dart
    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('Aditya'), findsOneWidget);
```

  with:

```dart
    await t.pump(const Duration(milliseconds: 100));
    await t.pump(); // the attention stack's first value
    expect(find.text('Aditya'), findsOneWidget);
```


- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/notices/attention_sheet_test.dart test/features/home`
Expected: FAIL — `Target of URI doesn't exist: 'package:juvi/app/sheet_page.dart'` (and `attention_sheet.dart`, `due_badge.dart`); `today_shell_test.dart` fails to compile on `attentionProvider` overrides until the screen imports exist, then on the missing `NoticeCard`.

- [ ] **Step 4: Write the sheet page, the list controller, the sheet and the badge**

```dart
// mobile/lib/app/sheet_page.dart
import 'package:flutter/material.dart';

/// A go_router page shown as a modal bottom sheet, so a sheet can be a route
/// (`/attention`, spec §9) and still return to the screen that pushed it.
class SheetPage<T> extends Page<T> {
  const SheetPage({required this.child, super.key});
  final Widget child;

  @override
  Route<T> createRoute(BuildContext context) => ModalBottomSheetRoute<T>(
        settings: this,
        builder: (_) => child,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
      );
}
```

```dart
// mobile/lib/features/notices/notice_list_controller.dart
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notice_list_controller.g.dart';

class NoticeListState {
  const NoticeListState({required this.items, this.nextCursor, this.loadingMore = false, this.asOf, this.failure});
  final List<NoticeItem> items;
  final String? nextCursor;
  final bool loadingMore;

  /// Set when the list is the cached first page because the network failed.
  final DateTime? asOf;

  /// The last "Show more" failure, if any.
  final ApiFailure? failure;

  bool get stale => asOf != null;
}

/// One S05 segment, optionally filtered by office, paged by the server's cursor
/// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.
@riverpod
class NoticeList extends _$NoticeList {
  @override
  Future<NoticeListState> build(NoticeSegment segment, String? office) async {
    final repo = await ref.read(noticesRepositoryProvider.future);
    try {
      final page = await repo.list(segment, office: office);
      return NoticeListState(items: page.items, nextCursor: page.nextCursor);
    } on ApiFailure {
      final cached = office == null ? await repo.cachedList(segment) : null;
      if (cached == null) rethrow;
      return NoticeListState(items: cached.data.items, asOf: cached.asOf);
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingMore) return;
    state = AsyncData(NoticeListState(items: current.items, nextCursor: cursor, loadingMore: true));
    final repo = await ref.read(noticesRepositoryProvider.future);
    try {
      final page = await repo.list(segment, office: office, cursor: cursor);
      state = AsyncData(NoticeListState(items: [...current.items, ...page.items], nextCursor: page.nextCursor));
    } on ApiFailure catch (f) {
      state = AsyncData(NoticeListState(items: current.items, nextCursor: cursor, failure: f));
    }
  }
}
```

```dart
// mobile/lib/features/notices/widgets/due_badge.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/repos/notices_repository.dart';

/// The Due count on the Today / Teaching tab. It reads the same `dueCount` as the
/// attention stack and the sheet's Due segment, so the numbers always agree (spec §4 US-3.2).
class DueBadge extends ConsumerWidget {
  const DueBadge({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final due = ref.watch(attentionProvider).value?.data.dueCount ?? 0;
    return Semantics(
      value: due > 0 ? context.l10n.dueBadgeLabel(due) : null,
      child: Badge(isLabelVisible: due > 0, label: Text('$due'), child: child),
    );
  }
}
```

```dart
// mobile/lib/features/notices/attention_sheet.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/notices/notice_list_controller.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S05, shown as a modal sheet over the screen that opened it (route `/attention`).
/// Segments Due, Done, All and — for faculty and staff — Published by me, each paged
/// and filterable by office. The Due label's count is the badge count (spec §4 US-3.2).
class AttentionSheet extends ConsumerStatefulWidget {
  const AttentionSheet({this.initial = NoticeSegment.due, super.key});
  final NoticeSegment initial;

  @override
  ConsumerState<AttentionSheet> createState() => _AttentionSheetState();
}

class _AttentionSheetState extends ConsumerState<AttentionSheet> {
  late NoticeSegment _segment = widget.initial;
  String? _office;

  /// Offices seen in this segment so far, so a chosen filter stays offered.
  final _offices = <String>{};

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionControllerProvider);
    final canPublish = session is SignedIn && session.account.kind != 'student';
    final due = ref.watch(attentionProvider).value?.data.dueCount;
    final list = ref.watch(noticeListProvider(_segment, _office));
    final pending = ref.watch(pendingAcksProvider).value ?? const <String>{};
    _offices.addAll(list.value?.items.map((n) => n.office) ?? const <String>[]);
    final segments = <(NoticeSegment, String)>[
      (NoticeSegment.due, due == null ? l.noticeDue : l.segmentDue(due)),
      (NoticeSegment.done, l.segmentDone),
      (NoticeSegment.all, l.segmentAll),
      if (canPublish) (NoticeSegment.published, l.segmentPublished),
    ];
    final offices = _offices.toList()..sort();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.85,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(l.attentionSheetTitle, style: Theme.of(context).textTheme.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final (s, label) in segments)
                  ChoiceChip(
                    label: Text(label),
                    selected: _segment == s,
                    onSelected: (_) => setState(() {
                      _segment = s;
                      _office = null;
                      _offices.clear();
                    }),
                  ),
              ],
            ),
          ),
          if (offices.length > 1 || _office != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final o in <String?>[null, ...offices])
                    FilterChip(
                      label: Text(o ?? l.officeAll),
                      selected: _office == o,
                      onSelected: (_) => setState(() => _office = o),
                    ),
                ],
              ),
            ),
          const Divider(height: 1),
          Expanded(
            child: list.when(
              loading: () => const SkeletonList(),
              error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(noticeListProvider(_segment, _office))),
              data: (s) {
                if (s.items.isEmpty) return ListView(children: [_empty(l)]);
                return ListView.builder(
                  itemCount: s.items.length + 2,
                  itemBuilder: (context, i) {
                    if (i == 0) return s.stale ? AsOfLine(s.asOf!) : const SizedBox.shrink();
                    if (i == s.items.length + 1) {
                      if (s.nextCursor == null) return const SizedBox(height: 24);
                      return Padding(
                        padding: const EdgeInsets.all(16),
                        child: s.loadingMore
                            ? const Center(child: CircularProgressIndicator())
                            : OutlinedButton(onPressed: () => ref.read(noticeListProvider(_segment, _office).notifier).loadMore(), child: Text(l.showMore)),
                      );
                    }
                    final n = s.items[i - 1];
                    return NoticeTile(
                      notice: n,
                      pendingAck: pending.contains(n.id),
                      onTap: () => GoRouter.maybeOf(context)?.push('/notices/${n.id}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _empty(AppLocalizations l) => switch (_segment) {
        NoticeSegment.due => EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
        NoticeSegment.done => EmptyState(icon: Icons.task_alt, title: l.noticesNoneDone),
        NoticeSegment.all => EmptyState(icon: Icons.inbox_outlined, title: l.noticesNoneAll),
        NoticeSegment.published => EmptyState(icon: Icons.campaign_outlined, title: l.noticesNonePublished),
      };
}
```

- [ ] **Step 5: Wire the route, the badge, the home screens and the list refresh**

In `mobile/lib/app/router.dart`:

- after `import 'package:juvi/app/redirect.dart';` add:

```dart
import 'package:juvi/app/sheet_page.dart';
```

- replace:

```dart
import 'package:juvi/features/notices/notice_detail_screen.dart';
```

  with:

```dart
import 'package:juvi/features/notices/attention_sheet.dart';
import 'package:juvi/features/notices/notice_detail_screen.dart';
```

- replace:

```dart
      GoRoute(path: '/notices/:id', builder: (_, s) => NoticeDetailScreen(noticeId: s.pathParameters['id']!)),
```

  with:

```dart
      GoRoute(path: '/notices/:id', builder: (_, s) => NoticeDetailScreen(noticeId: s.pathParameters['id']!)),
      // S05 is a modal sheet that returns to the calling screen (spec §9).
      GoRoute(path: '/attention', pageBuilder: (_, s) => SheetPage<void>(key: s.pageKey, child: const AttentionSheet())),
```

In `mobile/lib/shared/widgets/app_shell.dart`:

- after `import 'package:juvi/app/l10n/l10n.dart';` add:

```dart
import 'package:juvi/features/notices/widgets/due_badge.dart';
```

- replace:

```dart
/// Three tabs; the fourth slot is reserved for the Companion (Release 3).
```

  with:

```dart
/// Three tabs; the fourth slot is reserved for the Companion (Release 3). The home tab
/// carries the Due badge (notices spec §4 US-3.2).
```

- replace:

```dart
          NavigationDestination(icon: Icon(isStudent ? Icons.today_outlined : Icons.school_outlined), selectedIcon: Icon(isStudent ? Icons.today : Icons.school), label: isStudent ? l.tabToday : l.tabTeaching),
```

  with:

```dart
          NavigationDestination(
            icon: DueBadge(child: Icon(isStudent ? Icons.today_outlined : Icons.school_outlined)),
            selectedIcon: DueBadge(child: Icon(isStudent ? Icons.today : Icons.school)),
            label: isStudent ? l.tabToday : l.tabTeaching,
          ),
```

In `mobile/lib/features/home/today_shell_screen.dart`:

- after `import 'package:flutter_riverpod/flutter_riverpod.dart';` add:

```dart
import 'package:go_router/go_router.dart';
```

- after `import 'package:juvi/core/repos/me_repository.dart';` add:

```dart
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
```

- replace:

```dart
/// Foundation shell (S03): header + three designed empty states. Content arrives in
/// sub-projects 2 and 4.
```

  with:

```dart
/// S03: header, the attention stack (acknowledgement notices, notices spec §4 US-3.1)
/// and two designed empty states. Timeline and At a glance arrive in sub-project 4.
```

- replace:

```dart
          onRefresh: () async => ref.refresh(meProvider.future),
```

  with:

```dart
          onRefresh: () => Future.wait([ref.refresh(meProvider.future), ref.refresh(attentionProvider.future)]),
```

- replace:

```dart
                SectionHeader(l.todayAttentionSection),
                EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
```

  with:

```dart
                SectionHeader(
                  l.todayAttentionSection,
                  trailing: TextButton(onPressed: () => GoRouter.maybeOf(context)?.push('/attention'), child: Text(l.attentionSeeAll)),
                ),
                const AttentionStack(),
```

In `mobile/lib/features/home/teaching_shell_screen.dart`:

- after `import 'package:flutter_riverpod/flutter_riverpod.dart';` add:

```dart
import 'package:go_router/go_router.dart';
```

- after `import 'package:juvi/core/repos/me_repository.dart';` add:

```dart
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/widgets/attention_stack.dart';
```

- replace:

```dart
/// Faculty home shell (S10). Post-to-class and the department/college feeds arrive in
/// sub-projects 4 and 5.
```

  with:

```dart
/// Faculty home shell (S10): my acknowledgements (the attention stack, notices spec
/// §4 US-3.1) first. Post-to-class and the department/college feeds arrive in
/// sub-projects 4 and 5.
```

- replace:

```dart
          onRefresh: () async => ref.refresh(meProvider.future),
```

  with:

```dart
          onRefresh: () => Future.wait([ref.refresh(meProvider.future), ref.refresh(attentionProvider.future)]),
```

- replace:

```dart
                SectionHeader(l.teachingAcknowledgementsSection),
                EmptyState(icon: Icons.check_circle_outline, title: l.youreClear, hint: l.youreClearHint),
```

  with:

```dart
                SectionHeader(
                  l.teachingAcknowledgementsSection,
                  trailing: TextButton(onPressed: () => GoRouter.maybeOf(context)?.push('/attention'), child: Text(l.attentionSeeAll)),
                ),
                const AttentionStack(),
```

In `mobile/lib/features/notices/notice_actions.dart`:

- after `import 'package:juvi/core/sync/pending_action.dart';` add:

```dart
import 'package:juvi/features/notices/notice_list_controller.dart';
```

- replace:

```dart
  ref
    ..invalidate(attentionProvider)
    ..invalidate(noticeDetailProvider(noticeId));
```

  with:

```dart
  ref
    ..invalidate(attentionProvider)
    ..invalidate(noticeDetailProvider(noticeId))
    ..invalidate(noticeListProvider);
```

In `mobile/test/flows/sign_in_flow_test.dart`:

- replace:

```dart
      ..onGet('/spaces', (s) => s.reply(200, spacesJson))
```

  with:

```dart
      ..onGet('/spaces', (s) => s.reply(200, spacesJson))
      ..onGet('/attention', (s) => s.reply(200, {'dueCount': 0, 'items': <Map<String, dynamic>>[]}))
```


- [ ] **Step 6: Generate, analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter analyze`
Expected: `Built with build_runner/aot …`, then `No issues found!`

Run: `cd mobile && flutter test test/features/notices/attention_sheet_test.dart test/features/home test/flows`
Expected: `+14: All tests passed!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+163: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/app mobile/lib/shared/widgets/app_shell.dart mobile/lib/features/home mobile/lib/features/notices mobile/test/features/notices/attention_sheet_test.dart mobile/test/features/home mobile/test/flows
git commit -m "feat(mobile): attention sheet, attention stack on Today and Teaching, Due badge

S05 as a modal route with Due, Done, All and Published by me, office filter
and paging; the Due count on the tab badge, the stack and the sheet all
come from one provider.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: S11 `ReachScreen` for publishers

**Files:**
- Create: `mobile/lib/features/notices/reach_screen.dart`, `mobile/test/features/notices/reach_screen_test.dart`
- Modify: `mobile/lib/app/router.dart`, `mobile/lib/app/l10n/app_en.arb` (+ regenerated)

**Interfaces:**
- Consumes: Task 1 `NoticesRepository.reach/pending/remind`, `NoticeReachData`, `PendingPage`, `PendingPerson`, `PendingGroup`, `Reminders`, `ApiFailure.reminders`; Task 3 `dayMonthTime`; Task 6 `showMore` string.
- Produces:
  ```dart
  final noticeReachProvider;        // family (String id) → Future<NoticeReachData>, online only
  class PendingState { PendingPage page; String? group; String? query; bool loadingMore; }
  final pendingControllerProvider;  // family (String noticeId): selectGroup(String?), search(String), loadMore(), everyone() → List<PendingPerson>
  class ReachScreen extends ConsumerStatefulWidget { const ReachScreen({required String noticeId}); }
  // router: GoRoute('reach') under '/notices/:id'
  ```

Decisions that bind later tasks:
- Reach is never cached: it is the publisher's live view. A pull-to-refresh reloads reach and the pending list.
- The four count cards are the snapshot buckets — Acknowledged, Seen (not acknowledged), Not seen, Not on Juvi — with "of N in the audience" underneath; they add up to `audience` by construction on the server (spec §6.5) and the test asserts it. For a notice without acknowledgement the Acknowledged card is hidden and the second card reads "Seen".
- Per-group progress, the pending list (grouped, searchable on submit, paged, last-seen-in-app), late acknowledgements, comments and added-later members are separate sections (US-4.2, US-4.3).
- "Copy list" fetches every remaining pending page (at most 25) under the current filter and copies one line per person: `Name (identifier) — group — state` (US-4.2).
- "Send reminder" confirms first, is disabled once `reminders.used >= max` or when the notice is not `published`, and shows the server's message on a 409 `REMINDER_LIMIT` ("A notice can have at most two reminders.", US-4.4).
- 403 `NOT_PUBLISHER` renders "Only the publisher can see who has read this notice." (US-4.5; the server audits the attempt).

- [ ] **Step 1: Add the strings**

Append to `mobile/lib/app/l10n/app_en.arb`:

```json
  "reachTitle": "Reach",
  "@reachTitle": { "description": "S11 app bar: who has seen and acknowledged a notice I published." },
  "reachSeenNotAcked": "Seen, not acknowledged",
  "reachSeen": "Seen",
  "reachNotSeen": "Not seen",
  "reachNotOnJuvi": "Not on Juvi",
  "@reachNotOnJuvi": { "description": "Audience members without an active Juvi account (spec §1)." },
  "reachOfAudience": "of {count} in the audience",
  "@reachOfAudience": { "placeholders": { "count": { "type": "int" } } },
  "reachSparkline": "Acknowledgements over time",
  "reachReminders": "Reminders sent: {used} of {max}",
  "@reachReminders": { "placeholders": { "used": { "type": "int" }, "max": { "type": "int" } } },
  "reachSendReminder": "Send reminder",
  "reachRemindConfirmTitle": "Send a reminder?",
  "reachRemindConfirmBody": "Everyone who has not acknowledged yet gets this notice again.",
  "reachRemindSent": "Reminder sent",
  "reachByGroup": "By group",
  "reachGroupLine": "{acknowledged} of {total} acknowledged",
  "@reachGroupLine": { "placeholders": { "acknowledged": { "type": "int" }, "total": { "type": "int" } } },
  "reachPending": "Pending ({count})",
  "@reachPending": { "placeholders": { "count": { "type": "int" } } },
  "reachAllGroups": "All groups",
  "reachSearchHint": "Search by name or roll number",
  "reachCopy": "Copy list",
  "reachCopied": "Copied {count} names",
  "@reachCopied": { "placeholders": { "count": { "type": "int" } } },
  "reachLastInApp": "Last in app {when}",
  "@reachLastInApp": { "placeholders": { "when": { "type": "String" } } },
  "reachNeverInApp": "Not in the app yet",
  "reachNoPending": "No one is pending",
  "reachLate": "Late acknowledgements ({count})",
  "@reachLate": { "placeholders": { "count": { "type": "int" } } },
  "reachComments": "Comments",
  "reachAddedLater": "Added after publishing",
  "reachAddedLaterLine": "{total} people · {acknowledged} acknowledged · {seen} seen",
  "@reachAddedLaterLine": { "placeholders": { "total": { "type": "int" }, "acknowledged": { "type": "int" }, "seen": { "type": "int" } } },
  "reachNotPublisher": "Only the publisher can see who has read this notice."
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/features/notices/reach_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/reach_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../core/repos/notices_fixtures.dart';
import 'host.dart';

class _Notices extends Mock implements NoticesRepository {}

void main() {
  late _Notices repo;
  late Map<String, dynamic> served;

  setUp(() {
    repo = _Notices();
    served = reachJson();
    when(() => repo.reach('n1')).thenAnswer((_) async => NoticeReachData.fromJson(served));
    when(() => repo.pending('n1', group: any(named: 'group'), q: any(named: 'q'), cursor: any(named: 'cursor')))
        .thenAnswer((_) async => PendingPage.fromJson(pendingJson()));
  });

  List<Override> overrides() => [noticesRepositoryProvider.overrideWith((_) async => repo)];

  Future<void> open(WidgetTester t, {double textScale = 1}) async {
    await t.binding.setSurfaceSize(const Size(400, 2400));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(noticeHost(const ReachScreen(noticeId: 'n1'), overrides: overrides(), scroll: false, textScale: textScale));
    await t.pump();
    await t.pump();
  }

  testWidgets('the four counts reconcile to the audience', (t) async {
    await open(t);
    final r = NoticeReachData.fromJson(served);
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi, r.audience);
    for (final (label, n) in [('Acknowledged', 4), ('Seen, not acknowledged', 3), ('Not seen', 2), ('Not on Juvi', 1)]) {
      expect(find.ancestor(of: find.text(label), matching: find.byType(Card)), findsOneWidget);
      expect(find.descendant(of: find.ancestor(of: find.text(label), matching: find.byType(Card)), matching: find.text('$n')), findsOneWidget);
    }
    expect(find.text('of 10 in the audience'), findsOneWidget);
    expect(find.text('3 of 6 acknowledged'), findsOneWidget);
  });

  testWidgets('late acknowledgements, comments and added-later members are listed separately', (t) async {
    await open(t);
    expect(find.text('LATE ACKNOWLEDGEMENTS (1)'), findsOneWidget);
    expect(find.text('Kavya Rao'), findsOneWidget);
    expect(find.text('COMMENTS'), findsOneWidget);
    expect(find.text('Room 204 clashes with lab.'), findsOneWidget);
    expect(find.text('ADDED AFTER PUBLISHING'), findsOneWidget);
    expect(find.text('1 people · 0 acknowledged · 1 seen'), findsOneWidget);
    expect(find.text('Ishaan Gupta'), findsOneWidget);
  });

  testWidgets('the pending list shows last-seen-in-app, filters by group and searches', (t) async {
    await open(t);
    expect(find.text('PENDING (2)'), findsOneWidget);
    expect(find.textContaining('Last in app'), findsOneWidget);
    await t.tap(find.widgetWithText(FilterChip, '2024 Batch · B (1)'));
    await t.pump();
    verify(() => repo.pending('n1', group: '2024 Batch · B')).called(1);
    await t.enterText(find.byType(TextField), 'meera');
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();
    verify(() => repo.pending('n1', group: '2024 Batch · B', q: 'meera')).called(1);
  });

  testWidgets('Copy list puts every pending member on the clipboard as text', (t) async {
    String? copied;
    t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    addTearDown(() => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    await open(t);
    await t.tap(find.text('Copy list'));
    await t.pump();
    await t.pump();
    expect(copied, 'Aditya Nair (24JIT0001) — 2024 Batch · A — Seen, not acknowledged\nMeera Iyer — 2024 Batch · B — Not on Juvi');
    expect(find.text('Copied 2 names'), findsOneWidget);
  });

  testWidgets('a reminder is confirmed, then sent', (t) async {
    when(() => repo.remind('n1')).thenAnswer((_) async => const Reminders(used: 1, max: 2));
    await open(t);
    expect(find.text('Reminders sent: 0 of 2'), findsOneWidget);
    await t.tap(find.widgetWithText(FilledButton, 'Send reminder'));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Send reminder')));
    await t.pump();
    await t.pump();
    verify(() => repo.remind('n1')).called(1);
    expect(find.text('Reminder sent'), findsOneWidget);
  });

  testWidgets('a third reminder is refused with the reason', (t) async {
    served = reachJson(used: 1);
    when(() => repo.remind('n1')).thenThrow(const ApiFailure(ApiErrorCode.reminderLimit, 'A notice can have at most two reminders.', status: 409));
    await open(t);
    await t.tap(find.widgetWithText(FilledButton, 'Send reminder'));
    await t.pumpAndSettle();
    await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Send reminder')));
    await t.pump();
    await t.pump();
    expect(find.text('A notice can have at most two reminders.'), findsOneWidget);
  });

  testWidgets('with both reminders used, the button is disabled', (t) async {
    served = reachJson(used: 2);
    await open(t);
    expect(t.widget<FilledButton>(find.widgetWithText(FilledButton, 'Send reminder')).onPressed, isNull);
  });

  testWidgets('a student is refused: only the publisher sees reach', (t) async {
    when(() => repo.reach('n1')).thenThrow(const ApiFailure(ApiErrorCode.notPublisher, 'Only the publisher of this notice can do that.', status: 403));
    await open(t);
    expect(find.text('Only the publisher can see who has read this notice.'), findsOneWidget);
  });

  testWidgets('text scale 2.0 lays out without overflow', (t) async {
    await open(t, textScale: 2);
    expect(t.takeException(), isNull);
  });
}
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/notices/reach_screen_test.dart`
Expected: FAIL — `Target of URI doesn't exist: 'package:juvi/features/notices/reach_screen.dart'`.

- [ ] **Step 4: Write the screen and add the route**

```dart
// mobile/lib/features/notices/reach_screen.dart
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/empty_state.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'reach_screen.g.dart';

/// Reach is online only: it is the publisher's live view, never cached.
@riverpod
Future<NoticeReachData> noticeReach(Ref ref, String id) async => (await ref.read(noticesRepositoryProvider.future)).reach(id);

class PendingState {
  const PendingState({required this.page, this.group, this.query, this.loadingMore = false});
  final PendingPage page;
  final String? group;
  final String? query;
  final bool loadingMore;
}

/// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.
@riverpod
class PendingController extends _$PendingController {
  static const _copyPagesMax = 25;

  @override
  Future<PendingState> build(String noticeId) async {
    final repo = await ref.read(noticesRepositoryProvider.future);
    return PendingState(page: await repo.pending(noticeId));
  }

  /// Keeps showing the current list until the filtered one arrives.
  Future<void> _reload({String? group, String? query}) async {
    state = await AsyncValue.guard(() async {
      final repo = await ref.read(noticesRepositoryProvider.future);
      return PendingState(page: await repo.pending(noticeId, group: group, q: query), group: group, query: query);
    });
  }

  Future<void> selectGroup(String? group) => _reload(group: group, query: state.value?.query);

  Future<void> search(String text) => _reload(group: state.value?.group, query: text.trim().isEmpty ? null : text.trim());

  Future<void> loadMore() async {
    final s = state.value;
    final cursor = s?.page.nextCursor;
    if (s == null || cursor == null || s.loadingMore) return;
    state = AsyncData(PendingState(page: s.page, group: s.group, query: s.query, loadingMore: true));
    final repo = await ref.read(noticesRepositoryProvider.future);
    try {
      final next = await repo.pending(noticeId, group: s.group, q: s.query, cursor: cursor);
      state = AsyncData(PendingState(
        page: PendingPage(items: [...s.page.items, ...next.items], total: next.total, groups: next.groups, nextCursor: next.nextCursor),
        group: s.group,
        query: s.query,
      ));
    } on ApiFailure {
      state = AsyncData(s);
      rethrow;
    }
  }

  /// Every pending member under the current filter, fetching the remaining pages.
  Future<List<PendingPerson>> everyone() async {
    final s = state.value;
    if (s == null) return const [];
    final repo = await ref.read(noticesRepositoryProvider.future);
    final all = [...s.page.items];
    var cursor = s.page.nextCursor;
    for (var i = 0; cursor != null && i < _copyPagesMax; i++) {
      final next = await repo.pending(noticeId, group: s.group, q: s.query, cursor: cursor);
      all.addAll(next.items);
      cursor = next.nextCursor;
    }
    return all;
  }
}

/// S11, for the notice's publisher (spec §4 US-4). The four snapshot counts add up
/// to the audience; late acknowledgements, comments and members added after
/// publishing are listed on their own. Anyone else gets 403 `NOT_PUBLISHER`.
class ReachScreen extends ConsumerStatefulWidget {
  const ReachScreen({required this.noticeId, super.key});
  final String noticeId;

  @override
  ConsumerState<ReachScreen> createState() => _ReachScreenState();
}

class _ReachScreenState extends ConsumerState<ReachScreen> {
  bool _reminding = false;

  void _toast(String text) => ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(text)));

  Future<void> _remind() async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(l.reachRemindConfirmTitle),
        content: Text(l.reachRemindConfirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.of(c).pop(true), child: Text(l.reachSendReminder)),
        ],
      ),
    );
    if (!(ok ?? false) || !mounted) return;
    setState(() => _reminding = true);
    try {
      await (await ref.read(noticesRepositoryProvider.future)).remind(widget.noticeId);
      if (mounted) _toast(l.reachRemindSent);
    } on ApiFailure catch (f) {
      // A third reminder is refused with the server's reason (spec §4 US-4.4).
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    } finally {
      if (mounted) setState(() => _reminding = false);
      ref.invalidate(noticeReachProvider(widget.noticeId));
    }
  }

  String _stateLabel(AppLocalizations l, String state) => switch (state) {
        'acknowledged' => l.noticeAcknowledged,
        'seen' => l.reachSeenNotAcked,
        'not_on_juvi' => l.reachNotOnJuvi,
        _ => l.reachNotSeen,
      };

  Future<void> _copy() async {
    final l = context.l10n;
    try {
      final people = await ref.read(pendingControllerProvider(widget.noticeId).notifier).everyone();
      final text = people.map((p) => [p.name, if (p.identifier != null) '(${p.identifier})', '—', p.group, '—', _stateLabel(l, p.state)].join(' ')).join('\n');
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) _toast(l.reachCopied(people.length));
    } on ApiFailure catch (f) {
      if (mounted) _toast(f.isOffline ? l.noticeNeedsConnection : f.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final reach = ref.watch(noticeReachProvider(widget.noticeId));
    return Scaffold(
      appBar: AppBar(title: Text(l.reachTitle)),
      body: RefreshIndicator(
        onRefresh: () => Future.wait([
          ref.refresh(noticeReachProvider(widget.noticeId).future),
          ref.refresh(pendingControllerProvider(widget.noticeId).future),
        ]),
        child: reach.when(
          loading: () => const SkeletonList(),
          error: (e, _) {
            final f = ApiFailure.of(e);
            if (f.code == ApiErrorCode.notPublisher) return ListView(children: [EmptyState(icon: Icons.lock_outline, title: l.reachNotPublisher)]);
            if (f.code == ApiErrorCode.noticeNotFound) {
              return ListView(children: [EmptyState(icon: Icons.search_off, title: l.noticeNotAvailable, hint: l.noticeNotAvailableHint)]);
            }
            return ListView(children: [FailureView(f, onRetry: () => ref.invalidate(noticeReachProvider(widget.noticeId)))]);
          },
          data: (r) => _content(context, r),
        ),
      ),
    );
  }

  Widget _content(BuildContext context, NoticeReachData r) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final canRemind = r.status == 'published' && !r.reminders.exhausted && !_reminding;
    final counts = <(String, int)>[
      if (r.ackRequired) (l.noticeAcknowledged, r.acknowledged),
      (r.ackRequired ? l.reachSeenNotAcked : l.reachSeen, r.seen),
      (l.reachNotSeen, r.notSeen),
      (l.reachNotOnJuvi, r.notOnJuvi),
    ];
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Text(r.title, style: t.titleLarge),
        ),
        if (r.status == 'archived') Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 0), child: Text(l.noticeArchived, style: t.labelLarge)),
        AsOfLine(r.asOf),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final (label, n) in counts)
                SizedBox(
                  width: 150,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('$n', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                        Text(label, style: t.labelMedium),
                      ]),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text(l.reachOfAudience(r.audience), style: t.labelLarge)),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Semantics(
            label: l.reachSparkline,
            excludeSemantics: true,
            child: SizedBox(height: 48, child: CustomPaint(painter: _SparklinePainter(r.sparkline, math.max(r.audience, 1), scheme.primary), size: Size.infinite)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(l.reachReminders(r.reminders.used, r.reminders.max), style: t.bodyMedium),
              FilledButton.tonal(onPressed: canRemind ? _remind : null, child: Text(l.reachSendReminder)),
            ],
          ),
        ),
        if (r.groups.isNotEmpty) ...[
          SectionHeader(l.reachByGroup),
          for (final g in r.groups)
            ListTile(
              title: Text(g.label),
              subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l.reachGroupLine(g.acknowledged, g.total)),
                const SizedBox(height: 6),
                LinearProgressIndicator(value: g.total == 0 ? 0 : g.acknowledged / g.total),
              ]),
            ),
        ],
        _PendingSection(noticeId: widget.noticeId, stateLabel: (s) => _stateLabel(l, s), onCopy: _copy),
        if (r.lateAcks.isNotEmpty) ...[
          SectionHeader(l.reachLate(r.lateCount)),
          for (final p in r.lateAcks)
            ListTile(
              title: Text(p.name),
              subtitle: Text([?p.identifier, p.group, if (p.at != null) dayMonthTime(p.at!)].join(' · ')),
            ),
        ],
        if (r.comments.isNotEmpty) ...[
          SectionHeader(l.reachComments),
          for (final c in r.comments)
            ListTile(
              title: Text(c.name),
              subtitle: Text(c.comment),
              trailing: c.isLate ? Text(l.noticeLate, style: t.labelMedium?.copyWith(color: scheme.error)) : null,
            ),
        ],
        if (r.addedLater.total > 0) ...[
          SectionHeader(l.reachAddedLater),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(l.reachAddedLaterLine(r.addedLater.total, r.addedLater.acknowledged, r.addedLater.seen), style: t.bodyMedium),
          ),
          for (final p in r.addedLater.items)
            ListTile(title: Text(p.name), subtitle: Text([?p.identifier, p.group, _stateLabel(l, p.state)].join(' · '))),
        ],
      ],
    );
  }
}

class _PendingSection extends ConsumerStatefulWidget {
  const _PendingSection({required this.noticeId, required this.stateLabel, required this.onCopy});
  final String noticeId;
  final String Function(String state) stateLabel;
  final VoidCallback onCopy;

  @override
  ConsumerState<_PendingSection> createState() => _PendingSectionState();
}

class _PendingSectionState extends ConsumerState<_PendingSection> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final provider = pendingControllerProvider(widget.noticeId);
    final pending = ref.watch(provider);
    final s = pending.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          l.reachPending(s?.page.total ?? 0),
          trailing: TextButton.icon(onPressed: s == null || s.page.items.isEmpty ? null : widget.onCopy, icon: const Icon(Icons.copy, size: 18), label: Text(l.reachCopy)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: l.reachSearchHint, border: const OutlineInputBorder()),
            onSubmitted: (v) => ref.read(provider.notifier).search(v),
          ),
        ),
        if (s != null && s.page.groups.length > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Wrap(spacing: 8, runSpacing: 4, children: [
              for (final g in <PendingGroup?>[null, ...s.page.groups])
                FilterChip(
                  label: Text(g == null ? l.reachAllGroups : '${g.label} (${g.count})'),
                  selected: s.group == g?.label,
                  onSelected: (_) => ref.read(provider.notifier).selectGroup(g?.label),
                ),
            ]),
          ),
        ...pending.when(
          loading: () => [const SkeletonList(count: 2)],
          error: (e, _) => [FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(provider))],
          data: (s) => [
            if (s.page.items.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(l.reachNoPending)),
            for (final p in s.page.items)
              ListTile(
                title: Text(p.name),
                subtitle: Text([
                  ?p.identifier,
                  p.group,
                  widget.stateLabel(p.state),
                  if (p.lastSeenInApp != null) l.reachLastInApp(dayMonthTime(p.lastSeenInApp!)) else if (p.state != 'not_on_juvi') l.reachNeverInApp,
                ].join(' · ')),
              ),
            if (s.page.nextCursor != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: s.loadingMore
                    ? const Center(child: CircularProgressIndicator())
                    : OutlinedButton(onPressed: () => ref.read(provider.notifier).loadMore(), child: Text(l.showMore)),
              ),
          ],
        ),
      ],
    );
  }
}

/// Cumulative acknowledgements (or views) across the notice's life, scaled to the audience.
class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.points, this.max, this.color);
  final List<int> points;
  final int max;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = size.width * i / (points.length - 1);
      final y = size.height - size.height * (points[i] / max).clamp(0.0, 1.0);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2);
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.points != points || old.max != max || old.color != color;
}
```

In `mobile/lib/app/router.dart`, add `import 'package:juvi/features/notices/reach_screen.dart';` after the `notice_detail_screen.dart` import, and replace:

```dart
      GoRoute(path: '/notices/:id', builder: (_, s) => NoticeDetailScreen(noticeId: s.pathParameters['id']!)),
```

with:

```dart
      GoRoute(
        path: '/notices/:id',
        builder: (_, s) => NoticeDetailScreen(noticeId: s.pathParameters['id']!),
        routes: [GoRoute(path: 'reach', builder: (_, s) => ReachScreen(noticeId: s.pathParameters['id']!))],
      ),
```

- [ ] **Step 5: Generate, analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter analyze`
Expected: `Built with build_runner/aot …`, then `No issues found!`

Run: `cd mobile && flutter test test/features/notices/reach_screen_test.dart`
Expected: `+9: All tests passed!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+172: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/notices mobile/lib/app/router.dart mobile/lib/app/l10n mobile/test/features/notices/reach_screen_test.dart
git commit -m "feat(mobile): S11 reach for publishers

Counts that reconcile to the audience, per-group progress, a pending list
that is grouped, searchable, paged and copyable, late acknowledgements,
comments, members added later, and reminders capped at two.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Onboarding step 4, `FirstNoticeStep`

**Files:**
- Create: `mobile/lib/features/onboarding/steps/first_notice_step.dart`
- Modify: `mobile/lib/features/onboarding/onboarding_screen.dart`, `mobile/lib/app/l10n/app_en.arb` (+ regenerated), `mobile/test/features/onboarding/onboarding_screen_test.dart`

**Interfaces:**
- Consumes: Task 1 `NoticesRepository.firstNotice`, `NoticeDetail`; Task 2 `acknowledgeNotice`, `pendingAcksProvider`; Task 3 `AckControl`; Task 5 `LinkedText`, `externalLauncherProvider`.
- Produces:
  ```dart
  final firstNoticeProvider;   // Future<NoticeDetail> — GET /onboarding/first-notice
  class FirstNoticeStep extends ConsumerStatefulWidget { const FirstNoticeStep(); }
  ```

Decisions that bind later tasks:
- The step is chosen by name: `onboardingSteps[step] == 'first_notice'`. The server owns the list (spec §4 US-5.1); the app never hard-codes the count, and an unknown name still renders the Foundation generic card (US-5.3, pinned by a new test).
- The welcome notice is shown as a card with a real `AckControl` going through `acknowledgeNotice` (so it is attributed, audited, and queued offline like any other). "Finish" is **not** gated on the acknowledgement: an unacknowledged welcome notice has `ackRequired: true` and no deadline, so it stays Due on Today, which is exactly the flow test in Task 10.
- When the welcome notice cannot load (offline), the step says it "will be waiting on Today once you are online" and Finish still works (advancing onboarding needs a connection anyway, as Foundation already says).

- [ ] **Step 1: Add the strings**

Append to `mobile/lib/app/l10n/app_en.arb`:

```json
  "onboardingFirstNoticeTitle": "Your first notice",
  "@onboardingFirstNoticeTitle": { "description": "Onboarding step 4 heading (spec §4 US-5)." },
  "onboardingFirstNoticeBody": "This is how your college reaches you. Hold the button, or tap and confirm, to acknowledge it.",
  "onboardingFirstNoticeOffline": "Your welcome notice will be waiting on Today once you are online.",
  "@onboardingFirstNoticeOffline": { "description": "Onboarding step 4 when the welcome notice cannot be loaded." }
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the failing tests**

In `mobile/test/features/onboarding/onboarding_screen_test.dart`:

- after `import 'package:flutter_riverpod/flutter_riverpod.dart';` add:

```dart
import 'package:flutter_riverpod/misc.dart' show Override;
```

- replace:

```dart
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
```

  with:

```dart
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
```

- after `import 'package:juvi/core/session/session_state.dart';` add:

```dart
import 'package:juvi/core/storage/app_database.dart';
```

- replace:

```dart
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:mocktail/mocktail.dart';
import '../../core/repos/me_repository_test.dart' show meJson;
import '../spaces/spaces_screen_test.dart' show spacesJson;

class _Repo extends Mock implements MeRepository {}
class _Session extends SessionController {
  AccountSummary? updated;
  @override SessionState build() => SessionState.signedIn(Me.fromJson(meJson).account);
  @override Future<void> updateAccount(AccountSummary a) async { updated = a; state = SessionState.signedIn(a); }
}
```

  with:

```dart
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:mocktail/mocktail.dart';
import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';
import '../notices/notice_actions_test.dart' show SpyAnalytics;
import '../spaces/spaces_screen_test.dart' show spacesJson;

class _Repo extends Mock implements MeRepository {}
class _Notices extends Mock implements NoticesRepository {}
class _Session extends SessionController {
  _Session([this.steps]);
  final List<String>? steps;
  AccountSummary? updated;
  @override SessionState build() {
    final a = Me.fromJson(meJson).account;
    return SessionState.signedIn(steps == null ? a : a.copyWith(onboardingSteps: steps!, onboardingStep: steps!.length - 1));
  }
  @override Future<void> updateAccount(AccountSummary a) async { updated = a; state = SessionState.signedIn(a); }
}

const fourSteps = ['identity', 'spaces', 'notifications', 'first_notice'];
```

- replace:

```dart
Widget host(int step, _Repo repo, _Session session, {Map<String, dynamic>? me}) => ProviderScope(
  overrides: [
    meProvider.overrideWith((_) async* { yield Cached(Me.fromJson(me ?? meJson), DateTime.now()); }),
    spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(spacesJson), DateTime.now()); }),
    meRepositoryProvider.overrideWith((_) async => repo),
    sessionControllerProvider.overrideWith(() => session),
  ],
```

  with:

```dart
Widget host(int step, _Repo repo, _Session session, {Map<String, dynamic>? me, List<Override> extra = const []}) => ProviderScope(
  retry: (_, _) => null,
  overrides: [
    meProvider.overrideWith((_) async* { yield Cached(Me.fromJson(me ?? meJson), DateTime.now()); }),
    spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(spacesJson), DateTime.now()); }),
    meRepositoryProvider.overrideWith((_) async => repo),
    sessionControllerProvider.overrideWith(() => session),
    ...extra,
  ],
```

- replace:

```dart
  // Minor (e): `go()` leaves one route, so system back at step > 0 used to exit the app.
```

  with:

```dart
  group('first_notice (step 4)', () {
    late _Notices notices;
    late AppDatabase db;
    late Map<String, dynamic> welcome;
    setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
    setUp(() {
      notices = _Notices();
      db = AppDatabase.memory();
      welcome = detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome', body: 'This is where your college sends official notices.');
      when(notices.firstNotice).thenAnswer((_) async => NoticeDetail.fromJson(welcome));
    });
    tearDown(() => db.close());
    List<Override> extra() => [
          noticesRepositoryProvider.overrideWith((_) async => notices),
          appDatabaseProvider.overrideWith((_) async => db),
          analyticsProvider.overrideWithValue(SpyAnalytics()),
        ];

    testWidgets('shows the welcome notice, acknowledges it for real, and Finish completes onboarding', (t) async {
      final repo = _Repo(); final session = _Session(fourSteps);
      when(() => notices.acknowledge('w1', any())).thenAnswer((_) async {
        welcome = detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z');
        return AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false);
      });
      when(() => repo.advanceOnboarding(3)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 4, onboardingSteps: fourSteps, onboardingComplete: true));
      await t.pumpWidget(host(3, repo, session, extra: extra()));
      await t.pump();
      await t.pump();
      expect(find.text('Your first notice'), findsOneWidget);
      expect(find.text('Welcome to Juvi'), findsOneWidget);
      await t.tap(find.byType(AckControl));
      await t.pumpAndSettle();
      await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
      await t.pump();
      await t.pump();
      await t.pump();
      verify(() => notices.acknowledge('w1', any())).called(1);
      expect(find.textContaining('Acknowledged'), findsOneWidget);
      await t.tap(find.text('Finish'));
      await t.pumpAndSettle();
      expect(session.updated?.onboardingComplete, isTrue);
    });

    testWidgets('without a connection the step says the notice will wait on Today, and Finish still works', (t) async {
      final repo = _Repo(); final session = _Session(fourSteps);
      when(notices.firstNotice).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
      when(() => repo.advanceOnboarding(3)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 4, onboardingSteps: fourSteps, onboardingComplete: true));
      await t.pumpWidget(host(3, repo, session, extra: extra()));
      await t.pump();
      await t.pump();
      expect(find.textContaining('waiting on Today'), findsOneWidget);
      await t.tap(find.text('Finish'));
      await t.pumpAndSettle();
      expect(session.updated?.onboardingComplete, isTrue);
    });
  });

  testWidgets('a step this app does not know yet renders the generic card (spec §4 US-5.3)', (t) async {
    await t.pumpWidget(host(3, _Repo(), _Session(['identity', 'spaces', 'notifications', 'some_future_step'])));
    await t.pump();
    expect(find.textContaining('One more thing from your college'), findsOneWidget);
    expect(find.text('Finish'), findsOneWidget);
  });

  // Minor (e): `go()` leaves one route, so system back at step > 0 used to exit the app.
```


- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/onboarding`
Expected: FAIL — the two `first_notice` tests find no "Your first notice" (the step still renders the generic card); the other five pass.

- [ ] **Step 4: Write the step and route the name to it**

```dart
// mobile/lib/features/onboarding/steps/first_notice_step.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/features/notices/notice_actions.dart';
import 'package:juvi/features/notices/notice_detail_screen.dart' show externalLauncherProvider;
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/notices/widgets/linked_text.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/skeleton.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'first_notice_step.g.dart';

/// `GET /onboarding/first-notice`: the welcome notice for this account's kind; the
/// server creates the recipient row on demand (spec §6.5).
@riverpod
Future<NoticeDetail> firstNotice(Ref ref) async => (await ref.read(noticesRepositoryProvider.future)).firstNotice();

/// Step 4 (`first_notice`, spec §4 US-5): a real welcome notice with a real
/// acknowledgement. Finishing onboarding does not require it — an unacknowledged
/// welcome notice stays Due on Today.
class FirstNoticeStep extends ConsumerStatefulWidget {
  const FirstNoticeStep({super.key});

  @override
  ConsumerState<FirstNoticeStep> createState() => _FirstNoticeStepState();
}

class _FirstNoticeStepState extends ConsumerState<FirstNoticeStep> {
  bool _busy = false;

  Future<void> _acknowledge(String id, AckMethod method) async {
    setState(() => _busy = true);
    try {
      if (await acknowledgeNotice(ref, id, method) == AckOutcome.sent) ref.invalidate(firstNoticeProvider);
    } on ApiFailure catch (f) {
      if (mounted) ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(f.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final notice = ref.watch(firstNoticeProvider);
    final queued = ref.watch(pendingAcksProvider).value ?? const <String>{};
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text(l.onboardingFirstNoticeTitle, style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Text(l.onboardingFirstNoticeBody, style: t.bodyMedium),
      const SizedBox(height: 16),
      notice.when(
        loading: () => const SkeletonList(count: 2),
        error: (_, _) => Text(l.onboardingFirstNoticeOffline, style: t.bodyMedium),
        data: (d) => Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.office, style: t.labelMedium),
              const SizedBox(height: 4),
              Text(d.title, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              LinkedText(d.body, style: t.bodyMedium, onOpen: (uri) => unawaited(ref.read(externalLauncherProvider)(uri))),
              const SizedBox(height: 16),
              if (d.isAcknowledged)
                Row(children: [
                  Icon(Icons.check_circle, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(d.ackAt == null ? l.noticeAcknowledged : l.noticeAcknowledgedAt(dayMonthTime(d.ackAt!)), style: t.titleSmall)),
                ])
              else if (queued.contains(d.id))
                Row(children: [
                  const Icon(Icons.cloud_upload_outlined),
                  const SizedBox(width: 8),
                  Expanded(child: Text(l.noticeWillSendWhenOnline, style: t.titleSmall)),
                ])
              else if (d.needsAck)
                AckControl(onAcknowledge: (m) => _acknowledge(d.id, m), busy: _busy),
            ]),
          ),
        ),
      ),
    ]);
  }
}
```

In `mobile/lib/features/onboarding/onboarding_screen.dart`:

- add `import 'package:juvi/features/onboarding/steps/first_notice_step.dart';` before the `identity_step.dart` import;
- in the class doc comment, change `render (identity, spaces, notifications); an unrecognised name renders a generic` to `render (identity, spaces, notifications, first_notice); an unrecognised name renders a generic`;
- in the step `switch`, after `'notifications' => NotificationsStep(c.data),` add:

```dart
                  'first_notice' => const FirstNoticeStep(),
```

- [ ] **Step 5: Generate, analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter analyze`
Expected: `Built with build_runner/aot …`, then `No issues found!`

Run: `cd mobile && flutter test test/features/onboarding`
Expected: `+7: All tests passed!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+175: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/onboarding mobile/lib/app/l10n mobile/test/features/onboarding
git commit -m "feat(mobile): first_notice onboarding step with a real welcome acknowledgement

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Inline notice cards on the channel screen

**Files:**
- Create: `mobile/test/features/spaces/channel_screen_test.dart`
- Modify: `mobile/lib/core/models/models.dart` (`ChannelDetail.notices`), `mobile/lib/features/spaces/channel_screen.dart`, `mobile/lib/app/l10n/app_en.arb` (+ regenerated), `mobile/test/core/repos/spaces_repository_test.dart`

**Interfaces:**
- Consumes: Task 1 `NoticeItem`; Task 2 `pendingAcksProvider`; Task 4 `NoticeTile`; Foundation `channelProvider`, `ApiSpacesRepository.refreshChannel` (generated `getChannel`, unchanged).
- Produces:
  ```dart
  class ChannelDetail { …; @Default(<NoticeItem>[]) List<NoticeItem> notices; }
  ```

Decisions that bind later tasks:
- `GET /channels/:id` already returns `notices[]` (Plan 1 Task 9); the generated `ChannelDetail` parses it (each item is a scalar-only `NoticeCard`) and `toJson()` hands it to the app model, so `spaces_repository.dart` does not change. A channel document cached before this task has no `notices` key and reads as an empty list.
- The channel screen lists the notices as `NoticeTile`s under a "Notices" header, each pushing `/notices/:id` (US-6.1); with none, the Foundation empty state stays.

- [ ] **Step 1: Add the string**

Append to `mobile/lib/app/l10n/app_en.arb`:

```json
  "channelNotices": "Notices",
  "@channelNotices": { "description": "Channel screen section: notices whose audience matches this channel (spec §4 US-6)." }
```

Run: `cd mobile && flutter gen-l10n`

- [ ] **Step 2: Write the failing tests**

```dart
// mobile/test/features/spaces/channel_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:juvi/features/spaces/channel_screen.dart';

import '../../core/repos/notices_fixtures.dart';

Map<String, dynamic> channelJson(List<Map<String, dynamic>> notices) => {
      'id': 'c3',
      'name': 'CSE 2024',
      'about': 'Batch space for CSE 2024',
      'scopeType': 'batch',
      'templateCode': 'batch',
      'status': 'active',
      'memberCount': 120,
      'replyRule': 'announcement_only',
      'defaultPriority': 'important',
      'role': 'member',
      'muted': false,
      'canPost': false,
      'canReply': false,
      'whoCanPost': 'Class teachers',
      'notices': notices,
    };

Future<GoRouter> pumpChannel(WidgetTester t, Map<String, dynamic> json) async {
  final router = GoRouter(initialLocation: '/spaces/c3', routes: [
    GoRoute(path: '/spaces/:channelId', builder: (_, s) => ChannelScreen(channelId: s.pathParameters['channelId']!)),
    GoRoute(path: '/notices/:id', builder: (_, s) => Scaffold(body: Text('detail ${s.pathParameters['id']}'))),
  ]);
  addTearDown(router.dispose);
  await t.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: [
      channelProvider('c3').overrideWith((_) => Stream.value(Cached(ChannelDetail.fromJson(json), DateTime.now()))),
      pendingAcksProvider.overrideWith((_) async => <String>{}),
    ],
    child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
  ));
  await t.pumpAndSettle();
  return router;
}

void main() {
  testWidgets("a notice sent to this channel's batch appears inline and opens S04", (t) async {
    await pumpChannel(t, channelJson([cardJson('n1')]));
    expect(find.text('NOTICES'), findsOneWidget);
    expect(find.byType(NoticeTile), findsOneWidget);
    await t.tap(find.text('Mid-semester exam timetable'));
    await t.pumpAndSettle();
    expect(find.text('detail n1'), findsOneWidget);
  });

  testWidgets('a channel with no notices keeps its empty state', (t) async {
    await pumpChannel(t, channelJson([]));
    expect(find.byType(NoticeTile), findsNothing);
    expect(find.text('Nothing new'), findsOneWidget);
  });
}
```

In `mobile/test/core/repos/spaces_repository_test.dart`:

- replace:

```dart
import 'package:flutter/material.dart';
```

  with:

```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
```

- after `import 'package:flutter_test/flutter_test.dart';` add:

```dart
import 'package:http_mock_adapter/http_mock_adapter.dart';
```

- replace:

```dart
import 'package:juvi/core/storage/app_database.dart';
import 'package:mocktail/mocktail.dart';
```

  with:

```dart
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' show JuviApi;
import 'package:mocktail/mocktail.dart';

import 'notices_fixtures.dart';
```

- replace:

```dart
void main() {
```

  with:

```dart
void main() {
  test('channel detail parses its notices through the generated client, nulls included', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    DioAdapter(dio: dio).onGet('/channels/c3', (s) => s.reply(200, {
          'id': 'c3', 'name': 'CSE 2024', 'about': 'Batch space', 'scopeType': 'batch', 'templateCode': 'batch',
          'status': 'active', 'memberCount': 120, 'replyRule': 'announcement_only', 'defaultPriority': 'important',
          'role': 'member', 'muted': false, 'canPost': false, 'canReply': false, 'whoCanPost': 'Class teachers',
          'linkedObject': {'type': 'batch', 'id': null},
          'notices': [cardJson('n1', deadline: null)],
        }));
    final db = AppDatabase.memory();
    addTearDown(db.close);
    final repo = ApiSpacesRepository(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), db);
    final detail = (await repo.refreshChannel('c3')).data;
    expect(detail.notices.single.id, 'n1');
    expect(detail.notices.single.deadline, isNull);
    expect(detail.notices.single.isLate, isFalse);
    expect((await repo.cachedChannel('c3'))?.data.notices, hasLength(1));
  });

  test('a channel document cached before notices existed reads as no notices', () {
    final legacy = ChannelDetail.fromJson({
      'id': 'c3', 'name': 'CSE 2024', 'about': 'Batch space', 'scopeType': 'batch', 'templateCode': 'batch',
      'status': 'active', 'memberCount': 120, 'replyRule': 'announcement_only', 'defaultPriority': 'important',
      'role': 'member', 'muted': false, 'canPost': false, 'canReply': false, 'whoCanPost': 'Class teachers',
    });
    expect(legacy.notices, isEmpty);
  });
```


- [ ] **Step 3: Run the tests to see them fail**

Run: `cd mobile && flutter test test/features/spaces/channel_screen_test.dart test/core/repos/spaces_repository_test.dart`
Expected: FAIL — `The getter 'notices' isn't defined for the type 'ChannelDetail'`.

- [ ] **Step 4: Add `notices` to `ChannelDetail` and render it**

In `mobile/lib/core/models/models.dart`:

- after `import 'package:juvi/core/http/api_failure.dart';` add:

```dart
import 'package:juvi/core/models/notices.dart';
```

- replace:

```dart
/// The channel header + About payload. The contract's `ChannelDetail` also carries a
/// `linkedObject` field (the scope object the channel is bound to); it's not surfaced in
/// the app yet, so `fromJson` ignores it like the other extra wire fields (R48).
```

  with:

```dart
/// The channel header + About payload, plus the notices published to the channel's
/// scope that this person received (notices spec §4 US-6). The contract's
/// `ChannelDetail` also carries a `linkedObject` field (the scope object the channel is
/// bound to); it's not surfaced in the app yet, so `fromJson` ignores it like the other
/// extra wire fields (R48). A channel document cached before notices existed has no
/// `notices` key and reads as an empty list.
```

- replace:

```dart
    required String whoCanPost,
  }) = _ChannelDetail;
```

  with:

```dart
    required String whoCanPost,
    @Default(<NoticeItem>[]) List<NoticeItem> notices,
  }) = _ChannelDetail;
```

In `mobile/lib/features/spaces/channel_screen.dart`:

- after `import 'package:flutter_riverpod/flutter_riverpod.dart';` add:

```dart
import 'package:go_router/go_router.dart';
```

- replace:

```dart
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
```

  with:

```dart
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
```

- after `import 'package:juvi/shared/widgets/failure_view.dart';` add:

```dart
import 'package:juvi/shared/widgets/section_header.dart';
```

- replace:

```dart
/// S07: channel header and About.
```

  with:

```dart
/// S07: channel header, About, and the channel's notices inline (notices spec §4
/// US-6); each opens S04. Posts arrive in sub-project 5.
```

- replace:

```dart
    final detail = ref.watch(channelProvider(channelId));
```

  with:

```dart
    final detail = ref.watch(channelProvider(channelId));
    final pending = ref.watch(pendingAcksProvider).value ?? const <String>{};
```

- replace:

```dart
            const SizedBox(height: 32),
            EmptyState(icon: Icons.chat_bubble_outline, title: l.nothingNew),
```

  with:

```dart
            const SizedBox(height: 16),
            if (c.data.notices.isEmpty)
              EmptyState(icon: Icons.chat_bubble_outline, title: l.nothingNew)
            else ...[
              SectionHeader(l.channelNotices),
              for (final n in c.data.notices)
                NoticeTile(
                  notice: n,
                  pendingAck: pending.contains(n.id),
                  onTap: () => GoRouter.maybeOf(context)?.push('/notices/${n.id}'),
                ),
            ],
```


- [ ] **Step 5: Generate, analyze and run the tests**

Run: `cd mobile && dart run build_runner build --delete-conflicting-outputs && flutter analyze`
Expected: `Built with build_runner/aot …`, then `No issues found!`

Run: `cd mobile && flutter test test/features/spaces/channel_screen_test.dart test/core/repos/spaces_repository_test.dart`
Expected: `+7: All tests passed!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+179: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/core/models mobile/lib/features/spaces mobile/lib/app/l10n mobile/test/features/spaces mobile/test/core/repos/spaces_repository_test.dart
git commit -m "feat(mobile): notices inline on the channel screen

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The flow test (onboarding step 4 → Today → acknowledge → "You're clear"), README and CLAUDE.md

**Files:**
- Modify: `mobile/test/flows/sign_in_flow_test.dart`, `mobile/README.md`, `CLAUDE.md` ("Juvi mobile app" section)

**Interfaces:**
- Consumes: everything above, through the real router, `JuviApp`, `buildDio` and the generated client over one mocked Dio (the Foundation flow-test harness).
- Produces: the §12 mobile flow test; `integration_test/sign_in_flow_test.dart` runs the same test on a device unchanged (it imports `test/flows/sign_in_flow_test.dart`).

Decisions:
- The mocks are stateful (`replyCallback`): the account moves through four onboarding steps; `/onboarding/first-notice` and `/attention` reflect whether the welcome notice has been acknowledged; `POST /notices/w1/ack` flips that state and returns the record.
- The test finishes onboarding **without** acknowledging in step 4, sees the welcome notice as the one due card on Today with the tab badge at 1, acknowledges it with a real 1.2 s hold, and ends on "You're clear" with no badge. While writing this plan, this test caught the busy-swap bug fixed in Task 3 (the hold opened S04 when the card turned busy).

- [ ] **Step 1: Extend the flow test**

In `mobile/test/flows/sign_in_flow_test.dart`:

- after `import 'package:juvi/core/storage/secure_store.dart';` add:

```dart
import 'package:juvi/features/notices/widgets/ack_control.dart';
```

- after `import '../core/repos/me_repository_test.dart' show meJson;` add:

```dart
import '../core/repos/notices_fixtures.dart';
```

- replace:

```dart
  testWidgets('sign in → set password → onboarding → Today', (t) async {
```

  with:

```dart
  testWidgets('sign in → set password → onboarding with the first notice → Today → acknowledge → clear', (t) async {
```

- replace:

```dart
    var step = 0;
    var mustChange = true;
    Map<String, dynamic> account() => {
          'id': 'a',
          'kind': 'student',
          'status': step >= 3 ? 'active' : 'onboarding',
          'onboardingStep': step,
          'onboardingSteps': ['identity', 'spaces', 'notifications'],
          'onboardingComplete': step >= 3,
          'mustChangePassword': mustChange,
        };
```

  with:

```dart
    var step = 0;
    var mustChange = true;
    // The welcome notice (onboarding step 4) stays Due until it is acknowledged.
    var acked = false;
    const steps = ['identity', 'spaces', 'notifications', 'first_notice'];
    Map<String, dynamic> account() => {
          'id': 'a',
          'kind': 'student',
          'status': step >= steps.length ? 'active' : 'onboarding',
          'onboardingStep': step,
          'onboardingSteps': steps,
          'onboardingComplete': step >= steps.length,
          'mustChangePassword': mustChange,
        };
    Map<String, dynamic> welcome() => acked
        ? detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z')
        : detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome');
```

- replace:

```dart
          'minAppVersion': null,
          'onboardingSteps': ['identity', 'spaces', 'notifications'],
        }),
```

  with:

```dart
          'minAppVersion': null,
          'onboardingSteps': steps,
        }),
```

- replace:

```dart
      ..onGet('/attention', (s) => s.reply(200, {'dueCount': 0, 'items': <Map<String, dynamic>>[]}))
```

  with:

```dart
      ..onGet('/onboarding/first-notice', (s) => s.replyCallback(200, (_) => welcome()))
      ..onGet(
        '/attention',
        (s) => s.replyCallback(200, (_) => attentionJson([if (!acked) cardJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome')])),
      )
      ..onPost(
        '/notices/w1/ack',
        (s) => s.replyCallback(200, (_) {
          acked = true;
          return ackJson();
        }),
        data: Matchers.any,
      )
```

- replace:

```dart
          step++;
          return {'onboardingStep': step, 'onboardingSteps': ['identity', 'spaces', 'notifications'], 'onboardingComplete': step >= 3};
```

  with:

```dart
          step++;
          return {'onboardingStep': step, 'onboardingSteps': steps, 'onboardingComplete': step >= steps.length};
```

- replace:

```dart
    // Onboarding ×3
    expect(find.text('Your college has set you up'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(find.text('Your spaces'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(find.text('Stay informed, not overwhelmed'), findsOneWidget);
    await t.tap(find.text('Finish'));
    await t.pumpAndSettle();

    // Today
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.text('No classes today'), findsOneWidget);
    expect(mem['juvi.access'], 'a');
```

  with:

```dart
    // Onboarding ×4
    expect(find.text('Your college has set you up'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(find.text('Your spaces'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(find.text('Stay informed, not overwhelmed'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    // Step 4: the real welcome notice. Finishing without acknowledging leaves it Due.
    expect(find.text('Your first notice'), findsOneWidget);
    expect(find.text('Welcome to Juvi'), findsOneWidget);
    expect(find.byType(AckControl), findsOneWidget);
    await t.tap(find.text('Finish'));
    await t.pumpAndSettle();

    // Today: the welcome notice is the one due item, and the tab badge says 1.
    expect(find.text('Welcome to Juvi'), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('1')), findsWidgets);
    expect(find.text("You're clear"), findsNothing);

    // Acknowledge with a 1.2 s hold (the press is recognised after kPressTimeout).
    final hold = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 1250));
    await hold.up();
    await t.pumpAndSettle();

    expect(acked, isTrue);
    expect(find.text('Welcome to Juvi'), findsNothing);
    expect(find.text("You're clear"), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('1')), findsNothing);
    expect(find.text('No classes today'), findsOneWidget);
    expect(mem['juvi.access'], 'a');
```


- [ ] **Step 2: Run it**

Run: `cd mobile && flutter test test/flows`
Expected: `+1: All tests passed!`

- [ ] **Step 3: Document notices in the mobile README**

In `mobile/README.md`:

- replace:

```markdown
- `flutter test test/flows` — the sign-in → onboarding → Today flow against a mocked API.
```

  with:

```markdown
- `flutter test test/flows` — sign in → set password → onboarding (ending on the first-notice step) → Today → acknowledge the welcome notice → "You're clear", against a mocked API.
```

- replace:

```markdown
## Toolchain notes
```

  with:

```markdown
## Notices
Spec `docs/superpowers/specs/2026-09-26-juvi-notices-design.md` §9; plan `docs/superpowers/plans/2026-10-02-juvi-notices-3-mobile.md`.
- `lib/core/repos/notices_repository.dart` is the only notices client. Attention, each segment's first page and each detail are cached (`attention`, `notices:<segment>`, `notice:<id>`); reach is live only.
- Every acknowledgement goes through `acknowledgeNotice()` (`lib/features/notices/notice_actions.dart`) behind the `AckControl` gesture: a 1.2 s hold or tap-then-confirm, confirm-only under a screen reader, never a single tap. Online it is not optimistic; offline it is queued as `notice.ack`, which `SyncWorker` replays (a 409 on replay counts as sent).
- The Due count has one source, `attentionProvider`: the tab badge (`DueBadge`), the attention stack's "+N more" and the sheet's Due label.
- Routes: `/notices/:id` (S04), `/notices/:id/reach` (S11, publishers only) and `/attention` (S05, a modal `SheetPage`).

## Toolchain notes
```

- append to the end of the file (the last "Toolchain notes" bullet):

```markdown
- The notices endpoints carry no nullable-object field and go through the generated client, except `GET /notices/:id/attachments/:key`: the generated method interpolates the slash-bearing key (`colleges/<cid>/notices/<uuid>`) unencoded, so `notices_repository.dart` sends it on the shared Dio as one `Uri.encodeComponent` segment.
```

- [ ] **Step 4: Point CLAUDE.md at the app side**

In `CLAUDE.md`, in the "Juvi mobile app" section, append to the end of the `- Notices: …` bullet (after `Spec: \`docs/superpowers/specs/2026-09-26-juvi-notices-design.md\`.`):

```markdown
 In the app: `mobile/lib/core/repos/notices_repository.dart` is the one notices client (cached attention and details; the attachment URL is its only raw-Dio call); every acknowledgement goes through `acknowledgeNotice()` in `mobile/lib/features/notices/notice_actions.dart` (online it waits for the server; offline it queues `notice.ack`, which `SyncWorker` replays, a 409 counting as sent) behind `AckControl` (1.2 s hold or tap-then-confirm, confirm-only under a screen reader). The Due count comes only from `attentionProvider` (badge, attention stack, sheet).
```

- [ ] **Step 5: Final verification**

Run: `cd mobile && flutter analyze`
Expected: `No issues found!`

Run: `cd mobile && flutter test --exclude-tags golden`
Expected: `+179: All tests passed!`

Run: `cd mobile && flutter test --tags golden`
Expected: `+14: All tests passed!`

Run: `node mobile/tool/check_nullable_objects.js mobile/api/openapi.json`
Expected: exits 0 (no contract change in this plan; no new allow-list entry).

- [ ] **Step 6: Commit**

```bash
git add mobile/test/flows mobile/README.md CLAUDE.md
git commit -m "test(mobile): onboarding first notice to Today to acknowledged flow; notices docs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec item | Where |
|---|---|
| §9 `NoticesRepository` with `attention()`, `list(segment)`, `detail(id)`, `markSeen`, `acknowledge`, `dismiss`, `attachmentUrl`, `reach`, `pending`, `remind`, `firstNotice` | Task 1 (plus `cachedAttention`/`cachedList`/`cachedDetail` for the cached-then-network streams) |
| §9 raw Dio wherever the generated client cannot parse | Task 1 decision table: generated for every endpoint but the attachment URL (path encoding); `error.ack` / `error.reminders` via `ApiFailure` |
| §9 offline `notice.ack` `{ noticeId, method, comment, clientAt, offline: true }`; SyncWorker replay; 409 on replay = success; online not optimistic | Task 2 (`acknowledgeNotice`, `SyncWorker`, `SyncLifecycle`) |
| §9 `DeadlineRing` (depletes; empty and red after the deadline) | Task 3 |
| §9 `AckControl` (1.2 s hold with a filling ring; tap-then-confirm; confirm forced under `accessibleNavigation`) | Task 3 (busy keeps the detector — Task 4 regression test) |
| §9 `NoticeCard`, `AttentionStack`, `NoticeTile` | Task 4 |
| §9 attention stack on Today and Teaching | Task 6 |
| §9 S04 `NoticeDetailScreen` | Task 5 |
| §9 S05 `AttentionSheet` (modal, returns to the caller) | Task 6 (`SheetPage`, route test) |
| §9 S11 `ReachScreen` | Task 7 |
| §9 onboarding `FirstNoticeStep` | Task 8 |
| §9 inline notice cards on the channel screen | Task 9 |
| §9 routes `/notices/:id`, `/notices/:id/reach`, attention sheet as a modal route | Tasks 5, 7, 6 (redirect test in Task 5) |
| §9 analytics `notice.opened`, `notice.acknowledged {late, method}`, `notice.dismissed`, ids and enums only | Task 5 (`opened`), Task 2 (`acknowledged`, `dismissed`; tests assert the exact props) |
| US-2.1 seen once on open; lists never mark seen | Task 5 (two tests) |
| US-2.2 hold or tap-then-confirm; confirm under a screen reader; no single tap | Task 3 (7 tests: hold, early release, confirm, screen reader, semantics, busy, text scale) |
| US-2.3 second ack 409 with the existing record | Task 1 (repository returns `error.ack`), Task 2 (replay 409 = sent) |
| US-2.4 late flagged in the app | Task 4 (card), Task 5 (detail), Task 7 (reach late list) |
| US-2.5 not a recipient → 404 even by link | Task 1 (`noticeNotFound`), Task 5 ("not available", no retry) |
| US-2.6 archived read-only, marked, excluded from Due | Task 4 (card), Task 5 (banner, no controls); Due exclusion is the server's `GET /attention` |
| US-3.1 up to three by deadline, "+N more", "You're clear" | Task 4 (stack tests), Task 6 (Today/Teaching tests), Task 10 (flow) |
| US-3.2 Due count equals the badge everywhere | Task 6 (`DueBadge` and `Due (N)` read one provider; test asserts both), Task 10 (badge 1 → none) |
| US-3.3 online ack removes the card only after confirmation; failure restores with a message | Task 4 (busy-until-confirmed and failure tests), Task 1 (cache drop after confirmation) |
| US-3.4 offline ack queued; "Will send when online" until drained | Task 2 (queue), Task 4 (card), Task 5 (detail), Task 8 (step) |
| US-3.5 All reaches every notice, paged | Task 6 ("Show more" test; "See all" entry point) |
| US-4.1 counts reconcile to the snapshot (app side) | Task 7 (counts test asserts the sum) |
| US-4.2 pending grouped, searchable, copyable, last seen in app | Task 7 (group chip, search, copy-to-clipboard, last-in-app tests) |
| US-4.3 late, comments, added later listed separately | Task 7 |
| US-4.4 third reminder refused with a reason (app side) | Task 7 (409 message test; disabled at 2 of 2), Task 1 (`error.reminders`) |
| US-4.5 student on reach → 403 (app side) | Task 1 (`notPublisher`), Task 7 (message) |
| US-5.1 steps `identity, spaces, notifications, first_notice` | Task 8 (rendered by name), Task 10 (four-step flow) |
| US-5.2 configured or default welcome notice; real acknowledgement | Task 8 (acknowledged through `acknowledgeNotice`), Task 10 (flow) |
| US-5.3 unknown step renders a generic card | Task 8 (test with an unknown step name) |
| US-6.1 notice inline in the matching channel, links to S04 | Task 9 |
| §12 repository tests with contract payloads, including nulls | Task 1 (14 tests), Task 9 (channel notices via the generated client) |
| §12 `AckControl` tests (hold, early release, confirm, screen reader) | Task 3 |
| §12 `AttentionStack` states | Task 4 (empty, three + pill, no pill, busy, failure, offline, error, hold-not-open) |
| §12 offline acknowledgement queue with replay and a 409 | Task 2 (actions, worker, lifecycle tests) |
| §12 goldens for `NoticeCard`, `DeadlineRing`, `AttentionStack` | Tasks 3 and 4 (light and dark each) |
| §12 flow test: onboarding step 4 → Today → acknowledge → "You're clear" | Task 10 |
| §10 never log titles, bodies or comments; ids only in analytics | Tasks 2 and 5 (analytics props asserted) |
| Global: strings in the arb, 44 pt targets, text scale 2.0, `en_IN` dates | Every UI task (arb blocks; `AckControl` 56 pt; text-scale tests in Tasks 3, 4, 5, 7; `dayMonthTime`) |

## Self-review

- **Dry run.** Every task was applied in order to a copy of `mobile/` (cut from `afb1b3f`), regenerating code at each boundary; `flutter analyze` stayed at 0 and the counts in each task are the observed ones: 108/8, 116/8, 126/10, 140/14, 153/14, 163/14, 172/14, 175/14, 179/14, 179/14 (non-golden / golden). The new goldens were generated once, in Tasks 3 and 4.
- **Bug found while dry-running.** The Task 10 flow test showed that a completed hold opened S04: `AckControl` replaced its `GestureDetector` with a spinner while the finger was still down, so the card's `InkWell` won the tap. Task 3's control keeps the detector while busy, and Task 4 carries a regression test that fails against the old version.
- **Names are stable across tasks:** `NoticeItem` (model, contract `NoticeCard`) versus `NoticeCard` (widget); `acknowledgeNotice` / `refreshNotice` (restated in Task 6 when it grows); `pendingAcksProvider` in `core/repos` because `SyncLifecycle` invalidates it.
- **Deliberate choices beyond the spec's wording:** "See all" on the attention header (so Done and All are reachable with ≤ 3 due); the office filter is built from loaded items (no offices endpoint exists); `LinkedText` for body links (spec §5); Finish in step 4 is not gated on the acknowledgement (the welcome notice stays Due on Today, as the §12 flow requires).
- **No backend gap.** Every route, field and error code the app needs is in the live contract; `check_nullable_objects.js` needs no allow-list change. The only client-side workaround is the attachment key encoding.
- **Risks while executing:** goldens are macOS-rendered (CI excludes them); widget tests that pump a new `ProviderScope` in the same test reuse the old container, so each provider-override variant is its own test; `pumpAndSettle` never settles while an indeterminate spinner is visible — use `pump` there, as the tests do.
