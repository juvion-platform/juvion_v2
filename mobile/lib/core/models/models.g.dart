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
      'supportContact': instance.supportContact?.toJson(),
    };

_PersonCard _$PersonCardFromJson(Map<String, dynamic> json) => _PersonCard(
  name: json['name'] as String,
  firstName: json['firstName'] as String,
  photoUrl: json['photoUrl'] as String?,
);

Map<String, dynamic> _$PersonCardToJson(_PersonCard instance) =>
    <String, dynamic>{
      'name': instance.name,
      'firstName': instance.firstName,
      'photoUrl': instance.photoUrl,
    };

_StudentCard _$StudentCardFromJson(Map<String, dynamic> json) => _StudentCard(
  isLateralEntry: json['isLateralEntry'] as bool,
  rollNumber: json['rollNumber'] as String?,
  programme: json['programme'] as String?,
  branch: json['branch'] as String?,
  batch: json['batch'] as String?,
  section: json['section'] as String?,
  department: json['department'] as String?,
  hostel: json['hostel'] as String?,
);

Map<String, dynamic> _$StudentCardToJson(_StudentCard instance) =>
    <String, dynamic>{
      'isLateralEntry': instance.isLateralEntry,
      'rollNumber': instance.rollNumber,
      'programme': instance.programme,
      'branch': instance.branch,
      'batch': instance.batch,
      'section': instance.section,
      'department': instance.department,
      'hostel': instance.hostel,
    };

_FacultyCard _$FacultyCardFromJson(Map<String, dynamic> json) => _FacultyCard(
  employeeCode: json['employeeCode'] as String,
  designation: json['designation'] as String,
  isHod: json['isHod'] as bool,
  department: json['department'] as String?,
);

Map<String, dynamic> _$FacultyCardToJson(_FacultyCard instance) =>
    <String, dynamic>{
      'employeeCode': instance.employeeCode,
      'designation': instance.designation,
      'isHod': instance.isHod,
      'department': instance.department,
    };

_QuietHours _$QuietHoursFromJson(Map<String, dynamic> json) =>
    _QuietHours(start: json['start'] as String, end: json['end'] as String);

Map<String, dynamic> _$QuietHoursToJson(_QuietHours instance) =>
    <String, dynamic>{'start': instance.start, 'end': instance.end};

_Tiers _$TiersFromJson(Map<String, dynamic> json) => _Tiers(
  important: json['important'] as bool,
  routine: json['routine'] as bool,
);

Map<String, dynamic> _$TiersToJson(_Tiers instance) => <String, dynamic>{
  'important': instance.important,
  'routine': instance.routine,
};

_Settings _$SettingsFromJson(Map<String, dynamic> json) => _Settings(
  quietHours: QuietHours.fromJson(json['quietHours'] as Map<String, dynamic>),
  tiers: Tiers.fromJson(json['tiers'] as Map<String, dynamic>),
  language: json['language'] as String,
);

Map<String, dynamic> _$SettingsToJson(_Settings instance) => <String, dynamic>{
  'quietHours': instance.quietHours.toJson(),
  'tiers': instance.tiers.toJson(),
  'language': instance.language,
};

_InstitutionInfo _$InstitutionInfoFromJson(Map<String, dynamic> json) =>
    _InstitutionInfo(
      name: json['name'] as String,
      code: json['code'] as String,
      timezone: json['timezone'] as String,
      logoUrl: json['logoUrl'] as String?,
      accentColor: json['accentColor'] as String?,
      supportContact: json['supportContact'] == null
          ? null
          : SupportContact.fromJson(
              json['supportContact'] as Map<String, dynamic>,
            ),
    );

Map<String, dynamic> _$InstitutionInfoToJson(_InstitutionInfo instance) =>
    <String, dynamic>{
      'name': instance.name,
      'code': instance.code,
      'timezone': instance.timezone,
      'logoUrl': instance.logoUrl,
      'accentColor': instance.accentColor,
      'supportContact': instance.supportContact?.toJson(),
    };

_Me _$MeFromJson(Map<String, dynamic> json) => _Me(
  account: AccountSummary.fromJson(json['account'] as Map<String, dynamic>),
  person: PersonCard.fromJson(json['person'] as Map<String, dynamic>),
  settings: Settings.fromJson(json['settings'] as Map<String, dynamic>),
  institution: InstitutionInfo.fromJson(
    json['institution'] as Map<String, dynamic>,
  ),
  asOf: json['asOf'] as String,
  student: json['student'] == null
      ? null
      : StudentCard.fromJson(json['student'] as Map<String, dynamic>),
  faculty: json['faculty'] == null
      ? null
      : FacultyCard.fromJson(json['faculty'] as Map<String, dynamic>),
);

Map<String, dynamic> _$MeToJson(_Me instance) => <String, dynamic>{
  'account': instance.account.toJson(),
  'person': instance.person.toJson(),
  'settings': instance.settings.toJson(),
  'institution': instance.institution.toJson(),
  'asOf': instance.asOf,
  'student': instance.student?.toJson(),
  'faculty': instance.faculty?.toJson(),
};

_OnboardingStateData _$OnboardingStateDataFromJson(Map<String, dynamic> json) =>
    _OnboardingStateData(
      onboardingStep: (json['onboardingStep'] as num).toInt(),
      onboardingSteps: (json['onboardingSteps'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      onboardingComplete: json['onboardingComplete'] as bool,
    );

Map<String, dynamic> _$OnboardingStateDataToJson(
  _OnboardingStateData instance,
) => <String, dynamic>{
  'onboardingStep': instance.onboardingStep,
  'onboardingSteps': instance.onboardingSteps,
  'onboardingComplete': instance.onboardingComplete,
};

_DeviceRow _$DeviceRowFromJson(Map<String, dynamic> json) => _DeviceRow(
  sessionId: json['sessionId'] as String,
  deviceName: json['deviceName'] as String,
  platform: json['platform'] as String,
  appVersion: json['appVersion'] as String,
  lastActiveAt: json['lastActiveAt'] as String,
  isCurrent: json['isCurrent'] as bool,
);

Map<String, dynamic> _$DeviceRowToJson(_DeviceRow instance) =>
    <String, dynamic>{
      'sessionId': instance.sessionId,
      'deviceName': instance.deviceName,
      'platform': instance.platform,
      'appVersion': instance.appVersion,
      'lastActiveAt': instance.lastActiveAt,
      'isCurrent': instance.isCurrent,
    };
