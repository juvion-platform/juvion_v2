//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/receipts_request_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'receipts_request.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReceiptsRequest {
  /// Returns a new [ReceiptsRequest] instance.
  ReceiptsRequest({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<ReceiptsRequestItemsInner> items;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ReceiptsRequest &&
      other.items == items;

    @override
    int get hashCode =>
        items.hashCode;

  factory ReceiptsRequest.fromJson(Map<String, dynamic> json) => _$ReceiptsRequestFromJson(json);

  Map<String, dynamic> toJson() => _$ReceiptsRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

