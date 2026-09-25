import 'package:test/test.dart';
import 'package:juvi_api/juvi_api.dart';


/// tests for MobileApi
void main() {
  final instance = JuviApi().getMobileApi();

  group(MobileApi, () {
    // Complete the current onboarding step
    //
    //Future<OnboardingState> advanceOnboarding({ OnboardingAdvance onboardingAdvance }) async
    test('test advanceOnboarding', () async {
      // TODO
    });

    // Change password; revokes other sessions
    //
    //Future changePassword({ ChangePasswordRequest changePasswordRequest }) async
    test('test changePassword', () async {
      // TODO
    });

    // Channel header and About
    //
    //Future<ChannelDetail> getChannel(String id) async
    test('test getChannel', () async {
      // TODO
    });

    // Institution configuration for the signed-in user
    //
    //Future<Config> getConfig() async
    test('test getConfig', () async {
      // TODO
    });

    // Identity card, account state, settings, institution
    //
    //Future<Me> getMe() async
    test('test getMe', () async {
      // TODO
    });

    // Notification and language settings
    //
    //Future<Settings> getSettings() async
    test('test getSettings', () async {
      // TODO
    });

    // Signed-in devices
    //
    //Future<Devices> listDevices() async
    test('test listDevices', () async {
      // TODO
    });

    // Grouped channel list
    //
    //Future<Spaces> listSpaces() async
    test('test listSpaces', () async {
      // TODO
    });

    // Resolve an institution code for sign-in
    //
    //Future<InstitutionLookup> lookupInstitution(String code) async
    test('test lookupInstitution', () async {
      // TODO
    });

    // Mark a channel read
    //
    //Future<ReadResult> markChannelRead(String id) async
    test('test markChannelRead', () async {
      // TODO
    });

    // Mute a channel
    //
    //Future<MuteResult> muteChannel(String id) async
    test('test muteChannel', () async {
      // TODO
    });

    // Rotate the refresh token
    //
    //Future<Tokens> refresh({ RefreshRequest refreshRequest }) async
    test('test refresh', () async {
      // TODO
    });

    // Sign out one device
    //
    //Future revokeDevice(String id) async
    test('test revokeDevice', () async {
      // TODO
    });

    // Sign out every other device
    //
    //Future<RevokedCount> revokeOtherDevices() async
    test('test revokeOtherDevices', () async {
      // TODO
    });

    // Sign in with institution, identifier and password
    //
    //Future<SignInResponse> signIn({ SignInRequest signInRequest }) async
    test('test signIn', () async {
      // TODO
    });

    // Revoke this session
    //
    //Future signOut() async
    test('test signOut', () async {
      // TODO
    });

    // Unmute a channel
    //
    //Future<MuteResult> unmuteChannel(String id) async
    test('test unmuteChannel', () async {
      // TODO
    });

    // Update settings
    //
    //Future<Settings> updateSettings({ SettingsPatch settingsPatch }) async
    test('test updateSettings', () async {
      // TODO
    });

    // Upload a profile photo (multipart field \"file\")
    //
    //Future<PhotoResult> uploadPhoto(MultipartFile file) async
    test('test uploadPhoto', () async {
      // TODO
    });

  });
}
