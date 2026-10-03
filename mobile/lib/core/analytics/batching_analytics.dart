import 'dart:async';

import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' as wire;

/// The server's allow-list (`POST /v1/events`, notifications spec §7.3), read from the
/// generated contract so the two cannot drift. Anything else is never queued.
final Set<String> eventNames = {for (final n in wire.EventsRequestEventsInnerNameEnum.values) n.value};

final _propString = RegExp(r'^[A-Za-z0-9_.:-]*$');
bool _validPropString(String s) => s.length <= 64 && _propString.hasMatch(s);

/// The server's prop rules (§7.3): at most 10 keys, each value an id-like string of at most
/// 64 characters, a finite number or a boolean. Anything else is dropped here rather than
/// costing the whole event at the server (e.g. `late: null` on a queued acknowledgement).
Map<String, Object> sanitizeProps(Map<String, Object?> props) {
  final out = <String, Object>{};
  for (final MapEntry(:key, :value) in props.entries) {
    if (out.length == 10) break;
    if (!_validPropString(key)) continue;
    final ok = switch (value) {
      final String s => _validPropString(s),
      final num n => n.isFinite,
      bool() => true,
      _ => false,
    };
    if (ok) out[key] = value!;
  }
  return out;
}

/// Product analytics to our backend (spec §8.7, NFR-11), behind the Foundation [Analytics]
/// interface so callers do not change. Events are queued in the drift `analytics_events`
/// table (newest 1,000 kept) and flushed to `POST /v1/events` 30 s after the first unsent
/// one, as soon as 20 are queued, and when the app goes to the background (SyncLifecycle).
/// Only a signed-in session queues or sends: `/events` needs one, and a sign-out wipes the
/// queue with the rest of the database. Debug builds still print every event.
class BatchingAnalytics implements Analytics {
  BatchingAnalytics({
    required this._database,
    required this._api,
    required this._signedIn,
    this.flushEvery = const Duration(seconds: 30),
    this.flushAt = 20,
    this._now = DateTime.now,
    this._log,
  });

  final Future<AppDatabase> Function() _database;
  final wire.MobileApi Function() _api;
  final bool Function() _signedIn;
  final DateTime Function() _now;
  final void Function(String line)? _log;
  final Duration flushEvery;
  final int flushAt;

  static const _batch = 100;
  Timer? _timer;
  Future<void>? _inFlight;

  @override
  void track(String event, [Map<String, Object?> props = const {}]) {
    _log?.call('[analytics] $event ${props.isEmpty ? '' : props}');
    if (!eventNames.contains(event) || !_signedIn()) return;
    unawaited(_enqueue(event, sanitizeProps(props), _now()));
  }

  Future<void> _enqueue(String event, Map<String, Object> props, DateTime at) async {
    try {
      final db = await _database();
      await db.enqueueEvent(event, at, props);
      if (await db.eventCount() >= flushAt) {
        await flush();
      } else {
        _schedule();
      }
    } on Object {
      // Analytics never fails a user action.
    }
  }

  void _schedule() => _timer ??= Timer(flushEvery, () {
        _timer = null;
        unawaited(flush());
      });

  /// Sends everything queued, 100 events a request. One flush at a time.
  Future<void> flush() => _inFlight ??= _flush().whenComplete(() => _inFlight = null);

  Future<void> _flush() async {
    _timer?.cancel();
    _timer = null;
    if (!_signedIn()) return;
    try {
      final db = await _database();
      while (true) {
        final batch = await db.eventBatch(_batch);
        if (batch.isEmpty) return;
        if (!await _send(batch)) {
          _schedule();
          return;
        }
        await db.removeEvents(batch.map((e) => e.id));
        if (batch.length < _batch) return;
      }
    } on Object {
      // The database closed under us (sign-out); nothing left to send.
    }
  }

  /// True when the batch is done with: accepted (the server drops invalid events one by
  /// one), or refused in a way a retry cannot fix. False keeps it for later: offline, a
  /// server error, rate limiting or an expired session.
  Future<bool> _send(List<QueuedEvent> batch) async {
    try {
      await _api().postEvents(
        eventsRequest: wire.EventsRequest.fromJson({
          'events': [
            for (final e in batch) {'name': e.name, 'at': e.at.toIso8601String(), 'props': e.props},
          ],
        }),
      );
      return true;
    } on Object catch (e) {
      final f = ApiFailure.of(e);
      final s = f.status;
      return !(f.isOffline || s == null || s >= 500 || s == 429 || s == 401);
    }
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }
}
