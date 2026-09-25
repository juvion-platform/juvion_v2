//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'mute_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MuteResult {
  /// Returns a new [MuteResult] instance.
  MuteResult({

    required  this.muted,
  });

  @JsonKey(
    
    name: r'muted',
    required: true,
    includeIfNull: false,
  )


  final bool muted;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MuteResult &&
      other.muted == muted;

    @override
    int get hashCode =>
        muted.hashCode;

  factory MuteResult.fromJson(Map<String, dynamic> json) => _$MuteResultFromJson(json);

  Map<String, dynamic> toJson() => _$MuteResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

