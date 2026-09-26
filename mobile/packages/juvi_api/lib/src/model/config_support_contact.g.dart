// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_support_contact.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConfigSupportContact _$ConfigSupportContactFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ConfigSupportContact', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['name']);
  final val = ConfigSupportContact(
    email: $checkedConvert('email', (v) => v as String?),
    name: $checkedConvert('name', (v) => v as String),
    phone: $checkedConvert('phone', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$ConfigSupportContactToJson(
  ConfigSupportContact instance,
) => <String, dynamic>{
  'email': ?instance.email,
  'name': instance.name,
  'phone': ?instance.phone,
};
