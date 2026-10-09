//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/due_invoice_item_next_due.dart';
import 'package:json_annotation/json_annotation.dart';

part 'today_glance_dues.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TodayGlanceDues {
  /// Returns a new [TodayGlanceDues] instance.
  TodayGlanceDues({

    required  this.available,

     this.nextDue,

    required  this.totalOutstanding,
  });

  @JsonKey(
    
    name: r'available',
    required: true,
    includeIfNull: false,
  )


  final bool available;



  @JsonKey(
    
    name: r'nextDue',
    required: false,
    includeIfNull: false,
  )


  final DueInvoiceItemNextDue? nextDue;



  @JsonKey(
    
    name: r'totalOutstanding',
    required: true,
    includeIfNull: false,
  )


  final int totalOutstanding;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TodayGlanceDues &&
      other.available == available &&
      other.nextDue == nextDue &&
      other.totalOutstanding == totalOutstanding;

    @override
    int get hashCode =>
        available.hashCode +
        nextDue.hashCode +
        totalOutstanding.hashCode;

  factory TodayGlanceDues.fromJson(Map<String, dynamic> json) => _$TodayGlanceDuesFromJson(json);

  Map<String, dynamic> toJson() => _$TodayGlanceDuesToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

