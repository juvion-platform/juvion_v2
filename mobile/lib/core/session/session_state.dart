import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:juvi/core/models/models.dart';

part 'session_state.freezed.dart';

@freezed
sealed class SessionState with _$SessionState {
  const factory SessionState.loading() = SessionLoading;
  const factory SessionState.signedOut({String? reason}) = SignedOut;
  const factory SessionState.signedIn(AccountSummary account) = SignedIn;
  const factory SessionState.deactivated({SupportContact? supportContact}) = Deactivated;
  const factory SessionState.paused(String message) = Paused;
  const factory SessionState.updateRequired({required String minVersion, required String storeUrl}) = UpdateRequired;
}
