// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'session_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$SessionState {





@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionState);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'SessionState()';
}


}

/// @nodoc
class $SessionStateCopyWith<$Res>  {
$SessionStateCopyWith(SessionState _, $Res Function(SessionState) __);
}


/// Adds pattern-matching-related methods to [SessionState].
extension SessionStatePatterns on SessionState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>({TResult Function( SessionLoading value)?  loading,TResult Function( SignedOut value)?  signedOut,TResult Function( SignedIn value)?  signedIn,TResult Function( Deactivated value)?  deactivated,TResult Function( Paused value)?  paused,TResult Function( UpdateRequired value)?  updateRequired,required TResult orElse(),}){
final _that = this;
switch (_that) {
case SessionLoading() when loading != null:
return loading(_that);case SignedOut() when signedOut != null:
return signedOut(_that);case SignedIn() when signedIn != null:
return signedIn(_that);case Deactivated() when deactivated != null:
return deactivated(_that);case Paused() when paused != null:
return paused(_that);case UpdateRequired() when updateRequired != null:
return updateRequired(_that);case _:
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

@optionalTypeArgs TResult map<TResult extends Object?>({required TResult Function( SessionLoading value)  loading,required TResult Function( SignedOut value)  signedOut,required TResult Function( SignedIn value)  signedIn,required TResult Function( Deactivated value)  deactivated,required TResult Function( Paused value)  paused,required TResult Function( UpdateRequired value)  updateRequired,}){
final _that = this;
switch (_that) {
case SessionLoading():
return loading(_that);case SignedOut():
return signedOut(_that);case SignedIn():
return signedIn(_that);case Deactivated():
return deactivated(_that);case Paused():
return paused(_that);case UpdateRequired():
return updateRequired(_that);}
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>({TResult? Function( SessionLoading value)?  loading,TResult? Function( SignedOut value)?  signedOut,TResult? Function( SignedIn value)?  signedIn,TResult? Function( Deactivated value)?  deactivated,TResult? Function( Paused value)?  paused,TResult? Function( UpdateRequired value)?  updateRequired,}){
final _that = this;
switch (_that) {
case SessionLoading() when loading != null:
return loading(_that);case SignedOut() when signedOut != null:
return signedOut(_that);case SignedIn() when signedIn != null:
return signedIn(_that);case Deactivated() when deactivated != null:
return deactivated(_that);case Paused() when paused != null:
return paused(_that);case UpdateRequired() when updateRequired != null:
return updateRequired(_that);case _:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>({TResult Function()?  loading,TResult Function( String? reason)?  signedOut,TResult Function( AccountSummary account)?  signedIn,TResult Function( SupportContact? supportContact)?  deactivated,TResult Function( String message)?  paused,TResult Function( String minVersion,  String storeUrl)?  updateRequired,required TResult orElse(),}) {final _that = this;
switch (_that) {
case SessionLoading() when loading != null:
return loading();case SignedOut() when signedOut != null:
return signedOut(_that.reason);case SignedIn() when signedIn != null:
return signedIn(_that.account);case Deactivated() when deactivated != null:
return deactivated(_that.supportContact);case Paused() when paused != null:
return paused(_that.message);case UpdateRequired() when updateRequired != null:
return updateRequired(_that.minVersion,_that.storeUrl);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>({required TResult Function()  loading,required TResult Function( String? reason)  signedOut,required TResult Function( AccountSummary account)  signedIn,required TResult Function( SupportContact? supportContact)  deactivated,required TResult Function( String message)  paused,required TResult Function( String minVersion,  String storeUrl)  updateRequired,}) {final _that = this;
switch (_that) {
case SessionLoading():
return loading();case SignedOut():
return signedOut(_that.reason);case SignedIn():
return signedIn(_that.account);case Deactivated():
return deactivated(_that.supportContact);case Paused():
return paused(_that.message);case UpdateRequired():
return updateRequired(_that.minVersion,_that.storeUrl);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>({TResult? Function()?  loading,TResult? Function( String? reason)?  signedOut,TResult? Function( AccountSummary account)?  signedIn,TResult? Function( SupportContact? supportContact)?  deactivated,TResult? Function( String message)?  paused,TResult? Function( String minVersion,  String storeUrl)?  updateRequired,}) {final _that = this;
switch (_that) {
case SessionLoading() when loading != null:
return loading();case SignedOut() when signedOut != null:
return signedOut(_that.reason);case SignedIn() when signedIn != null:
return signedIn(_that.account);case Deactivated() when deactivated != null:
return deactivated(_that.supportContact);case Paused() when paused != null:
return paused(_that.message);case UpdateRequired() when updateRequired != null:
return updateRequired(_that.minVersion,_that.storeUrl);case _:
  return null;

}
}

}

/// @nodoc


class SessionLoading implements SessionState {
  const SessionLoading();
  






@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionLoading);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'SessionState.loading()';
}


}




/// @nodoc


class SignedOut implements SessionState {
  const SignedOut({this.reason});
  

 final  String? reason;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SignedOutCopyWith<SignedOut> get copyWith => _$SignedOutCopyWithImpl<SignedOut>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SignedOut&&(identical(other.reason, reason) || other.reason == reason));
}


@override
int get hashCode => Object.hash(runtimeType,reason);

@override
String toString() {
  return 'SessionState.signedOut(reason: $reason)';
}


}

/// @nodoc
abstract mixin class $SignedOutCopyWith<$Res> implements $SessionStateCopyWith<$Res> {
  factory $SignedOutCopyWith(SignedOut value, $Res Function(SignedOut) _then) = _$SignedOutCopyWithImpl;
@useResult
$Res call({
 String? reason
});




}
/// @nodoc
class _$SignedOutCopyWithImpl<$Res>
    implements $SignedOutCopyWith<$Res> {
  _$SignedOutCopyWithImpl(this._self, this._then);

  final SignedOut _self;
  final $Res Function(SignedOut) _then;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? reason = freezed,}) {
  return _then(SignedOut(
reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

/// @nodoc


class SignedIn implements SessionState {
  const SignedIn(this.account);
  

 final  AccountSummary account;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SignedInCopyWith<SignedIn> get copyWith => _$SignedInCopyWithImpl<SignedIn>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SignedIn&&(identical(other.account, account) || other.account == account));
}


@override
int get hashCode => Object.hash(runtimeType,account);

@override
String toString() {
  return 'SessionState.signedIn(account: $account)';
}


}

/// @nodoc
abstract mixin class $SignedInCopyWith<$Res> implements $SessionStateCopyWith<$Res> {
  factory $SignedInCopyWith(SignedIn value, $Res Function(SignedIn) _then) = _$SignedInCopyWithImpl;
@useResult
$Res call({
 AccountSummary account
});


$AccountSummaryCopyWith<$Res> get account;

}
/// @nodoc
class _$SignedInCopyWithImpl<$Res>
    implements $SignedInCopyWith<$Res> {
  _$SignedInCopyWithImpl(this._self, this._then);

  final SignedIn _self;
  final $Res Function(SignedIn) _then;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? account = null,}) {
  return _then(SignedIn(
null == account ? _self.account : account // ignore: cast_nullable_to_non_nullable
as AccountSummary,
  ));
}

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AccountSummaryCopyWith<$Res> get account {
  
  return $AccountSummaryCopyWith<$Res>(_self.account, (value) {
    return _then(_self.copyWith(account: value));
  });
}
}

/// @nodoc


class Deactivated implements SessionState {
  const Deactivated({this.supportContact});
  

 final  SupportContact? supportContact;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DeactivatedCopyWith<Deactivated> get copyWith => _$DeactivatedCopyWithImpl<Deactivated>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Deactivated&&(identical(other.supportContact, supportContact) || other.supportContact == supportContact));
}


@override
int get hashCode => Object.hash(runtimeType,supportContact);

@override
String toString() {
  return 'SessionState.deactivated(supportContact: $supportContact)';
}


}

