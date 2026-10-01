// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dismiss_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DismissResult _$DismissResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DismissResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['dismissedAt']);
      final val = DismissResult(
        dismissedAt: $checkedConvert('dismissedAt', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DismissResultToJson(DismissResult instance) =>
    <String, dynamic>{'dismissedAt': instance.dismissedAt};
