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
  String get passwordStrengthStrong => 'Strong';

  @override
  String get passwordStrengthGood => 'Good';

  @override
  String get passwordStrengthOk => 'OK';

  @override
  String get passwordStrengthTooShort => 'Too short';

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

  @override
  String get todayAttentionSection => 'Attention';

  @override
  String get todayTimelineSection => 'Timeline';

  @override
  String get todayGlanceSection => 'At a glance';

  @override
  String get todayGlancePlaceholder => 'Attendance and dues appear here soon';

  @override
  String get teachingAcknowledgementsSection => 'My acknowledgements';

  @override
  String get teachingTodaySection => 'Teaching today';

  @override
  String get teachingDepartmentSection => 'Department';

  @override
  String get teachingCollegeSection => 'College';

  @override
  String get facultyHod => 'Head of department';

  @override
  String studentSectionLabel(String section) {
    return 'Section $section';
  }

  @override
  String get meChangePhoto => 'Change profile photo';

  @override
  String get meReportIssue => 'Something wrong? Tell the office';

  @override
  String get meSomethingWrongTitle => 'Something wrong with your details?';

  @override
  String get meSomethingWrongBody =>
      'Juvi shows what your college records hold. The office can correct them.';

  @override
  String get meSettingsSectionTitle => 'Settings';

  @override
  String get settingsTitle => 'Notifications and quiet hours';

  @override
  String get devicesTitle => 'Devices';

  @override
  String get changePasswordTitle => 'Change password';

  @override
  String get meAboutSection => 'About';

  @override
  String meAppVersion(String version) {
    return 'Juvi $version';
  }

  @override
  String get meDataPrivacyNote =>
      'Your data stays with your institution. Juvi never shares it with third parties.';

  @override
  String get meSignOut => 'Sign out';

  @override
  String get settingsTiersSection => 'Notification tiers';

  @override
  String get settingsTierUrgent => 'Urgent';

  @override
  String get settingsTierUrgentDesc =>
      'Exam changes, campus closures. Always delivered; cannot be turned off.';

  @override
  String get settingsTierImportant => 'Important';

  @override
  String get settingsTierImportantDesc =>
      'Notices needing acknowledgement, department posts, mentions.';

  @override
  String get settingsTierRoutine => 'Routine';

  @override
  String get settingsTierRoutineDesc =>
      'Course posts and replies. Badge and digest only, no sound.';

  @override
  String get settingsQuietHoursSection => 'Quiet hours';

  @override
  String get settingsQuietStart => 'Start';

  @override
  String get settingsQuietEnd => 'End';

  @override
  String get settingsAppearanceSection => 'Appearance';

  @override
  String get settingsThemeSystem => 'Follow system';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsLanguageSection => 'Language';

  @override
  String get settingsLanguageEnglish => 'English';

  @override
  String get settingsLanguageMore => 'More languages are planned.';

  @override
  String deviceCurrentLabel(String name) {
    return '$name (this device)';
  }

  @override
  String deviceLastActive(String version, String time) {
    return 'v$version · last active $time';
  }

  @override
  String get deviceSignOutTooltip => 'Sign out this device';

  @override
  String get deviceSignOutOthers => 'Sign out other devices';

  @override
  String get changePasswordSuccess =>
      'Password changed. Other devices were signed out.';

  @override
  String get changePasswordNeedsConnection =>
      'Changing your password needs a connection.';

  @override
  String get photoUploadNeedsConnection => 'Photo upload needs a connection.';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get channelMute => 'Mute';

  @override
  String get channelUnmute => 'Unmute';

  @override
  String get channelMarkAllRead => 'Mark all read';

  @override
  String get channelActionsLabel => 'Channel actions';

  @override
  String get channelMutedLabel => 'Muted';

  @override
  String get channelAboutTitle => 'About';

  @override
  String channelWhoCanPost(String whoCanPost) {
    return 'Who can post: $whoCanPost';
  }

  @override
  String get channelReplyAllowed => 'Members can reply in threads.';

  @override
  String get channelAnnouncementOnly => 'Announcement only.';

  @override
  String channelMemberCount(int count) {
    return '$count members';
  }

  @override
  String channelMemberCountArchived(int count) {
    return '$count members · Archived';
  }

  @override
  String get onboardingContinue => 'Continue';

  @override
  String get onboardingFinish => 'Finish';

  @override
  String onboardingStepOfTotal(int step, int total) {
    return 'Step $step of $total';
  }

  @override
  String get onboardingStepNeedsConnection => 'This step needs a connection.';

  @override
  String get onboardingUnknownStepBody =>
      'One more thing from your college is on its way. Continue for now.';

  @override
  String get onboardingIdentityTitle => 'Your college has set you up';

  @override
  String onboardingIdentityBody(String institution) {
    return 'Here\'s what $institution has on record. Nothing to fill in.';
  }

  @override
  String get onboardingAddPhoto => 'Add a photo (optional)';

  @override
  String get onboardingSpacesTitle => 'Your spaces';

  @override
  String get onboardingSpacesBodyStudent =>
      'One space for the college, your department, your batch and each course. They come from your registrations, so nothing to set up.';

  @override
  String get onboardingSpacesBodyLateral =>
      'You\'re joining the batch mid-way, so your spaces match the courses you\'re registered for now. First-year spaces aren\'t included.';

  @override
  String get onboardingSpacesBodyFaculty =>
      'One space per course you teach, plus your department and the college.';

  @override
  String get onboardingSpacesOffline =>
      'Spaces will appear once you are online.';

  @override
  String get onboardingNotificationsTitle => 'Stay informed, not overwhelmed';
}
