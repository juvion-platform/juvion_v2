//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_attachment_url.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeAttachmentUrl {
  /// Returns a new [NoticeAttachmentUrl] instance.
  NoticeAttachmentUrl({

    required  this.expiresAt,

    required  this.url,
  });

  @JsonKey(
    
    name: r'expiresAt',
    required: true,
    includeIfNull: false,
  )


  final String expiresAt;



  @JsonKey(
    
    name: r'url',
    required: true,
    includeIfNull: false,
  )


  final String url;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeAttachmentUrl &&
      other.expiresAt == expiresAt &&
      other.url == url;

    @override
    int get hashCode =>
        expiresAt.hashCode +
        url.hashCode;

  factory NoticeAttachmentUrl.fromJson(Map<String, dynamic> json) => _$NoticeAttachmentUrlFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeAttachmentUrlToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

