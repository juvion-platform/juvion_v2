// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mute_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MuteResult _$MuteResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MuteResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['muted']);
      final val = MuteResult(muted: $checkedConvert('muted', (v) => v as bool));
      return val;
    });

Map<String, dynamic> _$MuteResultToJson(MuteResult instance) =>
    <String, dynamic>{'muted': instance.muted};
