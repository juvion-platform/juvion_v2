//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'channel_detail_linked_object.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChannelDetailLinkedObject {
  /// Returns a new [ChannelDetailLinkedObject] instance.
  ChannelDetailLinkedObject({

    required  this.id,

    required  this.type,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: true,
  )


  final String? id;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final String type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ChannelDetailLinkedObject &&
      other.id == id &&
      other.type == type;

    @override
    int get hashCode =>
        (id == null ? 0 : id.hashCode) +
        type.hashCode;

  factory ChannelDetailLinkedObject.fromJson(Map<String, dynamic> json) => _$ChannelDetailLinkedObjectFromJson(json);

  Map<String, dynamic> toJson() => _$ChannelDetailLinkedObjectToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

