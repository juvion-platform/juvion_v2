//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'receipts_request_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReceiptsRequestItemsInner {
  /// Returns a new [ReceiptsRequestItemsInner] instance.
  ReceiptsRequestItemsInner({

    required  this.at,

    required  this.deliveryId,

    required  this.event,

    required  this.receipt,
  });

  @JsonKey(
    
    name: r'at',
    required: true,
    includeIfNull: false,
  )


  final DateTime at;



  @JsonKey(
    
    name: r'deliveryId',
    required: true,
    includeIfNull: false,
  )


  final String deliveryId;



  @JsonKey(
    
    name: r'event',
    required: true,
    includeIfNull: false,
  )


  final ReceiptsRequestItemsInnerEventEnum event;



  @JsonKey(
    
    name: r'receipt',
    required: true,
    includeIfNull: false,
  )


  final String receipt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ReceiptsRequestItemsInner &&
      other.at == at &&
      other.deliveryId == deliveryId &&
      other.event == event &&
      other.receipt == receipt;

    @override
    int get hashCode =>
        at.hashCode +
        deliveryId.hashCode +
        event.hashCode +
        receipt.hashCode;

  factory ReceiptsRequestItemsInner.fromJson(Map<String, dynamic> json) => _$ReceiptsRequestItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ReceiptsRequestItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum ReceiptsRequestItemsInnerEventEnum {
@JsonValue(r'delivered')
delivered(r'delivered'),
@JsonValue(r'opened')
opened(r'opened');

const ReceiptsRequestItemsInnerEventEnum(this.value);

final String value;

@override
String toString() => value;
}


