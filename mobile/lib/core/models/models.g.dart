// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Tokens _$TokensFromJson(Map<String, dynamic> json) => _Tokens(
  accessToken: json['accessToken'] as String,
  refreshToken: json['refreshToken'] as String,
);

Map<String, dynamic> _$TokensToJson(_Tokens instance) => <String, dynamic>{
  'accessToken': instance.accessToken,
  'refreshToken': instance.refreshToken,
};

_SupportContact _$SupportContactFromJson(Map<String, dynamic> json) =>
    _SupportContact(
      name: json['name'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
    );

Map<String, dynamic> _$SupportContactToJson(_SupportContact instance) =>
    <String, dynamic>{
      'name': instance.name,
      'phone': instance.phone,
      'email': instance.email,
    };

_AccountSummary _$AccountSummaryFromJson(Map<String, dynamic> json) =>
    _AccountSummary(
      id: json['id'] as String,
      kind: json['kind'] as String,
      status: json['status'] as String,
      onboardingStep: (json['onboardingStep'] as num).toInt(),
      onboardingSteps: (json['onboardingSteps'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      onboardingComplete: json['onboardingComplete'] as bool,
      mustChangePassword: json['mustChangePassword'] as bool,
    );

Map<String, dynamic> _$AccountSummaryToJson(_AccountSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': instance.kind,
      'status': instance.status,
      'onboardingStep': instance.onboardingStep,
      'onboardingSteps': instance.onboardingSteps,
      'onboardingComplete': instance.onboardingComplete,
      'mustChangePassword': instance.mustChangePassword,
    };

_InstitutionIdentity _$InstitutionIdentityFromJson(Map<String, dynamic> json) =>
    _InstitutionIdentity(
      collegeId: json['collegeId'] as String,
      name: json['name'] as String,
      paused: json['paused'] as bool,
      logoUrl: json['logoUrl'] as String?,
      accentColor: json['accentColor'] as String?,
      pausedMessage: json['pausedMessage'] as String?,
    );

Map<String, dynamic> _$InstitutionIdentityToJson(
  _InstitutionIdentity instance,
) => <String, dynamic>{
  'collegeId': instance.collegeId,
  'name': instance.name,
  'paused': instance.paused,
  'logoUrl': instance.logoUrl,
  'accentColor': instance.accentColor,
  'pausedMessage': instance.pausedMessage,
};

_AppConfigData _$AppConfigDataFromJson(
  Map<String, dynamic> json,
) => _AppConfigData(
  name: json['name'] as String,
  code: json['code'] as String,
  quietHoursDefault: Map<String, String>.from(json['quietHoursDefault'] as Map),
  timezone: json['timezone'] as String,
  onboardingSteps: (json['onboardingSteps'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  logoUrl: json['logoUrl'] as String?,
  accentColor: json['accentColor'] as String?,
  supportContact: json['supportContact'] == null
      ? null
      : SupportContact.fromJson(json['supportContact'] as Map<String, dynamic>),
);

Map<String, dynamic> _$AppConfigDataToJson(_AppConfigData instance) =>
    <String, dynamic>{
      'name': instance.name,
      'code': instance.code,
      'quietHoursDefault': instance.quietHoursDefault,
      'timezone': instance.timezone,
      'onboardingSteps': instance.onboardingSteps,
      'logoUrl': instance.logoUrl,
      'accentColor': instance.accentColor,
      'supportContact': instance.supportContact,
    };
