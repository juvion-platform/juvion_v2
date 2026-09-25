import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'spaces_repository.g.dart';

abstract class SpacesRepository {
  Future<Cached<SpacesData>?> cached();
  Future<Cached<SpacesData>> refresh();
  Future<Cached<ChannelDetail>?> cachedChannel(String id);
  Future<Cached<ChannelDetail>> refreshChannel(String id);
  // The brief's fixed interface shape (task-8-brief.md); positional to match every
  // call site (`repo.setMuted(c.id, muted)`).
  // ignore: avoid_positional_boolean_parameters
  Future<void> setMuted(String channelId, bool muted);
  Future<void> markRead(String channelId);
}

/// `listSpaces`/`getChannel`/`muteChannel`/`unmuteChannel`/`markChannelRead` all go
/// through the generated `wire.MobileApi` (unlike `me`/`me/photo` in
/// `me_repository.dart`). None of these five carries a nullable *object* field — the
/// generator gap there is specific to `type: ["object", "null"]` schemas (see
/// `Me.student`/`Me.faculty`) — and none builds a request body, so there's no
/// `uploadPhoto`-style body-building bug either. Checked field-by-field against
/// `mobile/api/openapi.json`'s `Spaces`/`ChannelDetail`/`MuteResult`/`ReadResult`
/// schemas and the generated models in `packages/juvi_api/lib/src/model/`.
class ApiSpacesRepository implements SpacesRepository {
  ApiSpacesRepository(this._api, this._db);
  final wire.MobileApi _api;
  final AppDatabase _db;

  Future<T> _guard<T>(Future<T> Function() f) async {
    try {
      return await f();
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<Cached<SpacesData>?> cached() async {
    final doc = await _db.readDoc('spaces');
    return doc == null ? null : Cached(SpacesData.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<SpacesData>> refresh() => _guard(() async {
        final json = (await _api.listSpaces()).data!.toJson();
        final asOf = DateTime.tryParse(json['asOf'] as String? ?? '')?.toUtc() ?? DateTime.now().toUtc();
        await _db.writeDoc('spaces', json, asOf);
        return Cached(SpacesData.fromJson(json), asOf);
      });

  @override
  Future<Cached<ChannelDetail>?> cachedChannel(String id) async {
    final doc = await _db.readDoc('channel:$id');
    return doc == null ? null : Cached(ChannelDetail.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<ChannelDetail>> refreshChannel(String id) => _guard(() async {
        final json = (await _api.getChannel(id: id)).data!.toJson();
        final now = DateTime.now().toUtc();
        await _db.writeDoc('channel:$id', json, now);
        return Cached(ChannelDetail.fromJson(json), now);
      });

  @override
  Future<void> setMuted(String channelId, bool muted) =>
      _guard(() => muted ? _api.muteChannel(id: channelId) : _api.unmuteChannel(id: channelId));

  @override
  Future<void> markRead(String channelId) => _guard(() => _api.markChannelRead(id: channelId));
}

@Riverpod(keepAlive: true)
Future<SpacesRepository> spacesRepository(Ref ref) async =>
    ApiSpacesRepository(ref.read(mobileApiProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network, same shape as `me` in `me_repository.dart`.
@riverpod
Stream<Cached<SpacesData>> spaces(Ref ref) async* {
  final repo = await ref.read(spacesRepositoryProvider.future);
  final c = await repo.cached();
  if (c != null) yield c;
  try {
    yield await repo.refresh();
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}

@riverpod
Stream<Cached<ChannelDetail>> channel(Ref ref, String id) async* {
  final repo = await ref.read(spacesRepositoryProvider.future);
  final c = await repo.cachedChannel(id);
  if (c != null) yield c;
  try {
    yield await repo.refreshChannel(id);
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}

/// Rewrites `muted` for [channelId] inside a decoded `spaces` cache document's `groups`,
/// leaving every other group and channel untouched.
List<Map<String, dynamic>> _withMuted(Map<String, dynamic> json, String channelId, bool muted) {
  return (json['groups'] as List).map((g) {
    final group = Map<String, dynamic>.from(g as Map);
    group['channels'] = (group['channels'] as List).map((x) {
      final ch = Map<String, dynamic>.from(x as Map);
      return ch['id'] == channelId ? {...ch, 'muted': muted} : ch;
    }).toList();
    return group;
  }).toList();
}

/// Channel ids with a mute toggle currently in flight — a plain mutable `Set` cached for
/// the container's lifetime, so `toggleMute` can guard against a second tap on the same
/// row before the first request resolves.
@Riverpod(keepAlive: true)
Set<String> muteInFlight(Ref ref) => <String>{};

/// Optimistic mute toggle; queues the write when offline (spec §11 pending actions) and
/// rewrites the cached list so the row flips immediately. On a non-offline failure (403,
/// 500, ...) the pre-toggle cache document is written back unchanged (same `asOf`) and
/// the failure is rethrown so the caller can tell the user; on an offline failure the
/// optimistic state is kept and the write is queued, same as before. A second toggle of
/// the same channel while the first is still in flight is a no-op.
Future<void> toggleMute(WidgetRef ref, SpaceChannel c) async {
  final inFlight = ref.read(muteInFlightProvider);
  if (!inFlight.add(c.id)) return;
  try {
    final db = await ref.read(appDatabaseProvider.future);
    final repo = await ref.read(spacesRepositoryProvider.future);
    final muted = !c.muted;
    final previousDoc = await db.readDoc('spaces');
    if (previousDoc != null) {
      await db.writeDoc('spaces', {...previousDoc.json, 'groups': _withMuted(previousDoc.json, c.id, muted)}, previousDoc.asOf);
    }
    try {
      await repo.setMuted(c.id, muted);
    } on ApiFailure catch (f) {
      if (f.isOffline) {
        await db.enqueueAction(PendingAction.create(muted ? 'channel.mute' : 'channel.unmute', {'channelId': c.id}));
      } else {
        if (previousDoc != null) await db.writeDoc('spaces', previousDoc.json, previousDoc.asOf);
        ref.invalidate(spacesProvider);
        rethrow;
      }
    }
    ref.invalidate(spacesProvider);
  } finally {
    inFlight.remove(c.id);
  }
}
