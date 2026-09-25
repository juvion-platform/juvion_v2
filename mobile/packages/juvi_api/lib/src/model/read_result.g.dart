// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'read_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReadResult _$ReadResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReadResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['lastReadAt']);
      final val = ReadResult(
        lastReadAt: $checkedConvert('lastReadAt', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ReadResultToJson(ReadResult instance) =>
    <String, dynamic>{'lastReadAt': instance.lastReadAt};
