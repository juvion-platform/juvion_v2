# juvi_api.api.MobileApi

## Load the API package
```dart
import 'package:juvi_api/api.dart';
```

All URIs are relative to *http://localhost/api/juvi-app/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**acknowledgeNotice**](MobileApi.md#acknowledgenotice) | **POST** /notices/{id}/ack | Acknowledge a notice; 409 ALREADY_ACKNOWLEDGED carries the existing record
[**advanceOnboarding**](MobileApi.md#advanceonboarding) | **POST** /me/onboarding/advance | Complete the current onboarding step
[**changePassword**](MobileApi.md#changepassword) | **POST** /auth/change-password | Change password; revokes other sessions
[**clearPushToken**](MobileApi.md#clearpushtoken) | **DELETE** /me/devices/current/push-token | Remove this device&#39;s FCM token
[**dismissNotice**](MobileApi.md#dismissnotice) | **POST** /notices/{id}/dismiss | Dismiss a notice that needs no acknowledgement
[**getAttention**](MobileApi.md#getattention) | **GET** /attention | Due items: the notice stack, or every attention item with kinds&#x3D;all
[**getChannel**](MobileApi.md#getchannel) | **GET** /channels/{id} | Channel header and About
[**getConfig**](MobileApi.md#getconfig) | **GET** /config | Institution configuration for the signed-in user
[**getFirstNotice**](MobileApi.md#getfirstnotice) | **GET** /onboarding/first-notice | Onboarding step 4: the welcome notice
[**getMe**](MobileApi.md#getme) | **GET** /me | Identity card, account state, settings, institution
[**getMeAcademics**](MobileApi.md#getmeacademics) | **GET** /me/academics | Attendance and dues (student) or courses taught (faculty)
[**getNotice**](MobileApi.md#getnotice) | **GET** /notices/{id} | Notice detail with my state (does not mark it seen)
[**getNoticeAttachmentUrl**](MobileApi.md#getnoticeattachmenturl) | **GET** /notices/{id}/attachments/{key} | A 5-minute download URL for one attachment (key URL-encoded)
[**getNoticeReach**](MobileApi.md#getnoticereach) | **GET** /notices/{id}/reach | Reach for the publisher
[**getSettings**](MobileApi.md#getsettings) | **GET** /me/settings | Notification and language settings
[**getTeaching**](MobileApi.md#getteaching) | **GET** /teaching | Faculty today: today + tomorrow classes, next teaching day, faculty kind
[**getToday**](MobileApi.md#gettoday) | **GET** /today | Student today: today + tomorrow class lists and the glance
[**listDevices**](MobileApi.md#listdevices) | **GET** /me/devices | Signed-in devices
[**listNoticePending**](MobileApi.md#listnoticepending) | **GET** /notices/{id}/reach/pending | Pending members for the publisher, grouped and searchable
[**listNotices**](MobileApi.md#listnotices) | **GET** /notices | Notice cards by segment (due, done, all, published), cursor-paged
[**listSpaces**](MobileApi.md#listspaces) | **GET** /spaces | Grouped channel list
[**lookupInstitution**](MobileApi.md#lookupinstitution) | **GET** /institutions/{code} | Resolve an institution code for sign-in
[**markChannelRead**](MobileApi.md#markchannelread) | **POST** /channels/{id}/read | Mark a channel read
[**markNoticeSeen**](MobileApi.md#marknoticeseen) | **POST** /notices/{id}/seen | Mark a notice seen (once)
[**muteChannel**](MobileApi.md#mutechannel) | **PUT** /channels/{id}/mute | Mute a channel
[**postEvents**](MobileApi.md#postevents) | **POST** /events | Product analytics: allow-listed names, id-like props; invalid events are dropped one by one
[**postNotificationReceipts**](MobileApi.md#postnotificationreceipts) | **POST** /notifications/receipts | Delivered and opened receipts; each item is authorised by its HMAC receipt, not a session
[**refresh**](MobileApi.md#refresh) | **POST** /auth/refresh | Rotate the refresh token
[**registerPushToken**](MobileApi.md#registerpushtoken) | **PUT** /me/devices/current/push-token | Register this device&#39;s FCM token (cleared from any other session first)
[**remindNotice**](MobileApi.md#remindnotice) | **POST** /notices/{id}/remind | Send a reminder (at most two)
[**revokeDevice**](MobileApi.md#revokedevice) | **DELETE** /me/devices/{id} | Sign out one device
[**revokeOtherDevices**](MobileApi.md#revokeotherdevices) | **POST** /me/devices/revoke-others | Sign out every other device
[**signIn**](MobileApi.md#signin) | **POST** /auth/sign-in | Sign in with institution, identifier and password
[**signOut**](MobileApi.md#signout) | **POST** /auth/sign-out | Revoke this session
[**unmuteChannel**](MobileApi.md#unmutechannel) | **DELETE** /channels/{id}/mute | Unmute a channel
[**updateSettings**](MobileApi.md#updatesettings) | **PATCH** /me/settings | Update settings
[**uploadPhoto**](MobileApi.md#uploadphoto) | **POST** /me/photo | Upload a profile photo (multipart field \&quot;file\&quot;)


# **acknowledgeNotice**
> AckResult acknowledgeNotice(id, ackRequest)

Acknowledge a notice; 409 ALREADY_ACKNOWLEDGED carries the existing record

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 
final AckRequest ackRequest = ; // AckRequest | 

try {
    final response = api.acknowledgeNotice(id, ackRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->acknowledgeNotice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **ackRequest** | [**AckRequest**](AckRequest.md)|  | [optional] 

### Return type

[**AckResult**](AckResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **advanceOnboarding**
> OnboardingState advanceOnboarding(onboardingAdvance)

Complete the current onboarding step

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final OnboardingAdvance onboardingAdvance = ; // OnboardingAdvance | 

try {
    final response = api.advanceOnboarding(onboardingAdvance);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->advanceOnboarding: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **onboardingAdvance** | [**OnboardingAdvance**](OnboardingAdvance.md)|  | [optional] 

### Return type

[**OnboardingState**](OnboardingState.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **changePassword**
> changePassword(changePasswordRequest)

Change password; revokes other sessions

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final ChangePasswordRequest changePasswordRequest = ; // ChangePasswordRequest | 

try {
    api.changePassword(changePasswordRequest);
} catch on DioException (e) {
    print('Exception when calling MobileApi->changePassword: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **changePasswordRequest** | [**ChangePasswordRequest**](ChangePasswordRequest.md)|  | [optional] 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **clearPushToken**
> clearPushToken()

Remove this device's FCM token

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    api.clearPushToken();
} catch on DioException (e) {
    print('Exception when calling MobileApi->clearPushToken: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **dismissNotice**
> DismissResult dismissNotice(id)

Dismiss a notice that needs no acknowledgement

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.dismissNotice(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->dismissNotice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**DismissResult**](DismissResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAttention**
> Attention getAttention(kinds)

Due items: the notice stack, or every attention item with kinds=all

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String kinds = kinds_example; // String | 

try {
    final response = api.getAttention(kinds);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getAttention: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **kinds** | **String**|  | [optional] 

### Return type

[**Attention**](Attention.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getChannel**
> ChannelDetail getChannel(id)

Channel header and About

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.getChannel(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getChannel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ChannelDetail**](ChannelDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getConfig**
> Config getConfig()

Institution configuration for the signed-in user

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getConfig();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getConfig: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Config**](Config.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getFirstNotice**
> NoticeDetail getFirstNotice()

Onboarding step 4: the welcome notice

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getFirstNotice();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getFirstNotice: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**NoticeDetail**](NoticeDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMe**
> Me getMe()

Identity card, account state, settings, institution

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getMe();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getMe: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Me**](Me.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMeAcademics**
> MeAcademics getMeAcademics()

Attendance and dues (student) or courses taught (faculty)

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getMeAcademics();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getMeAcademics: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**MeAcademics**](MeAcademics.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getNotice**
> NoticeDetail getNotice(id)

Notice detail with my state (does not mark it seen)

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.getNotice(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getNotice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**NoticeDetail**](NoticeDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getNoticeAttachmentUrl**
> NoticeAttachmentUrl getNoticeAttachmentUrl(id, key)

A 5-minute download URL for one attachment (key URL-encoded)

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 
final String key = key_example; // String | 

try {
    final response = api.getNoticeAttachmentUrl(id, key);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getNoticeAttachmentUrl: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **key** | **String**|  | 

### Return type

[**NoticeAttachmentUrl**](NoticeAttachmentUrl.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getNoticeReach**
> NoticeReach getNoticeReach(id)

Reach for the publisher

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.getNoticeReach(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getNoticeReach: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**NoticeReach**](NoticeReach.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getSettings**
> Settings getSettings()

Notification and language settings

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getSettings();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getSettings: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Settings**](Settings.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getTeaching**
> Teaching getTeaching()

Faculty today: today + tomorrow classes, next teaching day, faculty kind

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getTeaching();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getTeaching: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Teaching**](Teaching.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getToday**
> Today getToday()

Student today: today + tomorrow class lists and the glance

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getToday();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getToday: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Today**](Today.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDevices**
> Devices listDevices()

Signed-in devices

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.listDevices();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->listDevices: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Devices**](Devices.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listNoticePending**
> NoticePending listNoticePending(id, group, q, cursor, limit)

Pending members for the publisher, grouped and searchable

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 
final String group = group_example; // String | 
final String q = q_example; // String | 
final String cursor = cursor_example; // String | 
final int limit = 56; // int | 

try {
    final response = api.listNoticePending(id, group, q, cursor, limit);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->listNoticePending: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **group** | **String**|  | [optional] 
 **q** | **String**|  | [optional] 
 **cursor** | **String**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

### Return type

[**NoticePending**](NoticePending.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listNotices**
> NoticeList listNotices(segment, office, cursor, limit)

Notice cards by segment (due, done, all, published), cursor-paged

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String segment = segment_example; // String | 
final String office = office_example; // String | 
final String cursor = cursor_example; // String | 
final int limit = 56; // int | 

try {
    final response = api.listNotices(segment, office, cursor, limit);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->listNotices: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **segment** | **String**|  | [optional] [default to 'all']
 **office** | **String**|  | [optional] 
 **cursor** | **String**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 20]

### Return type

[**NoticeList**](NoticeList.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listSpaces**
> Spaces listSpaces()

Grouped channel list

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.listSpaces();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->listSpaces: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Spaces**](Spaces.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **lookupInstitution**
> InstitutionLookup lookupInstitution(code)

Resolve an institution code for sign-in

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String code = code_example; // String | 

try {
    final response = api.lookupInstitution(code);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->lookupInstitution: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **String**|  | 

### Return type

[**InstitutionLookup**](InstitutionLookup.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **markChannelRead**
> ReadResult markChannelRead(id)

Mark a channel read

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.markChannelRead(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->markChannelRead: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ReadResult**](ReadResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **markNoticeSeen**
> SeenResult markNoticeSeen(id)

Mark a notice seen (once)

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.markNoticeSeen(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->markNoticeSeen: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**SeenResult**](SeenResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **muteChannel**
> MuteResult muteChannel(id)

Mute a channel

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.muteChannel(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->muteChannel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**MuteResult**](MuteResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postEvents**
> EventsResult postEvents(eventsRequest)

Product analytics: allow-listed names, id-like props; invalid events are dropped one by one

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final EventsRequest eventsRequest = ; // EventsRequest | 

try {
    final response = api.postEvents(eventsRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->postEvents: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **eventsRequest** | [**EventsRequest**](EventsRequest.md)|  | [optional] 

### Return type

[**EventsResult**](EventsResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postNotificationReceipts**
> ReceiptsResult postNotificationReceipts(receiptsRequest)

Delivered and opened receipts; each item is authorised by its HMAC receipt, not a session

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final ReceiptsRequest receiptsRequest = ; // ReceiptsRequest | 

try {
    final response = api.postNotificationReceipts(receiptsRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->postNotificationReceipts: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **receiptsRequest** | [**ReceiptsRequest**](ReceiptsRequest.md)|  | [optional] 

### Return type

[**ReceiptsResult**](ReceiptsResult.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refresh**
> Tokens refresh(refreshRequest)

Rotate the refresh token

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final RefreshRequest refreshRequest = ; // RefreshRequest | 

try {
    final response = api.refresh(refreshRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->refresh: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshRequest** | [**RefreshRequest**](RefreshRequest.md)|  | [optional] 

### Return type

[**Tokens**](Tokens.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **registerPushToken**
> registerPushToken(pushTokenRequest)

Register this device's FCM token (cleared from any other session first)

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final PushTokenRequest pushTokenRequest = ; // PushTokenRequest | 

try {
    api.registerPushToken(pushTokenRequest);
} catch on DioException (e) {
    print('Exception when calling MobileApi->registerPushToken: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pushTokenRequest** | [**PushTokenRequest**](PushTokenRequest.md)|  | [optional] 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **remindNotice**
> RemindResult remindNotice(id)

Send a reminder (at most two)

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.remindNotice(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->remindNotice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**RemindResult**](RemindResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeDevice**
> revokeDevice(id)

Sign out one device

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    api.revokeDevice(id);
} catch on DioException (e) {
    print('Exception when calling MobileApi->revokeDevice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeOtherDevices**
> RevokedCount revokeOtherDevices()

Sign out every other device

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.revokeOtherDevices();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->revokeOtherDevices: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**RevokedCount**](RevokedCount.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **signIn**
> SignInResponse signIn(signInRequest)

Sign in with institution, identifier and password

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final SignInRequest signInRequest = ; // SignInRequest | 

try {
    final response = api.signIn(signInRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->signIn: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **signInRequest** | [**SignInRequest**](SignInRequest.md)|  | [optional] 

### Return type

[**SignInResponse**](SignInResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **signOut**
> signOut()

Revoke this session

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    api.signOut();
} catch on DioException (e) {
    print('Exception when calling MobileApi->signOut: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unmuteChannel**
> MuteResult unmuteChannel(id)

Unmute a channel

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.unmuteChannel(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->unmuteChannel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**MuteResult**](MuteResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateSettings**
> Settings updateSettings(settingsPatch)

Update settings

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final SettingsPatch settingsPatch = ; // SettingsPatch | 

try {
    final response = api.updateSettings(settingsPatch);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->updateSettings: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **settingsPatch** | [**SettingsPatch**](SettingsPatch.md)|  | [optional] 

### Return type

[**Settings**](Settings.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadPhoto**
> PhotoResult uploadPhoto(file)

Upload a profile photo (multipart field \"file\")

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final MultipartFile file = BINARY_DATA_HERE; // MultipartFile | 

try {
    final response = api.uploadPhoto(file);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->uploadPhoto: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **MultipartFile**|  | 

### Return type

[**PhotoResult**](PhotoResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

