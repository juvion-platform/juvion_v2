//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/spaces_groups_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'spaces.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Spaces {
  /// Returns a new [Spaces] instance.
  Spaces({

    required  this.asOf,

    required  this.groups,
  });

  @JsonKey(
    
    name: r'asOf',
    required: true,
    includeIfNull: false,
  )


  final String asOf;



  @JsonKey(
    
    name: r'groups',
    required: true,
    includeIfNull: false,
  )


  final List<SpacesGroupsInner> groups;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Spaces &&
      other.asOf == asOf &&
      other.groups == groups;

    @override
    int get hashCode =>
        asOf.hashCode +
        groups.hashCode;

  factory Spaces.fromJson(Map<String, dynamic> json) => _$SpacesFromJson(json);

  Map<String, dynamic> toJson() => _$SpacesToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

