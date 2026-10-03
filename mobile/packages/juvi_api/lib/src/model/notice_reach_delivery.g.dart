// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach_delivery.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReachDelivery _$NoticeReachDeliveryFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticeReachDelivery', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'cancelled',
          'delivered',
          'failed',
          'opened',
          'scheduled',
          'sent',
          'suppressed',
        ],
      );
      final val = NoticeReachDelivery(
        cancelled: $checkedConvert('cancelled', (v) => (v as num).toInt()),
        delivered: $checkedConvert('delivered', (v) => (v as num).toInt()),
        failed: $checkedConvert('failed', (v) => (v as num).toInt()),
        opened: $checkedConvert('opened', (v) => (v as num).toInt()),
        scheduled: $checkedConvert('scheduled', (v) => (v as num).toInt()),
        sent: $checkedConvert('sent', (v) => (v as num).toInt()),
        suppressed: $checkedConvert(
          'suppressed',
          (v) =>
              NoticeReachDeliverySuppressed.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$NoticeReachDeliveryToJson(
  NoticeReachDelivery instance,
) => <String, dynamic>{
  'cancelled': instance.cancelled,
  'delivered': instance.delivered,
  'failed': instance.failed,
  'opened': instance.opened,
  'scheduled': instance.scheduled,
  'sent': instance.sent,
  'suppressed': instance.suppressed.toJson(),
};
