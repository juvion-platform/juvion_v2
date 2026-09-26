//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'revoked_count.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RevokedCount {
  /// Returns a new [RevokedCount] instance.
  RevokedCount({

    required  this.revoked,
  });

  @JsonKey(
    
    name: r'revoked',
    required: true,
    includeIfNull: false,
  )


  final int revoked;





    @override
    bool operator ==(Object other) => identical(this, other) || other is RevokedCount &&
      other.revoked == revoked;

    @override
    int get hashCode =>
        revoked.hashCode;

  factory RevokedCount.fromJson(Map<String, dynamic> json) => _$RevokedCountFromJson(json);

  Map<String, dynamic> toJson() => _$RevokedCountToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

