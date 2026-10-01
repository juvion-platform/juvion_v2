//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_detail_attachments_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeDetailAttachmentsInner {
  /// Returns a new [NoticeDetailAttachmentsInner] instance.
  NoticeDetailAttachmentsInner({

    required  this.key,

    required  this.mime,

    required  this.name,

    required  this.size,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  )


  final String key;



  @JsonKey(
    
    name: r'mime',
    required: true,
    includeIfNull: false,
  )


  final String mime;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'size',
    required: true,
    includeIfNull: false,
  )


  final int size;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeDetailAttachmentsInner &&
      other.key == key &&
      other.mime == mime &&
      other.name == name &&
      other.size == size;

    @override
    int get hashCode =>
        key.hashCode +
        mime.hashCode +
        name.hashCode +
        size.hashCode;

  factory NoticeDetailAttachmentsInner.fromJson(Map<String, dynamic> json) => _$NoticeDetailAttachmentsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeDetailAttachmentsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

