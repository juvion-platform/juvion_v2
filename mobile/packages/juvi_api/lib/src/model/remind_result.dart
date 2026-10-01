//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/error_envelope_error_reminders.dart';
import 'package:json_annotation/json_annotation.dart';

part 'remind_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RemindResult {
  /// Returns a new [RemindResult] instance.
  RemindResult({

    required  this.reminders,
  });

  @JsonKey(
    
    name: r'reminders',
    required: true,
    includeIfNull: false,
  )


  final ErrorEnvelopeErrorReminders reminders;





    @override
    bool operator ==(Object other) => identical(this, other) || other is RemindResult &&
      other.reminders == reminders;

    @override
    int get hashCode =>
        reminders.hashCode;

  factory RemindResult.fromJson(Map<String, dynamic> json) => _$RemindResultFromJson(json);

  Map<String, dynamic> toJson() => _$RemindResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

