//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_delivery_suppressed.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachDeliverySuppressed {
  /// Returns a new [NoticeReachDeliverySuppressed] instance.
  NoticeReachDeliverySuppressed({

    required  this.muted,

    required  this.noDevice,

    required  this.tierOff,
  });

  @JsonKey(
    
    name: r'muted',
    required: true,
    includeIfNull: false,
  )


  final int muted;



  @JsonKey(
    
    name: r'noDevice',
    required: true,
    includeIfNull: false,
  )


  final int noDevice;



  @JsonKey(
    
    name: r'tierOff',
    required: true,
    includeIfNull: false,
  )


  final int tierOff;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachDeliverySuppressed &&
      other.muted == muted &&
      other.noDevice == noDevice &&
      other.tierOff == tierOff;

    @override
    int get hashCode =>
        muted.hashCode +
        noDevice.hashCode +
        tierOff.hashCode;

  factory NoticeReachDeliverySuppressed.fromJson(Map<String, dynamic> json) => _$NoticeReachDeliverySuppressedFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachDeliverySuppressedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

