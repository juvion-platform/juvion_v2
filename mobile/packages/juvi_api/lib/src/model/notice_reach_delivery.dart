//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/notice_reach_delivery_suppressed.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_delivery.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachDelivery {
  /// Returns a new [NoticeReachDelivery] instance.
  NoticeReachDelivery({

    required  this.cancelled,

    required  this.delivered,

    required  this.failed,

    required  this.opened,

    required  this.scheduled,

    required  this.sent,

    required  this.suppressed,
  });

  @JsonKey(
    
    name: r'cancelled',
    required: true,
    includeIfNull: false,
  )


  final int cancelled;



  @JsonKey(
    
    name: r'delivered',
    required: true,
    includeIfNull: false,
  )


  final int delivered;



  @JsonKey(
    
    name: r'failed',
    required: true,
    includeIfNull: false,
  )


  final int failed;



  @JsonKey(
    
    name: r'opened',
    required: true,
    includeIfNull: false,
  )


  final int opened;



  @JsonKey(
    
    name: r'scheduled',
    required: true,
    includeIfNull: false,
  )


  final int scheduled;



  @JsonKey(
    
    name: r'sent',
    required: true,
    includeIfNull: false,
  )


  final int sent;



  @JsonKey(
    
    name: r'suppressed',
    required: true,
    includeIfNull: false,
  )


  final NoticeReachDeliverySuppressed suppressed;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachDelivery &&
      other.cancelled == cancelled &&
      other.delivered == delivered &&
      other.failed == failed &&
      other.opened == opened &&
      other.scheduled == scheduled &&
      other.sent == sent &&
      other.suppressed == suppressed;

    @override
    int get hashCode =>
        cancelled.hashCode +
        delivered.hashCode +
        failed.hashCode +
        opened.hashCode +
        scheduled.hashCode +
        sent.hashCode +
        suppressed.hashCode;

  factory NoticeReachDelivery.fromJson(Map<String, dynamic> json) => _$NoticeReachDeliveryFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachDeliveryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

