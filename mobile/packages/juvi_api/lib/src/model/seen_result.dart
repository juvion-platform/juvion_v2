//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'seen_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SeenResult {
  /// Returns a new [SeenResult] instance.
  SeenResult({

    required  this.seenAt,
  });

  @JsonKey(
    
    name: r'seenAt',
    required: true,
    includeIfNull: false,
  )


  final String seenAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SeenResult &&
      other.seenAt == seenAt;

    @override
    int get hashCode =>
        seenAt.hashCode;

  factory SeenResult.fromJson(Map<String, dynamic> json) => _$SeenResultFromJson(json);

  Map<String, dynamic> toJson() => _$SeenResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

