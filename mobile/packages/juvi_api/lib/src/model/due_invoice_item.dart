//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/due_invoice_item_next_due.dart';
import 'package:json_annotation/json_annotation.dart';

part 'due_invoice_item.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DueInvoiceItem {
  /// Returns a new [DueInvoiceItem] instance.
  DueInvoiceItem({

    required  this.nextDue,

    required  this.number,

    required  this.outstanding,

    required  this.overdue,

    required  this.type,
  });

  @JsonKey(
    
    name: r'nextDue',
    required: true,
    includeIfNull: false,
  )


  final DueInvoiceItemNextDue nextDue;



  @JsonKey(
    
    name: r'number',
    required: true,
    includeIfNull: false,
  )


  final String number;



  @JsonKey(
    
    name: r'outstanding',
    required: true,
    includeIfNull: false,
  )


  final int outstanding;



  @JsonKey(
    
    name: r'overdue',
    required: true,
    includeIfNull: false,
  )


  final bool overdue;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final String type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is DueInvoiceItem &&
      other.nextDue == nextDue &&
      other.number == number &&
      other.outstanding == outstanding &&
      other.overdue == overdue &&
      other.type == type;

    @override
    int get hashCode =>
        nextDue.hashCode +
        number.hashCode +
        outstanding.hashCode +
        overdue.hashCode +
        type.hashCode;

  factory DueInvoiceItem.fromJson(Map<String, dynamic> json) => _$DueInvoiceItemFromJson(json);

  Map<String, dynamic> toJson() => _$DueInvoiceItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

