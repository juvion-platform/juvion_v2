//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'reach_person.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReachPerson {
  /// Returns a new [ReachPerson] instance.
  ReachPerson({

    required  this.at,

    required  this.group,

    required  this.identifier,

    required  this.name,
  });

  @JsonKey(
    
    name: r'at',
    required: true,
    includeIfNull: true,
  )


  final String? at;



  @JsonKey(
    
    name: r'group',
    required: true,
    includeIfNull: false,
  )


  final String group;



  @JsonKey(
    
    name: r'identifier',
    required: true,
    includeIfNull: true,
  )


  final String? identifier;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ReachPerson &&
      other.at == at &&
      other.group == group &&
      other.identifier == identifier &&
      other.name == name;

    @override
    int get hashCode =>
        (at == null ? 0 : at.hashCode) +
        group.hashCode +
        (identifier == null ? 0 : identifier.hashCode) +
        name.hashCode;

  factory ReachPerson.fromJson(Map<String, dynamic> json) => _$ReachPersonFromJson(json);

  Map<String, dynamic> toJson() => _$ReachPersonToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

