//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_account.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeAccount {
  /// Returns a new [MeAccount] instance.
  MeAccount({

    required  this.id,

    required  this.kind,

    required  this.mustChangePassword,

    required  this.onboardingComplete,

    required  this.onboardingStep,

    required  this.onboardingSteps,

    required  this.status,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  )


  final MeAccountKindEnum kind;



  @JsonKey(
    
    name: r'mustChangePassword',
    required: true,
    includeIfNull: false,
  )


  final bool mustChangePassword;



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



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final MeAccountStatusEnum status;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeAccount &&
      other.id == id &&
      other.kind == kind &&
      other.mustChangePassword == mustChangePassword &&
      other.onboardingComplete == onboardingComplete &&
      other.onboardingStep == onboardingStep &&
      other.onboardingSteps == onboardingSteps &&
      other.status == status;

    @override
    int get hashCode =>
        id.hashCode +
        kind.hashCode +
        mustChangePassword.hashCode +
        onboardingComplete.hashCode +
        onboardingStep.hashCode +
        onboardingSteps.hashCode +
        status.hashCode;

  factory MeAccount.fromJson(Map<String, dynamic> json) => _$MeAccountFromJson(json);

  Map<String, dynamic> toJson() => _$MeAccountToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum MeAccountKindEnum {
@JsonValue(r'student')
student(r'student'),
@JsonValue(r'faculty')
faculty(r'faculty'),
@JsonValue(r'staff')
staff(r'staff');

const MeAccountKindEnum(this.value);

final String value;

@override
String toString() => value;
}



enum MeAccountStatusEnum {
@JsonValue(r'onboarding')
onboarding(r'onboarding'),
@JsonValue(r'active')
active(r'active'),
@JsonValue(r'exiting')
exiting(r'exiting'),
@JsonValue(r'deactivated')
deactivated(r'deactivated'),
@JsonValue(r'alumni')
alumni(r'alumni');

const MeAccountStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


