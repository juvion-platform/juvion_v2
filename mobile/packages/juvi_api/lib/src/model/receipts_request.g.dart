// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'receipts_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReceiptsRequest _$ReceiptsRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReceiptsRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items']);
      final val = ReceiptsRequest(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => ReceiptsRequestItemsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ReceiptsRequestToJson(ReceiptsRequest instance) =>
    <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
