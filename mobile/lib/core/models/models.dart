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

@freezed
abstract class PersonCard with _$PersonCard {
  const factory PersonCard({required String name, required String firstName, String? photoUrl}) = _PersonCard;
  factory PersonCard.fromJson(Map<String, dynamic> json) => _$PersonCardFromJson(json);
}

@freezed
abstract class StudentCard with _$StudentCard {
  const factory StudentCard({
    required bool isLateralEntry,
    String? rollNumber,
    String? programme,
    String? branch,
    String? batch,
    String? section,
    String? department,
    String? hostel,
  }) = _StudentCard;
  factory StudentCard.fromJson(Map<String, dynamic> json) => _$StudentCardFromJson(json);
}

@freezed
abstract class FacultyCard with _$FacultyCard {
  const factory FacultyCard({required String employeeCode, required String designation, required bool isHod, String? department}) = _FacultyCard;
  factory FacultyCard.fromJson(Map<String, dynamic> json) => _$FacultyCardFromJson(json);
}

@freezed
abstract class QuietHours with _$QuietHours {
  const factory QuietHours({required String start, required String end}) = _QuietHours;
  factory QuietHours.fromJson(Map<String, dynamic> json) => _$QuietHoursFromJson(json);
}

@freezed
abstract class Tiers with _$Tiers {
  const factory Tiers({required bool important, required bool routine}) = _Tiers;
  factory Tiers.fromJson(Map<String, dynamic> json) => _$TiersFromJson(json);
}

@freezed
abstract class Settings with _$Settings {
  const factory Settings({required QuietHours quietHours, required Tiers tiers, required String language}) = _Settings;
  factory Settings.fromJson(Map<String, dynamic> json) => _$SettingsFromJson(json);
}

@freezed
abstract class InstitutionInfo with _$InstitutionInfo {
  const factory InstitutionInfo({
    required String name,
    required String code,
    required String timezone,
    String? logoUrl,
    String? accentColor,
    SupportContact? supportContact,
  }) = _InstitutionInfo;
  factory InstitutionInfo.fromJson(Map<String, dynamic> json) => _$InstitutionInfoFromJson(json);
}

/// The /me payload. `student`/`faculty` are mutually exclusive on `account.kind`;
/// the contract (mobile/api/openapi.json) marks both nullable — unlike the generated
/// `juvi_api` client's `Me`, which (a generator gap for `type: ["object", "null"]`
/// properties) declares them non-nullable and crashes decoding a real payload. See
/// core/repos/me_repository.dart.
@freezed
abstract class Me with _$Me {
  const factory Me({
    required AccountSummary account,
    required PersonCard person,
    required Settings settings,
    required InstitutionInfo institution,
    required String asOf,
    StudentCard? student,
    FacultyCard? faculty,
  }) = _Me;
  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);
}

@freezed
abstract class OnboardingStateData with _$OnboardingStateData {
  const factory OnboardingStateData({required int onboardingStep, required List<String> onboardingSteps, required bool onboardingComplete}) = _OnboardingStateData;
  factory OnboardingStateData.fromJson(Map<String, dynamic> json) => _$OnboardingStateDataFromJson(json);
}

@freezed
abstract class DeviceRow with _$DeviceRow {
  const factory DeviceRow({
    required String sessionId,
    required String deviceName,
    required String platform,
    required String appVersion,
    required String lastActiveAt,
    required bool isCurrent,
  }) = _DeviceRow;
  factory DeviceRow.fromJson(Map<String, dynamic> json) => _$DeviceRowFromJson(json);
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
