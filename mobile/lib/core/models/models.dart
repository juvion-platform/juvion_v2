import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:juvi/core/http/api_failure.dart';

part 'models.freezed.dart';
part 'models.g.dart';

@freezed
abstract class Tokens with _$Tokens {
  const factory Tokens({required String accessToken, required String refreshToken}) = _Tokens;
  factory Tokens.fromJson(Map<String, dynamic> json) => _$TokensFromJson(json);
}

@freezed
abstract class SupportContact with _$SupportContact {
  const factory SupportContact({required String name, String? phone, String? email}) = _SupportContact;
  factory SupportContact.fromJson(Map<String, dynamic> json) => _$SupportContactFromJson(json);
}

@freezed
abstract class AccountSummary with _$AccountSummary {
  const factory AccountSummary({
    required String id,
    required String kind, // student | faculty | staff
    required String status,
    required int onboardingStep,
    required List<String> onboardingSteps,
    required bool onboardingComplete,
    required bool mustChangePassword,
  }) = _AccountSummary;
  factory AccountSummary.fromJson(Map<String, dynamic> json) => _$AccountSummaryFromJson(json);
}

@freezed
abstract class InstitutionIdentity with _$InstitutionIdentity {
  const factory InstitutionIdentity({
    required String collegeId,
    required String name,
    required bool paused,
    String? logoUrl,
    String? accentColor,
    String? pausedMessage,
  }) = _InstitutionIdentity;
  factory InstitutionIdentity.fromJson(Map<String, dynamic> json) => _$InstitutionIdentityFromJson(json);
}

@freezed
abstract class AppConfigData with _$AppConfigData {
  const factory AppConfigData({
    required String name,
    required String code,
    required Map<String, String> quietHoursDefault,
    required String timezone,
    required List<String> onboardingSteps,
    String? logoUrl,
    String? accentColor,
    SupportContact? supportContact,
  }) = _AppConfigData;
  factory AppConfigData.fromJson(Map<String, dynamic> json) => _$AppConfigDataFromJson(json);
}

/// A cached value with its server as-of time. `stale` means the last refresh failed.
class Cached<T> {
  const Cached(this.data, this.asOf, {this.stale = false, this.failure});
  final T data;
  final DateTime asOf;
  final bool stale;
  final ApiFailure? failure;
  Cached<T> markStale(ApiFailure f) => Cached(data, asOf, stale: true, failure: f);
}
