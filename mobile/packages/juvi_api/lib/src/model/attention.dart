//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/attention_item.dart';
import 'package:json_annotation/json_annotation.dart';

part 'attention.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Attention {
  /// Returns a new [Attention] instance.
  Attention({

    required  this.dueCount,

    required  this.items,
  });

  @JsonKey(
    
    name: r'dueCount',
    required: true,
    includeIfNull: false,
  )


  final int dueCount;



  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<AttentionItem> items;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Attention &&
      other.dueCount == dueCount &&
      other.items == items;

    @override
    int get hashCode =>
        dueCount.hashCode +
        items.hashCode;

  factory Attention.fromJson(Map<String, dynamic> json) => _$AttentionFromJson(json);

  Map<String, dynamic> toJson() => _$AttentionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

