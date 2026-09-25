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

// dart format on
