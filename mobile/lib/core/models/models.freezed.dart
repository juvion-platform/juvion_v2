// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Tokens {

 String get accessToken; String get refreshToken;
/// Create a copy of Tokens
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TokensCopyWith<Tokens> get copyWith => _$TokensCopyWithImpl<Tokens>(this as Tokens, _$identity);

  /// Serializes this Tokens to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Tokens&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.refreshToken, refreshToken) || other.refreshToken == refreshToken));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,refreshToken);

@override
String toString() {
  return 'Tokens(accessToken: $accessToken, refreshToken: $refreshToken)';
}


}

/// @nodoc
abstract mixin class $TokensCopyWith<$Res>  {
  factory $TokensCopyWith(Tokens value, $Res Function(Tokens) _then) = _$TokensCopyWithImpl;
@useResult
$Res call({
 String accessToken, String refreshToken
});




}
/// @nodoc
class _$TokensCopyWithImpl<$Res>
    implements $TokensCopyWith<$Res> {
  _$TokensCopyWithImpl(this._self, this._then);

  final Tokens _self;
  final $Res Function(Tokens) _then;

/// Create a copy of Tokens
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? accessToken = null,Object? refreshToken = null,}) {
  return _then(Tokens(
accessToken: null == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String,refreshToken: null == refreshToken ? _self.refreshToken : refreshToken // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Tokens].
extension TokensPatterns on Tokens {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Tokens value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Tokens() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Tokens value)  $default,){
final _that = this;
switch (_that) {
case _Tokens():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Tokens value)?  $default,){
final _that = this;
switch (_that) {
case _Tokens() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String accessToken,  String refreshToken)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Tokens() when $default != null:
return $default(_that.accessToken,_that.refreshToken);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String accessToken,  String refreshToken)  $default,) {final _that = this;
switch (_that) {
case _Tokens():
return $default(_that.accessToken,_that.refreshToken);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String accessToken,  String refreshToken)?  $default,) {final _that = this;
switch (_that) {
case _Tokens() when $default != null:
return $default(_that.accessToken,_that.refreshToken);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Tokens implements Tokens {
  const _Tokens({required this.accessToken, required this.refreshToken});
  factory _Tokens.fromJson(Map<String, dynamic> json) => _$TokensFromJson(json);

@override final  String accessToken;
@override final  String refreshToken;

/// Create a copy of Tokens
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TokensCopyWith<_Tokens> get copyWith => __$TokensCopyWithImpl<_Tokens>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TokensToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Tokens&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.refreshToken, refreshToken) || other.refreshToken == refreshToken));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,refreshToken);

@override
String toString() {
  return 'Tokens(accessToken: $accessToken, refreshToken: $refreshToken)';
}


}

/// @nodoc
abstract mixin class _$TokensCopyWith<$Res> implements $TokensCopyWith<$Res> {
  factory _$TokensCopyWith(_Tokens value, $Res Function(_Tokens) _then) = __$TokensCopyWithImpl;
@override @useResult
$Res call({
 String accessToken, String refreshToken
});




}
/// @nodoc
class __$TokensCopyWithImpl<$Res>
    implements _$TokensCopyWith<$Res> {
  __$TokensCopyWithImpl(this._self, this._then);

  final _Tokens _self;
  final $Res Function(_Tokens) _then;

/// Create a copy of Tokens
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? accessToken = null,Object? refreshToken = null,}) {
  return _then(_Tokens(
accessToken: null == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String,refreshToken: null == refreshToken ? _self.refreshToken : refreshToken // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$SupportContact {

 String get name; String? get phone; String? get email;
/// Create a copy of SupportContact
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SupportContactCopyWith<SupportContact> get copyWith => _$SupportContactCopyWithImpl<SupportContact>(this as SupportContact, _$identity);

  /// Serializes this SupportContact to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SupportContact&&(identical(other.name, name) || other.name == name)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.email, email) || other.email == email));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,phone,email);

@override
String toString() {
  return 'SupportContact(name: $name, phone: $phone, email: $email)';
}


}

/// @nodoc
abstract mixin class $SupportContactCopyWith<$Res>  {
  factory $SupportContactCopyWith(SupportContact value, $Res Function(SupportContact) _then) = _$SupportContactCopyWithImpl;
@useResult
$Res call({
 String name, String? phone, String? email
});




}
/// @nodoc
class _$SupportContactCopyWithImpl<$Res>
    implements $SupportContactCopyWith<$Res> {
  _$SupportContactCopyWithImpl(this._self, this._then);

  final SupportContact _self;
  final $Res Function(SupportContact) _then;

/// Create a copy of SupportContact
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? phone = freezed,Object? email = freezed,}) {
  return _then(SupportContact(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SupportContact].
extension SupportContactPatterns on SupportContact {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SupportContact value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SupportContact() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SupportContact value)  $default,){
final _that = this;
switch (_that) {
case _SupportContact():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SupportContact value)?  $default,){
final _that = this;
switch (_that) {
case _SupportContact() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String? phone,  String? email)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SupportContact() when $default != null:
return $default(_that.name,_that.phone,_that.email);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String? phone,  String? email)  $default,) {final _that = this;
switch (_that) {
case _SupportContact():
return $default(_that.name,_that.phone,_that.email);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String? phone,  String? email)?  $default,) {final _that = this;
switch (_that) {
case _SupportContact() when $default != null:
return $default(_that.name,_that.phone,_that.email);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SupportContact implements SupportContact {
  const _SupportContact({required this.name, this.phone, this.email});
  factory _SupportContact.fromJson(Map<String, dynamic> json) => _$SupportContactFromJson(json);

@override final  String name;
@override final  String? phone;
@override final  String? email;

/// Create a copy of SupportContact
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SupportContactCopyWith<_SupportContact> get copyWith => __$SupportContactCopyWithImpl<_SupportContact>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SupportContactToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SupportContact&&(identical(other.name, name) || other.name == name)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.email, email) || other.email == email));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,phone,email);

@override
String toString() {
  return 'SupportContact(name: $name, phone: $phone, email: $email)';
}


}

/// @nodoc
abstract mixin class _$SupportContactCopyWith<$Res> implements $SupportContactCopyWith<$Res> {
  factory _$SupportContactCopyWith(_SupportContact value, $Res Function(_SupportContact) _then) = __$SupportContactCopyWithImpl;
@override @useResult
$Res call({
 String name, String? phone, String? email
});




}
/// @nodoc
class __$SupportContactCopyWithImpl<$Res>
    implements _$SupportContactCopyWith<$Res> {
  __$SupportContactCopyWithImpl(this._self, this._then);

  final _SupportContact _self;
  final $Res Function(_SupportContact) _then;

/// Create a copy of SupportContact
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? phone = freezed,Object? email = freezed,}) {
  return _then(_SupportContact(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$AccountSummary {

 String get id; String get kind; String get status; int get onboardingStep; List<String> get onboardingSteps; bool get onboardingComplete; bool get mustChangePassword;
/// Create a copy of AccountSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AccountSummaryCopyWith<AccountSummary> get copyWith => _$AccountSummaryCopyWithImpl<AccountSummary>(this as AccountSummary, _$identity);

  /// Serializes this AccountSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AccountSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.status, status) || other.status == status)&&(identical(other.onboardingStep, onboardingStep) || other.onboardingStep == onboardingStep)&&const DeepCollectionEquality().equals(other.onboardingSteps, onboardingSteps)&&(identical(other.onboardingComplete, onboardingComplete) || other.onboardingComplete == onboardingComplete)&&(identical(other.mustChangePassword, mustChangePassword) || other.mustChangePassword == mustChangePassword));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,status,onboardingStep,const DeepCollectionEquality().hash(onboardingSteps),onboardingComplete,mustChangePassword);

@override
String toString() {
  return 'AccountSummary(id: $id, kind: $kind, status: $status, onboardingStep: $onboardingStep, onboardingSteps: $onboardingSteps, onboardingComplete: $onboardingComplete, mustChangePassword: $mustChangePassword)';
}


}

/// @nodoc
abstract mixin class $AccountSummaryCopyWith<$Res>  {
  factory $AccountSummaryCopyWith(AccountSummary value, $Res Function(AccountSummary) _then) = _$AccountSummaryCopyWithImpl;
@useResult
$Res call({
 String id, String kind, String status, int onboardingStep, List<String> onboardingSteps, bool onboardingComplete, bool mustChangePassword
});




}
/// @nodoc
class _$AccountSummaryCopyWithImpl<$Res>
    implements $AccountSummaryCopyWith<$Res> {
  _$AccountSummaryCopyWithImpl(this._self, this._then);

  final AccountSummary _self;
  final $Res Function(AccountSummary) _then;

/// Create a copy of AccountSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? status = null,Object? onboardingStep = null,Object? onboardingSteps = null,Object? onboardingComplete = null,Object? mustChangePassword = null,}) {
  return _then(AccountSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,onboardingStep: null == onboardingStep ? _self.onboardingStep : onboardingStep // ignore: cast_nullable_to_non_nullable
as int,onboardingSteps: null == onboardingSteps ? _self.onboardingSteps : onboardingSteps // ignore: cast_nullable_to_non_nullable
as List<String>,onboardingComplete: null == onboardingComplete ? _self.onboardingComplete : onboardingComplete // ignore: cast_nullable_to_non_nullable
as bool,mustChangePassword: null == mustChangePassword ? _self.mustChangePassword : mustChangePassword // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [AccountSummary].
extension AccountSummaryPatterns on AccountSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AccountSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AccountSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AccountSummary value)  $default,){
final _that = this;
switch (_that) {
case _AccountSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AccountSummary value)?  $default,){
final _that = this;
switch (_that) {
case _AccountSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String kind,  String status,  int onboardingStep,  List<String> onboardingSteps,  bool onboardingComplete,  bool mustChangePassword)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AccountSummary() when $default != null:
return $default(_that.id,_that.kind,_that.status,_that.onboardingStep,_that.onboardingSteps,_that.onboardingComplete,_that.mustChangePassword);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String kind,  String status,  int onboardingStep,  List<String> onboardingSteps,  bool onboardingComplete,  bool mustChangePassword)  $default,) {final _that = this;
switch (_that) {
case _AccountSummary():
return $default(_that.id,_that.kind,_that.status,_that.onboardingStep,_that.onboardingSteps,_that.onboardingComplete,_that.mustChangePassword);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String kind,  String status,  int onboardingStep,  List<String> onboardingSteps,  bool onboardingComplete,  bool mustChangePassword)?  $default,) {final _that = this;
switch (_that) {
case _AccountSummary() when $default != null:
return $default(_that.id,_that.kind,_that.status,_that.onboardingStep,_that.onboardingSteps,_that.onboardingComplete,_that.mustChangePassword);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AccountSummary implements AccountSummary {
  const _AccountSummary({required this.id, required this.kind, required this.status, required this.onboardingStep, required  List<String> onboardingSteps, required this.onboardingComplete, required this.mustChangePassword}): _onboardingSteps = onboardingSteps;
  factory _AccountSummary.fromJson(Map<String, dynamic> json) => _$AccountSummaryFromJson(json);

@override final  String id;
@override final  String kind;
@override final  String status;
@override final  int onboardingStep;
 final  List<String> _onboardingSteps;
@override List<String> get onboardingSteps {
  if (_onboardingSteps is EqualUnmodifiableListView) return _onboardingSteps;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_onboardingSteps);
}

@override final  bool onboardingComplete;
@override final  bool mustChangePassword;

/// Create a copy of AccountSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AccountSummaryCopyWith<_AccountSummary> get copyWith => __$AccountSummaryCopyWithImpl<_AccountSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AccountSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AccountSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.status, status) || other.status == status)&&(identical(other.onboardingStep, onboardingStep) || other.onboardingStep == onboardingStep)&&const DeepCollectionEquality().equals(other._onboardingSteps, _onboardingSteps)&&(identical(other.onboardingComplete, onboardingComplete) || other.onboardingComplete == onboardingComplete)&&(identical(other.mustChangePassword, mustChangePassword) || other.mustChangePassword == mustChangePassword));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,status,onboardingStep,const DeepCollectionEquality().hash(_onboardingSteps),onboardingComplete,mustChangePassword);

@override
String toString() {
  return 'AccountSummary(id: $id, kind: $kind, status: $status, onboardingStep: $onboardingStep, onboardingSteps: $onboardingSteps, onboardingComplete: $onboardingComplete, mustChangePassword: $mustChangePassword)';
}


}

/// @nodoc
abstract mixin class _$AccountSummaryCopyWith<$Res> implements $AccountSummaryCopyWith<$Res> {
  factory _$AccountSummaryCopyWith(_AccountSummary value, $Res Function(_AccountSummary) _then) = __$AccountSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String kind, String status, int onboardingStep, List<String> onboardingSteps, bool onboardingComplete, bool mustChangePassword
});




}
/// @nodoc
class __$AccountSummaryCopyWithImpl<$Res>
    implements _$AccountSummaryCopyWith<$Res> {
  __$AccountSummaryCopyWithImpl(this._self, this._then);

  final _AccountSummary _self;
  final $Res Function(_AccountSummary) _then;

/// Create a copy of AccountSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? status = null,Object? onboardingStep = null,Object? onboardingSteps = null,Object? onboardingComplete = null,Object? mustChangePassword = null,}) {
  return _then(_AccountSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,onboardingStep: null == onboardingStep ? _self.onboardingStep : onboardingStep // ignore: cast_nullable_to_non_nullable
as int,onboardingSteps: null == onboardingSteps ? _self._onboardingSteps : onboardingSteps // ignore: cast_nullable_to_non_nullable
as List<String>,onboardingComplete: null == onboardingComplete ? _self.onboardingComplete : onboardingComplete // ignore: cast_nullable_to_non_nullable
as bool,mustChangePassword: null == mustChangePassword ? _self.mustChangePassword : mustChangePassword // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$InstitutionIdentity {

 String get collegeId; String get name; bool get paused; String? get logoUrl; String? get accentColor; String? get pausedMessage;
/// Create a copy of InstitutionIdentity
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InstitutionIdentityCopyWith<InstitutionIdentity> get copyWith => _$InstitutionIdentityCopyWithImpl<InstitutionIdentity>(this as InstitutionIdentity, _$identity);

  /// Serializes this InstitutionIdentity to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InstitutionIdentity&&(identical(other.collegeId, collegeId) || other.collegeId == collegeId)&&(identical(other.name, name) || other.name == name)&&(identical(other.paused, paused) || other.paused == paused)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.accentColor, accentColor) || other.accentColor == accentColor)&&(identical(other.pausedMessage, pausedMessage) || other.pausedMessage == pausedMessage));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,collegeId,name,paused,logoUrl,accentColor,pausedMessage);

@override
String toString() {
  return 'InstitutionIdentity(collegeId: $collegeId, name: $name, paused: $paused, logoUrl: $logoUrl, accentColor: $accentColor, pausedMessage: $pausedMessage)';
}


}

/// @nodoc
abstract mixin class $InstitutionIdentityCopyWith<$Res>  {
  factory $InstitutionIdentityCopyWith(InstitutionIdentity value, $Res Function(InstitutionIdentity) _then) = _$InstitutionIdentityCopyWithImpl;
@useResult
$Res call({
 String collegeId, String name, bool paused, String? logoUrl, String? accentColor, String? pausedMessage
});




}
/// @nodoc
class _$InstitutionIdentityCopyWithImpl<$Res>
    implements $InstitutionIdentityCopyWith<$Res> {
  _$InstitutionIdentityCopyWithImpl(this._self, this._then);

  final InstitutionIdentity _self;
  final $Res Function(InstitutionIdentity) _then;

/// Create a copy of InstitutionIdentity
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? collegeId = null,Object? name = null,Object? paused = null,Object? logoUrl = freezed,Object? accentColor = freezed,Object? pausedMessage = freezed,}) {
  return _then(InstitutionIdentity(
collegeId: null == collegeId ? _self.collegeId : collegeId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,paused: null == paused ? _self.paused : paused // ignore: cast_nullable_to_non_nullable
as bool,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,accentColor: freezed == accentColor ? _self.accentColor : accentColor // ignore: cast_nullable_to_non_nullable
as String?,pausedMessage: freezed == pausedMessage ? _self.pausedMessage : pausedMessage // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [InstitutionIdentity].
extension InstitutionIdentityPatterns on InstitutionIdentity {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InstitutionIdentity value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InstitutionIdentity() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InstitutionIdentity value)  $default,){
final _that = this;
switch (_that) {
case _InstitutionIdentity():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InstitutionIdentity value)?  $default,){
final _that = this;
switch (_that) {
case _InstitutionIdentity() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String collegeId,  String name,  bool paused,  String? logoUrl,  String? accentColor,  String? pausedMessage)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InstitutionIdentity() when $default != null:
return $default(_that.collegeId,_that.name,_that.paused,_that.logoUrl,_that.accentColor,_that.pausedMessage);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String collegeId,  String name,  bool paused,  String? logoUrl,  String? accentColor,  String? pausedMessage)  $default,) {final _that = this;
switch (_that) {
case _InstitutionIdentity():
return $default(_that.collegeId,_that.name,_that.paused,_that.logoUrl,_that.accentColor,_that.pausedMessage);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String collegeId,  String name,  bool paused,  String? logoUrl,  String? accentColor,  String? pausedMessage)?  $default,) {final _that = this;
switch (_that) {
case _InstitutionIdentity() when $default != null:
return $default(_that.collegeId,_that.name,_that.paused,_that.logoUrl,_that.accentColor,_that.pausedMessage);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InstitutionIdentity implements InstitutionIdentity {
  const _InstitutionIdentity({required this.collegeId, required this.name, required this.paused, this.logoUrl, this.accentColor, this.pausedMessage});
  factory _InstitutionIdentity.fromJson(Map<String, dynamic> json) => _$InstitutionIdentityFromJson(json);

@override final  String collegeId;
@override final  String name;
@override final  bool paused;
@override final  String? logoUrl;
@override final  String? accentColor;
@override final  String? pausedMessage;

/// Create a copy of InstitutionIdentity
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InstitutionIdentityCopyWith<_InstitutionIdentity> get copyWith => __$InstitutionIdentityCopyWithImpl<_InstitutionIdentity>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InstitutionIdentityToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InstitutionIdentity&&(identical(other.collegeId, collegeId) || other.collegeId == collegeId)&&(identical(other.name, name) || other.name == name)&&(identical(other.paused, paused) || other.paused == paused)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.accentColor, accentColor) || other.accentColor == accentColor)&&(identical(other.pausedMessage, pausedMessage) || other.pausedMessage == pausedMessage));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,collegeId,name,paused,logoUrl,accentColor,pausedMessage);

@override
String toString() {
  return 'InstitutionIdentity(collegeId: $collegeId, name: $name, paused: $paused, logoUrl: $logoUrl, accentColor: $accentColor, pausedMessage: $pausedMessage)';
}


}

