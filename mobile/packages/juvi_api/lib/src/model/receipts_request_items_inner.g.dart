// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'receipts_request_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReceiptsRequestItemsInner _$ReceiptsRequestItemsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReceiptsRequestItemsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['at', 'deliveryId', 'event', 'receipt'],
  );
  final val = ReceiptsRequestItemsInner(
    at: $checkedConvert('at', (v) => DateTime.parse(v as String)),
    deliveryId: $checkedConvert('deliveryId', (v) => v as String),
    event: $checkedConvert(
      'event',
      (v) => $enumDecode(_$ReceiptsRequestItemsInnerEventEnumEnumMap, v),
    ),
    receipt: $checkedConvert('receipt', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ReceiptsRequestItemsInnerToJson(
  ReceiptsRequestItemsInner instance,
) => <String, dynamic>{
  'at': instance.at.toIso8601String(),
  'deliveryId': instance.deliveryId,
  'event': _$ReceiptsRequestItemsInnerEventEnumEnumMap[instance.event]!,
  'receipt': instance.receipt,
};

const _$ReceiptsRequestItemsInnerEventEnumEnumMap = {
  ReceiptsRequestItemsInnerEventEnum.delivered: 'delivered',
  ReceiptsRequestItemsInnerEventEnum.opened: 'opened',
};
