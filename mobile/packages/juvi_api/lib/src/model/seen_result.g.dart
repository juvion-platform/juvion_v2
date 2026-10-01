// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'seen_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SeenResult _$SeenResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SeenResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['seenAt']);
      final val = SeenResult(
        seenAt: $checkedConvert('seenAt', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SeenResultToJson(SeenResult instance) =>
    <String, dynamic>{'seenAt': instance.seenAt};
