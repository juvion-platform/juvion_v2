// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notices.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$NoticeItem {

 String get id; String get title; String get preview; String get office; String get audienceLine; String get priority; String get purpose; bool get ackRequired; bool get ackCommentAllowed; bool get archived; int get attachmentCount; String get state;@JsonKey(name: 'late') bool get isLate; bool get isPublisher; DateTime? get deadline; DateTime? get publishedAt; DateTime? get seenAt; DateTime? get ackAt; DateTime? get remindedAt;
/// Create a copy of NoticeItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NoticeItemCopyWith<NoticeItem> get copyWith => _$NoticeItemCopyWithImpl<NoticeItem>(this as NoticeItem, _$identity);

  /// Serializes this NoticeItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NoticeItem&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.preview, preview) || other.preview == preview)&&(identical(other.office, office) || other.office == office)&&(identical(other.audienceLine, audienceLine) || other.audienceLine == audienceLine)&&(identical(other.priority, priority) || other.priority == priority)&&(identical(other.purpose, purpose) || other.purpose == purpose)&&(identical(other.ackRequired, ackRequired) || other.ackRequired == ackRequired)&&(identical(other.ackCommentAllowed, ackCommentAllowed) || other.ackCommentAllowed == ackCommentAllowed)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.attachmentCount, attachmentCount) || other.attachmentCount == attachmentCount)&&(identical(other.state, state) || other.state == state)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.isPublisher, isPublisher) || other.isPublisher == isPublisher)&&(identical(other.deadline, deadline) || other.deadline == deadline)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.seenAt, seenAt) || other.seenAt == seenAt)&&(identical(other.ackAt, ackAt) || other.ackAt == ackAt)&&(identical(other.remindedAt, remindedAt) || other.remindedAt == remindedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,title,preview,office,audienceLine,priority,purpose,ackRequired,ackCommentAllowed,archived,attachmentCount,state,isLate,isPublisher,deadline,publishedAt,seenAt,ackAt,remindedAt]);

@override
String toString() {
  return 'NoticeItem(id: $id, title: $title, preview: $preview, office: $office, audienceLine: $audienceLine, priority: $priority, purpose: $purpose, ackRequired: $ackRequired, ackCommentAllowed: $ackCommentAllowed, archived: $archived, attachmentCount: $attachmentCount, state: $state, isLate: $isLate, isPublisher: $isPublisher, deadline: $deadline, publishedAt: $publishedAt, seenAt: $seenAt, ackAt: $ackAt, remindedAt: $remindedAt)';
}


}

