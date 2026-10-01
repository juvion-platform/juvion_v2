// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach_added_later.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReachAddedLater _$NoticeReachAddedLaterFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticeReachAddedLater', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['acknowledged', 'items', 'seen', 'total'],
  );
  final val = NoticeReachAddedLater(
    acknowledged: $checkedConvert('acknowledged', (v) => (v as num).toInt()),
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => NoticeReachAddedLaterItemsInner.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    seen: $checkedConvert('seen', (v) => (v as num).toInt()),
    total: $checkedConvert('total', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$NoticeReachAddedLaterToJson(
  NoticeReachAddedLater instance,
) => <String, dynamic>{
  'acknowledged': instance.acknowledged,
  'items': instance.items.map((e) => e.toJson()).toList(),
  'seen': instance.seen,
  'total': instance.total,
};
