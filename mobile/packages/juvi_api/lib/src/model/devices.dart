//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/devices_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'devices.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Devices {
  /// Returns a new [Devices] instance.
  Devices({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<DevicesItemsInner> items;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Devices &&
      other.items == items;

    @override
    int get hashCode =>
        items.hashCode;

  factory Devices.fromJson(Map<String, dynamic> json) => _$DevicesFromJson(json);

  Map<String, dynamic> toJson() => _$DevicesToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

