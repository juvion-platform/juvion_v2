// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_account.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeAccount _$MeAccountFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('MeAccount', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'kind',
      'mustChangePassword',
      'onboardingComplete',
      'onboardingStep',
      'onboardingSteps',
      'status',
    ],
  );
  final val = MeAccount(
    id: $checkedConvert('id', (v) => v as String),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(_$MeAccountKindEnumEnumMap, v),
    ),
    mustChangePassword: $checkedConvert('mustChangePassword', (v) => v as bool),
    onboardingComplete: $checkedConvert('onboardingComplete', (v) => v as bool),
    onboardingStep: $checkedConvert(
      'onboardingStep',
      (v) => (v as num).toInt(),
    ),
    onboardingSteps: $checkedConvert(
      'onboardingSteps',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(_$MeAccountStatusEnumEnumMap, v),
    ),
  );
  return val;
});

Map<String, dynamic> _$MeAccountToJson(MeAccount instance) => <String, dynamic>{
  'id': instance.id,
  'kind': _$MeAccountKindEnumEnumMap[instance.kind]!,
  'mustChangePassword': instance.mustChangePassword,
  'onboardingComplete': instance.onboardingComplete,
  'onboardingStep': instance.onboardingStep,
  'onboardingSteps': instance.onboardingSteps,
  'status': _$MeAccountStatusEnumEnumMap[instance.status]!,
};

const _$MeAccountKindEnumEnumMap = {
  MeAccountKindEnum.student: 'student',
  MeAccountKindEnum.faculty: 'faculty',
  MeAccountKindEnum.staff: 'staff',
};

const _$MeAccountStatusEnumEnumMap = {
  MeAccountStatusEnum.onboarding: 'onboarding',
  MeAccountStatusEnum.active: 'active',
  MeAccountStatusEnum.exiting: 'exiting',
  MeAccountStatusEnum.deactivated: 'deactivated',
  MeAccountStatusEnum.alumni: 'alumni',
};
