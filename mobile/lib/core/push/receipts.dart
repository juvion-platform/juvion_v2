// mobile/lib/core/push/receipts.dart
import 'dart:convert';

import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:shared_preferences/shared_preferences.dart';

/// One `delivered` or `opened` receipt (notifications spec §7.2). The HMAC [receipt] from
/// the push authorises it, so no session is needed.
class ReceiptItem {
  const ReceiptItem({required this.deliveryId, required this.receipt, required this.event, required this.at});
  factory ReceiptItem.fromJson(Map<String, dynamic> j) => ReceiptItem(
        deliveryId: j['deliveryId'] as String,
        receipt: j['receipt'] as String,
        event: j['event'] as String,
        at: DateTime.parse(j['at'] as String),
      );
  final String deliveryId;
  final String receipt;

  /// `delivered | opened`.
  final String event;
  final DateTime at;

  /// One queued receipt per delivery and event.
  String get key => '$deliveryId:$event';
  Map<String, dynamic> toJson() => {'deliveryId': deliveryId, 'receipt': receipt, 'event': event, 'at': at.toUtc().toIso8601String()};
}

/// Receipts that could not be posted, kept in shared preferences so the background isolate
/// (which has no database connection) can add to it and the foreground can drain it.
/// Every read starts with `reload()`: the other isolate may have written since.
class ReceiptQueue {
  static const key = 'juvi.push.receipts';

  /// Receipts are worth little after the 7-day receipt expiry; the oldest go first.
  static const max = 200;

  Future<List<ReceiptItem>> read() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getString(key);
    if (raw == null) return [];
    try {
      return [for (final j in jsonDecode(raw) as List) ReceiptItem.fromJson(Map<String, dynamic>.from(j as Map))];
    } on Object {
      return [];
    }
  }

  Future<void> _write(List<ReceiptItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    if (items.isEmpty) {
      await prefs.remove(key);
    } else {
      final kept = items.length > max ? items.sublist(items.length - max) : items;
      await prefs.setString(key, jsonEncode([for (final i in kept) i.toJson()]));
    }
  }

  Future<void> add(ReceiptItem item) async {
    final items = await read();
    await _write([...items.where((i) => i.key != item.key), item]);
  }

  Future<void> remove(Set<String> keys) async {
    final items = await read();
    await _write(items.where((i) => !keys.contains(i.key)).toList());
  }
}

/// Posts receipts through the generated client on a Dio with no session (the foreground's
/// `bareDioProvider`, or a plain Dio in the background isolate). A receipt that cannot be
/// sent now is queued; one the server refuses for good is dropped.
class Receipts {
  Receipts(this._api, this._queue);
  final wire.MobileApi _api;
  final ReceiptQueue _queue;

  static const _batch = 50;

  Future<void> post(ReceiptItem item) async {
    if (!await _send([item])) await _queue.add(item);
  }

  /// Sends everything queued, 50 at a time; what still cannot be sent stays queued.
  Future<void> drain() async {
    final items = await _queue.read();
    final done = <String>{};
    for (var i = 0; i < items.length; i += _batch) {
      final chunk = items.sublist(i, i + _batch > items.length ? items.length : i + _batch);
      if (!await _send(chunk)) break;
      done.addAll(chunk.map((r) => r.key));
    }
    if (done.isNotEmpty) await _queue.remove(done);
  }

  /// True when the server has the items, or refused them in a way no retry fixes (a 4xx
  /// other than 429: an expired or forged receipt, a malformed item). False when offline,
  /// rate-limited or the server failed, so the items are kept for later.
  Future<bool> _send(List<ReceiptItem> items) async {
    try {
      await _api.postNotificationReceipts(
        receiptsRequest: wire.ReceiptsRequest.fromJson({'items': [for (final i in items) i.toJson()]}),
      );
      return true;
    } on Object catch (e) {
      final f = ApiFailure.of(e);
      final status = f.status;
      return !f.isOffline && status != null && status >= 400 && status < 500 && status != 429;
    }
  }
}
