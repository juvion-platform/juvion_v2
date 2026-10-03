// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'receipts_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReceiptsResult _$ReceiptsResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReceiptsResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['accepted', 'rejected']);
      final val = ReceiptsResult(
        accepted: $checkedConvert('accepted', (v) => (v as num).toInt()),
        rejected: $checkedConvert('rejected', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$ReceiptsResultToJson(ReceiptsResult instance) =>
    <String, dynamic>{
      'accepted': instance.accepted,
      'rejected': instance.rejected,
    };
