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

/// Builds an `Attention` response body.
///
/// The contract requires every `AttentionItem` to carry a `kind` discriminator
/// (`mobile/api/openapi.json`, `required: ['kind','id']`, enum
/// `notice|class_change|fee_due|assessment`) — the regenerated client enforces it
/// with `$checkKeys(..., requiredKeys: ['id','kind'])`. The server stamps
/// `kind: 'notice'` on every notice card it emits (`notices/mobile-service.ts`,
/// both `attention()` and `attentionAll()`), so a bare [cardJson] is NOT a valid
/// attention item: its absence throws inside the generated `Attention.fromJson`,
/// which the repository's `_guard` flattens into `ApiFailure(unknown)`.
///
/// Stamped here rather than in [cardJson], which also models the `/notices`
/// `NoticeCard` — that schema has no `kind` and must not gain one. An item that
/// already carries a `kind` (an ERP `fee_due` / `class_change` / `assessment`
/// item) keeps it.
Map<String, dynamic> attentionJson(List<Map<String, dynamic>> items, {int? dueCount}) => {
      'dueCount': dueCount ?? items.length,
      'items': items.map((i) => <String, dynamic>{'kind': 'notice', ...i}).toList(),
    };

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
      'delivery': {
        'scheduled': 0, 'sent': 2, 'delivered': 3, 'opened': 2, 'failed': 0, 'cancelled': 1,
        'suppressed': {'muted': 1, 'tierOff': 0, 'noDevice': 0},
      },
      'asOf': '2026-10-01T06:00:00.000Z',
    };

Map<String, dynamic> pendingJson({String? nextCursor, List<Map<String, dynamic>>? items}) => {
      'items': items ??
          [
            {'name': 'Aditya Nair', 'identifier': '24JIT0001', 'group': '2024 Batch · A', 'state': 'seen', 'lastSeenInApp': '2026-10-01T05:30:00.000Z', 'delivery': 'opened'},
            {'name': 'Meera Iyer', 'identifier': null, 'group': '2024 Batch · B', 'state': 'not_on_juvi', 'lastSeenInApp': null, 'delivery': 'none'},
          ],
      'total': 2,
      'groups': [
        {'label': '2024 Batch · A', 'count': 1},
        {'label': '2024 Batch · B', 'count': 1},
      ],
      'nextCursor': nextCursor,
    };
