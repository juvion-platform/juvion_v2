//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'config_support_contact.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConfigSupportContact {
  /// Returns a new [ConfigSupportContact] instance.
  ConfigSupportContact({

     this.email,

    required  this.name,

     this.phone,
  });

  @JsonKey(
    
    name: r'email',
    required: false,
    includeIfNull: false,
  )


  final String? email;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'phone',
    required: false,
    includeIfNull: false,
  )


  final String? phone;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ConfigSupportContact &&
      other.email == email &&
      other.name == name &&
      other.phone == phone;

    @override
    int get hashCode =>
        email.hashCode +
        name.hashCode +
        phone.hashCode;

  factory ConfigSupportContact.fromJson(Map<String, dynamic> json) => _$ConfigSupportContactFromJson(json);

  Map<String, dynamic> toJson() => _$ConfigSupportContactToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

