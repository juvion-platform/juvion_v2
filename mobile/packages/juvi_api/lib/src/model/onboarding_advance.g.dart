// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'onboarding_advance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OnboardingAdvance _$OnboardingAdvanceFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OnboardingAdvance', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['step']);
      final val = OnboardingAdvance(
        step: $checkedConvert('step', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$OnboardingAdvanceToJson(OnboardingAdvance instance) =>
    <String, dynamic>{'step': instance.step};
