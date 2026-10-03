import 'package:test/test.dart';
import 'package:juvi_api/juvi_api.dart';


/// tests for MobileApi
void main() {
  final instance = JuviApi().getMobileApi();

  group(MobileApi, () {
    // Acknowledge a notice; 409 ALREADY_ACKNOWLEDGED carries the existing record
    //
    //Future<AckResult> acknowledgeNotice(String id, { AckRequest ackRequest }) async
    test('test acknowledgeNotice', () async {
      // TODO
    });

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

    // Remove this device's FCM token
    //
    //Future clearPushToken() async
    test('test clearPushToken', () async {
      // TODO
    });

    // Dismiss a notice that needs no acknowledgement
    //
    //Future<DismissResult> dismissNotice(String id) async
    test('test dismissNotice', () async {
      // TODO
    });

    // Due acknowledgement notices: count and the first three
    //
    //Future<Attention> getAttention() async
    test('test getAttention', () async {
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

    // Onboarding step 4: the welcome notice
    //
    //Future<NoticeDetail> getFirstNotice() async
    test('test getFirstNotice', () async {
      // TODO
    });

    // Identity card, account state, settings, institution
    //
    //Future<Me> getMe() async
    test('test getMe', () async {
      // TODO
    });

    // Notice detail with my state (does not mark it seen)
    //
    //Future<NoticeDetail> getNotice(String id) async
    test('test getNotice', () async {
      // TODO
    });

    // A 5-minute download URL for one attachment (key URL-encoded)
    //
    //Future<NoticeAttachmentUrl> getNoticeAttachmentUrl(String id, String key) async
    test('test getNoticeAttachmentUrl', () async {
      // TODO
    });

    // Reach for the publisher
    //
    //Future<NoticeReach> getNoticeReach(String id) async
    test('test getNoticeReach', () async {
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

    // Pending members for the publisher, grouped and searchable
    //
    //Future<NoticePending> listNoticePending(String id, { String group, String q, String cursor, int limit }) async
    test('test listNoticePending', () async {
      // TODO
    });

    // Notice cards by segment (due, done, all, published), cursor-paged
    //
    //Future<NoticeList> listNotices({ String segment, String office, String cursor, int limit }) async
    test('test listNotices', () async {
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

    // Mark a notice seen (once)
    //
    //Future<SeenResult> markNoticeSeen(String id) async
    test('test markNoticeSeen', () async {
      // TODO
    });

    // Mute a channel
    //
    //Future<MuteResult> muteChannel(String id) async
    test('test muteChannel', () async {
      // TODO
    });

    // Product analytics: allow-listed names, id-like props; invalid events are dropped one by one
    //
    //Future<EventsResult> postEvents({ EventsRequest eventsRequest }) async
    test('test postEvents', () async {
      // TODO
    });

    // Delivered and opened receipts; each item is authorised by its HMAC receipt, not a session
    //
    //Future<ReceiptsResult> postNotificationReceipts({ ReceiptsRequest receiptsRequest }) async
    test('test postNotificationReceipts', () async {
      // TODO
    });

    // Rotate the refresh token
    //
    //Future<Tokens> refresh({ RefreshRequest refreshRequest }) async
    test('test refresh', () async {
      // TODO
    });

    // Register this device's FCM token (cleared from any other session first)
    //
    //Future registerPushToken({ PushTokenRequest pushTokenRequest }) async
    test('test registerPushToken', () async {
      // TODO
    });

    // Send a reminder (at most two)
    //
    //Future<RemindResult> remindNotice(String id) async
    test('test remindNotice', () async {
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
