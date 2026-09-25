import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('en')];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'Juvi'**
  String get appName;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to your college'**
  String get signInTitle;

  /// No description provided for @institutionCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Institution code'**
  String get institutionCodeLabel;

  /// No description provided for @institutionCodeNotFound.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find that college code.'**
  String get institutionCodeNotFound;

  /// No description provided for @identifierLabel.
  ///
  /// In en, this message translates to:
  /// **'Roll number, employee code or email'**
  String get identifierLabel;

  /// No description provided for @passwordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordLabel;

  /// No description provided for @signInButton.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signInButton;

  /// No description provided for @firstTimeHint.
  ///
  /// In en, this message translates to:
  /// **'First time? Use the temporary password you received.'**
  String get firstTimeHint;

  /// No description provided for @forgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get forgotPassword;

  /// No description provided for @forgotPasswordBody.
  ///
  /// In en, this message translates to:
  /// **'Your college resets Juvi passwords. Contact the office listed below and they will give you a new temporary password.'**
  String get forgotPasswordBody;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'That identifier or password is not right.'**
  String get invalidCredentials;

  /// No description provided for @cooldownMessage.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Try again in {minutes} minutes.'**
  String cooldownMessage(int minutes);

  /// No description provided for @signInNeedsConnection.
  ///
  /// In en, this message translates to:
  /// **'Signing in needs a connection. Your last content is still available once you\'re back online.'**
  String get signInNeedsConnection;

  /// No description provided for @setPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Set your password'**
  String get setPasswordTitle;

  /// No description provided for @setPasswordBody.
  ///
  /// In en, this message translates to:
  /// **'Choose a password you\'ll remember. At least 8 characters.'**
  String get setPasswordBody;

  /// No description provided for @newPasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get newPasswordLabel;

  /// No description provided for @currentPasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'Current password'**
  String get currentPasswordLabel;

  /// No description provided for @savePassword.
  ///
  /// In en, this message translates to:
  /// **'Save password'**
  String get savePassword;

  /// No description provided for @passwordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters'**
  String get passwordTooShort;

  /// New-password strength hint: 16 or more characters.
  ///
  /// In en, this message translates to:
  /// **'Strong'**
  String get passwordStrengthStrong;

  /// New-password strength hint: 12-15 characters.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get passwordStrengthGood;

  /// New-password strength hint: 8-11 characters, the minimum accepted length.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get passwordStrengthOk;

  /// New-password strength hint: fewer than 8 characters, not yet accepted.
  ///
  /// In en, this message translates to:
  /// **'Too short'**
  String get passwordStrengthTooShort;

  /// No description provided for @youreClear.
  ///
  /// In en, this message translates to:
  /// **'You\'re clear'**
  String get youreClear;

  /// No description provided for @youreClearHint.
  ///
  /// In en, this message translates to:
  /// **'Nothing needs your attention right now.'**
  String get youreClearHint;

  /// No description provided for @noClassesToday.
  ///
  /// In en, this message translates to:
  /// **'No classes today'**
  String get noClassesToday;

  /// No description provided for @nothingNew.
  ///
  /// In en, this message translates to:
  /// **'Nothing new'**
  String get nothingNew;

  /// No description provided for @asOf.
  ///
  /// In en, this message translates to:
  /// **'As of {time}'**
  String asOf(String time);

  /// No description provided for @offlineBanner.
  ///
  /// In en, this message translates to:
  /// **'You\'re offline. Showing what you last saw.'**
  String get offlineBanner;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// No description provided for @tabToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get tabToday;

  /// No description provided for @tabTeaching.
  ///
  /// In en, this message translates to:
  /// **'Teaching'**
  String get tabTeaching;

  /// No description provided for @tabSpaces.
  ///
  /// In en, this message translates to:
  /// **'Spaces'**
  String get tabSpaces;

  /// No description provided for @tabMe.
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get tabMe;

  /// No description provided for @deactivatedTitle.
  ///
  /// In en, this message translates to:
  /// **'This account is no longer active'**
  String get deactivatedTitle;

  /// No description provided for @deactivatedBody.
  ///
  /// In en, this message translates to:
  /// **'Your institution has closed your Juvi account. If that\'s a mistake, contact the office below.'**
  String get deactivatedBody;

  /// No description provided for @pausedTitle.
  ///
  /// In en, this message translates to:
  /// **'Juvi is paused'**
  String get pausedTitle;

  /// No description provided for @updateRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Update Juvi to continue'**
  String get updateRequiredTitle;

  /// No description provided for @updateRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'Your college needs version {version} or later.'**
  String updateRequiredBody(String version);

  /// No description provided for @openStore.
  ///
  /// In en, this message translates to:
  /// **'Open the store'**
  String get openStore;

  /// No description provided for @signedOutElsewhere.
  ///
  /// In en, this message translates to:
  /// **'You were signed out from another device.'**
  String get signedOutElsewhere;

  /// No description provided for @signedOutPasswordChanged.
  ///
  /// In en, this message translates to:
  /// **'Your password was changed. Sign in again.'**
  String get signedOutPasswordChanged;

  /// No description provided for @signedOutGeneric.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again.'**
  String get signedOutGeneric;

  /// No description provided for @todayAttentionSection.
  ///
  /// In en, this message translates to:
  /// **'Attention'**
  String get todayAttentionSection;

  /// No description provided for @todayTimelineSection.
  ///
  /// In en, this message translates to:
  /// **'Timeline'**
  String get todayTimelineSection;

  /// No description provided for @todayGlanceSection.
  ///
  /// In en, this message translates to:
  /// **'At a glance'**
  String get todayGlanceSection;

  /// No description provided for @todayGlancePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Attendance and dues appear here soon'**
  String get todayGlancePlaceholder;

  /// No description provided for @teachingAcknowledgementsSection.
  ///
  /// In en, this message translates to:
  /// **'My acknowledgements'**
  String get teachingAcknowledgementsSection;

  /// No description provided for @teachingTodaySection.
  ///
  /// In en, this message translates to:
  /// **'Teaching today'**
  String get teachingTodaySection;

  /// No description provided for @teachingDepartmentSection.
  ///
  /// In en, this message translates to:
  /// **'Department'**
  String get teachingDepartmentSection;

  /// No description provided for @teachingCollegeSection.
  ///
  /// In en, this message translates to:
  /// **'College'**
  String get teachingCollegeSection;

  /// No description provided for @facultyHod.
  ///
  /// In en, this message translates to:
  /// **'Head of department'**
  String get facultyHod;

  /// No description provided for @studentSectionLabel.
  ///
  /// In en, this message translates to:
  /// **'Section {section}'**
  String studentSectionLabel(String section);

  /// No description provided for @meChangePhoto.
  ///
  /// In en, this message translates to:
  /// **'Change profile photo'**
  String get meChangePhoto;

  /// No description provided for @meReportIssue.
  ///
  /// In en, this message translates to:
  /// **'Something wrong? Tell the office'**
  String get meReportIssue;

  /// No description provided for @meSomethingWrongTitle.
  ///
  /// In en, this message translates to:
  /// **'Something wrong with your details?'**
  String get meSomethingWrongTitle;

  /// No description provided for @meSomethingWrongBody.
  ///
  /// In en, this message translates to:
  /// **'Juvi shows what your college records hold. The office can correct them.'**
  String get meSomethingWrongBody;

  /// No description provided for @meSettingsSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get meSettingsSectionTitle;

  /// Also used as the Me screen's entry label for the settings screen.
  ///
  /// In en, this message translates to:
  /// **'Notifications and quiet hours'**
  String get settingsTitle;

  /// Also used as the Me screen's entry label for the devices screen.
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get devicesTitle;

  /// Also used as the Me screen's entry label for the change-password screen.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get changePasswordTitle;

  /// No description provided for @meAboutSection.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get meAboutSection;

  /// No description provided for @meAppVersion.
  ///
  /// In en, this message translates to:
  /// **'Juvi {version}'**
  String meAppVersion(String version);

  /// No description provided for @meDataPrivacyNote.
  ///
  /// In en, this message translates to:
  /// **'Your data stays with your institution. Juvi never shares it with third parties.'**
  String get meDataPrivacyNote;

  /// No description provided for @meSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get meSignOut;

  /// No description provided for @settingsTiersSection.
  ///
  /// In en, this message translates to:
  /// **'Notification tiers'**
  String get settingsTiersSection;

  /// No description provided for @settingsTierUrgent.
  ///
  /// In en, this message translates to:
  /// **'Urgent'**
  String get settingsTierUrgent;

  /// No description provided for @settingsTierUrgentDesc.
  ///
  /// In en, this message translates to:
  /// **'Exam changes, campus closures. Always delivered; cannot be turned off.'**
  String get settingsTierUrgentDesc;

  /// No description provided for @settingsTierImportant.
  ///
  /// In en, this message translates to:
  /// **'Important'**
  String get settingsTierImportant;

  /// No description provided for @settingsTierImportantDesc.
  ///
  /// In en, this message translates to:
  /// **'Notices needing acknowledgement, department posts, mentions.'**
  String get settingsTierImportantDesc;

  /// No description provided for @settingsTierRoutine.
  ///
  /// In en, this message translates to:
  /// **'Routine'**
  String get settingsTierRoutine;

  /// No description provided for @settingsTierRoutineDesc.
  ///
  /// In en, this message translates to:
  /// **'Course posts and replies. Badge and digest only, no sound.'**
  String get settingsTierRoutineDesc;

  /// No description provided for @settingsQuietHoursSection.
  ///
  /// In en, this message translates to:
  /// **'Quiet hours'**
  String get settingsQuietHoursSection;

  /// No description provided for @settingsQuietStart.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get settingsQuietStart;

  /// No description provided for @settingsQuietEnd.
  ///
  /// In en, this message translates to:
  /// **'End'**
  String get settingsQuietEnd;

  /// No description provided for @settingsAppearanceSection.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get settingsAppearanceSection;

  /// No description provided for @settingsThemeSystem.
  ///
  /// In en, this message translates to:
  /// **'Follow system'**
  String get settingsThemeSystem;

  /// No description provided for @settingsThemeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get settingsThemeLight;

  /// No description provided for @settingsThemeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get settingsThemeDark;

  /// No description provided for @settingsLanguageSection.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguageSection;

  /// No description provided for @settingsLanguageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get settingsLanguageEnglish;

  /// No description provided for @settingsLanguageMore.
  ///
  /// In en, this message translates to:
  /// **'More languages are planned.'**
  String get settingsLanguageMore;

  /// No description provided for @deviceCurrentLabel.
  ///
  /// In en, this message translates to:
  /// **'{name} (this device)'**
  String deviceCurrentLabel(String name);

  /// No description provided for @deviceLastActive.
  ///
  /// In en, this message translates to:
  /// **'v{version} · last active {time}'**
  String deviceLastActive(String version, String time);

  /// No description provided for @deviceSignOutTooltip.
  ///
  /// In en, this message translates to:
  /// **'Sign out this device'**
  String get deviceSignOutTooltip;

  /// No description provided for @deviceSignOutOthers.
  ///
  /// In en, this message translates to:
  /// **'Sign out other devices'**
  String get deviceSignOutOthers;

  /// No description provided for @changePasswordSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password changed. Other devices were signed out.'**
  String get changePasswordSuccess;

  /// No description provided for @changePasswordNeedsConnection.
  ///
  /// In en, this message translates to:
  /// **'Changing your password needs a connection.'**
  String get changePasswordNeedsConnection;

  /// No description provided for @photoUploadNeedsConnection.
  ///
  /// In en, this message translates to:
  /// **'Photo upload needs a connection.'**
  String get photoUploadNeedsConnection;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// Action sheet entry: mute an unmuted channel.
  ///
  /// In en, this message translates to:
  /// **'Mute'**
  String get channelMute;

  /// Action sheet entry: unmute a muted channel.
  ///
  /// In en, this message translates to:
  /// **'Unmute'**
  String get channelUnmute;

  /// Action sheet entry on a Spaces row.
  ///
  /// In en, this message translates to:
  /// **'Mark all read'**
  String get channelMarkAllRead;

  /// Accessible custom action name for the long-press menu on a Spaces row, so screen reader users have an alternative to the long-press gesture.
  ///
  /// In en, this message translates to:
  /// **'Channel actions'**
  String get channelActionsLabel;

  /// Semantic label for the muted-bell icon on a Spaces row.
  ///
  /// In en, this message translates to:
  /// **'Muted'**
  String get channelMutedLabel;

  /// Section heading on the channel screen, above the channel's description.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get channelAboutTitle;

  /// Channel screen posting-rule line.
  ///
  /// In en, this message translates to:
  /// **'Who can post: {whoCanPost}'**
  String channelWhoCanPost(String whoCanPost);

  /// Channel screen: shown when replyRule is 'allowed'.
  ///
  /// In en, this message translates to:
  /// **'Members can reply in threads.'**
  String get channelReplyAllowed;

  /// Channel screen: shown when replyRule is 'announcement_only'.
  ///
  /// In en, this message translates to:
  /// **'Announcement only.'**
  String get channelAnnouncementOnly;

  /// Channel screen member count, for an active channel.
  ///
  /// In en, this message translates to:
  /// **'{count} members'**
  String channelMemberCount(int count);

  /// Channel screen member count, for an archived channel.
  ///
  /// In en, this message translates to:
  /// **'{count} members · Archived'**
  String channelMemberCountArchived(int count);

  /// Onboarding: advances to the next step.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get onboardingContinue;

  /// Onboarding: the Continue button's label on the last step.
  ///
  /// In en, this message translates to:
  /// **'Finish'**
  String get onboardingFinish;

  /// Accessible semantic label for the onboarding progress dots.
  ///
  /// In en, this message translates to:
  /// **'Step {step} of {total}'**
  String onboardingStepOfTotal(int step, int total);

  /// Shown when advancing an onboarding step fails because the device is offline.
  ///
  /// In en, this message translates to:
  /// **'This step needs a connection.'**
  String get onboardingStepNeedsConnection;

  /// Generic continue card shown for a server-sent onboarding step name the app doesn't recognise yet.
  ///
  /// In en, this message translates to:
  /// **'One more thing from your college is on its way. Continue for now.'**
  String get onboardingUnknownStepBody;

  /// Onboarding identity step heading.
  ///
  /// In en, this message translates to:
  /// **'Your college has set you up'**
  String get onboardingIdentityTitle;

  /// Onboarding identity step body.
  ///
  /// In en, this message translates to:
  /// **'Here\'s what {institution} has on record. Nothing to fill in.'**
  String onboardingIdentityBody(String institution);

  /// Onboarding identity step: optional photo upload prompt.
  ///
  /// In en, this message translates to:
  /// **'Add a photo (optional)'**
  String get onboardingAddPhoto;

  /// Onboarding spaces step heading.
  ///
  /// In en, this message translates to:
  /// **'Your spaces'**
  String get onboardingSpacesTitle;

  /// Onboarding spaces step body for a regular student.
  ///
  /// In en, this message translates to:
  /// **'One space for the college, your department, your batch and each course. They come from your registrations, so nothing to set up.'**
  String get onboardingSpacesBodyStudent;

  /// Onboarding spaces step body for a lateral-entry student.
  ///
  /// In en, this message translates to:
  /// **'You\'re joining the batch mid-way, so your spaces match the courses you\'re registered for now. First-year spaces aren\'t included.'**
  String get onboardingSpacesBodyLateral;

  /// Onboarding spaces step body for faculty.
  ///
  /// In en, this message translates to:
  /// **'One space per course you teach, plus your department and the college.'**
  String get onboardingSpacesBodyFaculty;

  /// Onboarding spaces step: shown instead of the space list when the initial load fails.
  ///
  /// In en, this message translates to:
  /// **'Spaces will appear once you are online.'**
  String get onboardingSpacesOffline;

  /// Onboarding notifications step heading.
  ///
  /// In en, this message translates to:
  /// **'Stay informed, not overwhelmed'**
  String get onboardingNotificationsTitle;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
