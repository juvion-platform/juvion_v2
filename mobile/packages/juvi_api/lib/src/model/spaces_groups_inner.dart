//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/spaces_groups_inner_channels_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'spaces_groups_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SpacesGroupsInner {
  /// Returns a new [SpacesGroupsInner] instance.
  SpacesGroupsInner({

    required  this.channels,

     this.emptyHint,

    required  this.key,

    required  this.title,
  });

  @JsonKey(
    
    name: r'channels',
    required: true,
    includeIfNull: false,
  )


  final List<SpacesGroupsInnerChannelsInner> channels;



  @JsonKey(
    
    name: r'emptyHint',
    required: false,
    includeIfNull: false,
  )


  final String? emptyHint;



  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  )


  final SpacesGroupsInnerKeyEnum key;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SpacesGroupsInner &&
      other.channels == channels &&
      other.emptyHint == emptyHint &&
      other.key == key &&
      other.title == title;

    @override
    int get hashCode =>
        channels.hashCode +
        emptyHint.hashCode +
        key.hashCode +
        title.hashCode;

  factory SpacesGroupsInner.fromJson(Map<String, dynamic> json) => _$SpacesGroupsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$SpacesGroupsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SpacesGroupsInnerKeyEnum {
@JsonValue(r'college')
college(r'college'),
@JsonValue(r'department')
department(r'department'),
@JsonValue(r'batch')
batch(r'batch'),
@JsonValue(r'courses')
courses(r'courses'),
@JsonValue(r'hostel')
hostel(r'hostel'),
@JsonValue(r'archived')
archived(r'archived');

const SpacesGroupsInnerKeyEnum(this.value);

final String value;

@override
String toString() => value;
}


