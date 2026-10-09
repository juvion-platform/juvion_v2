// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeList _$NoticeListFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticeList', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
      final val = NoticeList(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => NoticeListItemsInner.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$NoticeListToJson(NoticeList instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
