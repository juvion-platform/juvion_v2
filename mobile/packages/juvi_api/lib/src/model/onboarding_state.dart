//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'onboarding_state.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OnboardingState {
  /// Returns a new [OnboardingState] instance.
  OnboardingState({

    required  this.onboardingComplete,

    required  this.onboardingStep,

    required  this.onboardingSteps,
  });

  @JsonKey(
    
    name: r'onboardingComplete',
    required: true,
    includeIfNull: false,
  )


  final bool onboardingComplete;



  @JsonKey(
    
    name: r'onboardingStep',
    required: true,
    includeIfNull: false,
  )


  final int onboardingStep;



  @JsonKey(
    
    name: r'onboardingSteps',
    required: true,
    includeIfNull: false,
  )


  final List<String> onboardingSteps;





    @override
    bool operator ==(Object other) => identical(this, other) || other is OnboardingState &&
      other.onboardingComplete == onboardingComplete &&
      other.onboardingStep == onboardingStep &&
      other.onboardingSteps == onboardingSteps;

    @override
    int get hashCode =>
        onboardingComplete.hashCode +
        onboardingStep.hashCode +
        onboardingSteps.hashCode;

  factory OnboardingState.fromJson(Map<String, dynamic> json) => _$OnboardingStateFromJson(json);

  Map<String, dynamic> toJson() => _$OnboardingStateToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