/// @nodoc
abstract mixin class _$InstitutionIdentityCopyWith<$Res> implements $InstitutionIdentityCopyWith<$Res> {
  factory _$InstitutionIdentityCopyWith(_InstitutionIdentity value, $Res Function(_InstitutionIdentity) _then) = __$InstitutionIdentityCopyWithImpl;
@override @useResult
$Res call({
 String collegeId, String name, bool paused, String? logoUrl, String? accentColor, String? pausedMessage
});




}
/// @nodoc
class __$InstitutionIdentityCopyWithImpl<$Res>
    implements _$InstitutionIdentityCopyWith<$Res> {
  __$InstitutionIdentityCopyWithImpl(this._self, this._then);

  final _InstitutionIdentity _self;
  final $Res Function(_InstitutionIdentity) _then;

/// Create a copy of InstitutionIdentity
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? collegeId = null,Object? name = null,Object? paused = null,Object? logoUrl = freezed,Object? accentColor = freezed,Object? pausedMessage = freezed,}) {
  return _then(_InstitutionIdentity(
collegeId: null == collegeId ? _self.collegeId : collegeId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,paused: null == paused ? _self.paused : paused // ignore: cast_nullable_to_non_nullable
as bool,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,accentColor: freezed == accentColor ? _self.accentColor : accentColor // ignore: cast_nullable_to_non_nullable
as String?,pausedMessage: freezed == pausedMessage ? _self.pausedMessage : pausedMessage // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$AppConfigData {

 String get name; String get code; Map<String, String> get quietHoursDefault; String get timezone; List<String> get onboardingSteps; String? get logoUrl; String? get accentColor; SupportContact? get supportContact;
/// Create a copy of AppConfigData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AppConfigDataCopyWith<AppConfigData> get copyWith => _$AppConfigDataCopyWithImpl<AppConfigData>(this as AppConfigData, _$identity);

  /// Serializes this AppConfigData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AppConfigData&&(identical(other.name, name) || other.name == name)&&(identical(other.code, code) || other.code == code)&&const DeepCollectionEquality().equals(other.quietHoursDefault, quietHoursDefault)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&const DeepCollectionEquality().equals(other.onboardingSteps, onboardingSteps)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.accentColor, accentColor) || other.accentColor == accentColor)&&(identical(other.supportContact, supportContact) || other.supportContact == supportContact));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,code,const DeepCollectionEquality().hash(quietHoursDefault),timezone,const DeepCollectionEquality().hash(onboardingSteps),logoUrl,accentColor,supportContact);

@override
String toString() {
  return 'AppConfigData(name: $name, code: $code, quietHoursDefault: $quietHoursDefault, timezone: $timezone, onboardingSteps: $onboardingSteps, logoUrl: $logoUrl, accentColor: $accentColor, supportContact: $supportContact)';
}


}

/// @nodoc
abstract mixin class $AppConfigDataCopyWith<$Res>  {
  factory $AppConfigDataCopyWith(AppConfigData value, $Res Function(AppConfigData) _then) = _$AppConfigDataCopyWithImpl;
@useResult
$Res call({
 String name, String code, Map<String, String> quietHoursDefault, String timezone, List<String> onboardingSteps, String? logoUrl, String? accentColor, SupportContact? supportContact
});


$SupportContactCopyWith<$Res>? get supportContact;

}
/// @nodoc
class _$AppConfigDataCopyWithImpl<$Res>
    implements $AppConfigDataCopyWith<$Res> {
  _$AppConfigDataCopyWithImpl(this._self, this._then);

  final AppConfigData _self;
  final $Res Function(AppConfigData) _then;

/// Create a copy of AppConfigData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? code = null,Object? quietHoursDefault = null,Object? timezone = null,Object? onboardingSteps = null,Object? logoUrl = freezed,Object? accentColor = freezed,Object? supportContact = freezed,}) {
  return _then(AppConfigData(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,quietHoursDefault: null == quietHoursDefault ? _self.quietHoursDefault : quietHoursDefault // ignore: cast_nullable_to_non_nullable
as Map<String, String>,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,onboardingSteps: null == onboardingSteps ? _self.onboardingSteps : onboardingSteps // ignore: cast_nullable_to_non_nullable
as List<String>,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,accentColor: freezed == accentColor ? _self.accentColor : accentColor // ignore: cast_nullable_to_non_nullable
as String?,supportContact: freezed == supportContact ? _self.supportContact : supportContact // ignore: cast_nullable_to_non_nullable
as SupportContact?,
  ));
}
/// Create a copy of AppConfigData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SupportContactCopyWith<$Res>? get supportContact {
    if (_self.supportContact == null) {
    return null;
  }

  return $SupportContactCopyWith<$Res>(_self.supportContact!, (value) {
    return _then(_self.copyWith(supportContact: value));
  });
}
}


/// Adds pattern-matching-related methods to [AppConfigData].
extension AppConfigDataPatterns on AppConfigData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AppConfigData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AppConfigData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AppConfigData value)  $default,){
final _that = this;
switch (_that) {
case _AppConfigData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AppConfigData value)?  $default,){
final _that = this;
switch (_that) {
case _AppConfigData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String code,  Map<String, String> quietHoursDefault,  String timezone,  List<String> onboardingSteps,  String? logoUrl,  String? accentColor,  SupportContact? supportContact)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AppConfigData() when $default != null:
return $default(_that.name,_that.code,_that.quietHoursDefault,_that.timezone,_that.onboardingSteps,_that.logoUrl,_that.accentColor,_that.supportContact);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String code,  Map<String, String> quietHoursDefault,  String timezone,  List<String> onboardingSteps,  String? logoUrl,  String? accentColor,  SupportContact? supportContact)  $default,) {final _that = this;
switch (_that) {
case _AppConfigData():
return $default(_that.name,_that.code,_that.quietHoursDefault,_that.timezone,_that.onboardingSteps,_that.logoUrl,_that.accentColor,_that.supportContact);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String code,  Map<String, String> quietHoursDefault,  String timezone,  List<String> onboardingSteps,  String? logoUrl,  String? accentColor,  SupportContact? supportContact)?  $default,) {final _that = this;
switch (_that) {
case _AppConfigData() when $default != null:
return $default(_that.name,_that.code,_that.quietHoursDefault,_that.timezone,_that.onboardingSteps,_that.logoUrl,_that.accentColor,_that.supportContact);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AppConfigData implements AppConfigData {
  const _AppConfigData({required this.name, required this.code, required  Map<String, String> quietHoursDefault, required this.timezone, required  List<String> onboardingSteps, this.logoUrl, this.accentColor, this.supportContact}): _quietHoursDefault = quietHoursDefault,_onboardingSteps = onboardingSteps;
  factory _AppConfigData.fromJson(Map<String, dynamic> json) => _$AppConfigDataFromJson(json);

@override final  String name;
@override final  String code;
 final  Map<String, String> _quietHoursDefault;
@override Map<String, String> get quietHoursDefault {
  if (_quietHoursDefault is EqualUnmodifiableMapView) return _quietHoursDefault;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_quietHoursDefault);
}

@override final  String timezone;
 final  List<String> _onboardingSteps;
@override List<String> get onboardingSteps {
  if (_onboardingSteps is EqualUnmodifiableListView) return _onboardingSteps;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_onboardingSteps);
}

@override final  String? logoUrl;
@override final  String? accentColor;
@override final  SupportContact? supportContact;

/// Create a copy of AppConfigData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AppConfigDataCopyWith<_AppConfigData> get copyWith => __$AppConfigDataCopyWithImpl<_AppConfigData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AppConfigDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AppConfigData&&(identical(other.name, name) || other.name == name)&&(identical(other.code, code) || other.code == code)&&const DeepCollectionEquality().equals(other._quietHoursDefault, _quietHoursDefault)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&const DeepCollectionEquality().equals(other._onboardingSteps, _onboardingSteps)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.accentColor, accentColor) || other.accentColor == accentColor)&&(identical(other.supportContact, supportContact) || other.supportContact == supportContact));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,code,const DeepCollectionEquality().hash(_quietHoursDefault),timezone,const DeepCollectionEquality().hash(_onboardingSteps),logoUrl,accentColor,supportContact);

@override
String toString() {
  return 'AppConfigData(name: $name, code: $code, quietHoursDefault: $quietHoursDefault, timezone: $timezone, onboardingSteps: $onboardingSteps, logoUrl: $logoUrl, accentColor: $accentColor, supportContact: $supportContact)';
}


}

