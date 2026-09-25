//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'read_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReadResult {
  /// Returns a new [ReadResult] instance.
  ReadResult({

    required  this.lastReadAt,
  });

  @JsonKey(
    
    name: r'lastReadAt',
    required: true,
    includeIfNull: false,
  )


  final String lastReadAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ReadResult &&
      other.lastReadAt == lastReadAt;

    @override
    int get hashCode =>
        lastReadAt.hashCode;

  factory ReadResult.fromJson(Map<String, dynamic> json) => _$ReadResultFromJson(json);

  Map<String, dynamic> toJson() => _$ReadResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