/// @nodoc
abstract mixin class $DeactivatedCopyWith<$Res> implements $SessionStateCopyWith<$Res> {
  factory $DeactivatedCopyWith(Deactivated value, $Res Function(Deactivated) _then) = _$DeactivatedCopyWithImpl;
@useResult
$Res call({
 SupportContact? supportContact
});


$SupportContactCopyWith<$Res>? get supportContact;

}
/// @nodoc
class _$DeactivatedCopyWithImpl<$Res>
    implements $DeactivatedCopyWith<$Res> {
  _$DeactivatedCopyWithImpl(this._self, this._then);

  final Deactivated _self;
  final $Res Function(Deactivated) _then;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? supportContact = freezed,}) {
  return _then(Deactivated(
supportContact: freezed == supportContact ? _self.supportContact : supportContact // ignore: cast_nullable_to_non_nullable
as SupportContact?,
  ));
}

/// Create a copy of SessionState
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


class Paused implements SessionState {
  const Paused(this.message);
  

 final  String message;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PausedCopyWith<Paused> get copyWith => _$PausedCopyWithImpl<Paused>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Paused&&(identical(other.message, message) || other.message == message));
}


@override
int get hashCode => Object.hash(runtimeType,message);

@override
String toString() {
  return 'SessionState.paused(message: $message)';
}


}

