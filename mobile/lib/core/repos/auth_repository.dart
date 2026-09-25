import 'package:dio/dio.dart';
import 'package:juvi/core/env.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_repository.g.dart';

class DeviceInfo {
  const DeviceInfo({required this.id, required this.name, required this.platform, required this.appVersion, required this.osVersion});
  final String id;
  final String name;
  final String platform;
  final String appVersion;
  final String osVersion;
}

abstract class AuthRepository {
  Future<InstitutionIdentity> lookupInstitution(String code);
  Future<({Tokens tokens, AccountSummary account})> signIn({required String collegeId, required String identifier, required String password, required DeviceInfo device});
  Future<Tokens?> refresh(String refreshToken, String deviceId);
  Future<void> signOut();
  Future<void> changePassword(String currentPassword, String newPassword);
  Future<AccountSummary> fetchAccount();
}

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._api, this._bare, this._dio);
  final wire.MobileApi _api;
  final wire.MobileApi _bare;
  final Dio _dio;

  @override
  Future<InstitutionIdentity> lookupInstitution(String code) async {
    try {
      final r = await _bare.lookupInstitution(code: code.trim().toUpperCase());
      return InstitutionIdentity.fromJson(r.data!.toJson());
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<({Tokens tokens, AccountSummary account})> signIn({required String collegeId, required String identifier, required String password, required DeviceInfo device}) async {
    try {
      final r = await _bare.signIn(signInRequest: wire.SignInRequest.fromJson({
        'collegeId': collegeId, 'identifier': identifier, 'password': password,
        'device': {'id': device.id, 'name': device.name, 'platform': device.platform, 'appVersion': device.appVersion, 'osVersion': device.osVersion},
      }));
      final json = r.data!.toJson();
      return (
        tokens: Tokens(accessToken: json['accessToken'] as String, refreshToken: json['refreshToken'] as String),
        account: AccountSummary.fromJson(Map<String, dynamic>.from(json['account'] as Map)),
      );
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<Tokens?> refresh(String refreshToken, String deviceId) async {
    try {
      final r = await _bare.refresh(refreshRequest: wire.RefreshRequest.fromJson({'refreshToken': refreshToken, 'deviceId': deviceId}));
      final json = r.data!.toJson();
      return Tokens(accessToken: json['accessToken'] as String, refreshToken: json['refreshToken'] as String);
    } on Object catch (e) {
      final f = ApiFailure.of(e);
      if (f.isOffline) throw f; // keep the session; the caller retries later
      return null; // 401: the session is gone
    }
  }

  @override
  Future<void> signOut() async {
    try {
      await _api.signOut();
    } on Object catch (_) {
      /* best effort; local wipe follows */
    }
  }

  @override
  Future<void> changePassword(String currentPassword, String newPassword) async {
    try {
      await _api.changePassword(changePasswordRequest: wire.ChangePasswordRequest.fromJson({'currentPassword': currentPassword, 'newPassword': newPassword}));
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  /// Fetches `/me` on the shared authenticated Dio rather than through
  /// `wire.MobileApi.getMe()`: the generated `wire.Me` declares `student`/`faculty`
  /// non-nullable and unconditionally casts them to `Map<String, dynamic>`, even
  /// though the contract marks both `type: ["object", "null"]` — a generator gap for
  /// nullable object properties (see core/repos/me_repository.dart and
  /// task-7-report.md). Since exactly one of the two is null on every real account,
  /// `wire.Me.fromJson` throws a TypeError here on every real payload.
  @override
  Future<AccountSummary> fetchAccount() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/me');
      return AccountSummary.fromJson(Map<String, dynamic>.from(response.data!['account'] as Map));
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }
}

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) =>
    ApiAuthRepository(ref.read(mobileApiProvider), ref.read(bareMobileApiProvider), ref.read(dioProvider));

@Riverpod(keepAlive: true)
Future<DeviceInfo> deviceInfo(Ref ref) async => DeviceInfo(
      id: await ref.read(secureStoreProvider).deviceId(),
      name: AppEnv.platform == 'ios' ? 'iPhone' : 'Android phone',
      platform: AppEnv.platform,
      appVersion: await ref.read(appVersionProvider.future),
      osVersion: 'unknown',
    );
