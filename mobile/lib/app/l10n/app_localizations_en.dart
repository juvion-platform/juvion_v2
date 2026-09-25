// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Juvi';

  @override
  String get signInTitle => 'Sign in to your college';

  @override
  String get institutionCodeLabel => 'Institution code';

  @override
  String get institutionCodeNotFound => 'We couldn\'t find that college code.';

  @override
  String get identifierLabel => 'Roll number, employee code or email';

  @override
  String get passwordLabel => 'Password';

  @override
  String get signInButton => 'Sign in';

  @override
  String get firstTimeHint =>
      'First time? Use the temporary password you received.';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get forgotPasswordBody =>
      'Your college resets Juvi passwords. Contact the office listed below and they will give you a new temporary password.';

  @override
  String get invalidCredentials => 'That identifier or password is not right.';

  @override
  String cooldownMessage(int minutes) {
    return 'Too many attempts. Try again in $minutes minutes.';
  }

  @override
  String get signInNeedsConnection =>
      'Signing in needs a connection. Your last content is still available once you\'re back online.';

  @override
  String get setPasswordTitle => 'Set your password';

  @override
  String get setPasswordBody =>
      'Choose a password you\'ll remember. At least 8 characters.';

  @override
  String get newPasswordLabel => 'New password';

  @override
  String get currentPasswordLabel => 'Current password';

  @override
  String get savePassword => 'Save password';

  @override
  String get passwordTooShort => 'Use at least 8 characters';

  @override
  String get youreClear => 'You\'re clear';

  @override
  String get youreClearHint => 'Nothing needs your attention right now.';

  @override
  String get noClassesToday => 'No classes today';

  @override
  String get nothingNew => 'Nothing new';

  @override
  String asOf(String time) {
    return 'As of $time';
  }

  @override
  String get offlineBanner => 'You\'re offline. Showing what you last saw.';

  @override
  String get retry => 'Try again';

  @override
  String get tabToday => 'Today';

  @override
  String get tabTeaching => 'Teaching';

  @override
  String get tabSpaces => 'Spaces';

  @override
  String get tabMe => 'Me';

  @override
  String get deactivatedTitle => 'This account is no longer active';

  @override
  String get deactivatedBody =>
      'Your institution has closed your Juvi account. If that\'s a mistake, contact the office below.';

  @override
  String get pausedTitle => 'Juvi is paused';

  @override
  String get updateRequiredTitle => 'Update Juvi to continue';

  @override
  String updateRequiredBody(String version) {
    return 'Your college needs version $version or later.';
  }

  @override
  String get openStore => 'Open the store';

  @override
  String get signedOutElsewhere => 'You were signed out from another device.';

  @override
  String get signedOutPasswordChanged =>
      'Your password was changed. Sign in again.';

  @override
  String get signedOutGeneric => 'Please sign in again.';
}
