//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'onboarding_advance.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OnboardingAdvance {
  /// Returns a new [OnboardingAdvance] instance.
  OnboardingAdvance({

    required  this.step,
  });

          // minimum: 0
          // maximum: 10
  @JsonKey(
    
    name: r'step',
    required: true,
    includeIfNull: false,
  )


  final int step;





    @override
    bool operator ==(Object other) => identical(this, other) || other is OnboardingAdvance &&
      other.step == step;

    @override
    int get hashCode =>
        step.hashCode;

  factory OnboardingAdvance.fromJson(Map<String, dynamic> json) => _$OnboardingAdvanceFromJson(json);

  Map<String, dynamic> toJson() => _$OnboardingAdvanceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