/// @nodoc
abstract mixin class _$AppConfigDataCopyWith<$Res> implements $AppConfigDataCopyWith<$Res> {
  factory _$AppConfigDataCopyWith(_AppConfigData value, $Res Function(_AppConfigData) _then) = __$AppConfigDataCopyWithImpl;
@override @useResult
$Res call({
 String name, String code, Map<String, String> quietHoursDefault, String timezone, List<String> onboardingSteps, String? logoUrl, String? accentColor, SupportContact? supportContact
});


@override $SupportContactCopyWith<$Res>? get supportContact;

}
/// @nodoc
class __$AppConfigDataCopyWithImpl<$Res>
    implements _$AppConfigDataCopyWith<$Res> {
  __$AppConfigDataCopyWithImpl(this._self, this._then);

  final _AppConfigData _self;
  final $Res Function(_AppConfigData) _then;

/// Create a copy of AppConfigData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? code = null,Object? quietHoursDefault = null,Object? timezone = null,Object? onboardingSteps = null,Object? logoUrl = freezed,Object? accentColor = freezed,Object? supportContact = freezed,}) {
  return _then(_AppConfigData(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,quietHoursDefault: null == quietHoursDefault ? _self._quietHoursDefault : quietHoursDefault // ignore: cast_nullable_to_non_nullable
as Map<String, String>,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,onboardingSteps: null == onboardingSteps ? _self._onboardingSteps : onboardingSteps // ignore: cast_nullable_to_non_nullable
as List<String>,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,accentColor: freezed == accentColor ? _self.accentColor : accentColor // ignore: cast_nullable_to_non_nullable
as String?,supportContact: freezed == supportContact ? _self.supportContact : supportContact // ignore: cast_nullable_to_non_nullable
as SupportContact?,
  ));
}

/// Create a copy of AppConfigData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SupportContactCopyWith<$Res>? get supportContact {
    if (_self.supportContact == null) {
    return null;
  }

  return $SupportContactCopyWith<$Res>(_self.supportContact!, (value) {
    return _then(_self.copyWith(supportContact: value));
  });
}
}


/// @nodoc
mixin _$PersonCard {

 String get name; String get firstName; String? get photoUrl;
/// Create a copy of PersonCard
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonCardCopyWith<PersonCard> get copyWith => _$PersonCardCopyWithImpl<PersonCard>(this as PersonCard, _$identity);

  /// Serializes this PersonCard to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonCard&&(identical(other.name, name) || other.name == name)&&(identical(other.firstName, firstName) || other.firstName == firstName)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,firstName,photoUrl);

@override
String toString() {
  return 'PersonCard(name: $name, firstName: $firstName, photoUrl: $photoUrl)';
}


}

