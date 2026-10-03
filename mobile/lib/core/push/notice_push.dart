import 'dart:convert';

import 'package:flutter/foundation.dart' show immutable;

/// The FCM data message for a notice (notifications spec §6.6), as built by the backend's
/// `notifications/payload.ts`: every value a string; `title` absent for a confidential
/// notice and for a Routine batch (`count` > 1). Never a body, names or deadlines.
class NoticePush {
  const NoticePush({
    required this.deliveryId,
    required this.receipt,
    required this.noticeId,
    required this.tier,
    required this.groupKey,
    required this.office,
    required this.variant,
    required this.count,
    this.title,
  });

  static final _objectId = RegExp(r'^[0-9a-f]{24}$');

  /// Null for anything that is not a well-formed notice push (an unknown `kind` from a
  /// later sub-project, or a missing field), which the app then ignores.
  static NoticePush? tryParse(Map<String, dynamic> data) {
    String? s(String k) => data[k] is String ? data[k] as String : null;
    final deliveryId = s('deliveryId');
    final receipt = s('receipt');
    final noticeId = s('noticeId');
    final tier = s('tier');
    final groupKey = s('groupKey');
    final office = s('office');
    if (s('kind') != 'notice' || deliveryId == null || receipt == null || noticeId == null || groupKey == null || office == null) return null;
    if (!const {'urgent', 'important', 'routine'}.contains(tier)) return null;
    // The id becomes a route (`/notices/<id>`), so only an ObjectId is accepted.
    if (!_objectId.hasMatch(noticeId)) return null;
    return NoticePush(
      deliveryId: deliveryId,
      receipt: receipt,
      noticeId: noticeId,
      tier: tier!,
      groupKey: groupKey,
      office: office,
      variant: s('variant') == 'reminder' ? 'reminder' : 'published',
      count: int.tryParse(s('count') ?? '') ?? 1,
      title: s('title'),
    );
  }

  /// Parses the local-notification payload written by [toPayload].
  static NoticePush? fromPayload(String? payload) {
    if (payload == null) return null;
    try {
      return tryParse(Map<String, dynamic>.from(jsonDecode(payload) as Map));
    } on Object {
      return null;
    }
  }

  final String deliveryId;
  final String receipt;
  final String noticeId;

  /// `urgent | important | routine`.
  final String tier;
  final String groupKey;
  final String office;

  /// `published | reminder`.
  final String variant;

  /// Notices in this notification: more than 1 only for a Routine batch.
  final int count;
  final String? title;

  bool get isDigest => count > 1;
  bool get isReminder => variant == 'reminder';

  /// Where a tap goes: the attention sheet for a Routine batch, otherwise S04.
  String get location => isDigest ? '/attention' : '/notices/$noticeId';

  /// Carried as the local notification's payload so a tap can post `opened`.
  String toPayload() => jsonEncode({
        'kind': 'notice',
        'deliveryId': deliveryId,
        'receipt': receipt,
        'noticeId': noticeId,
        'tier': tier,
        'groupKey': groupKey,
        'office': office,
        'variant': variant,
        'count': '$count',
        'title': ?title,
      });
}

/// What the tray shows: a title line and an optional text line.
@immutable
class TrayContent {
  const TrayContent(this.title, [this.text]);
  final String title;
  final String? text;
  @override
  bool operator ==(Object other) => other is TrayContent && other.title == title && other.text == text;
  @override
  int get hashCode => Object.hash(title, text);
  @override
  String toString() => 'TrayContent($title, $text)';
}

/// The tray wording (spec §6.6), identical to the portal's `trayNotification()` in
/// `admin-portal/src/lib/notices.ts`. Fixed English strings, because the background
/// isolate has no `BuildContext`; each mirrors an `app_en.arb` entry (`pushNewNoticeFrom`,
/// `pushReminderFrom`, `pushReminderTitle`, `pushDigest`) and a test holds them equal.
TrayContent trayContent(NoticePush p) {
  if (p.isDigest) return TrayContent('${p.count} new notices from ${p.office}');
  final title = p.title;
  if (p.isReminder) return title == null ? TrayContent('Reminder from ${p.office}') : TrayContent(p.office, 'Reminder: $title');
  return title == null ? TrayContent('New notice from ${p.office}') : TrayContent(p.office, title);
}

/// One Android notification channel per tier (spec §8.2).
class PushChannel {
  const PushChannel(this.id, this.name, this.description, this.importance);
  final String id;
  final String name;
  final String description;

  /// `max | high | low`, mapped onto the plugin's `Importance` by the renderer.
  final String importance;
  bool get sound => importance != 'low';
}

// Names and descriptions mirror app_en.arb (`pushChannel*`, `settingsTier*Desc`).
const urgentChannel = PushChannel('juvi_urgent', 'Urgent notices', 'Exam changes, campus closures. Always delivered; cannot be turned off.', 'max');
const importantChannel = PushChannel('juvi_important', 'Important notices', 'Notices needing acknowledgement, department posts, mentions.', 'high');
const routineChannel = PushChannel('juvi_routine', 'Routine notices', 'Course posts and replies. Badge and digest only, no sound.', 'low');
const List<PushChannel> pushChannels = [urgentChannel, importantChannel, routineChannel];

/// A reminder is always on the Important channel; otherwise the tier picks it.
PushChannel channelFor(NoticePush p) {
  if (p.isReminder) return importantChannel;
  return switch (p.tier) {
    'urgent' => urgentChannel,
    'important' => importantChannel,
    _ => routineChannel,
  };
}

/// A stable 31-bit id (FNV-1a), so a notification re-sent after a sender lease expired
/// replaces the first one instead of appearing twice (spec §11).
int stableNotificationId(String key) {
  var h = 0x811c9dc5;
  for (final c in key.codeUnits) {
    h = ((h ^ c) * 0x01000193) & 0xffffffff;
  }
  return h & 0x7fffffff;
}

/// The id of one notification, and of its group's summary.
int notificationIdFor(NoticePush p) => stableNotificationId(p.deliveryId);
int summaryIdFor(NoticePush p) => stableNotificationId('group:${p.groupKey}');