/// @nodoc
abstract mixin class $NoticeItemCopyWith<$Res>  {
  factory $NoticeItemCopyWith(NoticeItem value, $Res Function(NoticeItem) _then) = _$NoticeItemCopyWithImpl;
@useResult
$Res call({
 String id, String title, String preview, String office, String audienceLine, String priority, String purpose, bool ackRequired, bool ackCommentAllowed, bool archived, int attachmentCount, String state,@JsonKey(name: 'late') bool isLate, bool isPublisher, DateTime? deadline, DateTime? publishedAt, DateTime? seenAt, DateTime? ackAt, DateTime? remindedAt
});




}
/// @nodoc
class _$NoticeItemCopyWithImpl<$Res>
    implements $NoticeItemCopyWith<$Res> {
  _$NoticeItemCopyWithImpl(this._self, this._then);

  final NoticeItem _self;
  final $Res Function(NoticeItem) _then;

/// Create a copy of NoticeItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? preview = null,Object? office = null,Object? audienceLine = null,Object? priority = null,Object? purpose = null,Object? ackRequired = null,Object? ackCommentAllowed = null,Object? archived = null,Object? attachmentCount = null,Object? state = null,Object? isLate = null,Object? isPublisher = null,Object? deadline = freezed,Object? publishedAt = freezed,Object? seenAt = freezed,Object? ackAt = freezed,Object? remindedAt = freezed,}) {
  return _then(NoticeItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,preview: null == preview ? _self.preview : preview // ignore: cast_nullable_to_non_nullable
as String,office: null == office ? _self.office : office // ignore: cast_nullable_to_non_nullable
as String,audienceLine: null == audienceLine ? _self.audienceLine : audienceLine // ignore: cast_nullable_to_non_nullable
as String,priority: null == priority ? _self.priority : priority // ignore: cast_nullable_to_non_nullable
as String,purpose: null == purpose ? _self.purpose : purpose // ignore: cast_nullable_to_non_nullable
as String,ackRequired: null == ackRequired ? _self.ackRequired : ackRequired // ignore: cast_nullable_to_non_nullable
as bool,ackCommentAllowed: null == ackCommentAllowed ? _self.ackCommentAllowed : ackCommentAllowed // ignore: cast_nullable_to_non_nullable
as bool,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,attachmentCount: null == attachmentCount ? _self.attachmentCount : attachmentCount // ignore: cast_nullable_to_non_nullable
as int,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,isPublisher: null == isPublisher ? _self.isPublisher : isPublisher // ignore: cast_nullable_to_non_nullable
as bool,deadline: freezed == deadline ? _self.deadline : deadline // ignore: cast_nullable_to_non_nullable
as DateTime?,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,seenAt: freezed == seenAt ? _self.seenAt : seenAt // ignore: cast_nullable_to_non_nullable
as DateTime?,ackAt: freezed == ackAt ? _self.ackAt : ackAt // ignore: cast_nullable_to_non_nullable
as DateTime?,remindedAt: freezed == remindedAt ? _self.remindedAt : remindedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [NoticeItem].
extension NoticeItemPatterns on NoticeItem {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NoticeItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NoticeItem() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NoticeItem value)  $default,){
final _that = this;
switch (_that) {
case _NoticeItem():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NoticeItem value)?  $default,){
final _that = this;
switch (_that) {
case _NoticeItem() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String preview,  String office,  String audienceLine,  String priority,  String purpose,  bool ackRequired,  bool ackCommentAllowed,  bool archived,  int attachmentCount,  String state, @JsonKey(name: 'late')  bool isLate,  bool isPublisher,  DateTime? deadline,  DateTime? publishedAt,  DateTime? seenAt,  DateTime? ackAt,  DateTime? remindedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NoticeItem() when $default != null:
return $default(_that.id,_that.title,_that.preview,_that.office,_that.audienceLine,_that.priority,_that.purpose,_that.ackRequired,_that.ackCommentAllowed,_that.archived,_that.attachmentCount,_that.state,_that.isLate,_that.isPublisher,_that.deadline,_that.publishedAt,_that.seenAt,_that.ackAt,_that.remindedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String preview,  String office,  String audienceLine,  String priority,  String purpose,  bool ackRequired,  bool ackCommentAllowed,  bool archived,  int attachmentCount,  String state, @JsonKey(name: 'late')  bool isLate,  bool isPublisher,  DateTime? deadline,  DateTime? publishedAt,  DateTime? seenAt,  DateTime? ackAt,  DateTime? remindedAt)  $default,) {final _that = this;
switch (_that) {
case _NoticeItem():
return $default(_that.id,_that.title,_that.preview,_that.office,_that.audienceLine,_that.priority,_that.purpose,_that.ackRequired,_that.ackCommentAllowed,_that.archived,_that.attachmentCount,_that.state,_that.isLate,_that.isPublisher,_that.deadline,_that.publishedAt,_that.seenAt,_that.ackAt,_that.remindedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String preview,  String office,  String audienceLine,  String priority,  String purpose,  bool ackRequired,  bool ackCommentAllowed,  bool archived,  int attachmentCount,  String state, @JsonKey(name: 'late')  bool isLate,  bool isPublisher,  DateTime? deadline,  DateTime? publishedAt,  DateTime? seenAt,  DateTime? ackAt,  DateTime? remindedAt)?  $default,) {final _that = this;
switch (_that) {
case _NoticeItem() when $default != null:
return $default(_that.id,_that.title,_that.preview,_that.office,_that.audienceLine,_that.priority,_that.purpose,_that.ackRequired,_that.ackCommentAllowed,_that.archived,_that.attachmentCount,_that.state,_that.isLate,_that.isPublisher,_that.deadline,_that.publishedAt,_that.seenAt,_that.ackAt,_that.remindedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NoticeItem extends NoticeItem {
  const _NoticeItem({required this.id, required this.title, required this.preview, required this.office, required this.audienceLine, required this.priority, required this.purpose, required this.ackRequired, required this.ackCommentAllowed, required this.archived, required this.attachmentCount, required this.state, @JsonKey(name: 'late') required this.isLate, required this.isPublisher, this.deadline, this.publishedAt, this.seenAt, this.ackAt, this.remindedAt}): super._();
  factory _NoticeItem.fromJson(Map<String, dynamic> json) => _$NoticeItemFromJson(json);

@override final  String id;
@override final  String title;
@override final  String preview;
@override final  String office;
@override final  String audienceLine;
@override final  String priority;
@override final  String purpose;
@override final  bool ackRequired;
@override final  bool ackCommentAllowed;
@override final  bool archived;
@override final  int attachmentCount;
@override final  String state;
@override@JsonKey(name: 'late') final  bool isLate;
@override final  bool isPublisher;
@override final  DateTime? deadline;
@override final  DateTime? publishedAt;
@override final  DateTime? seenAt;
@override final  DateTime? ackAt;
@override final  DateTime? remindedAt;

/// Create a copy of NoticeItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NoticeItemCopyWith<_NoticeItem> get copyWith => __$NoticeItemCopyWithImpl<_NoticeItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NoticeItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NoticeItem&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.preview, preview) || other.preview == preview)&&(identical(other.office, office) || other.office == office)&&(identical(other.audienceLine, audienceLine) || other.audienceLine == audienceLine)&&(identical(other.priority, priority) || other.priority == priority)&&(identical(other.purpose, purpose) || other.purpose == purpose)&&(identical(other.ackRequired, ackRequired) || other.ackRequired == ackRequired)&&(identical(other.ackCommentAllowed, ackCommentAllowed) || other.ackCommentAllowed == ackCommentAllowed)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.attachmentCount, attachmentCount) || other.attachmentCount == attachmentCount)&&(identical(other.state, state) || other.state == state)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.isPublisher, isPublisher) || other.isPublisher == isPublisher)&&(identical(other.deadline, deadline) || other.deadline == deadline)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.seenAt, seenAt) || other.seenAt == seenAt)&&(identical(other.ackAt, ackAt) || other.ackAt == ackAt)&&(identical(other.remindedAt, remindedAt) || other.remindedAt == remindedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,title,preview,office,audienceLine,priority,purpose,ackRequired,ackCommentAllowed,archived,attachmentCount,state,isLate,isPublisher,deadline,publishedAt,seenAt,ackAt,remindedAt]);

@override
String toString() {
  return 'NoticeItem(id: $id, title: $title, preview: $preview, office: $office, audienceLine: $audienceLine, priority: $priority, purpose: $purpose, ackRequired: $ackRequired, ackCommentAllowed: $ackCommentAllowed, archived: $archived, attachmentCount: $attachmentCount, state: $state, isLate: $isLate, isPublisher: $isPublisher, deadline: $deadline, publishedAt: $publishedAt, seenAt: $seenAt, ackAt: $ackAt, remindedAt: $remindedAt)';
}


}

/// @nodoc
abstract mixin class _$NoticeItemCopyWith<$Res> implements $NoticeItemCopyWith<$Res> {
  factory _$NoticeItemCopyWith(_NoticeItem value, $Res Function(_NoticeItem) _then) = __$NoticeItemCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String preview, String office, String audienceLine, String priority, String purpose, bool ackRequired, bool ackCommentAllowed, bool archived, int attachmentCount, String state,@JsonKey(name: 'late') bool isLate, bool isPublisher, DateTime? deadline, DateTime? publishedAt, DateTime? seenAt, DateTime? ackAt, DateTime? remindedAt
});




}
/// @nodoc
class __$NoticeItemCopyWithImpl<$Res>
    implements _$NoticeItemCopyWith<$Res> {
  __$NoticeItemCopyWithImpl(this._self, this._then);

  final _NoticeItem _self;
  final $Res Function(_NoticeItem) _then;

/// Create a copy of NoticeItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? preview = null,Object? office = null,Object? audienceLine = null,Object? priority = null,Object? purpose = null,Object? ackRequired = null,Object? ackCommentAllowed = null,Object? archived = null,Object? attachmentCount = null,Object? state = null,Object? isLate = null,Object? isPublisher = null,Object? deadline = freezed,Object? publishedAt = freezed,Object? seenAt = freezed,Object? ackAt = freezed,Object? remindedAt = freezed,}) {
  return _then(_NoticeItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,preview: null == preview ? _self.preview : preview // ignore: cast_nullable_to_non_nullable
as String,office: null == office ? _self.office : office // ignore: cast_nullable_to_non_nullable
as String,audienceLine: null == audienceLine ? _self.audienceLine : audienceLine // ignore: cast_nullable_to_non_nullable
as String,priority: null == priority ? _self.priority : priority // ignore: cast_nullable_to_non_nullable
as String,purpose: null == purpose ? _self.purpose : purpose // ignore: cast_nullable_to_non_nullable
as String,ackRequired: null == ackRequired ? _self.ackRequired : ackRequired // ignore: cast_nullable_to_non_nullable
as bool,ackCommentAllowed: null == ackCommentAllowed ? _self.ackCommentAllowed : ackCommentAllowed // ignore: cast_nullable_to_non_nullable
as bool,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,attachmentCount: null == attachmentCount ? _self.attachmentCount : attachmentCount // ignore: cast_nullable_to_non_nullable
as int,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,isPublisher: null == isPublisher ? _self.isPublisher : isPublisher // ignore: cast_nullable_to_non_nullable
as bool,deadline: freezed == deadline ? _self.deadline : deadline // ignore: cast_nullable_to_non_nullable
as DateTime?,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,seenAt: freezed == seenAt ? _self.seenAt : seenAt // ignore: cast_nullable_to_non_nullable
as DateTime?,ackAt: freezed == ackAt ? _self.ackAt : ackAt // ignore: cast_nullable_to_non_nullable
as DateTime?,remindedAt: freezed == remindedAt ? _self.remindedAt : remindedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$NoticeAttachment {

 String get key; String get name; String get mime; int get size;
/// Create a copy of NoticeAttachment
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NoticeAttachmentCopyWith<NoticeAttachment> get copyWith => _$NoticeAttachmentCopyWithImpl<NoticeAttachment>(this as NoticeAttachment, _$identity);

  /// Serializes this NoticeAttachment to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NoticeAttachment&&(identical(other.key, key) || other.key == key)&&(identical(other.name, name) || other.name == name)&&(identical(other.mime, mime) || other.mime == mime)&&(identical(other.size, size) || other.size == size));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,key,name,mime,size);

@override
String toString() {
  return 'NoticeAttachment(key: $key, name: $name, mime: $mime, size: $size)';
}


}

/// @nodoc
abstract mixin class $NoticeAttachmentCopyWith<$Res>  {
  factory $NoticeAttachmentCopyWith(NoticeAttachment value, $Res Function(NoticeAttachment) _then) = _$NoticeAttachmentCopyWithImpl;
@useResult
$Res call({
 String key, String name, String mime, int size
});




}
/// @nodoc
class _$NoticeAttachmentCopyWithImpl<$Res>
    implements $NoticeAttachmentCopyWith<$Res> {
  _$NoticeAttachmentCopyWithImpl(this._self, this._then);

  final NoticeAttachment _self;
  final $Res Function(NoticeAttachment) _then;

/// Create a copy of NoticeAttachment
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? key = null,Object? name = null,Object? mime = null,Object? size = null,}) {
  return _then(NoticeAttachment(
key: null == key ? _self.key : key // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,mime: null == mime ? _self.mime : mime // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [NoticeAttachment].
extension NoticeAttachmentPatterns on NoticeAttachment {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NoticeAttachment value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NoticeAttachment() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NoticeAttachment value)  $default,){
final _that = this;
switch (_that) {
case _NoticeAttachment():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NoticeAttachment value)?  $default,){
final _that = this;
switch (_that) {
case _NoticeAttachment() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String key,  String name,  String mime,  int size)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NoticeAttachment() when $default != null:
return $default(_that.key,_that.name,_that.mime,_that.size);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String key,  String name,  String mime,  int size)  $default,) {final _that = this;
switch (_that) {
case _NoticeAttachment():
return $default(_that.key,_that.name,_that.mime,_that.size);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String key,  String name,  String mime,  int size)?  $default,) {final _that = this;
switch (_that) {
case _NoticeAttachment() when $default != null:
return $default(_that.key,_that.name,_that.mime,_that.size);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NoticeAttachment implements NoticeAttachment {
  const _NoticeAttachment({required this.key, required this.name, required this.mime, required this.size});
  factory _NoticeAttachment.fromJson(Map<String, dynamic> json) => _$NoticeAttachmentFromJson(json);

@override final  String key;
@override final  String name;
@override final  String mime;
@override final  int size;

/// Create a copy of NoticeAttachment
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NoticeAttachmentCopyWith<_NoticeAttachment> get copyWith => __$NoticeAttachmentCopyWithImpl<_NoticeAttachment>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NoticeAttachmentToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NoticeAttachment&&(identical(other.key, key) || other.key == key)&&(identical(other.name, name) || other.name == name)&&(identical(other.mime, mime) || other.mime == mime)&&(identical(other.size, size) || other.size == size));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,key,name,mime,size);

@override
String toString() {
  return 'NoticeAttachment(key: $key, name: $name, mime: $mime, size: $size)';
}


}

/// @nodoc
abstract mixin class _$NoticeAttachmentCopyWith<$Res> implements $NoticeAttachmentCopyWith<$Res> {
  factory _$NoticeAttachmentCopyWith(_NoticeAttachment value, $Res Function(_NoticeAttachment) _then) = __$NoticeAttachmentCopyWithImpl;
@override @useResult
$Res call({
 String key, String name, String mime, int size
});




}
/// @nodoc
class __$NoticeAttachmentCopyWithImpl<$Res>
    implements _$NoticeAttachmentCopyWith<$Res> {
  __$NoticeAttachmentCopyWithImpl(this._self, this._then);

  final _NoticeAttachment _self;
  final $Res Function(_NoticeAttachment) _then;

/// Create a copy of NoticeAttachment
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? key = null,Object? name = null,Object? mime = null,Object? size = null,}) {
  return _then(_NoticeAttachment(
key: null == key ? _self.key : key // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,mime: null == mime ? _self.mime : mime // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$NoticeDetail {

 String get id; String get title; String get preview; String get office; String get audienceLine; String get priority; String get purpose; bool get ackRequired; bool get ackCommentAllowed; bool get archived; int get attachmentCount; String get state;@JsonKey(name: 'late') bool get isLate; bool get isPublisher; String get body; List<NoticeAttachment> get attachments; bool get ackOffline; DateTime? get deadline; DateTime? get publishedAt; DateTime? get seenAt; DateTime? get ackAt; DateTime? get remindedAt; String? get ackMethod; String? get ackComment; DateTime? get ackClientAt; DateTime? get dismissedAt;
/// Create a copy of NoticeDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NoticeDetailCopyWith<NoticeDetail> get copyWith => _$NoticeDetailCopyWithImpl<NoticeDetail>(this as NoticeDetail, _$identity);

  /// Serializes this NoticeDetail to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NoticeDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.preview, preview) || other.preview == preview)&&(identical(other.office, office) || other.office == office)&&(identical(other.audienceLine, audienceLine) || other.audienceLine == audienceLine)&&(identical(other.priority, priority) || other.priority == priority)&&(identical(other.purpose, purpose) || other.purpose == purpose)&&(identical(other.ackRequired, ackRequired) || other.ackRequired == ackRequired)&&(identical(other.ackCommentAllowed, ackCommentAllowed) || other.ackCommentAllowed == ackCommentAllowed)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.attachmentCount, attachmentCount) || other.attachmentCount == attachmentCount)&&(identical(other.state, state) || other.state == state)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.isPublisher, isPublisher) || other.isPublisher == isPublisher)&&(identical(other.body, body) || other.body == body)&&const DeepCollectionEquality().equals(other.attachments, attachments)&&(identical(other.ackOffline, ackOffline) || other.ackOffline == ackOffline)&&(identical(other.deadline, deadline) || other.deadline == deadline)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.seenAt, seenAt) || other.seenAt == seenAt)&&(identical(other.ackAt, ackAt) || other.ackAt == ackAt)&&(identical(other.remindedAt, remindedAt) || other.remindedAt == remindedAt)&&(identical(other.ackMethod, ackMethod) || other.ackMethod == ackMethod)&&(identical(other.ackComment, ackComment) || other.ackComment == ackComment)&&(identical(other.ackClientAt, ackClientAt) || other.ackClientAt == ackClientAt)&&(identical(other.dismissedAt, dismissedAt) || other.dismissedAt == dismissedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,title,preview,office,audienceLine,priority,purpose,ackRequired,ackCommentAllowed,archived,attachmentCount,state,isLate,isPublisher,body,const DeepCollectionEquality().hash(attachments),ackOffline,deadline,publishedAt,seenAt,ackAt,remindedAt,ackMethod,ackComment,ackClientAt,dismissedAt]);

@override
String toString() {
  return 'NoticeDetail(id: $id, title: $title, preview: $preview, office: $office, audienceLine: $audienceLine, priority: $priority, purpose: $purpose, ackRequired: $ackRequired, ackCommentAllowed: $ackCommentAllowed, archived: $archived, attachmentCount: $attachmentCount, state: $state, isLate: $isLate, isPublisher: $isPublisher, body: $body, attachments: $attachments, ackOffline: $ackOffline, deadline: $deadline, publishedAt: $publishedAt, seenAt: $seenAt, ackAt: $ackAt, remindedAt: $remindedAt, ackMethod: $ackMethod, ackComment: $ackComment, ackClientAt: $ackClientAt, dismissedAt: $dismissedAt)';
}


}

/// @nodoc
abstract mixin class $NoticeDetailCopyWith<$Res>  {
  factory $NoticeDetailCopyWith(NoticeDetail value, $Res Function(NoticeDetail) _then) = _$NoticeDetailCopyWithImpl;
@useResult
$Res call({
 String id, String title, String preview, String office, String audienceLine, String priority, String purpose, bool ackRequired, bool ackCommentAllowed, bool archived, int attachmentCount, String state,@JsonKey(name: 'late') bool isLate, bool isPublisher, String body, List<NoticeAttachment> attachments, bool ackOffline, DateTime? deadline, DateTime? publishedAt, DateTime? seenAt, DateTime? ackAt, DateTime? remindedAt, String? ackMethod, String? ackComment, DateTime? ackClientAt, DateTime? dismissedAt
});




}
/// @nodoc
class _$NoticeDetailCopyWithImpl<$Res>
    implements $NoticeDetailCopyWith<$Res> {
  _$NoticeDetailCopyWithImpl(this._self, this._then);

  final NoticeDetail _self;
  final $Res Function(NoticeDetail) _then;

/// Create a copy of NoticeDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? preview = null,Object? office = null,Object? audienceLine = null,Object? priority = null,Object? purpose = null,Object? ackRequired = null,Object? ackCommentAllowed = null,Object? archived = null,Object? attachmentCount = null,Object? state = null,Object? isLate = null,Object? isPublisher = null,Object? body = null,Object? attachments = null,Object? ackOffline = null,Object? deadline = freezed,Object? publishedAt = freezed,Object? seenAt = freezed,Object? ackAt = freezed,Object? remindedAt = freezed,Object? ackMethod = freezed,Object? ackComment = freezed,Object? ackClientAt = freezed,Object? dismissedAt = freezed,}) {
  return _then(NoticeDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,preview: null == preview ? _self.preview : preview // ignore: cast_nullable_to_non_nullable
as String,office: null == office ? _self.office : office // ignore: cast_nullable_to_non_nullable
as String,audienceLine: null == audienceLine ? _self.audienceLine : audienceLine // ignore: cast_nullable_to_non_nullable
as String,priority: null == priority ? _self.priority : priority // ignore: cast_nullable_to_non_nullable
as String,purpose: null == purpose ? _self.purpose : purpose // ignore: cast_nullable_to_non_nullable
as String,ackRequired: null == ackRequired ? _self.ackRequired : ackRequired // ignore: cast_nullable_to_non_nullable
as bool,ackCommentAllowed: null == ackCommentAllowed ? _self.ackCommentAllowed : ackCommentAllowed // ignore: cast_nullable_to_non_nullable
as bool,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,attachmentCount: null == attachmentCount ? _self.attachmentCount : attachmentCount // ignore: cast_nullable_to_non_nullable
as int,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,isPublisher: null == isPublisher ? _self.isPublisher : isPublisher // ignore: cast_nullable_to_non_nullable
as bool,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,attachments: null == attachments ? _self.attachments : attachments // ignore: cast_nullable_to_non_nullable
as List<NoticeAttachment>,ackOffline: null == ackOffline ? _self.ackOffline : ackOffline // ignore: cast_nullable_to_non_nullable
as bool,deadline: freezed == deadline ? _self.deadline : deadline // ignore: cast_nullable_to_non_nullable
as DateTime?,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,seenAt: freezed == seenAt ? _self.seenAt : seenAt // ignore: cast_nullable_to_non_nullable
as DateTime?,ackAt: freezed == ackAt ? _self.ackAt : ackAt // ignore: cast_nullable_to_non_nullable
as DateTime?,remindedAt: freezed == remindedAt ? _self.remindedAt : remindedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,ackMethod: freezed == ackMethod ? _self.ackMethod : ackMethod // ignore: cast_nullable_to_non_nullable
as String?,ackComment: freezed == ackComment ? _self.ackComment : ackComment // ignore: cast_nullable_to_non_nullable
as String?,ackClientAt: freezed == ackClientAt ? _self.ackClientAt : ackClientAt // ignore: cast_nullable_to_non_nullable
as DateTime?,dismissedAt: freezed == dismissedAt ? _self.dismissedAt : dismissedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [NoticeDetail].
extension NoticeDetailPatterns on NoticeDetail {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NoticeDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NoticeDetail() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NoticeDetail value)  $default,){
final _that = this;
switch (_that) {
case _NoticeDetail():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NoticeDetail value)?  $default,){
final _that = this;
switch (_that) {
case _NoticeDetail() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String preview,  String office,  String audienceLine,  String priority,  String purpose,  bool ackRequired,  bool ackCommentAllowed,  bool archived,  int attachmentCount,  String state, @JsonKey(name: 'late')  bool isLate,  bool isPublisher,  String body,  List<NoticeAttachment> attachments,  bool ackOffline,  DateTime? deadline,  DateTime? publishedAt,  DateTime? seenAt,  DateTime? ackAt,  DateTime? remindedAt,  String? ackMethod,  String? ackComment,  DateTime? ackClientAt,  DateTime? dismissedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NoticeDetail() when $default != null:
return $default(_that.id,_that.title,_that.preview,_that.office,_that.audienceLine,_that.priority,_that.purpose,_that.ackRequired,_that.ackCommentAllowed,_that.archived,_that.attachmentCount,_that.state,_that.isLate,_that.isPublisher,_that.body,_that.attachments,_that.ackOffline,_that.deadline,_that.publishedAt,_that.seenAt,_that.ackAt,_that.remindedAt,_that.ackMethod,_that.ackComment,_that.ackClientAt,_that.dismissedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String preview,  String office,  String audienceLine,  String priority,  String purpose,  bool ackRequired,  bool ackCommentAllowed,  bool archived,  int attachmentCount,  String state, @JsonKey(name: 'late')  bool isLate,  bool isPublisher,  String body,  List<NoticeAttachment> attachments,  bool ackOffline,  DateTime? deadline,  DateTime? publishedAt,  DateTime? seenAt,  DateTime? ackAt,  DateTime? remindedAt,  String? ackMethod,  String? ackComment,  DateTime? ackClientAt,  DateTime? dismissedAt)  $default,) {final _that = this;
switch (_that) {
case _NoticeDetail():
return $default(_that.id,_that.title,_that.preview,_that.office,_that.audienceLine,_that.priority,_that.purpose,_that.ackRequired,_that.ackCommentAllowed,_that.archived,_that.attachmentCount,_that.state,_that.isLate,_that.isPublisher,_that.body,_that.attachments,_that.ackOffline,_that.deadline,_that.publishedAt,_that.seenAt,_that.ackAt,_that.remindedAt,_that.ackMethod,_that.ackComment,_that.ackClientAt,_that.dismissedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String preview,  String office,  String audienceLine,  String priority,  String purpose,  bool ackRequired,  bool ackCommentAllowed,  bool archived,  int attachmentCount,  String state, @JsonKey(name: 'late')  bool isLate,  bool isPublisher,  String body,  List<NoticeAttachment> attachments,  bool ackOffline,  DateTime? deadline,  DateTime? publishedAt,  DateTime? seenAt,  DateTime? ackAt,  DateTime? remindedAt,  String? ackMethod,  String? ackComment,  DateTime? ackClientAt,  DateTime? dismissedAt)?  $default,) {final _that = this;
switch (_that) {
case _NoticeDetail() when $default != null:
return $default(_that.id,_that.title,_that.preview,_that.office,_that.audienceLine,_that.priority,_that.purpose,_that.ackRequired,_that.ackCommentAllowed,_that.archived,_that.attachmentCount,_that.state,_that.isLate,_that.isPublisher,_that.body,_that.attachments,_that.ackOffline,_that.deadline,_that.publishedAt,_that.seenAt,_that.ackAt,_that.remindedAt,_that.ackMethod,_that.ackComment,_that.ackClientAt,_that.dismissedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NoticeDetail extends NoticeDetail {
  const _NoticeDetail({required this.id, required this.title, required this.preview, required this.office, required this.audienceLine, required this.priority, required this.purpose, required this.ackRequired, required this.ackCommentAllowed, required this.archived, required this.attachmentCount, required this.state, @JsonKey(name: 'late') required this.isLate, required this.isPublisher, required this.body, required  List<NoticeAttachment> attachments, required this.ackOffline, this.deadline, this.publishedAt, this.seenAt, this.ackAt, this.remindedAt, this.ackMethod, this.ackComment, this.ackClientAt, this.dismissedAt}): _attachments = attachments,super._();
  factory _NoticeDetail.fromJson(Map<String, dynamic> json) => _$NoticeDetailFromJson(json);

@override final  String id;
@override final  String title;
@override final  String preview;
@override final  String office;
@override final  String audienceLine;
@override final  String priority;
@override final  String purpose;
@override final  bool ackRequired;
@override final  bool ackCommentAllowed;
@override final  bool archived;
@override final  int attachmentCount;
@override final  String state;
@override@JsonKey(name: 'late') final  bool isLate;
@override final  bool isPublisher;
@override final  String body;
 final  List<NoticeAttachment> _attachments;
@override List<NoticeAttachment> get attachments {
  if (_attachments is EqualUnmodifiableListView) return _attachments;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_attachments);
}

@override final  bool ackOffline;
@override final  DateTime? deadline;
@override final  DateTime? publishedAt;
@override final  DateTime? seenAt;
@override final  DateTime? ackAt;
@override final  DateTime? remindedAt;
@override final  String? ackMethod;
@override final  String? ackComment;
@override final  DateTime? ackClientAt;
@override final  DateTime? dismissedAt;

/// Create a copy of NoticeDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NoticeDetailCopyWith<_NoticeDetail> get copyWith => __$NoticeDetailCopyWithImpl<_NoticeDetail>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NoticeDetailToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NoticeDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.preview, preview) || other.preview == preview)&&(identical(other.office, office) || other.office == office)&&(identical(other.audienceLine, audienceLine) || other.audienceLine == audienceLine)&&(identical(other.priority, priority) || other.priority == priority)&&(identical(other.purpose, purpose) || other.purpose == purpose)&&(identical(other.ackRequired, ackRequired) || other.ackRequired == ackRequired)&&(identical(other.ackCommentAllowed, ackCommentAllowed) || other.ackCommentAllowed == ackCommentAllowed)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.attachmentCount, attachmentCount) || other.attachmentCount == attachmentCount)&&(identical(other.state, state) || other.state == state)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.isPublisher, isPublisher) || other.isPublisher == isPublisher)&&(identical(other.body, body) || other.body == body)&&const DeepCollectionEquality().equals(other._attachments, _attachments)&&(identical(other.ackOffline, ackOffline) || other.ackOffline == ackOffline)&&(identical(other.deadline, deadline) || other.deadline == deadline)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.seenAt, seenAt) || other.seenAt == seenAt)&&(identical(other.ackAt, ackAt) || other.ackAt == ackAt)&&(identical(other.remindedAt, remindedAt) || other.remindedAt == remindedAt)&&(identical(other.ackMethod, ackMethod) || other.ackMethod == ackMethod)&&(identical(other.ackComment, ackComment) || other.ackComment == ackComment)&&(identical(other.ackClientAt, ackClientAt) || other.ackClientAt == ackClientAt)&&(identical(other.dismissedAt, dismissedAt) || other.dismissedAt == dismissedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,title,preview,office,audienceLine,priority,purpose,ackRequired,ackCommentAllowed,archived,attachmentCount,state,isLate,isPublisher,body,const DeepCollectionEquality().hash(_attachments),ackOffline,deadline,publishedAt,seenAt,ackAt,remindedAt,ackMethod,ackComment,ackClientAt,dismissedAt]);

@override
String toString() {
  return 'NoticeDetail(id: $id, title: $title, preview: $preview, office: $office, audienceLine: $audienceLine, priority: $priority, purpose: $purpose, ackRequired: $ackRequired, ackCommentAllowed: $ackCommentAllowed, archived: $archived, attachmentCount: $attachmentCount, state: $state, isLate: $isLate, isPublisher: $isPublisher, body: $body, attachments: $attachments, ackOffline: $ackOffline, deadline: $deadline, publishedAt: $publishedAt, seenAt: $seenAt, ackAt: $ackAt, remindedAt: $remindedAt, ackMethod: $ackMethod, ackComment: $ackComment, ackClientAt: $ackClientAt, dismissedAt: $dismissedAt)';
}


}

/// @nodoc
abstract mixin class _$NoticeDetailCopyWith<$Res> implements $NoticeDetailCopyWith<$Res> {
  factory _$NoticeDetailCopyWith(_NoticeDetail value, $Res Function(_NoticeDetail) _then) = __$NoticeDetailCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String preview, String office, String audienceLine, String priority, String purpose, bool ackRequired, bool ackCommentAllowed, bool archived, int attachmentCount, String state,@JsonKey(name: 'late') bool isLate, bool isPublisher, String body, List<NoticeAttachment> attachments, bool ackOffline, DateTime? deadline, DateTime? publishedAt, DateTime? seenAt, DateTime? ackAt, DateTime? remindedAt, String? ackMethod, String? ackComment, DateTime? ackClientAt, DateTime? dismissedAt
});




}
/// @nodoc
class __$NoticeDetailCopyWithImpl<$Res>
    implements _$NoticeDetailCopyWith<$Res> {
  __$NoticeDetailCopyWithImpl(this._self, this._then);

  final _NoticeDetail _self;
  final $Res Function(_NoticeDetail) _then;

/// Create a copy of NoticeDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? preview = null,Object? office = null,Object? audienceLine = null,Object? priority = null,Object? purpose = null,Object? ackRequired = null,Object? ackCommentAllowed = null,Object? archived = null,Object? attachmentCount = null,Object? state = null,Object? isLate = null,Object? isPublisher = null,Object? body = null,Object? attachments = null,Object? ackOffline = null,Object? deadline = freezed,Object? publishedAt = freezed,Object? seenAt = freezed,Object? ackAt = freezed,Object? remindedAt = freezed,Object? ackMethod = freezed,Object? ackComment = freezed,Object? ackClientAt = freezed,Object? dismissedAt = freezed,}) {
  return _then(_NoticeDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,preview: null == preview ? _self.preview : preview // ignore: cast_nullable_to_non_nullable
as String,office: null == office ? _self.office : office // ignore: cast_nullable_to_non_nullable
as String,audienceLine: null == audienceLine ? _self.audienceLine : audienceLine // ignore: cast_nullable_to_non_nullable
as String,priority: null == priority ? _self.priority : priority // ignore: cast_nullable_to_non_nullable
as String,purpose: null == purpose ? _self.purpose : purpose // ignore: cast_nullable_to_non_nullable
as String,ackRequired: null == ackRequired ? _self.ackRequired : ackRequired // ignore: cast_nullable_to_non_nullable
as bool,ackCommentAllowed: null == ackCommentAllowed ? _self.ackCommentAllowed : ackCommentAllowed // ignore: cast_nullable_to_non_nullable
as bool,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,attachmentCount: null == attachmentCount ? _self.attachmentCount : attachmentCount // ignore: cast_nullable_to_non_nullable
as int,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,isPublisher: null == isPublisher ? _self.isPublisher : isPublisher // ignore: cast_nullable_to_non_nullable
as bool,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,attachments: null == attachments ? _self._attachments : attachments // ignore: cast_nullable_to_non_nullable
as List<NoticeAttachment>,ackOffline: null == ackOffline ? _self.ackOffline : ackOffline // ignore: cast_nullable_to_non_nullable
as bool,deadline: freezed == deadline ? _self.deadline : deadline // ignore: cast_nullable_to_non_nullable
as DateTime?,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,seenAt: freezed == seenAt ? _self.seenAt : seenAt // ignore: cast_nullable_to_non_nullable
as DateTime?,ackAt: freezed == ackAt ? _self.ackAt : ackAt // ignore: cast_nullable_to_non_nullable
as DateTime?,remindedAt: freezed == remindedAt ? _self.remindedAt : remindedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,ackMethod: freezed == ackMethod ? _self.ackMethod : ackMethod // ignore: cast_nullable_to_non_nullable
as String?,ackComment: freezed == ackComment ? _self.ackComment : ackComment // ignore: cast_nullable_to_non_nullable
as String?,ackClientAt: freezed == ackClientAt ? _self.ackClientAt : ackClientAt // ignore: cast_nullable_to_non_nullable
as DateTime?,dismissedAt: freezed == dismissedAt ? _self.dismissedAt : dismissedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$AttentionData {

 int get dueCount; List<NoticeItem> get items;
/// Create a copy of AttentionData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AttentionDataCopyWith<AttentionData> get copyWith => _$AttentionDataCopyWithImpl<AttentionData>(this as AttentionData, _$identity);

  /// Serializes this AttentionData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AttentionData&&(identical(other.dueCount, dueCount) || other.dueCount == dueCount)&&const DeepCollectionEquality().equals(other.items, items));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,dueCount,const DeepCollectionEquality().hash(items));

@override
String toString() {
  return 'AttentionData(dueCount: $dueCount, items: $items)';
}


}

/// @nodoc
abstract mixin class $AttentionDataCopyWith<$Res>  {
  factory $AttentionDataCopyWith(AttentionData value, $Res Function(AttentionData) _then) = _$AttentionDataCopyWithImpl;
@useResult
$Res call({
 int dueCount, List<NoticeItem> items
});




}
/// @nodoc
class _$AttentionDataCopyWithImpl<$Res>
    implements $AttentionDataCopyWith<$Res> {
  _$AttentionDataCopyWithImpl(this._self, this._then);

  final AttentionData _self;
  final $Res Function(AttentionData) _then;

/// Create a copy of AttentionData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? dueCount = null,Object? items = null,}) {
  return _then(AttentionData(
dueCount: null == dueCount ? _self.dueCount : dueCount // ignore: cast_nullable_to_non_nullable
as int,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<NoticeItem>,
  ));
}

}


/// Adds pattern-matching-related methods to [AttentionData].
extension AttentionDataPatterns on AttentionData {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AttentionData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AttentionData() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AttentionData value)  $default,){
final _that = this;
switch (_that) {
case _AttentionData():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AttentionData value)?  $default,){
final _that = this;
switch (_that) {
case _AttentionData() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int dueCount,  List<NoticeItem> items)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AttentionData() when $default != null:
return $default(_that.dueCount,_that.items);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int dueCount,  List<NoticeItem> items)  $default,) {final _that = this;
switch (_that) {
case _AttentionData():
return $default(_that.dueCount,_that.items);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int dueCount,  List<NoticeItem> items)?  $default,) {final _that = this;
switch (_that) {
case _AttentionData() when $default != null:
return $default(_that.dueCount,_that.items);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AttentionData implements AttentionData {
  const _AttentionData({required this.dueCount, required  List<NoticeItem> items}): _items = items;
  factory _AttentionData.fromJson(Map<String, dynamic> json) => _$AttentionDataFromJson(json);

@override final  int dueCount;
 final  List<NoticeItem> _items;
@override List<NoticeItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}


/// Create a copy of AttentionData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AttentionDataCopyWith<_AttentionData> get copyWith => __$AttentionDataCopyWithImpl<_AttentionData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AttentionDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AttentionData&&(identical(other.dueCount, dueCount) || other.dueCount == dueCount)&&const DeepCollectionEquality().equals(other._items, _items));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,dueCount,const DeepCollectionEquality().hash(_items));

@override
String toString() {
  return 'AttentionData(dueCount: $dueCount, items: $items)';
}


}

/// @nodoc
abstract mixin class _$AttentionDataCopyWith<$Res> implements $AttentionDataCopyWith<$Res> {
  factory _$AttentionDataCopyWith(_AttentionData value, $Res Function(_AttentionData) _then) = __$AttentionDataCopyWithImpl;
@override @useResult
$Res call({
 int dueCount, List<NoticeItem> items
});




}
/// @nodoc
class __$AttentionDataCopyWithImpl<$Res>
    implements _$AttentionDataCopyWith<$Res> {
  __$AttentionDataCopyWithImpl(this._self, this._then);

  final _AttentionData _self;
  final $Res Function(_AttentionData) _then;

/// Create a copy of AttentionData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? dueCount = null,Object? items = null,}) {
  return _then(_AttentionData(
dueCount: null == dueCount ? _self.dueCount : dueCount // ignore: cast_nullable_to_non_nullable
as int,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<NoticeItem>,
  ));
}


}


/// @nodoc
mixin _$NoticePage {

 List<NoticeItem> get items; String? get nextCursor;
/// Create a copy of NoticePage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NoticePageCopyWith<NoticePage> get copyWith => _$NoticePageCopyWithImpl<NoticePage>(this as NoticePage, _$identity);

  /// Serializes this NoticePage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NoticePage&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.nextCursor, nextCursor) || other.nextCursor == nextCursor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(items),nextCursor);

@override
String toString() {
  return 'NoticePage(items: $items, nextCursor: $nextCursor)';
}


}

/// @nodoc
abstract mixin class $NoticePageCopyWith<$Res>  {
  factory $NoticePageCopyWith(NoticePage value, $Res Function(NoticePage) _then) = _$NoticePageCopyWithImpl;
@useResult
$Res call({
 List<NoticeItem> items, String? nextCursor
});




}
/// @nodoc
class _$NoticePageCopyWithImpl<$Res>
    implements $NoticePageCopyWith<$Res> {
  _$NoticePageCopyWithImpl(this._self, this._then);

  final NoticePage _self;
  final $Res Function(NoticePage) _then;

/// Create a copy of NoticePage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? nextCursor = freezed,}) {
  return _then(NoticePage(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<NoticeItem>,nextCursor: freezed == nextCursor ? _self.nextCursor : nextCursor // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [NoticePage].
extension NoticePagePatterns on NoticePage {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NoticePage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NoticePage() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NoticePage value)  $default,){
final _that = this;
switch (_that) {
case _NoticePage():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NoticePage value)?  $default,){
final _that = this;
switch (_that) {
case _NoticePage() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<NoticeItem> items,  String? nextCursor)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NoticePage() when $default != null:
return $default(_that.items,_that.nextCursor);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<NoticeItem> items,  String? nextCursor)  $default,) {final _that = this;
switch (_that) {
case _NoticePage():
return $default(_that.items,_that.nextCursor);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<NoticeItem> items,  String? nextCursor)?  $default,) {final _that = this;
switch (_that) {
case _NoticePage() when $default != null:
return $default(_that.items,_that.nextCursor);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NoticePage implements NoticePage {
  const _NoticePage({required  List<NoticeItem> items, this.nextCursor}): _items = items;
  factory _NoticePage.fromJson(Map<String, dynamic> json) => _$NoticePageFromJson(json);

 final  List<NoticeItem> _items;
@override List<NoticeItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  String? nextCursor;

/// Create a copy of NoticePage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NoticePageCopyWith<_NoticePage> get copyWith => __$NoticePageCopyWithImpl<_NoticePage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NoticePageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NoticePage&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.nextCursor, nextCursor) || other.nextCursor == nextCursor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),nextCursor);

@override
String toString() {
  return 'NoticePage(items: $items, nextCursor: $nextCursor)';
}


}

/// @nodoc
abstract mixin class _$NoticePageCopyWith<$Res> implements $NoticePageCopyWith<$Res> {
  factory _$NoticePageCopyWith(_NoticePage value, $Res Function(_NoticePage) _then) = __$NoticePageCopyWithImpl;
@override @useResult
$Res call({
 List<NoticeItem> items, String? nextCursor
});




}
/// @nodoc
class __$NoticePageCopyWithImpl<$Res>
    implements _$NoticePageCopyWith<$Res> {
  __$NoticePageCopyWithImpl(this._self, this._then);

  final _NoticePage _self;
  final $Res Function(_NoticePage) _then;

/// Create a copy of NoticePage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? nextCursor = freezed,}) {
  return _then(_NoticePage(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<NoticeItem>,nextCursor: freezed == nextCursor ? _self.nextCursor : nextCursor // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$AckRecord {

 DateTime get ackAt;@JsonKey(name: 'late') bool get isLate; String get method; bool get offline; String? get comment; DateTime? get clientAt;
/// Create a copy of AckRecord
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AckRecordCopyWith<AckRecord> get copyWith => _$AckRecordCopyWithImpl<AckRecord>(this as AckRecord, _$identity);

  /// Serializes this AckRecord to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AckRecord&&(identical(other.ackAt, ackAt) || other.ackAt == ackAt)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.method, method) || other.method == method)&&(identical(other.offline, offline) || other.offline == offline)&&(identical(other.comment, comment) || other.comment == comment)&&(identical(other.clientAt, clientAt) || other.clientAt == clientAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,ackAt,isLate,method,offline,comment,clientAt);

@override
String toString() {
  return 'AckRecord(ackAt: $ackAt, isLate: $isLate, method: $method, offline: $offline, comment: $comment, clientAt: $clientAt)';
}


}

/// @nodoc
abstract mixin class $AckRecordCopyWith<$Res>  {
  factory $AckRecordCopyWith(AckRecord value, $Res Function(AckRecord) _then) = _$AckRecordCopyWithImpl;
@useResult
$Res call({
 DateTime ackAt,@JsonKey(name: 'late') bool isLate, String method, bool offline, String? comment, DateTime? clientAt
});




}
/// @nodoc
class _$AckRecordCopyWithImpl<$Res>
    implements $AckRecordCopyWith<$Res> {
  _$AckRecordCopyWithImpl(this._self, this._then);

  final AckRecord _self;
  final $Res Function(AckRecord) _then;

/// Create a copy of AckRecord
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? ackAt = null,Object? isLate = null,Object? method = null,Object? offline = null,Object? comment = freezed,Object? clientAt = freezed,}) {
  return _then(AckRecord(
ackAt: null == ackAt ? _self.ackAt : ackAt // ignore: cast_nullable_to_non_nullable
as DateTime,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,method: null == method ? _self.method : method // ignore: cast_nullable_to_non_nullable
as String,offline: null == offline ? _self.offline : offline // ignore: cast_nullable_to_non_nullable
as bool,comment: freezed == comment ? _self.comment : comment // ignore: cast_nullable_to_non_nullable
as String?,clientAt: freezed == clientAt ? _self.clientAt : clientAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [AckRecord].
extension AckRecordPatterns on AckRecord {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AckRecord value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AckRecord() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AckRecord value)  $default,){
final _that = this;
switch (_that) {
case _AckRecord():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AckRecord value)?  $default,){
final _that = this;
switch (_that) {
case _AckRecord() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( DateTime ackAt, @JsonKey(name: 'late')  bool isLate,  String method,  bool offline,  String? comment,  DateTime? clientAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AckRecord() when $default != null:
return $default(_that.ackAt,_that.isLate,_that.method,_that.offline,_that.comment,_that.clientAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( DateTime ackAt, @JsonKey(name: 'late')  bool isLate,  String method,  bool offline,  String? comment,  DateTime? clientAt)  $default,) {final _that = this;
switch (_that) {
case _AckRecord():
return $default(_that.ackAt,_that.isLate,_that.method,_that.offline,_that.comment,_that.clientAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( DateTime ackAt, @JsonKey(name: 'late')  bool isLate,  String method,  bool offline,  String? comment,  DateTime? clientAt)?  $default,) {final _that = this;
switch (_that) {
case _AckRecord() when $default != null:
return $default(_that.ackAt,_that.isLate,_that.method,_that.offline,_that.comment,_that.clientAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AckRecord implements AckRecord {
  const _AckRecord({required this.ackAt, @JsonKey(name: 'late') required this.isLate, required this.method, required this.offline, this.comment, this.clientAt});
  factory _AckRecord.fromJson(Map<String, dynamic> json) => _$AckRecordFromJson(json);

@override final  DateTime ackAt;
@override@JsonKey(name: 'late') final  bool isLate;
@override final  String method;
@override final  bool offline;
@override final  String? comment;
@override final  DateTime? clientAt;

/// Create a copy of AckRecord
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AckRecordCopyWith<_AckRecord> get copyWith => __$AckRecordCopyWithImpl<_AckRecord>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AckRecordToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AckRecord&&(identical(other.ackAt, ackAt) || other.ackAt == ackAt)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.method, method) || other.method == method)&&(identical(other.offline, offline) || other.offline == offline)&&(identical(other.comment, comment) || other.comment == comment)&&(identical(other.clientAt, clientAt) || other.clientAt == clientAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,ackAt,isLate,method,offline,comment,clientAt);

@override
String toString() {
  return 'AckRecord(ackAt: $ackAt, isLate: $isLate, method: $method, offline: $offline, comment: $comment, clientAt: $clientAt)';
}


}

/// @nodoc
abstract mixin class _$AckRecordCopyWith<$Res> implements $AckRecordCopyWith<$Res> {
  factory _$AckRecordCopyWith(_AckRecord value, $Res Function(_AckRecord) _then) = __$AckRecordCopyWithImpl;
@override @useResult
$Res call({
 DateTime ackAt,@JsonKey(name: 'late') bool isLate, String method, bool offline, String? comment, DateTime? clientAt
});




}
/// @nodoc
class __$AckRecordCopyWithImpl<$Res>
    implements _$AckRecordCopyWith<$Res> {
  __$AckRecordCopyWithImpl(this._self, this._then);

  final _AckRecord _self;
  final $Res Function(_AckRecord) _then;

/// Create a copy of AckRecord
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? ackAt = null,Object? isLate = null,Object? method = null,Object? offline = null,Object? comment = freezed,Object? clientAt = freezed,}) {
  return _then(_AckRecord(
ackAt: null == ackAt ? _self.ackAt : ackAt // ignore: cast_nullable_to_non_nullable
as DateTime,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,method: null == method ? _self.method : method // ignore: cast_nullable_to_non_nullable
as String,offline: null == offline ? _self.offline : offline // ignore: cast_nullable_to_non_nullable
as bool,comment: freezed == comment ? _self.comment : comment // ignore: cast_nullable_to_non_nullable
as String?,clientAt: freezed == clientAt ? _self.clientAt : clientAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$Reminders {

 int get used; int get max; DateTime? get lastAt;
/// Create a copy of Reminders
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RemindersCopyWith<Reminders> get copyWith => _$RemindersCopyWithImpl<Reminders>(this as Reminders, _$identity);

  /// Serializes this Reminders to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Reminders&&(identical(other.used, used) || other.used == used)&&(identical(other.max, max) || other.max == max)&&(identical(other.lastAt, lastAt) || other.lastAt == lastAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,used,max,lastAt);

@override
String toString() {
  return 'Reminders(used: $used, max: $max, lastAt: $lastAt)';
}


}

/// @nodoc
abstract mixin class $RemindersCopyWith<$Res>  {
  factory $RemindersCopyWith(Reminders value, $Res Function(Reminders) _then) = _$RemindersCopyWithImpl;
@useResult
$Res call({
 int used, int max, DateTime? lastAt
});




}
/// @nodoc
class _$RemindersCopyWithImpl<$Res>
    implements $RemindersCopyWith<$Res> {
  _$RemindersCopyWithImpl(this._self, this._then);

  final Reminders _self;
  final $Res Function(Reminders) _then;

/// Create a copy of Reminders
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? used = null,Object? max = null,Object? lastAt = freezed,}) {
  return _then(Reminders(
used: null == used ? _self.used : used // ignore: cast_nullable_to_non_nullable
as int,max: null == max ? _self.max : max // ignore: cast_nullable_to_non_nullable
as int,lastAt: freezed == lastAt ? _self.lastAt : lastAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [Reminders].
extension RemindersPatterns on Reminders {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Reminders value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Reminders() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Reminders value)  $default,){
final _that = this;
switch (_that) {
case _Reminders():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Reminders value)?  $default,){
final _that = this;
switch (_that) {
case _Reminders() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int used,  int max,  DateTime? lastAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Reminders() when $default != null:
return $default(_that.used,_that.max,_that.lastAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int used,  int max,  DateTime? lastAt)  $default,) {final _that = this;
switch (_that) {
case _Reminders():
return $default(_that.used,_that.max,_that.lastAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int used,  int max,  DateTime? lastAt)?  $default,) {final _that = this;
switch (_that) {
case _Reminders() when $default != null:
return $default(_that.used,_that.max,_that.lastAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Reminders extends Reminders {
  const _Reminders({required this.used, required this.max, this.lastAt}): super._();
  factory _Reminders.fromJson(Map<String, dynamic> json) => _$RemindersFromJson(json);

@override final  int used;
@override final  int max;
@override final  DateTime? lastAt;

/// Create a copy of Reminders
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RemindersCopyWith<_Reminders> get copyWith => __$RemindersCopyWithImpl<_Reminders>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RemindersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Reminders&&(identical(other.used, used) || other.used == used)&&(identical(other.max, max) || other.max == max)&&(identical(other.lastAt, lastAt) || other.lastAt == lastAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,used,max,lastAt);

@override
String toString() {
  return 'Reminders(used: $used, max: $max, lastAt: $lastAt)';
}


}

/// @nodoc
abstract mixin class _$RemindersCopyWith<$Res> implements $RemindersCopyWith<$Res> {
  factory _$RemindersCopyWith(_Reminders value, $Res Function(_Reminders) _then) = __$RemindersCopyWithImpl;
@override @useResult
$Res call({
 int used, int max, DateTime? lastAt
});




}
/// @nodoc
class __$RemindersCopyWithImpl<$Res>
    implements _$RemindersCopyWith<$Res> {
  __$RemindersCopyWithImpl(this._self, this._then);

  final _Reminders _self;
  final $Res Function(_Reminders) _then;

/// Create a copy of Reminders
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? used = null,Object? max = null,Object? lastAt = freezed,}) {
  return _then(_Reminders(
used: null == used ? _self.used : used // ignore: cast_nullable_to_non_nullable
as int,max: null == max ? _self.max : max // ignore: cast_nullable_to_non_nullable
as int,lastAt: freezed == lastAt ? _self.lastAt : lastAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$ReachPerson {

 String get name; String get group; String? get identifier; DateTime? get at;
/// Create a copy of ReachPerson
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReachPersonCopyWith<ReachPerson> get copyWith => _$ReachPersonCopyWithImpl<ReachPerson>(this as ReachPerson, _$identity);

  /// Serializes this ReachPerson to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReachPerson&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,identifier,at);

@override
String toString() {
  return 'ReachPerson(name: $name, group: $group, identifier: $identifier, at: $at)';
}


}

/// @nodoc
abstract mixin class $ReachPersonCopyWith<$Res>  {
  factory $ReachPersonCopyWith(ReachPerson value, $Res Function(ReachPerson) _then) = _$ReachPersonCopyWithImpl;
@useResult
$Res call({
 String name, String group, String? identifier, DateTime? at
});




}
/// @nodoc
class _$ReachPersonCopyWithImpl<$Res>
    implements $ReachPersonCopyWith<$Res> {
  _$ReachPersonCopyWithImpl(this._self, this._then);

  final ReachPerson _self;
  final $Res Function(ReachPerson) _then;

/// Create a copy of ReachPerson
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? group = null,Object? identifier = freezed,Object? at = freezed,}) {
  return _then(ReachPerson(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,at: freezed == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [ReachPerson].
extension ReachPersonPatterns on ReachPerson {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReachPerson value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReachPerson() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReachPerson value)  $default,){
final _that = this;
switch (_that) {
case _ReachPerson():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReachPerson value)?  $default,){
final _that = this;
switch (_that) {
case _ReachPerson() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String group,  String? identifier,  DateTime? at)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReachPerson() when $default != null:
return $default(_that.name,_that.group,_that.identifier,_that.at);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String group,  String? identifier,  DateTime? at)  $default,) {final _that = this;
switch (_that) {
case _ReachPerson():
return $default(_that.name,_that.group,_that.identifier,_that.at);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String group,  String? identifier,  DateTime? at)?  $default,) {final _that = this;
switch (_that) {
case _ReachPerson() when $default != null:
return $default(_that.name,_that.group,_that.identifier,_that.at);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReachPerson implements ReachPerson {
  const _ReachPerson({required this.name, required this.group, this.identifier, this.at});
  factory _ReachPerson.fromJson(Map<String, dynamic> json) => _$ReachPersonFromJson(json);

@override final  String name;
@override final  String group;
@override final  String? identifier;
@override final  DateTime? at;

/// Create a copy of ReachPerson
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReachPersonCopyWith<_ReachPerson> get copyWith => __$ReachPersonCopyWithImpl<_ReachPerson>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReachPersonToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReachPerson&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,identifier,at);

@override
String toString() {
  return 'ReachPerson(name: $name, group: $group, identifier: $identifier, at: $at)';
}


}

/// @nodoc
abstract mixin class _$ReachPersonCopyWith<$Res> implements $ReachPersonCopyWith<$Res> {
  factory _$ReachPersonCopyWith(_ReachPerson value, $Res Function(_ReachPerson) _then) = __$ReachPersonCopyWithImpl;
@override @useResult
$Res call({
 String name, String group, String? identifier, DateTime? at
});




}
/// @nodoc
class __$ReachPersonCopyWithImpl<$Res>
    implements _$ReachPersonCopyWith<$Res> {
  __$ReachPersonCopyWithImpl(this._self, this._then);

  final _ReachPerson _self;
  final $Res Function(_ReachPerson) _then;

/// Create a copy of ReachPerson
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? group = null,Object? identifier = freezed,Object? at = freezed,}) {
  return _then(_ReachPerson(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,at: freezed == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$ReachComment {

 String get name; String get group; String get comment;@JsonKey(name: 'late') bool get isLate; String? get identifier; DateTime? get at;
/// Create a copy of ReachComment
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReachCommentCopyWith<ReachComment> get copyWith => _$ReachCommentCopyWithImpl<ReachComment>(this as ReachComment, _$identity);

  /// Serializes this ReachComment to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReachComment&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.comment, comment) || other.comment == comment)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,comment,isLate,identifier,at);

@override
String toString() {
  return 'ReachComment(name: $name, group: $group, comment: $comment, isLate: $isLate, identifier: $identifier, at: $at)';
}


}

/// @nodoc
abstract mixin class $ReachCommentCopyWith<$Res>  {
  factory $ReachCommentCopyWith(ReachComment value, $Res Function(ReachComment) _then) = _$ReachCommentCopyWithImpl;
@useResult
$Res call({
 String name, String group, String comment,@JsonKey(name: 'late') bool isLate, String? identifier, DateTime? at
});




}
/// @nodoc
class _$ReachCommentCopyWithImpl<$Res>
    implements $ReachCommentCopyWith<$Res> {
  _$ReachCommentCopyWithImpl(this._self, this._then);

  final ReachComment _self;
  final $Res Function(ReachComment) _then;

/// Create a copy of ReachComment
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? group = null,Object? comment = null,Object? isLate = null,Object? identifier = freezed,Object? at = freezed,}) {
  return _then(ReachComment(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,comment: null == comment ? _self.comment : comment // ignore: cast_nullable_to_non_nullable
as String,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,at: freezed == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [ReachComment].
extension ReachCommentPatterns on ReachComment {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReachComment value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReachComment() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReachComment value)  $default,){
final _that = this;
switch (_that) {
case _ReachComment():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReachComment value)?  $default,){
final _that = this;
switch (_that) {
case _ReachComment() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String group,  String comment, @JsonKey(name: 'late')  bool isLate,  String? identifier,  DateTime? at)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReachComment() when $default != null:
return $default(_that.name,_that.group,_that.comment,_that.isLate,_that.identifier,_that.at);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String group,  String comment, @JsonKey(name: 'late')  bool isLate,  String? identifier,  DateTime? at)  $default,) {final _that = this;
switch (_that) {
case _ReachComment():
return $default(_that.name,_that.group,_that.comment,_that.isLate,_that.identifier,_that.at);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String group,  String comment, @JsonKey(name: 'late')  bool isLate,  String? identifier,  DateTime? at)?  $default,) {final _that = this;
switch (_that) {
case _ReachComment() when $default != null:
return $default(_that.name,_that.group,_that.comment,_that.isLate,_that.identifier,_that.at);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReachComment implements ReachComment {
  const _ReachComment({required this.name, required this.group, required this.comment, @JsonKey(name: 'late') required this.isLate, this.identifier, this.at});
  factory _ReachComment.fromJson(Map<String, dynamic> json) => _$ReachCommentFromJson(json);

@override final  String name;
@override final  String group;
@override final  String comment;
@override@JsonKey(name: 'late') final  bool isLate;
@override final  String? identifier;
@override final  DateTime? at;

/// Create a copy of ReachComment
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReachCommentCopyWith<_ReachComment> get copyWith => __$ReachCommentCopyWithImpl<_ReachComment>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReachCommentToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReachComment&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.comment, comment) || other.comment == comment)&&(identical(other.isLate, isLate) || other.isLate == isLate)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,comment,isLate,identifier,at);

@override
String toString() {
  return 'ReachComment(name: $name, group: $group, comment: $comment, isLate: $isLate, identifier: $identifier, at: $at)';
}


}

/// @nodoc
abstract mixin class _$ReachCommentCopyWith<$Res> implements $ReachCommentCopyWith<$Res> {
  factory _$ReachCommentCopyWith(_ReachComment value, $Res Function(_ReachComment) _then) = __$ReachCommentCopyWithImpl;
@override @useResult
$Res call({
 String name, String group, String comment,@JsonKey(name: 'late') bool isLate, String? identifier, DateTime? at
});




}
/// @nodoc
class __$ReachCommentCopyWithImpl<$Res>
    implements _$ReachCommentCopyWith<$Res> {
  __$ReachCommentCopyWithImpl(this._self, this._then);

  final _ReachComment _self;
  final $Res Function(_ReachComment) _then;

/// Create a copy of ReachComment
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? group = null,Object? comment = null,Object? isLate = null,Object? identifier = freezed,Object? at = freezed,}) {
  return _then(_ReachComment(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,comment: null == comment ? _self.comment : comment // ignore: cast_nullable_to_non_nullable
as String,isLate: null == isLate ? _self.isLate : isLate // ignore: cast_nullable_to_non_nullable
as bool,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,at: freezed == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$ReachGroup {

 String get label; int get total; int get acknowledged; int get seen; int get notSeen; int get notOnJuvi;
/// Create a copy of ReachGroup
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReachGroupCopyWith<ReachGroup> get copyWith => _$ReachGroupCopyWithImpl<ReachGroup>(this as ReachGroup, _$identity);

  /// Serializes this ReachGroup to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReachGroup&&(identical(other.label, label) || other.label == label)&&(identical(other.total, total) || other.total == total)&&(identical(other.acknowledged, acknowledged) || other.acknowledged == acknowledged)&&(identical(other.seen, seen) || other.seen == seen)&&(identical(other.notSeen, notSeen) || other.notSeen == notSeen)&&(identical(other.notOnJuvi, notOnJuvi) || other.notOnJuvi == notOnJuvi));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,label,total,acknowledged,seen,notSeen,notOnJuvi);

@override
String toString() {
  return 'ReachGroup(label: $label, total: $total, acknowledged: $acknowledged, seen: $seen, notSeen: $notSeen, notOnJuvi: $notOnJuvi)';
}


}

/// @nodoc
abstract mixin class $ReachGroupCopyWith<$Res>  {
  factory $ReachGroupCopyWith(ReachGroup value, $Res Function(ReachGroup) _then) = _$ReachGroupCopyWithImpl;
@useResult
$Res call({
 String label, int total, int acknowledged, int seen, int notSeen, int notOnJuvi
});




}
/// @nodoc
class _$ReachGroupCopyWithImpl<$Res>
    implements $ReachGroupCopyWith<$Res> {
  _$ReachGroupCopyWithImpl(this._self, this._then);

  final ReachGroup _self;
  final $Res Function(ReachGroup) _then;

/// Create a copy of ReachGroup
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? label = null,Object? total = null,Object? acknowledged = null,Object? seen = null,Object? notSeen = null,Object? notOnJuvi = null,}) {
  return _then(ReachGroup(
label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,acknowledged: null == acknowledged ? _self.acknowledged : acknowledged // ignore: cast_nullable_to_non_nullable
as int,seen: null == seen ? _self.seen : seen // ignore: cast_nullable_to_non_nullable
as int,notSeen: null == notSeen ? _self.notSeen : notSeen // ignore: cast_nullable_to_non_nullable
as int,notOnJuvi: null == notOnJuvi ? _self.notOnJuvi : notOnJuvi // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ReachGroup].
extension ReachGroupPatterns on ReachGroup {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReachGroup value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReachGroup() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReachGroup value)  $default,){
final _that = this;
switch (_that) {
case _ReachGroup():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReachGroup value)?  $default,){
final _that = this;
switch (_that) {
case _ReachGroup() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String label,  int total,  int acknowledged,  int seen,  int notSeen,  int notOnJuvi)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReachGroup() when $default != null:
return $default(_that.label,_that.total,_that.acknowledged,_that.seen,_that.notSeen,_that.notOnJuvi);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String label,  int total,  int acknowledged,  int seen,  int notSeen,  int notOnJuvi)  $default,) {final _that = this;
switch (_that) {
case _ReachGroup():
return $default(_that.label,_that.total,_that.acknowledged,_that.seen,_that.notSeen,_that.notOnJuvi);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String label,  int total,  int acknowledged,  int seen,  int notSeen,  int notOnJuvi)?  $default,) {final _that = this;
switch (_that) {
case _ReachGroup() when $default != null:
return $default(_that.label,_that.total,_that.acknowledged,_that.seen,_that.notSeen,_that.notOnJuvi);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReachGroup implements ReachGroup {
  const _ReachGroup({required this.label, required this.total, required this.acknowledged, required this.seen, required this.notSeen, required this.notOnJuvi});
  factory _ReachGroup.fromJson(Map<String, dynamic> json) => _$ReachGroupFromJson(json);

@override final  String label;
@override final  int total;
@override final  int acknowledged;
@override final  int seen;
@override final  int notSeen;
@override final  int notOnJuvi;

/// Create a copy of ReachGroup
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReachGroupCopyWith<_ReachGroup> get copyWith => __$ReachGroupCopyWithImpl<_ReachGroup>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReachGroupToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReachGroup&&(identical(other.label, label) || other.label == label)&&(identical(other.total, total) || other.total == total)&&(identical(other.acknowledged, acknowledged) || other.acknowledged == acknowledged)&&(identical(other.seen, seen) || other.seen == seen)&&(identical(other.notSeen, notSeen) || other.notSeen == notSeen)&&(identical(other.notOnJuvi, notOnJuvi) || other.notOnJuvi == notOnJuvi));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,label,total,acknowledged,seen,notSeen,notOnJuvi);

@override
String toString() {
  return 'ReachGroup(label: $label, total: $total, acknowledged: $acknowledged, seen: $seen, notSeen: $notSeen, notOnJuvi: $notOnJuvi)';
}


}

/// @nodoc
abstract mixin class _$ReachGroupCopyWith<$Res> implements $ReachGroupCopyWith<$Res> {
  factory _$ReachGroupCopyWith(_ReachGroup value, $Res Function(_ReachGroup) _then) = __$ReachGroupCopyWithImpl;
@override @useResult
$Res call({
 String label, int total, int acknowledged, int seen, int notSeen, int notOnJuvi
});




}
/// @nodoc
class __$ReachGroupCopyWithImpl<$Res>
    implements _$ReachGroupCopyWith<$Res> {
  __$ReachGroupCopyWithImpl(this._self, this._then);

  final _ReachGroup _self;
  final $Res Function(_ReachGroup) _then;

/// Create a copy of ReachGroup
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? label = null,Object? total = null,Object? acknowledged = null,Object? seen = null,Object? notSeen = null,Object? notOnJuvi = null,}) {
  return _then(_ReachGroup(
label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,acknowledged: null == acknowledged ? _self.acknowledged : acknowledged // ignore: cast_nullable_to_non_nullable
as int,seen: null == seen ? _self.seen : seen // ignore: cast_nullable_to_non_nullable
as int,notSeen: null == notSeen ? _self.notSeen : notSeen // ignore: cast_nullable_to_non_nullable
as int,notOnJuvi: null == notOnJuvi ? _self.notOnJuvi : notOnJuvi // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ReachAddedLaterItem {

 String get name; String get group; String get state; String? get identifier; DateTime? get at;
/// Create a copy of ReachAddedLaterItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReachAddedLaterItemCopyWith<ReachAddedLaterItem> get copyWith => _$ReachAddedLaterItemCopyWithImpl<ReachAddedLaterItem>(this as ReachAddedLaterItem, _$identity);

  /// Serializes this ReachAddedLaterItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReachAddedLaterItem&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.state, state) || other.state == state)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,state,identifier,at);

@override
String toString() {
  return 'ReachAddedLaterItem(name: $name, group: $group, state: $state, identifier: $identifier, at: $at)';
}


}

/// @nodoc
abstract mixin class $ReachAddedLaterItemCopyWith<$Res>  {
  factory $ReachAddedLaterItemCopyWith(ReachAddedLaterItem value, $Res Function(ReachAddedLaterItem) _then) = _$ReachAddedLaterItemCopyWithImpl;
@useResult
$Res call({
 String name, String group, String state, String? identifier, DateTime? at
});




}
/// @nodoc
class _$ReachAddedLaterItemCopyWithImpl<$Res>
    implements $ReachAddedLaterItemCopyWith<$Res> {
  _$ReachAddedLaterItemCopyWithImpl(this._self, this._then);

  final ReachAddedLaterItem _self;
  final $Res Function(ReachAddedLaterItem) _then;

/// Create a copy of ReachAddedLaterItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? group = null,Object? state = null,Object? identifier = freezed,Object? at = freezed,}) {
  return _then(ReachAddedLaterItem(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,at: freezed == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [ReachAddedLaterItem].
extension ReachAddedLaterItemPatterns on ReachAddedLaterItem {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReachAddedLaterItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReachAddedLaterItem() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReachAddedLaterItem value)  $default,){
final _that = this;
switch (_that) {
case _ReachAddedLaterItem():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReachAddedLaterItem value)?  $default,){
final _that = this;
switch (_that) {
case _ReachAddedLaterItem() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String group,  String state,  String? identifier,  DateTime? at)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReachAddedLaterItem() when $default != null:
return $default(_that.name,_that.group,_that.state,_that.identifier,_that.at);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String group,  String state,  String? identifier,  DateTime? at)  $default,) {final _that = this;
switch (_that) {
case _ReachAddedLaterItem():
return $default(_that.name,_that.group,_that.state,_that.identifier,_that.at);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String group,  String state,  String? identifier,  DateTime? at)?  $default,) {final _that = this;
switch (_that) {
case _ReachAddedLaterItem() when $default != null:
return $default(_that.name,_that.group,_that.state,_that.identifier,_that.at);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReachAddedLaterItem implements ReachAddedLaterItem {
  const _ReachAddedLaterItem({required this.name, required this.group, required this.state, this.identifier, this.at});
  factory _ReachAddedLaterItem.fromJson(Map<String, dynamic> json) => _$ReachAddedLaterItemFromJson(json);

@override final  String name;
@override final  String group;
@override final  String state;
@override final  String? identifier;
@override final  DateTime? at;

/// Create a copy of ReachAddedLaterItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReachAddedLaterItemCopyWith<_ReachAddedLaterItem> get copyWith => __$ReachAddedLaterItemCopyWithImpl<_ReachAddedLaterItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReachAddedLaterItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReachAddedLaterItem&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.state, state) || other.state == state)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,state,identifier,at);

@override
String toString() {
  return 'ReachAddedLaterItem(name: $name, group: $group, state: $state, identifier: $identifier, at: $at)';
}


}

/// @nodoc
abstract mixin class _$ReachAddedLaterItemCopyWith<$Res> implements $ReachAddedLaterItemCopyWith<$Res> {
  factory _$ReachAddedLaterItemCopyWith(_ReachAddedLaterItem value, $Res Function(_ReachAddedLaterItem) _then) = __$ReachAddedLaterItemCopyWithImpl;
@override @useResult
$Res call({
 String name, String group, String state, String? identifier, DateTime? at
});




}
/// @nodoc
class __$ReachAddedLaterItemCopyWithImpl<$Res>
    implements _$ReachAddedLaterItemCopyWith<$Res> {
  __$ReachAddedLaterItemCopyWithImpl(this._self, this._then);

  final _ReachAddedLaterItem _self;
  final $Res Function(_ReachAddedLaterItem) _then;

/// Create a copy of ReachAddedLaterItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? group = null,Object? state = null,Object? identifier = freezed,Object? at = freezed,}) {
  return _then(_ReachAddedLaterItem(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,at: freezed == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$ReachAddedLater {

 int get total; int get acknowledged; int get seen; List<ReachAddedLaterItem> get items;
/// Create a copy of ReachAddedLater
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReachAddedLaterCopyWith<ReachAddedLater> get copyWith => _$ReachAddedLaterCopyWithImpl<ReachAddedLater>(this as ReachAddedLater, _$identity);

  /// Serializes this ReachAddedLater to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReachAddedLater&&(identical(other.total, total) || other.total == total)&&(identical(other.acknowledged, acknowledged) || other.acknowledged == acknowledged)&&(identical(other.seen, seen) || other.seen == seen)&&const DeepCollectionEquality().equals(other.items, items));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,acknowledged,seen,const DeepCollectionEquality().hash(items));

@override
String toString() {
  return 'ReachAddedLater(total: $total, acknowledged: $acknowledged, seen: $seen, items: $items)';
}


}

/// @nodoc
abstract mixin class $ReachAddedLaterCopyWith<$Res>  {
  factory $ReachAddedLaterCopyWith(ReachAddedLater value, $Res Function(ReachAddedLater) _then) = _$ReachAddedLaterCopyWithImpl;
@useResult
$Res call({
 int total, int acknowledged, int seen, List<ReachAddedLaterItem> items
});




}
/// @nodoc
class _$ReachAddedLaterCopyWithImpl<$Res>
    implements $ReachAddedLaterCopyWith<$Res> {
  _$ReachAddedLaterCopyWithImpl(this._self, this._then);

  final ReachAddedLater _self;
  final $Res Function(ReachAddedLater) _then;

/// Create a copy of ReachAddedLater
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? total = null,Object? acknowledged = null,Object? seen = null,Object? items = null,}) {
  return _then(ReachAddedLater(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,acknowledged: null == acknowledged ? _self.acknowledged : acknowledged // ignore: cast_nullable_to_non_nullable
as int,seen: null == seen ? _self.seen : seen // ignore: cast_nullable_to_non_nullable
as int,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<ReachAddedLaterItem>,
  ));
}

}


/// Adds pattern-matching-related methods to [ReachAddedLater].
extension ReachAddedLaterPatterns on ReachAddedLater {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReachAddedLater value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReachAddedLater() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReachAddedLater value)  $default,){
final _that = this;
switch (_that) {
case _ReachAddedLater():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReachAddedLater value)?  $default,){
final _that = this;
switch (_that) {
case _ReachAddedLater() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int total,  int acknowledged,  int seen,  List<ReachAddedLaterItem> items)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReachAddedLater() when $default != null:
return $default(_that.total,_that.acknowledged,_that.seen,_that.items);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int total,  int acknowledged,  int seen,  List<ReachAddedLaterItem> items)  $default,) {final _that = this;
switch (_that) {
case _ReachAddedLater():
return $default(_that.total,_that.acknowledged,_that.seen,_that.items);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int total,  int acknowledged,  int seen,  List<ReachAddedLaterItem> items)?  $default,) {final _that = this;
switch (_that) {
case _ReachAddedLater() when $default != null:
return $default(_that.total,_that.acknowledged,_that.seen,_that.items);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReachAddedLater implements ReachAddedLater {
  const _ReachAddedLater({required this.total, required this.acknowledged, required this.seen, required  List<ReachAddedLaterItem> items}): _items = items;
  factory _ReachAddedLater.fromJson(Map<String, dynamic> json) => _$ReachAddedLaterFromJson(json);

@override final  int total;
@override final  int acknowledged;
@override final  int seen;
 final  List<ReachAddedLaterItem> _items;
@override List<ReachAddedLaterItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}


/// Create a copy of ReachAddedLater
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReachAddedLaterCopyWith<_ReachAddedLater> get copyWith => __$ReachAddedLaterCopyWithImpl<_ReachAddedLater>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReachAddedLaterToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReachAddedLater&&(identical(other.total, total) || other.total == total)&&(identical(other.acknowledged, acknowledged) || other.acknowledged == acknowledged)&&(identical(other.seen, seen) || other.seen == seen)&&const DeepCollectionEquality().equals(other._items, _items));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,acknowledged,seen,const DeepCollectionEquality().hash(_items));

@override
String toString() {
  return 'ReachAddedLater(total: $total, acknowledged: $acknowledged, seen: $seen, items: $items)';
}


}

/// @nodoc
abstract mixin class _$ReachAddedLaterCopyWith<$Res> implements $ReachAddedLaterCopyWith<$Res> {
  factory _$ReachAddedLaterCopyWith(_ReachAddedLater value, $Res Function(_ReachAddedLater) _then) = __$ReachAddedLaterCopyWithImpl;
@override @useResult
$Res call({
 int total, int acknowledged, int seen, List<ReachAddedLaterItem> items
});




}
/// @nodoc
class __$ReachAddedLaterCopyWithImpl<$Res>
    implements _$ReachAddedLaterCopyWith<$Res> {
  __$ReachAddedLaterCopyWithImpl(this._self, this._then);

  final _ReachAddedLater _self;
  final $Res Function(_ReachAddedLater) _then;

/// Create a copy of ReachAddedLater
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? total = null,Object? acknowledged = null,Object? seen = null,Object? items = null,}) {
  return _then(_ReachAddedLater(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,acknowledged: null == acknowledged ? _self.acknowledged : acknowledged // ignore: cast_nullable_to_non_nullable
as int,seen: null == seen ? _self.seen : seen // ignore: cast_nullable_to_non_nullable
as int,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<ReachAddedLaterItem>,
  ));
}


}


/// @nodoc
mixin _$NoticeReachData {

 String get noticeId; String get title; String get status; bool get ackRequired; int get audience; int get acknowledged; int get seen; int get notSeen; int get notOnJuvi; int get dismissed;@JsonKey(name: 'late') int get lateCount; Reminders get reminders; List<int> get sparkline; List<ReachGroup> get groups; List<ReachPerson> get lateAcks; List<ReachComment> get comments; ReachAddedLater get addedLater; DateTime get asOf; DateTime? get deadline; DateTime? get publishedAt;
/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NoticeReachDataCopyWith<NoticeReachData> get copyWith => _$NoticeReachDataCopyWithImpl<NoticeReachData>(this as NoticeReachData, _$identity);

  /// Serializes this NoticeReachData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NoticeReachData&&(identical(other.noticeId, noticeId) || other.noticeId == noticeId)&&(identical(other.title, title) || other.title == title)&&(identical(other.status, status) || other.status == status)&&(identical(other.ackRequired, ackRequired) || other.ackRequired == ackRequired)&&(identical(other.audience, audience) || other.audience == audience)&&(identical(other.acknowledged, acknowledged) || other.acknowledged == acknowledged)&&(identical(other.seen, seen) || other.seen == seen)&&(identical(other.notSeen, notSeen) || other.notSeen == notSeen)&&(identical(other.notOnJuvi, notOnJuvi) || other.notOnJuvi == notOnJuvi)&&(identical(other.dismissed, dismissed) || other.dismissed == dismissed)&&(identical(other.lateCount, lateCount) || other.lateCount == lateCount)&&(identical(other.reminders, reminders) || other.reminders == reminders)&&const DeepCollectionEquality().equals(other.sparkline, sparkline)&&const DeepCollectionEquality().equals(other.groups, groups)&&const DeepCollectionEquality().equals(other.lateAcks, lateAcks)&&const DeepCollectionEquality().equals(other.comments, comments)&&(identical(other.addedLater, addedLater) || other.addedLater == addedLater)&&(identical(other.asOf, asOf) || other.asOf == asOf)&&(identical(other.deadline, deadline) || other.deadline == deadline)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,noticeId,title,status,ackRequired,audience,acknowledged,seen,notSeen,notOnJuvi,dismissed,lateCount,reminders,const DeepCollectionEquality().hash(sparkline),const DeepCollectionEquality().hash(groups),const DeepCollectionEquality().hash(lateAcks),const DeepCollectionEquality().hash(comments),addedLater,asOf,deadline,publishedAt]);

@override
String toString() {
  return 'NoticeReachData(noticeId: $noticeId, title: $title, status: $status, ackRequired: $ackRequired, audience: $audience, acknowledged: $acknowledged, seen: $seen, notSeen: $notSeen, notOnJuvi: $notOnJuvi, dismissed: $dismissed, lateCount: $lateCount, reminders: $reminders, sparkline: $sparkline, groups: $groups, lateAcks: $lateAcks, comments: $comments, addedLater: $addedLater, asOf: $asOf, deadline: $deadline, publishedAt: $publishedAt)';
}


}

/// @nodoc
abstract mixin class $NoticeReachDataCopyWith<$Res>  {
  factory $NoticeReachDataCopyWith(NoticeReachData value, $Res Function(NoticeReachData) _then) = _$NoticeReachDataCopyWithImpl;
@useResult
$Res call({
 String noticeId, String title, String status, bool ackRequired, int audience, int acknowledged, int seen, int notSeen, int notOnJuvi, int dismissed,@JsonKey(name: 'late') int lateCount, Reminders reminders, List<int> sparkline, List<ReachGroup> groups, List<ReachPerson> lateAcks, List<ReachComment> comments, ReachAddedLater addedLater, DateTime asOf, DateTime? deadline, DateTime? publishedAt
});


$RemindersCopyWith<$Res> get reminders;$ReachAddedLaterCopyWith<$Res> get addedLater;

}
/// @nodoc
class _$NoticeReachDataCopyWithImpl<$Res>
    implements $NoticeReachDataCopyWith<$Res> {
  _$NoticeReachDataCopyWithImpl(this._self, this._then);

  final NoticeReachData _self;
  final $Res Function(NoticeReachData) _then;

/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? noticeId = null,Object? title = null,Object? status = null,Object? ackRequired = null,Object? audience = null,Object? acknowledged = null,Object? seen = null,Object? notSeen = null,Object? notOnJuvi = null,Object? dismissed = null,Object? lateCount = null,Object? reminders = null,Object? sparkline = null,Object? groups = null,Object? lateAcks = null,Object? comments = null,Object? addedLater = null,Object? asOf = null,Object? deadline = freezed,Object? publishedAt = freezed,}) {
  return _then(NoticeReachData(
noticeId: null == noticeId ? _self.noticeId : noticeId // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,ackRequired: null == ackRequired ? _self.ackRequired : ackRequired // ignore: cast_nullable_to_non_nullable
as bool,audience: null == audience ? _self.audience : audience // ignore: cast_nullable_to_non_nullable
as int,acknowledged: null == acknowledged ? _self.acknowledged : acknowledged // ignore: cast_nullable_to_non_nullable
as int,seen: null == seen ? _self.seen : seen // ignore: cast_nullable_to_non_nullable
as int,notSeen: null == notSeen ? _self.notSeen : notSeen // ignore: cast_nullable_to_non_nullable
as int,notOnJuvi: null == notOnJuvi ? _self.notOnJuvi : notOnJuvi // ignore: cast_nullable_to_non_nullable
as int,dismissed: null == dismissed ? _self.dismissed : dismissed // ignore: cast_nullable_to_non_nullable
as int,lateCount: null == lateCount ? _self.lateCount : lateCount // ignore: cast_nullable_to_non_nullable
as int,reminders: null == reminders ? _self.reminders : reminders // ignore: cast_nullable_to_non_nullable
as Reminders,sparkline: null == sparkline ? _self.sparkline : sparkline // ignore: cast_nullable_to_non_nullable
as List<int>,groups: null == groups ? _self.groups : groups // ignore: cast_nullable_to_non_nullable
as List<ReachGroup>,lateAcks: null == lateAcks ? _self.lateAcks : lateAcks // ignore: cast_nullable_to_non_nullable
as List<ReachPerson>,comments: null == comments ? _self.comments : comments // ignore: cast_nullable_to_non_nullable
as List<ReachComment>,addedLater: null == addedLater ? _self.addedLater : addedLater // ignore: cast_nullable_to_non_nullable
as ReachAddedLater,asOf: null == asOf ? _self.asOf : asOf // ignore: cast_nullable_to_non_nullable
as DateTime,deadline: freezed == deadline ? _self.deadline : deadline // ignore: cast_nullable_to_non_nullable
as DateTime?,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}
/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RemindersCopyWith<$Res> get reminders {
  
  return $RemindersCopyWith<$Res>(_self.reminders, (value) {
    return _then(_self.copyWith(reminders: value));
  });
}/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ReachAddedLaterCopyWith<$Res> get addedLater {
  
  return $ReachAddedLaterCopyWith<$Res>(_self.addedLater, (value) {
    return _then(_self.copyWith(addedLater: value));
  });
}
}


/// Adds pattern-matching-related methods to [NoticeReachData].
extension NoticeReachDataPatterns on NoticeReachData {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NoticeReachData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NoticeReachData() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NoticeReachData value)  $default,){
final _that = this;
switch (_that) {
case _NoticeReachData():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NoticeReachData value)?  $default,){
final _that = this;
switch (_that) {
case _NoticeReachData() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String noticeId,  String title,  String status,  bool ackRequired,  int audience,  int acknowledged,  int seen,  int notSeen,  int notOnJuvi,  int dismissed, @JsonKey(name: 'late')  int lateCount,  Reminders reminders,  List<int> sparkline,  List<ReachGroup> groups,  List<ReachPerson> lateAcks,  List<ReachComment> comments,  ReachAddedLater addedLater,  DateTime asOf,  DateTime? deadline,  DateTime? publishedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NoticeReachData() when $default != null:
return $default(_that.noticeId,_that.title,_that.status,_that.ackRequired,_that.audience,_that.acknowledged,_that.seen,_that.notSeen,_that.notOnJuvi,_that.dismissed,_that.lateCount,_that.reminders,_that.sparkline,_that.groups,_that.lateAcks,_that.comments,_that.addedLater,_that.asOf,_that.deadline,_that.publishedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String noticeId,  String title,  String status,  bool ackRequired,  int audience,  int acknowledged,  int seen,  int notSeen,  int notOnJuvi,  int dismissed, @JsonKey(name: 'late')  int lateCount,  Reminders reminders,  List<int> sparkline,  List<ReachGroup> groups,  List<ReachPerson> lateAcks,  List<ReachComment> comments,  ReachAddedLater addedLater,  DateTime asOf,  DateTime? deadline,  DateTime? publishedAt)  $default,) {final _that = this;
switch (_that) {
case _NoticeReachData():
return $default(_that.noticeId,_that.title,_that.status,_that.ackRequired,_that.audience,_that.acknowledged,_that.seen,_that.notSeen,_that.notOnJuvi,_that.dismissed,_that.lateCount,_that.reminders,_that.sparkline,_that.groups,_that.lateAcks,_that.comments,_that.addedLater,_that.asOf,_that.deadline,_that.publishedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String noticeId,  String title,  String status,  bool ackRequired,  int audience,  int acknowledged,  int seen,  int notSeen,  int notOnJuvi,  int dismissed, @JsonKey(name: 'late')  int lateCount,  Reminders reminders,  List<int> sparkline,  List<ReachGroup> groups,  List<ReachPerson> lateAcks,  List<ReachComment> comments,  ReachAddedLater addedLater,  DateTime asOf,  DateTime? deadline,  DateTime? publishedAt)?  $default,) {final _that = this;
switch (_that) {
case _NoticeReachData() when $default != null:
return $default(_that.noticeId,_that.title,_that.status,_that.ackRequired,_that.audience,_that.acknowledged,_that.seen,_that.notSeen,_that.notOnJuvi,_that.dismissed,_that.lateCount,_that.reminders,_that.sparkline,_that.groups,_that.lateAcks,_that.comments,_that.addedLater,_that.asOf,_that.deadline,_that.publishedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NoticeReachData implements NoticeReachData {
  const _NoticeReachData({required this.noticeId, required this.title, required this.status, required this.ackRequired, required this.audience, required this.acknowledged, required this.seen, required this.notSeen, required this.notOnJuvi, required this.dismissed, @JsonKey(name: 'late') required this.lateCount, required this.reminders, required  List<int> sparkline, required  List<ReachGroup> groups, required  List<ReachPerson> lateAcks, required  List<ReachComment> comments, required this.addedLater, required this.asOf, this.deadline, this.publishedAt}): _sparkline = sparkline,_groups = groups,_lateAcks = lateAcks,_comments = comments;
  factory _NoticeReachData.fromJson(Map<String, dynamic> json) => _$NoticeReachDataFromJson(json);

@override final  String noticeId;
@override final  String title;
@override final  String status;
@override final  bool ackRequired;
@override final  int audience;
@override final  int acknowledged;
@override final  int seen;
@override final  int notSeen;
@override final  int notOnJuvi;
@override final  int dismissed;
@override@JsonKey(name: 'late') final  int lateCount;
@override final  Reminders reminders;
 final  List<int> _sparkline;
@override List<int> get sparkline {
  if (_sparkline is EqualUnmodifiableListView) return _sparkline;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_sparkline);
}

 final  List<ReachGroup> _groups;
@override List<ReachGroup> get groups {
  if (_groups is EqualUnmodifiableListView) return _groups;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_groups);
}

 final  List<ReachPerson> _lateAcks;
@override List<ReachPerson> get lateAcks {
  if (_lateAcks is EqualUnmodifiableListView) return _lateAcks;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_lateAcks);
}

 final  List<ReachComment> _comments;
@override List<ReachComment> get comments {
  if (_comments is EqualUnmodifiableListView) return _comments;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_comments);
}

@override final  ReachAddedLater addedLater;
@override final  DateTime asOf;
@override final  DateTime? deadline;
@override final  DateTime? publishedAt;

/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NoticeReachDataCopyWith<_NoticeReachData> get copyWith => __$NoticeReachDataCopyWithImpl<_NoticeReachData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NoticeReachDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NoticeReachData&&(identical(other.noticeId, noticeId) || other.noticeId == noticeId)&&(identical(other.title, title) || other.title == title)&&(identical(other.status, status) || other.status == status)&&(identical(other.ackRequired, ackRequired) || other.ackRequired == ackRequired)&&(identical(other.audience, audience) || other.audience == audience)&&(identical(other.acknowledged, acknowledged) || other.acknowledged == acknowledged)&&(identical(other.seen, seen) || other.seen == seen)&&(identical(other.notSeen, notSeen) || other.notSeen == notSeen)&&(identical(other.notOnJuvi, notOnJuvi) || other.notOnJuvi == notOnJuvi)&&(identical(other.dismissed, dismissed) || other.dismissed == dismissed)&&(identical(other.lateCount, lateCount) || other.lateCount == lateCount)&&(identical(other.reminders, reminders) || other.reminders == reminders)&&const DeepCollectionEquality().equals(other._sparkline, _sparkline)&&const DeepCollectionEquality().equals(other._groups, _groups)&&const DeepCollectionEquality().equals(other._lateAcks, _lateAcks)&&const DeepCollectionEquality().equals(other._comments, _comments)&&(identical(other.addedLater, addedLater) || other.addedLater == addedLater)&&(identical(other.asOf, asOf) || other.asOf == asOf)&&(identical(other.deadline, deadline) || other.deadline == deadline)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,noticeId,title,status,ackRequired,audience,acknowledged,seen,notSeen,notOnJuvi,dismissed,lateCount,reminders,const DeepCollectionEquality().hash(_sparkline),const DeepCollectionEquality().hash(_groups),const DeepCollectionEquality().hash(_lateAcks),const DeepCollectionEquality().hash(_comments),addedLater,asOf,deadline,publishedAt]);

@override
String toString() {
  return 'NoticeReachData(noticeId: $noticeId, title: $title, status: $status, ackRequired: $ackRequired, audience: $audience, acknowledged: $acknowledged, seen: $seen, notSeen: $notSeen, notOnJuvi: $notOnJuvi, dismissed: $dismissed, lateCount: $lateCount, reminders: $reminders, sparkline: $sparkline, groups: $groups, lateAcks: $lateAcks, comments: $comments, addedLater: $addedLater, asOf: $asOf, deadline: $deadline, publishedAt: $publishedAt)';
}


}

/// @nodoc
abstract mixin class _$NoticeReachDataCopyWith<$Res> implements $NoticeReachDataCopyWith<$Res> {
  factory _$NoticeReachDataCopyWith(_NoticeReachData value, $Res Function(_NoticeReachData) _then) = __$NoticeReachDataCopyWithImpl;
@override @useResult
$Res call({
 String noticeId, String title, String status, bool ackRequired, int audience, int acknowledged, int seen, int notSeen, int notOnJuvi, int dismissed,@JsonKey(name: 'late') int lateCount, Reminders reminders, List<int> sparkline, List<ReachGroup> groups, List<ReachPerson> lateAcks, List<ReachComment> comments, ReachAddedLater addedLater, DateTime asOf, DateTime? deadline, DateTime? publishedAt
});


@override $RemindersCopyWith<$Res> get reminders;@override $ReachAddedLaterCopyWith<$Res> get addedLater;

}
/// @nodoc
class __$NoticeReachDataCopyWithImpl<$Res>
    implements _$NoticeReachDataCopyWith<$Res> {
  __$NoticeReachDataCopyWithImpl(this._self, this._then);

  final _NoticeReachData _self;
  final $Res Function(_NoticeReachData) _then;

/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? noticeId = null,Object? title = null,Object? status = null,Object? ackRequired = null,Object? audience = null,Object? acknowledged = null,Object? seen = null,Object? notSeen = null,Object? notOnJuvi = null,Object? dismissed = null,Object? lateCount = null,Object? reminders = null,Object? sparkline = null,Object? groups = null,Object? lateAcks = null,Object? comments = null,Object? addedLater = null,Object? asOf = null,Object? deadline = freezed,Object? publishedAt = freezed,}) {
  return _then(_NoticeReachData(
noticeId: null == noticeId ? _self.noticeId : noticeId // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,ackRequired: null == ackRequired ? _self.ackRequired : ackRequired // ignore: cast_nullable_to_non_nullable
as bool,audience: null == audience ? _self.audience : audience // ignore: cast_nullable_to_non_nullable
as int,acknowledged: null == acknowledged ? _self.acknowledged : acknowledged // ignore: cast_nullable_to_non_nullable
as int,seen: null == seen ? _self.seen : seen // ignore: cast_nullable_to_non_nullable
as int,notSeen: null == notSeen ? _self.notSeen : notSeen // ignore: cast_nullable_to_non_nullable
as int,notOnJuvi: null == notOnJuvi ? _self.notOnJuvi : notOnJuvi // ignore: cast_nullable_to_non_nullable
as int,dismissed: null == dismissed ? _self.dismissed : dismissed // ignore: cast_nullable_to_non_nullable
as int,lateCount: null == lateCount ? _self.lateCount : lateCount // ignore: cast_nullable_to_non_nullable
as int,reminders: null == reminders ? _self.reminders : reminders // ignore: cast_nullable_to_non_nullable
as Reminders,sparkline: null == sparkline ? _self._sparkline : sparkline // ignore: cast_nullable_to_non_nullable
as List<int>,groups: null == groups ? _self._groups : groups // ignore: cast_nullable_to_non_nullable
as List<ReachGroup>,lateAcks: null == lateAcks ? _self._lateAcks : lateAcks // ignore: cast_nullable_to_non_nullable
as List<ReachPerson>,comments: null == comments ? _self._comments : comments // ignore: cast_nullable_to_non_nullable
as List<ReachComment>,addedLater: null == addedLater ? _self.addedLater : addedLater // ignore: cast_nullable_to_non_nullable
as ReachAddedLater,asOf: null == asOf ? _self.asOf : asOf // ignore: cast_nullable_to_non_nullable
as DateTime,deadline: freezed == deadline ? _self.deadline : deadline // ignore: cast_nullable_to_non_nullable
as DateTime?,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RemindersCopyWith<$Res> get reminders {
  
  return $RemindersCopyWith<$Res>(_self.reminders, (value) {
    return _then(_self.copyWith(reminders: value));
  });
}/// Create a copy of NoticeReachData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ReachAddedLaterCopyWith<$Res> get addedLater {
  
  return $ReachAddedLaterCopyWith<$Res>(_self.addedLater, (value) {
    return _then(_self.copyWith(addedLater: value));
  });
}
}


/// @nodoc
mixin _$PendingPerson {

 String get name; String get group; String get state; String? get identifier; DateTime? get lastSeenInApp;
/// Create a copy of PendingPerson
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PendingPersonCopyWith<PendingPerson> get copyWith => _$PendingPersonCopyWithImpl<PendingPerson>(this as PendingPerson, _$identity);

  /// Serializes this PendingPerson to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PendingPerson&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.state, state) || other.state == state)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.lastSeenInApp, lastSeenInApp) || other.lastSeenInApp == lastSeenInApp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,state,identifier,lastSeenInApp);

@override
String toString() {
  return 'PendingPerson(name: $name, group: $group, state: $state, identifier: $identifier, lastSeenInApp: $lastSeenInApp)';
}


}

/// @nodoc
abstract mixin class $PendingPersonCopyWith<$Res>  {
  factory $PendingPersonCopyWith(PendingPerson value, $Res Function(PendingPerson) _then) = _$PendingPersonCopyWithImpl;
@useResult
$Res call({
 String name, String group, String state, String? identifier, DateTime? lastSeenInApp
});




}
/// @nodoc
class _$PendingPersonCopyWithImpl<$Res>
    implements $PendingPersonCopyWith<$Res> {
  _$PendingPersonCopyWithImpl(this._self, this._then);

  final PendingPerson _self;
  final $Res Function(PendingPerson) _then;

/// Create a copy of PendingPerson
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? group = null,Object? state = null,Object? identifier = freezed,Object? lastSeenInApp = freezed,}) {
  return _then(PendingPerson(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,lastSeenInApp: freezed == lastSeenInApp ? _self.lastSeenInApp : lastSeenInApp // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [PendingPerson].
extension PendingPersonPatterns on PendingPerson {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PendingPerson value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PendingPerson() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PendingPerson value)  $default,){
final _that = this;
switch (_that) {
case _PendingPerson():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PendingPerson value)?  $default,){
final _that = this;
switch (_that) {
case _PendingPerson() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String group,  String state,  String? identifier,  DateTime? lastSeenInApp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PendingPerson() when $default != null:
return $default(_that.name,_that.group,_that.state,_that.identifier,_that.lastSeenInApp);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String group,  String state,  String? identifier,  DateTime? lastSeenInApp)  $default,) {final _that = this;
switch (_that) {
case _PendingPerson():
return $default(_that.name,_that.group,_that.state,_that.identifier,_that.lastSeenInApp);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String group,  String state,  String? identifier,  DateTime? lastSeenInApp)?  $default,) {final _that = this;
switch (_that) {
case _PendingPerson() when $default != null:
return $default(_that.name,_that.group,_that.state,_that.identifier,_that.lastSeenInApp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PendingPerson implements PendingPerson {
  const _PendingPerson({required this.name, required this.group, required this.state, this.identifier, this.lastSeenInApp});
  factory _PendingPerson.fromJson(Map<String, dynamic> json) => _$PendingPersonFromJson(json);

@override final  String name;
@override final  String group;
@override final  String state;
@override final  String? identifier;
@override final  DateTime? lastSeenInApp;

/// Create a copy of PendingPerson
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PendingPersonCopyWith<_PendingPerson> get copyWith => __$PendingPersonCopyWithImpl<_PendingPerson>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PendingPersonToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PendingPerson&&(identical(other.name, name) || other.name == name)&&(identical(other.group, group) || other.group == group)&&(identical(other.state, state) || other.state == state)&&(identical(other.identifier, identifier) || other.identifier == identifier)&&(identical(other.lastSeenInApp, lastSeenInApp) || other.lastSeenInApp == lastSeenInApp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,group,state,identifier,lastSeenInApp);

@override
String toString() {
  return 'PendingPerson(name: $name, group: $group, state: $state, identifier: $identifier, lastSeenInApp: $lastSeenInApp)';
}


}

/// @nodoc
abstract mixin class _$PendingPersonCopyWith<$Res> implements $PendingPersonCopyWith<$Res> {
  factory _$PendingPersonCopyWith(_PendingPerson value, $Res Function(_PendingPerson) _then) = __$PendingPersonCopyWithImpl;
@override @useResult
$Res call({
 String name, String group, String state, String? identifier, DateTime? lastSeenInApp
});




}
/// @nodoc
class __$PendingPersonCopyWithImpl<$Res>
    implements _$PendingPersonCopyWith<$Res> {
  __$PendingPersonCopyWithImpl(this._self, this._then);

  final _PendingPerson _self;
  final $Res Function(_PendingPerson) _then;

/// Create a copy of PendingPerson
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? group = null,Object? state = null,Object? identifier = freezed,Object? lastSeenInApp = freezed,}) {
  return _then(_PendingPerson(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,identifier: freezed == identifier ? _self.identifier : identifier // ignore: cast_nullable_to_non_nullable
as String?,lastSeenInApp: freezed == lastSeenInApp ? _self.lastSeenInApp : lastSeenInApp // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$PendingGroup {

 String get label; int get count;
/// Create a copy of PendingGroup
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PendingGroupCopyWith<PendingGroup> get copyWith => _$PendingGroupCopyWithImpl<PendingGroup>(this as PendingGroup, _$identity);

  /// Serializes this PendingGroup to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PendingGroup&&(identical(other.label, label) || other.label == label)&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,label,count);

@override
String toString() {
  return 'PendingGroup(label: $label, count: $count)';
}


}

/// @nodoc
abstract mixin class $PendingGroupCopyWith<$Res>  {
  factory $PendingGroupCopyWith(PendingGroup value, $Res Function(PendingGroup) _then) = _$PendingGroupCopyWithImpl;
@useResult
$Res call({
 String label, int count
});




}
/// @nodoc
class _$PendingGroupCopyWithImpl<$Res>
    implements $PendingGroupCopyWith<$Res> {
  _$PendingGroupCopyWithImpl(this._self, this._then);

  final PendingGroup _self;
  final $Res Function(PendingGroup) _then;

/// Create a copy of PendingGroup
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? label = null,Object? count = null,}) {
  return _then(PendingGroup(
label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [PendingGroup].
extension PendingGroupPatterns on PendingGroup {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PendingGroup value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PendingGroup() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PendingGroup value)  $default,){
final _that = this;
switch (_that) {
case _PendingGroup():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PendingGroup value)?  $default,){
final _that = this;
switch (_that) {
case _PendingGroup() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String label,  int count)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PendingGroup() when $default != null:
return $default(_that.label,_that.count);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String label,  int count)  $default,) {final _that = this;
switch (_that) {
case _PendingGroup():
return $default(_that.label,_that.count);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String label,  int count)?  $default,) {final _that = this;
switch (_that) {
case _PendingGroup() when $default != null:
return $default(_that.label,_that.count);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PendingGroup implements PendingGroup {
  const _PendingGroup({required this.label, required this.count});
  factory _PendingGroup.fromJson(Map<String, dynamic> json) => _$PendingGroupFromJson(json);

@override final  String label;
@override final  int count;

/// Create a copy of PendingGroup
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PendingGroupCopyWith<_PendingGroup> get copyWith => __$PendingGroupCopyWithImpl<_PendingGroup>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PendingGroupToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PendingGroup&&(identical(other.label, label) || other.label == label)&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,label,count);

@override
String toString() {
  return 'PendingGroup(label: $label, count: $count)';
}


}

/// @nodoc
abstract mixin class _$PendingGroupCopyWith<$Res> implements $PendingGroupCopyWith<$Res> {
  factory _$PendingGroupCopyWith(_PendingGroup value, $Res Function(_PendingGroup) _then) = __$PendingGroupCopyWithImpl;
@override @useResult
$Res call({
 String label, int count
});




}
/// @nodoc
class __$PendingGroupCopyWithImpl<$Res>
    implements _$PendingGroupCopyWith<$Res> {
  __$PendingGroupCopyWithImpl(this._self, this._then);

  final _PendingGroup _self;
  final $Res Function(_PendingGroup) _then;

/// Create a copy of PendingGroup
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? label = null,Object? count = null,}) {
  return _then(_PendingGroup(
label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$PendingPage {

 List<PendingPerson> get items; int get total; List<PendingGroup> get groups; String? get nextCursor;
/// Create a copy of PendingPage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PendingPageCopyWith<PendingPage> get copyWith => _$PendingPageCopyWithImpl<PendingPage>(this as PendingPage, _$identity);

  /// Serializes this PendingPage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PendingPage&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.total, total) || other.total == total)&&const DeepCollectionEquality().equals(other.groups, groups)&&(identical(other.nextCursor, nextCursor) || other.nextCursor == nextCursor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(items),total,const DeepCollectionEquality().hash(groups),nextCursor);

@override
String toString() {
  return 'PendingPage(items: $items, total: $total, groups: $groups, nextCursor: $nextCursor)';
}


}

/// @nodoc
abstract mixin class $PendingPageCopyWith<$Res>  {
  factory $PendingPageCopyWith(PendingPage value, $Res Function(PendingPage) _then) = _$PendingPageCopyWithImpl;
@useResult
$Res call({
 List<PendingPerson> items, int total, List<PendingGroup> groups, String? nextCursor
});




}
/// @nodoc
class _$PendingPageCopyWithImpl<$Res>
    implements $PendingPageCopyWith<$Res> {
  _$PendingPageCopyWithImpl(this._self, this._then);

  final PendingPage _self;
  final $Res Function(PendingPage) _then;

/// Create a copy of PendingPage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? total = null,Object? groups = null,Object? nextCursor = freezed,}) {
  return _then(PendingPage(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<PendingPerson>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,groups: null == groups ? _self.groups : groups // ignore: cast_nullable_to_non_nullable
as List<PendingGroup>,nextCursor: freezed == nextCursor ? _self.nextCursor : nextCursor // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PendingPage].
extension PendingPagePatterns on PendingPage {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PendingPage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PendingPage() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PendingPage value)  $default,){
final _that = this;
switch (_that) {
case _PendingPage():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PendingPage value)?  $default,){
final _that = this;
switch (_that) {
case _PendingPage() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PendingPerson> items,  int total,  List<PendingGroup> groups,  String? nextCursor)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PendingPage() when $default != null:
return $default(_that.items,_that.total,_that.groups,_that.nextCursor);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PendingPerson> items,  int total,  List<PendingGroup> groups,  String? nextCursor)  $default,) {final _that = this;
switch (_that) {
case _PendingPage():
return $default(_that.items,_that.total,_that.groups,_that.nextCursor);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PendingPerson> items,  int total,  List<PendingGroup> groups,  String? nextCursor)?  $default,) {final _that = this;
switch (_that) {
case _PendingPage() when $default != null:
return $default(_that.items,_that.total,_that.groups,_that.nextCursor);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PendingPage implements PendingPage {
  const _PendingPage({required  List<PendingPerson> items, required this.total, required  List<PendingGroup> groups, this.nextCursor}): _items = items,_groups = groups;
  factory _PendingPage.fromJson(Map<String, dynamic> json) => _$PendingPageFromJson(json);

 final  List<PendingPerson> _items;
@override List<PendingPerson> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  int total;
 final  List<PendingGroup> _groups;
@override List<PendingGroup> get groups {
  if (_groups is EqualUnmodifiableListView) return _groups;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_groups);
}

@override final  String? nextCursor;

/// Create a copy of PendingPage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PendingPageCopyWith<_PendingPage> get copyWith => __$PendingPageCopyWithImpl<_PendingPage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PendingPageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PendingPage&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.total, total) || other.total == total)&&const DeepCollectionEquality().equals(other._groups, _groups)&&(identical(other.nextCursor, nextCursor) || other.nextCursor == nextCursor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),total,const DeepCollectionEquality().hash(_groups),nextCursor);

@override
String toString() {
  return 'PendingPage(items: $items, total: $total, groups: $groups, nextCursor: $nextCursor)';
}


}

/// @nodoc
abstract mixin class _$PendingPageCopyWith<$Res> implements $PendingPageCopyWith<$Res> {
  factory _$PendingPageCopyWith(_PendingPage value, $Res Function(_PendingPage) _then) = __$PendingPageCopyWithImpl;
@override @useResult
$Res call({
 List<PendingPerson> items, int total, List<PendingGroup> groups, String? nextCursor
});




}
/// @nodoc
class __$PendingPageCopyWithImpl<$Res>
    implements _$PendingPageCopyWith<$Res> {
  __$PendingPageCopyWithImpl(this._self, this._then);

  final _PendingPage _self;
  final $Res Function(_PendingPage) _then;

/// Create a copy of PendingPage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? total = null,Object? groups = null,Object? nextCursor = freezed,}) {
  return _then(_PendingPage(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<PendingPerson>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,groups: null == groups ? _self._groups : groups // ignore: cast_nullable_to_non_nullable
as List<PendingGroup>,nextCursor: freezed == nextCursor ? _self.nextCursor : nextCursor // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
