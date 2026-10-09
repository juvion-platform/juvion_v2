// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_dues.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StudentDues _$StudentDuesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StudentDues', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['available', 'invoices', 'totalOutstanding'],
      );
      final val = StudentDues(
        available: $checkedConvert('available', (v) => v as bool),
        invoices: $checkedConvert(
          'invoices',
          (v) => (v as List<dynamic>)
              .map((e) => DueInvoiceItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        lastPayment: $checkedConvert(
          'lastPayment',
          (v) => v == null
              ? null
              : DueInvoiceItemNextDue.fromJson(v as Map<String, dynamic>),
        ),
        payUrl: $checkedConvert('payUrl', (v) => v as String?),
        totalOutstanding: $checkedConvert(
          'totalOutstanding',
          (v) => (v as num).toInt(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$StudentDuesToJson(StudentDues instance) =>
    <String, dynamic>{
      'available': instance.available,
      'invoices': instance.invoices.map((e) => e.toJson()).toList(),
      'lastPayment': ?instance.lastPayment?.toJson(),
      'payUrl': ?instance.payUrl,
      'totalOutstanding': instance.totalOutstanding,
    };
