// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spaces.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Spaces _$SpacesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Spaces', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['asOf', 'groups']);
      final val = Spaces(
        asOf: $checkedConvert('asOf', (v) => v as String),
        groups: $checkedConvert(
          'groups',
          (v) => (v as List<dynamic>)
              .map((e) => SpacesGroupsInner.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SpacesToJson(Spaces instance) => <String, dynamic>{
  'asOf': instance.asOf,
  'groups': instance.groups.map((e) => e.toJson()).toList(),
};