/// @nodoc
abstract mixin class $PausedCopyWith<$Res> implements $SessionStateCopyWith<$Res> {
  factory $PausedCopyWith(Paused value, $Res Function(Paused) _then) = _$PausedCopyWithImpl;
@useResult
$Res call({
 String message
});




}
/// @nodoc
class _$PausedCopyWithImpl<$Res>
    implements $PausedCopyWith<$Res> {
  _$PausedCopyWithImpl(this._self, this._then);

  final Paused _self;
  final $Res Function(Paused) _then;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? message = null,}) {
  return _then(Paused(
null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

/// @nodoc


class UpdateRequired implements SessionState {
  const UpdateRequired({required this.minVersion, required this.storeUrl});
  

 final  String minVersion;
 final  String storeUrl;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UpdateRequiredCopyWith<UpdateRequired> get copyWith => _$UpdateRequiredCopyWithImpl<UpdateRequired>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UpdateRequired&&(identical(other.minVersion, minVersion) || other.minVersion == minVersion)&&(identical(other.storeUrl, storeUrl) || other.storeUrl == storeUrl));
}


@override
int get hashCode => Object.hash(runtimeType,minVersion,storeUrl);

@override
String toString() {
  return 'SessionState.updateRequired(minVersion: $minVersion, storeUrl: $storeUrl)';
}


}

/// @nodoc
abstract mixin class $UpdateRequiredCopyWith<$Res> implements $SessionStateCopyWith<$Res> {
  factory $UpdateRequiredCopyWith(UpdateRequired value, $Res Function(UpdateRequired) _then) = _$UpdateRequiredCopyWithImpl;
@useResult
$Res call({
 String minVersion, String storeUrl
});




}
/// @nodoc
class _$UpdateRequiredCopyWithImpl<$Res>
    implements $UpdateRequiredCopyWith<$Res> {
  _$UpdateRequiredCopyWithImpl(this._self, this._then);

  final UpdateRequired _self;
  final $Res Function(UpdateRequired) _then;

/// Create a copy of SessionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? minVersion = null,Object? storeUrl = null,}) {
  return _then(UpdateRequired(
minVersion: null == minVersion ? _self.minVersion : minVersion // ignore: cast_nullable_to_non_nullable
as String,storeUrl: null == storeUrl ? _self.storeUrl : storeUrl // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
