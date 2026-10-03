//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'receipts_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReceiptsResult {
  /// Returns a new [ReceiptsResult] instance.
  ReceiptsResult({

    required  this.accepted,

    required  this.rejected,
  });

  @JsonKey(
    
    name: r'accepted',
    required: true,
    includeIfNull: false,
  )


  final int accepted;



  @JsonKey(
    
    name: r'rejected',
    required: true,
    includeIfNull: false,
  )


  final int rejected;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ReceiptsResult &&
      other.accepted == accepted &&
      other.rejected == rejected;

    @override
    int get hashCode =>
        accepted.hashCode +
        rejected.hashCode;

  factory ReceiptsResult.fromJson(Map<String, dynamic> json) => _$ReceiptsResultFromJson(json);

  Map<String, dynamic> toJson() => _$ReceiptsResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

