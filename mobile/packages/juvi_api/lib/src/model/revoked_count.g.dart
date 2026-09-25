// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'revoked_count.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RevokedCount _$RevokedCountFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RevokedCount', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['revoked']);
      final val = RevokedCount(
        revoked: $checkedConvert('revoked', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$RevokedCountToJson(RevokedCount instance) =>
    <String, dynamic>{'revoked': instance.revoked};