/// @nodoc
abstract mixin class $PersonCardCopyWith<$Res>  {
  factory $PersonCardCopyWith(PersonCard value, $Res Function(PersonCard) _then) = _$PersonCardCopyWithImpl;
@useResult
$Res call({
 String name, String firstName, String? photoUrl
});




}
/// @nodoc
class _$PersonCardCopyWithImpl<$Res>
    implements $PersonCardCopyWith<$Res> {
  _$PersonCardCopyWithImpl(this._self, this._then);

  final PersonCard _self;
  final $Res Function(PersonCard) _then;

/// Create a copy of PersonCard
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? firstName = null,Object? photoUrl = freezed,}) {
  return _then(PersonCard(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,firstName: null == firstName ? _self.firstName : firstName // ignore: cast_nullable_to_non_nullable
as String,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonCard].
extension PersonCardPatterns on PersonCard {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonCard value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonCard() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonCard value)  $default,){
final _that = this;
switch (_that) {
case _PersonCard():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonCard value)?  $default,){
final _that = this;
switch (_that) {
case _PersonCard() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String firstName,  String? photoUrl)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonCard() when $default != null:
return $default(_that.name,_that.firstName,_that.photoUrl);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String firstName,  String? photoUrl)  $default,) {final _that = this;
switch (_that) {
case _PersonCard():
return $default(_that.name,_that.firstName,_that.photoUrl);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String firstName,  String? photoUrl)?  $default,) {final _that = this;
switch (_that) {
case _PersonCard() when $default != null:
return $default(_that.name,_that.firstName,_that.photoUrl);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonCard implements PersonCard {
  const _PersonCard({required this.name, required this.firstName, this.photoUrl});
  factory _PersonCard.fromJson(Map<String, dynamic> json) => _$PersonCardFromJson(json);

@override final  String name;
@override final  String firstName;
@override final  String? photoUrl;

/// Create a copy of PersonCard
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonCardCopyWith<_PersonCard> get copyWith => __$PersonCardCopyWithImpl<_PersonCard>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonCardToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonCard&&(identical(other.name, name) || other.name == name)&&(identical(other.firstName, firstName) || other.firstName == firstName)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,firstName,photoUrl);

@override
String toString() {
  return 'PersonCard(name: $name, firstName: $firstName, photoUrl: $photoUrl)';
}


}

/// @nodoc
abstract mixin class _$PersonCardCopyWith<$Res> implements $PersonCardCopyWith<$Res> {
  factory _$PersonCardCopyWith(_PersonCard value, $Res Function(_PersonCard) _then) = __$PersonCardCopyWithImpl;
@override @useResult
$Res call({
 String name, String firstName, String? photoUrl
});




}
/// @nodoc
class __$PersonCardCopyWithImpl<$Res>
    implements _$PersonCardCopyWith<$Res> {
  __$PersonCardCopyWithImpl(this._self, this._then);

  final _PersonCard _self;
  final $Res Function(_PersonCard) _then;

/// Create a copy of PersonCard
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? firstName = null,Object? photoUrl = freezed,}) {
  return _then(_PersonCard(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,firstName: null == firstName ? _self.firstName : firstName // ignore: cast_nullable_to_non_nullable
as String,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$StudentCard {

 bool get isLateralEntry; String? get rollNumber; String? get programme; String? get branch; String? get batch; String? get section; String? get department; String? get hostel;
/// Create a copy of StudentCard
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StudentCardCopyWith<StudentCard> get copyWith => _$StudentCardCopyWithImpl<StudentCard>(this as StudentCard, _$identity);

  /// Serializes this StudentCard to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StudentCard&&(identical(other.isLateralEntry, isLateralEntry) || other.isLateralEntry == isLateralEntry)&&(identical(other.rollNumber, rollNumber) || other.rollNumber == rollNumber)&&(identical(other.programme, programme) || other.programme == programme)&&(identical(other.branch, branch) || other.branch == branch)&&(identical(other.batch, batch) || other.batch == batch)&&(identical(other.section, section) || other.section == section)&&(identical(other.department, department) || other.department == department)&&(identical(other.hostel, hostel) || other.hostel == hostel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,isLateralEntry,rollNumber,programme,branch,batch,section,department,hostel);

@override
String toString() {
  return 'StudentCard(isLateralEntry: $isLateralEntry, rollNumber: $rollNumber, programme: $programme, branch: $branch, batch: $batch, section: $section, department: $department, hostel: $hostel)';
}


}

/// @nodoc
abstract mixin class $StudentCardCopyWith<$Res>  {
  factory $StudentCardCopyWith(StudentCard value, $Res Function(StudentCard) _then) = _$StudentCardCopyWithImpl;
@useResult
$Res call({
 bool isLateralEntry, String? rollNumber, String? programme, String? branch, String? batch, String? section, String? department, String? hostel
});




}
/// @nodoc
class _$StudentCardCopyWithImpl<$Res>
    implements $StudentCardCopyWith<$Res> {
  _$StudentCardCopyWithImpl(this._self, this._then);

  final StudentCard _self;
  final $Res Function(StudentCard) _then;

/// Create a copy of StudentCard
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isLateralEntry = null,Object? rollNumber = freezed,Object? programme = freezed,Object? branch = freezed,Object? batch = freezed,Object? section = freezed,Object? department = freezed,Object? hostel = freezed,}) {
  return _then(StudentCard(
isLateralEntry: null == isLateralEntry ? _self.isLateralEntry : isLateralEntry // ignore: cast_nullable_to_non_nullable
as bool,rollNumber: freezed == rollNumber ? _self.rollNumber : rollNumber // ignore: cast_nullable_to_non_nullable
as String?,programme: freezed == programme ? _self.programme : programme // ignore: cast_nullable_to_non_nullable
as String?,branch: freezed == branch ? _self.branch : branch // ignore: cast_nullable_to_non_nullable
as String?,batch: freezed == batch ? _self.batch : batch // ignore: cast_nullable_to_non_nullable
as String?,section: freezed == section ? _self.section : section // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,hostel: freezed == hostel ? _self.hostel : hostel // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [StudentCard].
extension StudentCardPatterns on StudentCard {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StudentCard value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StudentCard() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StudentCard value)  $default,){
final _that = this;
switch (_that) {
case _StudentCard():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StudentCard value)?  $default,){
final _that = this;
switch (_that) {
case _StudentCard() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isLateralEntry,  String? rollNumber,  String? programme,  String? branch,  String? batch,  String? section,  String? department,  String? hostel)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StudentCard() when $default != null:
return $default(_that.isLateralEntry,_that.rollNumber,_that.programme,_that.branch,_that.batch,_that.section,_that.department,_that.hostel);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isLateralEntry,  String? rollNumber,  String? programme,  String? branch,  String? batch,  String? section,  String? department,  String? hostel)  $default,) {final _that = this;
switch (_that) {
case _StudentCard():
return $default(_that.isLateralEntry,_that.rollNumber,_that.programme,_that.branch,_that.batch,_that.section,_that.department,_that.hostel);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isLateralEntry,  String? rollNumber,  String? programme,  String? branch,  String? batch,  String? section,  String? department,  String? hostel)?  $default,) {final _that = this;
switch (_that) {
case _StudentCard() when $default != null:
return $default(_that.isLateralEntry,_that.rollNumber,_that.programme,_that.branch,_that.batch,_that.section,_that.department,_that.hostel);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StudentCard implements StudentCard {
  const _StudentCard({required this.isLateralEntry, this.rollNumber, this.programme, this.branch, this.batch, this.section, this.department, this.hostel});
  factory _StudentCard.fromJson(Map<String, dynamic> json) => _$StudentCardFromJson(json);

@override final  bool isLateralEntry;
@override final  String? rollNumber;
@override final  String? programme;
@override final  String? branch;
@override final  String? batch;
@override final  String? section;
@override final  String? department;
@override final  String? hostel;

/// Create a copy of StudentCard
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StudentCardCopyWith<_StudentCard> get copyWith => __$StudentCardCopyWithImpl<_StudentCard>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StudentCardToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StudentCard&&(identical(other.isLateralEntry, isLateralEntry) || other.isLateralEntry == isLateralEntry)&&(identical(other.rollNumber, rollNumber) || other.rollNumber == rollNumber)&&(identical(other.programme, programme) || other.programme == programme)&&(identical(other.branch, branch) || other.branch == branch)&&(identical(other.batch, batch) || other.batch == batch)&&(identical(other.section, section) || other.section == section)&&(identical(other.department, department) || other.department == department)&&(identical(other.hostel, hostel) || other.hostel == hostel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,isLateralEntry,rollNumber,programme,branch,batch,section,department,hostel);

@override
String toString() {
  return 'StudentCard(isLateralEntry: $isLateralEntry, rollNumber: $rollNumber, programme: $programme, branch: $branch, batch: $batch, section: $section, department: $department, hostel: $hostel)';
}


}

/// @nodoc
abstract mixin class _$StudentCardCopyWith<$Res> implements $StudentCardCopyWith<$Res> {
  factory _$StudentCardCopyWith(_StudentCard value, $Res Function(_StudentCard) _then) = __$StudentCardCopyWithImpl;
@override @useResult
$Res call({
 bool isLateralEntry, String? rollNumber, String? programme, String? branch, String? batch, String? section, String? department, String? hostel
});




}
/// @nodoc
class __$StudentCardCopyWithImpl<$Res>
    implements _$StudentCardCopyWith<$Res> {
  __$StudentCardCopyWithImpl(this._self, this._then);

  final _StudentCard _self;
  final $Res Function(_StudentCard) _then;

/// Create a copy of StudentCard
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isLateralEntry = null,Object? rollNumber = freezed,Object? programme = freezed,Object? branch = freezed,Object? batch = freezed,Object? section = freezed,Object? department = freezed,Object? hostel = freezed,}) {
  return _then(_StudentCard(
isLateralEntry: null == isLateralEntry ? _self.isLateralEntry : isLateralEntry // ignore: cast_nullable_to_non_nullable
as bool,rollNumber: freezed == rollNumber ? _self.rollNumber : rollNumber // ignore: cast_nullable_to_non_nullable
as String?,programme: freezed == programme ? _self.programme : programme // ignore: cast_nullable_to_non_nullable
as String?,branch: freezed == branch ? _self.branch : branch // ignore: cast_nullable_to_non_nullable
as String?,batch: freezed == batch ? _self.batch : batch // ignore: cast_nullable_to_non_nullable
as String?,section: freezed == section ? _self.section : section // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,hostel: freezed == hostel ? _self.hostel : hostel // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$FacultyCard {

 String get employeeCode; String get designation; bool get isHod; String? get department;
/// Create a copy of FacultyCard
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FacultyCardCopyWith<FacultyCard> get copyWith => _$FacultyCardCopyWithImpl<FacultyCard>(this as FacultyCard, _$identity);

  /// Serializes this FacultyCard to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FacultyCard&&(identical(other.employeeCode, employeeCode) || other.employeeCode == employeeCode)&&(identical(other.designation, designation) || other.designation == designation)&&(identical(other.isHod, isHod) || other.isHod == isHod)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,employeeCode,designation,isHod,department);

@override
String toString() {
  return 'FacultyCard(employeeCode: $employeeCode, designation: $designation, isHod: $isHod, department: $department)';
}


}

/// @nodoc
abstract mixin class $FacultyCardCopyWith<$Res>  {
  factory $FacultyCardCopyWith(FacultyCard value, $Res Function(FacultyCard) _then) = _$FacultyCardCopyWithImpl;
@useResult
$Res call({
 String employeeCode, String designation, bool isHod, String? department
});




}
/// @nodoc
class _$FacultyCardCopyWithImpl<$Res>
    implements $FacultyCardCopyWith<$Res> {
  _$FacultyCardCopyWithImpl(this._self, this._then);

  final FacultyCard _self;
  final $Res Function(FacultyCard) _then;

/// Create a copy of FacultyCard
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? employeeCode = null,Object? designation = null,Object? isHod = null,Object? department = freezed,}) {
  return _then(FacultyCard(
employeeCode: null == employeeCode ? _self.employeeCode : employeeCode // ignore: cast_nullable_to_non_nullable
as String,designation: null == designation ? _self.designation : designation // ignore: cast_nullable_to_non_nullable
as String,isHod: null == isHod ? _self.isHod : isHod // ignore: cast_nullable_to_non_nullable
as bool,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [FacultyCard].
extension FacultyCardPatterns on FacultyCard {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FacultyCard value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FacultyCard() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FacultyCard value)  $default,){
final _that = this;
switch (_that) {
case _FacultyCard():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FacultyCard value)?  $default,){
final _that = this;
switch (_that) {
case _FacultyCard() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String employeeCode,  String designation,  bool isHod,  String? department)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FacultyCard() when $default != null:
return $default(_that.employeeCode,_that.designation,_that.isHod,_that.department);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String employeeCode,  String designation,  bool isHod,  String? department)  $default,) {final _that = this;
switch (_that) {
case _FacultyCard():
return $default(_that.employeeCode,_that.designation,_that.isHod,_that.department);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String employeeCode,  String designation,  bool isHod,  String? department)?  $default,) {final _that = this;
switch (_that) {
case _FacultyCard() when $default != null:
return $default(_that.employeeCode,_that.designation,_that.isHod,_that.department);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FacultyCard implements FacultyCard {
  const _FacultyCard({required this.employeeCode, required this.designation, required this.isHod, this.department});
  factory _FacultyCard.fromJson(Map<String, dynamic> json) => _$FacultyCardFromJson(json);

@override final  String employeeCode;
@override final  String designation;
@override final  bool isHod;
@override final  String? department;

/// Create a copy of FacultyCard
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FacultyCardCopyWith<_FacultyCard> get copyWith => __$FacultyCardCopyWithImpl<_FacultyCard>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FacultyCardToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FacultyCard&&(identical(other.employeeCode, employeeCode) || other.employeeCode == employeeCode)&&(identical(other.designation, designation) || other.designation == designation)&&(identical(other.isHod, isHod) || other.isHod == isHod)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,employeeCode,designation,isHod,department);

@override
String toString() {
  return 'FacultyCard(employeeCode: $employeeCode, designation: $designation, isHod: $isHod, department: $department)';
}


}

/// @nodoc
abstract mixin class _$FacultyCardCopyWith<$Res> implements $FacultyCardCopyWith<$Res> {
  factory _$FacultyCardCopyWith(_FacultyCard value, $Res Function(_FacultyCard) _then) = __$FacultyCardCopyWithImpl;
@override @useResult
$Res call({
 String employeeCode, String designation, bool isHod, String? department
});




}
/// @nodoc
class __$FacultyCardCopyWithImpl<$Res>
    implements _$FacultyCardCopyWith<$Res> {
  __$FacultyCardCopyWithImpl(this._self, this._then);

  final _FacultyCard _self;
  final $Res Function(_FacultyCard) _then;

/// Create a copy of FacultyCard
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? employeeCode = null,Object? designation = null,Object? isHod = null,Object? department = freezed,}) {
  return _then(_FacultyCard(
employeeCode: null == employeeCode ? _self.employeeCode : employeeCode // ignore: cast_nullable_to_non_nullable
as String,designation: null == designation ? _self.designation : designation // ignore: cast_nullable_to_non_nullable
as String,isHod: null == isHod ? _self.isHod : isHod // ignore: cast_nullable_to_non_nullable
as bool,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$QuietHours {

 String get start; String get end;
/// Create a copy of QuietHours
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$QuietHoursCopyWith<QuietHours> get copyWith => _$QuietHoursCopyWithImpl<QuietHours>(this as QuietHours, _$identity);

  /// Serializes this QuietHours to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is QuietHours&&(identical(other.start, start) || other.start == start)&&(identical(other.end, end) || other.end == end));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,start,end);

@override
String toString() {
  return 'QuietHours(start: $start, end: $end)';
}


}

/// @nodoc
abstract mixin class $QuietHoursCopyWith<$Res>  {
  factory $QuietHoursCopyWith(QuietHours value, $Res Function(QuietHours) _then) = _$QuietHoursCopyWithImpl;
@useResult
$Res call({
 String start, String end
});




}
/// @nodoc
class _$QuietHoursCopyWithImpl<$Res>
    implements $QuietHoursCopyWith<$Res> {
  _$QuietHoursCopyWithImpl(this._self, this._then);

  final QuietHours _self;
  final $Res Function(QuietHours) _then;

/// Create a copy of QuietHours
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? start = null,Object? end = null,}) {
  return _then(QuietHours(
start: null == start ? _self.start : start // ignore: cast_nullable_to_non_nullable
as String,end: null == end ? _self.end : end // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [QuietHours].
extension QuietHoursPatterns on QuietHours {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _QuietHours value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _QuietHours() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _QuietHours value)  $default,){
final _that = this;
switch (_that) {
case _QuietHours():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _QuietHours value)?  $default,){
final _that = this;
switch (_that) {
case _QuietHours() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String start,  String end)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _QuietHours() when $default != null:
return $default(_that.start,_that.end);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String start,  String end)  $default,) {final _that = this;
switch (_that) {
case _QuietHours():
return $default(_that.start,_that.end);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String start,  String end)?  $default,) {final _that = this;
switch (_that) {
case _QuietHours() when $default != null:
return $default(_that.start,_that.end);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _QuietHours implements QuietHours {
  const _QuietHours({required this.start, required this.end});
  factory _QuietHours.fromJson(Map<String, dynamic> json) => _$QuietHoursFromJson(json);

@override final  String start;
@override final  String end;

/// Create a copy of QuietHours
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$QuietHoursCopyWith<_QuietHours> get copyWith => __$QuietHoursCopyWithImpl<_QuietHours>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$QuietHoursToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _QuietHours&&(identical(other.start, start) || other.start == start)&&(identical(other.end, end) || other.end == end));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,start,end);

@override
String toString() {
  return 'QuietHours(start: $start, end: $end)';
}


}

/// @nodoc
abstract mixin class _$QuietHoursCopyWith<$Res> implements $QuietHoursCopyWith<$Res> {
  factory _$QuietHoursCopyWith(_QuietHours value, $Res Function(_QuietHours) _then) = __$QuietHoursCopyWithImpl;
@override @useResult
$Res call({
 String start, String end
});




}
/// @nodoc
class __$QuietHoursCopyWithImpl<$Res>
    implements _$QuietHoursCopyWith<$Res> {
  __$QuietHoursCopyWithImpl(this._self, this._then);

  final _QuietHours _self;
  final $Res Function(_QuietHours) _then;

/// Create a copy of QuietHours
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? start = null,Object? end = null,}) {
  return _then(_QuietHours(
start: null == start ? _self.start : start // ignore: cast_nullable_to_non_nullable
as String,end: null == end ? _self.end : end // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$Tiers {

 bool get important; bool get routine;
/// Create a copy of Tiers
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TiersCopyWith<Tiers> get copyWith => _$TiersCopyWithImpl<Tiers>(this as Tiers, _$identity);

  /// Serializes this Tiers to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Tiers&&(identical(other.important, important) || other.important == important)&&(identical(other.routine, routine) || other.routine == routine));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,important,routine);

@override
String toString() {
  return 'Tiers(important: $important, routine: $routine)';
}


}

/// @nodoc
abstract mixin class $TiersCopyWith<$Res>  {
  factory $TiersCopyWith(Tiers value, $Res Function(Tiers) _then) = _$TiersCopyWithImpl;
@useResult
$Res call({
 bool important, bool routine
});




}
/// @nodoc
class _$TiersCopyWithImpl<$Res>
    implements $TiersCopyWith<$Res> {
  _$TiersCopyWithImpl(this._self, this._then);

  final Tiers _self;
  final $Res Function(Tiers) _then;

/// Create a copy of Tiers
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? important = null,Object? routine = null,}) {
  return _then(Tiers(
important: null == important ? _self.important : important // ignore: cast_nullable_to_non_nullable
as bool,routine: null == routine ? _self.routine : routine // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [Tiers].
extension TiersPatterns on Tiers {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Tiers value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Tiers() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Tiers value)  $default,){
final _that = this;
switch (_that) {
case _Tiers():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Tiers value)?  $default,){
final _that = this;
switch (_that) {
case _Tiers() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool important,  bool routine)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Tiers() when $default != null:
return $default(_that.important,_that.routine);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool important,  bool routine)  $default,) {final _that = this;
switch (_that) {
case _Tiers():
return $default(_that.important,_that.routine);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool important,  bool routine)?  $default,) {final _that = this;
switch (_that) {
case _Tiers() when $default != null:
return $default(_that.important,_that.routine);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Tiers implements Tiers {
  const _Tiers({required this.important, required this.routine});
  factory _Tiers.fromJson(Map<String, dynamic> json) => _$TiersFromJson(json);

@override final  bool important;
@override final  bool routine;

/// Create a copy of Tiers
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TiersCopyWith<_Tiers> get copyWith => __$TiersCopyWithImpl<_Tiers>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TiersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Tiers&&(identical(other.important, important) || other.important == important)&&(identical(other.routine, routine) || other.routine == routine));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,important,routine);

@override
String toString() {
  return 'Tiers(important: $important, routine: $routine)';
}


}

/// @nodoc
abstract mixin class _$TiersCopyWith<$Res> implements $TiersCopyWith<$Res> {
  factory _$TiersCopyWith(_Tiers value, $Res Function(_Tiers) _then) = __$TiersCopyWithImpl;
@override @useResult
$Res call({
 bool important, bool routine
});




}
/// @nodoc
class __$TiersCopyWithImpl<$Res>
    implements _$TiersCopyWith<$Res> {
  __$TiersCopyWithImpl(this._self, this._then);

  final _Tiers _self;
  final $Res Function(_Tiers) _then;

/// Create a copy of Tiers
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? important = null,Object? routine = null,}) {
  return _then(_Tiers(
important: null == important ? _self.important : important // ignore: cast_nullable_to_non_nullable
as bool,routine: null == routine ? _self.routine : routine // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$Settings {

 QuietHours get quietHours; Tiers get tiers; String get language;
/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SettingsCopyWith<Settings> get copyWith => _$SettingsCopyWithImpl<Settings>(this as Settings, _$identity);

  /// Serializes this Settings to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Settings&&(identical(other.quietHours, quietHours) || other.quietHours == quietHours)&&(identical(other.tiers, tiers) || other.tiers == tiers)&&(identical(other.language, language) || other.language == language));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,quietHours,tiers,language);

@override
String toString() {
  return 'Settings(quietHours: $quietHours, tiers: $tiers, language: $language)';
}


}

/// @nodoc
abstract mixin class $SettingsCopyWith<$Res>  {
  factory $SettingsCopyWith(Settings value, $Res Function(Settings) _then) = _$SettingsCopyWithImpl;
@useResult
$Res call({
 QuietHours quietHours, Tiers tiers, String language
});


$QuietHoursCopyWith<$Res> get quietHours;$TiersCopyWith<$Res> get tiers;

}
/// @nodoc
class _$SettingsCopyWithImpl<$Res>
    implements $SettingsCopyWith<$Res> {
  _$SettingsCopyWithImpl(this._self, this._then);

  final Settings _self;
  final $Res Function(Settings) _then;

/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? quietHours = null,Object? tiers = null,Object? language = null,}) {
  return _then(Settings(
quietHours: null == quietHours ? _self.quietHours : quietHours // ignore: cast_nullable_to_non_nullable
as QuietHours,tiers: null == tiers ? _self.tiers : tiers // ignore: cast_nullable_to_non_nullable
as Tiers,language: null == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String,
  ));
}
/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$QuietHoursCopyWith<$Res> get quietHours {
  
  return $QuietHoursCopyWith<$Res>(_self.quietHours, (value) {
    return _then(_self.copyWith(quietHours: value));
  });
}/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TiersCopyWith<$Res> get tiers {
  
  return $TiersCopyWith<$Res>(_self.tiers, (value) {
    return _then(_self.copyWith(tiers: value));
  });
}
}


/// Adds pattern-matching-related methods to [Settings].
extension SettingsPatterns on Settings {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Settings value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Settings() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Settings value)  $default,){
final _that = this;
switch (_that) {
case _Settings():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Settings value)?  $default,){
final _that = this;
switch (_that) {
case _Settings() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( QuietHours quietHours,  Tiers tiers,  String language)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Settings() when $default != null:
return $default(_that.quietHours,_that.tiers,_that.language);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( QuietHours quietHours,  Tiers tiers,  String language)  $default,) {final _that = this;
switch (_that) {
case _Settings():
return $default(_that.quietHours,_that.tiers,_that.language);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( QuietHours quietHours,  Tiers tiers,  String language)?  $default,) {final _that = this;
switch (_that) {
case _Settings() when $default != null:
return $default(_that.quietHours,_that.tiers,_that.language);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Settings implements Settings {
  const _Settings({required this.quietHours, required this.tiers, required this.language});
  factory _Settings.fromJson(Map<String, dynamic> json) => _$SettingsFromJson(json);

@override final  QuietHours quietHours;
@override final  Tiers tiers;
@override final  String language;

/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SettingsCopyWith<_Settings> get copyWith => __$SettingsCopyWithImpl<_Settings>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SettingsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Settings&&(identical(other.quietHours, quietHours) || other.quietHours == quietHours)&&(identical(other.tiers, tiers) || other.tiers == tiers)&&(identical(other.language, language) || other.language == language));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,quietHours,tiers,language);

@override
String toString() {
  return 'Settings(quietHours: $quietHours, tiers: $tiers, language: $language)';
}


}

/// @nodoc
abstract mixin class _$SettingsCopyWith<$Res> implements $SettingsCopyWith<$Res> {
  factory _$SettingsCopyWith(_Settings value, $Res Function(_Settings) _then) = __$SettingsCopyWithImpl;
@override @useResult
$Res call({
 QuietHours quietHours, Tiers tiers, String language
});


@override $QuietHoursCopyWith<$Res> get quietHours;@override $TiersCopyWith<$Res> get tiers;

}
/// @nodoc
class __$SettingsCopyWithImpl<$Res>
    implements _$SettingsCopyWith<$Res> {
  __$SettingsCopyWithImpl(this._self, this._then);

  final _Settings _self;
  final $Res Function(_Settings) _then;

/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? quietHours = null,Object? tiers = null,Object? language = null,}) {
  return _then(_Settings(
quietHours: null == quietHours ? _self.quietHours : quietHours // ignore: cast_nullable_to_non_nullable
as QuietHours,tiers: null == tiers ? _self.tiers : tiers // ignore: cast_nullable_to_non_nullable
as Tiers,language: null == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$QuietHoursCopyWith<$Res> get quietHours {
  
  return $QuietHoursCopyWith<$Res>(_self.quietHours, (value) {
    return _then(_self.copyWith(quietHours: value));
  });
}/// Create a copy of Settings
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TiersCopyWith<$Res> get tiers {
  
  return $TiersCopyWith<$Res>(_self.tiers, (value) {
    return _then(_self.copyWith(tiers: value));
  });
}
}


/// @nodoc
mixin _$InstitutionInfo {

 String get name; String get code; String get timezone; String? get logoUrl; String? get accentColor; SupportContact? get supportContact;
/// Create a copy of InstitutionInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InstitutionInfoCopyWith<InstitutionInfo> get copyWith => _$InstitutionInfoCopyWithImpl<InstitutionInfo>(this as InstitutionInfo, _$identity);

  /// Serializes this InstitutionInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InstitutionInfo&&(identical(other.name, name) || other.name == name)&&(identical(other.code, code) || other.code == code)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.accentColor, accentColor) || other.accentColor == accentColor)&&(identical(other.supportContact, supportContact) || other.supportContact == supportContact));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,code,timezone,logoUrl,accentColor,supportContact);

@override
String toString() {
  return 'InstitutionInfo(name: $name, code: $code, timezone: $timezone, logoUrl: $logoUrl, accentColor: $accentColor, supportContact: $supportContact)';
}


}

/// @nodoc
abstract mixin class $InstitutionInfoCopyWith<$Res>  {
  factory $InstitutionInfoCopyWith(InstitutionInfo value, $Res Function(InstitutionInfo) _then) = _$InstitutionInfoCopyWithImpl;
@useResult
$Res call({
 String name, String code, String timezone, String? logoUrl, String? accentColor, SupportContact? supportContact
});


$SupportContactCopyWith<$Res>? get supportContact;

}
/// @nodoc
class _$InstitutionInfoCopyWithImpl<$Res>
    implements $InstitutionInfoCopyWith<$Res> {
  _$InstitutionInfoCopyWithImpl(this._self, this._then);

  final InstitutionInfo _self;
  final $Res Function(InstitutionInfo) _then;

/// Create a copy of InstitutionInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? code = null,Object? timezone = null,Object? logoUrl = freezed,Object? accentColor = freezed,Object? supportContact = freezed,}) {
  return _then(InstitutionInfo(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,accentColor: freezed == accentColor ? _self.accentColor : accentColor // ignore: cast_nullable_to_non_nullable
as String?,supportContact: freezed == supportContact ? _self.supportContact : supportContact // ignore: cast_nullable_to_non_nullable
as SupportContact?,
  ));
}
/// Create a copy of InstitutionInfo
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SupportContactCopyWith<$Res>? get supportContact {
    if (_self.supportContact == null) {
    return null;
  }

  return $SupportContactCopyWith<$Res>(_self.supportContact!, (value) {
    return _then(_self.copyWith(supportContact: value));
  });
}
}


/// Adds pattern-matching-related methods to [InstitutionInfo].
extension InstitutionInfoPatterns on InstitutionInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InstitutionInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InstitutionInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InstitutionInfo value)  $default,){
final _that = this;
switch (_that) {
case _InstitutionInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InstitutionInfo value)?  $default,){
final _that = this;
switch (_that) {
case _InstitutionInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String code,  String timezone,  String? logoUrl,  String? accentColor,  SupportContact? supportContact)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InstitutionInfo() when $default != null:
return $default(_that.name,_that.code,_that.timezone,_that.logoUrl,_that.accentColor,_that.supportContact);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String code,  String timezone,  String? logoUrl,  String? accentColor,  SupportContact? supportContact)  $default,) {final _that = this;
switch (_that) {
case _InstitutionInfo():
return $default(_that.name,_that.code,_that.timezone,_that.logoUrl,_that.accentColor,_that.supportContact);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String code,  String timezone,  String? logoUrl,  String? accentColor,  SupportContact? supportContact)?  $default,) {final _that = this;
switch (_that) {
case _InstitutionInfo() when $default != null:
return $default(_that.name,_that.code,_that.timezone,_that.logoUrl,_that.accentColor,_that.supportContact);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InstitutionInfo implements InstitutionInfo {
  const _InstitutionInfo({required this.name, required this.code, required this.timezone, this.logoUrl, this.accentColor, this.supportContact});
  factory _InstitutionInfo.fromJson(Map<String, dynamic> json) => _$InstitutionInfoFromJson(json);

@override final  String name;
@override final  String code;
@override final  String timezone;
@override final  String? logoUrl;
@override final  String? accentColor;
@override final  SupportContact? supportContact;

/// Create a copy of InstitutionInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InstitutionInfoCopyWith<_InstitutionInfo> get copyWith => __$InstitutionInfoCopyWithImpl<_InstitutionInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InstitutionInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InstitutionInfo&&(identical(other.name, name) || other.name == name)&&(identical(other.code, code) || other.code == code)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.accentColor, accentColor) || other.accentColor == accentColor)&&(identical(other.supportContact, supportContact) || other.supportContact == supportContact));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,code,timezone,logoUrl,accentColor,supportContact);

@override
String toString() {
  return 'InstitutionInfo(name: $name, code: $code, timezone: $timezone, logoUrl: $logoUrl, accentColor: $accentColor, supportContact: $supportContact)';
}


}

/// @nodoc
abstract mixin class _$InstitutionInfoCopyWith<$Res> implements $InstitutionInfoCopyWith<$Res> {
  factory _$InstitutionInfoCopyWith(_InstitutionInfo value, $Res Function(_InstitutionInfo) _then) = __$InstitutionInfoCopyWithImpl;
@override @useResult
$Res call({
 String name, String code, String timezone, String? logoUrl, String? accentColor, SupportContact? supportContact
});


@override $SupportContactCopyWith<$Res>? get supportContact;

}
/// @nodoc
class __$InstitutionInfoCopyWithImpl<$Res>
    implements _$InstitutionInfoCopyWith<$Res> {
  __$InstitutionInfoCopyWithImpl(this._self, this._then);

  final _InstitutionInfo _self;
  final $Res Function(_InstitutionInfo) _then;

/// Create a copy of InstitutionInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? code = null,Object? timezone = null,Object? logoUrl = freezed,Object? accentColor = freezed,Object? supportContact = freezed,}) {
  return _then(_InstitutionInfo(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,accentColor: freezed == accentColor ? _self.accentColor : accentColor // ignore: cast_nullable_to_non_nullable
as String?,supportContact: freezed == supportContact ? _self.supportContact : supportContact // ignore: cast_nullable_to_non_nullable
as SupportContact?,
  ));
}

/// Create a copy of InstitutionInfo
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SupportContactCopyWith<$Res>? get supportContact {
    if (_self.supportContact == null) {
    return null;
  }

  return $SupportContactCopyWith<$Res>(_self.supportContact!, (value) {
    return _then(_self.copyWith(supportContact: value));
  });
}
}


/// @nodoc
mixin _$Me {

 AccountSummary get account; PersonCard get person; Settings get settings; InstitutionInfo get institution; String get asOf; StudentCard? get student; FacultyCard? get faculty;
/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MeCopyWith<Me> get copyWith => _$MeCopyWithImpl<Me>(this as Me, _$identity);

  /// Serializes this Me to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Me&&(identical(other.account, account) || other.account == account)&&(identical(other.person, person) || other.person == person)&&(identical(other.settings, settings) || other.settings == settings)&&(identical(other.institution, institution) || other.institution == institution)&&(identical(other.asOf, asOf) || other.asOf == asOf)&&(identical(other.student, student) || other.student == student)&&(identical(other.faculty, faculty) || other.faculty == faculty));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,account,person,settings,institution,asOf,student,faculty);

@override
String toString() {
  return 'Me(account: $account, person: $person, settings: $settings, institution: $institution, asOf: $asOf, student: $student, faculty: $faculty)';
}


}

/// @nodoc
abstract mixin class $MeCopyWith<$Res>  {
  factory $MeCopyWith(Me value, $Res Function(Me) _then) = _$MeCopyWithImpl;
@useResult
$Res call({
 AccountSummary account, PersonCard person, Settings settings, InstitutionInfo institution, String asOf, StudentCard? student, FacultyCard? faculty
});


$AccountSummaryCopyWith<$Res> get account;$PersonCardCopyWith<$Res> get person;$SettingsCopyWith<$Res> get settings;$InstitutionInfoCopyWith<$Res> get institution;$StudentCardCopyWith<$Res>? get student;$FacultyCardCopyWith<$Res>? get faculty;

}
/// @nodoc
class _$MeCopyWithImpl<$Res>
    implements $MeCopyWith<$Res> {
  _$MeCopyWithImpl(this._self, this._then);

  final Me _self;
  final $Res Function(Me) _then;

/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? account = null,Object? person = null,Object? settings = null,Object? institution = null,Object? asOf = null,Object? student = freezed,Object? faculty = freezed,}) {
  return _then(Me(
account: null == account ? _self.account : account // ignore: cast_nullable_to_non_nullable
as AccountSummary,person: null == person ? _self.person : person // ignore: cast_nullable_to_non_nullable
as PersonCard,settings: null == settings ? _self.settings : settings // ignore: cast_nullable_to_non_nullable
as Settings,institution: null == institution ? _self.institution : institution // ignore: cast_nullable_to_non_nullable
as InstitutionInfo,asOf: null == asOf ? _self.asOf : asOf // ignore: cast_nullable_to_non_nullable
as String,student: freezed == student ? _self.student : student // ignore: cast_nullable_to_non_nullable
as StudentCard?,faculty: freezed == faculty ? _self.faculty : faculty // ignore: cast_nullable_to_non_nullable
as FacultyCard?,
  ));
}
/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AccountSummaryCopyWith<$Res> get account {
  
  return $AccountSummaryCopyWith<$Res>(_self.account, (value) {
    return _then(_self.copyWith(account: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonCardCopyWith<$Res> get person {
  
  return $PersonCardCopyWith<$Res>(_self.person, (value) {
    return _then(_self.copyWith(person: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SettingsCopyWith<$Res> get settings {
  
  return $SettingsCopyWith<$Res>(_self.settings, (value) {
    return _then(_self.copyWith(settings: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InstitutionInfoCopyWith<$Res> get institution {
  
  return $InstitutionInfoCopyWith<$Res>(_self.institution, (value) {
    return _then(_self.copyWith(institution: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StudentCardCopyWith<$Res>? get student {
    if (_self.student == null) {
    return null;
  }

  return $StudentCardCopyWith<$Res>(_self.student!, (value) {
    return _then(_self.copyWith(student: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FacultyCardCopyWith<$Res>? get faculty {
    if (_self.faculty == null) {
    return null;
  }

  return $FacultyCardCopyWith<$Res>(_self.faculty!, (value) {
    return _then(_self.copyWith(faculty: value));
  });
}
}


/// Adds pattern-matching-related methods to [Me].
extension MePatterns on Me {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Me value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Me() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Me value)  $default,){
final _that = this;
switch (_that) {
case _Me():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Me value)?  $default,){
final _that = this;
switch (_that) {
case _Me() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( AccountSummary account,  PersonCard person,  Settings settings,  InstitutionInfo institution,  String asOf,  StudentCard? student,  FacultyCard? faculty)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Me() when $default != null:
return $default(_that.account,_that.person,_that.settings,_that.institution,_that.asOf,_that.student,_that.faculty);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( AccountSummary account,  PersonCard person,  Settings settings,  InstitutionInfo institution,  String asOf,  StudentCard? student,  FacultyCard? faculty)  $default,) {final _that = this;
switch (_that) {
case _Me():
return $default(_that.account,_that.person,_that.settings,_that.institution,_that.asOf,_that.student,_that.faculty);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( AccountSummary account,  PersonCard person,  Settings settings,  InstitutionInfo institution,  String asOf,  StudentCard? student,  FacultyCard? faculty)?  $default,) {final _that = this;
switch (_that) {
case _Me() when $default != null:
return $default(_that.account,_that.person,_that.settings,_that.institution,_that.asOf,_that.student,_that.faculty);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Me implements Me {
  const _Me({required this.account, required this.person, required this.settings, required this.institution, required this.asOf, this.student, this.faculty});
  factory _Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

@override final  AccountSummary account;
@override final  PersonCard person;
@override final  Settings settings;
@override final  InstitutionInfo institution;
@override final  String asOf;
@override final  StudentCard? student;
@override final  FacultyCard? faculty;

/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MeCopyWith<_Me> get copyWith => __$MeCopyWithImpl<_Me>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MeToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Me&&(identical(other.account, account) || other.account == account)&&(identical(other.person, person) || other.person == person)&&(identical(other.settings, settings) || other.settings == settings)&&(identical(other.institution, institution) || other.institution == institution)&&(identical(other.asOf, asOf) || other.asOf == asOf)&&(identical(other.student, student) || other.student == student)&&(identical(other.faculty, faculty) || other.faculty == faculty));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,account,person,settings,institution,asOf,student,faculty);

@override
String toString() {
  return 'Me(account: $account, person: $person, settings: $settings, institution: $institution, asOf: $asOf, student: $student, faculty: $faculty)';
}


}

/// @nodoc
abstract mixin class _$MeCopyWith<$Res> implements $MeCopyWith<$Res> {
  factory _$MeCopyWith(_Me value, $Res Function(_Me) _then) = __$MeCopyWithImpl;
@override @useResult
$Res call({
 AccountSummary account, PersonCard person, Settings settings, InstitutionInfo institution, String asOf, StudentCard? student, FacultyCard? faculty
});


@override $AccountSummaryCopyWith<$Res> get account;@override $PersonCardCopyWith<$Res> get person;@override $SettingsCopyWith<$Res> get settings;@override $InstitutionInfoCopyWith<$Res> get institution;@override $StudentCardCopyWith<$Res>? get student;@override $FacultyCardCopyWith<$Res>? get faculty;

}
/// @nodoc
class __$MeCopyWithImpl<$Res>
    implements _$MeCopyWith<$Res> {
  __$MeCopyWithImpl(this._self, this._then);

  final _Me _self;
  final $Res Function(_Me) _then;

/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? account = null,Object? person = null,Object? settings = null,Object? institution = null,Object? asOf = null,Object? student = freezed,Object? faculty = freezed,}) {
  return _then(_Me(
account: null == account ? _self.account : account // ignore: cast_nullable_to_non_nullable
as AccountSummary,person: null == person ? _self.person : person // ignore: cast_nullable_to_non_nullable
as PersonCard,settings: null == settings ? _self.settings : settings // ignore: cast_nullable_to_non_nullable
as Settings,institution: null == institution ? _self.institution : institution // ignore: cast_nullable_to_non_nullable
as InstitutionInfo,asOf: null == asOf ? _self.asOf : asOf // ignore: cast_nullable_to_non_nullable
as String,student: freezed == student ? _self.student : student // ignore: cast_nullable_to_non_nullable
as StudentCard?,faculty: freezed == faculty ? _self.faculty : faculty // ignore: cast_nullable_to_non_nullable
as FacultyCard?,
  ));
}

/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AccountSummaryCopyWith<$Res> get account {
  
  return $AccountSummaryCopyWith<$Res>(_self.account, (value) {
    return _then(_self.copyWith(account: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonCardCopyWith<$Res> get person {
  
  return $PersonCardCopyWith<$Res>(_self.person, (value) {
    return _then(_self.copyWith(person: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SettingsCopyWith<$Res> get settings {
  
  return $SettingsCopyWith<$Res>(_self.settings, (value) {
    return _then(_self.copyWith(settings: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InstitutionInfoCopyWith<$Res> get institution {
  
  return $InstitutionInfoCopyWith<$Res>(_self.institution, (value) {
    return _then(_self.copyWith(institution: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StudentCardCopyWith<$Res>? get student {
    if (_self.student == null) {
    return null;
  }

  return $StudentCardCopyWith<$Res>(_self.student!, (value) {
    return _then(_self.copyWith(student: value));
  });
}/// Create a copy of Me
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FacultyCardCopyWith<$Res>? get faculty {
    if (_self.faculty == null) {
    return null;
  }

  return $FacultyCardCopyWith<$Res>(_self.faculty!, (value) {
    return _then(_self.copyWith(faculty: value));
  });
}
}


/// @nodoc
mixin _$OnboardingStateData {

 int get onboardingStep; List<String> get onboardingSteps; bool get onboardingComplete;
/// Create a copy of OnboardingStateData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OnboardingStateDataCopyWith<OnboardingStateData> get copyWith => _$OnboardingStateDataCopyWithImpl<OnboardingStateData>(this as OnboardingStateData, _$identity);

  /// Serializes this OnboardingStateData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OnboardingStateData&&(identical(other.onboardingStep, onboardingStep) || other.onboardingStep == onboardingStep)&&const DeepCollectionEquality().equals(other.onboardingSteps, onboardingSteps)&&(identical(other.onboardingComplete, onboardingComplete) || other.onboardingComplete == onboardingComplete));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,onboardingStep,const DeepCollectionEquality().hash(onboardingSteps),onboardingComplete);

@override
String toString() {
  return 'OnboardingStateData(onboardingStep: $onboardingStep, onboardingSteps: $onboardingSteps, onboardingComplete: $onboardingComplete)';
}


}

/// @nodoc
abstract mixin class $OnboardingStateDataCopyWith<$Res>  {
  factory $OnboardingStateDataCopyWith(OnboardingStateData value, $Res Function(OnboardingStateData) _then) = _$OnboardingStateDataCopyWithImpl;
@useResult
$Res call({
 int onboardingStep, List<String> onboardingSteps, bool onboardingComplete
});




}
/// @nodoc
class _$OnboardingStateDataCopyWithImpl<$Res>
    implements $OnboardingStateDataCopyWith<$Res> {
  _$OnboardingStateDataCopyWithImpl(this._self, this._then);

  final OnboardingStateData _self;
  final $Res Function(OnboardingStateData) _then;

/// Create a copy of OnboardingStateData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? onboardingStep = null,Object? onboardingSteps = null,Object? onboardingComplete = null,}) {
  return _then(OnboardingStateData(
onboardingStep: null == onboardingStep ? _self.onboardingStep : onboardingStep // ignore: cast_nullable_to_non_nullable
as int,onboardingSteps: null == onboardingSteps ? _self.onboardingSteps : onboardingSteps // ignore: cast_nullable_to_non_nullable
as List<String>,onboardingComplete: null == onboardingComplete ? _self.onboardingComplete : onboardingComplete // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [OnboardingStateData].
extension OnboardingStateDataPatterns on OnboardingStateData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OnboardingStateData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OnboardingStateData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OnboardingStateData value)  $default,){
final _that = this;
switch (_that) {
case _OnboardingStateData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OnboardingStateData value)?  $default,){
final _that = this;
switch (_that) {
case _OnboardingStateData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int onboardingStep,  List<String> onboardingSteps,  bool onboardingComplete)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OnboardingStateData() when $default != null:
return $default(_that.onboardingStep,_that.onboardingSteps,_that.onboardingComplete);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int onboardingStep,  List<String> onboardingSteps,  bool onboardingComplete)  $default,) {final _that = this;
switch (_that) {
case _OnboardingStateData():
return $default(_that.onboardingStep,_that.onboardingSteps,_that.onboardingComplete);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int onboardingStep,  List<String> onboardingSteps,  bool onboardingComplete)?  $default,) {final _that = this;
switch (_that) {
case _OnboardingStateData() when $default != null:
return $default(_that.onboardingStep,_that.onboardingSteps,_that.onboardingComplete);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OnboardingStateData implements OnboardingStateData {
  const _OnboardingStateData({required this.onboardingStep, required  List<String> onboardingSteps, required this.onboardingComplete}): _onboardingSteps = onboardingSteps;
  factory _OnboardingStateData.fromJson(Map<String, dynamic> json) => _$OnboardingStateDataFromJson(json);

@override final  int onboardingStep;
 final  List<String> _onboardingSteps;
@override List<String> get onboardingSteps {
  if (_onboardingSteps is EqualUnmodifiableListView) return _onboardingSteps;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_onboardingSteps);
}

@override final  bool onboardingComplete;

/// Create a copy of OnboardingStateData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OnboardingStateDataCopyWith<_OnboardingStateData> get copyWith => __$OnboardingStateDataCopyWithImpl<_OnboardingStateData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OnboardingStateDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OnboardingStateData&&(identical(other.onboardingStep, onboardingStep) || other.onboardingStep == onboardingStep)&&const DeepCollectionEquality().equals(other._onboardingSteps, _onboardingSteps)&&(identical(other.onboardingComplete, onboardingComplete) || other.onboardingComplete == onboardingComplete));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,onboardingStep,const DeepCollectionEquality().hash(_onboardingSteps),onboardingComplete);

@override
String toString() {
  return 'OnboardingStateData(onboardingStep: $onboardingStep, onboardingSteps: $onboardingSteps, onboardingComplete: $onboardingComplete)';
}


}

/// @nodoc
abstract mixin class _$OnboardingStateDataCopyWith<$Res> implements $OnboardingStateDataCopyWith<$Res> {
  factory _$OnboardingStateDataCopyWith(_OnboardingStateData value, $Res Function(_OnboardingStateData) _then) = __$OnboardingStateDataCopyWithImpl;
@override @useResult
$Res call({
 int onboardingStep, List<String> onboardingSteps, bool onboardingComplete
});




}
/// @nodoc
class __$OnboardingStateDataCopyWithImpl<$Res>
    implements _$OnboardingStateDataCopyWith<$Res> {
  __$OnboardingStateDataCopyWithImpl(this._self, this._then);

  final _OnboardingStateData _self;
  final $Res Function(_OnboardingStateData) _then;

/// Create a copy of OnboardingStateData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? onboardingStep = null,Object? onboardingSteps = null,Object? onboardingComplete = null,}) {
  return _then(_OnboardingStateData(
onboardingStep: null == onboardingStep ? _self.onboardingStep : onboardingStep // ignore: cast_nullable_to_non_nullable
as int,onboardingSteps: null == onboardingSteps ? _self._onboardingSteps : onboardingSteps // ignore: cast_nullable_to_non_nullable
as List<String>,onboardingComplete: null == onboardingComplete ? _self.onboardingComplete : onboardingComplete // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$DeviceRow {

 String get sessionId; String get deviceName; String get platform; String get appVersion; String get lastActiveAt; bool get isCurrent;
/// Create a copy of DeviceRow
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DeviceRowCopyWith<DeviceRow> get copyWith => _$DeviceRowCopyWithImpl<DeviceRow>(this as DeviceRow, _$identity);

  /// Serializes this DeviceRow to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DeviceRow&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.deviceName, deviceName) || other.deviceName == deviceName)&&(identical(other.platform, platform) || other.platform == platform)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion)&&(identical(other.lastActiveAt, lastActiveAt) || other.lastActiveAt == lastActiveAt)&&(identical(other.isCurrent, isCurrent) || other.isCurrent == isCurrent));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,deviceName,platform,appVersion,lastActiveAt,isCurrent);

@override
String toString() {
  return 'DeviceRow(sessionId: $sessionId, deviceName: $deviceName, platform: $platform, appVersion: $appVersion, lastActiveAt: $lastActiveAt, isCurrent: $isCurrent)';
}


}

/// @nodoc
abstract mixin class $DeviceRowCopyWith<$Res>  {
  factory $DeviceRowCopyWith(DeviceRow value, $Res Function(DeviceRow) _then) = _$DeviceRowCopyWithImpl;
@useResult
$Res call({
 String sessionId, String deviceName, String platform, String appVersion, String lastActiveAt, bool isCurrent
});




}
/// @nodoc
class _$DeviceRowCopyWithImpl<$Res>
    implements $DeviceRowCopyWith<$Res> {
  _$DeviceRowCopyWithImpl(this._self, this._then);

  final DeviceRow _self;
  final $Res Function(DeviceRow) _then;

/// Create a copy of DeviceRow
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sessionId = null,Object? deviceName = null,Object? platform = null,Object? appVersion = null,Object? lastActiveAt = null,Object? isCurrent = null,}) {
  return _then(DeviceRow(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,deviceName: null == deviceName ? _self.deviceName : deviceName // ignore: cast_nullable_to_non_nullable
as String,platform: null == platform ? _self.platform : platform // ignore: cast_nullable_to_non_nullable
as String,appVersion: null == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String,lastActiveAt: null == lastActiveAt ? _self.lastActiveAt : lastActiveAt // ignore: cast_nullable_to_non_nullable
as String,isCurrent: null == isCurrent ? _self.isCurrent : isCurrent // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [DeviceRow].
extension DeviceRowPatterns on DeviceRow {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DeviceRow value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DeviceRow() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DeviceRow value)  $default,){
final _that = this;
switch (_that) {
case _DeviceRow():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DeviceRow value)?  $default,){
final _that = this;
switch (_that) {
case _DeviceRow() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sessionId,  String deviceName,  String platform,  String appVersion,  String lastActiveAt,  bool isCurrent)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DeviceRow() when $default != null:
return $default(_that.sessionId,_that.deviceName,_that.platform,_that.appVersion,_that.lastActiveAt,_that.isCurrent);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sessionId,  String deviceName,  String platform,  String appVersion,  String lastActiveAt,  bool isCurrent)  $default,) {final _that = this;
switch (_that) {
case _DeviceRow():
return $default(_that.sessionId,_that.deviceName,_that.platform,_that.appVersion,_that.lastActiveAt,_that.isCurrent);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sessionId,  String deviceName,  String platform,  String appVersion,  String lastActiveAt,  bool isCurrent)?  $default,) {final _that = this;
switch (_that) {
case _DeviceRow() when $default != null:
return $default(_that.sessionId,_that.deviceName,_that.platform,_that.appVersion,_that.lastActiveAt,_that.isCurrent);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DeviceRow implements DeviceRow {
  const _DeviceRow({required this.sessionId, required this.deviceName, required this.platform, required this.appVersion, required this.lastActiveAt, required this.isCurrent});
  factory _DeviceRow.fromJson(Map<String, dynamic> json) => _$DeviceRowFromJson(json);

@override final  String sessionId;
@override final  String deviceName;
@override final  String platform;
@override final  String appVersion;
@override final  String lastActiveAt;
@override final  bool isCurrent;

/// Create a copy of DeviceRow
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DeviceRowCopyWith<_DeviceRow> get copyWith => __$DeviceRowCopyWithImpl<_DeviceRow>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DeviceRowToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DeviceRow&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.deviceName, deviceName) || other.deviceName == deviceName)&&(identical(other.platform, platform) || other.platform == platform)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion)&&(identical(other.lastActiveAt, lastActiveAt) || other.lastActiveAt == lastActiveAt)&&(identical(other.isCurrent, isCurrent) || other.isCurrent == isCurrent));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,deviceName,platform,appVersion,lastActiveAt,isCurrent);

@override
String toString() {
  return 'DeviceRow(sessionId: $sessionId, deviceName: $deviceName, platform: $platform, appVersion: $appVersion, lastActiveAt: $lastActiveAt, isCurrent: $isCurrent)';
}


}

/// @nodoc
abstract mixin class _$DeviceRowCopyWith<$Res> implements $DeviceRowCopyWith<$Res> {
  factory _$DeviceRowCopyWith(_DeviceRow value, $Res Function(_DeviceRow) _then) = __$DeviceRowCopyWithImpl;
@override @useResult
$Res call({
 String sessionId, String deviceName, String platform, String appVersion, String lastActiveAt, bool isCurrent
});




}
/// @nodoc
class __$DeviceRowCopyWithImpl<$Res>
    implements _$DeviceRowCopyWith<$Res> {
  __$DeviceRowCopyWithImpl(this._self, this._then);

  final _DeviceRow _self;
  final $Res Function(_DeviceRow) _then;

/// Create a copy of DeviceRow
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sessionId = null,Object? deviceName = null,Object? platform = null,Object? appVersion = null,Object? lastActiveAt = null,Object? isCurrent = null,}) {
  return _then(_DeviceRow(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,deviceName: null == deviceName ? _self.deviceName : deviceName // ignore: cast_nullable_to_non_nullable
as String,platform: null == platform ? _self.platform : platform // ignore: cast_nullable_to_non_nullable
as String,appVersion: null == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String,lastActiveAt: null == lastActiveAt ? _self.lastActiveAt : lastActiveAt // ignore: cast_nullable_to_non_nullable
as String,isCurrent: null == isCurrent ? _self.isCurrent : isCurrent // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$SpaceChannel {

 String get id; String get name; String get about; String get scopeType; String get templateCode; String get role; bool get muted; int get memberCount; bool get archived; String? get nextClassAt; String? get nextClassLabel;
/// Create a copy of SpaceChannel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SpaceChannelCopyWith<SpaceChannel> get copyWith => _$SpaceChannelCopyWithImpl<SpaceChannel>(this as SpaceChannel, _$identity);

  /// Serializes this SpaceChannel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SpaceChannel&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.about, about) || other.about == about)&&(identical(other.scopeType, scopeType) || other.scopeType == scopeType)&&(identical(other.templateCode, templateCode) || other.templateCode == templateCode)&&(identical(other.role, role) || other.role == role)&&(identical(other.muted, muted) || other.muted == muted)&&(identical(other.memberCount, memberCount) || other.memberCount == memberCount)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.nextClassAt, nextClassAt) || other.nextClassAt == nextClassAt)&&(identical(other.nextClassLabel, nextClassLabel) || other.nextClassLabel == nextClassLabel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,about,scopeType,templateCode,role,muted,memberCount,archived,nextClassAt,nextClassLabel);

@override
String toString() {
  return 'SpaceChannel(id: $id, name: $name, about: $about, scopeType: $scopeType, templateCode: $templateCode, role: $role, muted: $muted, memberCount: $memberCount, archived: $archived, nextClassAt: $nextClassAt, nextClassLabel: $nextClassLabel)';
}


}

/// @nodoc
abstract mixin class $SpaceChannelCopyWith<$Res>  {
  factory $SpaceChannelCopyWith(SpaceChannel value, $Res Function(SpaceChannel) _then) = _$SpaceChannelCopyWithImpl;
@useResult
$Res call({
 String id, String name, String about, String scopeType, String templateCode, String role, bool muted, int memberCount, bool archived, String? nextClassAt, String? nextClassLabel
});




}
/// @nodoc
class _$SpaceChannelCopyWithImpl<$Res>
    implements $SpaceChannelCopyWith<$Res> {
  _$SpaceChannelCopyWithImpl(this._self, this._then);

  final SpaceChannel _self;
  final $Res Function(SpaceChannel) _then;

/// Create a copy of SpaceChannel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? about = null,Object? scopeType = null,Object? templateCode = null,Object? role = null,Object? muted = null,Object? memberCount = null,Object? archived = null,Object? nextClassAt = freezed,Object? nextClassLabel = freezed,}) {
  return _then(SpaceChannel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,about: null == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String,scopeType: null == scopeType ? _self.scopeType : scopeType // ignore: cast_nullable_to_non_nullable
as String,templateCode: null == templateCode ? _self.templateCode : templateCode // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,muted: null == muted ? _self.muted : muted // ignore: cast_nullable_to_non_nullable
as bool,memberCount: null == memberCount ? _self.memberCount : memberCount // ignore: cast_nullable_to_non_nullable
as int,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,nextClassAt: freezed == nextClassAt ? _self.nextClassAt : nextClassAt // ignore: cast_nullable_to_non_nullable
as String?,nextClassLabel: freezed == nextClassLabel ? _self.nextClassLabel : nextClassLabel // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SpaceChannel].
extension SpaceChannelPatterns on SpaceChannel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SpaceChannel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SpaceChannel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SpaceChannel value)  $default,){
final _that = this;
switch (_that) {
case _SpaceChannel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SpaceChannel value)?  $default,){
final _that = this;
switch (_that) {
case _SpaceChannel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String about,  String scopeType,  String templateCode,  String role,  bool muted,  int memberCount,  bool archived,  String? nextClassAt,  String? nextClassLabel)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SpaceChannel() when $default != null:
return $default(_that.id,_that.name,_that.about,_that.scopeType,_that.templateCode,_that.role,_that.muted,_that.memberCount,_that.archived,_that.nextClassAt,_that.nextClassLabel);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String about,  String scopeType,  String templateCode,  String role,  bool muted,  int memberCount,  bool archived,  String? nextClassAt,  String? nextClassLabel)  $default,) {final _that = this;
switch (_that) {
case _SpaceChannel():
return $default(_that.id,_that.name,_that.about,_that.scopeType,_that.templateCode,_that.role,_that.muted,_that.memberCount,_that.archived,_that.nextClassAt,_that.nextClassLabel);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String about,  String scopeType,  String templateCode,  String role,  bool muted,  int memberCount,  bool archived,  String? nextClassAt,  String? nextClassLabel)?  $default,) {final _that = this;
switch (_that) {
case _SpaceChannel() when $default != null:
return $default(_that.id,_that.name,_that.about,_that.scopeType,_that.templateCode,_that.role,_that.muted,_that.memberCount,_that.archived,_that.nextClassAt,_that.nextClassLabel);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SpaceChannel implements SpaceChannel {
  const _SpaceChannel({required this.id, required this.name, required this.about, required this.scopeType, required this.templateCode, required this.role, required this.muted, required this.memberCount, required this.archived, this.nextClassAt, this.nextClassLabel});
  factory _SpaceChannel.fromJson(Map<String, dynamic> json) => _$SpaceChannelFromJson(json);

@override final  String id;
@override final  String name;
@override final  String about;
@override final  String scopeType;
@override final  String templateCode;
@override final  String role;
@override final  bool muted;
@override final  int memberCount;
@override final  bool archived;
@override final  String? nextClassAt;
@override final  String? nextClassLabel;

/// Create a copy of SpaceChannel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SpaceChannelCopyWith<_SpaceChannel> get copyWith => __$SpaceChannelCopyWithImpl<_SpaceChannel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SpaceChannelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SpaceChannel&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.about, about) || other.about == about)&&(identical(other.scopeType, scopeType) || other.scopeType == scopeType)&&(identical(other.templateCode, templateCode) || other.templateCode == templateCode)&&(identical(other.role, role) || other.role == role)&&(identical(other.muted, muted) || other.muted == muted)&&(identical(other.memberCount, memberCount) || other.memberCount == memberCount)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.nextClassAt, nextClassAt) || other.nextClassAt == nextClassAt)&&(identical(other.nextClassLabel, nextClassLabel) || other.nextClassLabel == nextClassLabel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,about,scopeType,templateCode,role,muted,memberCount,archived,nextClassAt,nextClassLabel);

@override
String toString() {
  return 'SpaceChannel(id: $id, name: $name, about: $about, scopeType: $scopeType, templateCode: $templateCode, role: $role, muted: $muted, memberCount: $memberCount, archived: $archived, nextClassAt: $nextClassAt, nextClassLabel: $nextClassLabel)';
}


}

/// @nodoc
abstract mixin class _$SpaceChannelCopyWith<$Res> implements $SpaceChannelCopyWith<$Res> {
  factory _$SpaceChannelCopyWith(_SpaceChannel value, $Res Function(_SpaceChannel) _then) = __$SpaceChannelCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String about, String scopeType, String templateCode, String role, bool muted, int memberCount, bool archived, String? nextClassAt, String? nextClassLabel
});




}
/// @nodoc
class __$SpaceChannelCopyWithImpl<$Res>
    implements _$SpaceChannelCopyWith<$Res> {
  __$SpaceChannelCopyWithImpl(this._self, this._then);

  final _SpaceChannel _self;
  final $Res Function(_SpaceChannel) _then;

/// Create a copy of SpaceChannel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? about = null,Object? scopeType = null,Object? templateCode = null,Object? role = null,Object? muted = null,Object? memberCount = null,Object? archived = null,Object? nextClassAt = freezed,Object? nextClassLabel = freezed,}) {
  return _then(_SpaceChannel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,about: null == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String,scopeType: null == scopeType ? _self.scopeType : scopeType // ignore: cast_nullable_to_non_nullable
as String,templateCode: null == templateCode ? _self.templateCode : templateCode // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,muted: null == muted ? _self.muted : muted // ignore: cast_nullable_to_non_nullable
as bool,memberCount: null == memberCount ? _self.memberCount : memberCount // ignore: cast_nullable_to_non_nullable
as int,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,nextClassAt: freezed == nextClassAt ? _self.nextClassAt : nextClassAt // ignore: cast_nullable_to_non_nullable
as String?,nextClassLabel: freezed == nextClassLabel ? _self.nextClassLabel : nextClassLabel // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SpaceGroup {

 String get key; String get title; List<SpaceChannel> get channels; String? get emptyHint;
/// Create a copy of SpaceGroup
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SpaceGroupCopyWith<SpaceGroup> get copyWith => _$SpaceGroupCopyWithImpl<SpaceGroup>(this as SpaceGroup, _$identity);

  /// Serializes this SpaceGroup to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SpaceGroup&&(identical(other.key, key) || other.key == key)&&(identical(other.title, title) || other.title == title)&&const DeepCollectionEquality().equals(other.channels, channels)&&(identical(other.emptyHint, emptyHint) || other.emptyHint == emptyHint));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,key,title,const DeepCollectionEquality().hash(channels),emptyHint);

@override
String toString() {
  return 'SpaceGroup(key: $key, title: $title, channels: $channels, emptyHint: $emptyHint)';
}


}

/// @nodoc
abstract mixin class $SpaceGroupCopyWith<$Res>  {
  factory $SpaceGroupCopyWith(SpaceGroup value, $Res Function(SpaceGroup) _then) = _$SpaceGroupCopyWithImpl;
@useResult
$Res call({
 String key, String title, List<SpaceChannel> channels, String? emptyHint
});




}
/// @nodoc
class _$SpaceGroupCopyWithImpl<$Res>
    implements $SpaceGroupCopyWith<$Res> {
  _$SpaceGroupCopyWithImpl(this._self, this._then);

  final SpaceGroup _self;
  final $Res Function(SpaceGroup) _then;

/// Create a copy of SpaceGroup
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? key = null,Object? title = null,Object? channels = null,Object? emptyHint = freezed,}) {
  return _then(SpaceGroup(
key: null == key ? _self.key : key // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,channels: null == channels ? _self.channels : channels // ignore: cast_nullable_to_non_nullable
as List<SpaceChannel>,emptyHint: freezed == emptyHint ? _self.emptyHint : emptyHint // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SpaceGroup].
extension SpaceGroupPatterns on SpaceGroup {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SpaceGroup value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SpaceGroup() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SpaceGroup value)  $default,){
final _that = this;
switch (_that) {
case _SpaceGroup():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SpaceGroup value)?  $default,){
final _that = this;
switch (_that) {
case _SpaceGroup() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String key,  String title,  List<SpaceChannel> channels,  String? emptyHint)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SpaceGroup() when $default != null:
return $default(_that.key,_that.title,_that.channels,_that.emptyHint);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String key,  String title,  List<SpaceChannel> channels,  String? emptyHint)  $default,) {final _that = this;
switch (_that) {
case _SpaceGroup():
return $default(_that.key,_that.title,_that.channels,_that.emptyHint);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String key,  String title,  List<SpaceChannel> channels,  String? emptyHint)?  $default,) {final _that = this;
switch (_that) {
case _SpaceGroup() when $default != null:
return $default(_that.key,_that.title,_that.channels,_that.emptyHint);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SpaceGroup implements SpaceGroup {
  const _SpaceGroup({required this.key, required this.title, required  List<SpaceChannel> channels, this.emptyHint}): _channels = channels;
  factory _SpaceGroup.fromJson(Map<String, dynamic> json) => _$SpaceGroupFromJson(json);

@override final  String key;
@override final  String title;
 final  List<SpaceChannel> _channels;
@override List<SpaceChannel> get channels {
  if (_channels is EqualUnmodifiableListView) return _channels;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_channels);
}

@override final  String? emptyHint;

/// Create a copy of SpaceGroup
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SpaceGroupCopyWith<_SpaceGroup> get copyWith => __$SpaceGroupCopyWithImpl<_SpaceGroup>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SpaceGroupToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SpaceGroup&&(identical(other.key, key) || other.key == key)&&(identical(other.title, title) || other.title == title)&&const DeepCollectionEquality().equals(other._channels, _channels)&&(identical(other.emptyHint, emptyHint) || other.emptyHint == emptyHint));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,key,title,const DeepCollectionEquality().hash(_channels),emptyHint);

@override
String toString() {
  return 'SpaceGroup(key: $key, title: $title, channels: $channels, emptyHint: $emptyHint)';
}


}

/// @nodoc
abstract mixin class _$SpaceGroupCopyWith<$Res> implements $SpaceGroupCopyWith<$Res> {
  factory _$SpaceGroupCopyWith(_SpaceGroup value, $Res Function(_SpaceGroup) _then) = __$SpaceGroupCopyWithImpl;
@override @useResult
$Res call({
 String key, String title, List<SpaceChannel> channels, String? emptyHint
});




}
/// @nodoc
class __$SpaceGroupCopyWithImpl<$Res>
    implements _$SpaceGroupCopyWith<$Res> {
  __$SpaceGroupCopyWithImpl(this._self, this._then);

  final _SpaceGroup _self;
  final $Res Function(_SpaceGroup) _then;

/// Create a copy of SpaceGroup
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? key = null,Object? title = null,Object? channels = null,Object? emptyHint = freezed,}) {
  return _then(_SpaceGroup(
key: null == key ? _self.key : key // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,channels: null == channels ? _self._channels : channels // ignore: cast_nullable_to_non_nullable
as List<SpaceChannel>,emptyHint: freezed == emptyHint ? _self.emptyHint : emptyHint // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SpacesData {

 List<SpaceGroup> get groups; String get asOf;
/// Create a copy of SpacesData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SpacesDataCopyWith<SpacesData> get copyWith => _$SpacesDataCopyWithImpl<SpacesData>(this as SpacesData, _$identity);

  /// Serializes this SpacesData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SpacesData&&const DeepCollectionEquality().equals(other.groups, groups)&&(identical(other.asOf, asOf) || other.asOf == asOf));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(groups),asOf);

@override
String toString() {
  return 'SpacesData(groups: $groups, asOf: $asOf)';
}


}

/// @nodoc
abstract mixin class $SpacesDataCopyWith<$Res>  {
  factory $SpacesDataCopyWith(SpacesData value, $Res Function(SpacesData) _then) = _$SpacesDataCopyWithImpl;
@useResult
$Res call({
 List<SpaceGroup> groups, String asOf
});




}
/// @nodoc
class _$SpacesDataCopyWithImpl<$Res>
    implements $SpacesDataCopyWith<$Res> {
  _$SpacesDataCopyWithImpl(this._self, this._then);

  final SpacesData _self;
  final $Res Function(SpacesData) _then;

/// Create a copy of SpacesData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? groups = null,Object? asOf = null,}) {
  return _then(SpacesData(
groups: null == groups ? _self.groups : groups // ignore: cast_nullable_to_non_nullable
as List<SpaceGroup>,asOf: null == asOf ? _self.asOf : asOf // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SpacesData].
extension SpacesDataPatterns on SpacesData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SpacesData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SpacesData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SpacesData value)  $default,){
final _that = this;
switch (_that) {
case _SpacesData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SpacesData value)?  $default,){
final _that = this;
switch (_that) {
case _SpacesData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<SpaceGroup> groups,  String asOf)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SpacesData() when $default != null:
return $default(_that.groups,_that.asOf);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<SpaceGroup> groups,  String asOf)  $default,) {final _that = this;
switch (_that) {
case _SpacesData():
return $default(_that.groups,_that.asOf);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<SpaceGroup> groups,  String asOf)?  $default,) {final _that = this;
switch (_that) {
case _SpacesData() when $default != null:
return $default(_that.groups,_that.asOf);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SpacesData implements SpacesData {
  const _SpacesData({required  List<SpaceGroup> groups, required this.asOf}): _groups = groups;
  factory _SpacesData.fromJson(Map<String, dynamic> json) => _$SpacesDataFromJson(json);

 final  List<SpaceGroup> _groups;
@override List<SpaceGroup> get groups {
  if (_groups is EqualUnmodifiableListView) return _groups;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_groups);
}

@override final  String asOf;

/// Create a copy of SpacesData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SpacesDataCopyWith<_SpacesData> get copyWith => __$SpacesDataCopyWithImpl<_SpacesData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SpacesDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SpacesData&&const DeepCollectionEquality().equals(other._groups, _groups)&&(identical(other.asOf, asOf) || other.asOf == asOf));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_groups),asOf);

@override
String toString() {
  return 'SpacesData(groups: $groups, asOf: $asOf)';
}


}

/// @nodoc
abstract mixin class _$SpacesDataCopyWith<$Res> implements $SpacesDataCopyWith<$Res> {
  factory _$SpacesDataCopyWith(_SpacesData value, $Res Function(_SpacesData) _then) = __$SpacesDataCopyWithImpl;
@override @useResult
$Res call({
 List<SpaceGroup> groups, String asOf
});




}
/// @nodoc
class __$SpacesDataCopyWithImpl<$Res>
    implements _$SpacesDataCopyWith<$Res> {
  __$SpacesDataCopyWithImpl(this._self, this._then);

  final _SpacesData _self;
  final $Res Function(_SpacesData) _then;

/// Create a copy of SpacesData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? groups = null,Object? asOf = null,}) {
  return _then(_SpacesData(
groups: null == groups ? _self._groups : groups // ignore: cast_nullable_to_non_nullable
as List<SpaceGroup>,asOf: null == asOf ? _self.asOf : asOf // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ChannelDetail {

 String get id; String get name; String get about; String get scopeType; String get templateCode; String get status; int get memberCount; String get replyRule; String get defaultPriority; String get role; bool get muted; bool get canPost; bool get canReply; String get whoCanPost;
/// Create a copy of ChannelDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ChannelDetailCopyWith<ChannelDetail> get copyWith => _$ChannelDetailCopyWithImpl<ChannelDetail>(this as ChannelDetail, _$identity);

  /// Serializes this ChannelDetail to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ChannelDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.about, about) || other.about == about)&&(identical(other.scopeType, scopeType) || other.scopeType == scopeType)&&(identical(other.templateCode, templateCode) || other.templateCode == templateCode)&&(identical(other.status, status) || other.status == status)&&(identical(other.memberCount, memberCount) || other.memberCount == memberCount)&&(identical(other.replyRule, replyRule) || other.replyRule == replyRule)&&(identical(other.defaultPriority, defaultPriority) || other.defaultPriority == defaultPriority)&&(identical(other.role, role) || other.role == role)&&(identical(other.muted, muted) || other.muted == muted)&&(identical(other.canPost, canPost) || other.canPost == canPost)&&(identical(other.canReply, canReply) || other.canReply == canReply)&&(identical(other.whoCanPost, whoCanPost) || other.whoCanPost == whoCanPost));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,about,scopeType,templateCode,status,memberCount,replyRule,defaultPriority,role,muted,canPost,canReply,whoCanPost);

@override
String toString() {
  return 'ChannelDetail(id: $id, name: $name, about: $about, scopeType: $scopeType, templateCode: $templateCode, status: $status, memberCount: $memberCount, replyRule: $replyRule, defaultPriority: $defaultPriority, role: $role, muted: $muted, canPost: $canPost, canReply: $canReply, whoCanPost: $whoCanPost)';
}


}

/// @nodoc
abstract mixin class $ChannelDetailCopyWith<$Res>  {
  factory $ChannelDetailCopyWith(ChannelDetail value, $Res Function(ChannelDetail) _then) = _$ChannelDetailCopyWithImpl;
@useResult
$Res call({
 String id, String name, String about, String scopeType, String templateCode, String status, int memberCount, String replyRule, String defaultPriority, String role, bool muted, bool canPost, bool canReply, String whoCanPost
});




}
/// @nodoc
class _$ChannelDetailCopyWithImpl<$Res>
    implements $ChannelDetailCopyWith<$Res> {
  _$ChannelDetailCopyWithImpl(this._self, this._then);

  final ChannelDetail _self;
  final $Res Function(ChannelDetail) _then;

/// Create a copy of ChannelDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? about = null,Object? scopeType = null,Object? templateCode = null,Object? status = null,Object? memberCount = null,Object? replyRule = null,Object? defaultPriority = null,Object? role = null,Object? muted = null,Object? canPost = null,Object? canReply = null,Object? whoCanPost = null,}) {
  return _then(ChannelDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,about: null == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String,scopeType: null == scopeType ? _self.scopeType : scopeType // ignore: cast_nullable_to_non_nullable
as String,templateCode: null == templateCode ? _self.templateCode : templateCode // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,memberCount: null == memberCount ? _self.memberCount : memberCount // ignore: cast_nullable_to_non_nullable
as int,replyRule: null == replyRule ? _self.replyRule : replyRule // ignore: cast_nullable_to_non_nullable
as String,defaultPriority: null == defaultPriority ? _self.defaultPriority : defaultPriority // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,muted: null == muted ? _self.muted : muted // ignore: cast_nullable_to_non_nullable
as bool,canPost: null == canPost ? _self.canPost : canPost // ignore: cast_nullable_to_non_nullable
as bool,canReply: null == canReply ? _self.canReply : canReply // ignore: cast_nullable_to_non_nullable
as bool,whoCanPost: null == whoCanPost ? _self.whoCanPost : whoCanPost // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ChannelDetail].
extension ChannelDetailPatterns on ChannelDetail {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ChannelDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ChannelDetail() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ChannelDetail value)  $default,){
final _that = this;
switch (_that) {
case _ChannelDetail():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ChannelDetail value)?  $default,){
final _that = this;
switch (_that) {
case _ChannelDetail() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String about,  String scopeType,  String templateCode,  String status,  int memberCount,  String replyRule,  String defaultPriority,  String role,  bool muted,  bool canPost,  bool canReply,  String whoCanPost)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ChannelDetail() when $default != null:
return $default(_that.id,_that.name,_that.about,_that.scopeType,_that.templateCode,_that.status,_that.memberCount,_that.replyRule,_that.defaultPriority,_that.role,_that.muted,_that.canPost,_that.canReply,_that.whoCanPost);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String about,  String scopeType,  String templateCode,  String status,  int memberCount,  String replyRule,  String defaultPriority,  String role,  bool muted,  bool canPost,  bool canReply,  String whoCanPost)  $default,) {final _that = this;
switch (_that) {
case _ChannelDetail():
return $default(_that.id,_that.name,_that.about,_that.scopeType,_that.templateCode,_that.status,_that.memberCount,_that.replyRule,_that.defaultPriority,_that.role,_that.muted,_that.canPost,_that.canReply,_that.whoCanPost);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String about,  String scopeType,  String templateCode,  String status,  int memberCount,  String replyRule,  String defaultPriority,  String role,  bool muted,  bool canPost,  bool canReply,  String whoCanPost)?  $default,) {final _that = this;
switch (_that) {
case _ChannelDetail() when $default != null:
return $default(_that.id,_that.name,_that.about,_that.scopeType,_that.templateCode,_that.status,_that.memberCount,_that.replyRule,_that.defaultPriority,_that.role,_that.muted,_that.canPost,_that.canReply,_that.whoCanPost);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ChannelDetail implements ChannelDetail {
  const _ChannelDetail({required this.id, required this.name, required this.about, required this.scopeType, required this.templateCode, required this.status, required this.memberCount, required this.replyRule, required this.defaultPriority, required this.role, required this.muted, required this.canPost, required this.canReply, required this.whoCanPost});
  factory _ChannelDetail.fromJson(Map<String, dynamic> json) => _$ChannelDetailFromJson(json);

@override final  String id;
@override final  String name;
@override final  String about;
@override final  String scopeType;
@override final  String templateCode;
@override final  String status;
@override final  int memberCount;
@override final  String replyRule;
@override final  String defaultPriority;
@override final  String role;
@override final  bool muted;
@override final  bool canPost;
@override final  bool canReply;
@override final  String whoCanPost;

/// Create a copy of ChannelDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ChannelDetailCopyWith<_ChannelDetail> get copyWith => __$ChannelDetailCopyWithImpl<_ChannelDetail>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ChannelDetailToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ChannelDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.about, about) || other.about == about)&&(identical(other.scopeType, scopeType) || other.scopeType == scopeType)&&(identical(other.templateCode, templateCode) || other.templateCode == templateCode)&&(identical(other.status, status) || other.status == status)&&(identical(other.memberCount, memberCount) || other.memberCount == memberCount)&&(identical(other.replyRule, replyRule) || other.replyRule == replyRule)&&(identical(other.defaultPriority, defaultPriority) || other.defaultPriority == defaultPriority)&&(identical(other.role, role) || other.role == role)&&(identical(other.muted, muted) || other.muted == muted)&&(identical(other.canPost, canPost) || other.canPost == canPost)&&(identical(other.canReply, canReply) || other.canReply == canReply)&&(identical(other.whoCanPost, whoCanPost) || other.whoCanPost == whoCanPost));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,about,scopeType,templateCode,status,memberCount,replyRule,defaultPriority,role,muted,canPost,canReply,whoCanPost);

@override
String toString() {
  return 'ChannelDetail(id: $id, name: $name, about: $about, scopeType: $scopeType, templateCode: $templateCode, status: $status, memberCount: $memberCount, replyRule: $replyRule, defaultPriority: $defaultPriority, role: $role, muted: $muted, canPost: $canPost, canReply: $canReply, whoCanPost: $whoCanPost)';
}


}

/// @nodoc
abstract mixin class _$ChannelDetailCopyWith<$Res> implements $ChannelDetailCopyWith<$Res> {
  factory _$ChannelDetailCopyWith(_ChannelDetail value, $Res Function(_ChannelDetail) _then) = __$ChannelDetailCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String about, String scopeType, String templateCode, String status, int memberCount, String replyRule, String defaultPriority, String role, bool muted, bool canPost, bool canReply, String whoCanPost
});




}
/// @nodoc
class __$ChannelDetailCopyWithImpl<$Res>
    implements _$ChannelDetailCopyWith<$Res> {
  __$ChannelDetailCopyWithImpl(this._self, this._then);

  final _ChannelDetail _self;
  final $Res Function(_ChannelDetail) _then;

/// Create a copy of ChannelDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? about = null,Object? scopeType = null,Object? templateCode = null,Object? status = null,Object? memberCount = null,Object? replyRule = null,Object? defaultPriority = null,Object? role = null,Object? muted = null,Object? canPost = null,Object? canReply = null,Object? whoCanPost = null,}) {
  return _then(_ChannelDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,about: null == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String,scopeType: null == scopeType ? _self.scopeType : scopeType // ignore: cast_nullable_to_non_nullable
as String,templateCode: null == templateCode ? _self.templateCode : templateCode // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,memberCount: null == memberCount ? _self.memberCount : memberCount // ignore: cast_nullable_to_non_nullable
as int,replyRule: null == replyRule ? _self.replyRule : replyRule // ignore: cast_nullable_to_non_nullable
as String,defaultPriority: null == defaultPriority ? _self.defaultPriority : defaultPriority // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,muted: null == muted ? _self.muted : muted // ignore: cast_nullable_to_non_nullable
as bool,canPost: null == canPost ? _self.canPost : canPost // ignore: cast_nullable_to_non_nullable
as bool,canReply: null == canReply ? _self.canReply : canReply // ignore: cast_nullable_to_non_nullable
as bool,whoCanPost: null == whoCanPost ? _self.whoCanPost : whoCanPost // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
