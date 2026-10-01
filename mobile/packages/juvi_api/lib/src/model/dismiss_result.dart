//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'dismiss_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DismissResult {
  /// Returns a new [DismissResult] instance.
  DismissResult({

    required  this.dismissedAt,
  });

  @JsonKey(
    
    name: r'dismissedAt',
    required: true,
    includeIfNull: false,
  )


  final String dismissedAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is DismissResult &&
      other.dismissedAt == dismissedAt;

    @override
    int get hashCode =>
        dismissedAt.hashCode;

  factory DismissResult.fromJson(Map<String, dynamic> json) => _$DismissResultFromJson(json);

  Map<String, dynamic> toJson() => _$DismissResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

