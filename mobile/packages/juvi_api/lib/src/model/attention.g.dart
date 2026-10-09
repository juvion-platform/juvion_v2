// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attention.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Attention _$AttentionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Attention', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['dueCount', 'items']);
      final val = Attention(
        dueCount: $checkedConvert('dueCount', (v) => (v as num).toInt()),
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => AttentionItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AttentionToJson(Attention instance) => <String, dynamic>{
  'dueCount': instance.dueCount,
  'items': instance.items.map((e) => e.toJson()).toList(),
};
