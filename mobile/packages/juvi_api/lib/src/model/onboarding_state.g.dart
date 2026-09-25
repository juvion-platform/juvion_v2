// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'onboarding_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OnboardingState _$OnboardingStateFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OnboardingState', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'onboardingComplete',
          'onboardingStep',
          'onboardingSteps',
        ],
      );
      final val = OnboardingState(
        onboardingComplete: $checkedConvert(
          'onboardingComplete',
          (v) => v as bool,
        ),
        onboardingStep: $checkedConvert(
          'onboardingStep',
          (v) => (v as num).toInt(),
        ),
        onboardingSteps: $checkedConvert(
          'onboardingSteps',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$OnboardingStateToJson(OnboardingState instance) =>
    <String, dynamic>{
      'onboardingComplete': instance.onboardingComplete,
      'onboardingStep': instance.onboardingStep,
      'onboardingSteps': instance.onboardingSteps,
    };
